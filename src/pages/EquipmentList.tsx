import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EquipmentTable } from '@/components/equipment/EquipmentTable';
import { useEquipment } from '@/hooks/useEquipment';
import { useCategories } from '@/hooks/useCategories';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryIcon } from '@/utils/categoryIcons';
import { PageHeader } from '@/components/layout/PageHeader';

export default function EquipmentList() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('all');
  const { data: equipment = [], isLoading: equipmentLoading } = useEquipment();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  const isLoading = equipmentLoading || categoriesLoading;

  const filteredEquipment = activeTab === 'all' 
    ? equipment 
    : equipment.filter(e => e.category_id === activeTab);

  const getCategoryCount = (categoryId: string) => {
    return equipment.filter(e => e.category_id === categoryId).length;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-32 flex-shrink-0" />
            ))}
          </div>
        </div>
        <TableSkeleton columns={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Package}
        title={t('equipment.title')}
        subtitle={t('equipment.subtitle')}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto p-1 bg-muted/50 rounded-lg">
            {/* All Tab */}
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all",
                activeTab === 'all'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Package className="h-4 w-4" />
              <span>{t('common.all')}</span>
              <span className={cn(
                "ml-1 px-1.5 py-0.5 text-xs rounded-full",
                activeTab === 'all'
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}>
                {equipment.length}
              </span>
            </button>

            {/* Category Tabs */}
            {categories.map((category) => {
              const IconComponent = getCategoryIcon(category.icon);
              const count = getCategoryCount(category.id);
              const isActive = activeTab === category.id;
              
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveTab(category.id)}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  <IconComponent className="h-4 w-4" />
                  <span>{category.name}</span>
                  <span className={cn(
                    "ml-1 px-1.5 py-0.5 text-xs rounded-full",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value={activeTab} className="mt-0">
          <EquipmentTable equipment={filteredEquipment} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
