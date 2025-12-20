import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { CategoryStats } from '@/types/equipment';
import { BarChart3 } from 'lucide-react';

interface ModernCategoryChartProps {
  data: CategoryStats[];
}

const COLORS = {
  compliant: '#22c55e',
  nonCompliant: '#ef4444',
};

export function ModernCategoryChart({ data }: ModernCategoryChartProps) {
  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-5 border-b bg-gradient-to-r from-muted/50 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Conformidade por Categoria</h3>
            <p className="text-sm text-muted-foreground">Distribuição de equipamentos conformes e não conformes</p>
          </div>
        </div>
      </div>
      
      <div className="p-5">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data} 
              layout="vertical" 
              margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
              barGap={4}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                horizontal={true}
                vertical={false}
              />
              <XAxis 
                type="number" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                dataKey="category" 
                type="category" 
                width={100} 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
              />
              <Legend 
                verticalAlign="top" 
                height={36}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-sm text-muted-foreground ml-1">{value}</span>
                )}
              />
              <Bar 
                dataKey="compliant" 
                name="Conforme" 
                fill={COLORS.compliant}
                radius={[0, 6, 6, 0]} 
                maxBarSize={24}
              />
              <Bar 
                dataKey="nonCompliant" 
                name="Não Conforme" 
                fill={COLORS.nonCompliant}
                radius={[0, 6, 6, 0]} 
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
