import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  isLoading?: boolean;
  className?: string;
}

const variantConfig = {
  default: {
    border: 'border-l-blue-500',
    iconBg: 'text-blue-500/20',
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
    border: 'border-l-primary',
    iconBg: 'text-primary/20',
    valueColor: 'text-primary',
  },
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = 'default',
  isLoading = false,
  className,
}: StatCardProps) {
  const config = variantConfig[variant];

  return (
    <Card className={cn('border-l-4', config.border, className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className={cn('text-2xl font-bold', config.valueColor)}>
                {value}
              </p>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <Icon className={cn('h-8 w-8', config.iconBg)} />
        </div>
      </CardContent>
    </Card>
  );
}
