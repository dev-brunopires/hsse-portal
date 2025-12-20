import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Package, 
  MapPin, 
  Calendar, 
  FileText, 
  History,
  Edit,
  ClipboardCheck,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  Tag,
  Barcode,
  Factory,
  User,
} from 'lucide-react';
import { Equipment } from '@/types/equipment';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';

interface EquipmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  onEdit?: () => void;
  onNewInspection?: () => void;
}

const mockInspectionHistory = [
  {
    id: 'insp-1',
    date: '2024-11-15',
    inspector: 'Carlos Silva',
    status: 'compliant',
    observations: 'Equipamento em perfeitas condições de uso.',
  },
  {
    id: 'insp-2',
    date: '2024-10-15',
    inspector: 'Maria Santos',
    status: 'compliant',
    observations: 'Inspeção mensal realizada. Sem observações.',
  },
  {
    id: 'insp-3',
    date: '2024-09-15',
    inspector: 'João Oliveira',
    status: 'attention',
    observations: 'Etiqueta de identificação com desgaste. Recomendada substituição.',
  },
  {
    id: 'insp-4',
    date: '2024-08-15',
    inspector: 'Carlos Silva',
    status: 'compliant',
    observations: 'Todos os itens do checklist conformes.',
  },
];

const mockDocuments = [
  { id: 'doc-1', name: 'Certificado de Conformidade.pdf', type: 'pdf', date: '2023-05-20', size: '245 KB' },
  { id: 'doc-2', name: 'Nota Fiscal.pdf', type: 'pdf', date: '2023-05-20', size: '128 KB' },
  { id: 'doc-3', name: 'Manual do Equipamento.pdf', type: 'pdf', date: '2023-05-20', size: '2.4 MB' },
  { id: 'doc-4', name: 'Foto Instalação.jpg', type: 'image', date: '2023-05-25', size: '1.2 MB' },
];

export function EquipmentDetailDialog({ 
  open, 
  onOpenChange, 
  equipment,
  onEdit,
  onNewInspection,
}: EquipmentDetailDialogProps) {
  if (!equipment) return null;

  const getDaysUntilExpiry = (date: string) => {
    const expiry = new Date(date);
    const today = new Date();
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const certificateDays = getDaysUntilExpiry(equipment.certificateExpiry);
  const inspectionDays = getDaysUntilExpiry(equipment.nextInspection);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-card border border-border">
        <DialogHeader className="pb-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="font-mono text-primary">{equipment.internalCode}</span>
                  <span className="mx-2 text-muted-foreground">•</span>
                  <span>{equipment.name}</span>
                </div>
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 ml-12">
                <Badge variant="outline">{equipment.categoryName}</Badge>
                <StatusBadge status={equipment.status} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={onEdit}>
                <Edit className="h-4 w-4" />
                Editar
              </Button>
              <Button size="sm" className="gap-2" onClick={onNewInspection}>
                <ClipboardCheck className="h-4 w-4" />
                Nova Inspeção
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-auto p-0">
            <TabsTrigger 
              value="details"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              <Package className="h-4 w-4 mr-2" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger 
              value="inspections"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              <History className="h-4 w-4 mr-2" />
              Histórico de Inspeções
            </TabsTrigger>
            <TabsTrigger 
              value="documents"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              <FileText className="h-4 w-4 mr-2" />
              Documentos
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            {/* Details Tab */}
            <TabsContent value="details" className="mt-0 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Identification */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    Identificação
                  </h3>
                  <div className="space-y-3 pl-6">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Código Interno</span>
                      <span className="font-mono font-medium">{equipment.internalCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nome</span>
                      <span className="font-medium">{equipment.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Categoria</span>
                      <span>{equipment.categoryName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tipo</span>
                      <span>{equipment.type}</span>
                    </div>
                  </div>
                </div>

                {/* Technical */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Factory className="h-4 w-4 text-primary" />
                    Dados Técnicos
                  </h3>
                  <div className="space-y-3 pl-6">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fabricante</span>
                      <span className="font-medium">{equipment.manufacturer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modelo</span>
                      <span>{equipment.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Número de Série</span>
                      <span className="font-mono">{equipment.serialNumber}</span>
                    </div>
                    {equipment.capacity && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Capacidade</span>
                        <span className="font-medium">{equipment.capacity}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Localização
                  </h3>
                  <div className="space-y-3 pl-6">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unidade</span>
                      <span className="font-medium">{equipment.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Local Físico</span>
                      <span>{equipment.location}</span>
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Datas
                  </h3>
                  <div className="space-y-3 pl-6">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fabricação</span>
                      <span>{new Date(equipment.manufacturingDate).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Aquisição</span>
                      <span>{new Date(equipment.acquisitionDate).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Validade</span>
                      <span>{new Date(equipment.expiryDate).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Last Inspection */}
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-status-success" />
                    <span className="font-medium">Última Inspeção</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {new Date(equipment.lastInspection).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-sm text-muted-foreground">Conforme</p>
                </div>

                {/* Next Inspection */}
                <div className={cn(
                  'p-4 rounded-lg border',
                  inspectionDays <= 7 ? 'border-status-danger bg-status-danger/10' :
                  inspectionDays <= 30 ? 'border-status-warning bg-status-warning/10' :
                  'border-border bg-muted/30'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className={cn(
                      'h-5 w-5',
                      inspectionDays <= 7 ? 'text-status-danger' :
                      inspectionDays <= 30 ? 'text-status-warning' :
                      'text-muted-foreground'
                    )} />
                    <span className="font-medium">Próxima Inspeção</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {new Date(equipment.nextInspection).toLocaleDateString('pt-BR')}
                  </p>
                  <p className={cn(
                    'text-sm',
                    inspectionDays <= 7 ? 'text-status-danger' :
                    inspectionDays <= 30 ? 'text-status-warning' :
                    'text-muted-foreground'
                  )}>
                    {inspectionDays > 0 ? `Em ${inspectionDays} dias` : 'Vencida'}
                  </p>
                </div>

                {/* Certificate */}
                <div className={cn(
                  'p-4 rounded-lg border',
                  certificateDays <= 30 ? 'border-status-danger bg-status-danger/10' :
                  certificateDays <= 90 ? 'border-status-warning bg-status-warning/10' :
                  'border-border bg-muted/30'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className={cn(
                      'h-5 w-5',
                      certificateDays <= 30 ? 'text-status-danger' :
                      certificateDays <= 90 ? 'text-status-warning' :
                      'text-muted-foreground'
                    )} />
                    <span className="font-medium">Validade Certificado</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {new Date(equipment.certificateExpiry).toLocaleDateString('pt-BR')}
                  </p>
                  <p className={cn(
                    'text-sm',
                    certificateDays <= 30 ? 'text-status-danger' :
                    certificateDays <= 90 ? 'text-status-warning' :
                    'text-muted-foreground'
                  )}>
                    {certificateDays > 0 ? `${certificateDays} dias restantes` : 'Vencido'}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Inspections Tab */}
            <TabsContent value="inspections" className="mt-0 p-6">
              <div className="space-y-4">
                {mockInspectionHistory.map((inspection, index) => (
                  <div 
                    key={inspection.id}
                    className={cn(
                      'p-4 rounded-lg border-l-4 bg-card border',
                      inspection.status === 'compliant' && 'border-l-status-success',
                      inspection.status === 'attention' && 'border-l-status-warning',
                      inspection.status === 'non-compliant' && 'border-l-status-danger',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {inspection.status === 'compliant' && (
                          <CheckCircle2 className="h-5 w-5 text-status-success" />
                        )}
                        {inspection.status === 'attention' && (
                          <AlertTriangle className="h-5 w-5 text-status-warning" />
                        )}
                        <div>
                          <p className="font-medium">
                            {new Date(inspection.date).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {inspection.inspector}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        inspection.status === 'compliant' ? 'default' :
                        inspection.status === 'attention' ? 'secondary' : 'destructive'
                      }>
                        {inspection.status === 'compliant' && 'Conforme'}
                        {inspection.status === 'attention' && 'Atenção'}
                        {inspection.status === 'non-compliant' && 'Não Conforme'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3 ml-8">
                      {inspection.observations}
                    </p>
                    <div className="flex gap-2 mt-3 ml-8">
                      <Button variant="outline" size="sm" className="gap-1">
                        <FileText className="h-3 w-3" />
                        Ver Relatório
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-0 p-6">
              <div className="space-y-3">
                {mockDocuments.map((doc) => (
                  <div 
                    key={doc.id}
                    className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn(
                      'p-2 rounded-lg',
                      doc.type === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                    )}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(doc.date).toLocaleDateString('pt-BR')} • {doc.size}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
