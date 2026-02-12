import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Ship } from 'lucide-react';

export function ShipComparisonChart() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['ship-comparison'],
    queryFn: async () => {
      const { data: ships } = await supabase.from('ships').select('id, name');
      if (!ships?.length) return [];

      const { data: allEquipment } = await supabase.from('equipment').select('id, ship_id, status');

      return ships.map(ship => {
        const shipEquip = allEquipment?.filter(e => e.ship_id === ship.id) || [];
        const total = shipEquip.length;
        const active = shipEquip.filter(e => e.status === 'active').length;
        const expired = shipEquip.filter(e => e.status === 'expired').length;
        const maintenance = shipEquip.filter(e => e.status === 'maintenance').length;
        const compliance = total > 0 ? Math.round((active / total) * 100) : 0;

        return {
          name: ship.name.length > 12 ? ship.name.substring(0, 12) + '...' : ship.name,
          total,
          active,
          expired,
          maintenance,
          compliance,
        };
      }).filter(s => s.total > 0).sort((a, b) => b.compliance - a.compliance);
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

  if (!data?.length) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Ship className="h-5 w-5 text-primary" /></div>
            <div>
              <CardTitle>{t('dashboard.shipComparison')}</CardTitle>
              <CardDescription>{t('dashboard.shipComparisonDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">{t('common.noData')}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><Ship className="h-5 w-5 text-primary" /></div>
          <div>
            <CardTitle>{t('dashboard.shipComparison')}</CardTitle>
            <CardDescription>{t('dashboard.shipComparisonDesc')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false}
            />
            <YAxis type="category" dataKey="name" width={100}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`${value}%`, t('dashboard.compliance')]}
            />
            <Bar dataKey="compliance" name={t('dashboard.compliance')} radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.compliance >= 90 ? 'hsl(var(--chart-2))' : entry.compliance >= 70 ? 'hsl(var(--chart-4))' : 'hsl(var(--destructive))'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
