import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download, Calendar, Filter, AlertTriangle, Loader2, BarChart3, Wrench, ClipboardCheck, Eye, FileSpreadsheet, X, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { useEquipment } from '@/hooks/useEquipment';
import { useInspections } from '@/hooks/useInspections';
import { useCategories } from '@/hooks/useCategories';
import { useShips } from '@/hooks/useShips';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { useAuth } from '@/contexts/AuthContext';
import { useProfiles } from '@/hooks/useProfiles';
import { useUserSignature } from '@/hooks/useUserSignature';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';
import { useQueryClient } from '@tanstack/react-query';
import { exportInspectionsToExcel, exportInspectionsToPDF } from '@/utils/exportInspections';
import { exportCategoryInspectionPDF } from '@/utils/exportCategoryInspection';
import { exportMonthlyConsolidatedPDF, exportMonthlyConsolidatedExcel } from '@/utils/exportMonthlyConsolidated';
import { addPDFHeader, addPDFFooter, addSignatureSection, preloadLogo } from '@/utils/pdfStyles';
import { ReportPreviewDialog } from '@/components/reports/ReportPreviewDialog';
import { MonthQuickFilter } from '@/components/reports/MonthQuickFilter';
import { toast } from 'sonner';
import { format, isAfter, isBefore, addDays, startOfDay, parseISO } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { haptic } from '@/utils/hapticFeedback';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

type ReportType = 'inspections' | 'maintenance' | 'category' | 'expiry' | 'non-conformities' | 'category-inspection' | 'monthly-consolidated' | null;

export default function Reports() {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const dateLocale = i18n.language === 'en' ? enUS : ptBR;

  const statusLabels: Record<string, string> = {
    active: t('reports.statusActive'),
    maintenance: t('reports.statusMaintenance'),
    expired: t('reports.statusExpired'),
    rejected: t('reports.statusRejected'),
    inactive: t('reports.statusInactive'),
  };

  const maintenanceStatusLabels: Record<string, string> = {
    pending: t('maintenance.statusPending'),
    approved: t('maintenance.statusApproved'),
    in_progress: t('maintenance.statusInProgress'),
    completed: t('maintenance.statusCompleted'),
    rejected: t('maintenance.statusRejected'),
  };

  const maintenancePriorityLabels: Record<string, string> = {
    low: t('maintenance.priorityLow'),
    medium: t('maintenance.priorityMedium'),
    high: t('maintenance.priorityHigh'),
    critical: t('maintenance.priorityCritical'),
  };

  const maintenanceTypeLabels: Record<string, string> = {
    corrective: t('maintenance.typeCorrective'),
    preventive: t('maintenance.typePreventive'),
  };

  const inspectionStatusLabels: Record<string, string> = {
    compliant: t('inspections.statusCompliant'),
    attention: t('inspections.statusAttention'),
    'non-compliant': t('inspections.statusNonCompliant'),
    rejected: t('inspections.statusRejected'),
  };
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useProfiles();
  const { data: equipment = [], isLoading: equipmentLoading, refetch: refetchEquipment } = useEquipment();
  const { data: inspections = [], isLoading: inspectionsLoading, refetch: refetchInspections } = useInspections();
  const { data: categories = [], refetch: refetchCategories } = useCategories();
  const { data: ships = [], refetch: refetchShips } = useShips();
  const { data: maintenanceRequests = [], isLoading: maintenanceLoading, refetch: refetchMaintenance } = useMaintenanceRequests();
  const { data: signatureData } = useUserSignature();
  const signature = signatureData?.default_signature;
  const branding = useOrganizationBranding();

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    haptic('medium');
    await Promise.all([
      refetchEquipment(),
      refetchInspections(),
      refetchCategories(),
      refetchShips(),
      refetchMaintenance(),
    ]);
    toast.success(t('common.dataRefreshed'));
  }, [refetchEquipment, refetchInspections, refetchCategories, refetchShips, refetchMaintenance, t]);

  const { pullDistance, isRefreshing, containerRef, pullIndicatorStyle } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  // Preload logo for PDFs
  useEffect(() => {
    preloadLogo(branding);
  }, [branding]);

  // Get full profile with position
  const currentUserProfile = useMemo(() => {
    return profiles.find(p => p.user_id === user?.id);
  }, [profiles, user?.id]);

  // Filters
  const [shipFilter, setShipFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [filtersOpen, setFiltersOpen] = useState(!isMobile);

  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<ReportType>(null);

  const isLoading = equipmentLoading || inspectionsLoading || maintenanceLoading;

  // Filtered data based on global filters
  const filteredEquipment = useMemo(() => {
    return equipment.filter(item => {
      if (shipFilter !== 'all' && item.ship_id !== shipFilter) return false;
      if (categoryFilter !== 'all' && item.category_id !== categoryFilter) return false;
      return true;
    });
  }, [equipment, shipFilter, categoryFilter]);

  const filteredInspections = useMemo(() => {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    
    return inspections.filter(item => {
      const equipmentItem = equipment.find(e => e.id === item.equipment_id);
      if (shipFilter !== 'all' && equipmentItem?.ship_id !== shipFilter) return false;
      if (categoryFilter !== 'all' && equipmentItem?.category_id !== categoryFilter) return false;
      if (startDate && isBefore(new Date(item.inspection_date), startOfDay(startDate))) return false;
      if (endDate && isAfter(new Date(item.inspection_date), startOfDay(addDays(endDate, 1)))) return false;
      return true;
    });
  }, [inspections, equipment, shipFilter, categoryFilter, startDateStr, endDateStr]);

  // Filter maintenance requests
  const filteredMaintenance = useMemo(() => {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    
    return maintenanceRequests.filter(item => {
      if (shipFilter !== 'all' && item.ship_id !== shipFilter) return false;
      if (startDate && isBefore(new Date(item.created_at), startOfDay(startDate))) return false;
      if (endDate && isAfter(new Date(item.created_at), startOfDay(addDays(endDate, 1)))) return false;
      return true;
    });
  }, [maintenanceRequests, shipFilter, startDateStr, endDateStr]);

  // Report 1: Inspection Report
  const handleInspectionReportPDF = (preview = false) => {
    if (filteredInspections.length === 0) {
      toast.error(t('reports.noInspectionFound'));
      return;
    }
    exportInspectionsToPDF(filteredInspections, 'relatorio_inspecoes', branding, { preview });
    toast.success(preview ? t('common.pdfPreviewOpened') : t('reports.inspectionsExportedPDF'));
  };

  const handleInspectionReportExcel = () => {
    if (filteredInspections.length === 0) {
      toast.error(t('reports.noInspectionFound'));
      return;
    }
    exportInspectionsToExcel(filteredInspections, 'relatorio_inspecoes');
    toast.success(t('reports.inspectionsExportedExcel'));
  };

  // Report 2: Category Report
  const handleCategoryReportPDF = async (preview = false) => {
    if (filteredEquipment.length === 0) {
      toast.error(t('reports.noEquipmentFound'));
      return;
    }

    const doc = new jsPDF('landscape');
    const startY = await addPDFHeader(
      doc,
      t('reports.categoryReport'),
      `${t('common.createdAt')}: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: dateLocale })}`,
      undefined,
      { branding }
    );

    // Group by category
    const groupedByCategory = categories.map(cat => {
      const catEquipment = filteredEquipment.filter(e => e.category_id === cat.id);
      const active = catEquipment.filter(e => e.status === 'active').length;
      const maintenance = catEquipment.filter(e => e.status === 'maintenance').length;
      const expired = catEquipment.filter(e => e.status === 'expired').length;
      const rejected = catEquipment.filter(e => e.status === 'rejected').length;
      const compliance = catEquipment.length > 0 
        ? Math.round((active / catEquipment.length) * 100) 
        : 0;
      
      return [
        cat.name,
        catEquipment.length.toString(),
        active.toString(),
        maintenance.toString(),
        expired.toString(),
        rejected.toString(),
        `${compliance}%`
      ];
    }).filter(row => parseInt(row[1]) > 0);

    autoTable(doc, {
      startY: startY,
      head: [[t('reports.category'), t('reports.total'), t('reports.active'), t('reports.maintenance'), t('reports.statusExpired'), t('reports.statusRejected'), t('reports.compliance')]],
      body: groupedByCategory,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 85, 154] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    // Add signature
    const finalY = (doc as any).lastAutoTable?.finalY || startY + 50;
    addSignatureSection(
      doc,
      finalY + 10,
      currentUserProfile?.full_name || t('common.name'),
      currentUserProfile?.position,
      signature
    );

    addPDFFooter(doc, `${branding.name} - ${t('reports.footerAutoGenerated')}`, t('reports.categoryReport'));
    
    if (preview) {
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      toast.success(t('common.pdfPreviewOpened'));
    } else {
      doc.save(`${t('reports.fileNameCategory')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success(t('reports.categoryExportedPDF'));
    }
  };

  const handleCategoryReportExcel = () => {
    if (filteredEquipment.length === 0) {
      toast.error(t('reports.noEquipmentFound'));
      return;
    }

    const data = categories.map(cat => {
      const catEquipment = filteredEquipment.filter(e => e.category_id === cat.id);
      const active = catEquipment.filter(e => e.status === 'active').length;
      const maintenance = catEquipment.filter(e => e.status === 'maintenance').length;
      const expired = catEquipment.filter(e => e.status === 'expired').length;
      const rejected = catEquipment.filter(e => e.status === 'rejected').length;
      const compliance = catEquipment.length > 0 
        ? Math.round((active / catEquipment.length) * 100) 
        : 0;

      return {
        category: cat.name,
        total: catEquipment.length,
        active,
        maintenance,
        expired,
        rejected,
        compliance,
      };
    }).filter(row => row.total > 0);

    // Create localized data for export
    const localizedData = data.map(row => ({
      [t('reports.category')]: row.category,
      [t('reports.total')]: row.total,
      [t('reports.active')]: row.active,
      [t('reports.statusMaintenance')]: row.maintenance,
      [t('reports.statusExpired')]: row.expired,
      [t('reports.statusRejected')]: row.rejected,
      [t('reports.compliance') + ' (%)']: row.compliance,
    }));

    const ws = XLSX.utils.json_to_sheet(localizedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('reports.sheetCategories'));
    XLSX.writeFile(wb, `${t('reports.fileNameCategory')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success(t('reports.categoryExportedExcel'));
  };

  // Report 3: Expiry Report
  const expiringEquipment = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    
    return filteredEquipment.filter(item => {
      if (!item.certificate_expiry) return false;
      const expiryDate = new Date(item.certificate_expiry);
      return isBefore(expiryDate, thirtyDaysFromNow);
    }).sort((a, b) => {
      const dateA = new Date(a.certificate_expiry!);
      const dateB = new Date(b.certificate_expiry!);
      return dateA.getTime() - dateB.getTime();
    });
  }, [filteredEquipment]);

  const handleExpiryReportPDF = async (preview = false) => {
    if (expiringEquipment.length === 0) {
      toast.error(t('reports.noExpiringCertificates'));
      return;
    }

    const doc = new jsPDF('landscape');
    const startY = await addPDFHeader(
      doc,
      t('reports.expiryReport'),
      `${t('reports.expiringCertificates')}: ${expiringEquipment.length}`,
      undefined,
      { branding }
    );

    const tableData = expiringEquipment.map(item => {
      const expiryDate = new Date(item.certificate_expiry!);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const status = daysUntilExpiry < 0 ? t('reports.expired') : `${daysUntilExpiry} ${t('reports.days')}`;

      return [
        item.internal_code,
        item.name,
        item.categories?.name || '—',
        item.location,
        format(expiryDate, 'dd/MM/yyyy', { locale: dateLocale }),
        status,
      ];
    });

    autoTable(doc, {
      startY: startY,
      head: [[t('reports.code'), t('reports.equipment'), t('reports.category'), t('common.location'), t('reports.expiry'), t('reports.status')]],
      body: tableData,
      styles: { 
        fontSize: 9, 
        cellPadding: 4,
        minCellHeight: 10,
      },
      headStyles: { 
        fillColor: [220, 38, 38],
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 4,
      },
      alternateRowStyles: { fillColor: [254, 242, 242] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || startY + 50;
    addSignatureSection(
      doc,
      finalY + 10,
      currentUserProfile?.full_name || t('common.name'),
      currentUserProfile?.position,
      signature
    );

    addPDFFooter(doc, `${branding.name} - ${t('reports.footerAutoGenerated')}`, t('reports.expiryReport'));
    
    if (preview) {
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      toast.success(t('common.pdfPreviewOpened'));
    } else {
      doc.save(`${t('reports.fileNameExpiry')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success(t('reports.expiryExportedPDF'));
    }
  };

  const handleExpiryReportExcel = () => {
    if (expiringEquipment.length === 0) {
      toast.error(t('reports.noExpiringCertificates'));
      return;
    }

    const data = expiringEquipment.map(item => {
      const expiryDate = new Date(item.certificate_expiry!);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      return {
        [t('reports.code')]: item.internal_code,
        [t('common.name')]: item.name,
        [t('reports.category')]: item.categories?.name || '—',
        [t('common.location')]: item.location,
        [t('reports.expiry')]: format(expiryDate, 'dd/MM/yyyy', { locale: dateLocale }),
        [t('reports.daysRemaining')]: daysUntilExpiry,
        [t('reports.status')]: daysUntilExpiry < 0 ? t('reports.statusExpired') : t('reports.toExpire'),
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('reports.sheetExpiry'));
    XLSX.writeFile(wb, `${t('reports.fileNameExpiry')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success(t('reports.expiryExportedExcel'));
  };

  // Report 4: Non-Conformities Report
  const nonConformities = useMemo(() => {
    return filteredInspections.filter(i => 
      i.status === 'rejected' || i.status === 'non-compliant' || i.status === 'attention'
    );
  }, [filteredInspections]);

  const handleNonConformitiesReportPDF = async (preview = false) => {
    if (nonConformities.length === 0) {
      toast.error(t('reports.noNonConformityFound'));
      return;
    }

    const doc = new jsPDF('landscape');
    const startY = await addPDFHeader(
      doc,
      t('reports.nonConformityReport'),
      `${t('reports.total')}: ${nonConformities.length}`,
      undefined,
      { branding }
    );

    const tableData = nonConformities.map(item => {
      // Find full equipment data to check alerts
      const fullEquipment = equipment.find(e => e.id === item.equipment_id);
      const alertIndicators: string[] = [];
      
      if (fullEquipment) {
        const today = new Date().toISOString().split('T')[0];
        if (fullEquipment.certificate_expiry && fullEquipment.certificate_expiry < today) {
          alertIndicators.push(t('alerts.reportCertExpired'));
        }
        if (fullEquipment.expiry_date && fullEquipment.expiry_date < today) {
          alertIndicators.push(t('alerts.reportEquipExpired'));
        }
        if (fullEquipment.next_inspection && fullEquipment.next_inspection < today) {
          alertIndicators.push(t('alerts.reportInspOverdue'));
        }
      }
      
      const alertsText = alertIndicators.length > 0 ? alertIndicators.join(' ') : '—';
      
      return [
        format(new Date(item.inspection_date), 'dd/MM/yyyy', { locale: dateLocale }),
        item.equipment?.name || '—',
        item.equipment?.internal_code || '—',
        item.profiles?.full_name || '—',
        item.status === 'attention' ? t('reports.attention') : t('reports.nonCompliant'),
        alertsText,
        item.observations?.substring(0, 35) || '—',
      ];
    });

    autoTable(doc, {
      startY: startY,
      head: [[t('reports.date'), t('reports.equipment'), t('reports.code'), t('reports.inspector'), t('reports.status'), t('reports.equipmentAlerts'), t('reports.observations')]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [234, 88, 12] },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      columnStyles: {
        5: { cellWidth: 35 } // Alerts column
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || startY + 50;
    addSignatureSection(
      doc,
      finalY + 10,
      currentUserProfile?.full_name || t('common.name'),
      currentUserProfile?.position,
      signature
    );

    addPDFFooter(doc, `${branding.name} - ${t('reports.footerAutoGenerated')}`, t('reports.nonConformityReport'));
    
    if (preview) {
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      toast.success(t('common.pdfPreviewOpened'));
    } else {
      doc.save(`${t('reports.fileNameNonConformity')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success(t('reports.nonConformityExportedPDF'));
    }
  };

  const handleNonConformitiesReportExcel = () => {
    if (nonConformities.length === 0) {
      toast.error(t('reports.noNonConformityFound'));
      return;
    }

    const data = nonConformities.map(item => {
      // Find full equipment data to check alerts
      const fullEquipment = equipment.find(e => e.id === item.equipment_id);
      const alertIndicators: string[] = [];
      
      if (fullEquipment) {
        const today = new Date().toISOString().split('T')[0];
        if (fullEquipment.certificate_expiry && fullEquipment.certificate_expiry < today) {
          alertIndicators.push(t('alerts.reportCertExpired'));
        }
        if (fullEquipment.expiry_date && fullEquipment.expiry_date < today) {
          alertIndicators.push(t('alerts.reportEquipExpired'));
        }
        if (fullEquipment.next_inspection && fullEquipment.next_inspection < today) {
          alertIndicators.push(t('alerts.reportInspOverdue'));
        }
      }
      
      return {
        [t('reports.date')]: format(new Date(item.inspection_date), 'dd/MM/yyyy', { locale: dateLocale }),
        [t('reports.equipment')]: item.equipment?.name || '—',
        [t('reports.code')]: item.equipment?.internal_code || '—',
        [t('reports.inspector')]: item.profiles?.full_name || '—',
        [t('reports.status')]: item.status === 'attention' ? t('reports.attention') : t('reports.nonCompliant'),
        [t('reports.equipmentAlerts')]: alertIndicators.length > 0 ? alertIndicators.join(' | ') : '—',
        [t('reports.observations')]: item.observations || '—',
        [t('inspections.recommendations')]: item.recommendations || '—',
        [t('inspections.actionsTaken')]: item.actions_taken || '—',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('reports.sheetNonConformity'));
    XLSX.writeFile(wb, `${t('reports.fileNameNonConformity')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success(t('reports.nonConformityExportedExcel'));
  };

  // Report 5: Maintenance Report
  const handleMaintenanceReportPDF = async (preview = false) => {
    if (filteredMaintenance.length === 0) {
      toast.error(t('reports.noMaintenanceFound'));
      return;
    }

    const doc = new jsPDF('landscape');
    
    // Stats
    const pending = filteredMaintenance.filter(m => m.status === 'pending').length;
    const inProgress = filteredMaintenance.filter(m => m.status === 'in_progress').length;
    const completed = filteredMaintenance.filter(m => m.status === 'completed').length;
    
    const startY = await addPDFHeader(
      doc,
      t('reports.maintenanceReport'),
      `${t('reports.total')}: ${filteredMaintenance.length} | ${t('reports.pending')}: ${pending} | ${t('reports.inExecution')}: ${inProgress} | ${t('reports.completed')}: ${completed}`,
      undefined,
      { branding }
    );

    const tableData = filteredMaintenance.map(item => [
      format(new Date(item.created_at), 'dd/MM/yyyy', { locale: dateLocale }),
      item.title?.substring(0, 30) + (item.title?.length > 30 ? '...' : '') || '—',
      item.equipment?.name || '—',
      maintenanceTypeLabels[item.type] || item.type,
      maintenancePriorityLabels[item.priority] || item.priority,
      maintenanceStatusLabels[item.status] || item.status,
      item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy', { locale: dateLocale }) : '—',
      item.completed_at ? format(new Date(item.completed_at), 'dd/MM/yyyy', { locale: dateLocale }) : '—',
    ]);

    autoTable(doc, {
      startY: startY,
      head: [[t('reports.date'), t('reports.columnTitle'), t('reports.equipment'), t('reports.type'), t('reports.priority'), t('reports.status'), t('maintenance.dueDate'), t('maintenance.completedDate')]],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || startY + 50;
    addSignatureSection(
      doc,
      finalY + 10,
      currentUserProfile?.full_name || t('common.name'),
      currentUserProfile?.position,
      signature
    );

    addPDFFooter(doc, `${branding.name} - ${t('reports.footerAutoGenerated')}`, t('reports.maintenanceReport'));
    
    if (preview) {
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
      toast.success(t('common.pdfPreviewOpened'));
    } else {
      doc.save(`${t('reports.fileNameMaintenance')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success(t('reports.maintenanceExportedPDF'));
    }
  };

  const handleMaintenanceReportExcel = () => {
    if (filteredMaintenance.length === 0) {
      toast.error(t('reports.noMaintenanceFound'));
      return;
    }

    const data = filteredMaintenance.map(item => ({
      [t('reports.date')]: format(new Date(item.created_at), 'dd/MM/yyyy', { locale: dateLocale }),
      [t('reports.columnTitle')]: item.title || '—',
      [t('reports.equipment')]: item.equipment?.name || '—',
      [t('reports.code')]: item.equipment?.internal_code || '—',
      [t('reports.type')]: maintenanceTypeLabels[item.type] || item.type,
      [t('reports.priority')]: maintenancePriorityLabels[item.priority] || item.priority,
      [t('reports.status')]: maintenanceStatusLabels[item.status] || item.status,
      [t('maintenance.dueDate')]: item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy', { locale: dateLocale }) : '—',
      [t('maintenance.completedDate')]: item.completed_at ? format(new Date(item.completed_at), 'dd/MM/yyyy', { locale: dateLocale }) : '—',
      [t('common.description')]: item.description || '—',
      [t('maintenance.workPerformed')]: item.work_performed || '—',
      [t('maintenance.requester')]: item.requester?.full_name || '—',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('reports.sheetMaintenance'));
    XLSX.writeFile(wb, `${t('reports.fileNameMaintenance')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success(t('reports.maintenanceExportedExcel'));
  };

  // Report 6: Category Inspection Report
  const categoryInspectionData = useMemo(() => {
    const equipmentInspections = new Map<string, {
      equipment: typeof equipment[0];
      status: 'compliant' | 'attention' | 'non-compliant';
      inspectionDate: string;
      lastInspectorName: string;
      expiryStatus: 'ok' | 'expiry_expired' | 'certificate_expired' | 'both_expired';
    }>();

    const sortedInspections = [...filteredInspections].sort(
      (a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime()
    );

    sortedInspections.forEach(insp => {
      if (!equipmentInspections.has(insp.equipment_id)) {
        const eq = equipment.find(e => e.id === insp.equipment_id);
        if (eq) {
          const status = insp.status === 'compliant' ? 'compliant' : 
                        insp.status === 'attention' ? 'attention' : 'non-compliant';
          
          // Check expiry dates
          const today = new Date();
          const expiryExpired = eq.expiry_date && new Date(eq.expiry_date) < today;
          const certificateExpired = eq.certificate_expiry && new Date(eq.certificate_expiry) < today;
          
          let expiryStatus: 'ok' | 'expiry_expired' | 'certificate_expired' | 'both_expired' = 'ok';
          if (expiryExpired && certificateExpired) {
            expiryStatus = 'both_expired';
          } else if (expiryExpired) {
            expiryStatus = 'expiry_expired';
          } else if (certificateExpired) {
            expiryStatus = 'certificate_expired';
          }
          
          equipmentInspections.set(insp.equipment_id, {
            equipment: eq,
            status: status as 'compliant' | 'attention' | 'non-compliant',
            inspectionDate: insp.inspection_date,
            lastInspectorName: insp.profiles?.full_name || '—',
            expiryStatus,
          });
        }
      }
    });

    return Array.from(equipmentInspections.values());
  }, [filteredInspections, equipment]);

  const handleCategoryInspectionReportPDF = async (preview = false) => {
    if (categoryInspectionData.length === 0) {
      toast.error(t('reports.noInspectionFound'));
      return;
    }

    const selectedCategory = categoryFilter !== 'all' 
      ? categories.find(c => c.id === categoryFilter)
      : { id: 'all', name: t('reports.allCategories'), description: '', icon: '', inspection_frequency: 'monthly', created_at: '', updated_at: '', organization_id: null };
    
    const selectedShip = shipFilter !== 'all'
      ? ships.find(s => s.id === shipFilter)
      : undefined;

    const results = categoryInspectionData.map(item => ({
      equipment: item.equipment,
      status: item.status,
      lastInspectionDate: item.inspectionDate,
      lastInspectorName: item.lastInspectorName,
      expiryStatus: item.expiryStatus,
    }));

    await exportCategoryInspectionPDF({
      category: selectedCategory!,
      ship: selectedShip,
      results,
      inspector: {
        name: currentUserProfile?.full_name || t('common.name'),
        position: currentUserProfile?.position || undefined,
        email: currentUserProfile?.email || '',
      },
      inspectionDate: new Date().toISOString().split('T')[0],
      signatureData: signature,
    }, { preview });

    toast.success(preview ? t('common.pdfPreviewOpened') : t('reports.categoryInspectionExportedPDF'));
  };

  const handleCategoryInspectionReportExcel = () => {
    if (categoryInspectionData.length === 0) {
      toast.error(t('reports.noInspectionFound'));
      return;
    }

    const expiryStatusLabelsLocal: Record<string, string> = {
      'ok': '—',
      'expiry_expired': t('reports.valExpired'),
      'certificate_expired': t('reports.certExpired'),
      'both_expired': t('reports.bothExpired'),
    };

    const data = categoryInspectionData.map((item, index) => ({
      '#': index + 1,
      [t('reports.code')]: item.equipment.internal_code,
      [t('reports.equipment')]: item.equipment.name,
      [t('reports.type')]: item.equipment.type,
      [t('reports.category')]: item.equipment.categories?.name || '—',
      [t('common.location')]: item.equipment.location,
      [t('reports.lastInspection')]: format(new Date(item.inspectionDate), 'dd/MM/yyyy', { locale: dateLocale }),
      [t('reports.inspector')]: item.lastInspectorName,
      [t('reports.status')]: inspectionStatusLabels[item.status] || item.status,
      [t('reports.expiry')]: expiryStatusLabelsLocal[item.expiryStatus],
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('reports.sheetCategoryInspection'));
    XLSX.writeFile(wb, `${t('reports.fileNameCategoryInspection')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success(t('reports.categoryInspectionExportedExcel'));
  };

  const clearFilters = () => {
    setShipFilter('all');
    setCategoryFilter('all');
    setStartDateStr('');
    setEndDateStr('');
    setMonthFilter('all');
  };

  const handleMonthChange = (value: string) => {
    setMonthFilter(value);
  };

  const handleMonthDateRangeChange = (start: string, end: string) => {
    setStartDateStr(start);
    setEndDateStr(end);
  };

  const hasFilters = shipFilter !== 'all' || categoryFilter !== 'all' || startDateStr || endDateStr || monthFilter !== 'all';

  // Monthly consolidated report data
  const monthlyConsolidatedData = useMemo(() => {
    if (categoryFilter === 'all' || !monthFilter || monthFilter === 'all') return null;
    
    const category = categories.find(c => c.id === categoryFilter);
    if (!category) return null;

    const categoryEquipment = filteredEquipment.filter(e => e.category_id === categoryFilter);
    const categoryInspections = filteredInspections.filter(i => {
      const equip = equipment.find(e => e.id === i.equipment_id);
      return equip?.category_id === categoryFilter;
    });

    return {
      category,
      equipment: categoryEquipment,
      inspections: categoryInspections,
      monthLabel: monthFilter,
      branding,
      inspector: currentUserProfile ? {
        name: currentUserProfile.full_name,
        position: currentUserProfile.position || undefined,
      } : undefined,
      signature,
    };
  }, [categoryFilter, monthFilter, categories, filteredEquipment, filteredInspections, equipment, branding, currentUserProfile, signature]);

  // Monthly consolidated report handlers
  const handleMonthlyConsolidatedPDF = async (preview = false) => {
    if (!monthlyConsolidatedData) {
      toast.error(t('reports.selectCategoryAndMonth'));
      return;
    }
    await exportMonthlyConsolidatedPDF(monthlyConsolidatedData, { preview });
    toast.success(preview ? t('common.pdfPreviewOpened') : t('reports.monthlyExportedPDF'));
  };

  const handleMonthlyConsolidatedExcel = () => {
    if (!monthlyConsolidatedData) {
      toast.error(t('reports.selectCategoryAndMonth'));
      return;
    }
    exportMonthlyConsolidatedExcel(monthlyConsolidatedData);
    toast.success(t('reports.monthlyExportedExcel'));
  };

  // Preview data configurations
  const getPreviewData = () => {
    switch (previewReport) {
      case 'inspections':
        return {
          title: t('reports.previewInspections'),
          description: `${filteredInspections.length} ${t('reports.inspectionsFound')}`,
          data: filteredInspections.map(i => ({
            date: format(new Date(i.inspection_date), 'dd/MM/yyyy', { locale: dateLocale }),
            equipment: i.equipment?.name || '—',
            code: i.equipment?.internal_code || '—',
            inspector: i.profiles?.full_name || '—',
            status: inspectionStatusLabels[i.status] || i.status,
          })),
          columns: [
            { key: 'date', label: t('reports.date') },
            { key: 'equipment', label: t('reports.equipment') },
            { key: 'code', label: t('reports.code') },
            { key: 'inspector', label: t('reports.inspector') },
            { key: 'status', label: t('reports.status') },
          ],
          onExportPDF: handleInspectionReportPDF,
          onExportExcel: handleInspectionReportExcel,
        };
      case 'maintenance':
        return {
          title: t('reports.previewMaintenance'),
          description: `${filteredMaintenance.length} ${t('reports.maintenanceFound')}`,
          data: filteredMaintenance.map(m => ({
            date: format(new Date(m.created_at), 'dd/MM/yyyy', { locale: dateLocale }),
            title: m.title,
            equipment: m.equipment?.name || '—',
            type: maintenanceTypeLabels[m.type] || m.type,
            priority: maintenancePriorityLabels[m.priority] || m.priority,
            status: maintenanceStatusLabels[m.status] || m.status,
          })),
          columns: [
            { key: 'date', label: t('reports.date') },
            { key: 'title', label: t('reports.columnTitle') },
            { key: 'equipment', label: t('reports.equipment') },
            { key: 'type', label: t('reports.type') },
            { key: 'priority', label: t('reports.priority') },
            { key: 'status', label: t('reports.status') },
          ],
          onExportPDF: handleMaintenanceReportPDF,
          onExportExcel: handleMaintenanceReportExcel,
          summary: [
            { label: t('reports.pending'), value: filteredMaintenance.filter(m => m.status === 'pending').length },
            { label: t('reports.inExecution'), value: filteredMaintenance.filter(m => m.status === 'in_progress').length },
            { label: t('reports.completed'), value: filteredMaintenance.filter(m => m.status === 'completed').length },
          ],
        };
      case 'expiry':
        return {
          title: t('reports.previewExpiry'),
          description: `${expiringEquipment.length} ${t('reports.expiringCertificates')}`,
          data: expiringEquipment.map(e => {
            const expiryDate = new Date(e.certificate_expiry!);
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            return {
              code: e.internal_code,
              name: e.name,
              category: e.categories?.name || '—',
              expiry: format(expiryDate, 'dd/MM/yyyy', { locale: dateLocale }),
              days: daysUntilExpiry < 0 ? t('reports.expired') : `${daysUntilExpiry} ${t('reports.days')}`,
            };
          }),
          columns: [
            { key: 'code', label: t('reports.code') },
            { key: 'name', label: t('reports.equipment') },
            { key: 'category', label: t('reports.category') },
            { key: 'expiry', label: t('reports.expiry') },
            { key: 'days', label: t('reports.daysRemaining') },
          ],
          onExportPDF: handleExpiryReportPDF,
          onExportExcel: handleExpiryReportExcel,
        };
      case 'non-conformities':
        return {
          title: t('reports.previewNonConformity'),
          description: `${nonConformities.length} ${t('reports.nonConformitiesFound')}`,
          data: nonConformities.map(i => {
            // Find full equipment data to check alerts
            const fullEquipment = equipment.find(e => e.id === i.equipment_id);
            const alertIndicators: string[] = [];
            
            if (fullEquipment) {
              const today = new Date().toISOString().split('T')[0];
              if (fullEquipment.certificate_expiry && fullEquipment.certificate_expiry < today) {
                alertIndicators.push(t('alerts.reportCertExpired'));
              }
              if (fullEquipment.expiry_date && fullEquipment.expiry_date < today) {
                alertIndicators.push(t('alerts.reportEquipExpired'));
              }
              if (fullEquipment.next_inspection && fullEquipment.next_inspection < today) {
                alertIndicators.push(t('alerts.reportInspOverdue'));
              }
            }
            
            return {
              date: format(new Date(i.inspection_date), 'dd/MM/yyyy', { locale: dateLocale }),
              equipment: i.equipment?.name || '—',
              code: i.equipment?.internal_code || '—',
              status: i.status === 'attention' ? t('reports.attention') : t('reports.nonCompliant'),
              alerts: alertIndicators.length > 0 ? alertIndicators.join(' ') : '—',
              observations: i.observations?.substring(0, 40) || '—',
            };
          }),
          columns: [
            { key: 'date', label: t('reports.date') },
            { key: 'equipment', label: t('reports.equipment') },
            { key: 'code', label: t('reports.code') },
            { key: 'status', label: t('reports.status') },
            { key: 'alerts', label: t('reports.equipmentAlerts') },
            { key: 'observations', label: t('reports.observations') },
          ],
          onExportPDF: handleNonConformitiesReportPDF,
          onExportExcel: handleNonConformitiesReportExcel,
        };
      case 'category':
        const categoryData = categories.map(cat => {
          const catEquipment = filteredEquipment.filter(e => e.category_id === cat.id);
          const active = catEquipment.filter(e => e.status === 'active').length;
          const maintenance = catEquipment.filter(e => e.status === 'maintenance').length;
          const expired = catEquipment.filter(e => e.status === 'expired').length;
          const compliance = catEquipment.length > 0 
            ? Math.round((active / catEquipment.length) * 100) 
            : 0;
          return {
            name: cat.name,
            total: catEquipment.length,
            active,
            maintenance,
            expired,
            compliance: `${compliance}%`,
          };
        }).filter(c => c.total > 0);
        
        return {
          title: t('reports.previewCategory'),
          description: `${categoryData.length} ${t('reports.categoriesWithEquipment')}`,
          data: categoryData,
          columns: [
            { key: 'name', label: t('reports.category') },
            { key: 'total', label: t('reports.total') },
            { key: 'active', label: t('reports.active') },
            { key: 'maintenance', label: t('reports.maintenance') },
            { key: 'expired', label: t('reports.statusExpired') },
            { key: 'compliance', label: t('reports.compliance') },
          ],
          onExportPDF: handleCategoryReportPDF,
          onExportExcel: handleCategoryReportExcel,
        };
      case 'category-inspection':
        return {
          title: t('reports.previewCategoryInspection'),
          description: `${categoryInspectionData.length} ${t('reports.equipmentInspected')}`,
          data: categoryInspectionData.map((item, index) => {
            const expiryStatusLabelsLocal: Record<string, string> = {
              'ok': '—',
              'expiry_expired': t('reports.valExpired'),
              'certificate_expired': t('reports.certExpired'),
              'both_expired': t('reports.bothExpired'),
            };
            return {
              num: index + 1,
              code: item.equipment.internal_code,
              name: item.equipment.name,
              category: item.equipment.categories?.name || '—',
              lastInspection: format(new Date(item.inspectionDate), 'dd/MM/yyyy', { locale: dateLocale }),
              inspector: item.lastInspectorName,
              status: inspectionStatusLabels[item.status] || item.status,
              expiry: expiryStatusLabelsLocal[item.expiryStatus],
            };
          }),
          columns: [
            { key: 'num', label: '#' },
            { key: 'code', label: t('reports.code') },
            { key: 'name', label: t('reports.equipment') },
            { key: 'category', label: t('reports.category') },
            { key: 'lastInspection', label: t('reports.lastInspection') },
            { key: 'inspector', label: t('reports.inspector') },
            { key: 'status', label: t('reports.status') },
            { key: 'expiry', label: t('reports.expiry') },
          ],
          onExportPDF: handleCategoryInspectionReportPDF,
          onExportExcel: handleCategoryInspectionReportExcel,
          summary: [
            { label: t('reports.compliant'), value: categoryInspectionData.filter(i => i.status === 'compliant').length, color: 'bg-emerald-100 text-emerald-700' },
            { label: t('reports.attention'), value: categoryInspectionData.filter(i => i.status === 'attention').length, color: 'bg-amber-100 text-amber-700' },
            { label: t('reports.nonCompliant'), value: categoryInspectionData.filter(i => i.status === 'non-compliant').length, color: 'bg-red-100 text-red-700' },
          ],
        };
      case 'monthly-consolidated':
        if (!monthlyConsolidatedData) return null;
        return {
          title: t('reports.previewMonthlyConsolidated'),
          description: `${monthlyConsolidatedData.equipment.length} ${t('reports.equipmentPlural')} - ${monthlyConsolidatedData.category.name}`,
          data: monthlyConsolidatedData.equipment.map(equip => {
            const equipInspections = monthlyConsolidatedData.inspections.filter(i => i.equipment_id === equip.id);
            const lastInsp = equipInspections.sort((a, b) => 
              new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime()
            )[0];
            return {
              code: equip.internal_code,
              name: equip.name,
              location: equip.location || '—',
              eqStatus: statusLabels[equip.status] || equip.status,
              inspCount: equipInspections.length,
              lastInsp: lastInsp ? format(parseISO(lastInsp.inspection_date), 'dd/MM/yy', { locale: dateLocale }) : '—',
              inspStatus: lastInsp ? inspectionStatusLabels[lastInsp.status] || lastInsp.status : '—',
              inspector: lastInsp?.profiles?.full_name || '—',
            };
          }),
          columns: [
            { key: 'code', label: t('reports.code') },
            { key: 'name', label: t('reports.equipment') },
            { key: 'location', label: t('common.location') },
            { key: 'eqStatus', label: t('reports.eqStatus') },
            { key: 'inspCount', label: t('reports.inspCount') },
            { key: 'lastInsp', label: t('reports.lastInspection') },
            { key: 'inspStatus', label: t('reports.inspStatus') },
            { key: 'inspector', label: t('reports.inspector') },
          ],
          onExportPDF: handleMonthlyConsolidatedPDF,
          onExportExcel: handleMonthlyConsolidatedExcel,
          summary: [
            { label: t('reports.compliant'), value: monthlyConsolidatedData.inspections.filter(i => i.status === 'compliant').length, color: 'bg-emerald-100 text-emerald-700' },
            { label: t('reports.attention'), value: monthlyConsolidatedData.inspections.filter(i => i.status === 'attention').length, color: 'bg-amber-100 text-amber-700' },
            { label: t('reports.nonCompliant'), value: monthlyConsolidatedData.inspections.filter(i => i.status === 'non-compliant').length, color: 'bg-red-100 text-red-700' },
            { label: t('reports.notInspected'), value: monthlyConsolidatedData.equipment.length - monthlyConsolidatedData.inspections.length, color: 'bg-slate-100 text-slate-700' },
          ],
        };
      default:
        return null;
    }
  };

  const openPreview = (reportType: ReportType) => {
    setPreviewReport(reportType);
    setPreviewOpen(true);
  };

  const previewData = getPreviewData();

  const reportTypes = [
    {
      id: 'category-inspection' as ReportType,
      title: t('reports.categoryInspectionReport'),
      description: t('reports.categoryInspectionReportDesc'),
      icon: ClipboardCheck,
      count: categoryInspectionData.length,
      iconColor: 'text-white',
      bgColor: 'bg-emerald-600',
    },
    {
      id: 'inspections' as ReportType,
      title: t('reports.inspectionReport'),
      description: t('reports.inspectionReportDesc'),
      icon: FileText,
      count: filteredInspections.length,
      iconColor: 'text-white',
      bgColor: 'bg-blue-600',
    },
    {
      id: 'maintenance' as ReportType,
      title: t('reports.maintenanceReport'),
      description: t('reports.maintenanceReportDesc'),
      icon: Wrench,
      count: filteredMaintenance.length,
      iconColor: 'text-white',
      bgColor: 'bg-teal-600',
    },
    {
      id: 'category' as ReportType,
      title: t('reports.categoryReport'),
      description: t('reports.categoryReportDesc'),
      icon: BarChart3,
      count: categories.filter(c => filteredEquipment.some(e => e.category_id === c.id)).length,
      iconColor: 'text-white',
      bgColor: 'bg-purple-600',
    },
    {
      id: 'expiry' as ReportType,
      title: t('reports.expiryReport'),
      description: t('reports.expiryReportDesc'),
      icon: Calendar,
      count: expiringEquipment.length,
      iconColor: 'text-white',
      bgColor: 'bg-red-600',
    },
    {
      id: 'non-conformities' as ReportType,
      title: t('reports.nonConformityReport'),
      description: t('reports.nonConformityReportDesc'),
      icon: AlertTriangle,
      count: nonConformities.length,
      iconColor: 'text-white',
      bgColor: 'bg-orange-500',
    },
    {
      id: 'monthly-consolidated' as ReportType,
      title: t('reports.monthlyConsolidatedReport'),
      description: t('reports.monthlyConsolidatedDesc'),
      icon: FileSpreadsheet,
      count: monthlyConsolidatedData?.equipment.length || 0,
      iconColor: 'text-white',
      bgColor: 'bg-indigo-600',
      requiresFilter: true,
    },
  ];

  return (
    <div 
      ref={containerRef}
      className="space-y-6 animate-fade-in overflow-auto"
      style={pullIndicatorStyle}
    >
      {/* Pull to Refresh Indicator */}
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
      />

      <PageHeader
        icon={FileText}
        title={t('reports.title')}
        subtitle={isMobile ? undefined : t('reports.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            {/* Mobile Refresh Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="lg:hidden"
              title={t('common.refresh')}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1 lg:mr-2" />
                <span className="hidden sm:inline">{t('reports.clearFilters')}</span>
                <span className="sm:hidden">{t('common.clear')}</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Filters Section */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    {t('reports.globalFilters')}
                    {hasFilters && (
                      <Badge variant="secondary" className="ml-2">
                        {t('reports.filtersActive')}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t('reports.applyFiltersToAllReports')}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <X className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-0' : 'rotate-45'}`} />
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>{t('reports.ship')}</Label>
                  <Select value={shipFilter} onValueChange={setShipFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('reports.allShips')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('reports.allShips')}</SelectItem>
                      {ships.map(ship => (
                        <SelectItem key={ship.id} value={ship.id}>
                          {ship.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('reports.category')}</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('reports.allCategories')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('reports.allCategories')}</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <MonthQuickFilter
                  value={monthFilter}
                  onChange={handleMonthChange}
                  onDateRangeChange={handleMonthDateRangeChange}
                />

                <div className="space-y-2">
                  <Label>{t('reports.startDate')}</Label>
                  <DatePicker
                    value={startDateStr}
                    onChange={(val) => {
                      setStartDateStr(val);
                      if (val) setMonthFilter('all');
                    }}
                    placeholder={t('common.select')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('reports.endDate')}</Label>
                  <DatePicker
                    value={endDateStr}
                    onChange={(val) => {
                      setEndDateStr(val);
                      if (val) setMonthFilter('all');
                    }}
                    placeholder={t('common.select')}
                  />
                </div>
              </div>
              
              {hasFilters && (
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    {t('reports.clearFilters')}
                  </Button>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Monthly Consolidated Quick Export */}
      {monthlyConsolidatedData && (
        <Card className="border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 text-sm sm:text-base">
                  {t('reports.monthlyConsolidatedReport')}
                </h3>
                <p className="text-xs sm:text-sm text-indigo-700 dark:text-indigo-300">
                  {monthlyConsolidatedData.category.name} - {monthlyConsolidatedData.equipment.length} {t('reports.equipmentPlural')} - {monthlyConsolidatedData.inspections.length} {t('reports.inspectionsPerformed')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => openPreview('monthly-consolidated')}
                  className="flex-1 sm:flex-none border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-300"
                >
                  <Eye className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{t('reports.preview')}</span>
                  <span className="sm:hidden">Preview</span>
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => handleMonthlyConsolidatedPDF()}
                  className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700"
                >
                  <Download className="h-4 w-4 mr-1 sm:mr-2" />
                  PDF
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleMonthlyConsolidatedExcel}
                  className="flex-1 sm:flex-none border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-300"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1 sm:mr-2" />
                  Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary Stats - Mobile optimized */}
          <div className="grid grid-cols-4 gap-2 sm:hidden">
            <div className="bg-card border rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-foreground">{filteredEquipment.length}</p>
              <p className="text-[10px] text-muted-foreground truncate">{t('reports.equipment')}</p>
            </div>
            <div className="bg-card border rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-foreground">{filteredInspections.length}</p>
              <p className="text-[10px] text-muted-foreground truncate">{t('navigation.inspections')}</p>
            </div>
            <div className="bg-card border rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-red-500">{expiringEquipment.length}</p>
              <p className="text-[10px] text-muted-foreground truncate">{t('reports.expiringNow')}</p>
            </div>
            <div className="bg-card border rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-orange-500">{nonConformities.length}</p>
              <p className="text-[10px] text-muted-foreground truncate">{t('reports.nonCompliant')}</p>
            </div>
          </div>

          {/* Reports Grid - Responsive: single column on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {reportTypes.map((report) => (
              <Card 
                key={report.id} 
                className="hover:border-primary/50 transition-colors active:scale-[0.98] touch-manipulation"
              >
                <CardContent className="p-3 sm:pt-4 sm:px-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 sm:p-2.5 rounded-lg shrink-0 ${report.bgColor}`}>
                      <report.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${report.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium text-sm sm:text-base truncate">{report.title}</h3>
                        <Badge 
                          variant="secondary" 
                          className={`shrink-0 text-xs ${report.count === 0 ? 'bg-muted text-muted-foreground' : ''}`}
                        >
                          {report.count}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-2 hidden sm:block">
                        {report.description}
                      </p>
                    </div>
                    {/* Mobile: icon-only button */}
                    <Button 
                      size="icon"
                      variant="ghost"
                      className="sm:hidden shrink-0"
                      onClick={() => openPreview(report.id)}
                      disabled={report.count === 0}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Desktop: full button */}
                  <Button 
                    size="sm"
                    className="gap-2 w-full mt-3 hidden sm:flex"
                    onClick={() => openPreview(report.id)}
                    disabled={report.count === 0}
                  >
                    <Eye className="h-4 w-4" />
                    {t('reports.viewAndExport')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary Stats - Desktop */}
          <Card className="bg-muted/30 hidden sm:block">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">{filteredEquipment.length}</p>
                  <p className="text-sm text-muted-foreground">{t('reports.equipment')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{filteredInspections.length}</p>
                  <p className="text-sm text-muted-foreground">{t('navigation.inspections')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{expiringEquipment.length}</p>
                  <p className="text-sm text-muted-foreground">{t('reports.expiringNow')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-500">{nonConformities.length}</p>
                  <p className="text-sm text-muted-foreground">{t('reports.nonCompliant')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Preview Dialog */}
      {previewData && (
        <ReportPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={previewData.title}
          description={previewData.description}
          data={previewData.data}
          columns={previewData.columns}
          onExportPDF={previewData.onExportPDF}
          onExportExcel={previewData.onExportExcel}
          summary={previewData.summary}
        />
      )}
    </div>
  );
}
