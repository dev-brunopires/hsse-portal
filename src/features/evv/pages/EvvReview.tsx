import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Eye, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/utils/dateFormat';
import type { EvvFormType } from '../catalog';
import type { EvvScope } from '../types';

interface ReviewRow {
  id: string;
  user_id: string;
  form_type: EvvFormType;
  scope: Pick<EvvScope, 'location' | 'task_description' | 'vessel_ids'>;
  review_status: string | null;
  submitted_at: string | null;
  updated_at: string;
}

export default function EvvReview() {
  const { t } = useTranslation();
  const { user, role, isAdmin, isAdminMaster, isPlatformOwner } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const canReview = isAdmin || isAdminMaster || isPlatformOwner || role === 'supervisor';

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['evv-review-queue', organization?.id, user?.id],
    enabled: !!organization?.id && !!user?.id && canReview,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evv_submissions')
        .select('id, user_id, form_type, scope, review_status, submitted_at, updated_at')
        .eq('organization_id', organization!.id)
        .eq('status', 'completed')
        .neq('user_id', user!.id)
        .or('review_status.is.null,review_status.eq.pending,review_status.eq.rejected')
        .order('submitted_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ReviewRow[];
    },
  });

  async function saveReview(row: ReviewRow, status: 'approved' | 'rejected') {
    const review_notes = notesById[row.id]?.trim() ?? '';
    if (status === 'rejected' && review_notes.length < 5) {
      toast.error(t('evv.detail.rejectionNotesRequired'));
      return;
    }

    const { error } = await supabase
      .from('evv_submissions')
      .update({ review_status: status, review_notes })
      .eq('id', row.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(t(status === 'approved' ? 'evv.detail.approvedToast' : 'evv.detail.rejectedToast'));
    queryClient.invalidateQueries({ queryKey: ['evv-review-queue'] });
    queryClient.invalidateQueries({ queryKey: ['evv-submissions-server'] });
  }

  if (!canReview) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">{t('evv.review.noAccess')}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={ShieldCheck} title={t('evv.reviewPage.title')} description={t('evv.reviewPage.subtitle')} />

      <Card>
        <CardHeader>
          <CardTitle>{t('evv.reviewPage.queue')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('evv.reviewPage.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('evv.history.formType')}</TableHead>
                  <TableHead>{t('evv.history.date')}</TableHead>
                  <TableHead>{t('evv.scope.task')}</TableHead>
                  <TableHead>{t('evv.detail.reviewTitle')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {t(`evv.forms.${row.form_type === 'leaders_engagement' ? 'leaders' : row.form_type === 'workers_engagement' ? 'workers' : row.form_type}.title`)}
                    </TableCell>
                    <TableCell>{formatDateTime(row.submitted_at ?? row.updated_at)}</TableCell>
                    <TableCell className="max-w-[360px] truncate">{row.scope?.task_description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={row.review_status === 'rejected' ? 'destructive' : 'secondary'}>
                        {t(`evv.review.${row.review_status ?? 'pending'}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-end gap-2">
                        <Textarea
                          rows={2}
                          className="min-w-[260px]"
                          value={notesById[row.id] ?? ''}
                          onChange={(event) => setNotesById((prev) => ({ ...prev, [row.id]: event.target.value }))}
                          placeholder={t('evv.detail.reviewNotes')}
                        />
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/evv/history/${row.id}`}><Eye /> {t('evv.history.view')}</Link>
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => saveReview(row, 'rejected')}>
                            <XCircle /> {t('evv.review.rejected')}
                          </Button>
                          <Button size="sm" onClick={() => saveReview(row, 'approved')}>
                            <CheckCircle2 /> {t('evv.review.approved')}
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
