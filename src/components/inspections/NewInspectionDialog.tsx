import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  ClipboardCheck, 
  Search, 
  Package,
  MapPin,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { useEquipment, type EquipmentWithCategory } from '@/hooks/useEquipment';
import { InspectionFormDialog } from '@/components/equipment/InspectionFormDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Equipment } from '@/types/equipment';

interface NewInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  maintenance: 'Manutenção',
  rejected: 'Rejeitado',
};

const statusColors: Record<string, string> = {
  active: 'bg-status-success/10 text-status-success border-status-success/30',
  inactive: 'bg-muted text-muted-foreground border-muted',
  maintenance: 'bg-status-warning/10 text-status-warning border-status-warning/30',
  rejected: 'bg-status-danger/10 text-status-danger border-status-danger/30',
};

export function NewInspectionDialog({ open, onOpenChange }: NewInspectionDialogProps) {
  const { data: equipmentList = [], isLoading } = useEquipment();
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithCategory | null>(null);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEquipment = equipmentList.filter(eq => 
    eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.internal_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectEquipment = (equipment: EquipmentWithCategory) => {
    setSelectedEquipment(equipment);
    setInspectionDialogOpen(true);
  };

  const handleInspectionSuccess = () => {
    setSelectedEquipment(null);
    setInspectionDialogOpen(false);
    onOpenChange(false);
  };

  const handleInspectionClose = (isOpen: boolean) => {
    setInspectionDialogOpen(isOpen);
    if (!isOpen) {
      setSelectedEquipment(null);
    }
  };

  // Convert database equipment to the Equipment type expected by InspectionFormDialog
  const convertToEquipmentType = (eq: EquipmentWithCategory): Equipment => ({
    id: eq.id,
    internalCode: eq.internal_code,
    name: eq.name,
    type: eq.type,
    categoryId: eq.category_id,
    categoryName: eq.categories?.name || '',
    manufacturer: eq.manufacturer,
    model: eq.model,
    serialNumber: eq.serial_number,
    manufacturingDate: eq.manufacturing_date,
    acquisitionDate: eq.acquisition_date,
    expiryDate: eq.expiry_date || '',
    certificateExpiry: eq.certificate_expiry || '',
    location: eq.location,
    unit: eq.unit,
    status: eq.status as 'active' | 'inactive' | 'maintenance' | 'rejected',
    lastInspection: eq.last_inspection || '',
    nextInspection: eq.next_inspection || '',
    capacity: eq.capacity || undefined,
  });

  return (
    <>
      <Dialog open={open && !inspectionDialogOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-card border border-border">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Nova Inspeção
            </DialogTitle>
            <DialogDescription>
              Selecione o equipamento que deseja inspecionar
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="relative py-4 px-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Buscar por nome, código ou localização..."
                className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-4">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando equipamentos...
                  </div>
                ) : filteredEquipment.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'Nenhum equipamento encontrado.' : 'Nenhum equipamento cadastrado.'}
                  </div>
                ) : (
                  filteredEquipment.map((equipment) => (
                    <div
                      key={equipment.id}
                      className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                      onClick={() => handleSelectEquipment(equipment)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{equipment.name}</span>
                              <Badge variant="outline" className="font-mono text-xs">
                                {equipment.internal_code}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {equipment.location}
                              </span>
                              {equipment.categories?.name && (
                                <span className="text-xs px-2 py-0.5 bg-muted rounded">
                                  {equipment.categories.name}
                                </span>
                              )}
                              {equipment.last_inspection && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Última: {format(new Date(equipment.last_inspection), 'dd/MM/yy', { locale: ptBR })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant="outline" 
                            className={statusColors[equipment.status] || statusColors.active}
                          >
                            {statusLabels[equipment.status] || equipment.status}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="pt-4 border-t border-border text-sm text-muted-foreground">
              {filteredEquipment.length} equipamento(s) disponível(is)
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedEquipment && (
        <InspectionFormDialog
          open={inspectionDialogOpen}
          onOpenChange={handleInspectionClose}
          equipment={convertToEquipmentType(selectedEquipment)}
          onSuccess={handleInspectionSuccess}
        />
      )}
    </>
  );
}
