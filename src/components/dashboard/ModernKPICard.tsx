import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    gradient: 'from-slate-500/10 via-slate-500/5 to-transparent',
    iconBg: 'bg-slate-500/15',
    iconColor: 'text-slate-600 dark:text-slate-400',
    accentBorder: 'border-l-slate-500',
  },
  success: {
    gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    accentBorder: 'border-l-emerald-500',
  },
  warning: {
    gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
    accentBorder: 'border-l-amber-500',
  },
  danger: {
    gradient: 'from-red-500/10 via-red-500/5 to-transparent',
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-600 dark:text-red-400',
    accentBorder: 'border-l-red-500',
  },
  info: {
    gradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-600 dark:text-blue-400',
    accentBorder: 'border-l-blue-500',
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
  const config = variantConfig[variant];
  
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border bg-card transition-all duration-300",
      "hover:shadow-lg hover:scale-[1.02] hover:border-primary/20",
      "group cursor-default",
      config.accentBorder,
      "border-l-4",
      size === 'sm' && 'p-4',
      size === 'md' && 'p-5',
      size === 'lg' && 'p-6'
    )}>
      {/* Gradient background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-50 group-hover:opacity-70 transition-opacity",
        config.gradient
      )} />
      
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground truncate">
            {title}
          </p>
          <p className={cn(
            "font-bold tracking-tight text-foreground",
            size === 'sm' && 'text-2xl',
            size === 'md' && 'text-3xl',
            size === 'lg' && 'text-4xl'
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-muted-foreground/80">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
              trend.isPositive 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            )}>
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(trend.value)}% vs mês anterior
            </div>
          )}
        </div>
        
        <div className={cn(
          "shrink-0 rounded-xl p-3 transition-transform group-hover:scale-110",
          config.iconBg
        )}>
          <Icon className={cn(
            config.iconColor,
            size === 'sm' && 'h-5 w-5',
            size === 'md' && 'h-6 w-6',
            size === 'lg' && 'h-7 w-7'
          )} />
        </div>
      </div>
    </div>
  );
}
