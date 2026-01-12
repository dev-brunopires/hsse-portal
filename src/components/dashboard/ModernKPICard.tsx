import { useTranslation } from 'react-i18next';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface ModernKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

const variantConfig = {
  default: {
    border: 'border-l-slate-500',
    iconBg: 'text-slate-500/20',
    valueColor: '',
  },
  success: {
    border: 'border-l-green-500',
    iconBg: 'text-green-500/20',
    valueColor: 'text-green-600',
  },
  warning: {
    border: 'border-l-yellow-500',
    iconBg: 'text-yellow-500/20',
    valueColor: 'text-yellow-600',
  },
  danger: {
    border: 'border-l-red-500',
    iconBg: 'text-red-500/20',
    valueColor: 'text-red-600',
  },
  info: {
    border: 'border-l-blue-500',
    iconBg: 'text-blue-500/20',
    valueColor: 'text-blue-600',
  },
};

export function ModernKPICard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  variant = 'default',
  size = 'md' 
}: ModernKPICardProps) {
  const { t } = useTranslation();
  const config = variantConfig[variant];
  
  return (
    <Card className={cn('border-l-4', config.border)}>
      <CardContent className={cn(
        size === 'sm' && 'p-3',
        size === 'md' && 'p-4',
        size === 'lg' && 'p-5'
      )}>
        <div className="flex items-center justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-sm text-muted-foreground truncate">
              {title}
            </p>
            <p className={cn(
              "font-bold tracking-tight",
              config.valueColor,
              size === 'sm' && 'text-xl',
              size === 'md' && 'text-2xl',
              size === 'lg' && 'text-3xl'
            )}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
            {trend && (
              <div className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                trend.isPositive 
                  ? "text-green-600" 
                  : "text-red-600"
              )}>
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(trend.value)}% {t('dashboard.vsPreviousMonth')}
              </div>
            )}
          </div>
          
          <Icon className={cn(
            config.iconBg,
            size === 'sm' && 'h-6 w-6',
            size === 'md' && 'h-8 w-8',
            size === 'lg' && 'h-10 w-10'
          )} />
        </div>
      </CardContent>
    </Card>
  );
}
