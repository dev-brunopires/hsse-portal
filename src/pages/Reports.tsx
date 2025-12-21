import { useState, useMemo, useEffect } from 'react';
import { FileText, Download, Calendar, Filter, AlertTriangle, Loader2, BarChart3, Wrench, ClipboardCheck, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useEquipment } from '@/hooks/useEquipment';
import { useInspections } from '@/hooks/useInspections';
import { useCategories } from '@/hooks/useCategories';
import { useShips } from '@/hooks/useShips';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { useAuth } from '@/contexts/AuthContext';
import { useProfiles } from '@/hooks/useProfiles';
import { useUserSignature } from '@/hooks/useUserSignature';
import { exportInspectionsToExcel, exportInspectionsToPDF } from '@/utils/exportInspections';
import { exportCategoryInspectionPDF } from '@/utils/exportCategoryInspection';
import { addPDFHeader, addPDFFooter, addSignatureSection, preloadLogo } from '@/utils/pdfStyles';
import { ReportPreviewDialog } from '@/components/reports/ReportPreviewDialog';
import { toast } from 'sonner';
import { format, isAfter, isBefore, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  maintenance: 'Em Manutenção',
  expired: 'Vencido',
  rejected: 'Reprovado',
  inactive: 'Inativo',
};

const maintenanceStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  in_progress: 'Em Execução',
  completed: 'Concluída',
  rejected: 'Rejeitada',
};

const maintenancePriorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const maintenanceTypeLabels: Record<string, string> = {
  corrective: 'Corretiva',
  preventive: 'Preventiva',
};

const inspectionStatusLabels: Record<string, string> = {
  compliant: 'Conforme',
  attention: 'Atenção',
  'non-compliant': 'Não Conforme',
  rejected: 'Reprovado',
};

type ReportType = 'inspections' | 'maintenance' | 'category' | 'expiry' | 'non-conformities' | 'category-inspection' | null;

export default function Reports() {
  const { user } = useAuth();
  const { data: profiles = [] } = useProfiles();
  const { data: equipment = [], isLoading: equipmentLoading } = useEquipment();
  const { data: inspections = [], isLoading: inspectionsLoading } = useInspections();
  const { data: categories = [] } = useCategories();
  const { data: ships = [] } = useShips();
  const { data: maintenanceRequests = [], isLoading: maintenanceLoading } = useMaintenanceRequests();
  const { data: signatureData } = useUserSignature();
  const signature = signatureData?.default_signature;

  // Preload logo for PDFs
  useEffect(() => {
    preloadLogo();
  }, []);

  // Get full profile with position
  const currentUserProfile = useMemo(() => {
    return profiles.find(p => p.user_id === user?.id);
  }, [profiles, user?.id]);

  // Filters
  const [shipFilter, setShipFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');

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
  const handleInspectionReportPDF = () => {
    if (filteredInspections.length === 0) {
      toast.error('Nenhuma inspeção encontrada para exportar');
      return;
    }
    exportInspectionsToPDF(filteredInspections, 'relatorio_inspecoes');
    toast.success('Relatório de inspeções exportado em PDF');
  };

  const handleInspectionReportExcel = () => {
    if (filteredInspections.length === 0) {
      toast.error('Nenhuma inspeção encontrada para exportar');
      return;
    }
    exportInspectionsToExcel(filteredInspections, 'relatorio_inspecoes');
    toast.success('Relatório de inspeções exportado em Excel');
  };

  // Report 2: Category Report
  const handleCategoryReportPDF = async () => {
    if (filteredEquipment.length === 0) {
      toast.error('Nenhum equipamento encontrado para exportar');
      return;
    }

    const doc = new jsPDF('landscape');
    const startY = await addPDFHeader(
      doc,
      'Relatório por Categoria',
      `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
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
      head: [['Categoria', 'Total', 'Ativos', 'Manutenção', 'Vencidos', 'Reprovados', 'Conformidade']],
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
      currentUserProfile?.full_name || 'Usuário',
      currentUserProfile?.position,
      signature
    );

    addPDFFooter(doc, 'SBM Offshore - Sistema de Gestão', 'Documento gerado automaticamente');
    doc.save(`relatorio_categorias_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Relatório por categoria exportado em PDF');
  };

  const handleCategoryReportExcel = () => {
    if (filteredEquipment.length === 0) {
      toast.error('Nenhum equipamento encontrado para exportar');
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
        'Categoria': cat.name,
        'Total Equipamentos': catEquipment.length,
        'Ativos': active,
        'Em Manutenção': maintenance,
        'Vencidos': expired,
        'Reprovados': rejected,
        'Conformidade (%)': compliance,
      };
    }).filter(row => row['Total Equipamentos'] > 0);

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Categorias');
    XLSX.writeFile(wb, `relatorio_categorias_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório por categoria exportado em Excel');
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

  const handleExpiryReportPDF = async () => {
    if (expiringEquipment.length === 0) {
      toast.error('Nenhum equipamento com certificado próximo do vencimento');
      return;
    }

    const doc = new jsPDF('landscape');
    const startY = await addPDFHeader(
      doc,
      'Relatório de Vencimentos',
      `Equipamentos com certificados vencendo nos próximos 30 dias: ${expiringEquipment.length}`
    );

    const tableData = expiringEquipment.map(item => {
      const expiryDate = new Date(item.certificate_expiry!);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const status = daysUntilExpiry < 0 ? 'VENCIDO' : `${daysUntilExpiry} dias`;

      return [
        item.internal_code,
        item.name,
        item.categories?.name || '—',
        item.location,
        format(expiryDate, 'dd/MM/yyyy', { locale: ptBR }),
        status,
      ];
    });

    autoTable(doc, {
      startY: startY,
      head: [['Código', 'Equipamento', 'Categoria', 'Localização', 'Vencimento', 'Status']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [220, 38, 38] },
      alternateRowStyles: { fillColor: [254, 242, 242] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || startY + 50;
    addSignatureSection(
      doc,
      finalY + 10,
      currentUserProfile?.full_name || 'Usuário',
      currentUserProfile?.position,
      signature
    );

    addPDFFooter(doc, 'SBM Offshore - Sistema de Gestão', 'Documento gerado automaticamente');
    doc.save(`relatorio_vencimentos_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Relatório de vencimentos exportado em PDF');
  };

  const handleExpiryReportExcel = () => {
    if (expiringEquipment.length === 0) {
      toast.error('Nenhum equipamento com certificado próximo do vencimento');
      return;
    }

    const data = expiringEquipment.map(item => {
      const expiryDate = new Date(item.certificate_expiry!);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      return {
        'Código': item.internal_code,
        'Nome': item.name,
        'Categoria': item.categories?.name || '—',
        'Localização': item.location,
        'Data Vencimento': format(expiryDate, 'dd/MM/yyyy', { locale: ptBR }),
        'Dias Restantes': daysUntilExpiry,
        'Status': daysUntilExpiry < 0 ? 'Vencido' : 'A Vencer',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vencimentos');
    XLSX.writeFile(wb, `relatorio_vencimentos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório de vencimentos exportado em Excel');
  };

  // Report 4: Non-Conformities Report
  const nonConformities = useMemo(() => {
    return filteredInspections.filter(i => 
      i.status === 'rejected' || i.status === 'non-compliant' || i.status === 'attention'
    );
  }, [filteredInspections]);

  const handleNonConformitiesReportPDF = async () => {
    if (nonConformities.length === 0) {
      toast.error('Nenhuma não conformidade encontrada');
      return;
    }

    const doc = new jsPDF('landscape');
    const startY = await addPDFHeader(
      doc,
      'Relatório de Não Conformidades',
      `Total de não conformidades: ${nonConformities.length}`
    );

    const tableData = nonConformities.map(item => [
      format(new Date(item.inspection_date), 'dd/MM/yyyy', { locale: ptBR }),
      item.equipment?.name || '—',
      item.equipment?.internal_code || '—',
      item.profiles?.full_name || '—',
      item.status === 'attention' ? 'Atenção' : 'Não Conforme',
      item.observations?.substring(0, 40) || '—',
      item.recommendations?.substring(0, 40) || '—',
    ]);

    autoTable(doc, {
      startY: startY,
      head: [['Data', 'Equipamento', 'Código', 'Inspetor', 'Status', 'Observações', 'Recomendações']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [234, 88, 12] },
      alternateRowStyles: { fillColor: [255, 247, 237] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || startY + 50;
    addSignatureSection(
      doc,
      finalY + 10,
      currentUserProfile?.full_name || 'Usuário',
      currentUserProfile?.position,
      signature
    );

    addPDFFooter(doc, 'SBM Offshore - Sistema de Gestão', 'Documento gerado automaticamente');
    doc.save(`relatorio_nao_conformidades_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Relatório de não conformidades exportado em PDF');
  };

  const handleNonConformitiesReportExcel = () => {
    if (nonConformities.length === 0) {
      toast.error('Nenhuma não conformidade encontrada');
      return;
    }

    const data = nonConformities.map(item => ({
      'Data Inspeção': format(new Date(item.inspection_date), 'dd/MM/yyyy', { locale: ptBR }),
      'Equipamento': item.equipment?.name || '—',
      'Código': item.equipment?.internal_code || '—',
      'Inspetor': item.profiles?.full_name || '—',
      'Status': item.status === 'attention' ? 'Atenção' : 'Não Conforme',
      'Observações': item.observations || '—',
      'Recomendações': item.recommendations || '—',
      'Ações Tomadas': item.actions_taken || '—',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Não Conformidades');
    XLSX.writeFile(wb, `relatorio_nao_conformidades_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório de não conformidades exportado em Excel');
  };

  // Report 5: Maintenance Report
  const handleMaintenanceReportPDF = async () => {
    if (filteredMaintenance.length === 0) {
      toast.error('Nenhuma manutenção encontrada para exportar');
      return;
    }

    const doc = new jsPDF('landscape');
    
    // Stats
    const pending = filteredMaintenance.filter(m => m.status === 'pending').length;
    const inProgress = filteredMaintenance.filter(m => m.status === 'in_progress').length;
    const completed = filteredMaintenance.filter(m => m.status === 'completed').length;
    
    const startY = await addPDFHeader(
      doc,
      'Relatório de Manutenções',
      `Total: ${filteredMaintenance.length} | Pendentes: ${pending} | Em Execução: ${inProgress} | Concluídas: ${completed}`
    );

    const tableData = filteredMaintenance.map(item => [
      format(new Date(item.created_at), 'dd/MM/yyyy', { locale: ptBR }),
      item.title?.substring(0, 30) + (item.title?.length > 30 ? '...' : '') || '—',
      item.equipment?.name || '—',
      maintenanceTypeLabels[item.type] || item.type,
      maintenancePriorityLabels[item.priority] || item.priority,
      maintenanceStatusLabels[item.status] || item.status,
      item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '—',
      item.completed_at ? format(new Date(item.completed_at), 'dd/MM/yyyy', { locale: ptBR }) : '—',
    ]);

    autoTable(doc, {
      startY: startY,
      head: [['Data Abertura', 'Título', 'Equipamento', 'Tipo', 'Prioridade', 'Status', 'Prazo', 'Conclusão']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || startY + 50;
    addSignatureSection(
      doc,
      finalY + 10,
      currentUserProfile?.full_name || 'Usuário',
      currentUserProfile?.position,
      signature
    );

    addPDFFooter(doc, 'SBM Offshore - Sistema de Gestão', 'Documento gerado automaticamente');
    doc.save(`relatorio_manutencoes_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Relatório de manutenções exportado em PDF');
  };

  const handleMaintenanceReportExcel = () => {
    if (filteredMaintenance.length === 0) {
      toast.error('Nenhuma manutenção encontrada para exportar');
      return;
    }

    const data = filteredMaintenance.map(item => ({
      'Data Abertura': format(new Date(item.created_at), 'dd/MM/yyyy', { locale: ptBR }),
      'Título': item.title || '—',
      'Equipamento': item.equipment?.name || '—',
      'Código': item.equipment?.internal_code || '—',
      'Tipo': maintenanceTypeLabels[item.type] || item.type,
      'Prioridade': maintenancePriorityLabels[item.priority] || item.priority,
      'Status': maintenanceStatusLabels[item.status] || item.status,
      'Prazo': item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '—',
      'Conclusão': item.completed_at ? format(new Date(item.completed_at), 'dd/MM/yyyy', { locale: ptBR }) : '—',
      'Descrição': item.description || '—',
      'Trabalho Realizado': item.work_performed || '—',
      'Solicitante': item.requester?.full_name || '—',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Manutenções');
    XLSX.writeFile(wb, `relatorio_manutencoes_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório de manutenções exportado em Excel');
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

  const handleCategoryInspectionReportPDF = async () => {
    if (categoryInspectionData.length === 0) {
      toast.error('Nenhuma inspeção encontrada para exportar');
      return;
    }

    const selectedCategory = categoryFilter !== 'all' 
      ? categories.find(c => c.id === categoryFilter)
      : { id: 'all', name: 'Todas as Categorias', description: '', icon: '', inspection_frequency: 'monthly', created_at: '', updated_at: '' };
    
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
        name: currentUserProfile?.full_name || 'Usuário',
        position: currentUserProfile?.position || undefined,
        email: currentUserProfile?.email || '',
      },
      inspectionDate: new Date().toISOString().split('T')[0],
      signatureData: signature,
    });

    toast.success('Relatório de inspeção por categoria exportado em PDF');
  };

  const handleCategoryInspectionReportExcel = () => {
    if (categoryInspectionData.length === 0) {
      toast.error('Nenhuma inspeção encontrada para exportar');
      return;
    }

    const expiryStatusLabels: Record<string, string> = {
      'ok': '—',
      'expiry_expired': 'Validade vencida',
      'certificate_expired': 'Certificado vencido',
      'both_expired': 'Validade e Certificado vencidos',
    };

    const data = categoryInspectionData.map((item, index) => ({
      '#': index + 1,
      'Código': item.equipment.internal_code,
      'Equipamento': item.equipment.name,
      'Tipo': item.equipment.type,
      'Categoria': item.equipment.categories?.name || '—',
      'Localização': item.equipment.location,
      'Última Inspeção': format(new Date(item.inspectionDate), 'dd/MM/yyyy', { locale: ptBR }),
      'Último Inspetor': item.lastInspectorName,
      'Status': inspectionStatusLabels[item.status] || item.status,
      'Vencimento': expiryStatusLabels[item.expiryStatus],
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inspeção Categoria');
    XLSX.writeFile(wb, `relatorio_inspecao_categoria_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório de inspeção por categoria exportado em Excel');
  };

  const clearFilters = () => {
    setShipFilter('all');
    setCategoryFilter('all');
    setStartDateStr('');
    setEndDateStr('');
  };

  const hasFilters = shipFilter !== 'all' || categoryFilter !== 'all' || startDateStr || endDateStr;

  // Preview data configurations
  const getPreviewData = () => {
    switch (previewReport) {
      case 'inspections':
        return {
          title: 'Pré-visualização: Relatório de Inspeções',
          description: `${filteredInspections.length} inspeções encontradas`,
          data: filteredInspections.map(i => ({
            date: format(new Date(i.inspection_date), 'dd/MM/yyyy', { locale: ptBR }),
            equipment: i.equipment?.name || '—',
            code: i.equipment?.internal_code || '—',
            inspector: i.profiles?.full_name || '—',
            status: inspectionStatusLabels[i.status] || i.status,
          })),
          columns: [
            { key: 'date', label: 'Data' },
            { key: 'equipment', label: 'Equipamento' },
            { key: 'code', label: 'Código' },
            { key: 'inspector', label: 'Inspetor' },
            { key: 'status', label: 'Status' },
          ],
          onExportPDF: handleInspectionReportPDF,
          onExportExcel: handleInspectionReportExcel,
        };
      case 'maintenance':
        return {
          title: 'Pré-visualização: Relatório de Manutenções',
          description: `${filteredMaintenance.length} manutenções encontradas`,
          data: filteredMaintenance.map(m => ({
            date: format(new Date(m.created_at), 'dd/MM/yyyy', { locale: ptBR }),
            title: m.title,
            equipment: m.equipment?.name || '—',
            type: maintenanceTypeLabels[m.type] || m.type,
            priority: maintenancePriorityLabels[m.priority] || m.priority,
            status: maintenanceStatusLabels[m.status] || m.status,
          })),
          columns: [
            { key: 'date', label: 'Data' },
            { key: 'title', label: 'Título' },
            { key: 'equipment', label: 'Equipamento' },
            { key: 'type', label: 'Tipo' },
            { key: 'priority', label: 'Prioridade' },
            { key: 'status', label: 'Status' },
          ],
          onExportPDF: handleMaintenanceReportPDF,
          onExportExcel: handleMaintenanceReportExcel,
          summary: [
            { label: 'Pendentes', value: filteredMaintenance.filter(m => m.status === 'pending').length },
            { label: 'Em Execução', value: filteredMaintenance.filter(m => m.status === 'in_progress').length },
            { label: 'Concluídas', value: filteredMaintenance.filter(m => m.status === 'completed').length },
          ],
        };
      case 'expiry':
        return {
          title: 'Pré-visualização: Relatório de Vencimentos',
          description: `${expiringEquipment.length} equipamentos com certificados a vencer`,
          data: expiringEquipment.map(e => {
            const expiryDate = new Date(e.certificate_expiry!);
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            return {
              code: e.internal_code,
              name: e.name,
              category: e.categories?.name || '—',
              expiry: format(expiryDate, 'dd/MM/yyyy', { locale: ptBR }),
              days: daysUntilExpiry < 0 ? 'VENCIDO' : `${daysUntilExpiry} dias`,
            };
          }),
          columns: [
            { key: 'code', label: 'Código' },
            { key: 'name', label: 'Equipamento' },
            { key: 'category', label: 'Categoria' },
            { key: 'expiry', label: 'Vencimento' },
            { key: 'days', label: 'Dias Restantes' },
          ],
          onExportPDF: handleExpiryReportPDF,
          onExportExcel: handleExpiryReportExcel,
        };
      case 'non-conformities':
        return {
          title: 'Pré-visualização: Relatório de Não Conformidades',
          description: `${nonConformities.length} não conformidades encontradas`,
          data: nonConformities.map(i => ({
            date: format(new Date(i.inspection_date), 'dd/MM/yyyy', { locale: ptBR }),
            equipment: i.equipment?.name || '—',
            code: i.equipment?.internal_code || '—',
            status: i.status === 'attention' ? 'Atenção' : 'Não Conforme',
            observations: i.observations?.substring(0, 50) || '—',
          })),
          columns: [
            { key: 'date', label: 'Data' },
            { key: 'equipment', label: 'Equipamento' },
            { key: 'code', label: 'Código' },
            { key: 'status', label: 'Status' },
            { key: 'observations', label: 'Observações' },
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
          title: 'Pré-visualização: Relatório por Categoria',
          description: `${categoryData.length} categorias com equipamentos`,
          data: categoryData,
          columns: [
            { key: 'name', label: 'Categoria' },
            { key: 'total', label: 'Total' },
            { key: 'active', label: 'Ativos' },
            { key: 'maintenance', label: 'Manutenção' },
            { key: 'expired', label: 'Vencidos' },
            { key: 'compliance', label: 'Conformidade' },
          ],
          onExportPDF: handleCategoryReportPDF,
          onExportExcel: handleCategoryReportExcel,
        };
      case 'category-inspection':
        return {
          title: 'Pré-visualização: Inspeção por Categoria',
          description: `${categoryInspectionData.length} equipamentos inspecionados`,
          data: categoryInspectionData.map((item, index) => {
            const expiryStatusLabels: Record<string, string> = {
              'ok': '—',
              'expiry_expired': 'Val. vencida',
              'certificate_expired': 'Cert. vencido',
              'both_expired': 'Ambos vencidos',
            };
            return {
              num: index + 1,
              code: item.equipment.internal_code,
              name: item.equipment.name,
              category: item.equipment.categories?.name || '—',
              lastInspection: format(new Date(item.inspectionDate), 'dd/MM/yyyy', { locale: ptBR }),
              inspector: item.lastInspectorName,
              status: inspectionStatusLabels[item.status] || item.status,
              expiry: expiryStatusLabels[item.expiryStatus],
            };
          }),
          columns: [
            { key: 'num', label: '#' },
            { key: 'code', label: 'Código' },
            { key: 'name', label: 'Equipamento' },
            { key: 'category', label: 'Categoria' },
            { key: 'lastInspection', label: 'Última Inspeção' },
            { key: 'inspector', label: 'Inspetor' },
            { key: 'status', label: 'Status' },
            { key: 'expiry', label: 'Vencimento' },
          ],
          onExportPDF: handleCategoryInspectionReportPDF,
          onExportExcel: handleCategoryInspectionReportExcel,
          summary: [
            { label: 'Conforme', value: categoryInspectionData.filter(i => i.status === 'compliant').length, color: 'bg-emerald-100 text-emerald-700' },
            { label: 'Atenção', value: categoryInspectionData.filter(i => i.status === 'attention').length, color: 'bg-amber-100 text-amber-700' },
            { label: 'Não Conforme', value: categoryInspectionData.filter(i => i.status === 'non-compliant').length, color: 'bg-red-100 text-red-700' },
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
      title: 'Relatório de Inspeção por Categoria',
      description: 'Relatório no formato de inspeção em lote com status de conformidade',
      icon: ClipboardCheck,
      count: categoryInspectionData.length,
      iconColor: 'text-white',
      bgColor: 'bg-emerald-600',
    },
    {
      id: 'inspections' as ReportType,
      title: 'Relatório de Inspeções',
      description: 'Relatório detalhado de inspeções por equipamento',
      icon: FileText,
      count: filteredInspections.length,
      iconColor: 'text-white',
      bgColor: 'bg-blue-600',
    },
    {
      id: 'maintenance' as ReportType,
      title: 'Relatório de Manutenções',
      description: 'Histórico e status de solicitações de manutenção',
      icon: Wrench,
      count: filteredMaintenance.length,
      iconColor: 'text-white',
      bgColor: 'bg-teal-600',
    },
    {
      id: 'category' as ReportType,
      title: 'Relatório por Categoria',
      description: 'Análise de equipamentos agrupados por categoria',
      icon: BarChart3,
      count: categories.filter(c => filteredEquipment.some(e => e.category_id === c.id)).length,
      iconColor: 'text-white',
      bgColor: 'bg-purple-600',
    },
    {
      id: 'expiry' as ReportType,
      title: 'Relatório de Vencimentos',
      description: 'Equipamentos com certificados próximos do vencimento',
      icon: Calendar,
      count: expiringEquipment.length,
      iconColor: 'text-white',
      bgColor: 'bg-red-600',
    },
    {
      id: 'non-conformities' as ReportType,
      title: 'Relatório de Não Conformidades',
      description: 'Histórico de não conformidades e ações corretivas',
      icon: AlertTriangle,
      count: nonConformities.length,
      iconColor: 'text-white',
      bgColor: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">
            Geração de relatórios profissionais para auditoria
          </p>
        </div>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros Globais
          </CardTitle>
          <CardDescription>
            Aplique filtros que serão usados em todos os relatórios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Embarcação</Label>
              <Select value={shipFilter} onValueChange={setShipFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as embarcações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as embarcações</SelectItem>
                  {ships.map(ship => (
                    <SelectItem key={ship.id} value={ship.id}>
                      {ship.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <DatePicker
                value={startDateStr}
                onChange={setStartDateStr}
                placeholder="Selecione..."
              />
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <DatePicker
                value={endDateStr}
                onChange={setEndDateStr}
                placeholder="Selecione..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        /* Reports Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportTypes.map((report) => (
            <Card key={report.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${report.bgColor}`}>
                      <report.icon className={`h-5 w-5 ${report.iconColor}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{report.title}</CardTitle>
                      <CardDescription className="mt-1">{report.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {report.count} {report.count === 1 ? 'item' : 'itens'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Separator className="mb-4" />
                <Button 
                  className="gap-2 w-full"
                  onClick={() => openPreview(report.id)}
                  disabled={report.count === 0}
                >
                  <Eye className="h-4 w-4" />
                  Visualizar e Exportar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {!isLoading && (
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">{filteredEquipment.length}</p>
                <p className="text-sm text-muted-foreground">Equipamentos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{filteredInspections.length}</p>
                <p className="text-sm text-muted-foreground">Inspeções</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">{expiringEquipment.length}</p>
                <p className="text-sm text-muted-foreground">A Vencer</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-500">{nonConformities.length}</p>
                <p className="text-sm text-muted-foreground">Não Conformidades</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
