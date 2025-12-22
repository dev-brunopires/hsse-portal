import { cn } from '@/lib/utils';
import { EquipmentStatus } from '@/types/equipment';
import { getEffectiveEquipmentStatus, type EquipmentWithDates } from '@/utils/equipmentStatus';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StatusBadgeProps {
  status: EquipmentStatus;
  size?: 'sm' | 'md';
  equipment?: EquipmentWithDates;
  showAutoRejectedReason?: boolean;
}

export function StatusBadge({ status, size = 'md', equipment, showAutoRejectedReason = true }: StatusBadgeProps) {
  const { t } = useTranslation();
  
  const statusConfig: Record<EquipmentStatus, { label: string; className: string }> = {
    active: { label: t('equipment.statusActive'), className: 'status-active' },
    maintenance: { label: t('equipment.statusMaintenance'), className: 'status-warning' },
    expired: { label: t('equipment.statusExpired'), className: 'status-danger' },
    rejected: { label: t('equipment.statusRejected'), className: 'status-danger' },
    inactive: { label: t('equipment.statusInactive'), className: 'bg-muted text-muted-foreground' },
  };
  
  // If equipment data is provided, calculate effective status
  const effectiveResult = equipment ? getEffectiveEquipmentStatus(equipment) : null;
  const effectiveStatus = effectiveResult?.effectiveStatus || status;
  const isAutoRejected = effectiveResult?.isAutoRejected || false;
  const reasonKeys = effectiveResult?.reasonKeys || [];

  const config = statusConfig[effectiveStatus];
  
  const badge = (
    <span className={cn(
      'status-badge',
      config.className,
      size === 'sm' && 'px-2 py-0.5 text-xs',
      isAutoRejected && 'ring-2 ring-red-500/30'
    )}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        effectiveStatus === 'active' && 'bg-status-success',
        effectiveStatus === 'maintenance' && 'bg-status-warning',
        (effectiveStatus === 'expired' || effectiveStatus === 'rejected') && 'bg-status-danger',
        effectiveStatus === 'inactive' && 'bg-muted-foreground'
      )} />
      {config.label}
      {isAutoRejected && <AlertTriangle className="h-3 w-3 ml-1" />}
    </span>
  );

  // Show tooltip with reasons if auto-rejected
  if (isAutoRejected && showAutoRejectedReason && reasonKeys.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-sm">
              <p className="font-semibold mb-1">{t('statusBadge.autoRejected')}:</p>
              <ul className="list-disc list-inside">
                {reasonKeys.map((reasonKey, i) => (
                  <li key={i}>{t(reasonKey)}</li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}