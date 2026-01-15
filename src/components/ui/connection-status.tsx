import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface ConnectionStatusProps {
  isOnline: boolean;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function ConnectionStatus({ 
  isOnline, 
  className,
  showLabel = true,
  size = 'sm'
}: ConnectionStatusProps) {
  const { t } = useTranslation();

  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={cn("flex items-center gap-1.5", textSize, className)}>
      <span className={cn(
        "rounded-full flex-shrink-0",
        dotSize,
        isOnline ? "bg-status-success" : "bg-status-danger animate-pulse"
      )} />
      {showLabel && (
        <span className={cn(
          isOnline ? "text-status-success" : "text-status-danger"
        )}>
          {isOnline ? t('offline.online') : t('offline.offlineMode')}
        </span>
      )}
    </div>
  );
}
