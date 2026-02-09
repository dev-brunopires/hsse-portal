import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  FileText,
  ClipboardCheck,
  Wrench,
  Search,
  ArrowRight,
  Calendar,
  MapPin,
  User,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useEquipment } from '@/hooks/useEquipment';
import { useCertificates } from '@/hooks/useCertificates';
import { useInspections } from '@/hooks/useInspections';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { useDebounce } from '@/hooks/useDebounce';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatInspectionId, formatMaintenanceId } from '@/utils/formatId';

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);

  const { data: equipment = [], isLoading: equipmentLoading, isError: equipmentError } = useEquipment();
  const { data: certificates = [], isLoading: certificatesLoading, isError: certificatesError } = useCertificates();
  const { data: inspections = [], isLoading: inspectionsLoading, isError: inspectionsError } = useInspections();
  const { data: maintenance = [], isLoading: maintenanceLoading, isError: maintenanceError } = useMaintenanceRequests();

  const isLoading = equipmentLoading || certificatesLoading || inspectionsLoading || maintenanceLoading;
  const hasError = equipmentError || certificatesError || inspectionsError || maintenanceError;

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  // Keyboard shortcut to open (Ctrl+K / Cmd+K)
  // stopImmediatePropagation prevents the second mounted instance from also firing
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down, true);
    return () => document.removeEventListener('keydown', down, true);
  }, [open, onOpenChange]);

  const filteredResults = useMemo(() => {
    if (!debouncedSearch.trim()) return { equipment: [], certificates: [], inspections: [], maintenance: [] };

    const searchLower = debouncedSearch.toLowerCase().trim();
    const maxResults = 5;

    // Check if searching by formatted ID (INS-, MNT-)
    const isInspectionIdSearch = searchLower.startsWith('ins-') || searchLower.startsWith('ins');
    const isMaintenanceIdSearch = searchLower.startsWith('mnt-') || searchLower.startsWith('mnt');

    const filteredEquipment = equipment
      .filter(e => {
        const name = (e.name || '').toLowerCase();
        const internalCode = (e.internal_code || '').toLowerCase();
        const serialNumber = (e.serial_number || '').toLowerCase();
        const location = (e.location || '').toLowerCase();
        const shortCode = ((e as any).short_code || '').toLowerCase();
        
        return name.includes(searchLower) ||
          internalCode.includes(searchLower) ||
          serialNumber.includes(searchLower) ||
          location.includes(searchLower) ||
          shortCode.includes(searchLower);
      })
      .slice(0, maxResults);

    const filteredCertificates = certificates
      .filter(c => {
        const name = (c.name || '').toLowerCase();
        const certNumber = (c.certificate_number || '').toLowerCase();
        const equipName = (c.equipment?.name || '').toLowerCase();
        const equipCode = (c.equipment?.internal_code || '').toLowerCase();
        
        return name.includes(searchLower) ||
          certNumber.includes(searchLower) ||
          equipName.includes(searchLower) ||
          equipCode.includes(searchLower);
      })
      .slice(0, maxResults);

    const filteredInspections = inspections
      .filter(i => {
        const equipName = (i.equipment?.name || '').toLowerCase();
        const equipCode = (i.equipment?.internal_code || '').toLowerCase();
        const inspectorName = (i.profiles?.full_name || '').toLowerCase();
        const observations = (i.observations || '').toLowerCase();
        const formattedId = formatInspectionId(i.id).toLowerCase();
        const shortId = i.id.substring(0, 6).toLowerCase();
        
        // If searching by INS- prefix, prioritize ID matching
        if (isInspectionIdSearch) {
          return formattedId.includes(searchLower) || shortId.includes(searchLower.replace('ins-', '').replace('ins', ''));
        }
        
        return equipName.includes(searchLower) ||
          equipCode.includes(searchLower) ||
          inspectorName.includes(searchLower) ||
          observations.includes(searchLower) ||
          formattedId.includes(searchLower) ||
          shortId.includes(searchLower);
      })
      .slice(0, maxResults);

    const filteredMaintenance = maintenance
      .filter(m => {
        const title = (m.title || '').toLowerCase();
        const description = (m.description || '').toLowerCase();
        const equipName = (m.equipment?.name || '').toLowerCase();
        const equipCode = (m.equipment?.internal_code || '').toLowerCase();
        const formattedId = formatMaintenanceId(m.id).toLowerCase();
        const shortId = m.id.substring(0, 6).toLowerCase();
        
        // If searching by MNT- prefix, prioritize ID matching
        if (isMaintenanceIdSearch) {
          return formattedId.includes(searchLower) || shortId.includes(searchLower.replace('mnt-', '').replace('mnt', ''));
        }
        
        return title.includes(searchLower) ||
          description.includes(searchLower) ||
          equipName.includes(searchLower) ||
          equipCode.includes(searchLower) ||
          formattedId.includes(searchLower) ||
          shortId.includes(searchLower);
      })
      .slice(0, maxResults);

    return {
      equipment: filteredEquipment,
      certificates: filteredCertificates,
      inspections: filteredInspections,
      maintenance: filteredMaintenance,
    };
  }, [debouncedSearch, equipment, certificates, inspections, maintenance]);

  const hasResults = useMemo(() => {
    return (
      filteredResults.equipment.length > 0 ||
      filteredResults.certificates.length > 0 ||
      filteredResults.inspections.length > 0 ||
      filteredResults.maintenance.length > 0
    );
  }, [filteredResults]);

  const handleSelect = useCallback((type: string, id: string) => {
    onOpenChange(false);
    switch (type) {
      case 'equipment':
        navigate(`/equipment?highlight=${id}`);
        break;
      case 'certificate':
        navigate(`/certificates?highlight=${id}`);
        break;
      case 'inspection':
        navigate(`/inspections?highlight=${id}`);
        break;
      case 'maintenance':
        navigate(`/maintenance?highlight=${id}`);
        break;
    }
  }, [navigate, onOpenChange]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      active: { label: t('status.active'), className: 'bg-status-success/20 text-status-success' },
      inactive: { label: t('status.inactive'), className: 'bg-muted text-muted-foreground' },
      maintenance: { label: t('status.maintenance'), className: 'bg-status-warning/20 text-status-warning' },
      rejected: { label: t('status.rejected'), className: 'bg-status-danger/20 text-status-danger' },
      compliant: { label: t('status.compliant'), className: 'bg-status-success/20 text-status-success' },
      attention: { label: t('status.attention'), className: 'bg-status-warning/20 text-status-warning' },
      non_compliant: { label: t('status.nonCompliant'), className: 'bg-status-danger/20 text-status-danger' },
      valid: { label: t('certificates.status.valid'), className: 'bg-status-success/20 text-status-success' },
      expired: { label: t('certificates.status.expired'), className: 'bg-status-danger/20 text-status-danger' },
      expiring_soon: { label: t('certificates.status.expiringSoon'), className: 'bg-status-warning/20 text-status-warning' },
      pending: { label: t('maintenance.status.pending'), className: 'bg-status-warning/20 text-status-warning' },
      approved: { label: t('maintenance.status.approved'), className: 'bg-status-info/20 text-status-info' },
      in_progress: { label: t('maintenance.status.in_progress'), className: 'bg-primary/20 text-primary' },
      completed: { label: t('maintenance.status.completed'), className: 'bg-status-success/20 text-status-success' },
    };
    const config = statusConfig[status] || { label: status, className: 'bg-muted text-muted-foreground' };
    return <Badge variant="outline" className={cn('text-xs', config.className)}>{config.label}</Badge>;
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder={t('globalSearch.placeholder')} 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {/* Loading state */}
        {isLoading && debouncedSearch.trim() && (
          <div className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('globalSearch.loading', 'Buscando...')}</span>
          </div>
        )}

        {/* Error state */}
        {hasError && !isLoading && (
          <div className="flex flex-col items-center justify-center gap-2 py-6">
            <AlertCircle className="h-8 w-8 text-status-danger" />
            <p className="text-sm text-muted-foreground">{t('globalSearch.error', 'Erro ao carregar dados. Tente novamente.')}</p>
          </div>
        )}

        {/* Empty state - no search */}
        {!debouncedSearch.trim() && !isLoading && (
          <CommandEmpty className="py-6 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">{t('globalSearch.hint')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{t('globalSearch.shortcut')}</p>
            <p className="text-xs text-muted-foreground/50 mt-2">
              {t('globalSearch.searchTip', 'Busque por nome, código, INS-XXXXXX ou MNT-XXXXXX')}
            </p>
          </CommandEmpty>
        )}

        {/* No results */}
        {debouncedSearch.trim() && !hasResults && !isLoading && !hasError && (
          <CommandEmpty>{t('globalSearch.noResults')}</CommandEmpty>
        )}

        {/* Results */}
        {!isLoading && !hasError && (
          <>
            {filteredResults.equipment.length > 0 && (
              <>
                <CommandGroup heading={t('globalSearch.equipment')}>
                  {filteredResults.equipment.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`equipment-${item.id}`}
                      onSelect={() => handleSelect('equipment', item.id)}
                      className="flex items-center justify-between gap-2 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{item.internal_code}</span>
                            {(item as any).short_code && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{(item as any).short_code}</span>
                              </>
                            )}
                            {item.location && (
                              <>
                                <span>•</span>
                                <MapPin className="h-3 w-3" />
                                <span>{item.location}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(item.status)}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {filteredResults.certificates.length > 0 && (
              <>
                <CommandGroup heading={t('globalSearch.certificates')}>
                  {filteredResults.certificates.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`certificate-${item.id}`}
                      onSelect={() => handleSelect('certificate', item.id)}
                      className="flex items-center justify-between gap-2 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                          <FileText className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{item.equipment?.name || '-'}</span>
                            {item.expiry_date && (
                              <>
                                <span>•</span>
                                <Calendar className="h-3 w-3" />
                                <span>{format(new Date(item.expiry_date), 'dd/MM/yyyy')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(item.status)}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {filteredResults.inspections.length > 0 && (
              <>
                <CommandGroup heading={t('globalSearch.inspections')}>
                  {filteredResults.inspections.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`inspection-${item.id}`}
                      onSelect={() => handleSelect('inspection', item.id)}
                      className="flex items-center justify-between gap-2 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
                          <ClipboardCheck className="h-4 w-4 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {item.equipment?.name || t('globalSearch.unknownEquipment')}
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              {formatInspectionId(item.id)}
                            </span>
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(item.inspection_date), 'dd/MM/yyyy')}</span>
                            {item.profiles?.full_name && (
                              <>
                                <span>•</span>
                                <User className="h-3 w-3" />
                                <span>{item.profiles.full_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(item.status)}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {filteredResults.maintenance.length > 0 && (
              <CommandGroup heading={t('globalSearch.maintenance')}>
                {filteredResults.maintenance.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`maintenance-${item.id}`}
                    onSelect={() => handleSelect('maintenance', item.id)}
                    className="flex items-center justify-between gap-2 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
                        <Wrench className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {item.title}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {formatMaintenanceId(item.id)}
                          </span>
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{item.equipment?.name || '-'}</span>
                          {item.requested_at && (
                            <>
                              <span>•</span>
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(item.requested_at), 'dd/MM/yyyy')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(item.status)}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
