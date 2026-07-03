import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VirtualizedEquipmentTable } from '@/components/equipment/VirtualizedEquipmentTable';
import { useCategories } from '@/hooks/useCategories';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Info, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryIcon } from '@/utils/categoryIcons';
import { PageHeader } from '@/components/layout/PageHeader';

export default function EquipmentList() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('all');
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

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
    ? categories.find(c => String(c.id) === String(activeTab))
    : undefined;
  const selectedFrequency = selectedCategory?.inspection_frequency || (activeTab !== 'all' ? 'monthly' : undefined);
  const selectedCategoryText = selectedCategory?.description || selectedCategory?.name || t('equipment.selectedCategory', 'Categoria selecionada');
  const frequencyLabels: Record<string, string> = {
    monthly: t('equipmentTable.frequencyMonthly'),
    quarterly: t('equipmentTable.frequencyQuarterly'),
    semiannual: t('equipmentTable.frequencySemiannual'),
    annual: t('equipmentTable.frequencyAnnual'),
    custom: t('equipmentTable.frequencyCustom'),
  };

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
            </button>

            {/* Category Tabs */}
            {categories.map((category) => {
              const IconComponent = getCategoryIcon(category.icon);
              const isActive = String(activeTab) === String(category.id);
              
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveTab(String(category.id))}
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
          {activeTab !== 'all' && (
            <div className="mb-6 px-4 py-3 bg-primary/5 border border-border rounded-lg flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">{selectedCategoryText}</span>
              </div>
              {selectedFrequency && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('equipmentTable.inspectionFrequency')}:</span>
                  <span className="font-medium text-foreground">
                    {frequencyLabels[selectedFrequency] || selectedFrequency}
                  </span>
                </div>
              )}
            </div>
          )}
          <VirtualizedEquipmentTable 
            categoryId={activeTab !== 'all' ? activeTab : undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
