import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ClipboardCheck, 
  Search, 
  Package,
  MapPin,
  Calendar,
  ArrowRight,
  Filter,
  AlertTriangle,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { useEquipment, type EquipmentWithCategory } from '@/hooks/useEquipment';
import { getLocalToday } from '@/utils/dateFormat';
import { useCategories } from '@/hooks/useCategories';
import { useLastInspection } from '@/hooks/useInspections';
import { fetchPendingInspectionById, type PendingInspection } from '@/hooks/usePendingInspections';
import { useOfflineSync, CachedEquipment, CachedCategory, CachedTemplate, CachedLastInspection } from '@/hooks/useOfflineSync';
import { InspectionFormDialog } from '@/components/equipment/InspectionFormDialog';
import { PreInspectionWarningDialog } from './PreInspectionWarningDialog';
import { ConnectionStatus } from '@/components/ui/connection-status';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import i18n from '@/i18n';
import type { Equipment } from '@/types/equipment';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface NewInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedEquipmentId?: string | null;
  pendingInspectionId?: string | null;
}

export function NewInspectionDialog({ open, onOpenChange, preSelectedEquipmentId, pendingInspectionId }: NewInspectionDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const dateLocale = i18n.language === 'pt-BR' ? ptBR : enUS;
  
  // Offline sync hook
  const { isOnline, getOfflineData, isCacheAvailable, getLastInspectionOffline } = useOfflineSync();
  
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

  // Online data hooks
  const { data: onlineEquipmentList = [], isLoading: isLoadingOnline } = useEquipment();
  const { data: onlineCategories = [] } = useCategories();
  
  // Offline data state
  const [offlineEquipment, setOfflineEquipment] = useState<CachedEquipment[]>([]);
  const [offlineCategories, setOfflineCategories] = useState<CachedCategory[]>([]);
  const [offlineTemplates, setOfflineTemplates] = useState<CachedTemplate[]>([]);
  const [offlineLastInspections, setOfflineLastInspections] = useState<CachedLastInspection[]>([]);
  const [isLoadingOffline, setIsLoadingOffline] = useState(false);
  const [cacheAvailable, setCacheAvailable] = useState(false);
  
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithCategory | null>(null);
  const [pendingEquipment, setPendingEquipment] = useState<EquipmentWithCategory | null>(null);
  const [pendingOfflineEquipment, setPendingOfflineEquipment] = useState<CachedEquipment | null>(null);
  const [offlineLastInspection, setOfflineLastInspection] = useState<CachedLastInspection | null>(null);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [pendingData, setPendingData] = useState<PendingInspection | null>(null);

  useEffect(() => {
    if (open && pendingInspectionId) {
      fetchPendingInspectionById(pendingInspectionId).then(setPendingData).catch(() => setPendingData(null));
    } else if (!open) {
      setPendingData(null);
    }
  }, [open, pendingInspectionId]);

  // Fetch last inspection for pending equipment to check for warnings (only when online)
  const { data: lastInspection } = useLastInspection(isOnline ? pendingEquipment?.id : undefined);

  // Load offline data when not online and dialog opens
  useEffect(() => {
    const loadOfflineData = async () => {
      if (!isOnline && open) {
        setIsLoadingOffline(true);
        try {
          const [available, data] = await Promise.all([
            isCacheAvailable(),
            getOfflineData(),
          ]);
          setCacheAvailable(available);
          if (data) {
            setOfflineEquipment(data.equipment || []);
            setOfflineCategories(data.categories || []);
            setOfflineTemplates(data.templates || []);
            setOfflineLastInspections(data.lastInspections || []);
          }
        } catch (error) {
          console.error('[NewInspectionDialog] Error loading offline data:', error);
        } finally {
          setIsLoadingOffline(false);
        }
      }
    };
    loadOfflineData();
  }, [isOnline, open, getOfflineData, isCacheAvailable]);

  // Helper to convert CachedEquipment to EquipmentWithCategory
  const convertCachedToEquipmentWithCategory = (eq: CachedEquipment): EquipmentWithCategory => ({
    ...eq,
    type: '',
    unit: '',
    manufacturer: null,
    model: null,
    manufacturing_date: null,
    acquisition_date: null,
    expiry_date: null,
    certificate_expiry: null,
    last_inspection: null,
    next_inspection: null,
    capacity: null,
    observations: null,
    created_at: '',
    updated_at: '',
    created_by: null,
    short_code: (eq as any).short_code || null,
    categories: offlineCategories.find(c => c.id === eq.category_id) 
      ? { name: offlineCategories.find(c => c.id === eq.category_id)!.name, icon: '' }
      : null,
    ships: null,
  } as unknown as EquipmentWithCategory);

  // Determine which equipment list to use
  const equipmentList = useMemo(() => {
    if (isOnline) {
      return onlineEquipmentList;
    }
    return offlineEquipment.map(eq => convertCachedToEquipmentWithCategory(eq));
  }, [isOnline, onlineEquipmentList, offlineEquipment, offlineCategories]);

  // Categories to use
  const categories = useMemo(() => {
    return isOnline ? onlineCategories : offlineCategories;
  }, [isOnline, onlineCategories, offlineCategories]);

  const isLoading = isOnline ? isLoadingOnline : isLoadingOffline;

  // Auto-select equipment when preSelectedEquipmentId is provided (from QR scan)
  useEffect(() => {
    if (open && preSelectedEquipmentId && equipmentList.length > 0 && !hasAutoSelected) {
      let equipment = equipmentList.find(eq => eq.id === preSelectedEquipmentId);
      
      if (!equipment) {
        equipment = equipmentList.find(eq => (eq as any).short_code === preSelectedEquipmentId);
      }
      
      if (equipment) {
        console.log('[NewInspectionDialog] Auto-selecting equipment:', equipment.internal_code, 'Online:', isOnline);
        setHasAutoSelected(true);
        
        if (isOnline) {
          setPendingEquipment(equipment);
        } else {
          const offlineEq = offlineEquipment.find(e => e.id === equipment!.id);
          if (offlineEq) {
            const cachedLastInsp = offlineLastInspections.find(i => i.equipment_id === offlineEq.id);
            if (cachedLastInsp) {
              const hasIssues = cachedLastInsp.status === 'attention' || cachedLastInsp.status === 'non-compliant';
              const hasRecommendations = cachedLastInsp.recommendations && cachedLastInsp.recommendations.trim().length > 0;
              
              if (hasIssues || hasRecommendations) {
                setPendingOfflineEquipment(offlineEq);
                setOfflineLastInspection(cachedLastInsp);
                setWarningDialogOpen(true);
                return;
              }
            }
            // No warnings, proceed directly with unified form
            setSelectedEquipment(convertCachedToEquipmentWithCategory(offlineEq));
            setInspectionDialogOpen(true);
          }
        }
      } else {
        console.log('[NewInspectionDialog] Equipment not found for ID:', preSelectedEquipmentId);
      }
    }
  }, [open, preSelectedEquipmentId, equipmentList, hasAutoSelected, isOnline, offlineEquipment]);

  // Reset auto-selection flag when dialog closes
  useEffect(() => {
    if (!open) {
      setHasAutoSelected(false);
    }
  }, [open]);

  const filteredEquipment = useMemo(() => {
    if (!equipmentList || !Array.isArray(equipmentList)) return [];
    
    return equipmentList.filter(eq => {
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
    const today = getLocalToday();
    const isCertificateExpired = equipment.certificate_expiry && equipment.certificate_expiry < today;
    const isInspectionOverdue = equipment.next_inspection && equipment.next_inspection < today;
    const isEquipmentExpired = equipment.expiry_date && equipment.expiry_date < today;
    const isStatusCritical = equipment.status === 'expired' || equipment.status === 'rejected';
    
    return !!(isCertificateExpired || isInspectionOverdue || isEquipmentExpired || isStatusCritical);
  };

  // Effect to check if we need to show warning when last inspection data is loaded (only online)
  useEffect(() => {
    if (isOnline && pendingEquipment && lastInspection !== undefined) {
      const hasEquipmentWarnings = checkEquipmentWarnings(pendingEquipment);
      const hasRecommendations = lastInspection?.recommendations && lastInspection.recommendations.trim().length > 0;
      const lastInspectionHadIssues = lastInspection?.status === 'attention' || lastInspection?.status === 'non-compliant';
      
      if (hasEquipmentWarnings || hasRecommendations || lastInspectionHadIssues) {
        setWarningDialogOpen(true);
      } else {
        setSelectedEquipment(pendingEquipment);
        setInspectionDialogOpen(true);
        setPendingEquipment(null);
      }
    }
  }, [isOnline, pendingEquipment, lastInspection]);

  const handleSelectEquipment = (equipment: EquipmentWithCategory) => {
    if (isOnline) {
      setPendingEquipment(equipment);
    } else {
      const offlineEq = offlineEquipment.find(e => e.id === equipment.id);
      if (offlineEq) {
        const cachedLastInsp = offlineLastInspections.find(i => i.equipment_id === offlineEq.id);
        if (cachedLastInsp) {
          const hasIssues = cachedLastInsp.status === 'attention' || cachedLastInsp.status === 'non-compliant';
          const hasRecommendations = cachedLastInsp.recommendations && cachedLastInsp.recommendations.trim().length > 0;
          
          if (hasIssues || hasRecommendations) {
            setPendingOfflineEquipment(offlineEq);
            setOfflineLastInspection(cachedLastInsp);
            setWarningDialogOpen(true);
            return;
          }
        }
        // No warnings, proceed directly with unified form
        setSelectedEquipment(convertCachedToEquipmentWithCategory(offlineEq));
        setInspectionDialogOpen(true);
      }
    }
  };

  const handleWarningProceed = () => {
    if (isOnline && pendingEquipment) {
      setSelectedEquipment(pendingEquipment);
      setWarningDialogOpen(false);
      setInspectionDialogOpen(true);
      setPendingEquipment(null);
    } else if (!isOnline && pendingOfflineEquipment) {
      // Offline mode: proceed to the same unified inspection form
      setSelectedEquipment(convertCachedToEquipmentWithCategory(pendingOfflineEquipment));
      setWarningDialogOpen(false);
      setInspectionDialogOpen(true);
      setPendingOfflineEquipment(null);
      setOfflineLastInspection(null);
    }
  };

  const handleWarningClose = (isOpen: boolean) => {
    setWarningDialogOpen(isOpen);
    if (!isOpen) {
      setPendingEquipment(null);
      setPendingOfflineEquipment(null);
      setOfflineLastInspection(null);
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

  // Show no cache message when offline and no cache available
  if (!isOnline && !cacheAvailable && !isLoadingOffline) {
    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title={t('inspectionForm.newInspection')}
        description={t('inspectionForm.selectEquipmentToInspect')}
        titleIcon={<ClipboardCheck className="h-5 w-5 text-primary" />}
        className="max-w-2xl"
      >
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-full bg-status-warning/10 mb-4">
            <WifiOff className="h-8 w-8 text-status-warning" />
          </div>
          <h3 className="font-semibold text-lg mb-2">{t('offline.noCache')}</h3>
          <p className="text-muted-foreground max-w-sm">
            {t('offline.noCacheDesc')}
          </p>
        </div>
      </ResponsiveDialog>
    );
  }

  return (
    <>
      <ResponsiveDialog
        open={open && !inspectionDialogOpen}
        onOpenChange={onOpenChange}
        title={t('inspectionForm.newInspection')}
        description={t('inspectionForm.selectEquipmentToInspect')}
        titleIcon={<ClipboardCheck className="h-5 w-5 text-primary" />}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-3 pb-2">
          {/* Connection status indicator - minimalist */}
          <ConnectionStatus isOnline={isOnline} />
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('inspectionForm.searchByCodeNameLocation')}
                className="pl-10"
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

          <ScrollArea className={cn(isMobile ? 'h-[50vh]' : 'h-[400px]')}>
            <div className="space-y-2">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin mb-2" />
                  {t('inspectionForm.loadingEquipment')}
                </div>
              ) : filteredEquipment.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm || categoryFilter !== 'all' ? t('inspectionForm.noEquipmentFound') : t('inspectionForm.noEquipmentRegistered')}
                </div>
              ) : (
                filteredEquipment.map((equipment) => {
                  const hasEquipmentWarnings = checkEquipmentWarnings(equipment);
                  
                  let hasOfflineWarnings = false;
                  let offlineWarningType: 'recommendation' | 'attention' | 'non-compliant' | null = null;
                  if (!isOnline) {
                    const cachedInsp = offlineLastInspections.find(i => i.equipment_id === equipment.id);
                    if (cachedInsp) {
                      if (cachedInsp.status === 'non-compliant') {
                        hasOfflineWarnings = true;
                        offlineWarningType = 'non-compliant';
                      } else if (cachedInsp.status === 'attention') {
                        hasOfflineWarnings = true;
                        offlineWarningType = 'attention';
                      } else if (cachedInsp.recommendations && cachedInsp.recommendations.trim().length > 0) {
                        hasOfflineWarnings = true;
                        offlineWarningType = 'recommendation';
                      }
                    }
                  }
                  
                  const hasWarnings = isOnline ? hasEquipmentWarnings : (hasEquipmentWarnings || hasOfflineWarnings);
                  return (
                    <div
                      key={equipment.id}
                      className={cn(
                        'p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group',
                        hasWarnings ? 'border-warning/50 bg-warning/5' : 'border-border'
                      )}
                      onClick={() => handleSelectEquipment(equipment)}
                    >
                      <div className="flex items-start sm:items-center justify-between gap-2">
                        <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className={cn(
                            'h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shrink-0',
                            hasWarnings ? 'bg-warning/10' : 'bg-primary/10'
                          )}>
                            {hasWarnings ? (
                              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                            ) : (
                              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                              <span className="font-medium text-sm sm:text-base truncate">{equipment.name}</span>
                              <Badge variant="outline" className="font-mono text-xs">
                                {equipment.internal_code}
                              </Badge>
                              {hasWarnings && (
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    offlineWarningType === 'non-compliant' 
                                      ? "border-status-danger text-status-danger bg-status-danger/10"
                                      : offlineWarningType === 'attention'
                                      ? "border-status-warning text-status-warning bg-status-warning/10"
                                      : "border-warning text-warning bg-warning/10"
                                  )}
                                >
                                  {offlineWarningType === 'non-compliant' 
                                    ? t('equipment.statusRejected')
                                    : offlineWarningType === 'recommendation'
                                    ? t('inspectionForm.hasRecommendations')
                                    : t('inspectionForm.attention')}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {equipment.location}
                              </span>
                              {!isMobile && equipment.categories?.name && (
                                <span className="text-xs px-2 py-0.5 bg-muted rounded">
                                  {equipment.categories.name}
                                </span>
                              )}
                              {equipment.last_inspection && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(equipment.last_inspection), 'dd/MM/yy', { locale: dateLocale })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3">
                          <Badge 
                            variant="outline" 
                            className={cn('text-xs', statusColors[equipment.status] || statusColors.active)}
                          >
                            {statusLabels[equipment.status] || equipment.status}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="text-sm text-muted-foreground border-t pt-2">
            {t('inspectionForm.equipmentAvailable', { count: filteredEquipment.length })}
          </div>
        </div>
      </ResponsiveDialog>

      {/* Warning Dialog - works for both online and offline */}
      {isOnline && pendingEquipment && (
        <PreInspectionWarningDialog
          open={warningDialogOpen}
          onOpenChange={handleWarningClose}
          equipment={pendingEquipment}
          lastInspection={lastInspection || null}
          onProceed={handleWarningProceed}
        />
      )}

      {/* Offline Warning Dialog - using cached last inspection */}
      {!isOnline && pendingOfflineEquipment && offlineLastInspection && (
        <PreInspectionWarningDialog
          open={warningDialogOpen}
          onOpenChange={handleWarningClose}
          equipment={convertCachedToEquipmentWithCategory(pendingOfflineEquipment)}
          lastInspection={{
            id: offlineLastInspection.id,
            equipment_id: offlineLastInspection.equipment_id,
            inspection_date: offlineLastInspection.inspection_date,
            status: offlineLastInspection.status,
            observations: offlineLastInspection.observations,
            recommendations: offlineLastInspection.recommendations,
            actions_taken: offlineLastInspection.actions_taken,
            inspector_id: '',
            ship_id: null,
            signature_data: null,
            signed_at: null,
            next_inspection_date: null,
            created_at: '',
          } as any}
          onProceed={handleWarningProceed}
        />
      )}

      {/* Unified Inspection Form Dialog - works for both online and offline */}
      {selectedEquipment && (
        <InspectionFormDialog
          open={inspectionDialogOpen}
          onOpenChange={handleInspectionClose}
          equipment={convertToEquipmentType(selectedEquipment)}
          onSuccess={handleInspectionSuccess}
          carryoverItems={pendingData?.carryover_items}
          carryoverRecommendations={pendingData?.carryover_recommendations}
        />
      )}
    </>
  );
}
