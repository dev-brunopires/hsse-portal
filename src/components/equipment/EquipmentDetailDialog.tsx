import { useState, useRef } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
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
  Tag,
  Factory,
  User,
  Upload,
  Trash2,
  Loader2,
  XCircle,
  Image,
  File,
} from 'lucide-react';
import { Equipment } from '@/types/equipment';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/dateFormat';
import { useInspectionsByEquipment } from '@/hooks/useInspections';
import { useEquipmentDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/useEquipmentDocuments';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EquipmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  onEdit?: () => void;
  onNewInspection?: () => void;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  approved: { label: 'Aprovado', variant: 'default' },
  pending: { label: 'Pendente', variant: 'secondary' },
  rejected: { label: 'Reprovado', variant: 'destructive' },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  if (fileType === 'application/pdf') return FileText;
  return File;
}

export function EquipmentDetailDialog({ 
  open, 
  onOpenChange, 
  equipment,
  onEdit,
  onNewInspection,
}: EquipmentDetailDialogProps) {
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: inspections, isLoading: loadingInspections } = useInspectionsByEquipment(equipment?.id);
  const { data: documents, isLoading: loadingDocuments } = useEquipmentDocuments(equipment?.id);
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();

  if (!equipment) return null;

  const getDaysUntilExpiry = (date: string) => {
    if (!date) return 0;
    const expiry = new Date(date);
    const today = new Date();
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const certificateDays = equipment.certificateExpiry ? getDaysUntilExpiry(equipment.certificateExpiry) : 0;
  const inspectionDays = equipment.nextInspection ? getDaysUntilExpiry(equipment.nextInspection) : 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !equipment?.id) return;

    setUploadingFile(true);
    try {
      await uploadDocument.mutateAsync({ equipmentId: equipment.id, file });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data } = await supabase.storage
        .from('equipment-documents')
        .createSignedUrl(filePath, 60);
      
      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = fileName;
        link.click();
      }
    } catch (error) {
      toast({
        title: 'Erro ao baixar',
        description: 'Não foi possível baixar o documento.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    if (!equipment?.id) return;
    await deleteDocument.mutateAsync({ id, filePath, equipmentId: equipment.id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-card border border-border" hideCloseButton>
        <DialogHeader className="pb-4 border-b border-border pr-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="truncate">
                  <span className="font-mono text-primary">{equipment.internalCode}</span>
                  <span className="mx-2 text-muted-foreground">•</span>
                  <span>{equipment.name}</span>
                </div>
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 ml-12">
                <Badge variant="outline">{equipment.category || equipment.categoryName}</Badge>
                <StatusBadge status={equipment.status} />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
              Inspeções ({inspections?.length || 0})
            </TabsTrigger>
            <TabsTrigger 
              value="documents"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              <FileText className="h-4 w-4 mr-2" />
              Documentos ({documents?.length || 0})
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
                      <span>{equipment.category || equipment.categoryName}</span>
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
                      <span>{formatDate(equipment.manufacturingDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Aquisição</span>
                      <span>{formatDate(equipment.acquisitionDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Validade</span>
                      <span>{formatDate(equipment.expiryDate)}</span>
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
                    {equipment.lastInspection ? new Date(equipment.lastInspection).toLocaleDateString('pt-BR') : '—'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {inspections?.[0]?.status === 'approved' ? 'Aprovado' : 
                     inspections?.[0]?.status === 'rejected' ? 'Reprovado' : '—'}
                  </p>
                </div>

                {/* Next Inspection */}
                <div className={cn(
                  'p-4 rounded-lg border',
                  equipment.nextInspection ? (
                    inspectionDays <= 7 ? 'border-status-danger bg-status-danger/10' :
                    inspectionDays <= 30 ? 'border-status-warning bg-status-warning/10' :
                    'border-border bg-muted/30'
                  ) : 'border-border bg-muted/30'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className={cn(
                      'h-5 w-5',
                      equipment.nextInspection ? (
                        inspectionDays <= 7 ? 'text-status-danger' :
                        inspectionDays <= 30 ? 'text-status-warning' :
                        'text-muted-foreground'
                      ) : 'text-muted-foreground'
                    )} />
                    <span className="font-medium">Próxima Inspeção</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {equipment.nextInspection ? new Date(equipment.nextInspection).toLocaleDateString('pt-BR') : '—'}
                  </p>
                  <p className={cn(
                    'text-sm',
                    equipment.nextInspection ? (
                      inspectionDays <= 7 ? 'text-status-danger' :
                      inspectionDays <= 30 ? 'text-status-warning' :
                      'text-muted-foreground'
                    ) : 'text-muted-foreground'
                  )}>
                    {equipment.nextInspection ? (inspectionDays > 0 ? `Em ${inspectionDays} dias` : 'Vencida') : '—'}
                  </p>
                </div>

                {/* Certificate */}
                <div className={cn(
                  'p-4 rounded-lg border',
                  equipment.certificateExpiry ? (
                    certificateDays <= 30 ? 'border-status-danger bg-status-danger/10' :
                    certificateDays <= 90 ? 'border-status-warning bg-status-warning/10' :
                    'border-border bg-muted/30'
                  ) : 'border-border bg-muted/30'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className={cn(
                      'h-5 w-5',
                      equipment.certificateExpiry ? (
                        certificateDays <= 30 ? 'text-status-danger' :
                        certificateDays <= 90 ? 'text-status-warning' :
                        'text-muted-foreground'
                      ) : 'text-muted-foreground'
                    )} />
                    <span className="font-medium">Validade Certificado</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {equipment.certificateExpiry ? new Date(equipment.certificateExpiry).toLocaleDateString('pt-BR') : '—'}
                  </p>
                  <p className={cn(
                    'text-sm',
                    equipment.certificateExpiry ? (
                      certificateDays <= 30 ? 'text-status-danger' :
                      certificateDays <= 90 ? 'text-status-warning' :
                      'text-muted-foreground'
                    ) : 'text-muted-foreground'
                  )}>
                    {equipment.certificateExpiry ? (certificateDays > 0 ? `${certificateDays} dias restantes` : 'Vencido') : '—'}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Inspections Tab */}
            <TabsContent value="inspections" className="mt-0 p-6">
              {loadingInspections ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : inspections && inspections.length > 0 ? (
                <div className="space-y-4">
                  {inspections.map((inspection) => (
                    <div 
                      key={inspection.id}
                      className={cn(
                        'p-4 rounded-lg border-l-4 bg-card border',
                        inspection.status === 'approved' && 'border-l-status-success',
                        inspection.status === 'pending' && 'border-l-status-warning',
                        inspection.status === 'rejected' && 'border-l-status-danger',
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {inspection.status === 'approved' && (
                            <CheckCircle2 className="h-5 w-5 text-status-success" />
                          )}
                          {inspection.status === 'pending' && (
                            <AlertTriangle className="h-5 w-5 text-status-warning" />
                          )}
                          {inspection.status === 'rejected' && (
                            <XCircle className="h-5 w-5 text-status-danger" />
                          )}
                          <div>
                            <p className="font-medium">
                              {new Date(inspection.inspection_date).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {inspection.profiles?.full_name || 'Inspetor não identificado'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={statusLabels[inspection.status]?.variant || 'secondary'}>
                          {statusLabels[inspection.status]?.label || inspection.status}
                        </Badge>
                      </div>
                      {inspection.observations && (
                        <div className="mt-3 ml-8">
                          <p className="text-sm font-medium text-foreground">Observações:</p>
                          <p className="text-sm text-muted-foreground">{inspection.observations}</p>
                        </div>
                      )}
                      {inspection.recommendations && (
                        <div className="mt-2 ml-8">
                          <p className="text-sm font-medium text-foreground">Recomendações:</p>
                          <p className="text-sm text-muted-foreground">{inspection.recommendations}</p>
                        </div>
                      )}
                      {inspection.next_inspection_date && (
                        <div className="mt-2 ml-8">
                          <p className="text-sm text-muted-foreground">
                            Próxima inspeção programada: {new Date(inspection.next_inspection_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Nenhuma inspeção registrada</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Este equipamento ainda não possui inspeções.
                  </p>
                  <Button onClick={onNewInspection} className="gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Registrar Primeira Inspeção
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-0 p-6">
              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                >
                  {uploadingFile ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Enviar Documento
                    </>
                  )}
                </Button>
              </div>

              {loadingDocuments ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : documents && documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const FileIcon = getFileIcon(doc.file_type);
                    return (
                      <div 
                        key={doc.id}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn(
                          'p-2 rounded-lg',
                          doc.file_type === 'application/pdf' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 
                          doc.file_type.startsWith('image/') ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-muted text-muted-foreground'
                        )}>
                          <FileIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.file_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString('pt-BR')} • {formatFileSize(doc.file_size)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2"
                            onClick={() => handleDownload(doc.file_path, doc.file_name)}
                          >
                            <Download className="h-4 w-4" />
                            Baixar
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(doc.id, doc.file_path)}
                            disabled={deleteDocument.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Nenhum documento anexado</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Adicione certificados, notas fiscais, manuais e outros documentos.
                  </p>
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Enviar Primeiro Documento
                  </Button>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
