import { useState } from 'react';
import { 
  FolderOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2,
  Search,
  Flame, Wind, Shield, Waves, Gauge, ArrowUp, Package, HardHat, LifeBuoy, Anchor,
  FireExtinguisher, Siren, AlertTriangle, Zap, Droplets, Thermometer, Activity, Radio, Bell,
  Construction, Wrench, Settings, Cog, Truck, Building, Factory, Warehouse, Cylinder, CircleDot,
  ShieldCheck, ShieldAlert, Eye, Camera, Lock, Key, Plug, Power, BatteryCharging,
  TriangleAlert, OctagonAlert, CircleAlert, Megaphone, Volume2, Flashlight, Lightbulb
} from 'lucide-react';
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

const frequencyLabels: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  custom: 'Personalizada',
};

const frequencyColors: Record<string, string> = {
  monthly: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  quarterly: 'bg-green-500/10 text-green-700 border-green-500/20',
  semiannual: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  annual: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  custom: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
};

export default function Categories() {
  const { data: categories = [], isLoading } = useCategories();
  const { data: equipment = [] } = useEquipment();
  const deleteCategory = useDeleteCategory();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{categories.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inspeção Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {categories.filter(c => c.inspection_frequency === 'monthly').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inspeção Trimestral</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {categories.filter(c => c.inspection_frequency === 'quarterly').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Equipamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{equipment.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Lista de Categorias</CardTitle>
              <CardDescription>Todas as categorias de equipamentos cadastradas</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar categorias..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchTerm ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'}
              </h3>
              {!searchTerm && (
                <>
                  <p className="text-muted-foreground mb-4">Crie sua primeira categoria de equipamentos</p>
                  <Button onClick={openCreateForm} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Categoria
                  </Button>
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead className="text-center">Equipamentos</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category) => {
                  const IconComponent = iconMap[category.icon || 'package'] || FolderOpen;
                  const equipmentCount = getEquipmentCount(category.id);
                  
                  return (
                    <TableRow key={category.id} className="group">
                      <TableCell>
                        <div className="p-2 bg-primary/10 rounded-lg w-fit">
                          <IconComponent className="h-5 w-5 text-primary" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{category.name}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
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
                        <span className="font-medium">{equipmentCount}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria <strong>{selectedCategory?.name}</strong>?
              {getEquipmentCount(selectedCategory?.id || '') > 0 && (
                <span className="block mt-2 text-destructive">
                  Atenção: Esta categoria possui {getEquipmentCount(selectedCategory?.id || '')} equipamento(s) vinculado(s). A exclusão pode falhar.
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
