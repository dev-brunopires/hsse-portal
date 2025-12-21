import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Layers, TrendingUp } from 'lucide-react';
import { useEquipment } from '@/hooks/useEquipment';
import { useCategories } from '@/hooks/useCategories';
import { Skeleton } from '@/components/ui/skeleton';

export function EquipmentStatusByCategoryChart() {
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
        Ativos: active,
        'Em Manutenção': maintenance,
        'Vencidos/Reprovados': expired,
        total,
      };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [equipment, categories]);

  const totals = useMemo(() => {
    return chartData.reduce((acc, item) => ({
      active: acc.active + item.Ativos,
      maintenance: acc.maintenance + item['Em Manutenção'],
      expired: acc.expired + item['Vencidos/Reprovados'],
    }), { active: 0, maintenance: 0, expired: 0 });
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-card border rounded-xl shadow-lg p-3 min-w-[180px]">
          <p className="font-semibold text-foreground mb-2">{data?.fullName}</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Ativos:</span>
              </div>
              <span className="font-medium">{data?.Ativos}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">Em Manutenção:</span>
              </div>
              <span className="font-medium">{data?.['Em Manutenção']}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Vencidos:</span>
              </div>
              <span className="font-medium">{data?.['Vencidos/Reprovados']}</span>
            </div>
            <div className="pt-1.5 border-t mt-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Total:</span>
                <span className="font-bold">{data?.total}</span>
              </div>
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

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-5 border-b bg-gradient-to-r from-muted/50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Status por Categoria</h3>
              <p className="text-sm text-muted-foreground">Distribuição de equipamentos</p>
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
      
      <div className="p-5">
        <div className="h-52">
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
                dataKey="Ativos" 
                stackId="a"
                fill="#10b981" 
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="Em Manutenção" 
                stackId="a"
                fill="#f59e0b" 
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="Vencidos/Reprovados" 
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
            <span className="text-xs text-muted-foreground">Ativos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span className="text-xs text-muted-foreground">Em Manutenção</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-xs text-muted-foreground">Vencidos</span>
          </div>
        </div>
      </div>
    </div>
  );
}