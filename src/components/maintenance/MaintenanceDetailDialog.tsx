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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Wrench,
  User,
  Calendar,
  Package,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Download,
  Trash2,
  Loader2,
  Image as ImageIcon,
  History,
  MapPin,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/dateFormat';
import { 
  useMaintenanceRequestDetails, 
  useUpdateMaintenanceStatus, 
  useDeleteMaintenanceRequest,
  type MaintenanceStatus,
} from '@/hooks/useMaintenanceRequests';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { generateMaintenancePDF } from '@/utils/generateMaintenancePDF';
import { EditMaintenanceDialog } from './EditMaintenanceDialog';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';

interface MaintenanceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string | null;
}

export function MaintenanceDetailDialog({ open, onOpenChange, requestId }: MaintenanceDetailDialogProps) {
  const { t } = useTranslation();
  const branding = useOrganizationBranding();
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');
  const [partsUsed, setPartsUsed] = useState('');
  const [observations, setObservations] = useState('');

  const { data: request, isLoading } = useMaintenanceRequestDetails(requestId || undefined);
  const updateStatus = useUpdateMaintenanceStatus();
  const deleteRequest = useDeleteMaintenanceRequest();
  const { user, role } = useAuth();

  const isAdmin = role === 'admin' || (role as string) === 'admin_master';
  const isSupervisor = (role as string) === 'supervisor';
  const canApprove = isAdmin || isSupervisor;
  const canEdit = isAdmin || role === 'technician' || isSupervisor;
  const canEditRequest = canEdit && request?.status !== 'completed' && request?.status !== 'rejected';

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2; color: string }> = {
    pending: { label: t('maintenance.statusPending'), variant: 'secondary', icon: Clock, color: 'text-amber-600' },
    approved: { label: t('maintenance.statusApproved'), variant: 'outline', icon: CheckCircle2, color: 'text-blue-600' },
    in_progress: { label: t('maintenance.statusInProgress'), variant: 'default', icon: Play, color: 'text-primary' },
    completed: { label: t('maintenance.statusCompleted'), variant: 'default', icon: CheckCircle2, color: 'text-green-600' },
    rejected: { label: t('maintenance.statusRejected'), variant: 'destructive', icon: XCircle, color: 'text-destructive' },
  };

  const typeLabels: Record<string, string> = {
    preventive: t('maintenanceForm.preventive'),
    corrective: t('maintenanceForm.corrective'),
  };

  const priorityConfig: Record<string, { label: string; color: string }> = {
    low: { label: t('maintenance.priorityLow'), color: 'text-muted-foreground bg-muted' },
    medium: { label: t('maintenance.priorityMedium'), color: 'text-blue-600 bg-blue-50' },
    high: { label: t('maintenance.priorityHigh'), color: 'text-orange-600 bg-orange-50' },
    critical: { label: t('maintenance.priorityCritical'), color: 'text-red-600 bg-red-50' },
  };

  // Fetch photo URLs
  useEffect(() => {
    async function fetchPhotoUrls() {
      if (!request?.photos?.length) return;

      const urls: Record<string, string> = {};
      for (const photo of request.photos) {
        const { data } = await supabase.storage
          .from('maintenance-photos')
          .createSignedUrl(photo.file_path, 3600);
        if (data?.signedUrl) {
          urls[photo.id] = data.signedUrl;
        }
      }
      setPhotoUrls(urls);
    }

    if (open && request?.photos) {
      fetchPhotoUrls();
    }
  }, [open, request?.photos]);

  if (!requestId) return null;

  const config = request ? statusConfig[request.status] : statusConfig.pending;
  const StatusIcon = config.icon;
  const priorityCfg = request ? priorityConfig[request.priority] : priorityConfig.medium;

  const handleStatusChange = async (newStatus: MaintenanceStatus, additionalData?: Record<string, unknown>) => {
    if (!request || !user?.id) return;

    await updateStatus.mutateAsync({
      id: request.id,
      status: newStatus,
      userId: user.id,
      additionalData,
    });

    if (newStatus === 'rejected') {
      setShowRejectDialog(false);
      setRejectionReason('');
    }
    if (newStatus === 'completed') {
      setShowCompleteDialog(false);
      setWorkPerformed('');
      setPartsUsed('');
      setObservations('');
    }
  };

  const handleDelete = async () => {
    if (!request) return;
    await deleteRequest.mutateAsync(request.id);
    setShowDeleteDialog(false);
    onOpenChange(false);
  };

  const handleExportPDF = async () => {
    if (!request) return;
    await generateMaintenancePDF({ ...request, branding });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl h-[90vh] p-0 overflow-hidden flex flex-col bg-card border border-border">
          {/* Fixed Header */}
          <DialogHeader className="p-6 pb-4 pr-14 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-3 text-xl pr-8">
                  <div className={cn('p-2 rounded-lg shrink-0', config.color.replace('text-', 'bg-') + '/10')}>
                    <Wrench className={cn('h-5 w-5', config.color)} />
                  </div>
                  <span className="truncate">
                    {isLoading ? t('common.loading') : request?.title}
                  </span>
                </DialogTitle>
                {request && (
                  <div className="flex items-center gap-2 mt-3 ml-12 flex-wrap">
                    <Badge variant={config.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                    <Badge variant="outline">{typeLabels[request.type]}</Badge>
                    <Badge variant="outline" className={priorityCfg.color}>
                      {priorityCfg.label}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canEditRequest && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => setShowEditDialog(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    {t('maintenance.edit')}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPDF}>
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-6 pt-4">
              {isLoading ? (
                <div className="space-y-4 py-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : request ? (
                <div className="space-y-6">
                {/* Request Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      {t('maintenance.requester')}
                    </h3>
                    <div className="pl-6 space-y-1">
                      <p className="font-medium">{request.requester?.full_name || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">{request.requester?.email || ''}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      {t('maintenance.dates')}
                    </h3>
                    <div className="pl-6 space-y-1 text-sm">
                      <p><span className="text-muted-foreground">{t('maintenance.requested')}:</span> {formatDate(request.requested_at)}</p>
                      {request.scheduled_date && (
                        <p><span className="text-muted-foreground">{t('maintenance.scheduled')}:</span> {formatDate(request.scheduled_date)}</p>
                      )}
                      {request.approved_at && (
                        <p><span className="text-muted-foreground">{t('common.approved')}:</span> {formatDate(request.approved_at)}</p>
                      )}
                      {request.completed_at && (
                        <p><span className="text-muted-foreground">{t('common.completed')}:</span> {formatDate(request.completed_at)}</p>
                      )}
                      {request.work_order && (
                        <p><span className="text-muted-foreground">WO:</span> <span className="font-mono font-medium">{request.work_order}</span></p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Equipment Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    {t('navigation.equipment')}
                  </h3>
                  <div className="pl-6 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t('equipment.internalCode')}</p>
                      <p className="font-mono font-medium">{request.equipment?.internal_code}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('common.name')}</p>
                      <p className="font-medium">{request.equipment?.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('equipment.serialNumber')}</p>
                      <p>{request.equipment?.serial_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('common.location')}</p>
                      <p className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {request.equipment?.location}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Description */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {t('maintenance.problemDescription')}
                  </h3>
                  <div className="pl-6 space-y-3">
                    <p className="text-sm">{request.description}</p>
                    {request.problem_identified && (
                      <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">{t('maintenance.problemIdentified')}:</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">{request.problem_identified}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Photos */}
                {request.photos && request.photos.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-primary" />
                        {t('maintenance.photos')} ({request.photos.length})
                      </h3>
                      <div className="pl-6 grid grid-cols-3 gap-3">
                        {request.photos.map(photo => (
                          <div key={photo.id} className="relative group">
                            {photoUrls[photo.id] ? (
                              <img
                                src={photoUrls[photo.id]}
                                alt={photo.file_name}
                                className="w-full h-24 object-cover rounded-lg border"
                              />
                            ) : (
                              <div className="w-full h-24 bg-muted rounded-lg flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Work Performed (if completed) */}
                {request.work_performed && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        {t('maintenance.workPerformedSection')}
                      </h3>
                      <div className="pl-6 space-y-3 text-sm">
                        <p>{request.work_performed}</p>
                        {request.parts_used && (
                          <div>
                            <p className="font-medium mb-1">{t('maintenance.partsMaterials')}:</p>
                            <p className="text-muted-foreground">{request.parts_used}</p>
                          </div>
                        )}
                        {request.observations && (
                          <div>
                            <p className="font-medium mb-1">{t('common.observations')}:</p>
                            <p className="text-muted-foreground">{request.observations}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Rejection Reason */}
                {request.rejection_reason && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-destructive">
                        <XCircle className="h-4 w-4" />
                        {t('maintenance.rejectionReason')}
                      </h3>
                      <div className="pl-6 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                        <p className="text-sm">{request.rejection_reason}</p>
                      </div>
                    </div>
                  </>
                )}

                {/* History */}
                {request.history && request.history.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        {t('maintenance.maintenanceHistory')}
                      </h3>
                      <div className="pl-6 space-y-2">
                        {request.history.slice(0, 5).map(h => (
                          <div key={h.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                            <span className="truncate flex-1">{h.title}</span>
                            <Badge variant="outline" className="ml-2">
                              {statusConfig[h.status]?.label || h.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                {canEdit && request.status !== 'completed' && request.status !== 'rejected' && (
                  <>
                    <Separator />
                    <div className="flex flex-wrap gap-3">
                      {request.status === 'pending' && canApprove && (
                        <>
                          <Button
                            onClick={() => handleStatusChange('approved')}
                            disabled={updateStatus.isPending}
                            className="gap-2"
                          >
                            {updateStatus.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            <CheckCircle2 className="h-4 w-4" />
                            {t('maintenance.approve')}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => setShowRejectDialog(true)}
                            disabled={updateStatus.isPending}
                            className="gap-2"
                          >
                            <XCircle className="h-4 w-4" />
                            {t('maintenance.reject')}
                          </Button>
                        </>
                      )}
                      {request.status === 'approved' && (
                        <Button
                          onClick={() => handleStatusChange('in_progress')}
                          disabled={updateStatus.isPending}
                          className="gap-2"
                        >
                          {updateStatus.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                          <Play className="h-4 w-4" />
                          {t('maintenance.startExecution')}
                        </Button>
                      )}
                      {request.status === 'in_progress' && (
                        <Button
                          onClick={() => setShowCompleteDialog(true)}
                          disabled={updateStatus.isPending}
                          className="gap-2 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {t('maintenance.completeMaintenance')}
                        </Button>
                      )}
                    </div>
                  </>
                )}
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <EditMaintenanceDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        request={request ? {
          id: request.id,
          type: request.type,
          priority: request.priority,
          title: request.title,
          description: request.description,
          problem_identified: request.problem_identified,
          work_order: request.work_order,
          scheduled_date: request.scheduled_date,
          due_date: request.due_date,
        } : null}
      />

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('maintenance.rejectRequest')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('maintenance.rejectRequestDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>{t('maintenance.rejectionReasonLabel')} *</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t('maintenance.describeReason')}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange('rejected', { rejection_reason: rejectionReason })}
              disabled={!rejectionReason.trim() || updateStatus.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('maintenance.reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('maintenance.completeMaintenanceTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('maintenance.completeMaintenanceDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{t('maintenance.workPerformedLabel')} *</Label>
              <Textarea
                value={workPerformed}
                onChange={(e) => setWorkPerformed(e.target.value)}
                placeholder={t('maintenance.describeActions')}
                className="mt-2"
              />
            </div>
            <div>
              <Label>{t('maintenance.partsMaterialsLabel')}</Label>
              <Textarea
                value={partsUsed}
                onChange={(e) => setPartsUsed(e.target.value)}
                placeholder={t('maintenance.listMaterials')}
                className="mt-2"
              />
            </div>
            <div>
              <Label>{t('common.observations')}</Label>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder={t('maintenance.additionalObservations')}
                className="mt-2"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange('completed', { 
                work_performed: workPerformed,
                parts_used: partsUsed || null,
                observations: observations || null,
              })}
              disabled={!workPerformed.trim() || updateStatus.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {t('maintenance.complete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('maintenance.deleteRequest')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('maintenance.deleteRequestDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteRequest.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRequest.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
