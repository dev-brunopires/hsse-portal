import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2, 
  ClipboardCheck,
  Download,
  Filter,
  Search,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Info,
  Loader2,
  Upload,
  FileSpreadsheet,
  FileText,
  QrCode,
} from 'lucide-react';
import type { EquipmentWithCategory } from '@/hooks/useEquipment';
import { useDeleteEquipment } from '@/hooks/useEquipment';
import { StatusBadge } from './StatusBadge';
import { EquipmentFormDialog } from './EquipmentFormDialog';
import { InspectionFormDialog } from './InspectionFormDialog';
import { EquipmentDetailDialog } from './EquipmentDetailDialog';
import { ImportEquipmentDialog } from './ImportEquipmentDialog';
import { QRCodeDialog } from './QRCodeDialog';
import { AdvancedFiltersDialog, type AdvancedFilters } from './AdvancedFiltersDialog';
import { exportToExcel, exportToPDF } from '@/utils/exportEquipment';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/dateFormat';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { useIsMobile } from '@/hooks/use-mobile';

interface EquipmentTableProps {
  equipment: EquipmentWithCategory[];
  categoryName?: string;
  categoryDescription?: string;
  inspectionFrequency?: string;
  onRefresh?: () => Promise<void>;
}

type SortField = 'internal_code' | 'name' | 'location' | 'status' | 'last_inspection' | 'next_inspection' | 'certificate_expiry' | 'capacity';
type SortDirection = 'asc' | 'desc';

const emptyAdvancedFilters: AdvancedFilters = {
  manufacturer: '',
  category: '',
  unit: '',
  acquisitionDateFrom: '',
  acquisitionDateTo: '',
  expiryDateFrom: '',
  expiryDateTo: '',
  certificateExpiryFrom: '',
  certificateExpiryTo: '',
};

export function EquipmentTable({ 
  equipment, 
  categoryName,
  categoryDescription,
  inspectionFrequency,
  onRefresh 
}: EquipmentTableProps) {
  const { t } = useTranslation();
  const branding = useOrganizationBranding();
  const isMobile = useIsMobile();

  const { pullDistance, isRefreshing, containerRef } = usePullToRefresh({
    onRefresh: onRefresh || (async () => {}),
  });
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(emptyAdvancedFilters);
  
  // Dialog states
  const [equipmentFormOpen, setEquipmentFormOpen] = useState(false);
  const [inspectionFormOpen, setInspectionFormOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [qrCodeDialogOpen, setQRCodeDialogOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithCategory | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  const deleteEquipment = useDeleteEquipment();

  const frequencyLabels: Record<string, string> = {
    monthly: t('equipmentTable.frequencyMonthly'),
    quarterly: t('equipmentTable.frequencyQuarterly'),
    semiannual: t('equipmentTable.frequencySemiannual'),
    annual: t('equipmentTable.frequencyAnnual'),
    custom: t('equipmentTable.frequencyCustom'),
  };

  // Extract unique manufacturers and units for filters
  const manufacturers = useMemo(() => 
    [...new Set(equipment.map(e => e.manufacturer))].sort(),
    [equipment]
  );
  
  const units = useMemo(() => 
    [...new Set(equipment.map(e => e.unit))].sort(),
    [equipment]
  );

  // Check if any advanced filters are active
  const hasAdvancedFilters = Object.values(advancedFilters).some(v => v !== '');

  const filteredAndSortedEquipment = useMemo(() => {
    let result = equipment.filter(item => {
      // Search filter - includes short_code for quick search
      const shortCode = (item as any).short_code || '';
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.internal_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shortCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.capacity?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

      // Advanced filters
      const matchesManufacturer = !advancedFilters.manufacturer || item.manufacturer === advancedFilters.manufacturer;
      const matchesCategory = !advancedFilters.category || item.category_id === advancedFilters.category;
      const matchesUnit = !advancedFilters.unit || item.unit === advancedFilters.unit;
      
      const matchesAcquisitionFrom = !advancedFilters.acquisitionDateFrom || 
        (item.acquisition_date >= advancedFilters.acquisitionDateFrom);
      const matchesAcquisitionTo = !advancedFilters.acquisitionDateTo || 
        (item.acquisition_date <= advancedFilters.acquisitionDateTo);
      
      const matchesExpiryFrom = !advancedFilters.expiryDateFrom || 
        (item.expiry_date && item.expiry_date >= advancedFilters.expiryDateFrom);
      const matchesExpiryTo = !advancedFilters.expiryDateTo || 
        (item.expiry_date && item.expiry_date <= advancedFilters.expiryDateTo);
      
      const matchesCertExpiryFrom = !advancedFilters.certificateExpiryFrom || 
        (item.certificate_expiry && item.certificate_expiry >= advancedFilters.certificateExpiryFrom);
      const matchesCertExpiryTo = !advancedFilters.certificateExpiryTo || 
        (item.certificate_expiry && item.certificate_expiry <= advancedFilters.certificateExpiryTo);

      return matchesSearch && matchesStatus && 
        matchesManufacturer && matchesCategory && matchesUnit &&
        matchesAcquisitionFrom && matchesAcquisitionTo &&
        matchesExpiryFrom && matchesExpiryTo &&
        matchesCertExpiryFrom && matchesCertExpiryTo;
    });

    // Sorting
    if (sortField) {
      result = [...result].sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const comparison = aVal.localeCompare(bVal, 'pt-BR');
          return sortDirection === 'asc' ? comparison : -comparison;
        }
        
        return 0;
      });
    }

    return result;
  }, [equipment, searchTerm, statusFilter, advancedFilters, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 text-primary" /> 
      : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const toggleRow = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedRows(prev => 
      prev.length === filteredAndSortedEquipment.length ? [] : filteredAndSortedEquipment.map(e => e.id)
    );
  };

  const openCreateForm = () => {
    setFormMode('create');
    setSelectedEquipment(null);
    setEquipmentFormOpen(true);
  };

  const openEditForm = (eq: EquipmentWithCategory) => {
    setFormMode('edit');
    setSelectedEquipment(eq);
    setEquipmentFormOpen(true);
  };

  const openInspectionForm = (eq: EquipmentWithCategory) => {
    setSelectedEquipment(eq);
    setInspectionFormOpen(true);
  };

  const openDetailDialog = (eq: EquipmentWithCategory) => {
    setSelectedEquipment(eq);
    setDetailDialogOpen(true);
  };

  const openDeleteDialog = (eq: EquipmentWithCategory) => {
    setSelectedEquipment(eq);
    setDeleteDialogOpen(true);
  };

  const openQRCodeDialog = (eq: EquipmentWithCategory) => {
    setSelectedEquipment(eq);
    setQRCodeDialogOpen(true);
  };

  const handleDelete = async () => {
    if (selectedEquipment) {
      await deleteEquipment.mutateAsync(selectedEquipment.id);
      setDeleteDialogOpen(false);
      setSelectedEquipment(null);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = selectedRows.length > 0 
      ? filteredAndSortedEquipment.filter(e => selectedRows.includes(e.id))
      : filteredAndSortedEquipment;
    exportToExcel(dataToExport);
  };

  const handleExportPDF = async (preview: boolean = false) => {
    const dataToExport = selectedRows.length > 0 
      ? filteredAndSortedEquipment.filter(e => selectedRows.includes(e.id))
      : filteredAndSortedEquipment;
    await exportToPDF(dataToExport, 'equipamentos', branding, { preview });
  };


  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Category Info Header */}
        {categoryDescription && (
          <div className="px-4 py-3 bg-primary/5 border-b border-border flex items-center gap-3">
            <Info className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <span className="text-sm text-foreground">{categoryDescription}</span>
            </div>
            {inspectionFrequency && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('equipmentTable.inspectionFrequency')}:</span>
                <span className="font-medium text-foreground">
                  {frequencyLabels[inspectionFrequency] || inspectionFrequency}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="p-3 sm:p-4 border-b border-border space-y-3">
          {/* Mobile: Stacked layout, Desktop: Row layout */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search - Full width on mobile */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('equipmentTable.searchEquipment')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filters row */}
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  <SelectItem value="all">{t('equipmentTable.allStatus')}</SelectItem>
                  <SelectItem value="active">{t('equipmentTable.statusActive')}</SelectItem>
                  <SelectItem value="maintenance">{t('equipmentTable.statusMaintenance')}</SelectItem>
                  <SelectItem value="expired">{t('equipmentTable.statusExpired')}</SelectItem>
                  <SelectItem value="rejected">{t('equipmentTable.statusRejected')}</SelectItem>
                  <SelectItem value="inactive">{t('equipmentTable.statusInactive')}</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant={hasAdvancedFilters ? "default" : "outline"} 
                size="icon"
                onClick={() => setAdvancedFiltersOpen(true)}
                className="flex-shrink-0"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Action buttons - Scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 flex-shrink-0">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('equipmentTable.export')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg">
                <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4" />
                  {t('equipmentTable.exportExcel')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPDF(true)} className="gap-2 cursor-pointer">
                  <Eye className="h-4 w-4" />
                  {t('equipmentTable.previewPDF')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPDF(false)} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  {t('equipmentTable.exportPDF')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="gap-2 flex-shrink-0" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">{t('equipmentTable.import')}</span>
            </Button>
            <Button size="sm" className="gap-2 flex-shrink-0 ml-auto" onClick={openCreateForm}>
              <Plus className="h-4 w-4" />
              <span className="hidden xs:inline">{t('equipmentTable.new')}</span>
              <span className="hidden sm:inline">{t('equipmentTable.equipmentName')}</span>
            </Button>
          </div>

          {selectedRows.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <span className="text-sm font-medium">
                {selectedRows.length} {t('equipmentTable.itemsSelected')}
              </span>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  {t('equipmentTable.export')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportPDF(false)}>
                  {t('equipmentTable.pdfReport')}
                </Button>
                <Button variant="destructive" size="sm">{t('equipmentTable.delete')}</Button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Card View with Pull to Refresh */}
        {isMobile && (
          <div 
            ref={containerRef}
            className="space-y-3 p-3 overflow-auto"
          >
            <PullToRefreshIndicator 
              pullDistance={pullDistance} 
              isRefreshing={isRefreshing} 
            />
            {filteredAndSortedEquipment.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('equipmentTable.noEquipmentFound')}
              </div>
            ) : (
              filteredAndSortedEquipment.map((item) => (
                <div 
                  key={item.id}
                  className={cn(
                    'bg-card border rounded-lg p-4 transition-colors',
                    selectedRows.includes(item.id) && 'border-primary bg-primary/5'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedRows.includes(item.id)}
                      onCheckedChange={() => toggleRow(item.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm font-medium text-primary truncate">
                            {item.internal_code}
                          </p>
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.serial_number}</p>
                        </div>
                        <StatusBadge status={item.status as any} size="sm" equipment={item} />
                      </div>
                      
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="truncate">{item.location}</span>
                        {item.capacity && <span className="truncate">• {item.capacity}</span>}
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">{t('equipmentTable.lastInsp')}:</span>
                          <span className="ml-1 font-medium">{formatDate(item.last_inspection) || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('equipmentTable.nextInsp')}:</span>
                          <span className="ml-1 font-medium">{formatDate(item.next_inspection) || '—'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">{t('equipmentTable.certExpiry')}:</span>
                          <span className="ml-1 font-medium">{formatDate(item.certificate_expiry) || '—'}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 min-w-0"
                          onClick={() => openDetailDialog(item)}
                        >
                          <Eye className="h-4 w-4 shrink-0" />
                          <span className="ml-1 truncate">{t('equipmentTable.view')}</span>
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 min-w-0"
                          onClick={() => openInspectionForm(item)}
                        >
                          <ClipboardCheck className="h-4 w-4 shrink-0" />
                          <span className="ml-1 truncate">{t('common.inspect')}</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg z-50 min-w-[180px]">
                            <DropdownMenuItem 
                              className="gap-2 cursor-pointer py-2.5"
                              onClick={() => openEditForm(item)}
                            >
                              <Edit className="h-4 w-4" /> {t('equipmentTable.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="gap-2 cursor-pointer py-2.5"
                              onClick={() => openQRCodeDialog(item)}
                            >
                              <QrCode className="h-4 w-4" /> {t('equipmentTable.generateQRCode')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="gap-2 text-destructive cursor-pointer py-2.5"
                              onClick={() => openDeleteDialog(item)}
                            >
                              <Trash2 className="h-4 w-4" /> {t('common.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Desktop Table */}
        {!isMobile && (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedRows.length === filteredAndSortedEquipment.length && filteredAndSortedEquipment.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="font-semibold">
                  <div 
                    className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('internal_code')}
                  >
                    {t('equipmentTable.code')} {getSortIcon('internal_code')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">
                  <div 
                    className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('name')}
                  >
                    {t('equipmentTable.equipmentName')} {getSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">
                  <div 
                    className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('capacity')}
                  >
                    {t('equipmentTable.capacity')} {getSortIcon('capacity')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">
                  <div 
                    className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('location')}
                  >
                    {t('equipmentTable.location')} {getSortIcon('location')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">
                  <div 
                    className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('status')}
                  >
                    {t('equipmentTable.status')} {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">
                  <div 
                    className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('last_inspection')}
                  >
                    {t('equipmentTable.lastInsp')} {getSortIcon('last_inspection')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">
                  <div 
                    className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('next_inspection')}
                  >
                    {t('equipmentTable.nextInsp')} {getSortIcon('next_inspection')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold">
                  <div 
                    className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('certificate_expiry')}
                  >
                    {t('equipmentTable.certExpiry')} {getSortIcon('certificate_expiry')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold hidden lg:table-cell">
                  {t('equipmentTable.createdBy')}
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedEquipment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    {t('equipmentTable.noEquipmentFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedEquipment.map((item) => (
                  <TableRow 
                    key={item.id}
                    className={cn(
                      'transition-colors cursor-pointer',
                      selectedRows.includes(item.id) && 'bg-primary/5'
                    )}
                    onDoubleClick={() => openDetailDialog(item)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedRows.includes(item.id)}
                        onCheckedChange={() => toggleRow(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium text-primary">
                      {item.internal_code}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.serial_number}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.capacity || '—'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{item.location}</p>
                        <p className="text-xs text-muted-foreground">{item.unit}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status as any} size="sm" equipment={item} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(item.last_inspection)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(item.next_inspection)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(item.certificate_expiry)}
                    </TableCell>
                    <TableCell className="text-sm hidden lg:table-cell">
                      {(item as any).created_by_profile?.full_name || '—'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg z-50">
                          <DropdownMenuItem 
                            className="gap-2 cursor-pointer"
                            onClick={() => openDetailDialog(item)}
                          >
                            <Eye className="h-4 w-4" /> {t('equipmentTable.view')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 cursor-pointer"
                            onClick={() => openEditForm(item)}
                          >
                            <Edit className="h-4 w-4" /> {t('equipmentTable.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 cursor-pointer"
                            onClick={() => openInspectionForm(item)}
                          >
                            <ClipboardCheck className="h-4 w-4" /> {t('equipmentTable.registerInspection')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 cursor-pointer"
                            onClick={() => openQRCodeDialog(item)}
                          >
                            <QrCode className="h-4 w-4" /> {t('equipmentTable.generateQRCode')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="gap-2 text-destructive cursor-pointer"
                            onClick={() => openDeleteDialog(item)}
                          >
                            <Trash2 className="h-4 w-4" /> {t('common.delete')}
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
        )}

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('equipmentTable.showing')} {filteredAndSortedEquipment.length} {t('equipmentTable.of')} {equipment.length} {t('equipmentTable.equipments')}
          </p>
        </div>
      </div>

      {/* Equipment Form Dialog */}
      <EquipmentFormDialog
        open={equipmentFormOpen}
        onOpenChange={setEquipmentFormOpen}
        mode={formMode}
        initialData={selectedEquipment ? {
          id: selectedEquipment.id,
          internalCode: selectedEquipment.internal_code,
          name: selectedEquipment.name,
          categoryId: selectedEquipment.category_id,
          type: selectedEquipment.type,
          manufacturer: selectedEquipment.manufacturer,
          model: selectedEquipment.model,
          serialNumber: selectedEquipment.serial_number,
          capacity: selectedEquipment.capacity || '',
          shipId: selectedEquipment.ship_id || '',
          location: selectedEquipment.location,
          manufacturingDate: selectedEquipment.manufacturing_date,
          acquisitionDate: selectedEquipment.acquisition_date,
          expiryDate: selectedEquipment.expiry_date || '',
          certificateExpiry: selectedEquipment.certificate_expiry || '',
          observations: selectedEquipment.observations || '',
        } : undefined}
      />

      {/* Inspection Form Dialog */}
      <InspectionFormDialog
        open={inspectionFormOpen}
        onOpenChange={setInspectionFormOpen}
        equipment={selectedEquipment ? {
          id: selectedEquipment.id,
          name: selectedEquipment.name,
          internalCode: selectedEquipment.internal_code,
          type: selectedEquipment.type,
          category: selectedEquipment.categories?.name || '',
          location: selectedEquipment.location,
          unit: selectedEquipment.unit,
          lastInspection: selectedEquipment.last_inspection || '',
          status: selectedEquipment.status as any,
          serialNumber: selectedEquipment.serial_number,
          manufacturer: selectedEquipment.manufacturer,
          model: selectedEquipment.model,
          categoryId: selectedEquipment.category_id,
          manufacturingDate: selectedEquipment.manufacturing_date,
          acquisitionDate: selectedEquipment.acquisition_date,
          expiryDate: selectedEquipment.expiry_date || '',
          certificateExpiry: selectedEquipment.certificate_expiry || '',
          nextInspection: selectedEquipment.next_inspection || '',
        } : null}
      />

      {/* Equipment Detail Dialog */}
      <EquipmentDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        equipment={selectedEquipment ? {
          id: selectedEquipment.id,
          name: selectedEquipment.name,
          internalCode: selectedEquipment.internal_code,
          type: selectedEquipment.type,
          category: selectedEquipment.categories?.name || '',
          location: selectedEquipment.location,
          unit: selectedEquipment.unit,
          lastInspection: selectedEquipment.last_inspection || '',
          status: selectedEquipment.status as any,
          serialNumber: selectedEquipment.serial_number,
          manufacturer: selectedEquipment.manufacturer,
          model: selectedEquipment.model,
          capacity: selectedEquipment.capacity || '',
          categoryId: selectedEquipment.category_id,
          manufacturingDate: selectedEquipment.manufacturing_date,
          acquisitionDate: selectedEquipment.acquisition_date,
          expiryDate: selectedEquipment.expiry_date || '',
          certificateExpiry: selectedEquipment.certificate_expiry || '',
          nextInspection: selectedEquipment.next_inspection || '',
        } : null}
        onEdit={() => {
          setDetailDialogOpen(false);
          setFormMode('edit');
          setEquipmentFormOpen(true);
        }}
        onNewInspection={() => {
          setDetailDialogOpen(false);
          setInspectionFormOpen(true);
        }}
      />

      {/* Import Dialog */}
      <ImportEquipmentDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      {/* QR Code Dialog */}
      <QRCodeDialog
        open={qrCodeDialogOpen}
        onOpenChange={setQRCodeDialogOpen}
        equipment={selectedEquipment ? {
          id: selectedEquipment.id,
          name: selectedEquipment.name,
          internalCode: selectedEquipment.internal_code,
          shortCode: (selectedEquipment as any).short_code,
          categoryName: selectedEquipment.categories?.name,
          location: selectedEquipment.location,
        } : null}
      />

      {/* Advanced Filters Dialog */}
      <AdvancedFiltersDialog
        open={advancedFiltersOpen}
        onOpenChange={setAdvancedFiltersOpen}
        filters={advancedFilters}
        onApply={setAdvancedFilters}
        manufacturers={manufacturers}
        units={units}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('equipmentTable.deleteEquipment')}</AlertDialogTitle>
            <AlertDialogDescription>
              <span dangerouslySetInnerHTML={{ 
                __html: t('equipmentTable.deleteConfirmation', { name: selectedEquipment?.name }) 
              }} />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('equipmentTable.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEquipment.isPending}
            >
              {deleteEquipment.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('equipmentTable.deleting')}
                </>
              ) : (
                t('common.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}