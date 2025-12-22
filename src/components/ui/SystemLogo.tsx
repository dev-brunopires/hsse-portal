import { Ship } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemLogoProps {
  variant?: 'default' | 'white';
  className?: string;
  showText?: boolean;
}

export function SystemLogo({ variant = 'default', className, showText = true }: SystemLogoProps) {
  const isWhite = variant === 'white';
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'flex items-center justify-center rounded-lg p-1.5',
        isWhite ? 'bg-white/10' : 'bg-primary/10'
      )}>
        <Ship className={cn(
          'h-5 w-5',
          isWhite ? 'text-white' : 'text-primary'
        )} />
      </div>
      {showText && (
        <span className={cn(
          'font-bold text-lg tracking-tight',
          isWhite ? 'text-white' : 'text-foreground'
        )}>
          SafeShip
        </span>
      )}
    </div>
  );
}
