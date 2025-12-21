import { useMemo } from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useInspections } from '@/hooks/useInspections';
import { format, addDays, isAfter, isBefore, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/utils/dateFormat';

export function UpcomingInspectionsCard() {
  const { data: inspections = [], isLoading } = useInspections();

  const upcomingInspections = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = addDays(now, 30);
    
    return inspections
      .filter(insp => {
        if (!insp.next_inspection_date) return false;
        const nextDate = parseLocalDate(insp.next_inspection_date);
        if (!nextDate) return false;
        return isAfter(nextDate, now) && isBefore(nextDate, thirtyDaysFromNow);
      })
      .map(insp => {
        const nextDate = parseLocalDate(insp.next_inspection_date!)!;
        return {
          ...insp,
          daysUntil: differenceInDays(nextDate, now),
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [inspections]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);
    const monthFromNow = addDays(now, 30);
    
    const thisWeek = inspections.filter(insp => {
      if (!insp.next_inspection_date) return false;
      const nextDate = parseLocalDate(insp.next_inspection_date);
      if (!nextDate) return false;
      return isAfter(nextDate, now) && isBefore(nextDate, weekFromNow);
    }).length;

    const thisMonth = inspections.filter(insp => {
      if (!insp.next_inspection_date) return false;
      const nextDate = parseLocalDate(insp.next_inspection_date);
      if (!nextDate) return false;
      return isAfter(nextDate, now) && isBefore(nextDate, monthFromNow);
    }).length;

    return { thisWeek, thisMonth };
  }, [inspections]);

  const getUrgencyColor = (days: number) => {
    if (days <= 3) return 'text-red-500 bg-red-500/10';
    if (days <= 7) return 'text-amber-500 bg-amber-500/10';
    return 'text-emerald-500 bg-emerald-500/10';
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border shadow-sm p-5 space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden h-[380px] flex flex-col">
      <div className="p-5 border-b bg-gradient-to-r from-muted/50 to-transparent shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Próximas Inspeções</h3>
            <p className="text-sm text-muted-foreground">Agenda dos próximos 30 dias</p>
          </div>
        </div>
      </div>
      
      <div className="p-5 space-y-4 flex-1 flex flex-col min-h-0">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-600">Esta semana</span>
            </div>
            <p className="text-2xl font-bold text-amber-700">{stats.thisWeek}</p>
          </div>
          <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-accent" />
              <span className="text-xs font-medium text-accent">Este mês</span>
            </div>
            <p className="text-2xl font-bold text-accent">{stats.thisMonth}</p>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2 flex-1 overflow-y-auto pr-1">
          {upcomingInspections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-500 mb-2" />
              <p className="text-sm font-medium text-foreground">Tudo em dia!</p>
              <p className="text-xs text-muted-foreground">Nenhuma inspeção programada</p>
            </div>
          ) : (
            upcomingInspections.map((insp) => (
              <div 
                key={insp.id}
                className="flex items-center gap-3 p-3 rounded-xl border bg-background hover:bg-muted/50 transition-colors"
              >
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-lg text-xs font-bold",
                  getUrgencyColor(insp.daysUntil)
                )}>
                  {insp.daysUntil}d
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {insp.equipment?.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {insp.equipment?.internal_code}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-foreground">
                    {format(parseLocalDate(insp.next_inspection_date!)!, 'dd/MM', { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {format(parseLocalDate(insp.next_inspection_date!)!, 'EEE', { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
