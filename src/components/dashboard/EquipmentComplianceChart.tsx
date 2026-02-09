import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { CheckCircle2, XCircle, AlertTriangle, Filter } from 'lucide-react';
import { useInspections } from '@/hooks/useInspections';
import { useEquipment } from '@/hooks/useEquipment';
import { useCategories } from '@/hooks/useCategories';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

export function EquipmentComplianceChart() {
  const { t } = useTranslation();
  const { data: inspections = [], isLoading: inspectionsLoading } = useInspections();
  const { data: equipment = [], isLoading: equipmentLoading } = useEquipment();
  const { data: categories = [] } = useCategories();
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Build a map: equipment_id -> category name
  const equipCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    equipment.forEach(eq => {
      map.set(eq.id, eq.categories?.name || t('complianceChart.noCategory'));
    });
    return map;
  }, [equipment, t]);

  const chartData = useMemo(() => {
    const categoryMap = new Map<string, {
      category: string;
      compliant: number;
      attention: number;
      nonCompliant: number;
      total: number;
    }>();

    // Filter inspections by selected category if needed
    const filteredInspections = selectedCategory === 'all'
      ? inspections
      : inspections.filter(insp => {
          const eq = equipment.find(e => e.id === insp.equipment_id);
          return eq?.category_id === selectedCategory;
        });

    filteredInspections.forEach(insp => {
      const catName = equipCategoryMap.get(insp.equipment_id) || t('complianceChart.noCategory');
      
      if (!categoryMap.has(catName)) {
        categoryMap.set(catName, {
          category: catName,
          compliant: 0,
          attention: 0,
          nonCompliant: 0,
          total: 0,
        });
      }

      const cat = categoryMap.get(catName)!;
      cat.total++;
      if (insp.status === 'compliant') cat.compliant++;
      else if (insp.status === 'attention') cat.attention++;
      else if (insp.status === 'non-compliant') cat.nonCompliant++;
    });

    return Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);
  }, [inspections, equipment, equipCategoryMap, selectedCategory, t]);

  const totals = useMemo(() => {
    const totalCompliant = chartData.reduce((sum, c) => sum + c.compliant, 0);
    const totalAttention = chartData.reduce((sum, c) => sum + c.attention, 0);
    const totalNonCompliant = chartData.reduce((sum, c) => sum + c.nonCompliant, 0);
    const total = totalCompliant + totalAttention + totalNonCompliant;
    
    return {
      total,
      compliant: totalCompliant,
      attention: totalAttention,
      nonCompliant: totalNonCompliant,
      complianceRate: total > 0 ? (totalCompliant / total) * 100 : 0,
    };
  }, [chartData]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const complianceRate = data.total > 0 ? (data.compliant / data.total) * 100 : 0;
      
      return (
        <div className="bg-card border rounded-xl shadow-lg p-3 min-w-[180px]">
          <p className="font-semibold text-foreground mb-2">{data.category}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('common.total')}:</span>
              <span className="font-medium">{data.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-500">{t('complianceChart.compliant')}:</span>
              <span className="font-medium">{data.compliant}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-500">{t('complianceChart.attention')}:</span>
              <span className="font-medium">{data.attention}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-500">{t('complianceChart.nonCompliant')}:</span>
              <span className="font-medium">{data.nonCompliant}</span>
            </div>
            <div className="pt-1 border-t mt-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('complianceChart.compliance')}:</span>
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
              <h3 className="font-semibold text-foreground">{t('complianceChart.titleByCategory', 'Conformidade por Categoria')}</h3>
              <p className="text-sm text-muted-foreground">{t('complianceChart.subtitleByCategory', 'Resultado das inspeções agrupado por categoria')}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {totals.compliant} {t('complianceChart.compliant')}
            </Badge>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {totals.attention} {t('complianceChart.attention')}
            </Badge>
            <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
              <XCircle className="h-3 w-3 mr-1" />
              {totals.nonCompliant} {t('complianceChart.nonCompliant')}
            </Badge>
          </div>
        </div>

        {/* Category Filter */}
        <div className="mt-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[250px] h-9">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('complianceChart.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('complianceChart.allCategories')}</SelectItem>
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
            <p className="font-medium">{t('complianceChart.noEquipmentFound')}</p>
            <p className="text-sm">{t('complianceChart.adjustFilters')}</p>
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
                  dataKey="category"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  width={120}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={(value) => {
                    if (value === 'compliant') return t('complianceChart.compliant');
                    if (value === 'attention') return t('complianceChart.attention');
                    if (value === 'nonCompliant') return t('complianceChart.nonCompliant');
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
              <p className="text-xs text-muted-foreground">{t('complianceChart.totalInspections')}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className={`text-2xl font-bold ${
                totals.complianceRate >= 80 ? 'text-emerald-500' : 
                totals.complianceRate >= 50 ? 'text-yellow-500' : 'text-red-500'
              }`}>{totals.complianceRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">{t('complianceChart.complianceRate')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
