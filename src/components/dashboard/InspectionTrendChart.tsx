import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useInspections } from '@/hooks/useInspections';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

export function InspectionTrendChart() {
  const { data: inspections = [], isLoading } = useInspections();

  const chartData = useMemo(() => {
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      const monthInspections = inspections.filter(insp => {
        const inspDate = parseISO(insp.inspection_date);
        return isWithinInterval(inspDate, { start: monthStart, end: monthEnd });
      });
      
      const compliant = monthInspections.filter(i => i.status === 'compliant').length;
      const nonCompliant = monthInspections.filter(i => i.status === 'non-compliant' || i.status === 'attention').length;
      
      months.push({
        month: format(monthDate, 'MMM', { locale: ptBR }),
        fullMonth: format(monthDate, 'MMMM yyyy', { locale: ptBR }),
        total: monthInspections.length,
        compliant,
        nonCompliant,
      });
    }
    
    return months;
  }, [inspections]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return 0;
    const lastMonth = chartData[chartData.length - 1].total;
    const prevMonth = chartData[chartData.length - 2].total;
    if (prevMonth === 0) return lastMonth > 0 ? 100 : 0;
    return ((lastMonth - prevMonth) / prevMonth) * 100;
  }, [chartData]);

  const totalInspections = chartData.reduce((sum, m) => sum + m.total, 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border rounded-xl shadow-lg p-3 min-w-[160px]">
          <p className="font-semibold text-foreground mb-2 capitalize">{data.fullMonth}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium">{data.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-500">Conformes:</span>
              <span className="font-medium">{data.compliant}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-500">Não conformes:</span>
              <span className="font-medium">{data.nonCompliant}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border shadow-sm p-5 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-5 border-b bg-gradient-to-r from-muted/50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent/10 rounded-xl">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Tendência de Inspeções</h3>
              <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">{totalInspections}</p>
              <p className="text-xs text-muted-foreground">Total período</p>
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              trend > 0 ? 'bg-emerald-500/10 text-emerald-600' : 
              trend < 0 ? 'bg-red-500/10 text-red-600' : 
              'bg-muted text-muted-foreground'
            }`}>
              {trend > 0 ? <TrendingUp className="h-3 w-3" /> : 
               trend < 0 ? <TrendingDown className="h-3 w-3" /> : 
               <Minus className="h-3 w-3" />}
              {Math.abs(trend).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-5">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                className="capitalize"
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="total" 
                stroke="hsl(var(--accent))" 
                strokeWidth={2}
                fill="url(#colorTotal)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Mini legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">Conformes</span>
            <span className="text-xs font-medium">{chartData.reduce((s, m) => s + m.compliant, 0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-muted-foreground">Não conformes</span>
            <span className="text-xs font-medium">{chartData.reduce((s, m) => s + m.nonCompliant, 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
