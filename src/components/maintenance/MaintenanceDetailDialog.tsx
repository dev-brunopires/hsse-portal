import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  AlertTriangle,
  Clock,
  Play,
  Download,
  Trash2,
  Loader2,
  Image as ImageIcon,
  History,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatDateLong } from '@/utils/dateFormat';
import { 
  useMaintenanceRequestDetails, 
  useUpdateMaintenanceStatus, 
  useDeleteMaintenanceRequest,
  type MaintenanceStatus,
} from '@/hooks/useMaintenanceRequests';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { generateMaintenancePDF } from '@/utils/generateMaintenancePDF';

interface MaintenanceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2; color: string }> = {
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock, color: 'text-amber-600' },
  approved: { label: 'Aprovada', variant: 'outline', icon: CheckCircle2, color: 'text-blue-600' },
  in_progress: { label: 'Em Execução', variant: 'default', icon: Play, color: 'text-primary' },
  completed: { label: 'Concluída', variant: 'default', icon: CheckCircle2, color: 'text-green-600' },
  rejected: { label: 'Rejeitada', variant: 'destructive', icon: XCircle, color: 'text-destructive' },
};

const typeLabels: Record<string, string> = {
  preventive: 'Preventiva',
  corrective: 'Corretiva',
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'text-muted-foreground bg-muted' },
  medium: { label: 'Média', color: 'text-blue-600 bg-blue-50' },
  high: { label: 'Alta', color: 'text-orange-600 bg-orange-50' },
  critical: { label: 'Crítica', color: 'text-red-600 bg-red-50' },
};

export function MaintenanceDetailDialog({ open, onOpenChange, requestId }: MaintenanceDetailDialogProps) {
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
    await generateMaintenancePDF(request);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-card border border-border">
          <DialogHeader className="pb-4 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <div className={cn('p-2 rounded-lg shrink-0', config.color.replace('text-', 'bg-') + '/10')}>
                    <Wrench className={cn('h-5 w-5', config.color)} />
                  </div>
                  <span className="truncate">
                    {isLoading ? 'Carregando...' : request?.title}
                  </span>
                </DialogTitle>
                {request && (
                  <div className="flex items-center gap-2 mt-2 ml-12 flex-wrap">
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
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
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

          <ScrollArea className="flex-1 pr-4 min-h-0">
            {isLoading ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : request ? (
              <div className="space-y-6 py-4">
                {/* Request Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Solicitante
                    </h3>
                    <div className="pl-6 space-y-1">
                      <p className="font-medium">{request.requester?.full_name || 'N/A'}</p>
                      <p className="text-sm text-muted-foreground">{request.requester?.email || ''}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      Datas
                    </h3>
                    <div className="pl-6 space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Solicitado:</span> {formatDate(request.requested_at)}</p>
                      {request.scheduled_date && (
                        <p><span className="text-muted-foreground">Programado:</span> {formatDate(request.scheduled_date)}</p>
                      )}
                      {request.approved_at && (
                        <p><span className="text-muted-foreground">Aprovado:</span> {formatDate(request.approved_at)}</p>
                      )}
                      {request.completed_at && (
                        <p><span className="text-muted-foreground">Concluído:</span> {formatDate(request.completed_at)}</p>
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
                    Equipamento
                  </h3>
                  <div className="pl-6 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Código</p>
                      <p className="font-mono font-medium">{request.equipment?.internal_code}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nome</p>
                      <p className="font-medium">{request.equipment?.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nº Série</p>
                      <p>{request.equipment?.serial_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Localização</p>
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
                    Descrição do Problema
                  </h3>
                  <div className="pl-6 space-y-3">
                    <p className="text-sm">{request.description}</p>
                    {request.problem_identified && (
                      <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Problema Identificado:</p>
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
                        Fotos ({request.photos.length})
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
                        Trabalho Realizado
                      </h3>
                      <div className="pl-6 space-y-3 text-sm">
                        <p>{request.work_performed}</p>
                        {request.parts_used && (
                          <div>
                            <p className="font-medium mb-1">Peças/Materiais:</p>
                            <p className="text-muted-foreground">{request.parts_used}</p>
                          </div>
                        )}
                        {request.observations && (
                          <div>
                            <p className="font-medium mb-1">Observações:</p>
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
                        Motivo da Rejeição
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
                        Histórico de Manutenções
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
                            Aprovar
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => setShowRejectDialog(true)}
                            disabled={updateStatus.isPending}
                            className="gap-2"
                          >
                            <XCircle className="h-4 w-4" />
                            Rejeitar
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
                          Iniciar Execução
                        </Button>
                      )}
                      {request.status === 'in_progress' && (
                        <Button
                          onClick={() => setShowCompleteDialog(true)}
                          disabled={updateStatus.isPending}
                          className="gap-2 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Concluir Manutenção
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar Solicitação</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da rejeição desta solicitação de manutenção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Motivo da Rejeição *</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Descreva o motivo..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange('rejected', { rejection_reason: rejectionReason })}
              disabled={!rejectionReason.trim() || updateStatus.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir Manutenção</AlertDialogTitle>
            <AlertDialogDescription>
              Descreva o trabalho realizado para gerar o relatório.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Trabalho Realizado *</Label>
              <Textarea
                value={workPerformed}
                onChange={(e) => setWorkPerformed(e.target.value)}
                placeholder="Descreva as ações executadas..."
                className="mt-2"
              />
            </div>
            <div>
              <Label>Peças/Materiais Utilizados</Label>
              <Textarea
                value={partsUsed}
                onChange={(e) => setPartsUsed(e.target.value)}
                placeholder="Liste os materiais utilizados..."
                className="mt-2"
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Observações adicionais..."
                className="mt-2"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange('completed', { 
                work_performed: workPerformed,
                parts_used: partsUsed || null,
                observations: observations || null,
              })}
              disabled={!workPerformed.trim() || updateStatus.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              Concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Solicitação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta solicitação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteRequest.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRequest.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
