import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { deleteSubmissionLocal, listSubmissionsLocal } from '../offline';
import type { EvvSubmission } from '../types';
import type { EvvFormType } from '../catalog';
import { formatDateTime } from '@/utils/dateFormat';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { useAccess } from '@/hooks/useAccess';
import { useToast } from '@/hooks/use-toast';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STATUS_VARIANT: Record<EvvSubmission['status'], 'default' | 'secondary' | 'destructive'> = {
  completed: 'default',
  draft: 'secondary',
  not_synced: 'destructive',
};

const REVIEW_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  approved: 'default',
  rejected: 'destructive',
  pending: 'secondary',
};

interface ServerRow {
  id: string;
  client_id: string;
  form_type: EvvFormType;
  status: string;
  review_status: string | null;
  submitted_at: string | null;
  updated_at: string;
}

interface MergedRow {
  key: string;
  client_id: string;
  server_id?: string;
  form_type: EvvFormType;
  status: EvvSubmission['status'];
  review_status?: string | null;
  date: string;
}

export default function EvvHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const access = useAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localRows, setLocalRows] = useState<EvvSubmission[]>([]);
  const [pendingDelete, setPendingDelete] = useState<MergedRow | null>(null);
  const [previewSubmission, setPreviewSubmission] = useState<EvvSubmission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { listSubmissionsLocal().then(setLocalRows); }, []);

  const { data: serverRows = [] } = useQuery({
    queryKey: ['evv-submissions-server', organization?.id],
    enabled: !!organization?.id && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('evv_submissions' as any)
        .select('id, client_id, form_type, status, review_status, submitted_at, updated_at')
        .eq('organization_id', organization!.id)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ServerRow[];
    },
  });

  const rows = useMemo<MergedRow[]>(() => {
    const byClient = new Map<string, MergedRow>();
    serverRows.forEach((s) => {
      byClient.set(s.client_id, {
        key: s.id,
        client_id: s.client_id,
        server_id: s.id,
        form_type: s.form_type,
        status: 'completed',
        review_status: s.review_status,
        date: s.submitted_at ?? s.updated_at,
      });
    });
    localRows.forEach((l) => {
      if (byClient.has(l.client_id)) return;
      byClient.set(l.client_id, {
        key: l.client_id,
        client_id: l.client_id,
        form_type: l.form_type,
        status: l.status,
        date: l.updated_at,
      });
    });
    return Array.from(byClient.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [serverRows, localRows]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      if (pendingDelete.server_id) {
        const { error } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from('evv_submissions' as any)
          .delete()
          .eq('id', pendingDelete.server_id);
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ['evv-submissions-server'] });
      }

      await deleteSubmissionLocal(pendingDelete.client_id);
      setLocalRows(await listSubmissionsLocal());
      toast({
        title: t('evv.history.deletedTitle'),
        description: t('evv.history.deletedDescription'),
      });
      setPendingDelete(null);
    } catch (error) {
      toast({
        title: t('evv.history.deleteError'),
        description: error instanceof Error ? error.message : t('common.error'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const canDeleteServer = access.can('evv', 'history', 'delete');

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Plus}
        title={t('evv.history.title')}
        description={t('evv.history.subtitle')}
        actions={(
          <Button asChild><Link to="/evv/forms"><Plus />{t('evv.history.new')}</Link></Button>
        )}
      />
      <Card>
        <CardHeader><CardTitle>{t('evv.history.allSubmissions')}</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('evv.history.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('evv.history.formType')}</TableHead>
                  <TableHead>{t('evv.history.date')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('evv.detail.reviewTitle')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{t(`evv.forms.${r.form_type === 'leaders_engagement' ? 'leaders' : r.form_type === 'workers_engagement' ? 'workers' : r.form_type}.title`)}</TableCell>
                    <TableCell>{formatDateTime(r.date)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{t(`evv.status.${r.status}`)}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.server_id ? (
                        <Badge variant={REVIEW_VARIANT[r.review_status ?? 'pending']}>
                          {t(`evv.review.${r.review_status ?? 'pending'}`)}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {r.server_id ? (
                          <HistoryAction
                            label={t('evv.history.view')}
                            icon={Eye}
                            onClick={() => navigate(`/evv/history/${r.server_id}`)}
                          />
                        ) : (
                          <>
                            <HistoryAction
                              label={t('evv.history.view')}
                              icon={Eye}
                              onClick={() => setPreviewSubmission(
                                localRows.find((submission) => submission.client_id === r.client_id) ?? null
                              )}
                            />
                            <HistoryAction
                              label={t('evv.history.edit')}
                              icon={Pencil}
                              onClick={() => navigate(`/evv/forms/${r.form_type}?draft=${r.client_id}`)}
                            />
                          </>
                        )}
                        {(!r.server_id || canDeleteServer) && (
                          <HistoryAction
                            label={t('evv.history.delete')}
                            icon={Trash2}
                            destructive
                            onClick={() => setPendingDelete(r)}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && !isDeleting && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('evv.history.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('evv.history.deleteConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('evv.history.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!previewSubmission} onOpenChange={(open) => !open && setPreviewSubmission(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('evv.history.previewTitle')}</DialogTitle>
            <DialogDescription>{t('evv.history.previewDescription')}</DialogDescription>
          </DialogHeader>
          {previewSubmission && (
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <PreviewField label={t('evv.history.formType')} value={t(`evv.forms.${previewSubmission.form_type === 'leaders_engagement' ? 'leaders' : previewSubmission.form_type === 'workers_engagement' ? 'workers' : previewSubmission.form_type}.title`)} />
              <PreviewField label={t('evv.history.date')} value={formatDateTime(previewSubmission.updated_at)} />
              <PreviewField label={t('evv.scope.environment')} value={previewSubmission.scope.environment || '-'} />
              <PreviewField label={t('evv.scope.area')} value={previewSubmission.scope.area || '-'} />
              <PreviewField label={t('evv.scope.location')} value={previewSubmission.scope.location || '-'} />
              <PreviewField label={t('evv.scope.department')} value={previewSubmission.scope.department || '-'} />
              <PreviewField label={t('evv.scope.task')} value={previewSubmission.scope.task_description || '-'} className="sm:col-span-2" />
              <PreviewField
                label={t('evv.history.answeredItems')}
                value={String(Object.values(previewSubmission.answers).filter((answer) => answer.rating).length)}
              />
              <PreviewField label={t('common.status')} value={t(`evv.status.${previewSubmission.status}`)} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function HistoryAction({
  label,
  icon: Icon,
  onClick,
  destructive = false,
}: {
  label: string;
  icon: typeof Eye;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClick}
          aria-label={label}
          className={destructive ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : undefined}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
