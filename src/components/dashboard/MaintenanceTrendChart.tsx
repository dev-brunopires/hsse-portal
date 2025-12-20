import { useMemo } from 'react';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wrench, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Legend
} from 'recharts';
import { cn } from '@/lib/utils';
import { useShipFilter } from '@/contexts/ShipFilterContext';

export function MaintenanceTrendChart() {
  const { selectedShipId, isFilterEnabled } = useShipFilter();

  const { data: maintenance = [], isLoading } = useQuery({
    queryKey: ['maintenance-trend', selectedShipId],
    queryFn: async () => {
      const sixMonthsAgo = subMonths(new Date(), 6);
      let query = supabase
        .from('maintenance_requests')
        .select('created_at, completed_at, status, type')
        .gte('created_at', sixMonthsAgo.toISOString());

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
    const monthsToShow = 6;
    const startDate = subMonths(today, monthsToShow - 1);
    
    const months = eachMonthOfInterval({
      start: startOfMonth(startDate),
      end: endOfMonth(today),
    });

    return months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart);
      
      // Count opened in this month
      const opened = maintenance.filter((m) => {
        const createdDate = new Date(m.created_at);
        return createdDate >= monthStart && createdDate <= monthEnd;
      }).length;

      // Count completed in this month
      const completed = maintenance.filter((m) => {
        if (!m.completed_at) return false;
        const completedDate = new Date(m.completed_at);
        return completedDate >= monthStart && completedDate <= monthEnd;
      }).length;

      // Count pending at end of month
      const pending = maintenance.filter((m) => {
        const createdDate = new Date(m.created_at);
        const completedDate = m.completed_at ? new Date(m.completed_at) : null;
        // Was created before or during this month
        const wasCreated = createdDate <= monthEnd;
        // Was not completed or completed after this month
        const wasNotCompleted = !completedDate || completedDate > monthEnd;
        return wasCreated && wasNotCompleted && m.status !== 'rejected';
      }).length;

      return {
        month: format(monthStart, 'MMM', { locale: ptBR }),
        monthFull: format(monthStart, "MMMM 'de' yyyy", { locale: ptBR }),
        abertas: opened,
        concluidas: completed,
        pendentes: pending,
      };
    });
  }, [maintenance]);

  // Stats
  const stats = useMemo(() => {
    const total = maintenance.length;
    const completed = maintenance.filter(m => m.status === 'completed').length;
    const pending = maintenance.filter(m => m.status !== 'completed' && m.status !== 'rejected').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Trend: compare last 3 months vs previous 3 months (completed)
    if (chartData.length >= 6) {
      const recent = chartData.slice(-3).reduce((sum, m) => sum + m.concluidas, 0);
      const previous = chartData.slice(0, 3).reduce((sum, m) => sum + m.concluidas, 0);
      const change = previous > 0 ? ((recent - previous) / previous) * 100 : 0;
      return {
        total,
        completed,
        pending,
        completionRate,
        trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
        trendPercent: Math.abs(Math.round(change)),
      };
    }
    
    return { total, completed, pending, completionRate, trend: 'stable', trendPercent: 0 };
  }, [maintenance, chartData]);

  const TrendIcon = stats.trend === 'up' ? TrendingUp : stats.trend === 'down' ? TrendingDown : Minus;
  const trendColor = stats.trend === 'up' ? 'text-green-500' : stats.trend === 'down' ? 'text-amber-500' : 'text-muted-foreground';

  if (isLoading) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wrench className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Tendência de Manutenções</CardTitle>
              <CardDescription>Últimos 6 meses</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted/50 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wrench className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Tendência de Manutenções</CardTitle>
              <CardDescription>Últimos 6 meses</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Conclusão</div>
              <div className="flex items-center gap-1">
                <span className="text-xl font-bold text-foreground">{stats.completionRate}%</span>
                <TrendIcon className={cn("h-4 w-4", trendColor)} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Pendentes</div>
              <div className="text-xl font-bold text-amber-500">{stats.pending}</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAbertas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--status-warning))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--status-warning))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorConcluidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--status-success))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--status-success))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
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
                labelFormatter={(_, payload) => payload?.[0]?.payload?.monthFull || ''}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    abertas: 'Abertas',
                    concluidas: 'Concluídas',
                    pendentes: 'Pendentes',
                  };
                  return [value, labels[name] || name];
                }}
              />
              <Legend 
                verticalAlign="bottom"
                height={36}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    abertas: 'Abertas',
                    concluidas: 'Concluídas',
                  };
                  return <span className="text-xs">{labels[value] || value}</span>;
                }}
              />
              <Area
                type="monotone"
                dataKey="abertas"
                stroke="hsl(var(--status-warning))"
                fillOpacity={1}
                fill="url(#colorAbertas)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="concluidas"
                stroke="hsl(var(--status-success))"
                fillOpacity={1}
                fill="url(#colorConcluidas)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
