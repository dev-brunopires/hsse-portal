import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

interface MonthlyActivityData {
  month: string;
  inspections: number;
  maintenances: number;
  certificates: number;
}

export function ActivityComparisonChart() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? enUS : ptBR;
  const { selectedShipId, isFilterEnabled, isReady } = useShipFilter();

  const { data, isLoading } = useQuery({
    queryKey: ['activity-comparison', selectedShipId],
    enabled: isReady,
    queryFn: async () => {
      const months: MonthlyActivityData[] = [];
      const now = new Date();

      // Get data for last 6 months
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthStart = startOfMonth(monthDate).toISOString();
        const monthEnd = endOfMonth(monthDate).toISOString();

        // Build queries with optional ship filter
        let inspectionsQuery = supabase
          .from('inspections')
          .select('id', { count: 'exact', head: true })
          .gte('inspection_date', monthStart.split('T')[0])
          .lte('inspection_date', monthEnd.split('T')[0]);

        let maintenanceQuery = supabase
          .from('maintenance_requests')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd);

        let certificatesQuery = supabase
          .from('certificates')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd);

        if (isFilterEnabled && selectedShipId) {
          inspectionsQuery = inspectionsQuery.eq('ship_id', selectedShipId);
          maintenanceQuery = maintenanceQuery.eq('ship_id', selectedShipId);
          certificatesQuery = certificatesQuery.eq('ship_id', selectedShipId);
        }

        const [inspections, maintenances, certificates] = await Promise.all([
          inspectionsQuery,
          maintenanceQuery,
          certificatesQuery,
        ]);

        months.push({
          month: format(monthDate, 'MMM', { locale: dateLocale }),
          inspections: inspections.count || 0,
          maintenances: maintenances.count || 0,
          certificates: certificates.count || 0,
        });
      }

      return months;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Calculate trends
  const trends = useMemo(() => {
    if (!data || data.length < 2) return null;

    const currentMonth = data[data.length - 1];
    const previousMonth = data[data.length - 2];

    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      inspections: calcTrend(currentMonth.inspections, previousMonth.inspections),
      maintenances: calcTrend(currentMonth.maintenances, previousMonth.maintenances),
      certificates: calcTrend(currentMonth.certificates, previousMonth.certificates),
    };
  }, [data]);

// Moved outside component to avoid ref warnings and re-creation on each render
function TrendIndicator({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
        <TrendingUp className="h-3 w-3" />
        +{value}%
      </span>
    );
  } else if (value < 0) {
    return (
      <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
        <TrendingDown className="h-3 w-3" />
        {value}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-muted-foreground text-xs font-medium">
      <Minus className="h-3 w-3" />
      0%
    </span>
  );
}

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{t('dashboard.activityComparison')}</CardTitle>
              <CardDescription>{t('dashboard.activityComparisonDesc')}</CardDescription>
            </div>
          </div>
          {trends && (
            <div className="flex gap-4 sm:gap-6 text-sm border rounded-lg p-3 bg-muted/30">
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-1">{t('navigation.inspections')}</p>
                <TrendIndicator value={trends.inspections} />
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-1">{t('navigation.maintenance')}</p>
                <TrendIndicator value={trends.maintenances} />
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-1">{t('navigation.certificates')}</p>
                <TrendIndicator value={trends.certificates} />
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              labelStyle={{ color: 'hsl(var(--popover-foreground))', fontWeight: 600 }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: 16 }}
              formatter={(value) => <span className="text-sm">{value}</span>}
            />
            <Bar 
              dataKey="inspections" 
              name={t('navigation.inspections')} 
              fill="hsl(var(--primary))" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="maintenances" 
              name={t('navigation.maintenance')} 
              fill="hsl(var(--chart-2))" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="certificates" 
              name={t('navigation.certificates')} 
              fill="hsl(var(--chart-3))" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
