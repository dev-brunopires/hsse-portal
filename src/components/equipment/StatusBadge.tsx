import { cn } from '@/lib/utils';
import { EquipmentStatus } from '@/types/equipment';

interface StatusBadgeProps {
  status: EquipmentStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<EquipmentStatus, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'status-active' },
  maintenance: { label: 'Em Manutenção', className: 'status-warning' },
  expired: { label: 'Vencido', className: 'status-danger' },
  rejected: { label: 'Reprovado', className: 'status-danger' },
  inactive: { label: 'Inativo', className: 'bg-muted text-muted-foreground' },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={cn(
      'status-badge',
      config.className,
      size === 'sm' && 'px-2 py-0.5 text-xs'
    )}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        status === 'active' && 'bg-status-success',
        status === 'maintenance' && 'bg-status-warning',
        (status === 'expired' || status === 'rejected') && 'bg-status-danger',
        status === 'inactive' && 'bg-muted-foreground'
      )} />
      {config.label}
    </span>
  );
}
