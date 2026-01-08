import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  const { t } = useTranslation();
  const progress = Math.min(pullDistance / threshold, 1);
  const isReady = pullDistance >= threshold;

  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-center py-2 transition-opacity",
        pullDistance > 10 || isRefreshing ? "opacity-100" : "opacity-0"
      )}
      style={{
        height: isRefreshing ? 40 : Math.max(pullDistance, 0),
      }}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {isRefreshing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>{t('common.loading')}</span>
          </>
        ) : (
          <>
            <ArrowDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isReady && "rotate-180 text-primary"
              )}
              style={{
                transform: `rotate(${progress * 180}deg)`,
              }}
            />
            <span>
              {isReady ? t('common.releaseToRefresh') : t('common.pullToRefresh')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
