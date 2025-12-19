import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EquipmentTable } from '@/components/equipment/EquipmentTable';
import { mockEquipment, mockCategories } from '@/data/mockData';
import { 
  Flame, 
  Wind, 
  Shield, 
  Waves, 
  Gauge, 
  ArrowUp, 
  Package,
  FolderOpen 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  flame: Flame,
  wind: Wind,
  shield: Shield,
  waves: Waves,
  gauge: Gauge,
  'arrow-up': ArrowUp,
};

export default function EquipmentList() {
  const [activeTab, setActiveTab] = useState('all');

  const getEquipmentByCategory = (categoryId: string) => {
    if (categoryId === 'all') return mockEquipment;
    return mockEquipment.filter(eq => eq.categoryId === categoryId);
  };

  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') return mockEquipment.length;
    return mockEquipment.filter(eq => eq.categoryId === categoryId).length;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipamentos</h1>
          <p className="text-muted-foreground">
            Gerenciamento completo de equipamentos de segurança por categoria
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-border">
          <TabsList className="h-auto p-0 bg-transparent flex flex-wrap gap-1">
            {/* All Equipment Tab */}
            <TabsTrigger
              value="all"
              className={cn(
                'px-4 py-3 rounded-t-lg rounded-b-none border-b-2 border-transparent',
                'data-[state=active]:border-primary data-[state=active]:bg-primary/5',
                'data-[state=active]:shadow-none',
                'hover:bg-muted/50 transition-all'
              )}
            >
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="font-medium">Todos</span>
                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-muted">
                  {getCategoryCount('all')}
                </span>
              </div>
            </TabsTrigger>

            {/* Category Tabs */}
            {mockCategories.map((category) => {
              const IconComponent = iconMap[category.icon] || FolderOpen;
              const count = getCategoryCount(category.id);
              
              return (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className={cn(
                    'px-4 py-3 rounded-t-lg rounded-b-none border-b-2 border-transparent',
                    'data-[state=active]:border-primary data-[state=active]:bg-primary/5',
                    'data-[state=active]:shadow-none',
                    'hover:bg-muted/50 transition-all'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-4 w-4" />
                    <span className="font-medium">{category.name}</span>
                    <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-muted">
                      {count}
                    </span>
                  </div>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* All Equipment Content */}
        <TabsContent value="all" className="mt-6">
          <EquipmentTable 
            equipment={getEquipmentByCategory('all')} 
            categoryName="Todos os Equipamentos"
          />
        </TabsContent>

        {/* Category-specific Content */}
        {mockCategories.map((category) => (
          <TabsContent key={category.id} value={category.id} className="mt-6">
            <EquipmentTable 
              equipment={getEquipmentByCategory(category.id)} 
              categoryName={category.name}
              categoryDescription={category.description}
              inspectionFrequency={category.inspectionFrequency}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
