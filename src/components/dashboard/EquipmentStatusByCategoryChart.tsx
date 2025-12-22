import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Layers } from 'lucide-react';
import { useEquipment } from '@/hooks/useEquipment';
import { useCategories } from '@/hooks/useCategories';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

export function EquipmentStatusByCategoryChart() {
  const { t } = useTranslation();
  const { data: equipment = [], isLoading: loadingEquipment } = useEquipment();
  const { data: categories = [], isLoading: loadingCategories } = useCategories();

  const chartData = useMemo(() => {
    if (!equipment.length || !categories.length) return [];

    return categories.map(category => {
      const categoryEquipment = equipment.filter(e => e.category_id === category.id);
      
      const active = categoryEquipment.filter(e => e.status === 'active').length;
      const maintenance = categoryEquipment.filter(e => e.status === 'maintenance').length;
      const expired = categoryEquipment.filter(e => 
        e.status === 'expired' || e.status === 'rejected'
      ).length;
      const total = categoryEquipment.length;

      return {
        category: category.name.length > 15 ? category.name.slice(0, 15) + '...' : category.name,
        fullName: category.name,
        [t('statusByCategory.active')]: active,
        [t('statusByCategory.maintenance')]: maintenance,
        [t('statusByCategory.expired')]: expired,
        total,
      };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [equipment, categories, t]);

  const totals = useMemo(() => {
    const activeKey = t('statusByCategory.active');
    const maintenanceKey = t('statusByCategory.maintenance');
    const expiredKey = t('statusByCategory.expired');
    
    return chartData.reduce((acc, item) => ({
      active: acc.active + (item[activeKey] as number || 0),
      maintenance: acc.maintenance + (item[maintenanceKey] as number || 0),
      expired: acc.expired + (item[expiredKey] as number || 0),
    }), { active: 0, maintenance: 0, expired: 0 });
  }, [chartData, t]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      const activeKey = t('statusByCategory.active');
      const maintenanceKey = t('statusByCategory.maintenance');
      const expiredKey = t('statusByCategory.expired');
      
      return (
        <div className="bg-card border rounded-lg shadow-lg p-2.5 min-w-[160px]">
          <p className="font-semibold text-foreground text-sm mb-1.5">{data?.fullName}</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">{activeKey}:</span>
              </div>
              <span className="font-medium">{data?.[activeKey]}</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">{maintenanceKey}:</span>
              </div>
              <span className="font-medium">{data?.[maintenanceKey]}</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-muted-foreground">{expiredKey}:</span>
              </div>
              <span className="font-medium">{data?.[expiredKey]}</span>
            </div>
            <div className="pt-1 border-t mt-1 flex justify-between">
              <span className="text-muted-foreground font-medium">{t('common.total')}:</span>
              <span className="font-bold">{data?.total}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loadingEquipment || loadingCategories) {
    return (
      <div className="bg-card rounded-2xl border shadow-sm p-5 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const activeKey = t('statusByCategory.active');
  const maintenanceKey = t('statusByCategory.maintenance');
  const expiredKey = t('statusByCategory.expired');

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden h-[380px] flex flex-col">
      <div className="p-5 border-b bg-gradient-to-r from-muted/50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t('statusByCategory.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('statusByCategory.subtitle')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">{totals.active}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">{totals.maintenance}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-muted-foreground">{totals.expired}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={50}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey={activeKey} 
                stackId="a"
                fill="#10b981" 
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey={maintenanceKey} 
                stackId="a"
                fill="#f59e0b" 
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey={expiredKey} 
                stackId="a"
                fill="#ef4444" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-xs text-muted-foreground">{activeKey}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span className="text-xs text-muted-foreground">{maintenanceKey}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-xs text-muted-foreground">{expiredKey}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
