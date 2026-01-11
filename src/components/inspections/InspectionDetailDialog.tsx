import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Info,
  ClipboardList,
  PenTool,
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
  const isMobile = useIsMobile();
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

  const getStatusCounts = () => {
    const counts = { ok: 0, attention: 0, fail: 0, pending: 0 };
    checklistItems.forEach(item => {
      const status = item.status as keyof typeof counts;
      if (counts[status] !== undefined) {
        counts[status]++;
      }
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  const headerContent = (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3 text-xl font-semibold">
          <div className={cn('p-2 rounded-lg shrink-0', config.color.replace('text-', 'bg-') + '/10')}>
            <ClipboardCheck className={cn('h-5 w-5', config.color)} />
          </div>
          <div className="truncate">
            <span>{t('inspections.inspectionTitle')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 ml-12 flex-wrap">
          <Badge variant={config.variant} className="gap-1">
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {formatDateLong(inspection.inspection_date)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 ml-12">
          <span>
            <strong className="text-foreground">{inspection.equipment?.internal_code}</strong> - {inspection.equipment?.name}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {canEdit && onEdit && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => onEdit(inspection)}>
            <Edit className="h-4 w-4" />
            <span className="hidden sm:inline">{t('common.edit')}</span>
          </Button>
        )}
        {isAdmin && (
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t('common.delete')}</span>
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
          <span className="hidden sm:inline">PDF</span>
        </Button>
      </div>
    </div>
  );

  const tabsContent = (
    <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden min-h-0">
      <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
        <TabsTrigger value="info" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
          <Info className="h-4 w-4" />
          <span className="hidden sm:inline">{t('inspectionForm.info')}</span>
        </TabsTrigger>
        <TabsTrigger value="checklist" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">{t('inspectionForm.checklist')}</span>
          {checklistItems.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {checklistItems.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="observations" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">{t('inspectionForm.observationsTab')}</span>
        </TabsTrigger>
        <TabsTrigger value="photos" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
          <ImageIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{t('inspectionForm.photos')}</span>
          {photos.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {photos.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="signature" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
          <PenTool className="h-4 w-4" />
          <span className="hidden sm:inline">{t('inspectionForm.sign')}</span>
          {inspection.signature_data && (
            <CheckCircle2 className="h-4 w-4 text-status-success" />
          )}
        </TabsTrigger>
      </TabsList>

      {/* Tab: Info */}
      <TabsContent value="info" className="flex-1 overflow-y-auto mt-4 min-h-0">
        <div className="space-y-6 pb-4 px-1">
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

          <div className="border-t border-border pt-4">
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
          </div>

          {/* Status Summary */}
          {checklistItems.length > 0 && (
            <div className="border-t border-border pt-4">
              <h3 className="font-semibold mb-3">{t('inspectionForm.summary')}</h3>
              <div className="flex flex-wrap gap-2">
                {statusCounts.ok > 0 && (
                  <Badge variant="outline" className="gap-1 text-status-success border-status-success/30 bg-status-success/10">
                    <CheckCircle2 className="h-3 w-3" />
                    {statusCounts.ok} {t('inspections.checklistOk')}
                  </Badge>
                )}
                {statusCounts.attention > 0 && (
                  <Badge variant="outline" className="gap-1 text-status-warning border-status-warning/30 bg-status-warning/10">
                    <AlertTriangle className="h-3 w-3" />
                    {statusCounts.attention} {t('inspections.checklistAttention')}
                  </Badge>
                )}
                {statusCounts.fail > 0 && (
                  <Badge variant="outline" className="gap-1 text-status-danger border-status-danger/30 bg-status-danger/10">
                    <XCircle className="h-3 w-3" />
                    {statusCounts.fail} {t('inspections.checklistFail')}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      {/* Tab: Checklist */}
      <TabsContent value="checklist" className="flex-1 overflow-y-auto mt-4 min-h-0">
        <div className="space-y-4 pb-4 px-1">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : checklistItems.length > 0 ? (
            <div className="space-y-2">
              {checklistItems.map((item) => {
                const statusConf = checklistStatusLabels[item.status] || checklistStatusLabels.attention;
                return (
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                    <span className={cn('text-xs font-medium px-2 py-1 rounded shrink-0', statusConf.color)}>
                      {statusConf.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{item.description}</p>
                      {item.notes && <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">{t('inspections.noChecklistItems')}</p>
          )}
        </div>
      </TabsContent>

      {/* Tab: Observations */}
      <TabsContent value="observations" className="flex-1 overflow-y-auto mt-4 min-h-0">
        <div className="space-y-4 pb-4 px-1">
          {inspection.actions_taken && (
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-status-success" />
                {t('inspections.actionsTaken')}
              </h3>
              <div className="p-3 rounded-md bg-status-success/5 border border-status-success/20">
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
              <div className="p-3 rounded-md bg-muted/50 border border-border">
                <p className="text-sm whitespace-pre-wrap">{inspection.observations}</p>
              </div>
            </div>
          )}
          
          {inspection.recommendations && (
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                {t('inspections.recommendations')}
              </h3>
              <div className="p-3 rounded-md bg-warning/5 border border-warning/20">
                <p className="text-sm whitespace-pre-wrap">{inspection.recommendations}</p>
              </div>
            </div>
          )}

          {!inspection.actions_taken && !inspection.observations && !inspection.recommendations && (
            <p className="text-muted-foreground">{t('inspections.noObservations')}</p>
          )}
        </div>
      </TabsContent>

      {/* Tab: Photos */}
      <TabsContent value="photos" className="flex-1 overflow-y-auto mt-4 min-h-0">
        <div className="space-y-4 pb-4 px-1">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mb-2" />
              <p>{t('inspections.noPhotos')}</p>
            </div>
          )}
        </div>
      </TabsContent>

      {/* Tab: Signature */}
      <TabsContent value="signature" className="flex-1 overflow-y-auto mt-4 min-h-0">
        <div className="space-y-4 pb-4 px-1">
          {inspection.signature_data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-status-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{t('inspectionForm.inspectionSigned')}</span>
              </div>
              <div className="border border-border rounded-lg p-4 bg-white">
                <img 
                  src={inspection.signature_data} 
                  alt={t('inspectionForm.inspectorSignature')} 
                  className="max-w-full h-auto max-h-32 mx-auto"
                />
              </div>
              {inspection.signed_at && (
                <p className="text-sm text-muted-foreground">
                  {t('inspectionForm.signedAt')}: {formatDateLong(inspection.signed_at)}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <PenTool className="h-12 w-12 mb-2" />
              <p>{t('inspectionForm.notSigned')}</p>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="pb-4 border-b border-border">
            <DrawerTitle className="sr-only">{t('inspections.inspectionTitle')}</DrawerTitle>
            {headerContent}
          </DrawerHeader>
          <div className="flex-1 overflow-hidden flex flex-col px-4 pb-4 min-h-0">
            {tabsContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-card border border-border" hideCloseButton>
        <DialogHeader className="pb-4 border-b border-border pr-0">
          <DialogTitle className="sr-only">{t('inspections.inspectionTitle')}</DialogTitle>
          {headerContent}
        </DialogHeader>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {tabsContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}
