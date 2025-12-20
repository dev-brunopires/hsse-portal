import { TrendingUp, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComplianceGaugeProps {
  value: number;
  target?: number;
}

export function ComplianceGauge({ value, target = 95 }: ComplianceGaugeProps) {
  const isAboveTarget = value >= target;
  const progress = Math.min((value / 100) * 100, 100);
  const targetProgress = Math.min((target / 100) * 100, 100);
  
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 text-primary-foreground">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-primary-foreground/80 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Taxa de Conformidade</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight">{value}</span>
              <span className="text-2xl font-medium">%</span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-primary-foreground/70 mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm">Meta</span>
            </div>
            <span className="text-2xl font-bold">{target}%</span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="relative h-3 bg-primary-foreground/20 rounded-full overflow-hidden">
          {/* Target marker */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-primary-foreground/50 z-10"
            style={{ left: `${targetProgress}%` }}
          />
          
          {/* Progress fill */}
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-out",
              isAboveTarget 
                ? "bg-gradient-to-r from-emerald-300 to-emerald-400" 
                : "bg-gradient-to-r from-primary-foreground/70 to-primary-foreground"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Status text */}
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-primary-foreground/70">
            {isAboveTarget ? '✓ Meta atingida' : `${(target - value).toFixed(1)}% para a meta`}
          </span>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            isAboveTarget 
              ? "bg-emerald-400/20 text-emerald-200" 
              : "bg-amber-400/20 text-amber-200"
          )}>
            {isAboveTarget ? 'Excelente' : 'Em progresso'}
          </span>
        </div>
      </div>
    </div>
  );
}
