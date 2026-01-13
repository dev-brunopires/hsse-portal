import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  MessageSquare,
  Package,
  Search,
  X,
  ShieldAlert,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useEquipment, type EquipmentWithCategory } from '@/hooks/useEquipment';
import { useInspections, type InspectionWithDetails } from '@/hooks/useInspections';
import { useCategories } from '@/hooks/useCategories';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getEffectiveEquipmentStatus } from '@/utils/equipmentStatus';
import { useTranslation } from 'react-i18next';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';
import { addPDFHeader, addPDFFooter, SBM_BLUE, preloadLogo } from '@/utils/pdfStyles';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { useIsMobile, useIsTabletOrMobile } from '@/hooks/use-mobile';

interface PendingItem {
  equipment: EquipmentWithCategory;
  lastInspection: InspectionWithDetails;
  hasUnresolvedRecommendations: boolean;
  hasCriticalStatus: boolean;
  isCertificateExpired: boolean;
  isInspectionOverdue: boolean;
  isEquipmentExpired: boolean;
  isAutoRejected: boolean;
  autoRejectedReasons: string[];
  autoRejectedReasonKeys: string[];
  daysOverdue: number;
}

export default function PendingRecommendations() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'pt-BR' ? ptBR : enUS;
  const navigate = useNavigate();
  const branding = useOrganizationBranding();
  const isMobile = useIsMobile();
  const isTabletOrMobile = useIsTabletOrMobile();
  const { data: equipment = [], isLoading: equipmentLoading, refetch: refetchEquipment } = useEquipment();
  const { data: inspections = [], isLoading: inspectionsLoading, refetch: refetchInspections } = useInspections();
  const { data: categories = [], refetch: refetchCategories } = useCategories();
  
  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchEquipment(), refetchInspections(), refetchCategories()]);
  }, [refetchEquipment, refetchInspections, refetchCategories]);

  const { pullDistance, isRefreshing, containerRef } = usePullToRefresh({
    onRefresh: handleRefresh,
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const isLoading = equipmentLoading || inspectionsLoading;

  // Process equipment and inspections to find pending items
  const pendingItems = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const items: PendingItem[] = [];

    equipment.forEach((eq) => {
      // Find the last inspection for this equipment
      const equipmentInspections = inspections.filter(i => i.equipment_id === eq.id);
      const lastInspection = equipmentInspections.sort((a, b) => 
        new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime()
      )[0];

      // Calculate effective status (auto-reject if certificate/expiry is overdue)
      const effectiveResult = getEffectiveEquipmentStatus(eq);
      const isAutoRejected = effectiveResult.isAutoRejected;
      const autoRejectedReasons = effectiveResult.reasons;
      const autoRejectedReasonKeys = effectiveResult.reasonKeys;

      // Check for issues
      const isCertificateExpired = !!(eq.certificate_expiry && eq.certificate_expiry < today);
      const isInspectionOverdue = !!(eq.next_inspection && eq.next_inspection < today);
      const isEquipmentExpired = !!(eq.expiry_date && eq.expiry_date < today);
      const hasCriticalStatus = eq.status === 'expired' || eq.status === 'rejected' || isAutoRejected;
      
      // Check for unresolved recommendations
      const hasRecommendations = !!(lastInspection?.recommendations && lastInspection.recommendations.trim().length > 0);
      const hasActionsTaken = !!(lastInspection?.actions_taken && lastInspection.actions_taken.trim().length > 0);
      const hasUnresolvedRecommendations = hasRecommendations && !hasActionsTaken;
      
      // Check if last inspection had issues
      const lastInspectionHadIssues = lastInspection?.status === 'attention' || lastInspection?.status === 'non-compliant';

      // Calculate days overdue
      let daysOverdue = 0;
      if (isInspectionOverdue && eq.next_inspection) {
        daysOverdue = Math.floor((new Date().getTime() - new Date(eq.next_inspection).getTime()) / (1000 * 60 * 60 * 24));
      }

      // Add to pending items if any issue exists (including auto-rejected)
      if (hasUnresolvedRecommendations || isCertificateExpired || isInspectionOverdue || hasCriticalStatus || lastInspectionHadIssues || isEquipmentExpired || isAutoRejected) {
        items.push({
          equipment: eq,
          lastInspection,
          hasUnresolvedRecommendations,
          hasCriticalStatus,
          isCertificateExpired,
          isInspectionOverdue,
          isEquipmentExpired,
          isAutoRejected,
          autoRejectedReasons,
          autoRejectedReasonKeys,
          daysOverdue,
        });
      }
    });

    // Sort by severity: auto-rejected > certificate expired > equipment expired > inspection overdue > unresolved recommendations
    return items.sort((a, b) => {
      if (a.isAutoRejected !== b.isAutoRejected) return a.isAutoRejected ? -1 : 1;
      if (a.isCertificateExpired !== b.isCertificateExpired) return a.isCertificateExpired ? -1 : 1;
      if (a.isEquipmentExpired !== b.isEquipmentExpired) return a.isEquipmentExpired ? -1 : 1;
      if (a.isInspectionOverdue !== b.isInspectionOverdue) return a.isInspectionOverdue ? -1 : 1;
      if (a.hasUnresolvedRecommendations !== b.hasUnresolvedRecommendations) return a.hasUnresolvedRecommendations ? -1 : 1;
      return b.daysOverdue - a.daysOverdue;
    });
  }, [equipment, inspections]);

  // Filter items
  const filteredItems = useMemo(() => {
    return pendingItems.filter(item => {
      const matchesSearch = 
        item.equipment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.equipment.internal_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.equipment.location.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || item.equipment.category_id === categoryFilter;
      
      let matchesIssueType = true;
      if (issueTypeFilter === 'recommendations') {
        matchesIssueType = item.hasUnresolvedRecommendations;
      } else if (issueTypeFilter === 'certificate') {
        matchesIssueType = item.isCertificateExpired;
      } else if (issueTypeFilter === 'inspection') {
        matchesIssueType = item.isInspectionOverdue;
      } else if (issueTypeFilter === 'status') {
        matchesIssueType = item.hasCriticalStatus;
      }
      
      return matchesSearch && matchesCategory && matchesIssueType;
    });
  }, [pendingItems, searchTerm, categoryFilter, issueTypeFilter]);

  // Statistics
  const stats = useMemo(() => ({
    total: pendingItems.length,
    unresolvedRecommendations: pendingItems.filter(i => i.hasUnresolvedRecommendations).length,
    expiredCertificates: pendingItems.filter(i => i.isCertificateExpired).length,
    overdueInspections: pendingItems.filter(i => i.isInspectionOverdue).length,
    criticalStatus: pendingItems.filter(i => i.hasCriticalStatus).length,
    autoRejected: pendingItems.filter(i => i.isAutoRejected).length,
    equipmentExpired: pendingItems.filter(i => i.isEquipmentExpired).length,
  }), [pendingItems]);

  const hasActiveFilters = categoryFilter !== 'all' || issueTypeFilter !== 'all' || searchTerm;

  const clearFilters = () => {
    setCategoryFilter('all');
    setIssueTypeFilter('all');
    setSearchTerm('');
  };

  const openDetailDialog = (item: PendingItem) => {
    setSelectedItem(item);
    setDetailDialogOpen(true);
  };

  const handleStartInspection = (equipmentId: string) => {
    navigate(`/inspections?scan=${equipmentId}`);
  };

  const exportToPDF = async () => {
    // Preload logo with branding
    await preloadLogo(branding);
    
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    const generatedDate = format(new Date(), "dd/MM/yyyy HH:mm", { locale: dateLocale });

    // Add standardized header with branding
    const yPos = await addPDFHeader(
      doc,
      t('pendingRecommendations.pdfReport.title'),
      `${t('pendingRecommendations.pdfReport.generatedAt')} ${generatedDate}`,
      [`${t('pendingRecommendations.pdfReport.totalPendencies')}: ${stats.total}`],
      { branding }
    );

    // Summary
    doc.setFontSize(10);
    doc.text(`${t('pendingRecommendations.pdfReport.recommendations')}: ${stats.unresolvedRecommendations} | ${t('pendingRecommendations.pdfReport.expiredCertificates')}: ${stats.expiredCertificates} | ${t('pendingRecommendations.pdfReport.overdueInspections')}: ${stats.overdueInspections}`, 14, yPos + 5);

    // Table
    const tableBody = filteredItems.map(item => {
      const issues: string[] = [];
      if (item.isAutoRejected) issues.push(t('pendingRecommendations.autoRejected'));
      if (item.isCertificateExpired) issues.push(t('pendingRecommendations.certExpired'));
      if (item.isEquipmentExpired) issues.push(t('pendingRecommendations.expiryExpired'));
      if (item.isInspectionOverdue) issues.push(`${t('pendingRecommendations.inspOverdue')} (${item.daysOverdue}${t('pendingRecommendations.days')})`);
      if (item.hasUnresolvedRecommendations) issues.push(t('pendingRecommendations.pendingRecommendation'));
      if (item.hasCriticalStatus && !item.isAutoRejected) issues.push(t('pendingRecommendations.criticalStatusBadge'));

      return [
        item.equipment.internal_code,
        item.equipment.name,
        item.equipment.categories?.name || '-',
        item.equipment.location,
        item.lastInspection ? format(new Date(item.lastInspection.inspection_date), 'dd/MM/yyyy') : '-',
        issues.join(', '),
        item.lastInspection?.recommendations?.substring(0, 50) + (item.lastInspection?.recommendations?.length > 50 ? '...' : '') || '-',
      ];
    });

    autoTable(doc, {
      startY: yPos + 12,
      head: [[
        t('pendingRecommendations.pdfReport.codeHeader'),
        t('pendingRecommendations.pdfReport.equipmentHeader'),
        t('pendingRecommendations.pdfReport.categoryHeader'),
        t('pendingRecommendations.pdfReport.locationHeader'),
        t('pendingRecommendations.pdfReport.lastInspHeader'),
        t('pendingRecommendations.pdfReport.pendenciesHeader'),
        t('pendingRecommendations.pdfReport.recommendationsHeader')
      ]],
      body: tableBody,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: SBM_BLUE },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 22 },
        5: { cellWidth: 45 },
        6: { cellWidth: 'auto' },
      },
    });

    // Add standardized footer
    addPDFFooter(doc, branding?.name || 'SafeShip', t('pendingRecommendations.pdfReport.title'));

    doc.save(`${t('pendingRecommendations.pdfReport.fileName')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        icon={ShieldAlert}
        title={t('pendingRecommendations.title')}
        subtitle={t('pendingRecommendations.subtitle')}
        actions={
          <Button className="gap-2" onClick={exportToPDF}>
            <Download className="h-4 w-4" />
            {t('pendingRecommendations.exportPDF')}
          </Button>
        }
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          title={t('pendingRecommendations.total')}
          value={stats.total}
          icon={AlertTriangle}
          variant="danger"
          isLoading={isLoading}
        />

        <StatCard
          title={t('pendingRecommendations.rejected')}
          value={stats.autoRejected}
          description={t('pendingRecommendations.automatic')}
          icon={ShieldAlert}
          variant="danger"
          isLoading={isLoading}
        />

        <StatCard
          title={t('pendingRecommendations.recommendations')}
          value={stats.unresolvedRecommendations}
          description={t('pendingRecommendations.unresolved')}
          icon={MessageSquare}
          variant="info"
          isLoading={isLoading}
        />

        <StatCard
          title={t('pendingRecommendations.certificates')}
          value={stats.expiredCertificates}
          description={t('pendingRecommendations.expired')}
          icon={FileText}
          variant="danger"
          isLoading={isLoading}
        />

        <StatCard
          title={t('pendingRecommendations.inspectionsCard')}
          value={stats.overdueInspections}
          description={t('pendingRecommendations.overdue')}
          icon={Clock}
          variant="warning"
          isLoading={isLoading}
        />

        <StatCard
          title={t('pendingRecommendations.criticalStatus')}
          value={stats.criticalStatus}
          description={t('pendingRecommendations.rejectedExpired')}
          icon={X}
          variant="danger"
          isLoading={isLoading}
        />
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pendingRecommendations.pendingList')}</CardTitle>
          <CardDescription>
            {t('pendingRecommendations.requireAttention')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('pendingRecommendations.searchPlaceholder')}
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder={t('common.category')} />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="all">{t('pendingRecommendations.allCategories')}</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={issueTypeFilter} onValueChange={setIssueTypeFilter}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('common.filter')} />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="all">{t('pendingRecommendations.allPendencies')}</SelectItem>
                <SelectItem value="recommendations">{t('pendingRecommendations.pendingRecommendationsFilter')}</SelectItem>
                <SelectItem value="certificate">{t('pendingRecommendations.expiredCertificate')}</SelectItem>
                <SelectItem value="inspection">{t('pendingRecommendations.overdueInspection')}</SelectItem>
                <SelectItem value="status">{t('pendingRecommendations.criticalStatusFilter')}</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              {t('pendingRecommendations.showingFiltered', { count: filteredItems.length, total: pendingItems.length })}
            </div>
          )}

          {/* Mobile/Tablet Card View with Pull to Refresh */}
          <div 
            ref={isMobile ? containerRef : undefined}
            className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-auto"
          >
            <PullToRefreshIndicator 
              pullDistance={pullDistance} 
              isRefreshing={isRefreshing} 
            />
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24 mb-3" />
                  <div className="flex gap-2 mb-3">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-9 w-full" />
                </Card>
              ))
            ) : filteredItems.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-status-success" />
                <p>{t('pendingRecommendations.noResults')}</p>
                <p className="text-sm">{t('pendingRecommendations.noResultsDescription')}</p>
              </Card>
            ) : (
              filteredItems.map((item) => (
                <Card 
                  key={item.equipment.id}
                  className={`p-4 ${item.isAutoRejected ? 'border-l-4 border-l-red-500 bg-red-500/5' : ''}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                      item.isAutoRejected
                        ? 'bg-red-500/20'
                        : item.isCertificateExpired || item.hasCriticalStatus 
                          ? 'bg-status-danger/10' 
                          : item.isInspectionOverdue 
                            ? 'bg-status-warning/10'
                            : 'bg-primary/10'
                    }`}>
                      {item.isAutoRejected ? (
                        <ShieldAlert className="h-5 w-5 text-red-500" />
                      ) : (
                        <Package className={`h-5 w-5 ${
                          item.isCertificateExpired || item.hasCriticalStatus 
                            ? 'text-status-danger' 
                            : item.isInspectionOverdue 
                              ? 'text-status-warning'
                              : 'text-primary'
                        }`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.equipment.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {item.equipment.internal_code}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {item.equipment.categories?.name || '-'}
                        </Badge>
                        <span>•</span>
                        <span>{item.equipment.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pendencies Badges */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.isAutoRejected && (
                      <Badge className="text-xs bg-red-500 text-white font-bold">
                        {t('common.rejected').toUpperCase()}
                      </Badge>
                    )}
                    {item.isAutoRejected && item.autoRejectedReasonKeys.map((reasonKey, idx) => (
                      <Badge key={idx} variant="destructive" className="text-xs">
                        {t(reasonKey)}
                      </Badge>
                    ))}
                    {!item.isAutoRejected && item.isCertificateExpired && (
                      <Badge variant="destructive" className="text-xs">
                        {t('pendingRecommendations.certExpired')}
                      </Badge>
                    )}
                    {!item.isAutoRejected && item.isEquipmentExpired && (
                      <Badge variant="destructive" className="text-xs">
                        {t('pendingRecommendations.expiryExpired')}
                      </Badge>
                    )}
                    {item.isInspectionOverdue && (
                      <Badge className="text-xs bg-status-warning text-status-warning-foreground">
                        {t('pendingRecommendations.inspOverdue')} ({item.daysOverdue}{t('pendingRecommendations.days')})
                      </Badge>
                    )}
                    {item.hasUnresolvedRecommendations && (
                      <Badge variant="outline" className="text-xs border-primary text-primary">
                        {t('pendingRecommendations.pendingRecommendation')}
                      </Badge>
                    )}
                    {!item.isAutoRejected && item.hasCriticalStatus && (
                      <Badge variant="destructive" className="text-xs">
                        {item.equipment.status === 'rejected' ? t('common.rejected') : t('pendingRecommendations.expired')}
                      </Badge>
                    )}
                  </div>

                  {/* Last Inspection */}
                  {item.lastInspection && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <Calendar className="h-3.5 w-3.5" />
                      {t('pendingRecommendations.lastInspectionColumn')}: {format(new Date(item.lastInspection.inspection_date), 'dd/MM/yyyy')}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1"
                      onClick={() => openDetailDialog(item)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {t('common.details')}
                    </Button>
                    <Button 
                      size="sm"
                      className="flex-1"
                      onClick={() => handleStartInspection(item.equipment.id)}
                    >
                      {t('pendingRecommendations.startInspection')}
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop Table - only on large screens */}
          <div className="hidden lg:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('pendingRecommendations.equipmentColumn')}</TableHead>
                  <TableHead>{t('pendingRecommendations.categoryColumn')}</TableHead>
                  <TableHead>{t('common.location')}</TableHead>
                  <TableHead>{t('pendingRecommendations.lastInspectionColumn')}</TableHead>
                  <TableHead>{t('pendingRecommendations.pendenciesColumn')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-status-success" />
                      <p>{t('pendingRecommendations.noResults')}</p>
                      <p className="text-sm">{t('pendingRecommendations.noResultsDescription')}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow 
                      key={item.equipment.id} 
                      className={`hover:bg-muted/50 ${item.isAutoRejected ? 'bg-red-500/5 border-l-4 border-l-red-500' : ''}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            item.isAutoRejected
                              ? 'bg-red-500/20'
                              : item.isCertificateExpired || item.hasCriticalStatus 
                                ? 'bg-status-danger/10' 
                                : item.isInspectionOverdue 
                                  ? 'bg-status-warning/10'
                                  : 'bg-primary/10'
                          }`}>
                            {item.isAutoRejected ? (
                              <ShieldAlert className="h-4 w-4 text-red-500" />
                            ) : (
                              <Package className={`h-4 w-4 ${
                                item.isCertificateExpired || item.hasCriticalStatus 
                                  ? 'text-status-danger' 
                                  : item.isInspectionOverdue 
                                    ? 'text-status-warning'
                                    : 'text-primary'
                              }`} />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{item.equipment.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {item.equipment.internal_code}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.equipment.categories?.name || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.equipment.location}
                      </TableCell>
                      <TableCell>
                        {item.lastInspection ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {format(new Date(item.lastInspection.inspection_date), 'dd/MM/yyyy')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.isAutoRejected && (
                            <Badge className="text-xs bg-red-500 text-white font-bold">
                              {t('common.rejected').toUpperCase()}
                            </Badge>
                          )}
                          {item.isAutoRejected && item.autoRejectedReasonKeys.map((reasonKey, idx) => (
                            <Badge key={idx} variant="destructive" className="text-xs">
                              {t(reasonKey)}
                            </Badge>
                          ))}
                          {!item.isAutoRejected && item.isCertificateExpired && (
                            <Badge variant="destructive" className="text-xs">
                              {t('pendingRecommendations.certExpired')}
                            </Badge>
                          )}
                          {!item.isAutoRejected && item.isEquipmentExpired && (
                            <Badge variant="destructive" className="text-xs">
                              {t('pendingRecommendations.expiryExpired')}
                            </Badge>
                          )}
                          {item.isInspectionOverdue && (
                            <Badge className="text-xs bg-status-warning text-status-warning-foreground">
                              {t('pendingRecommendations.inspOverdue')} ({item.daysOverdue}{t('pendingRecommendations.days')})
                            </Badge>
                          )}
                          {item.hasUnresolvedRecommendations && (
                            <Badge variant="outline" className="text-xs border-primary text-primary">
                              {t('pendingRecommendations.pendingRecommendation')}
                            </Badge>
                          )}
                          {!item.isAutoRejected && item.hasCriticalStatus && (
                            <Badge variant="destructive" className="text-xs">
                              {item.equipment.status === 'rejected' ? t('common.rejected') : t('pendingRecommendations.expired')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openDetailDialog(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleStartInspection(item.equipment.id)}
                          >
                            {t('pendingRecommendations.startInspection')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-status-warning" />
              {t('pendingRecommendations.detailDialog.pendenciesFor')}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.equipment.internal_code} - {selectedItem?.equipment.name}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            {selectedItem && (
              <div className="space-y-4 py-2">
                {/* Equipment Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('pendingRecommendations.detailDialog.location')}</p>
                    <p className="font-medium">{selectedItem.equipment.location}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('pendingRecommendations.detailDialog.category')}</p>
                    <p className="font-medium">{selectedItem.equipment.categories?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('pendingRecommendations.detailDialog.lastInspection')}</p>
                    <p className="font-medium">
                      {selectedItem.lastInspection 
                        ? format(new Date(selectedItem.lastInspection.inspection_date), "dd/MM/yyyy", { locale: dateLocale })
                        : t('inspections.neverInspected')
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('pendingRecommendations.detailDialog.nextInspection')}</p>
                    <p className={`font-medium ${selectedItem.isInspectionOverdue ? 'text-status-danger' : ''}`}>
                      {selectedItem.equipment.next_inspection 
                        ? format(new Date(selectedItem.equipment.next_inspection), "dd/MM/yyyy", { locale: dateLocale })
                        : '-'
                      }
                      {selectedItem.isInspectionOverdue && ` (${selectedItem.daysOverdue} ${t('pendingRecommendations.overdue').toLowerCase()})`}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Issues */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-status-danger flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {t('pendingRecommendations.detailDialog.identifiedPendencies')}
                  </h4>

                  {selectedItem.isAutoRejected && (
                    <div className="p-3 rounded-lg bg-red-500/10 border-2 border-red-500/50">
                      <p className="font-bold text-red-500 flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4" />
                        {t('pendingRecommendations.autoRejected')}
                      </p>
                      <ul className="text-sm mt-1 list-disc list-inside">
                        {selectedItem.autoRejectedReasonKeys.map((reasonKey, idx) => (
                          <li key={idx}>{t(reasonKey)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedItem.isCertificateExpired && !selectedItem.isAutoRejected && (
                    <div className="p-3 rounded-lg bg-status-danger/10 border border-status-danger/30">
                      <p className="font-medium text-status-danger">{t('pendingRecommendations.expiredCertificate')}</p>
                      <p className="text-sm">
                        {t('preInspectionWarning.expiredOn')} {format(new Date(selectedItem.equipment.certificate_expiry + 'T00:00:00'), "dd/MM/yyyy", { locale: dateLocale })}
                      </p>
                    </div>
                  )}

                  {selectedItem.isInspectionOverdue && (
                    <div className="p-3 rounded-lg bg-status-warning/10 border border-status-warning/30">
                      <p className="font-medium text-status-warning">{t('pendingRecommendations.overdueInspection')}</p>
                      <p className="text-sm">
                        {t('preInspectionWarning.scheduledFor')} {format(new Date(selectedItem.equipment.next_inspection + 'T00:00:00'), "dd/MM/yyyy", { locale: dateLocale })} 
                        {' '}({selectedItem.daysOverdue} {t('pendingRecommendations.days')} {t('pendingRecommendations.overdue').toLowerCase()})
                      </p>
                    </div>
                  )}

                  {selectedItem.hasCriticalStatus && !selectedItem.isAutoRejected && (
                    <div className="p-3 rounded-lg bg-status-danger/10 border border-status-danger/30">
                      <p className="font-medium text-status-danger">
                        {t('common.status')}: {selectedItem.equipment.status === 'rejected' ? t('common.rejected') : t('pendingRecommendations.expired')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                {selectedItem.lastInspection?.recommendations && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-semibold text-primary flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        {t('pendingRecommendations.detailDialog.pendingRecommendations')}
                      </h4>
                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-sm whitespace-pre-wrap">{selectedItem.lastInspection.recommendations}</p>
                        <p className="text-xs text-muted-foreground mt-3">
                          {t('equipmentWarning.registeredOn')} {format(new Date(selectedItem.lastInspection.inspection_date), "dd/MM/yyyy", { locale: dateLocale })}
                        </p>
                      </div>

                      {selectedItem.lastInspection.actions_taken ? (
                        <div className="p-4 rounded-lg bg-status-success/5 border border-status-success/20">
                          <div className="flex items-center gap-2 text-status-success font-medium text-sm mb-2">
                            <CheckCircle2 className="h-4 w-4" />
                            {t('equipmentWarning.actionsTakenLastInspection')}:
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{selectedItem.lastInspection.actions_taken}</p>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-status-warning/10 border border-status-warning/30">
                          <div className="flex items-center gap-2 text-status-warning font-medium text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            {t('preInspectionWarning.noActionsRegisteredMessage')}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Actions */}
                <div className="pt-4">
                  <Button 
                    className="w-full gap-2" 
                    onClick={() => {
                      setDetailDialogOpen(false);
                      handleStartInspection(selectedItem.equipment.id);
                    }}
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    {t('pendingRecommendations.startInspection')}
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}