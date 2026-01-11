import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VirtualizedEquipmentTable } from '@/components/equipment/VirtualizedEquipmentTable';
import { useCategories } from '@/hooks/useCategories';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryIcon } from '@/utils/categoryIcons';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEquipmentPaginated } from '@/hooks/useEquipmentPaginated';

export default function EquipmentList() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('all');
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  
  // Get counts for each category using paginated hook
  const { data: allEquipmentData } = useEquipmentPaginated({});
  const totalCount = allEquipmentData?.pages[0]?.totalCount || 0;

  if (categoriesLoading) {
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
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const selectedCategory = activeTab !== 'all' 
    ? categories.find(c => c.id === activeTab)
    : undefined;

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
                {totalCount}
              </span>
            </button>

            {/* Category Tabs */}
            {categories.map((category) => {
              const IconComponent = getCategoryIcon(category.icon);
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
                </button>
              );
            })}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value={activeTab} className="mt-0">
          <VirtualizedEquipmentTable 
            categoryId={activeTab !== 'all' ? activeTab : undefined}
            categoryName={selectedCategory?.name}
            categoryDescription={selectedCategory?.description || undefined}
            inspectionFrequency={selectedCategory?.inspection_frequency}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
