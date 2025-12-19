import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2, 
  ClipboardCheck,
  Download,
  Filter,
  Search,
  Plus,
  ArrowUpDown,
  Calendar,
  Info,
  Loader2,
} from 'lucide-react';
import type { EquipmentWithCategory } from '@/hooks/useEquipment';
import { useDeleteEquipment } from '@/hooks/useEquipment';
import { StatusBadge } from './StatusBadge';
import { EquipmentFormDialog } from './EquipmentFormDialog';
import { InspectionFormDialog } from './InspectionFormDialog';
import { EquipmentDetailDialog } from './EquipmentDetailDialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EquipmentTableProps {
  equipment: EquipmentWithCategory[];
  categoryName?: string;
  categoryDescription?: string;
  inspectionFrequency?: string;
}

const frequencyLabels: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  custom: 'Personalizada',
};

export function EquipmentTable({ 
  equipment, 
  categoryName,
  categoryDescription,
  inspectionFrequency 
}: EquipmentTableProps) {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Dialog states
  const [equipmentFormOpen, setEquipmentFormOpen] = useState(false);
  const [inspectionFormOpen, setInspectionFormOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithCategory | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  const deleteEquipment = useDeleteEquipment();

  const filteredEquipment = equipment.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.internal_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const toggleRow = (id: string) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedRows(prev => 
      prev.length === filteredEquipment.length ? [] : filteredEquipment.map(e => e.id)
    );
  };

  const openCreateForm = () => {
    setFormMode('create');
    setSelectedEquipment(null);
    setEquipmentFormOpen(true);
  };

  const openEditForm = (eq: EquipmentWithCategory) => {
    setFormMode('edit');
    setSelectedEquipment(eq);
    setEquipmentFormOpen(true);
  };

  const openInspectionForm = (eq: EquipmentWithCategory) => {
    setSelectedEquipment(eq);
    setInspectionFormOpen(true);
  };

  const openDetailDialog = (eq: EquipmentWithCategory) => {
    setSelectedEquipment(eq);
    setDetailDialogOpen(true);
  };

  const openDeleteDialog = (eq: EquipmentWithCategory) => {
    setSelectedEquipment(eq);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (selectedEquipment) {
      await deleteEquipment.mutateAsync(selectedEquipment.id);
      setDeleteDialogOpen(false);
      setSelectedEquipment(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Category Info Header */}
        {categoryDescription && (
          <div className="px-4 py-3 bg-primary/5 border-b border-border flex items-center gap-3">
            <Info className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <span className="text-sm text-foreground">{categoryDescription}</span>
            </div>
            {inspectionFrequency && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Frequência de Inspeção:</span>
                <span className="font-medium text-foreground">
                  {frequencyLabels[inspectionFrequency] || inspectionFrequency}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="p-4 border-b border-border space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código, nome, série..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="maintenance">Em Manutenção</SelectItem>
                  <SelectItem value="expired">Vencido</SelectItem>
                  <SelectItem value="rejected">Reprovado</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
              <Button className="gap-2" onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Novo Equipamento
              </Button>
            </div>
          </div>

          {selectedRows.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <span className="text-sm font-medium">
                {selectedRows.length} item(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Exportar Selecionados</Button>
                <Button variant="outline" size="sm">Gerar Relatório</Button>
                <Button variant="destructive" size="sm">Excluir</Button>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedRows.length === filteredEquipment.length && filteredEquipment.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="font-semibold">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-foreground">
                    Código <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="font-semibold">Equipamento</TableHead>
                <TableHead className="font-semibold">Localização</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Última Inspeção</TableHead>
                <TableHead className="font-semibold">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-foreground">
                    Próx. Inspeção <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="font-semibold">Validade Cert.</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEquipment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum equipamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredEquipment.map((item) => (
                  <TableRow 
                    key={item.id}
                    className={cn(
                      'transition-colors cursor-pointer',
                      selectedRows.includes(item.id) && 'bg-primary/5'
                    )}
                    onDoubleClick={() => openDetailDialog(item)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedRows.includes(item.id)}
                        onCheckedChange={() => toggleRow(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium text-primary">
                      {item.internal_code}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.serial_number}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{item.location}</p>
                        <p className="text-xs text-muted-foreground">{item.unit}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status as any} size="sm" />
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(item.last_inspection)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(item.next_inspection)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(item.certificate_expiry)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg z-50">
                          <DropdownMenuItem 
                            className="gap-2 cursor-pointer"
                            onClick={() => openDetailDialog(item)}
                          >
                            <Eye className="h-4 w-4" /> Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 cursor-pointer"
                            onClick={() => openEditForm(item)}
                          >
                            <Edit className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 cursor-pointer"
                            onClick={() => openInspectionForm(item)}
                          >
                            <ClipboardCheck className="h-4 w-4" /> Registrar Inspeção
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="gap-2 text-destructive cursor-pointer"
                            onClick={() => openDeleteDialog(item)}
                          >
                            <Trash2 className="h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {filteredEquipment.length} de {equipment.length} equipamentos
          </p>
        </div>
      </div>

      {/* Equipment Form Dialog */}
      <EquipmentFormDialog
        open={equipmentFormOpen}
        onOpenChange={setEquipmentFormOpen}
        mode={formMode}
        initialData={selectedEquipment ? {
          id: selectedEquipment.id,
          internalCode: selectedEquipment.internal_code,
          name: selectedEquipment.name,
          categoryId: selectedEquipment.category_id,
          type: selectedEquipment.type,
          manufacturer: selectedEquipment.manufacturer,
          model: selectedEquipment.model,
          serialNumber: selectedEquipment.serial_number,
          unit: selectedEquipment.unit,
          location: selectedEquipment.location,
          manufacturingDate: selectedEquipment.manufacturing_date,
          acquisitionDate: selectedEquipment.acquisition_date,
          expiryDate: selectedEquipment.expiry_date || '',
          certificateExpiry: selectedEquipment.certificate_expiry || '',
          observations: selectedEquipment.observations || '',
        } : undefined}
      />

      {/* Inspection Form Dialog */}
      <InspectionFormDialog
        open={inspectionFormOpen}
        onOpenChange={setInspectionFormOpen}
        equipment={selectedEquipment ? {
          id: selectedEquipment.id,
          name: selectedEquipment.name,
          internalCode: selectedEquipment.internal_code,
          type: selectedEquipment.type,
          category: selectedEquipment.categories?.name || '',
          location: selectedEquipment.location,
          unit: selectedEquipment.unit,
          lastInspection: selectedEquipment.last_inspection || '',
          status: selectedEquipment.status as any,
          serialNumber: selectedEquipment.serial_number,
          manufacturer: selectedEquipment.manufacturer,
          model: selectedEquipment.model,
          categoryId: selectedEquipment.category_id,
          manufacturingDate: selectedEquipment.manufacturing_date,
          acquisitionDate: selectedEquipment.acquisition_date,
          expiryDate: selectedEquipment.expiry_date || '',
          certificateExpiry: selectedEquipment.certificate_expiry || '',
          nextInspection: selectedEquipment.next_inspection || '',
        } : null}
      />

      {/* Equipment Detail Dialog */}
      <EquipmentDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        equipment={selectedEquipment ? {
          id: selectedEquipment.id,
          name: selectedEquipment.name,
          internalCode: selectedEquipment.internal_code,
          type: selectedEquipment.type,
          category: selectedEquipment.categories?.name || '',
          location: selectedEquipment.location,
          unit: selectedEquipment.unit,
          lastInspection: selectedEquipment.last_inspection || '',
          status: selectedEquipment.status as any,
          serialNumber: selectedEquipment.serial_number,
          manufacturer: selectedEquipment.manufacturer,
          model: selectedEquipment.model,
          categoryId: selectedEquipment.category_id,
          manufacturingDate: selectedEquipment.manufacturing_date,
          acquisitionDate: selectedEquipment.acquisition_date,
          expiryDate: selectedEquipment.expiry_date || '',
          certificateExpiry: selectedEquipment.certificate_expiry || '',
          nextInspection: selectedEquipment.next_inspection || '',
        } : null}
        onEdit={() => {
          setDetailDialogOpen(false);
          setFormMode('edit');
          setEquipmentFormOpen(true);
        }}
        onNewInspection={() => {
          setDetailDialogOpen(false);
          setInspectionFormOpen(true);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Equipamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o equipamento <strong>{selectedEquipment?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEquipment.isPending}
            >
              {deleteEquipment.isPending ? (
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
    </>
  );
}
