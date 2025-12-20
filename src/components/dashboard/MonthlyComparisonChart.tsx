import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MonthlyComparisonChartProps {
  inspections: Array<{
    inspection_date: string;
    status: string;
  }>;
}

export function MonthlyComparisonChart({ inspections }: MonthlyComparisonChartProps) {
  const chartData = useMemo(() => {
    const today = new Date();
    const months = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      const monthInspections = inspections.filter(insp => {
        const inspDate = new Date(insp.inspection_date);
        return isWithinInterval(inspDate, { start: monthStart, end: monthEnd });
      });
      
      months.push({
        month: format(monthDate, 'MMM', { locale: ptBR }),
        fullMonth: format(monthDate, 'MMMM yyyy', { locale: ptBR }),
        total: monthInspections.length,
        approved: monthInspections.filter(i => i.status === 'approved' || i.status === 'active').length,
        attention: monthInspections.filter(i => i.status === 'attention').length,
        rejected: monthInspections.filter(i => i.status === 'rejected' || i.status === 'non-compliant').length,
      });
    }
    
    return months;
  }, [inspections]);

  const totalThisMonth = chartData[chartData.length - 1]?.total || 0;
  const totalLastMonth = chartData[chartData.length - 2]?.total || 0;
  const growth = totalLastMonth > 0 
    ? (((totalThisMonth - totalLastMonth) / totalLastMonth) * 100).toFixed(0)
    : '0';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Inspeções por Mês
            </CardTitle>
            <CardDescription>Comparativo dos últimos 6 meses</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{totalThisMonth}</div>
            <div className="text-xs text-muted-foreground">
              {Number(growth) >= 0 ? '+' : ''}{growth}% vs mês anterior
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                        <p className="font-medium capitalize mb-2">{data.fullMonth}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-medium">{data.total}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-green-500">Aprovadas:</span>
                            <span className="font-medium">{data.approved}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-yellow-500">Atenção:</span>
                            <span className="font-medium">{data.attention}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-red-500">Reprovadas:</span>
                            <span className="font-medium">{data.rejected}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    approved: 'Aprovadas',
                    attention: 'Atenção',
                    rejected: 'Reprovadas',
                  };
                  return <span className="text-sm">{labels[value] || value}</span>;
                }}
              />
              <Bar dataKey="approved" stackId="a" fill="hsl(var(--chart-2))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="attention" stackId="a" fill="hsl(var(--chart-4))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="rejected" stackId="a" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
