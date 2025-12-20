import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from 'recharts';
import { CheckCircle2, XCircle, AlertTriangle, Filter, Search } from 'lucide-react';
import { useInspections } from '@/hooks/useInspections';
import { useEquipment } from '@/hooks/useEquipment';
import { useCategories } from '@/hooks/useCategories';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export function EquipmentComplianceChart() {
  const { data: inspections = [], isLoading: inspectionsLoading } = useInspections();
  const { data: equipment = [], isLoading: equipmentLoading } = useEquipment();
  const { data: categories = [] } = useCategories();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const chartData = useMemo(() => {
    // Get latest inspection status for each equipment
    const equipmentMap = new Map<string, {
      id: string;
      name: string;
      code: string;
      category: string;
      categoryId: string;
      compliant: number;
      attention: number;
      nonCompliant: number;
      total: number;
    }>();

    // Initialize with all equipment
    equipment.forEach(eq => {
      equipmentMap.set(eq.id, {
        id: eq.id,
        name: eq.name,
        code: eq.internal_code,
        category: eq.categories?.name || 'Sem categoria',
        categoryId: eq.category_id,
        compliant: 0,
        attention: 0,
        nonCompliant: 0,
        total: 0,
      });
    });

    // Count inspections per equipment
    inspections.forEach(insp => {
      const eq = equipmentMap.get(insp.equipment_id);
      if (eq) {
        eq.total++;
        if (insp.status === 'compliant') {
          eq.compliant++;
        } else if (insp.status === 'attention') {
          eq.attention++;
        } else if (insp.status === 'non-compliant') {
          eq.nonCompliant++;
        }
      }
    });

    // Convert to array and filter
    let result = Array.from(equipmentMap.values())
      .filter(eq => eq.total > 0); // Only show equipment with inspections

    // Apply category filter
    if (selectedCategory !== 'all') {
      result = result.filter(eq => eq.categoryId === selectedCategory);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(eq => 
        eq.name.toLowerCase().includes(query) ||
        eq.code.toLowerCase().includes(query)
      );
    }

    // Sort by total inspections descending
    result.sort((a, b) => b.total - a.total);

    // Limit to top 10 for readability
    return result.slice(0, 10);
  }, [inspections, equipment, selectedCategory, searchQuery]);

  const totals = useMemo(() => {
    const totalCompliant = chartData.reduce((sum, eq) => sum + eq.compliant, 0);
    const totalAttention = chartData.reduce((sum, eq) => sum + eq.attention, 0);
    const totalNonCompliant = chartData.reduce((sum, eq) => sum + eq.nonCompliant, 0);
    const total = totalCompliant + totalAttention + totalNonCompliant;
    
    return {
      total,
      compliant: totalCompliant,
      attention: totalAttention,
      nonCompliant: totalNonCompliant,
      complianceRate: total > 0 ? (totalCompliant / total) * 100 : 0,
    };
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const complianceRate = data.total > 0 ? (data.compliant / data.total) * 100 : 0;
      
      return (
        <div className="bg-card border rounded-xl shadow-lg p-3 min-w-[180px]">
          <p className="font-semibold text-foreground mb-1">{data.name}</p>
          <p className="text-xs text-muted-foreground mb-2">{data.code}</p>
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
              <span className="text-yellow-500">Atenção:</span>
              <span className="font-medium">{data.attention}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-500">Não conformes:</span>
              <span className="font-medium">{data.nonCompliant}</span>
            </div>
            <div className="pt-1 border-t mt-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conformidade:</span>
                <span className={`font-medium ${
                  complianceRate >= 80 ? 'text-emerald-500' : 
                  complianceRate >= 50 ? 'text-yellow-500' : 'text-red-500'
                }`}>{complianceRate.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const isLoading = inspectionsLoading || equipmentLoading;

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border shadow-sm p-5 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-5 border-b bg-gradient-to-r from-muted/50 to-transparent">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Conformidade por Equipamento</h3>
              <p className="text-sm text-muted-foreground">Top 10 equipamentos inspecionados</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {totals.compliant} Conformes
            </Badge>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {totals.attention} Atenção
            </Badge>
            <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
              <XCircle className="h-3 w-3 mr-1" />
              {totals.nonCompliant} Não Conformes
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar equipamento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px] h-9">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Todas categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="p-5">
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mb-4 opacity-30" />
            <p className="font-medium">Nenhum equipamento encontrado</p>
            <p className="text-sm">Ajuste os filtros ou realize inspeções</p>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
                <XAxis 
                  type="number"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  type="category"
                  dataKey="code"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={(value) => {
                    if (value === 'compliant') return 'Conformes';
                    if (value === 'attention') return 'Atenção';
                    if (value === 'nonCompliant') return 'Não Conformes';
                    return value;
                  }}
                />
                <Bar 
                  dataKey="compliant" 
                  stackId="a" 
                  fill="#10b981" 
                  radius={[0, 0, 0, 0]}
                  name="compliant"
                />
                <Bar 
                  dataKey="attention" 
                  stackId="a" 
                  fill="#eab308" 
                  radius={[0, 0, 0, 0]}
                  name="attention"
                />
                <Bar 
                  dataKey="nonCompliant" 
                  stackId="a" 
                  fill="#ef4444" 
                  radius={[4, 4, 4, 4]}
                  name="nonCompliant"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Summary */}
        {chartData.length > 0 && (
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{totals.total}</p>
              <p className="text-xs text-muted-foreground">Total Inspeções</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className={`text-2xl font-bold ${
                totals.complianceRate >= 80 ? 'text-emerald-500' : 
                totals.complianceRate >= 50 ? 'text-yellow-500' : 'text-red-500'
              }`}>{totals.complianceRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Taxa de Conformidade</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
