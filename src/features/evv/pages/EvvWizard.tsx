import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Send, Save, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUserShips } from '@/hooks/useUserShips';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { EVV_CATEGORIES, type EvvFormType, type Rating } from '../catalog';
import type { EvvAnswers, EvvScope, EvvSubmission } from '../types';
import { getSubmissionLocal, saveSubmissionLocal } from '../offline';
import { supabase } from '@/integrations/supabase/client';

function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `evv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const EMPTY_SCOPE: EvvScope = {
  environment: '', vessel_ids: [],
  department: '', your_organization: '', your_role: '',
  task_description: '', observed_organization: '', observed_role: '',
};

const FORM_TITLE_KEY: Record<EvvFormType, string> = {
  safeguard: 'evv.forms.safeguard.title',
  leaders_engagement: 'evv.forms.leaders.title',
  workers_engagement: 'evv.forms.workers.title',
  tlo: 'evv.forms.tlo.title',
  aar: 'evv.forms.aar.title',
};

export default function EvvWizard() {
  const { t } = useTranslation();
  const { formType } = useParams<{ formType: EvvFormType }>();
  const [params] = useSearchParams();
  const draftIdParam = params.get('draft');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();

  const formId = (formType ?? 'safeguard') as EvvFormType;
  const isLeaders = formId === 'leaders_engagement';

  const [clientId] = useState<string>(() => draftIdParam || newClientId());
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState<EvvScope>(EMPTY_SCOPE);
  const [answers, setAnswers] = useState<EvvAnswers>({});
  const [comments, setComments] = useState('');
  const [loaded, setLoaded] = useState(false);

  // === Auto-fill sources ===
  const { data: userShips = [] } = useUserShips(user?.id);

  const { data: profile } = useQuery({
    queryKey: ['evv-profile', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('department, full_name')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: roleRow } = useQuery({
    queryKey: ['evv-role', user?.id, organization?.id],
    enabled: !!user?.id && !!organization?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .eq('organization_id', organization!.id)
        .maybeSingle();
      return data;
    },
  });

  // Hydrate draft
  useEffect(() => {
    (async () => {
      if (draftIdParam) {
        const draft = await getSubmissionLocal(draftIdParam);
        if (draft) {
          setScope({ ...EMPTY_SCOPE, ...draft.scope });
          setAnswers(draft.answers);
          setComments(draft.comments);
        }
      }
      setLoaded(true);
    })();
  }, [draftIdParam]);

  // Auto-populate read-only fields from logged user
  useEffect(() => {
    setScope((prev) => ({
      ...prev,
      your_organization: prev.your_organization || organization?.name || '',
      your_role: prev.your_role || (roleRow?.role as string) || '',
      department: prev.department || profile?.department || '',
    }));
  }, [organization?.name, roleRow?.role, profile?.department]);

  // Auto-save draft
  useEffect(() => {
    if (!loaded) return;
    const sub: EvvSubmission = {
      client_id: clientId,
      form_type: formId,
      status: 'draft',
      scope,
      answers,
      comments,
      updated_at: new Date().toISOString(),
    };
    const handle = setTimeout(() => { saveSubmissionLocal(sub); }, 500);
    return () => clearTimeout(handle);
  }, [loaded, clientId, formId, scope, answers, comments]);

  function setAnswer(qid: string, patch: Partial<EvvAnswers[string]>) {
    setAnswers((prev) => ({
      ...prev,
      [qid]: { rating: prev[qid]?.rating ?? null, deficiencies: prev[qid]?.deficiencies ?? [], ...patch },
    }));
  }

  function toggleDeficiency(qid: string, label: string) {
    const current = answers[qid]?.deficiencies ?? [];
    const next = current.includes(label) ? current.filter((d) => d !== label) : [...current, label];
    setAnswer(qid, { deficiencies: next });
  }

  function toggleVessel(shipId: string) {
    setScope((prev) => ({
      ...prev,
      vessel_ids: prev.vessel_ids.includes(shipId)
        ? prev.vessel_ids.filter((id) => id !== shipId)
        : [...prev.vessel_ids, shipId],
    }));
  }

  // Validação relaxada: permite avançar/salvar mesmo com campos vazios.
  const scopeValid = true;
  const categoriesValid = true;

  async function handleSubmit() {
    const submitted_at = new Date().toISOString();
    const isOnline = navigator.onLine && !!user && !!organization?.id;

    if (isOnline) {
      const { error } = await supabase.from('evv_submissions' as any).upsert({
        client_id: clientId,
        organization_id: organization!.id,
        user_id: user!.id,
        form_type: formId,
        status: 'completed',
        scope,
        answers,
        comments,
        submitted_at,
      }, { onConflict: 'client_id' });
      if (error) {
        await saveSubmissionLocal({
          client_id: clientId, form_type: formId, status: 'not_synced',
          scope, answers, comments, submitted_at, updated_at: submitted_at,
        });
        toast.warning(t('evv.wizard.savedOffline'));
      } else {
        await saveSubmissionLocal({
          client_id: clientId, form_type: formId, status: 'completed',
          scope, answers, comments, submitted_at, updated_at: submitted_at,
        });
        toast.success(t('evv.wizard.submitted'));
      }
    } else {
      await saveSubmissionLocal({
        client_id: clientId, form_type: formId, status: 'not_synced',
        scope, answers, comments, submitted_at, updated_at: submitted_at,
      });
      toast.warning(t('evv.wizard.savedOffline'));
    }
    navigate('/evv/history');
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={ClipboardList} title={t(FORM_TITLE_KEY[formId])} description={t('evv.wizard.subtitle')} />

      <div className="flex items-center gap-2 text-sm">
        {[0, 1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center font-medium',
              step === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}>{s + 1}</div>
            <span className={cn('hidden md:inline', step === s ? 'text-foreground' : 'text-muted-foreground')}>
              {t(`evv.wizard.step${s + 1}`)}
            </span>
            {s < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>{t('evv.wizard.step1')}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {/* Environment */}
            <div className="space-y-2">
              <Label>{t('evv.scope.environment')}</Label>
              <Select value={scope.environment} onValueChange={(v) => setScope({ ...scope, environment: v as any })}>
                <SelectTrigger><SelectValue placeholder={t('evv.scope.select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fpso">FPSO</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Your Organization (auto, read-only) */}
            <div className="space-y-2">
              <Label>{t('evv.scope.yourOrg')}</Label>
              <Input value={scope.your_organization} readOnly className="bg-muted/40" />
            </div>

            {/* Your Role (auto, read-only) */}
            <div className="space-y-2">
              <Label>{t('evv.scope.yourRole')}</Label>
              <Input value={scope.your_role} readOnly className="bg-muted/40" />
            </div>

            {/* Department (auto from profile, editable if empty) */}
            <div className="space-y-2">
              <Label>{t('evv.scope.department')}</Label>
              <Input
                value={scope.department}
                onChange={(e) => setScope({ ...scope, department: e.target.value })}
                placeholder={t('evv.scope.select')}
              />
            </div>

            {/* Sites / Vessels (multi-select, from user's assigned ships) */}
            <div className="space-y-2 md:col-span-2">
              <Label>{t('evv.scope.vessel')}</Label>
              {userShips.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-md border p-3">
                  {t('evv.scope.noVesselsAssigned')}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 rounded-md border p-3">
                  {userShips.map((us) => (
                    <label key={us.ship_id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={scope.vessel_ids.includes(us.ship_id)}
                        onCheckedChange={() => toggleVessel(us.ship_id)}
                      />
                      <span>{us.ship?.name ?? us.ship_id}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {isLeaders && (
              <>
                <div className="space-y-2">
                  <Label>{t('evv.scope.observedOrg')}</Label>
                  <Select value={scope.observed_organization || ''} onValueChange={(v) => setScope({ ...scope, observed_organization: v as any })}>
                    <SelectTrigger><SelectValue placeholder={t('evv.scope.select')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sbm">SBM</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('evv.scope.observedRole')}</Label>
                  <Select value={scope.observed_role || ''} onValueChange={(v) => setScope({ ...scope, observed_role: v as any })}>
                    <SelectTrigger><SelectValue placeholder={t('evv.scope.select')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendor">Vendor</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>{t('evv.scope.task')}</Label>
              <Textarea
                rows={3}
                value={scope.task_description}
                onChange={(e) => setScope({ ...scope, task_description: e.target.value })}
                placeholder={t('evv.scope.taskPlaceholder')}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>{t('evv.wizard.step2')}</CardTitle></CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {EVV_CATEGORIES.map((cat) => (
                <AccordionItem key={cat.id} value={cat.id}>
                  <AccordionTrigger className="text-left">{cat.name}</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    {cat.questions.map((q) => {
                      const a = answers[q.id];
                      return (
                        <div key={q.id} className="rounded-md border p-3 space-y-2">
                          <p className="text-sm font-medium">{q.text}</p>
                          <div className="flex flex-wrap gap-2">
                            {(['effective', 'not_effective', 'not_assessed'] as Rating[]).map((r) => (
                              <Button
                                key={r}
                                type="button"
                                size="sm"
                                variant={a?.rating === r ? 'default' : 'outline'}
                                className={cn(
                                  a?.rating === r && r === 'effective' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                                  a?.rating === r && r === 'not_effective' && 'bg-destructive hover:bg-destructive/90',
                                  a?.rating === r && r === 'not_assessed' && 'bg-muted-foreground hover:bg-muted-foreground/90',
                                )}
                                onClick={() => setAnswer(q.id, { rating: r, deficiencies: r === 'not_effective' ? (a?.deficiencies ?? []) : [] })}
                              >
                                {t(`evv.rating.${r}`)}
                              </Button>
                            ))}
                          </div>
                          {a?.rating === 'not_effective' && q.deficiencies && (
                            <div className="space-y-2 pt-2 border-t">
                              <p className="text-xs font-medium text-destructive">
                                {t('evv.wizard.selectDeficiencies')}
                              </p>
                              {q.deficiencies.map((d) => (
                                <label key={d} className="flex items-start gap-2 text-sm cursor-pointer">
                                  <Checkbox
                                    checked={a.deficiencies.includes(d)}
                                    onCheckedChange={() => toggleDeficiency(q.id, d)}
                                  />
                                  <span>{d}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>{t('evv.wizard.step3')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Label>{t('evv.wizard.commentsLabel')}</Label>
            <Textarea rows={6} value={comments} onChange={(e) => setComments(e.target.value)} placeholder={t('evv.wizard.commentsPlaceholder')} />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => step === 0 ? navigate('/evv/forms') : setStep(step - 1)}>
          <ChevronLeft /> {step === 0 ? t('common.cancel') : t('common.previous')}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { toast.success(t('evv.wizard.draftSaved')); navigate('/evv/history'); }}>
            <Save /> {t('evv.wizard.saveDraft')}
          </Button>
          {step < 2 && (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 0 && !scopeValid) || (step === 1 && !categoriesValid)}
            >
              {t('common.next')} <ChevronRight />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={handleSubmit}>
              <Send /> {t('evv.wizard.submit')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
