import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  ClipboardCheck, 
  Search, 
  Package,
  MapPin,
  Calendar,
  ArrowRight,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { useEquipment, type EquipmentWithCategory } from '@/hooks/useEquipment';
import { useCategories } from '@/hooks/useCategories';
import { useLastInspection } from '@/hooks/useInspections';
import { InspectionFormDialog } from '@/components/equipment/InspectionFormDialog';
import { PreInspectionWarningDialog } from './PreInspectionWarningDialog';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import i18n from '@/i18n';
import type { Equipment } from '@/types/equipment';

interface NewInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedEquipmentId?: string | null;
}

export function NewInspectionDialog({ open, onOpenChange, preSelectedEquipmentId }: NewInspectionDialogProps) {
  const { t } = useTranslation();
  const dateLocale = i18n.language === 'pt-BR' ? ptBR : enUS;
  
  const statusLabels: Record<string, string> = {
    active: t('inspectionForm.statusLabels.active'),
    inactive: t('inspectionForm.statusLabels.inactive'),
    maintenance: t('inspectionForm.statusLabels.maintenance'),
    rejected: t('inspectionForm.statusLabels.rejected'),
  };

  const statusColors: Record<string, string> = {
    active: 'bg-status-success/10 text-status-success border-status-success/30',
    inactive: 'bg-muted text-muted-foreground border-muted',
    maintenance: 'bg-status-warning/10 text-status-warning border-status-warning/30',
    rejected: 'bg-status-danger/10 text-status-danger border-status-danger/30',
  };

  const { data: equipmentList = [], isLoading } = useEquipment();
  const { data: categories = [] } = useCategories();
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithCategory | null>(null);
  const [pendingEquipment, setPendingEquipment] = useState<EquipmentWithCategory | null>(null);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // Fetch last inspection for pending equipment to check for warnings
  const { data: lastInspection } = useLastInspection(pendingEquipment?.id);

  // Auto-select equipment when preSelectedEquipmentId is provided (from QR scan)
  useEffect(() => {
    if (open && preSelectedEquipmentId && equipmentList.length > 0 && !hasAutoSelected) {
      // Try to find by ID first
      let equipment = equipmentList.find(eq => eq.id === preSelectedEquipmentId);
      
      // If not found by ID, try by short_code (for manual search by 6-digit code)
      if (!equipment) {
        equipment = equipmentList.find(eq => (eq as any).short_code === preSelectedEquipmentId);
      }
      
      if (equipment) {
        console.log('[NewInspectionDialog] Auto-selecting equipment:', equipment.internal_code);
        setHasAutoSelected(true);
        // Trigger the selection flow (which will check for warnings)
        setPendingEquipment(equipment);
      } else {
        console.log('[NewInspectionDialog] Equipment not found for ID:', preSelectedEquipmentId);
      }
    }
  }, [open, preSelectedEquipmentId, equipmentList, hasAutoSelected]);

  // Reset auto-selection flag when dialog closes
  useEffect(() => {
    if (!open) {
      setHasAutoSelected(false);
    }
  }, [open]);

  const filteredEquipment = useMemo(() => {
    if (!equipmentList || !Array.isArray(equipmentList)) return [];
    
    return equipmentList.filter(eq => {
      // Include short_code in search for quick lookup
      const shortCode = (eq as any).short_code || '';
      const matchesSearch = 
        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.internal_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shortCode.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || eq.category_id === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [equipmentList, searchTerm, categoryFilter]);

  // Check if equipment has any warnings
  const checkEquipmentWarnings = (equipment: EquipmentWithCategory): boolean => {
    const today = new Date().toISOString().split('T')[0];
    const isCertificateExpired = equipment.certificate_expiry && equipment.certificate_expiry < today;
    const isInspectionOverdue = equipment.next_inspection && equipment.next_inspection < today;
    const isEquipmentExpired = equipment.expiry_date && equipment.expiry_date < today;
    const isStatusCritical = equipment.status === 'expired' || equipment.status === 'rejected';
    
    return !!(isCertificateExpired || isInspectionOverdue || isEquipmentExpired || isStatusCritical);
  };

  // Effect to check if we need to show warning when last inspection data is loaded
  useEffect(() => {
    if (pendingEquipment && lastInspection !== undefined) {
      const hasEquipmentWarnings = checkEquipmentWarnings(pendingEquipment);
      const hasRecommendations = lastInspection?.recommendations && lastInspection.recommendations.trim().length > 0;
      const lastInspectionHadIssues = lastInspection?.status === 'attention' || lastInspection?.status === 'non-compliant';
      
      if (hasEquipmentWarnings || hasRecommendations || lastInspectionHadIssues) {
        setWarningDialogOpen(true);
      } else {
        // No warnings, proceed directly to inspection form
        setSelectedEquipment(pendingEquipment);
        setInspectionDialogOpen(true);
        setPendingEquipment(null);
      }
    }
  }, [pendingEquipment, lastInspection]);

  const handleSelectEquipment = (equipment: EquipmentWithCategory) => {
    // Set pending equipment to trigger last inspection fetch
    setPendingEquipment(equipment);
  };

  const handleWarningProceed = () => {
    if (pendingEquipment) {
      setSelectedEquipment(pendingEquipment);
      setWarningDialogOpen(false);
      setInspectionDialogOpen(true);
      setPendingEquipment(null);
    }
  };

  const handleWarningClose = (isOpen: boolean) => {
    setWarningDialogOpen(isOpen);
    if (!isOpen) {
      setPendingEquipment(null);
    }
  };

  const handleInspectionSuccess = () => {
    setSelectedEquipment(null);
    setInspectionDialogOpen(false);
    onOpenChange(false);
  };

  const handleInspectionClose = (isOpen: boolean) => {
    setInspectionDialogOpen(isOpen);
    if (!isOpen) {
      setSelectedEquipment(null);
    }
  };

  // Convert database equipment to the Equipment type expected by InspectionFormDialog
  const convertToEquipmentType = (eq: EquipmentWithCategory): Equipment => ({
    id: eq.id,
    internalCode: eq.internal_code,
    name: eq.name,
    type: eq.type,
    categoryId: eq.category_id,
    categoryName: eq.categories?.name || '',
    manufacturer: eq.manufacturer,
    model: eq.model,
    serialNumber: eq.serial_number,
    manufacturingDate: eq.manufacturing_date,
    acquisitionDate: eq.acquisition_date,
    expiryDate: eq.expiry_date || '',
    certificateExpiry: eq.certificate_expiry || '',
    location: eq.location,
    unit: eq.unit,
    status: eq.status as 'active' | 'inactive' | 'maintenance' | 'rejected',
    lastInspection: eq.last_inspection || '',
    nextInspection: eq.next_inspection || '',
    capacity: eq.capacity || undefined,
  });

  return (
    <>
      <Dialog open={open && !inspectionDialogOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border border-border">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              {t('inspectionForm.newInspection')}
            </DialogTitle>
            <DialogDescription>
              {t('inspectionForm.selectEquipmentToInspect')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex flex-col sm:flex-row gap-3 py-4 px-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder={t('inspectionForm.searchByCodeNameLocation')}
                  className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('common.category')} />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  <SelectItem value="all">{t('inspectionForm.allCategories')}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-2 px-1">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('inspectionForm.loadingEquipment')}
                  </div>
                ) : filteredEquipment.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm || categoryFilter !== 'all' ? t('inspectionForm.noEquipmentFound') : t('inspectionForm.noEquipmentRegistered')}
                  </div>
                ) : (
                  filteredEquipment.map((equipment) => {
                    const hasWarnings = checkEquipmentWarnings(equipment);
                    return (
                      <div
                        key={equipment.id}
                        className={`p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group ${
                          hasWarnings ? 'border-warning/50 bg-warning/5' : 'border-border'
                        }`}
                        onClick={() => handleSelectEquipment(equipment)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              hasWarnings ? 'bg-warning/10' : 'bg-primary/10'
                            }`}>
                              {hasWarnings ? (
                                <AlertTriangle className="h-5 w-5 text-warning" />
                              ) : (
                                <Package className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{equipment.name}</span>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {equipment.internal_code}
                                </Badge>
                                {hasWarnings && (
                                  <Badge variant="outline" className="text-xs border-warning text-warning bg-warning/10">
                                    {t('inspectionForm.attention')}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {equipment.location}
                                </span>
                                {equipment.categories?.name && (
                                  <span className="text-xs px-2 py-0.5 bg-muted rounded">
                                    {equipment.categories.name}
                                  </span>
                                )}
                                {equipment.last_inspection && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {t('inspectionForm.last')}: {format(new Date(equipment.last_inspection), 'dd/MM/yy', { locale: dateLocale })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge 
                              variant="outline" 
                              className={statusColors[equipment.status] || statusColors.active}
                            >
                              {statusLabels[equipment.status] || equipment.status}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <div className="pt-4 border-t border-border text-sm text-muted-foreground px-1">
              {t('inspectionForm.equipmentAvailable', { count: filteredEquipment.length })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Warning Dialog */}
      {pendingEquipment && (
        <PreInspectionWarningDialog
          open={warningDialogOpen}
          onOpenChange={handleWarningClose}
          equipment={pendingEquipment}
          lastInspection={lastInspection || null}
          onProceed={handleWarningProceed}
        />
      )}

      {/* Inspection Form Dialog */}
      {selectedEquipment && (
        <InspectionFormDialog
          open={inspectionDialogOpen}
          onOpenChange={handleInspectionClose}
          equipment={convertToEquipmentType(selectedEquipment)}
          onSuccess={handleInspectionSuccess}
        />
      )}
    </>
  );
}
