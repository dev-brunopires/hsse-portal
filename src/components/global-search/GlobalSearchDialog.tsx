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
  Ship,
} from 'lucide-react';
import { useEquipment } from '@/hooks/useEquipment';
import { useCertificates } from '@/hooks/useCertificates';
import { useInspections } from '@/hooks/useInspections';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { useDebounce } from '@/hooks/useDebounce';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);

  const { data: equipment = [] } = useEquipment();
  const { data: certificates = [] } = useCertificates();
  const { data: inspections = [] } = useInspections();
  const { data: maintenance = [] } = useMaintenanceRequests();

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  // Keyboard shortcut to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const filteredResults = useMemo(() => {
    if (!debouncedSearch.trim()) return { equipment: [], certificates: [], inspections: [], maintenance: [] };

    const searchLower = debouncedSearch.toLowerCase();
    const maxResults = 5;

    const filteredEquipment = equipment
      .filter(e => 
        e.name.toLowerCase().includes(searchLower) ||
        e.internal_code.toLowerCase().includes(searchLower) ||
        e.serial_number?.toLowerCase().includes(searchLower) ||
        e.location?.toLowerCase().includes(searchLower) ||
        (e as any).short_code?.toLowerCase().includes(searchLower)
      )
      .slice(0, maxResults);

    const filteredCertificates = certificates
      .filter(c => 
        c.name.toLowerCase().includes(searchLower) ||
        c.certificate_number?.toLowerCase().includes(searchLower) ||
        c.equipment?.name.toLowerCase().includes(searchLower) ||
        c.equipment?.internal_code.toLowerCase().includes(searchLower)
      )
      .slice(0, maxResults);

    const filteredInspections = inspections
      .filter(i => 
        i.equipment?.name.toLowerCase().includes(searchLower) ||
        i.equipment?.internal_code.toLowerCase().includes(searchLower) ||
        i.profiles?.full_name.toLowerCase().includes(searchLower) ||
        i.observations?.toLowerCase().includes(searchLower)
      )
      .slice(0, maxResults);

    const filteredMaintenance = maintenance
      .filter(m => 
        m.title.toLowerCase().includes(searchLower) ||
        m.description?.toLowerCase().includes(searchLower) ||
        m.equipment?.name.toLowerCase().includes(searchLower) ||
        m.equipment?.internal_code.toLowerCase().includes(searchLower)
      )
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
        {!debouncedSearch.trim() && (
          <CommandEmpty className="py-6 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">{t('globalSearch.hint')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{t('globalSearch.shortcut')}</p>
          </CommandEmpty>
        )}

        {debouncedSearch.trim() && !hasResults && (
          <CommandEmpty>{t('globalSearch.noResults')}</CommandEmpty>
        )}

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
                      <p className="font-medium">{item.equipment?.name || t('globalSearch.unknownEquipment')}</p>
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
                    <p className="font-medium">{item.title}</p>
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
      </CommandList>
    </CommandDialog>
  );
}
