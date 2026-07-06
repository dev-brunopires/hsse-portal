import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Send, Save, ClipboardList, Globe2, Ship as ShipIcon } from 'lucide-react';
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
import { DateTimePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUserShips } from '@/hooks/useUserShips';
import { useShips } from '@/hooks/useShips';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { getEvvCategories, type EvvFormType, type Rating } from '../catalog';
import type { EvvAnswers, EvvScope, EvvSubmission } from '../types';
import { getSubmissionLocal, saveSubmissionLocal } from '../offline';
import { getDepartmentLabel } from '@/data/departments';
import { AreaCombobox } from '@/components/ships/AreaCombobox';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useRegions } from '@/hooks/useRegions';

function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `evv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const EMPTY_SCOPE: EvvScope = {
  environment: '', area: '', location: '', visit_datetime: '',
  permit_to_work: '', critical_activity: '', vessel_ids: [],
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
  const { t, i18n } = useTranslation();
  const { formType } = useParams<{ formType: EvvFormType }>();
  const [params] = useSearchParams();
  const draftIdParam = params.get('draft');
  const navigate = useNavigate();
  const { user, profile, role, isPlatformOwner } = useAuth();
  const { organization } = useOrganization();

  const formId = (formType ?? 'safeguard') as EvvFormType;
  const isLeaders = formId === 'leaders_engagement';
  const categories = useMemo(() => getEvvCategories(formId), [formId]);

  const [clientId] = useState<string>(() => draftIdParam || newClientId());
  const [step, setStep] = useState(0);
  const [scope, setScope] = useState<EvvScope>(EMPTY_SCOPE);
  const [answers, setAnswers] = useState<EvvAnswers>({});
  const [comments, setComments] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [scopeValidationAttempted, setScopeValidationAttempted] = useState(false);

  // === Auto-fill sources ===
  const { data: userShips = [], isLoading: userShipsLoading } = useUserShips(user?.id);
  const { data: orgShips = [], isLoading: orgShipsLoading } = useShips();
  const { data: regions = [], isLoading: regionsLoading } = useRegions();
  const { selectedShipId, isReady: shipFilterReady } = useShipFilter();
  const shipsLoading = userShipsLoading || orgShipsLoading || regionsLoading || !shipFilterReady;

  const canUseAllOrganizationShips = role === 'admin' || role === 'admin_master' || isPlatformOwner;
  const availableShips = userShips.length > 0
    ? userShips.map((us) => ({ id: us.ship_id, name: us.ship?.name ?? us.ship_id }))
    : canUseAllOrganizationShips
      ? orgShips.map((s) => ({ id: s.id, name: s.name }))
      : [];
  const accountShipId = (
    selectedShipId && availableShips.some((ship) => ship.id === selectedShipId)
      ? selectedShipId
      : availableShips[0]?.id
  ) || '';
  const shipId = scope.vessel_ids[0] || accountShipId;
  const selectedShip = availableShips.find((ship) => ship.id === shipId);
  const selectedShipRecord = orgShips.find((ship) => ship.id === shipId);
  const selectedRegion = regions.find((region) => region.id === selectedShipRecord?.region_id);

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

  // Auto-populate read-only fields from the logged user's profile.
  useEffect(() => {
    setScope((prev) => ({
      ...prev,
      your_organization: prev.your_organization || organization?.name || '',
      department: prev.department || getDepartmentLabel(profile?.department, i18n.resolvedLanguage) || profile?.position || '',
      your_role: prev.your_role || role || '',
    }));
  }, [organization?.name, profile?.position, profile?.department, role, i18n.resolvedLanguage]);

  useEffect(() => {
    if (!accountShipId || draftIdParam || shipsLoading) return;
    setScope((prev) => (
      prev.vessel_ids[0] === accountShipId
        ? prev
        : { ...prev, vessel_ids: [accountShipId], location: '' }
    ));
  }, [accountShipId, draftIdParam, shipsLoading]);

  useEffect(() => {
    if (draftIdParam || shipsLoading) return;
    setScope((prev) => ({
      ...prev,
      area: selectedRegion?.name || '',
    }));
  }, [draftIdParam, selectedRegion?.name, shipsLoading]);


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

  const scopeMissingFields = useMemo(() => {
    const missing: string[] = [];
    if (!scope.environment) missing.push(t('evv.scope.environment'));
    if (!scope.area) missing.push(t('evv.scope.area'));
    if (!scope.visit_datetime) missing.push(t('evv.scope.visitDate'));
    if (!scope.your_organization) missing.push(t('evv.scope.yourOrg'));
    if (!scope.department) missing.push(t('evv.scope.department'));
    if (scope.vessel_ids.length === 0) missing.push(t('evv.scope.vessel'));
    if (!scope.location) missing.push(t('evv.scope.location'));
    if (!scope.permit_to_work) missing.push(t('evv.scope.permitToWork'));
    if (!scope.critical_activity) missing.push(t('evv.scope.criticalActivity'));
    if (isLeaders && !scope.observed_organization) missing.push(t('evv.scope.observedOrg'));
    if (isLeaders && !scope.observed_role) missing.push(t('evv.scope.observedRole'));
    if (scope.task_description.trim().length < 3) missing.push(t('evv.scope.task'));
    return missing;
  }, [isLeaders, scope, t]);
  const scopeValid = scopeMissingFields.length === 0;
  const categoriesValid = Object.entries(answers).some(([, a]) => !!a.rating)
    && categories.every((cat) => cat.questions.every((q) => {
      const answer = answers[q.id];
      return answer?.rating !== 'not_effective' || (answer.deficiencies?.length ?? 0) > 0;
    }));
  const hasNotEffective = Object.values(answers).some((a) => a.rating === 'not_effective');
  const closingValid = !hasNotEffective || comments.trim().length >= 3;

  async function handleSubmit() {
    if (!scopeValid) {
      toast.error(t('evv.wizard.scopeRequired'));
      setStep(0);
      return;
    }
    if (!categoriesValid) {
      toast.error(t('evv.wizard.answersRequired'));
      setStep(1);
      return;
    }
    if (!closingValid) {
      toast.error(t('evv.wizard.commentsRequired'));
      setStep(2);
      return;
    }

    const submitted_at = new Date().toISOString();
    const isOnline = navigator.onLine && !!user && !!organization?.id;

    if (isOnline) {
      const { error } = await supabase.from('evv_submissions').upsert({
        client_id: clientId,
        organization_id: organization!.id,
        user_id: user!.id,
        form_type: formId,
        status: 'completed',
        scope: scope as unknown as Json,
        answers: answers as unknown as Json,
        comments,
        review_status: 'pending',
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
              <RequiredLabel>{t('evv.scope.environment')}</RequiredLabel>
              <Select value={scope.environment} onValueChange={(v) => setScope({ ...scope, environment: v as EvvScope['environment'] })}>
                <SelectTrigger><SelectValue placeholder={t('evv.scope.select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fpso">FPSO</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="yard">Yard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <RequiredLabel>{t('evv.scope.area')}</RequiredLabel>
              <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm">
                <Globe2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">
                  {shipsLoading
                    ? t('common.loading')
                    : scope.area || t('evv.scope.noRegionAssigned')}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <RequiredLabel>{t('evv.scope.visitDate')}</RequiredLabel>
              <DateTimePicker
                value={scope.visit_datetime}
                onChange={(value) => setScope({ ...scope, visit_datetime: value })}
              />
            </div>

            {/* Your Organization (auto, read-only) */}
            <div className="space-y-2">
              <RequiredLabel>{t('evv.scope.yourOrg')}</RequiredLabel>
              <Input value={scope.your_organization} readOnly className="bg-muted/40" />
            </div>

            {/* Department (auto from profile cargo, read-only) */}
            <div className="space-y-2">
              <RequiredLabel>{t('evv.scope.department')}</RequiredLabel>
              <Input value={scope.department} readOnly className="bg-muted/40" />
            </div>

            {/* Vessel follows the global account selection, as in Heat Stress. */}
            <div className="space-y-2 md:col-span-2">
              <RequiredLabel>{t('evv.scope.vessel')}</RequiredLabel>
              <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm">
                <ShipIcon className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate font-medium">
                  {shipsLoading
                    ? t('common.loading')
                    : selectedShip?.name || t('evv.scope.noVesselsAssigned')}
                </span>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <RequiredLabel>{t('evv.scope.location')}</RequiredLabel>
              <AreaCombobox
                shipId={shipId}
                value={scope.location}
                onChange={(value) => setScope({ ...scope, location: value })}
                placeholder={t('evv.scope.locationPlaceholder')}
                disabled={shipsLoading || !shipId}
              />
            </div>

            <div className="space-y-2">
              <RequiredLabel>{t('evv.scope.permitToWork')}</RequiredLabel>
              <Select value={scope.permit_to_work} onValueChange={(v) => setScope({ ...scope, permit_to_work: v as EvvScope['permit_to_work'] })}>
                <SelectTrigger><SelectValue placeholder={t('evv.scope.select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">{t('common.yes')}</SelectItem>
                  <SelectItem value="no">{t('common.no')}</SelectItem>
                  <SelectItem value="na">N/A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <RequiredLabel>{t('evv.scope.criticalActivity')}</RequiredLabel>
              <Select value={scope.critical_activity} onValueChange={(v) => setScope({ ...scope, critical_activity: v as EvvScope['critical_activity'] })}>
                <SelectTrigger><SelectValue placeholder={t('evv.scope.select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">{t('common.yes')}</SelectItem>
                  <SelectItem value="no">{t('common.no')}</SelectItem>
                </SelectContent>
              </Select>
            </div>



            {isLeaders && (
              <>
                <div className="space-y-2">
                  <RequiredLabel>{t('evv.scope.observedOrg')}</RequiredLabel>
                  <Select value={scope.observed_organization || ''} onValueChange={(v) => setScope({ ...scope, observed_organization: v as EvvScope['observed_organization'] })}>
                    <SelectTrigger><SelectValue placeholder={t('evv.scope.select')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sbm">SBM</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <RequiredLabel>{t('evv.scope.observedRole')}</RequiredLabel>
                  <Select value={scope.observed_role || ''} onValueChange={(v) => setScope({ ...scope, observed_role: v as EvvScope['observed_role'] })}>
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
              <RequiredLabel>{t('evv.scope.task')}</RequiredLabel>
              <Textarea
                rows={3}
                value={scope.task_description}
                onChange={(e) => setScope({ ...scope, task_description: e.target.value })}
                placeholder={t('evv.scope.taskPlaceholder')}
              />
            </div>
            {scopeValidationAttempted && scopeMissingFields.length > 0 && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm md:col-span-2">
                <p className="font-medium text-primary">{t('evv.wizard.requiredFieldsHint')}</p>
                <p className="mt-1 text-muted-foreground">{scopeMissingFields.join(', ')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>{t('evv.wizard.step2')}</CardTitle></CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {categories.map((cat) => (
                <AccordionItem key={cat.id} value={cat.id}>
                  <AccordionTrigger className="text-left">{cat.name}</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    {cat.questions.map((q) => {
                      const a = answers[q.id];
                      return (
                        <div key={q.id} className="rounded-md border p-3 space-y-2">
                          <p className="text-sm font-medium">{q.text}</p>
                          {q.guidance && (
                            <p className="text-xs text-muted-foreground">{q.guidance}</p>
                          )}
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
              onClick={() => {
                if (step === 0 && !scopeValid) {
                  setScopeValidationAttempted(true);
                  toast.error(t('evv.wizard.missingFields', { fields: scopeMissingFields.join(', ') }));
                  return;
                }
                if (step === 1 && !categoriesValid) {
                  toast.error(t('evv.wizard.answersRequired'));
                  return;
                }
                setStep(step + 1);
              }}
            >
              {t('common.next')} <ChevronRight />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={handleSubmit} disabled={!closingValid}>
              <Send /> {t('evv.wizard.submit')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label>
      {children} <span className="text-primary" aria-hidden="true">*</span>
    </Label>
  );
}
