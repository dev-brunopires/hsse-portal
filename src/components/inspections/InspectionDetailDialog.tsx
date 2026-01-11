import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatDateLong } from '@/utils/dateFormat';
import type { InspectionWithDetails, InspectionChecklistItem, InspectionPhoto } from '@/hooks/useInspections';
import { useDeleteInspection } from '@/hooks/useInspections';
import { supabase } from '@/integrations/supabase/client';
import { exportSingleInspectionPDF } from '@/utils/exportInspections';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';

interface InspectionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspection: InspectionWithDetails | null;
  onEdit?: (inspection: InspectionWithDetails) => void;
}

export function InspectionDetailDialog({ 
  open, 
  onOpenChange, 
  inspection,
  onEdit,
}: InspectionDetailDialogProps) {
  const { t } = useTranslation();
  const [checklistItems, setChecklistItems] = useState<InspectionChecklistItem[]>([]);
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const { role } = useAuth();
  const branding = useOrganizationBranding();
  const deleteInspection = useDeleteInspection();
  
  const isAdmin = role === 'admin' || (role as string) === 'admin_master';
  const canEdit = isAdmin || role === 'technician' || (role as string) === 'supervisor';

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2; color: string }> = {
    compliant: { label: t('inspections.statusCompliant'), variant: 'default', icon: CheckCircle2, color: 'text-status-success' },
    approved: { label: t('inspections.statusApproved'), variant: 'default', icon: CheckCircle2, color: 'text-status-success' },
    pending: { label: t('inspections.statusPending'), variant: 'secondary', icon: Clock, color: 'text-status-warning' },
    attention: { label: t('inspections.statusAttention'), variant: 'outline', icon: AlertTriangle, color: 'text-status-warning' },
    rejected: { label: t('inspections.statusRejected'), variant: 'destructive', icon: XCircle, color: 'text-status-danger' },
    'non-compliant': { label: t('inspections.statusNonCompliant'), variant: 'destructive', icon: XCircle, color: 'text-status-danger' },
    conditional: { label: t('inspections.statusConditional'), variant: 'outline', icon: AlertTriangle, color: 'text-status-warning' },
  };

  const checklistStatusLabels: Record<string, { label: string; color: string }> = {
    ok: { label: t('inspections.checklistOk'), color: 'text-status-success bg-status-success/10' },
    fail: { label: t('inspections.checklistFail'), color: 'text-status-danger bg-status-danger/10' },
    attention: { label: t('inspections.checklistAttention'), color: 'text-status-warning bg-status-warning/10' },
  };

  useEffect(() => {
    if (open && inspection?.id) {
      fetchDetails();
    }
  }, [open, inspection?.id]);

  const fetchDetails = async () => {
    if (!inspection?.id) return;
    
    setLoading(true);
    try {
      const { data: items } = await supabase
        .from('inspection_checklist_items')
        .select('*')
        .eq('inspection_id', inspection.id)
        .order('created_at', { ascending: true });
      
      setChecklistItems(items || []);

      const { data: photoData } = await supabase
        .from('inspection_photos')
        .select('*')
        .eq('inspection_id', inspection.id);
      
      setPhotos(photoData || []);

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

  const handleExportPDF = async () => {
    await exportSingleInspectionPDF(
      inspection, 
      checklistItems.map(item => ({
        description: item.description,
        status: item.status,
        notes: item.notes,
      })),
      photos,
      branding
    );
  };

  const handleDelete = async () => {
    if (!inspection) return;
    await deleteInspection.mutateAsync(inspection.id);
    setDeleteDialogOpen(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-card border border-border" hideCloseButton>
        <DialogHeader className="pb-4 border-b border-border pr-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className={cn('p-2 rounded-lg shrink-0', config.color.replace('text-', 'bg-') + '/10')}>
                  <ClipboardCheck className={cn('h-5 w-5', config.color)} />
                </div>
                <div className="truncate">
                  <span>{t('inspections.inspectionTitle')} - {inspection.equipment?.internal_code}</span>
                </div>
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 ml-12">
                <Badge variant={config.variant} className="gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {config.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDateLong(inspection.inspection_date)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {canEdit && onEdit && (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => onEdit(inspection)}>
                  <Edit className="h-4 w-4" />
                  {t('common.edit')}
                </Button>
              )}
              {isAdmin && (
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                      {t('common.delete')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('inspections.deleteInspection')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('inspections.deleteConfirmation')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleteInspection.isPending}
                      >
                        {deleteInspection.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        {t('common.delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPDF}>
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 min-h-0">
          <div className="space-y-6 py-4 pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  {t('inspections.inspector')}
                </h3>
                <div className="pl-6 space-y-1">
                  <p className="font-medium">{inspection.profiles?.full_name || t('inspections.notIdentified')}</p>
                  <p className="text-sm text-muted-foreground">{inspection.profiles?.email || '—'}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  {t('navigation.equipment')}
                </h3>
                <div className="pl-6 space-y-1">
                  <p className="font-medium">{inspection.equipment?.name || t('inspections.notFound')}</p>
                  <p className="text-sm text-muted-foreground font-mono">{inspection.equipment?.internal_code || '—'}</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {t('inspections.inspectionDate')}
                </h3>
                <p className="pl-6">{formatDate(inspection.inspection_date)}</p>
              </div>
              
              {inspection.next_inspection_date && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    {t('inspections.nextInspectionDate')}
                  </h3>
                  <p className="pl-6">{formatDate(inspection.next_inspection_date)}</p>
                </div>
              )}
            </div>

            {(inspection.actions_taken || inspection.observations || inspection.recommendations) && (
              <>
                <Separator />
                <div className="space-y-4">
                  {inspection.actions_taken && (
                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-status-success" />
                        {t('inspections.actionsTaken')}
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
                        {t('common.observations')}
                      </h3>
                      <p className="pl-6 text-muted-foreground">{inspection.observations}</p>
                    </div>
                  )}
                  
                  {inspection.recommendations && (
                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        {t('inspections.recommendations')}
                      </h3>
                      <div className="pl-6 p-3 rounded-md bg-warning/5 border border-warning/20">
                        <p className="text-sm whitespace-pre-wrap">{inspection.recommendations}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {t('inspections.checklistItems')} ({checklistItems.length})
              </h3>
              
              {loading ? (
                <div className="space-y-2 pl-6">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : checklistItems.length > 0 ? (
                <ScrollArea className={cn("pl-6 pr-2", checklistItems.length > 4 && "h-72")}>
                  <div className="space-y-2 pr-3">
                    {checklistItems.map((item) => {
                      const statusConf = checklistStatusLabels[item.status] || checklistStatusLabels.attention;
                      return (
                        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                          <span className={cn('text-xs font-medium px-2 py-1 rounded', statusConf.color)}>
                            {statusConf.label}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium">{item.description}</p>
                            {item.notes && <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <p className="pl-6 text-muted-foreground">{t('inspections.noChecklistItems')}</p>
              )}
            </div>

            {photos.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    {t('inspections.photos')} ({photos.length})
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pl-6">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        {photoUrls[photo.id] ? (
                          <img src={photoUrls[photo.id]} alt={photo.file_name} className="w-full h-32 object-cover rounded-lg border border-border" />
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
