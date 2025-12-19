import { useState } from 'react';
import { 
  FolderOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Flame, 
  Wind, 
  Shield, 
  Waves, 
  Gauge, 
  ArrowUp,
  Package,
  Loader2,
  HardHat,
  LifeBuoy,
  Anchor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCategories, useDeleteCategory, type Category } from '@/hooks/useCategories';
import { useEquipment } from '@/hooks/useEquipment';
import { CategoryFormDialog } from '@/components/categories/CategoryFormDialog';

const iconMap: Record<string, React.ElementType> = {
  flame: Flame,
  wind: Wind,
  shield: Shield,
  waves: Waves,
  gauge: Gauge,
  'arrow-up': ArrowUp,
  package: Package,
  'hard-hat': HardHat,
  'life-buoy': LifeBuoy,
  anchor: Anchor,
};

const frequencyLabels: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  custom: 'Personalizada',
};

export default function Categories() {
  const { data: categories = [], isLoading } = useCategories();
  const { data: equipment = [] } = useEquipment();
  const deleteCategory = useDeleteCategory();
  
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const openCreateForm = () => {
    setFormMode('create');
    setSelectedCategory(null);
    setFormOpen(true);
  };

  const openEditForm = (category: Category) => {
    setFormMode('edit');
    setSelectedCategory(category);
    setFormOpen(true);
  };

  const openDeleteDialog = (category: Category) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (selectedCategory) {
      await deleteCategory.mutateAsync(selectedCategory.id);
      setDeleteDialogOpen(false);
      setSelectedCategory(null);
    }
  };

  const getEquipmentCount = (categoryId: string) => {
    return equipment.filter(e => e.category_id === categoryId).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
          <p className="text-muted-foreground">
            Gerenciamento de tipos de equipamentos e regras de inspeção
          </p>
        </div>
        <Button className="gap-2" onClick={openCreateForm}>
          <Plus className="h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma categoria cadastrada</h3>
            <p className="text-muted-foreground mb-4">Crie sua primeira categoria de equipamentos</p>
            <Button onClick={openCreateForm} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Categoria
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => {
            const IconComponent = iconMap[category.icon || 'package'] || FolderOpen;
            const equipmentCount = getEquipmentCount(category.id);
            
            return (
              <Card key={category.id} className="hover:border-primary/50 transition-colors group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => openEditForm(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(category)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="mt-4">{category.name}</CardTitle>
                  <CardDescription>{category.description || 'Sem descrição'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frequência de Inspeção:</span>
                      <span className="font-medium">
                        {frequencyLabels[category.inspection_frequency] || category.inspection_frequency}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Equipamentos:</span>
                      <span className="font-medium">{equipmentCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        category={selectedCategory}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria <strong>{selectedCategory?.name}</strong>?
              {getEquipmentCount(selectedCategory?.id || '') > 0 && (
                <span className="block mt-2 text-destructive">
                  Atenção: Esta categoria possui equipamentos vinculados. A exclusão pode falhar.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCategory.isPending}
            >
              {deleteCategory.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
