import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ClipboardCheck,
  User,
  Calendar,
  Package,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Download,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { InspectionWithDetails, InspectionChecklistItem, InspectionPhoto } from '@/hooks/useInspections';
import { supabase } from '@/integrations/supabase/client';
import { exportSingleInspectionPDF } from '@/utils/exportInspections';

interface InspectionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspection: InspectionWithDetails | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2; color: string }> = {
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle2, color: 'text-status-success' },
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock, color: 'text-status-warning' },
  rejected: { label: 'Reprovado', variant: 'destructive', icon: XCircle, color: 'text-status-danger' },
  conditional: { label: 'Condicional', variant: 'outline', icon: AlertTriangle, color: 'text-status-warning' },
};

const checklistStatusLabels: Record<string, { label: string; color: string }> = {
  ok: { label: 'OK', color: 'text-status-success bg-status-success/10' },
  fail: { label: 'Falha', color: 'text-status-danger bg-status-danger/10' },
  attention: { label: 'Atenção', color: 'text-status-warning bg-status-warning/10' },
};

export function InspectionDetailDialog({ 
  open, 
  onOpenChange, 
  inspection 
}: InspectionDetailDialogProps) {
  const [checklistItems, setChecklistItems] = useState<InspectionChecklistItem[]>([]);
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && inspection?.id) {
      fetchDetails();
    }
  }, [open, inspection?.id]);

  const fetchDetails = async () => {
    if (!inspection?.id) return;
    
    setLoading(true);
    try {
      // Fetch checklist items
      const { data: items } = await supabase
        .from('inspection_checklist_items')
        .select('*')
        .eq('inspection_id', inspection.id)
        .order('created_at', { ascending: true });
      
      setChecklistItems(items || []);

      // Fetch photos
      const { data: photoData } = await supabase
        .from('inspection_photos')
        .select('*')
        .eq('inspection_id', inspection.id);
      
      setPhotos(photoData || []);

      // Get signed URLs for photos
      if (photoData && photoData.length > 0) {
        const urls: Record<string, string> = {};
        for (const photo of photoData) {
          const { data } = await supabase.storage
            .from('inspection-photos')
            .createSignedUrl(photo.file_path, 3600);
          if (data?.signedUrl) {
            urls[photo.id] = data.signedUrl;
          }
        }
        setPhotoUrls(urls);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!inspection) return null;

  const config = statusConfig[inspection.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  const handleExportPDF = () => {
    exportSingleInspectionPDF(
      inspection, 
      checklistItems.map(item => ({
        description: item.description,
        status: item.status,
        notes: item.notes,
      }))
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-card border border-border">
        <DialogHeader className="pb-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className={cn('p-2 rounded-lg', config.color.replace('text-', 'bg-') + '/10')}>
                  <ClipboardCheck className={cn('h-5 w-5', config.color)} />
                </div>
                <div>
                  <span>Inspeção - {inspection.equipment?.internal_code}</span>
                </div>
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 ml-12">
                <Badge variant={config.variant} className="gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {config.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(inspection.inspection_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPDF}>
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Inspector & Equipment Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Inspetor
                </h3>
                <div className="pl-6 space-y-1">
                  <p className="font-medium">{inspection.profiles?.full_name || 'Não identificado'}</p>
                  <p className="text-sm text-muted-foreground">{inspection.profiles?.email || '—'}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Equipamento
                </h3>
                <div className="pl-6 space-y-1">
                  <p className="font-medium">{inspection.equipment?.name || 'Não encontrado'}</p>
                  <p className="text-sm text-muted-foreground font-mono">{inspection.equipment?.internal_code || '—'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Data da Inspeção
                </h3>
                <p className="pl-6">
                  {format(new Date(inspection.inspection_date), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              
              {inspection.next_inspection_date && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Próxima Inspeção
                  </h3>
                  <p className="pl-6">
                    {format(new Date(inspection.next_inspection_date), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>

            {/* Actions Taken, Observations & Recommendations */}
            {(inspection.actions_taken || inspection.observations || inspection.recommendations) && (
              <>
                <Separator />
                <div className="space-y-4">
                  {inspection.actions_taken && (
                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-status-success" />
                        Ações Tomadas
                      </h3>
                      <div className="pl-6 p-3 rounded-md bg-status-success/5 border border-status-success/20">
                        <p className="text-sm whitespace-pre-wrap">{inspection.actions_taken}</p>
                      </div>
                    </div>
                  )}

                  {inspection.observations && (
                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Observações
                      </h3>
                      <p className="pl-6 text-muted-foreground">{inspection.observations}</p>
                    </div>
                  )}
                  
                  {inspection.recommendations && (
                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        Recomendações
                      </h3>
                      <div className="pl-6 p-3 rounded-md bg-warning/5 border border-warning/20">
                        <p className="text-sm whitespace-pre-wrap">{inspection.recommendations}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Checklist */}
            <Separator />
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Itens do Checklist ({checklistItems.length})
              </h3>
              
              {loading ? (
                <div className="space-y-2 pl-6">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : checklistItems.length > 0 ? (
                <div className="space-y-2 pl-6">
                  {checklistItems.map((item) => {
                    const statusConfig = checklistStatusLabels[item.status] || checklistStatusLabels.attention;
                    return (
                      <div 
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30"
                      >
                        <span className={cn('text-xs font-medium px-2 py-1 rounded', statusConfig.color)}>
                          {statusConfig.label}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium">{item.description}</p>
                          {item.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="pl-6 text-muted-foreground">Nenhum item de checklist registrado.</p>
              )}
            </div>

            {/* Photos */}
            {photos.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Fotos ({photos.length})
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pl-6">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        {photoUrls[photo.id] ? (
                          <img
                            src={photoUrls[photo.id]}
                            alt={photo.file_name}
                            className="w-full h-32 object-cover rounded-lg border border-border"
                          />
                        ) : (
                          <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1 truncate">{photo.file_name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
