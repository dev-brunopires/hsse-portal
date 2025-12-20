import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EquipmentTable } from '@/components/equipment/EquipmentTable';
import { useEquipment } from '@/hooks/useEquipment';
import { useCategories } from '@/hooks/useCategories';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Flame, Wind, Shield, Waves, Gauge, ArrowUp, Package, FolderOpen,
  FireExtinguisher, Siren, AlertTriangle, Zap, Droplets, Thermometer, Activity, Radio, Bell,
  Construction, Wrench, Settings, Cog, Truck, Building, Factory, Warehouse, Cylinder, CircleDot,
  ShieldCheck, ShieldAlert, Eye, Camera, Lock, Key, Plug, Power, BatteryCharging,
  TriangleAlert, OctagonAlert, CircleAlert, Megaphone, Volume2, Flashlight, Lightbulb,
  HardHat, LifeBuoy, Anchor
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  // Combate a incêndio
  'fire-extinguisher': FireExtinguisher,
  'flame': Flame,
  'droplets': Droplets,
  'waves': Waves,
  'siren': Siren,
  'megaphone': Megaphone,
  
  // Segurança e alertas
  'shield': Shield,
  'shield-check': ShieldCheck,
  'shield-alert': ShieldAlert,
  'alert-triangle': AlertTriangle,
  'triangle-alert': TriangleAlert,
  'octagon-alert': OctagonAlert,
  'circle-alert': CircleAlert,
  
  // Equipamentos industriais
  'cylinder': Cylinder,
  'gauge': Gauge,
  'thermometer': Thermometer,
  'activity': Activity,
  
  // EPIs e proteção
  'hard-hat': HardHat,
  'eye': Eye,
  'life-buoy': LifeBuoy,
  
  // Elétrica e energia
  'zap': Zap,
  'plug': Plug,
  'power': Power,
  'battery-charging': BatteryCharging,
  'lightbulb': Lightbulb,
  'flashlight': Flashlight,
  
  // Ferramentas e manutenção
  'wrench': Wrench,
  'settings': Settings,
  'cog': Cog,
  'construction': Construction,
  
  // Comunicação e monitoramento
  'radio': Radio,
  'bell': Bell,
  'volume-2': Volume2,
  'camera': Camera,
  
  // Estruturas e locais
  'building': Building,
  'factory': Factory,
  'warehouse': Warehouse,
  'truck': Truck,
  
  // Outros
  'wind': Wind,
  'arrow-up': ArrowUp,
  'package': Package,
  'anchor': Anchor,
  'lock': Lock,
  'key': Key,
  'circle-dot': CircleDot,
};

export default function EquipmentList() {
  const [activeTab, setActiveTab] = useState('all');
  const { data: equipment = [], isLoading: equipmentLoading } = useEquipment();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  const getEquipmentByCategory = (categoryId: string) => {
    if (categoryId === 'all') return equipment;
    return equipment.filter(eq => eq.category_id === categoryId);
  };

  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') return equipment.length;
    return equipment.filter(eq => eq.category_id === categoryId).length;
  };

  const isLoading = equipmentLoading || categoriesLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Page Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="bg-card border border-border rounded-lg p-2">
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-28 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Table Skeleton */}
        <TableSkeleton columns={7} rows={8} />
      </div>
    );
  }

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
        <div className="bg-card border border-border rounded-lg p-2">
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {/* All Equipment Tab */}
              <button
                onClick={() => setActiveTab('all')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-all',
                  'text-sm font-medium',
                  activeTab === 'all'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Package className="h-4 w-4" />
                <span>Todos</span>
                <span className={cn(
                  'px-2 py-0.5 text-xs rounded-full',
                  activeTab === 'all'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-background text-foreground'
                )}>
                  {getCategoryCount('all')}
                </span>
              </button>

              {/* Category Tabs */}
              {categories.map((category) => {
                const IconComponent = iconMap[category.icon || 'package'] || FolderOpen;
                const count = getCategoryCount(category.id);
                const isActive = activeTab === category.id;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveTab(category.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-all',
                      'text-sm font-medium',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <IconComponent className="h-4 w-4" />
                    <span>{category.name}</span>
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded-full',
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-background text-foreground'
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* All Equipment Content */}
        <TabsContent value="all" className="mt-6">
          <EquipmentTable 
            equipment={getEquipmentByCategory('all')} 
            categoryName="Todos os Equipamentos"
          />
        </TabsContent>

        {/* Category-specific Content */}
        {categories.map((category) => (
          <TabsContent key={category.id} value={category.id} className="mt-6">
            <EquipmentTable 
              equipment={getEquipmentByCategory(category.id)} 
              categoryName={category.name}
              categoryDescription={category.description || undefined}
              inspectionFrequency={category.inspection_frequency as any}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
