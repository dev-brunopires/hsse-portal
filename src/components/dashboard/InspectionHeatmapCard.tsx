import { useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Flame } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export function InspectionHeatmapCard() {
  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ['inspections-heatmap'],
    queryFn: async () => {
      const sixWeeksAgo = subWeeks(new Date(), 6);
      const { data, error } = await supabase
        .from('inspections')
        .select('inspection_date')
        .gte('inspection_date', sixWeeksAgo.toISOString().split('T')[0]);

      if (error) throw error;
      return data || [];
    },
  });

  const heatmapData = useMemo(() => {
    const today = new Date();
    const sixWeeksAgo = subWeeks(today, 5);
    const start = startOfWeek(sixWeeksAgo, { weekStartsOn: 0 });
    const end = endOfWeek(today, { weekStartsOn: 0 });

    const days = eachDayOfInterval({ start, end });
    const counts = new Map<string, number>();

    inspections.forEach((insp) => {
      const date = insp.inspection_date;
      counts.set(date, (counts.get(date) || 0) + 1);
    });

    // Group by week
    const weeks: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];

    days.forEach((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      currentWeek.push({ date: day, count: counts.get(dateStr) || 0 });

      if (getDay(day) === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    const maxCount = Math.max(...Array.from(counts.values()), 1);

    return { weeks, maxCount };
  }, [inspections]);

  const getIntensityClass = (count: number, maxCount: number) => {
    if (count === 0) return 'bg-muted';
    const ratio = count / maxCount;
    if (ratio <= 0.25) return 'bg-green-200 dark:bg-green-900';
    if (ratio <= 0.5) return 'bg-green-400 dark:bg-green-700';
    if (ratio <= 0.75) return 'bg-green-500 dark:bg-green-600';
    return 'bg-green-600 dark:bg-green-500';
  };

  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Mapa de Calor
          </CardTitle>
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
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Flame className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Mapa de Calor de Inspeções</CardTitle>
            <CardDescription>Atividade das últimas 6 semanas</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex gap-2">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] text-xs text-muted-foreground shrink-0">
            {dayLabels.map((day, index) => (
              <div key={day} className="h-6 flex items-center justify-end pr-2 w-8">
                {day}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="flex gap-[3px]">
            {heatmapData.weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {week.map((day, dayIndex) => (
                  <Tooltip key={dayIndex}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'w-6 h-6 rounded-sm cursor-pointer transition-colors hover:ring-1 hover:ring-primary',
                          getIntensityClass(day.count, heatmapData.maxCount)
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">
                        {format(day.date, "dd 'de' MMMM", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {day.count} {day.count === 1 ? 'inspeção' : 'inspeções'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1.5 mt-4 text-xs text-muted-foreground">
          <span>Menos</span>
          <div className="w-4 h-4 rounded-sm bg-muted" />
          <div className="w-4 h-4 rounded-sm bg-green-200 dark:bg-green-900" />
          <div className="w-4 h-4 rounded-sm bg-green-400 dark:bg-green-700" />
          <div className="w-4 h-4 rounded-sm bg-green-500 dark:bg-green-600" />
          <div className="w-4 h-4 rounded-sm bg-green-600 dark:bg-green-500" />
          <span>Mais</span>
        </div>
      </CardContent>
    </Card>
  );
}
