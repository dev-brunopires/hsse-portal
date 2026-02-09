import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClipboardCheck, 
  Calendar, 
  Plus, 
  Search, 
  Eye, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  User,
  X,
  QrCode,
  CalendarDays,
  List,
  GitCommitHorizontal,
  Edit,
  MoreHorizontal,
  Trash2,
  Layers,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useInspections, type InspectionWithDetails } from '@/hooks/useInspections';
import { useProfiles } from '@/hooks/useProfiles';
import { useEquipmentById } from '@/hooks/useEquipment';
import { isAfter, isBefore, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { formatDate, formatWeekday, parseLocalDate } from '@/utils/dateFormat';
import { InspectionDetailDialog } from '@/components/inspections/InspectionDetailDialog';
import { NewInspectionDialog } from '@/components/inspections/NewInspectionDialog';
import { EditInspectionDialog } from '@/components/inspections/EditInspectionDialog';
import { QRCodeScannerDialog } from '@/components/equipment/QRCodeScannerDialog';
import { InspectionCalendar } from '@/components/inspections/InspectionCalendar';
import { InspectionTimeline } from '@/components/inspections/InspectionTimeline';
import { CategoryInspectionTab } from '@/components/inspections/CategoryInspectionTab';
import { exportInspectionsToExcel, exportInspectionsToPDF } from '@/utils/exportInspections';
import { formatInspectionId } from '@/utils/formatId';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';

const getStatusConfig = (t: (key: string) => string) => ({
  compliant: { label: t('inspections.statusCompliant'), variant: 'default' as const, icon: CheckCircle },
  attention: { label: t('inspections.statusAttention'), variant: 'outline' as const, icon: AlertTriangle },
  'non-compliant': { label: t('inspections.statusNonCompliant'), variant: 'destructive' as const, icon: XCircle },
  approved: { label: t('inspections.statusApproved'), variant: 'default' as const, icon: CheckCircle },
  pending: { label: t('inspections.statusPending'), variant: 'secondary' as const, icon: Clock },
  rejected: { label: t('inspections.statusRejected'), variant: 'destructive' as const, icon: XCircle },
  conditional: { label: t('inspections.statusConditional'), variant: 'outline' as const, icon: AlertTriangle },
});

export default function Inspections() {
  const { t } = useTranslation();
  const statusConfig = getStatusConfig(t);
  const [searchParams, setSearchParams] = useSearchParams();
  const scanEquipmentId = searchParams.get('scan');
  const isMobile = useIsMobile();
  const branding = useOrganizationBranding();
  
  const { data: inspections = [], isLoading, refetch: refetchInspections } = useInspections();
  const { data: profiles = [] } = useProfiles();
  const { data: scannedEquipment } = useEquipmentById(scanEquipmentId || undefined);
  const { toast } = useToast();
  
  const handleRefresh = useCallback(async () => {
    await refetchInspections();
  }, [refetchInspections]);

  const { pullDistance, isRefreshing, containerRef } = usePullToRefresh({
    onRefresh: handleRefresh,
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inspectorFilter, setInspectorFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedInspection, setSelectedInspection] = useState<InspectionWithDetails | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showNewInspectionForm, setShowNewInspectionForm] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'timeline' | 'category'>('list');
  const [preselectedEquipmentId, setPreselectedEquipmentId] = useState<string | null>(null);

  // Auto-open form when scanning QR code - trigger immediately on scan param
  useEffect(() => {
    if (scanEquipmentId) {
      console.log('[Inspections] QR scan detected, opening form for equipment:', scanEquipmentId);
      setPreselectedEquipmentId(scanEquipmentId);
      setShowNewInspectionForm(true);
      
      if (scannedEquipment) {
        toast({
          title: t('inspections.qrCodeDetected'),
          description: `${t('inspections.startingInspection')}: ${scannedEquipment.internal_code} - ${scannedEquipment.name}`,
        });
      }
    }
  }, [scanEquipmentId, scannedEquipment, toast, t]);

  // Clear scan param after form closes
  const handleFormSuccess = () => {
    setShowNewInspectionForm(false);
    setPreselectedEquipmentId(null);
    if (scanEquipmentId) {
      setSearchParams({});
    }
  };

  const handleFormCancel = () => {
    setShowNewInspectionForm(false);
    setPreselectedEquipmentId(null);
    if (scanEquipmentId) {
      setSearchParams({});
    }
  };

  // Get unique inspectors from inspections
  const inspectors = useMemo(() => {
    const uniqueInspectors = new Map<string, { id: string; name: string }>();
    inspections.forEach(i => {
      if (i.profiles && i.inspector_id) {
        uniqueInspectors.set(i.inspector_id, { 
          id: i.inspector_id, 
          name: i.profiles.full_name 
        });
      }
    });
    return Array.from(uniqueInspectors.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [inspections]);

  // Calculate statistics
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  
  const pendingInspections = inspections.filter(i => i.status === 'attention').length;
  const completedThisMonth = inspections.filter(i => {
    const date = new Date(i.inspection_date);
    return isAfter(date, monthStart) && isBefore(date, monthEnd) && i.status === 'compliant';
  }).length;
  const nonConformant = inspections.filter(i => i.status === 'non-compliant' || i.status === 'attention').length;

  // Filter inspections
  const filteredInspections = useMemo(() => {
    return inspections.filter(inspection => {
      const matchesSearch = 
        inspection.equipment?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inspection.equipment?.internal_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inspection.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || inspection.status === statusFilter;
      const matchesInspector = inspectorFilter === 'all' || inspection.inspector_id === inspectorFilter;
      
      const inspectionDate = parseLocalDate(inspection.inspection_date)!;
      const matchesDateFrom = !dateFrom || isAfter(inspectionDate, parseLocalDate(dateFrom)!) || inspection.inspection_date === dateFrom;
      const matchesDateTo = !dateTo || isBefore(inspectionDate, parseLocalDate(dateTo)!) || inspection.inspection_date === dateTo;
      
      return matchesSearch && matchesStatus && matchesInspector && matchesDateFrom && matchesDateTo;
    });
  }, [inspections, searchTerm, statusFilter, inspectorFilter, dateFrom, dateTo]);

  // Get upcoming inspections (next 30 days based on next_inspection_date)
  const upcomingInspections = inspections
    .filter(i => i.next_inspection_date && isAfter(new Date(i.next_inspection_date), now) && isBefore(new Date(i.next_inspection_date), addDays(now, 30)))
    .sort((a, b) => new Date(a.next_inspection_date!).getTime() - new Date(b.next_inspection_date!).getTime());

  const hasActiveFilters = statusFilter !== 'all' || inspectorFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setStatusFilter('all');
    setInspectorFilter('all');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: t('common.pending'), variant: 'secondary' as const, icon: Clock };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const openDetailDialog = (inspection: InspectionWithDetails) => {
    setSelectedInspection(inspection);
    setDetailDialogOpen(true);
  };

  const handleEditInspection = (inspection: InspectionWithDetails) => {
    setSelectedInspection(inspection);
    setDetailDialogOpen(false);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    setSelectedInspection(null);
  };

  const handleExportExcel = () => {
    exportInspectionsToExcel(filteredInspections);
  };

  const handleExportPDF = async (preview: boolean = false) => {
    toast({ title: t('common.loading'), description: t('common.loading') });
    await exportInspectionsToPDF(filteredInspections, 'relatorio_inspecoes', branding, { preview });
    toast({ title: t('common.success'), description: preview ? t('inspections.pdfPreviewOpened') : t('common.success') });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={ClipboardCheck}
        title={t('inspections.title')}
        subtitle={t('inspections.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('common.export')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg">
                <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4" />
                  {t('inspections.exportExcel')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPDF(true)} className="gap-2 cursor-pointer">
                  <Eye className="h-4 w-4" />
                  {t('inspections.previewPDF')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPDF(false)} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  {t('inspections.exportPDF')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="gap-2 hidden md:flex" onClick={() => setShowQRScanner(true)}>
              <QrCode className="h-4 w-4" />
              <span>{t('equipment.scanQRCode')}</span>
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setShowNewInspectionForm(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspections.newInspection')}</span>
              <span className="sm:hidden">{t('common.new')}</span>
            </Button>
          </div>
        }
      />

      {/* QR Code Scanner Dialog */}
      <QRCodeScannerDialog
        open={showQRScanner}
        onOpenChange={setShowQRScanner}
        onScan={(equipmentId) => {
          console.log('[Inspections] QR scanned from internal scanner:', equipmentId);
          setSearchParams({ scan: equipmentId });
          setPreselectedEquipmentId(equipmentId);
          setShowNewInspectionForm(true);
          setShowQRScanner(false);
        }}
      />

      {/* QR Code Scan Indicator */}
      {scanEquipmentId && scannedEquipment && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <QrCode className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <p className="font-medium">{t('inspectionsPage.qrCodeInspection')}</p>
              <p className="text-sm text-muted-foreground">
                {t('inspectionsPage.qrCodeEquipment')}: {scannedEquipment.internal_code} - {scannedEquipment.name}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleFormCancel}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Inspection Dialog */}
      <NewInspectionDialog
        open={showNewInspectionForm}
        onOpenChange={(open) => {
          setShowNewInspectionForm(open);
          if (!open) handleFormCancel();
        }}
        preSelectedEquipmentId={scanEquipmentId}
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title={t('inspectionsPage.total')}
          value={inspections.length}
          description={t('inspectionsPage.allInspections')}
          icon={ClipboardCheck}
          variant="default"
          isLoading={isLoading}
        />
        <StatCard
          title={t('inspectionsPage.pending')}
          value={pendingInspections}
          description={t('inspectionsPage.scheduledInspections')}
          icon={Calendar}
          variant="warning"
          isLoading={isLoading}
        />
        <StatCard
          title={t('inspectionsPage.completedMonth')}
          value={completedThisMonth}
          description={t('inspectionsPage.completedInspections')}
          icon={CheckCircle}
          variant="success"
          isLoading={isLoading}
        />
        <StatCard
          title={t('inspectionsPage.nonConformant')}
          value={nonConformant}
          description={t('inspectionsPage.requireAction')}
          icon={AlertTriangle}
          variant="danger"
          isLoading={isLoading}
        />
      </div>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'calendar' | 'timeline' | 'category')}>
        <TabsList className="w-full grid grid-cols-4 md:w-auto md:inline-flex">
          <TabsTrigger value="list" className="gap-1.5 px-2 md:px-4">
            <List className="h-4 w-4" />
            <span>{t('inspectionsPage.list')}</span>
          </TabsTrigger>
          <TabsTrigger value="category" className="gap-1.5 px-2 md:px-4">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">{t('inspectionsPage.byCategory')}</span>
            <span className="sm:hidden">Cat.</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5 px-2 md:px-4">
            <GitCommitHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">{t('inspectionsPage.timeline')}</span>
            <span className="sm:hidden">Timeline</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5 px-2 md:px-4">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">{t('inspectionsPage.calendar')}</span>
            <span className="sm:hidden">Cal.</span>
          </TabsTrigger>
        </TabsList>

        {/* List View */}
        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('inspectionsPage.historyTitle')}</CardTitle>
              <CardDescription>{t('inspectionsPage.historySubtitle')}</CardDescription>
            </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters - responsive grid for tablet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row gap-3 lg:gap-4">
            <div className="relative sm:col-span-2 lg:flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('inspectionsPage.searchPlaceholder')}
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="all">{t('inspectionsPage.allStatus')}</SelectItem>
                <SelectItem value="compliant">{t('inspectionsPage.statusCompliant')}</SelectItem>
                <SelectItem value="attention">{t('inspectionsPage.statusAttention')}</SelectItem>
                <SelectItem value="non-compliant">{t('inspectionsPage.statusNonCompliant')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={inspectorFilter} onValueChange={setInspectorFilter}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('inspections.inspector')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('inspectionsPage.allInspectors')}</SelectItem>
                {inspectors.map(inspector => (
                  <SelectItem key={inspector.id} value={inspector.id}>
                    {inspector.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
              <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
                placeholder={t('inspections.dateFrom')}
                className="w-full lg:w-[140px]"
                fromYear={new Date().getFullYear() - 10}
                toYear={new Date().getFullYear() + 1}
              />
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
                placeholder={t('inspections.dateTo')}
                className="w-full lg:w-[140px]"
                fromYear={new Date().getFullYear() - 10}
                toYear={new Date().getFullYear() + 1}
              />
              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters} className="flex-shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              {t('inspectionsPage.showingOf', { filtered: filteredInspections.length, total: inspections.length })}
            </div>
          )}

          {/* Mobile/Tablet Card View with Pull to Refresh */}
          <div 
            ref={isMobile ? containerRef : undefined}
            className="lg:hidden space-y-3 overflow-auto"
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
                  </div>
                  <Skeleton className="h-9 w-full" />
                </Card>
              ))
            ) : filteredInspections.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                {searchTerm || hasActiveFilters
                  ? t('inspectionsPage.noInspectionFiltered') 
                  : t('inspectionsPage.noInspectionRegistered')}
              </Card>
            ) : (
              filteredInspections.map((inspection) => (
                <Card 
                  key={inspection.id}
                  className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => openDetailDialog(inspection)}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {formatInspectionId(inspection.id)}
                        </span>
                      </div>
                      <p className="font-medium truncate mt-1">
                        {inspection.equipment?.name || t('inspectionsPage.equipmentNotFound')}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {inspection.equipment?.internal_code || '-'}
                      </p>
                    </div>
                    {getStatusBadge(inspection.status)}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(inspection.inspection_date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {inspection.profiles?.full_name || t('inspectionsPage.inspectorNotFound')}
                    </span>
                  </div>

                  {inspection.next_inspection_date && (
                    <div className="text-xs text-muted-foreground mb-3">
                      {t('inspectionsPage.tableNext')}: {formatDate(inspection.next_inspection_date)}
                    </div>
                  )}

                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => openDetailDialog(inspection)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {t('common.details')}
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEditInspection(inspection)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      {t('inspectionsPage.edit')}
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
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>{t('inspectionsPage.tableEquipment')}</TableHead>
                  <TableHead>{t('inspectionsPage.tableCode')}</TableHead>
                  <TableHead>{t('inspectionsPage.tableDate')}</TableHead>
                  <TableHead>{t('inspectionsPage.tableInspector')}</TableHead>
                  <TableHead>{t('inspectionsPage.tableStatus')}</TableHead>
                  <TableHead>{t('inspectionsPage.tableNext')}</TableHead>
                  <TableHead className="text-right">{t('inspectionsPage.tableActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredInspections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchTerm || hasActiveFilters
                        ? t('inspectionsPage.noInspectionFiltered') 
                        : t('inspectionsPage.noInspectionRegistered')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInspections.map((inspection) => (
                    <TableRow 
                      key={inspection.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onDoubleClick={() => openDetailDialog(inspection)}
                    >
                      <TableCell className="font-mono text-xs text-primary">
                        {formatInspectionId(inspection.id)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {inspection.equipment?.name || t('inspectionsPage.equipmentNotFound')}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono">
                        {inspection.equipment?.internal_code || '-'}
                      </TableCell>
                      <TableCell>
                        {formatDate(inspection.inspection_date)}
                      </TableCell>
                      <TableCell>
                        {inspection.profiles?.full_name || t('inspectionsPage.inspectorNotFound')}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(inspection.status)}
                      </TableCell>
                      <TableCell>
                        {inspection.next_inspection_date 
                          ? formatDate(inspection.next_inspection_date)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg">
                            <DropdownMenuItem 
                              onClick={() => openDetailDialog(inspection)}
                              className="gap-2 cursor-pointer"
                            >
                              <Eye className="h-4 w-4" />
                              {t('inspectionsPage.viewDetails')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleEditInspection(inspection)}
                              className="gap-2 cursor-pointer"
                            >
                              <Edit className="h-4 w-4" />
                              {t('inspectionsPage.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => openDetailDialog(inspection)}
                              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              {t('inspectionsPage.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            {t('inspectionsPage.totalInspections', { count: filteredInspections.length })}
          </div>
        </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline View */}
        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('inspectionsPage.timelineTitle')}</CardTitle>
              <CardDescription>{t('inspectionsPage.timelineSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <InspectionTimeline 
                inspections={filteredInspections}
                onViewDetails={openDetailDialog}
                onEdit={handleEditInspection}
                maxItems={10}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar" className="mt-6">
          <InspectionCalendar 
            inspections={inspections} 
            onInspectionClick={(inspection) => {
              setSelectedInspection(inspection);
              setDetailDialogOpen(true);
            }}
          />
        </TabsContent>

        {/* Category Inspection View */}
        <TabsContent value="category" className="mt-6">
          <CategoryInspectionTab />
        </TabsContent>
      </Tabs>

      {/* Upcoming Inspections */}
      {upcomingInspections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {t('inspectionsPage.upcomingTitle')}
            </CardTitle>
            <CardDescription>{t('inspectionsPage.upcomingSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingInspections.slice(0, 5).map((inspection) => (
                <div 
                  key={inspection.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => openDetailDialog(inspection)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <ClipboardCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{inspection.equipment?.name}</p>
                      <p className="text-sm text-muted-foreground">{inspection.equipment?.internal_code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatDate(inspection.next_inspection_date!)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatWeekday(inspection.next_inspection_date!)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <InspectionDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        inspection={selectedInspection}
        onEdit={handleEditInspection}
      />

      {/* Edit Dialog */}
      <EditInspectionDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        inspection={selectedInspection}
        onSuccess={handleEditSuccess}
      />

    </div>
  );
}
