import { cn } from '@/lib/utils';
import { EquipmentStatus } from '@/types/equipment';
import { getEffectiveEquipmentStatus, type EquipmentWithDates } from '@/utils/equipmentStatus';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';

interface StatusBadgeProps {
  status: EquipmentStatus;
  size?: 'sm' | 'md';
  equipment?: EquipmentWithDates;
  showAutoRejectedReason?: boolean;
}

const statusConfig: Record<EquipmentStatus, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'status-active' },
  maintenance: { label: 'Em Manutenção', className: 'status-warning' },
  expired: { label: 'Vencido', className: 'status-danger' },
  rejected: { label: 'Reprovado', className: 'status-danger' },
  inactive: { label: 'Inativo', className: 'bg-muted text-muted-foreground' },
};

export function StatusBadge({ status, size = 'md', equipment, showAutoRejectedReason = true }: StatusBadgeProps) {
  // If equipment data is provided, calculate effective status
  const effectiveResult = equipment ? getEffectiveEquipmentStatus(equipment) : null;
  const effectiveStatus = effectiveResult?.effectiveStatus || status;
  const isAutoRejected = effectiveResult?.isAutoRejected || false;
  const reasons = effectiveResult?.reasons || [];

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
  if (isAutoRejected && showAutoRejectedReason && reasons.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-sm">
              <p className="font-semibold mb-1">Reprovado automaticamente:</p>
              <ul className="list-disc list-inside">
                {reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
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
