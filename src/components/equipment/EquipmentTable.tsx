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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  User,
  Info,
} from 'lucide-react';
import { Equipment, InspectionFrequency } from '@/types/equipment';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface EquipmentTableProps {
  equipment: Equipment[];
  categoryName?: string;
  categoryDescription?: string;
  inspectionFrequency?: InspectionFrequency;
}

const frequencyLabels: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  custom: 'Personalizada',
};

const mockInspectors = [
  { id: 'insp-1', name: 'Carlos Silva', role: 'Técnico de Segurança' },
  { id: 'insp-2', name: 'Maria Santos', role: 'Engenheira de Segurança' },
  { id: 'insp-3', name: 'João Oliveira', role: 'Técnico de Manutenção' },
  { id: 'insp-4', name: 'Ana Costa', role: 'Inspetora Certificada' },
];

export function EquipmentTable({ 
  equipment, 
  categoryName,
  categoryDescription,
  inspectionFrequency 
}: EquipmentTableProps) {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [inspectionData, setInspectionData] = useState({
    inspector: '',
    date: new Date().toISOString().split('T')[0],
    status: 'compliant',
    observations: '',
  });
  const { toast } = useToast();

  const filteredEquipment = equipment.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.internalCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  const openInspectionDialog = (eq: Equipment) => {
    setSelectedEquipment(eq);
    setInspectionData({
      inspector: '',
      date: new Date().toISOString().split('T')[0],
      status: 'compliant',
      observations: '',
    });
    setInspectionDialogOpen(true);
  };

  const handleInspectionSubmit = () => {
    if (!inspectionData.inspector) {
      toast({
        title: "Erro",
        description: "Selecione o responsável pela inspeção",
        variant: "destructive",
      });
      return;
    }

    const inspector = mockInspectors.find(i => i.id === inspectionData.inspector);
    
    toast({
      title: "Inspeção Registrada",
      description: `Inspeção do equipamento ${selectedEquipment?.internalCode} registrada por ${inspector?.name}`,
    });
    
    setInspectionDialogOpen(false);
    setSelectedEquipment(null);
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
                  {frequencyLabels[inspectionFrequency]}
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
              <Button className="gap-2">
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
                    Nenhum equipamento encontrado nesta categoria
                  </TableCell>
                </TableRow>
              ) : (
                filteredEquipment.map((item) => (
                  <TableRow 
                    key={item.id}
                    className={cn(
                      'transition-colors',
                      selectedRows.includes(item.id) && 'bg-primary/5'
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedRows.includes(item.id)}
                        onCheckedChange={() => toggleRow(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium text-primary">
                      {item.internalCode}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.serialNumber}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{item.location}</p>
                        <p className="text-xs text-muted-foreground">{item.unit}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} size="sm" />
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(item.lastInspection).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(item.nextInspection).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(item.certificateExpiry).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg z-50">
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Eye className="h-4 w-4" /> Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Edit className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 cursor-pointer"
                            onClick={() => openInspectionDialog(item)}
                          >
                            <ClipboardCheck className="h-4 w-4" /> Registrar Inspeção
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2 text-destructive cursor-pointer">
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">1</Button>
            <Button variant="outline" size="sm">Próximo</Button>
          </div>
        </div>
      </div>

      {/* Inspection Dialog */}
      <Dialog open={inspectionDialogOpen} onOpenChange={setInspectionDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Registrar Inspeção
            </DialogTitle>
            <DialogDescription>
              {selectedEquipment && (
                <span>
                  Equipamento: <strong>{selectedEquipment.internalCode}</strong> - {selectedEquipment.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Inspector Selection */}
            <div className="space-y-2">
              <Label htmlFor="inspector" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Responsável pela Inspeção *
              </Label>
              <Select 
                value={inspectionData.inspector} 
                onValueChange={(value) => setInspectionData(prev => ({ ...prev, inspector: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o inspetor responsável" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  {mockInspectors.map((inspector) => (
                    <SelectItem key={inspector.id} value={inspector.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{inspector.name}</span>
                        <span className="text-xs text-muted-foreground">{inspector.role}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Inspection Date */}
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data da Inspeção
              </Label>
              <Input
                id="date"
                type="date"
                value={inspectionData.date}
                onChange={(e) => setInspectionData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            {/* Inspection Status */}
            <div className="space-y-2">
              <Label>Resultado da Inspeção</Label>
              <Select 
                value={inspectionData.status} 
                onValueChange={(value) => setInspectionData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  <SelectItem value="compliant">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-status-success" />
                      Conforme
                    </div>
                  </SelectItem>
                  <SelectItem value="attention">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-status-warning" />
                      Atenção
                    </div>
                  </SelectItem>
                  <SelectItem value="non-compliant">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-status-danger" />
                      Não Conforme
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Observations */}
            <div className="space-y-2">
              <Label htmlFor="observations">Observações</Label>
              <Textarea
                id="observations"
                placeholder="Adicione observações sobre a inspeção..."
                value={inspectionData.observations}
                onChange={(e) => setInspectionData(prev => ({ ...prev, observations: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInspectionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInspectionSubmit} className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Registrar Inspeção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
