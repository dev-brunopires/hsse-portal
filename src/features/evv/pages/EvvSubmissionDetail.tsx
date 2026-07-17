import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, CheckCircle2, XCircle, PenTool, Paperclip, Upload, Trash2, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { SignaturePad } from '@/components/inspections/SignaturePad';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';
import { useShips } from '@/hooks/useShips';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';
import { getEvvCategories, type EvvFormType } from '../catalog';
import type { EvvAnswers, EvvScope } from '../types';
import { generateEvvPDF } from '@/utils/generateEvvPDF';
import { evvCategoryName, evvDeficiencyText, evvQuestionGuidance, evvQuestionText } from '../text';

interface EvvRow {
  id: string;
  client_id: string;
  organization_id: string;
  user_id: string;
  form_type: EvvFormType;
  status: string;
  scope: EvvScope;
  answers: EvvAnswers;
  comments: string;
  submitted_at: string | null;
  signature_data: string | null;
  signed_at: string | null;
  review_status: string | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AttachmentRow {
  id: string;
  submission_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

const REVIEW_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  approved: 'default',
  rejected: 'destructive',
  pending: 'secondary',
};

const ENVIRONMENT_LABEL: Record<string, string> = {
  fpso: 'FPSO',
  project: 'Projeto',
  office: 'Escritório',
  yard: 'Estaleiro',
};

const YES_NO_LABEL: Record<string, string> = {
  yes: 'Sim',
  no: 'Não',
  na: 'N/A',
};

const ORGANIZATION_LABEL: Record<string, string> = {
  sbm: 'SBM',
  contractor: 'Contratada',
  client: 'Cliente',
};

const ROLE_LABEL: Record<string, string> = {
  vendor: 'Fornecedor',
  technician: 'Técnico',
  supervisor: 'Supervisor',
};

function getScopeLabel(value: string | null | undefined, labels: Record<string, string>) {
  if (!value) return undefined;
  return labels[value] ?? value;
}

function translatedScopeLabel(
  value: string | null | undefined,
  labels: Record<string, string>,
  t: (key: string) => string,
) {
  if (!value) return undefined;
  if (labels === ENVIRONMENT_LABEL) {
    if (value === 'fpso') return 'FPSO';
    return t(`evv.environment.${value}`);
  }
  if (labels === YES_NO_LABEL) {
    if (value === 'na') return 'N/A';
    return t(value === 'yes' ? 'common.yes' : 'common.no');
  }
  if (labels === ORGANIZATION_LABEL) {
    if (value === 'sbm') return 'SBM';
    return t(`evv.scope.${value}`);
  }
  if (labels === ROLE_LABEL) {
    if (value === 'supervisor') return 'Supervisor';
    return t(`evv.scope.${value}`);
  }
  return getScopeLabel(value, labels);
}

export default function EvvSubmissionDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, role } = useAuth();
  const { organization } = useOrganization();
  const branding = useOrganizationBranding();
  const { data: ships = [] } = useShips();
  const qc = useQueryClient();

  const [signOpen, setSignOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  const { data: submission, isLoading } = useQuery({
    queryKey: ['evv-submission', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evv_submissions')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as EvvRow | null;
    },
  });
  const canReview = (isAdmin || role === 'supervisor') && submission?.user_id !== user?.id;

  const { data: author } = useQuery({
    queryKey: ['evv-author', submission?.user_id],
    enabled: !!submission?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, position, department')
        .eq('user_id', submission!.user_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: reviewer } = useQuery({
    queryKey: ['evv-reviewer', submission?.reviewed_by],
    enabled: !!submission?.reviewed_by,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', submission!.reviewed_by!)
        .maybeSingle();
      return data;
    },
  });

  const { data: attachments = [], refetch: refetchAttach } = useQuery({
    queryKey: ['evv-attachments', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evv_attachments')
        .select('*')
        .eq('submission_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AttachmentRow[];
    },
  });

  useEffect(() => {
    if (submission?.review_notes) setReviewNotes(submission.review_notes);
  }, [submission?.review_notes]);

  const ship = useMemo(() => {
    const sid = submission?.scope.vessel_ids?.[0];
    return sid ? ships.find((s) => s.id === sid) ?? null : null;
  }, [submission, ships]);
  const categories = useMemo(
    () => submission ? getEvvCategories(submission.form_type) : [],
    [submission],
  );

  async function saveReview(status: 'approved' | 'rejected') {
    if (!submission || !user) return;
    if (status === 'rejected' && reviewNotes.trim().length < 5) {
      toast.error(t('evv.detail.rejectionNotesRequired'));
      return;
    }
    const { error } = await supabase
      .from('evv_submissions')
      .update({
        review_status: status,
        review_notes: reviewNotes,
      })
      .eq('id', submission.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t(`evv.detail.${status}Toast`));
    qc.invalidateQueries({ queryKey: ['evv-submission', id] });
    qc.invalidateQueries({ queryKey: ['evv-submissions-server'] });
  }

  async function saveSignature(sig: string) {
    if (!submission) return;
    const { error } = await supabase
      .from('evv_submissions')
      .update({ signature_data: sig, signed_at: new Date().toISOString() })
      .eq('id', submission.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t('evv.detail.signedToast'));
    setSignOpen(false);
    qc.invalidateQueries({ queryKey: ['evv-submission', id] });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !submission || !user || !organization?.id) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error(t('evv.detail.invalidAttachment'));
      e.target.value = '';
      return;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${submission.id}/${crypto.randomUUID()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from('evv-attachments').upload(path, file);
    if (upErr) { toast.error(upErr.message); return; }
    const { error: insErr } = await supabase.from('evv_attachments').insert({
      submission_id: submission.id,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: user.id,
    });
    if (insErr) { toast.error(insErr.message); return; }
    toast.success(t('evv.detail.uploaded'));
    e.target.value = '';
    refetchAttach();
  }

  async function downloadAttachment(att: AttachmentRow) {
    const { data, error } = await supabase.storage.from('evv-attachments').createSignedUrl(att.file_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function deleteAttachment(att: AttachmentRow) {
    await supabase.storage.from('evv-attachments').remove([att.file_path]);
    await supabase.from('evv_attachments').delete().eq('id', att.id);
    refetchAttach();
  }

  async function exportPDF() {
    if (!submission || !author) { toast.error(t('common.loading')); return; }
    try {
      await generateEvvPDF({
        submission: {
          ...submission,
          reviewed_by_name: reviewer?.full_name ?? null,
        },
        author: {
          full_name: author.full_name,
          email: author.email,
          position: author.position,
          department: author.department,
        },
        ship: ship ? { name: ship.name, code: ship.code } : null,
        branding,
      }, { preview: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'PDF error');
    }
  }

  if (isLoading || !submission) {
    return <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title={t(`evv.forms.${submission.form_type === 'leaders_engagement' ? 'leaders' : submission.form_type === 'workers_engagement' ? 'workers' : submission.form_type}.title`)}
        description={t('evv.detail.subtitle')}
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/evv/history')}>
              <ArrowLeft /> {t('common.back')}
            </Button>
            <Button variant="outline" onClick={exportPDF}>
              <FileText /> {t('evv.detail.exportPdf')}
            </Button>
            {!submission.signature_data && submission.user_id === user?.id && submission.review_status !== 'approved' && (
              <Button variant="outline" onClick={() => setSignOpen(true)}>
                <PenTool /> {t('evv.detail.sign')}
              </Button>
            )}
          </div>
        )}
      />

      {/* Status row */}
      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant={REVIEW_VARIANT[submission.review_status ?? 'pending']}>
          {t(`evv.review.${submission.review_status ?? 'pending'}`)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {t('evv.detail.submittedAt')}: {formatDateTime(submission.submitted_at ?? submission.updated_at)}
        </span>
        {submission.signed_at && (
          <span className="text-sm text-muted-foreground">
            · {t('evv.detail.signedAt')}: {formatDateTime(submission.signed_at)}
          </span>
        )}
      </div>

      {/* Scope */}
      <Card>
        <CardHeader><CardTitle>{t('evv.pdf.scopeSection')}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
          <Field label={t('evv.scope.environment')} value={translatedScopeLabel(submission.scope.environment, ENVIRONMENT_LABEL, t)} />
          <Field label={t('evv.scope.area')} value={submission.scope.area} />
          <Field label={t('evv.scope.vessel')} value={ship?.name} />
          <Field label={t('evv.scope.location')} value={submission.scope.location} />
          <Field label={t('evv.scope.visitDate')} value={formatDateTime(submission.scope.visit_datetime)} />
          <Field label={t('evv.scope.permitToWork')} value={translatedScopeLabel(submission.scope.permit_to_work, YES_NO_LABEL, t)} />
          {submission.scope.permit_to_work === 'yes' && (
            <Field label={t('evv.scope.permitToWorkNumber')} value={submission.scope.permit_to_work_number} />
          )}
          <Field label={t('evv.scope.criticalActivity')} value={translatedScopeLabel(submission.scope.critical_activity, YES_NO_LABEL, t)} />
          {submission.scope.critical_activity === 'yes' && (
            <Field
              label={t('evv.scope.criticalActivities')}
              value={submission.scope.critical_activities?.length ? submission.scope.critical_activities.join(', ') : t('evv.scope.criticalActivitiesPendingShort')}
            />
          )}
          <Field label={t('evv.scope.yourOrg')} value={submission.scope.your_organization} />
          <Field label={t('evv.scope.department')} value={submission.scope.department} />
          {submission.form_type === 'leaders_engagement' && (
            <>
              <Field label={t('evv.scope.observedOrg')} value={translatedScopeLabel(submission.scope.observed_organization, ORGANIZATION_LABEL, t)} />
              <Field label={t('evv.scope.observedRole')} value={translatedScopeLabel(submission.scope.observed_role, ROLE_LABEL, t)} />
            </>
          )}
          <Field label={t('evv.scope.task')} value={submission.scope.task_description} full />
        </CardContent>
      </Card>

      {/* Observations */}
      <Card>
        <CardHeader><CardTitle>{t('evv.pdf.observationsSection')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {categories.map((cat) => {
            const rows = cat.questions
              .map((q) => ({ q, a: submission.answers[q.id] }))
              .filter((r) => r.a?.rating);
            if (rows.length === 0) return null;
            return (
              <div key={cat.id} className="border rounded-md p-3">
                <p className="text-sm font-semibold mb-2">{evvCategoryName(cat, t)}</p>
                <div className="space-y-2">
                  {rows.map(({ q, a }) => (
                    <div key={q.id} className="text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex-1">
                          {evvQuestionText(q, t)}
                          {evvQuestionGuidance(q, t) && (
                            <span className="block text-xs text-muted-foreground mt-0.5">{evvQuestionGuidance(q, t)}</span>
                          )}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            a!.rating === 'effective' && 'border-emerald-600 text-emerald-700',
                            a!.rating === 'not_effective' && 'border-destructive text-destructive',
                          )}
                        >
                          {t(`evv.rating.${a!.rating}`)}
                        </Badge>
                      </div>
                      {a!.deficiencies?.length > 0 && (
                        <ul className="mt-1 ml-4 text-xs text-muted-foreground list-disc">
                          {a!.deficiencies.map((d) => <li key={d}>{evvDeficiencyText(q, d, t)}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {Object.keys(submission.answers).length === 0 && (
            <p className="text-sm text-muted-foreground">{t('evv.pdf.noObservations')}</p>
          )}
        </CardContent>
      </Card>

      {/* Comments */}
      {submission.comments && (
        <Card>
          <CardHeader><CardTitle>{t('evv.pdf.commentsSection')}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{submission.comments}</p>
          </CardContent>
        </Card>
      )}

      {/* Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> {t('evv.detail.attachments')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {submission.user_id === user?.id && submission.review_status !== 'approved' && (
          <label className="inline-flex">
            <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden" onChange={handleUpload} />
            <span className="inline-flex items-center gap-2 cursor-pointer rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" /> {t('evv.detail.uploadFile')}
            </span>
          </label>
          )}
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('evv.detail.noAttachments')}</p>
          ) : (
            <ul className="space-y-1">
              {attachments.map((att) => (
                <li key={att.id} className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2">
                  <span className="truncate flex-1">{att.file_name}</span>
                  <Button size="icon" variant="ghost" onClick={() => downloadAttachment(att)} aria-label={t('common.download')}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {submission.review_status !== 'approved' && (att.uploaded_by === user?.id || canReview) && (
                    <Button size="icon" variant="ghost" onClick={() => deleteAttachment(att)} aria-label={t('common.delete')}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Review */}
      {canReview && submission.review_status !== 'approved' && (
        <Card>
          <CardHeader><CardTitle>{t('evv.detail.reviewTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>{t('evv.detail.reviewNotes')}</Label>
              <Textarea rows={3} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
            </div>
            <Separator />
            <div className="flex gap-2 justify-end">
              <Button variant="destructive" onClick={() => saveReview('rejected')}>
                <XCircle /> {t('evv.review.rejected')}
              </Button>
              <Button onClick={() => saveReview('approved')}>
                <CheckCircle2 /> {t('evv.review.approved')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('evv.detail.sign')}</DialogTitle></DialogHeader>
          <SignaturePad onSave={saveSignature} onCancel={() => setSignOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={cn(full && 'md:col-span-2')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || '-'}</p>
    </div>
  );
}
