import { CheckCircle2, XCircle, AlertTriangle, Clock, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { HealthCheckCategory, HealthStatus } from '@/hooks/useHealthCheck';
import { useTranslation } from 'react-i18next';

interface HealthCheckCardProps {
  category: HealthCheckCategory;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const statusConfig: Record<HealthStatus, { icon: typeof CheckCircle2; color: string; bgColor: string }> = {
  ok: { icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950/30' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-950/30' },
  error: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950/30' },
  pending: { icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted/30' },
  running: { icon: Loader2, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
};

export function HealthCheckCard({ category, onRefresh, isRefreshing }: HealthCheckCardProps) {
  const { t } = useTranslation();
  const config = statusConfig[category.overallStatus];
  const StatusIcon = config.icon;
  
  const okCount = category.results.filter(r => r.status === 'ok').length;
  const totalCount = category.results.length;

  return (
    <Card className={cn('transition-all duration-300', config.bgColor)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', config.bgColor)}>
              <StatusIcon 
                className={cn(
                  'h-5 w-5',
                  config.color,
                  category.overallStatus === 'running' && 'animate-spin'
                )} 
              />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{category.name}</CardTitle>
              {totalCount > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {okCount}/{totalCount} {t('healthCheck.checksOk')}
                  {category.totalLatency > 0 && (
                    <span className="ml-2">• {category.totalLatency}ms</span>
                  )}
                </p>
              )}
            </div>
          </div>
          {onRefresh && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-8 w-8"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {category.results.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('healthCheck.notCheckedYet')}</p>
        ) : (
          <div className="space-y-2">
            {category.results.map((result) => {
              const resultConfig = statusConfig[result.status];
              const ResultIcon = resultConfig.icon;
              
              return (
                <div 
                  key={result.component}
                  className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md bg-background/50"
                >
                  <div className="flex items-center gap-2">
                    <ResultIcon 
                      className={cn(
                        'h-4 w-4 flex-shrink-0',
                        resultConfig.color,
                        result.status === 'running' && 'animate-spin'
                      )} 
                    />
                    <span className="font-medium">{result.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.latency && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {result.latency}ms
                      </Badge>
                    )}
                    <span className={cn('text-xs', resultConfig.color)}>
                      {result.message}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
