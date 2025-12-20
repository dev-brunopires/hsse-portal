import { useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks, getDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export function InspectionHeatmapCard() {
  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ['inspections-heatmap'],
    queryFn: async () => {
      const twelveWeeksAgo = subWeeks(new Date(), 12);
      const { data, error } = await supabase
        .from('inspections')
        .select('inspection_date, status')
        .gte('inspection_date', twelveWeeksAgo.toISOString().split('T')[0]);

      if (error) throw error;
      return data || [];
    },
  });

  const heatmapData = useMemo(() => {
    const today = new Date();
    const weeksToShow = 12;
    const startDate = subWeeks(today, weeksToShow - 1);
    const start = startOfWeek(startDate, { weekStartsOn: 0 });
    const end = endOfWeek(today, { weekStartsOn: 0 });

    const days = eachDayOfInterval({ start, end });
    const counts = new Map<string, { total: number; compliant: number; attention: number; nonCompliant: number }>();

    inspections.forEach((insp) => {
      const date = insp.inspection_date;
      const current = counts.get(date) || { total: 0, compliant: 0, attention: 0, nonCompliant: 0 };
      current.total++;
      if (insp.status === 'compliant') current.compliant++;
      else if (insp.status === 'attention') current.attention++;
      else current.nonCompliant++;
      counts.set(date, current);
    });

    // Group by week (columns)
    const weeks: { date: Date; count: number; details: { total: number; compliant: number; attention: number; nonCompliant: number } }[][] = [];
    let currentWeek: typeof weeks[0] = [];

    days.forEach((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const details = counts.get(dateStr) || { total: 0, compliant: 0, attention: 0, nonCompliant: 0 };
      currentWeek.push({ date: day, count: details.total, details });

      if (getDay(day) === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    const maxCount = Math.max(...Array.from(counts.values()).map(c => c.total), 1);
    const totalInspections = inspections.length;

    return { weeks, maxCount, totalInspections };
  }, [inspections]);

  const getIntensityClass = (count: number, maxCount: number) => {
    if (count === 0) return 'bg-muted/50 dark:bg-muted/30';
    const ratio = count / maxCount;
    if (ratio <= 0.25) return 'bg-emerald-200 dark:bg-emerald-900/60';
    if (ratio <= 0.5) return 'bg-emerald-400 dark:bg-emerald-700';
    if (ratio <= 0.75) return 'bg-emerald-500 dark:bg-emerald-600';
    return 'bg-emerald-600 dark:bg-emerald-500';
  };

  const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const today = new Date();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Atividade de Inspeções</CardTitle>
              <CardDescription>Últimas 12 semanas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted/50 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Atividade de Inspeções</CardTitle>
              <CardDescription>Últimas 12 semanas</CardDescription>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{heatmapData.totalInspections}</div>
            <div className="text-xs text-muted-foreground">inspeções</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="flex gap-0.5 min-w-max">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 pr-1">
              {dayLabels.map((day, index) => (
                <div 
                  key={index} 
                  className="h-3 w-3 flex items-center justify-center text-[9px] text-muted-foreground font-medium"
                >
                  {index % 2 === 1 ? day : ''}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            {heatmapData.weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-0.5">
                {week.map((day, dayIndex) => {
                  const isToday = isSameDay(day.date, today);
                  return (
                    <Tooltip key={dayIndex}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'w-3 h-3 rounded-[2px] cursor-pointer transition-all',
                            getIntensityClass(day.count, heatmapData.maxCount),
                            isToday && 'ring-1 ring-primary ring-offset-1 ring-offset-background'
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p className="font-medium">
                          {format(day.date, "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                        {day.count > 0 ? (
                          <div className="mt-1 space-y-0.5">
                            <p className="text-muted-foreground">
                              {day.count} {day.count === 1 ? 'inspeção' : 'inspeções'}
                            </p>
                            {day.details.compliant > 0 && (
                              <p className="text-green-500">✓ {day.details.compliant} conforme</p>
                            )}
                            {day.details.attention > 0 && (
                              <p className="text-amber-500">⚠ {day.details.attention} atenção</p>
                            )}
                            {day.details.nonCompliant > 0 && (
                              <p className="text-red-500">✗ {day.details.nonCompliant} não conforme</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-muted-foreground">Nenhuma inspeção</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend and month labels */}
        <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Menos</span>
            <div className="flex items-center gap-0.5">
              <div className="w-3 h-3 rounded-[2px] bg-muted/50 dark:bg-muted/30" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-200 dark:bg-emerald-900/60" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-400 dark:bg-emerald-700" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-500 dark:bg-emerald-600" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-600 dark:bg-emerald-500" />
            </div>
            <span className="hidden sm:inline">Mais</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-[2px] ring-1 ring-primary" />
            <span>Hoje</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
