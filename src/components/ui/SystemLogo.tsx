import { Ship } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface SystemLogoProps {
  variant?: 'default' | 'white';
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function SystemLogo({ variant = 'default', className, showText = true, size = 'md' }: SystemLogoProps) {
  const { t } = useTranslation();
  const isWhite = variant === 'white';

  const sizeClasses = {
    sm: { icon: 'h-4 w-4', text: 'text-sm', padding: 'p-1' },
    md: { icon: 'h-5 w-5', text: 'text-sm', padding: 'p-1.5' },
    lg: { icon: 'h-7 w-7', text: 'text-base', padding: 'p-2' },
  };

  const sizes = sizeClasses[size];
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'flex items-center justify-center rounded-lg',
        sizes.padding,
        isWhite ? 'bg-white/10' : 'bg-primary/10'
      )}>
        <Ship className={cn(
          sizes.icon,
          isWhite ? 'text-white' : 'text-primary'
        )} />
      </div>
      {showText && (
        <span className={cn(
          'font-bold tracking-tight leading-tight',
          sizes.text,
          isWhite ? 'text-white' : 'text-foreground'
        )}>
          {t('navigation.appTitle')}
        </span>
      )}
    </div>
  );
}
