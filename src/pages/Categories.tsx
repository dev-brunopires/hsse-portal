import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FolderOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2,
  Search,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import { getCategoryIcon } from '@/utils/categoryIcons';

const frequencyColors: Record<string, string> = {
  monthly: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  quarterly: 'bg-green-500/10 text-green-700 border-green-500/20',
  semiannual: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  annual: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  custom: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
};

export default function Categories() {
  const { t } = useTranslation();
  const { data: categories, isLoading } = useCategories();
  const { data: equipment } = useEquipment();
  const deleteCategory = useDeleteCategory();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const frequencyLabels: Record<string, string> = {
    monthly: t('categories.frequencyMonthly'),
    quarterly: t('categories.frequencyQuarterly'),
    semiannual: t('categories.frequencySemiannual'),
    annual: t('categories.frequencyAnnual'),
    custom: t('common.optional'),
  };

  const filteredCategories = categories?.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getEquipmentCount = (categoryId: string) => {
    return equipment?.filter(e => e.category_id === categoryId).length || 0;
  };

  const handleCreate = () => {
    setFormMode('create');
    setSelectedCategory(null);
    setFormOpen(true);
  };

  const handleEdit = (category: Category) => {
    setFormMode('edit');
    setSelectedCategory(category);
    setFormOpen(true);
  };

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (categoryToDelete) {
      await deleteCategory.mutateAsync(categoryToDelete.id);
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{t('categoriesPage.equipmentCategories')}</CardTitle>
                <CardDescription>{t('common.loading')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={FolderOpen}
        title={t('categoriesPage.equipmentCategories')}
        subtitle={t('categoriesPage.manageFrequencies')}
        actions={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('categories.newCategory')}
          </Button>
        }
      />
      <Card>
        <CardContent className="pt-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('categoriesPage.searchCategories')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {searchTerm ? t('categoriesPage.noCategoryFound') : t('categoriesPage.noCategoryRegistered')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? t('categoriesPage.tryDifferentSearch') : t('categoriesPage.clickNewCategory')}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12"></TableHead>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('common.description')}</TableHead>
                    <TableHead>{t('categoriesPage.frequency')}</TableHead>
                    <TableHead className="text-center">{t('categoriesPage.equipmentCount')}</TableHead>
                    <TableHead className="w-24">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.map((category) => {
                    const IconComponent = getCategoryIcon(category.icon);
                    const equipmentCount = getEquipmentCount(category.id);
                    
                    return (
                      <TableRow key={category.id} className="group">
                        <TableCell>
                          <div className="p-2 bg-primary/10 rounded-lg w-fit">
                            <IconComponent className="h-4 w-4 text-primary" />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground max-w-xs truncate">
                          {category.description || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={frequencyColors[category.inspection_frequency] || ''}
                          >
                            {frequencyLabels[category.inspection_frequency] || category.inspection_frequency}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{equipmentCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(category)}
                              disabled={equipmentCount > 0}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        category={selectedCategory}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('categoriesPage.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              <span dangerouslySetInnerHTML={{ 
                __html: t('categoriesPage.confirmDeleteCategory', { name: categoryToDelete?.name }) 
              }} />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCategory.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('categoriesPage.deleting')}
                </>
              ) : (
                t('common.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
