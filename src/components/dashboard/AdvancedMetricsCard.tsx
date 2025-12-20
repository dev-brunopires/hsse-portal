import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricData {
  current: number;
  previous: number;
  label: string;
}

interface AdvancedMetricsCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  metrics: MetricData[];
  className?: string;
}

export function AdvancedMetricsCard({
  title,
  description,
  icon: Icon,
  metrics,
  className,
}: AdvancedMetricsCardProps) {
  const processedMetrics = useMemo(() => {
    return metrics.map(metric => {
      const diff = metric.current - metric.previous;
      const percentChange = metric.previous > 0 
        ? ((diff / metric.previous) * 100).toFixed(1)
        : metric.current > 0 ? '100' : '0';
      
      let trend: 'up' | 'down' | 'neutral' = 'neutral';
      if (diff > 0) trend = 'up';
      else if (diff < 0) trend = 'down';

      return {
        ...metric,
        diff,
        percentChange,
        trend,
      };
    });
  }, [metrics]);

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return 'text-green-500';
      case 'down':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <CardDescription className="text-xs">{description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {processedMetrics.map((metric, index) => (
            <div key={index} className="space-y-1">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{metric.current}</span>
                <div className={cn('flex items-center gap-0.5 text-xs', getTrendColor(metric.trend))}>
                  {getTrendIcon(metric.trend)}
                  <span>{metric.percentChange}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
