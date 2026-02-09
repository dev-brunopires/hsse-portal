import { useMemo } from 'react';
import { format, subWeeks, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns';
import { formatLocalDate } from '@/utils/dateFormat';
import { ptBR, enUS } from 'date-fns/locale';
import { CalendarDays, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useTranslation } from 'react-i18next';

export function InspectionHeatmapCard() {
  const { t, i18n } = useTranslation();
  const { selectedShipId, isFilterEnabled } = useShipFilter();
  const dateLocale = i18n.language === 'pt-BR' ? ptBR : enUS;
  
  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ['inspections-weekly-chart', selectedShipId],
    queryFn: async () => {
      const twelveWeeksAgo = subWeeks(new Date(), 12);
      let query = supabase
        .from('inspections')
        .select('inspection_date, status')
        .gte('inspection_date', formatLocalDate(twelveWeeksAgo));

      if (isFilterEnabled && selectedShipId) {
        query = query.eq('ship_id', selectedShipId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const chartData = useMemo(() => {
    const today = new Date();
    const weeksToShow = 8;
    const startDate = subWeeks(today, weeksToShow - 1);
    
    const weeks = eachWeekOfInterval(
      { start: startOfWeek(startDate, { weekStartsOn: 0 }), end: endOfWeek(today, { weekStartsOn: 0 }) },
      { weekStartsOn: 0 }
    );

    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
      const weekInspections = inspections.filter((insp) => {
        const date = new Date(insp.inspection_date);
        return date >= weekStart && date <= weekEnd;
      });

      const compliant = weekInspections.filter(i => i.status === 'compliant').length;
      const attention = weekInspections.filter(i => i.status === 'attention').length;
      const nonCompliant = weekInspections.filter(i => i.status === 'non-compliant' || i.status === 'rejected').length;

      return {
        week: format(weekStart, 'dd/MM', { locale: dateLocale }),
        total: weekInspections.length,
        compliant,
        attention,
        nonCompliant,
      };
    });
  }, [inspections, dateLocale]);

  const totalInspections = inspections.length;
  
  // Calculate trend (comparing last 4 weeks vs previous 4 weeks)
  const trend = useMemo(() => {
    if (chartData.length < 8) return { direction: 'stable', percent: 0 };
    const recent = chartData.slice(-4).reduce((sum, w) => sum + w.total, 0);
    const previous = chartData.slice(0, 4).reduce((sum, w) => sum + w.total, 0);
    if (previous === 0) return { direction: recent > 0 ? 'up' : 'stable', percent: 100 };
    const change = ((recent - previous) / previous) * 100;
    return {
      direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
      percent: Math.abs(Math.round(change)),
    };
  }, [chartData]);

  const TrendIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const trendColor = trend.direction === 'up' ? 'text-green-500' : trend.direction === 'down' ? 'text-red-500' : 'text-muted-foreground';

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{t('inspectionHeatmap.title')}</CardTitle>
              <CardDescription>{t('inspectionHeatmap.subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted/50 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{t('inspectionHeatmap.title')}</CardTitle>
              <CardDescription>{t('inspectionHeatmap.subtitle')}</CardDescription>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{totalInspections}</div>
            <div className="flex items-center gap-1 justify-end">
              <TrendIcon className={cn("h-3 w-3", trendColor)} />
              <span className={cn("text-xs", trendColor)}>
                {trend.percent}%
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="week" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    total: t('inspectionHeatmap.total'),
                    compliant: t('inspectionHeatmap.compliant'),
                    attention: t('inspectionHeatmap.attention'),
                    nonCompliant: t('inspectionHeatmap.nonCompliant'),
                  };
                  return [value, labels[name] || name];
                }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={entry.nonCompliant > 0 
                      ? 'hsl(var(--status-danger))' 
                      : entry.attention > 0 
                        ? 'hsl(var(--status-warning))' 
                        : 'hsl(var(--primary))'
                    }
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-primary/80" />
            <span>{t('inspectionHeatmap.compliant')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-status-warning/80" />
            <span>{t('inspectionHeatmap.attention')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-status-danger/80" />
            <span>{t('inspectionHeatmap.nonCompliant')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
