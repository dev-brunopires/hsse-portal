import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, Target } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

export function ComplianceTrendChart() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? enUS : ptBR;
  const { selectedShipId, isFilterEnabled, isReady } = useShipFilter();

  const { data, isLoading } = useQuery({
    queryKey: ['compliance-trend', selectedShipId],
    enabled: isReady,
    queryFn: async () => {
      const months = [];
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthStart = startOfMonth(monthDate).toISOString().split('T')[0];
        const monthEnd = endOfMonth(monthDate).toISOString().split('T')[0];

        let equipQuery = supabase
          .from('equipment')
          .select('id, status')
          .lte('created_at', endOfMonth(monthDate).toISOString());

        if (isFilterEnabled && selectedShipId) {
          equipQuery = equipQuery.eq('ship_id', selectedShipId);
        }

        const { data: equipData } = await equipQuery;

        const total = equipData?.length || 0;
        const active = equipData?.filter(e => e.status === 'active').length || 0;
        const compliance = total > 0 ? Math.round((active / total) * 100) : 0;

        // Get inspections for this month
        let inspQuery = supabase
          .from('inspections')
          .select('id, status')
          .gte('inspection_date', monthStart)
          .lte('inspection_date', monthEnd);

        if (isFilterEnabled && selectedShipId) {
          inspQuery = inspQuery.eq('ship_id', selectedShipId);
        }

        const { data: inspData } = await inspQuery;
        const totalInsp = inspData?.length || 0;
        const compliantInsp = inspData?.filter(i => i.status === 'compliant').length || 0;
        const inspCompliance = totalInsp > 0 ? Math.round((compliantInsp / totalInsp) * 100) : 0;

        months.push({
          month: format(monthDate, 'MMM/yy', { locale: dateLocale }),
          equipCompliance: compliance,
          inspCompliance: inspCompliance,
        });
      }

      return months;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>{t('dashboard.complianceTrend')}</CardTitle>
            <CardDescription>{t('dashboard.complianceTrendDesc')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
            <XAxis
              dataKey="month"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`${value}%`]}
            />
            <ReferenceLine y={95} stroke="hsl(var(--chart-4))" strokeDasharray="5 5" label={{ value: `${t('dashboard.target')} 95%`, fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="equipCompliance"
              name={t('dashboard.equipmentCompliance')}
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--primary))', r: 5 }}
              activeDot={{ r: 7 }}
            />
            <Line
              type="monotone"
              dataKey="inspCompliance"
              name={t('dashboard.inspectionCompliance')}
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
