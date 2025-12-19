import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { StatusStats } from '@/types/equipment';

interface StatusChartProps {
  data: StatusStats[];
}

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  maintenance: 'Em Manutenção',
  expired: 'Vencido',
  rejected: 'Reprovado',
  inactive: 'Inativo',
};

const COLORS = {
  active: 'hsl(152, 69%, 40%)',
  maintenance: 'hsl(38, 92%, 50%)',
  expired: 'hsl(0, 72%, 51%)',
  rejected: 'hsl(0, 72%, 41%)',
  inactive: 'hsl(215, 15%, 45%)',
};

export function StatusChart({ data }: StatusChartProps) {
  const chartData = data
    .filter(d => d.count > 0)
    .map(d => ({
      name: statusLabels[d.status] || d.status,
      value: d.count,
      color: COLORS[d.status as keyof typeof COLORS] || COLORS.inactive,
    }));

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="font-semibold text-foreground mb-4">Status dos Equipamentos</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
