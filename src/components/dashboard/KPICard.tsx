import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, variant = 'default' }: KPICardProps) {
  const { t } = useTranslation();
  
  const variantStyles = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-status-success/10 text-status-success',
    warning: 'bg-status-warning/10 text-status-warning',
    danger: 'bg-status-danger/10 text-status-danger',
  };

  return (
    <div className="kpi-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="kpi-label">{title}</p>
          <p className="kpi-value">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              'text-sm font-medium',
              trend.isPositive ? 'text-status-success' : 'text-status-danger'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% {t('dashboard.trendVsLastMonth')}
            </p>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', variantStyles[variant])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
