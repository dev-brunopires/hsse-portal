import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { StatusStats } from '@/types/equipment';
import { PieChart as PieChartIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModernStatusChartProps {
  data: StatusStats[];
  totalEquipment: number;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Ativo', color: '#22c55e', bgColor: 'bg-emerald-500' },
  maintenance: { label: 'Em Manutenção', color: '#f59e0b', bgColor: 'bg-amber-500' },
  expired: { label: 'Vencido', color: '#ef4444', bgColor: 'bg-red-500' },
  rejected: { label: 'Reprovado', color: '#dc2626', bgColor: 'bg-red-600' },
  inactive: { label: 'Inativo', color: '#64748b', bgColor: 'bg-slate-500' },
};

export function ModernStatusChart({ data, totalEquipment }: ModernStatusChartProps) {
  const chartData = data
    .filter(d => d.count > 0)
    .map(d => ({
      name: statusConfig[d.status]?.label || d.status,
      value: d.count,
      color: statusConfig[d.status]?.color || '#64748b',
      status: d.status,
      percentage: totalEquipment > 0 ? ((d.count / totalEquipment) * 100).toFixed(1) : 0,
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border rounded-xl shadow-lg p-3 min-w-[140px]">
          <p className="font-semibold text-foreground mb-1">{data.name}</p>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Quantidade:</span>
            <span className="font-medium">{data.value}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Percentual:</span>
            <span className="font-medium">{data.percentage}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-5 border-b bg-gradient-to-r from-muted/50 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <PieChartIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Status dos Equipamentos</h3>
            <p className="text-sm text-muted-foreground">Visão geral por status</p>
          </div>
        </div>
      </div>
      
      <div className="p-5">
        <div className="flex items-center gap-6">
          {/* Chart */}
          <div className="relative h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-foreground">{totalEquipment}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex-1 space-y-2">
            {chartData.map((item) => (
              <div 
                key={item.status}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium text-foreground">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{item.value}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
