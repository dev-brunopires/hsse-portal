import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Save,
  ShieldAlert,
  Ship as ShipIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AreaCombobox } from '@/components/ships/AreaCombobox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker, DateTimePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useAccess } from '@/hooks/useAccess';
import { useShips } from '@/hooks/useShips';
import {
  useCreateSafetyObservation,
  type SafetyCardTemplate,
  type SafetyLikelihood,
  type SafetyRiskLevel,
  type SafetySeverity,
  type TemplateChecklist,
  type TemplateChecklistStatus,
  type TemplateFlags,
} from '@/hooks/useSafetyObservations';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { translateOptions, useSafetyObservationText } from '@/utils/safetyObservationText';

type Option = readonly [string, string];

const departments = [
  ['production', 'Produção'],
  ['cargo', 'Carga'],
  ['maintenance', 'Manutenção'],
  ['safety', 'Segurança'],
  ['other', 'Outro'],
  ['subcontractor_visitor', 'Subcontratado / visitante'],
] as const;

const locationOptions = [
  ['turret', 'Turret'],
  ['cargo_main_deck', 'Convés principal de carga'],
  ['cargo_tanks', 'Tanques de carga'],
  ['engine_room', 'Casa de máquinas'],
  ['topsides', 'Topsides'],
  ['pump_room', 'Sala de bombas'],
  ['other', 'Outro'],
] as const;

const behaviourItems = [
  ['appropriate_ppe_head_face_respiratory', 'EPI adequado (cabeça, face, respiratório)'],
  ['appropriate_ppe_arms_hands_body', 'EPI adequado (braços, mãos, corpo)'],
  ['appropriate_ppe_legs_feet', 'EPI adequado (pernas e pés)'],
  ['tools_equipment_correctly_used', 'Ferramentas / equipamentos usados corretamente'],
  ['manual_handling', 'Manuseio manual'],
  ['procedures_known_understood', 'Procedimentos conhecidos e compreendidos'],
  ['procedures_followed', 'Procedimentos seguidos'],
  ['work_preparation_ptw_tra', 'Preparação do trabalho (PTW / TRA)'],
  ['intervention_stop_work_make_safe', 'Intervenção (autoridade de parar o trabalho, tornar seguro)'],
  ['effective_communication_toolbox', 'Comunicação efetiva / DDS'],
  ['other', 'Outro'],
] as const;

const conditionItems = [
  ['simops', 'SIMOPS'],
  ['change_in_work_environment', 'Mudança no ambiente de trabalho'],
  ['access_and_egress', 'Acesso e saída'],
  ['housekeeping_waste_management', 'Organização / gestão de resíduos'],
  ['slips_and_trips', 'Escorregoes e tropeços'],
  ['work_at_height', 'Trabalho em altura'],
  ['dropped_objects', 'Objetos caídos'],
  ['cable_management', 'Gestão de cabos'],
  ['ventilation', 'Ventilação'],
  ['noise', 'Ruído'],
  ['lighting', 'Iluminação'],
  ['chemical_and_substances', 'Produtos químicos e substâncias'],
  ['barrier_signs_notices', 'Barreiras, sinalizações e avisos'],
  ['other', 'Outro'],
] as const;

const equipmentItems = [
  ['electrical', 'Elétrico'],
  ['scaffolding', 'Andaimes'],
  ['lifting_and_rigging', 'Içamento e rigging'],
  ['welding_and_cutting', 'Solda e corte'],
  ['power_and_hand_held_tools', 'Ferramentas elétricas e manuais'],
  ['tools_equipment_good_condition', 'Ferramentas / equipamentos em boas condições'],
  ['isolations_in_place', 'Isolamentos aplicados'],
  ['other', 'Outro'],
] as const;

const operatingModes = [
  ['running', 'Operação'],
  ['maintenance', 'Manutenção'],
  ['standby', 'Standby'],
] as const;

const weepsSeepsTypes = [
  ['hc_gas', 'Gas HC'],
  ['non_hc_gas', 'Gás não HC'],
  ['steam', 'Vapor'],
  ['hc_oil', 'Oleo HC'],
  ['lube_oil', 'Oleo lubrificante'],
  ['chemicals', 'Químicos'],
  ['prod_h2o', 'Água produzida'],
  ['h2o', 'Água'],
  ['other', 'Outro'],
] as const;

const leakLocations = [
  ['instrument_fitting', 'Conexão de instrumento'],
  ['flange', 'Flange'],
  ['weld', 'Solda'],
  ['actuator_seal_or_body', 'Selo ou corpo do atuador'],
  ['heat_exchanger', 'Trocador de calor'],
  ['flexible_hoses', 'Mangueiras flexíveis'],
  ['pipework_pipeline_main_body', 'Corpo principal de tubulação / pipeline'],
  ['welded_connection', 'Conexão soldada'],
  ['valve_seal', 'Selo de válvula'],
  ['valve_body', 'Corpo de válvula'],
  ['pump_seal', 'Selo de bomba (incl. selo de eixo)'],
  ['pump_body', 'Corpo de bomba'],
  ['process_instrument', 'Instrumento de processo'],
  ['tubing_threaded_connection', 'Tubing / conexão roscada'],
  ['other_equipment', 'Outro equipamento'],
] as const;

const mainCauses = [
  ['vibration', 'Vibração'],
  ['corrosion_under_insulation', 'Corrosão sob isolamento'],
  ['other_external_corrosion', 'Outra corrosão externa'],
  ['internal_corrosion', 'Corrosão interna'],
  ['erosion', 'Erosao'],
  ['mechanical_impact', 'Impacto mecânico'],
  ['mechanical_stress', 'Tensão mecânica'],
  ['over_pressurization', 'Sobrepressurização'],
  ['material_failure', 'Falha de material'],
  ['equipment_catastrophic_failure', 'Falha catastrófica de equipamento'],
  ['mal_operation', 'Operação inadequada'],
  ['wear_and_tear', 'Desgaste'],
  ['extreme_weather', 'Clima extremo'],
  ['not_determined', 'Não determinado'],
] as const;

const processSafetySafeguards = [
  ['safe_operating_limits', 'Limites operacionais seguros'],
  ['safety_locks_interlock', 'Travas de segurança / intertravamento'],
  ['procedures_available', 'Procedimentos disponíveis'],
  ['drawings_up_to_date', 'Desenhos atualizados (P&ID, PFD, diagramas)'],
  ['data_up_to_date', 'Dados atualizados (ajustes, registros, informações)'],
  ['temporary_hoses_cable_management', 'Mangueiras temporárias / gestão de cabos'],
] as const;

const processSafetyFundamentals = [
  ['two_barriers_hydrocarbon_chemical_drains_vents', 'Sempre usar duas barreiras para drenos e vents de hidrocarbonetos e químicos'],
  ['remain_in_attendance_critical_transfer_draining', 'Permanecer presente durante transferência crítica ou drenagem'],
  ['interim_mitigating_measures_failure_safe_critical_equipment', 'Aplicar medidas mitigadoras interinas em falha de equipamento crítico de segurança'],
  ['procedures_sign_off_high_risk_activities', 'Em atividades de alto risco, seguir procedimentos e assinar cada etapa'],
  ['walk_the_line_verify_validate', 'Percorrer a linha, verificar e validar qualquer mudança de alinhamento'],
  ['moc_for_change', 'Sempre usar MOC ao fazer uma mudança'],
  ['verify_tightness_after_maintenance', 'Verificar estanqueidade completa após manutenção'],
  ['check_equipment_pressure_free_drained', 'Confirmar equipamento sem pressão, drenado e com isolamento seguro antes de iniciar'],
  ['moc_backflow_protection', 'Realizar MOC e instalar proteção contra refluxo ao conectar utilidades ao processo'],
  ['respond_to_critical_alarms', 'Responder a alarmes críticos'],
] as const;

const observationTypes = [
  ['unsafe_condition', 'Condição insegura'],
  ['unsafe_act', 'Ato inseguro'],
  ['safe_behavior', 'Comportamento seguro'],
  ['good_practice', 'Boa prática'],
  ['near_miss', 'Quase acidente'],
  ['process_safety', 'Segurança de processo'],
] as const;

const riskCategories = [
  ['line_of_fire', 'Linha de fogo'],
  ['dropped_object', 'Objeto queda / dropped object'],
  ['fall_from_height', 'Queda de altura'],
  ['lifting', 'Movimentação de carga'],
  ['electrical', 'Eletricidade'],
  ['pressure', 'Pressão / linhas pressurizadas'],
  ['chemical', 'Produtos químicos'],
  ['fire_explosion', 'Incêndio / explosão'],
  ['loto', 'LOTO / isolamento'],
  ['process_safety', 'Segurança de processo'],
  ['housekeeping', 'Housekeeping'],
] as const;

const severityOptions: Array<[SafetySeverity, string]> = [
  ['low', 'Baixa'],
  ['medium', 'Média'],
  ['high', 'Alta'],
  ['critical', 'Crítica'],
];

const likelihoodOptions: Array<[SafetyLikelihood, string]> = [
  ['unlikely', 'Improvável'],
  ['possible', 'Possível'],
  ['likely', 'Provável'],
  ['very_likely', 'Muito provável'],
];

const riskLabels: Record<SafetyRiskLevel, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
};

const riskClasses: Record<SafetyRiskLevel, string> = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  medium: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
  high: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100',
  critical: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
};

const WIZARD_STEPS = [
  { key: 'template', title: 'Modelo', description: 'Tipo de cartão' },
  { key: 'location', title: 'Local', description: 'Identificação' },
  { key: 'checklist', title: 'Observação', description: 'Itens do cartão' },
  { key: 'risk', title: 'Risco e ação', description: 'Tratativa' },
  { key: 'review', title: 'Revisão', description: 'Conferência final' },
] as const;

function localDateTimeValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function emptyChecklist(options: ReadonlyArray<Option>): TemplateChecklist {
  return Object.fromEntries(options.map(([key]) => [key, 'not_applicable'])) as TemplateChecklist;
}

function emptyFlags(options: ReadonlyArray<Option>): TemplateFlags {
  return Object.fromEntries(options.map(([key]) => [key, false])) as TemplateFlags;
}

function calculateRiskLevel(severity: SafetySeverity, likelihood: SafetyLikelihood): SafetyRiskLevel {
  const severityScore: Record<SafetySeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const likelihoodScore: Record<SafetyLikelihood, number> = { unlikely: 1, possible: 2, likely: 3, very_likely: 4 };
  const score = severityScore[severity] * likelihoodScore[likelihood];
  if (score >= 12) return 'critical';
  if (score >= 8) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

interface FormState {
  cardTemplate: SafetyCardTemplate;
  observerName: string;
  departmentFlags: TemplateFlags;
  area: string;
  locationOptions: TemplateFlags;
  observedAt: string;
  operatingMode: string;
  managerSiteVisit: boolean;
  observationType: string;
  riskCategory: string;
  potentialConsequence: string;
  severity: SafetySeverity;
  likelihood: SafetyLikelihood;
  residualRiskLevel: SafetyRiskLevel;
  stopWork: boolean;
  fatalityPotential: boolean;
  description: string;
  riskPerception: string;
  immediateAction: string;
  personNotified: string;
  recommendedAction: string;
  responsibleName: string;
  dueDate: string;
  requiresFollowup: boolean;
  requiresCmms: boolean;
  requiresInvestigation: boolean;
  shareInTbt: boolean;
  nominatedGoodCard: boolean;
  learning: string;
  workOrderRequired: boolean;
  behaviourChecks: TemplateChecklist;
  conditionChecks: TemplateChecklist;
  equipmentChecks: TemplateChecklist;
  weepsSeepsTypes: TemplateFlags;
  meterLel: string;
  meterH2s: string;
  distanceFromLeak: string;
  dropsPerMin: string;
  leakLocations: TemplateFlags;
  mainCauses: TemplateFlags;
  processSafetySafeguards: TemplateChecklist;
  processSafetyFundamentals: TemplateChecklist;
}

const initialForm: FormState = {
  cardTemplate: 'bco',
  observerName: '',
  departmentFlags: emptyFlags(departments),
  area: '',
  locationOptions: emptyFlags(locationOptions),
  observedAt: localDateTimeValue(),
  operatingMode: 'running',
  managerSiteVisit: false,
  observationType: 'unsafe_condition',
  riskCategory: 'line_of_fire',
  potentialConsequence: '',
  severity: 'medium',
  likelihood: 'possible',
  residualRiskLevel: 'low',
  stopWork: false,
  fatalityPotential: false,
  description: '',
  riskPerception: '',
  immediateAction: '',
  personNotified: '',
  recommendedAction: '',
  responsibleName: '',
  dueDate: '',
  requiresFollowup: false,
  requiresCmms: false,
  requiresInvestigation: false,
  shareInTbt: false,
  nominatedGoodCard: false,
  learning: '',
  workOrderRequired: false,
  behaviourChecks: emptyChecklist(behaviourItems),
  conditionChecks: emptyChecklist(conditionItems),
  equipmentChecks: emptyChecklist(equipmentItems),
  weepsSeepsTypes: emptyFlags(weepsSeepsTypes),
  meterLel: '',
  meterH2s: '',
  distanceFromLeak: '',
  dropsPerMin: '',
  leakLocations: emptyFlags(leakLocations),
  mainCauses: emptyFlags(mainCauses),
  processSafetySafeguards: emptyChecklist(processSafetySafeguards),
  processSafetyFundamentals: emptyChecklist(processSafetyFundamentals),
};

export default function SafetyObservationForm() {
  const tr = useSafetyObservationText();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { organization } = useOrganization();
  const { selectedShipId } = useShipFilter();
  const { data: ships = [], isLoading: shipsLoading } = useShips();
  const access = useAccess();
  const { toast } = useToast();
  const createObservation = useCreateSafetyObservation();
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    observerName: profile?.full_name || '',
  }));
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const shipId = selectedShipId || ships[0]?.id || '';
  const selectedShip = ships.find((ship) => ship.id === shipId);
  const canCreate = access.can('obs_cards', 'safety_observation', 'create');
  const riskLevel = useMemo(() => calculateRiskLevel(form.severity, form.likelihood), [form.severity, form.likelihood]);
  const enforcedFollowup = form.requiresFollowup || form.stopWork || form.fatalityPotential || ['high', 'critical'].includes(riskLevel);
  const isLastStep = step === WIZARD_STEPS.length - 1;
  const translatedDepartments = useMemo(() => translateOptions(departments, tr), [tr]);
  const translatedLocationOptions = useMemo(() => translateOptions(locationOptions, tr), [tr]);
  const translatedOperatingModes = useMemo(() => translateOptions(operatingModes, tr), [tr]);
  const translatedObservationTypes = useMemo(() => translateOptions(observationTypes, tr), [tr]);
  const translatedRiskCategories = useMemo(() => translateOptions(riskCategories, tr), [tr]);
  const translatedSeverityOptions = useMemo(() => translateOptions(severityOptions, tr), [tr]);
  const translatedLikelihoodOptions = useMemo(() => translateOptions(likelihoodOptions, tr), [tr]);
  const translatedRiskOptions = useMemo(() => translateOptions(Object.entries(riskLabels) as Array<[SafetyRiskLevel, string]>, tr), [tr]);

  const resetForm = () => {
    setForm({ ...initialForm, observerName: profile?.full_name || '', observedAt: localDateTimeValue() });
    setStep(0);
  };

  const validateCurrentStep = () => {
    if (step === 1) {
      if (!shipId) {
        toast({ title: tr('Navio obrigatório'), description: tr('Selecione um navio no topo do sistema.'), variant: 'destructive' });
        return false;
      }
      if (!form.area.trim()) {
        toast({ title: tr('Localização obrigatória'), description: tr('Selecione ou cadastre a área onde aconteceu.'), variant: 'destructive' });
        return false;
      }
    }
    if (step === 3 && !form.description.trim()) {
      toast({ title: tr('Descrição obrigatória'), description: tr('Descreva objetivamente o que foi observado.'), variant: 'destructive' });
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
    window.requestAnimationFrame(() => document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  const goBack = () => {
    setStep((current) => Math.max(current - 1, 0));
    window.requestAnimationFrame(() => document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleFlag = (group: keyof Pick<FormState, 'departmentFlags' | 'locationOptions' | 'weepsSeepsTypes' | 'leakLocations' | 'mainCauses'>, key: string) => {
    setForm((current) => ({
      ...current,
      [group]: { ...current[group], [key]: !current[group][key] },
    }));
  };

  const updateChecklist = (group: keyof Pick<FormState, 'behaviourChecks' | 'conditionChecks' | 'equipmentChecks' | 'processSafetySafeguards' | 'processSafetyFundamentals'>, key: string, status: TemplateChecklistStatus) => {
    setForm((current) => ({
      ...current,
      [group]: { ...current[group], [key]: current[group][key] === status ? 'not_applicable' : status },
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.id) {
      toast({ title: tr('Sessão inválida'), description: tr('Faça login novamente.'), variant: 'destructive' });
      return;
    }
    if (!shipId) {
      toast({ title: tr('Navio obrigatório'), description: tr('Selecione um navio no topo do sistema.'), variant: 'destructive' });
      return;
    }
    if (!canCreate) {
      toast({ title: tr('Sem permissão'), description: tr('Seu perfil não pode criar observações de segurança.'), variant: 'destructive' });
      return;
    }
    if (!form.area.trim() || !form.description.trim()) {
      toast({ title: tr('Campos obrigatórios'), description: tr('Preencha área/local e descrição da observação.'), variant: 'destructive' });
      return;
    }

    await createObservation.mutateAsync({
      organization_id: organization?.id ?? selectedShip?.organization_id ?? null,
      ship_id: shipId,
      area: form.area.trim(),
      card_template: form.cardTemplate,
      observer_name: form.observerName.trim() || profile?.full_name || null,
      observer_department: selectedLabels(form.departmentFlags, departments).join(', ') || null,
      observer_id: user.id,
      observed_at: new Date(form.observedAt).toISOString(),
      shift: null,
      activity_type: form.cardTemplate === 'psf' ? 'process_safety' : 'observation_card',
      observation_type: form.observationType,
      risk_category: form.cardTemplate === 'psf' ? 'process_safety' : form.riskCategory,
      energy_source: form.cardTemplate === 'psf' ? selectedLabels(form.weepsSeepsTypes, weepsSeepsTypes).join(', ') || null : null,
      people_exposed: null,
      potential_consequence: form.potentialConsequence.trim() || (form.cardTemplate === 'psf' ? 'Perda de contenção em segurança de processo' : 'Consequência não especificada no cartão de observação'),
      severity: form.severity,
      likelihood: form.likelihood,
      risk_level: riskLevel,
      residual_risk_level: form.residualRiskLevel,
      stop_work: form.stopWork,
      fatality_potential: form.fatalityPotential,
      description: form.description.trim(),
      risk_perception: form.riskPerception.trim() || form.potentialConsequence.trim() || 'Não especificado',
      immediate_action: form.immediateAction.trim() || 'Não especificado',
      person_notified: form.personNotified.trim() || null,
      recommended_action: form.recommendedAction.trim() || null,
      responsible_name: form.responsibleName.trim() || null,
      due_date: form.dueDate || null,
      requires_followup: enforcedFollowup,
      requires_cmms: form.requiresCmms,
      requires_investigation: form.requiresInvestigation || form.fatalityPotential || riskLevel === 'critical',
      share_in_tbt: form.shareInTbt,
      nominated_good_card: form.nominatedGoodCard,
      learning: form.learning.trim() || null,
      location_options: form.locationOptions,
      behaviour_checks: form.cardTemplate === 'bco' ? form.behaviourChecks : {},
      condition_checks: form.cardTemplate === 'bco' ? form.conditionChecks : {},
      equipment_checks: form.cardTemplate === 'bco' ? form.equipmentChecks : {},
      operating_mode: form.cardTemplate === 'psf' ? form.operatingMode : null,
      manager_site_visit: form.managerSiteVisit,
      work_order_required: form.workOrderRequired,
      weeps_seeps: {
        types: form.weepsSeepsTypes,
        meter_lel_percent: form.meterLel || null,
        meter_h2s_ppm: form.meterH2s || null,
        distance_from_leak_m: form.distanceFromLeak || null,
        drops_per_min: form.dropsPerMin || null,
      },
      leak_locations: form.cardTemplate === 'psf' ? form.leakLocations : {},
      main_causes: form.cardTemplate === 'psf' ? form.mainCauses : {},
      process_safety_safeguards: form.cardTemplate === 'psf' ? form.processSafetySafeguards : {},
      process_safety_fundamentals: form.cardTemplate === 'psf' ? form.processSafetyFundamentals : {},
    });

    toast({ title: tr('Observação registrada'), description: tr('O cartão foi salvo com todos os campos do modelo selecionado.') });
    resetForm();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center animate-fade-in">
        <Card className="w-full max-w-xl text-center">
          <CardContent className="space-y-6 py-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">{tr('Obrigado pela sua observação')}</h1>
              <p className="text-sm text-muted-foreground">
                {tr('Seu cartão foi registrado com sucesso. Esse registro ajuda a fortalecer a cultura de segurança e a tratar riscos antes que eles evoluam.')}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button type="button" onClick={() => setSubmitted(false)}>
                {tr('Registrar nova observação')}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/obs-cards')}>
                {tr('Voltar ao Cartão com IA')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-6 pb-2 animate-fade-in">
      <PageHeader
        icon={ClipboardList}
        title={tr('Formulário de Observação de Segurança')}
        subtitle={tr('Modelos Comportamento / Condição e Fundamentos de Segurança de Processo.')}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <ShipIcon className="h-3.5 w-3.5" />
            {shipsLoading ? tr('Carregando navio') : selectedShip?.name || tr('Nenhum navio disponível')}
          </Badge>
          <Badge className={cn('border gap-1', riskClasses[riskLevel])}>
            <ShieldAlert className="h-3.5 w-3.5" />
            {tr('Risco')} {tr(riskLabels[riskLevel])}
          </Badge>
          {enforcedFollowup && (
            <Badge variant="outline" className="border-orange-200 text-orange-700 gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {tr('Acompanhamento requerido')}
            </Badge>
          )}
        </div>
        <Button type="button" variant="outline" onClick={() => navigate('/obs-cards')}>
          {tr('Cartão de Observação com IA')}
        </Button>
      </div>

      <WizardProgress step={step} />

      <form onSubmit={submit} className="space-y-6">
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{tr('Modelo do cartão')}</CardTitle>
              <CardDescription>{tr('Selecione o formulário físico correspondente.')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <TemplateButton
                active={form.cardTemplate === 'bco'}
                title={tr('Comportamento / Condição')}
                description={tr('Cartão azul: comportamento, condição e equipamento.')}
                onClick={() => update('cardTemplate', 'bco')}
              />
              <TemplateButton
                active={form.cardTemplate === 'psf'}
                title={tr('Segurança de Processo')}
                description={tr('Cartão laranja: W&S, causas, salvaguardas e PSF.')}
                onClick={() => update('cardTemplate', 'psf')}
              />
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{tr('Identificação e local')}</CardTitle>
              <CardDescription>{tr('Navio da conta, área cadastrada do navio e campos do cabeçalho do cartão.')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField icon={ShipIcon} label={tr('Navio da conta')} value={selectedShip?.name || tr('Selecione um navio no topo')} />
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {tr('Localização / outro local')}
              </Label>
              <AreaCombobox shipId={shipId} value={form.area} onChange={(value) => update('area', value)} placeholder={tr('Selecione ou crie a área')} disabled={!shipId || createObservation.isPending} />
            </div>
            <InputField label={tr('Nome')} value={form.observerName} onChange={(value) => update('observerName', value)} placeholder={tr('Nome do observador')} />
            <div className="space-y-2">
              <Label>{tr('Data')}</Label>
              <DateTimePicker
                value={form.observedAt}
                onChange={(value) => update('observedAt', value)}
                disabled={createObservation.isPending}
              />
            </div>
            <FlagGrid title={tr('Departamento')} options={translatedDepartments} values={form.departmentFlags} onToggle={(key) => toggleFlag('departmentFlags', key)} />
            <FlagGrid title={tr('Onde aconteceu?')} options={translatedLocationOptions} values={form.locationOptions} onToggle={(key) => toggleFlag('locationOptions', key)} />
            {form.cardTemplate === 'psf' && (
              <>
                <SelectField label={tr('Modo operacional')} value={form.operatingMode} options={translatedOperatingModes} onChange={(value) => update('operatingMode', value)} />
                <CheckOption label={tr('Visita do gerente ao local')} checked={form.managerSiteVisit} onChange={(value) => update('managerSiteVisit', value)} />
              </>
            )}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          form.cardTemplate === 'bco' ? (
            <BcoSection form={form} updateChecklist={updateChecklist} />
          ) : (
            <PsfSection form={form} updateChecklist={updateChecklist} toggleFlag={toggleFlag} update={update} />
          )
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{tr('Descrição, ação e risco')}</CardTitle>
              <CardDescription>{tr('Campos narrativos e controle de acompanhamento / ordem de serviço.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <TextAreaField label={tr('Descreva sua observação')} value={form.description} onChange={(value) => update('description', value)} placeholder={tr('Descreva objetivamente o que foi observado.')} />
              <TextAreaField label={tr('Percepção de risco')} value={form.riskPerception} onChange={(value) => update('riskPerception', value)} placeholder={tr('Qual era o risco percebido?')} />
              <TextAreaField label={tr('Descreva sua ação / discussão / intervenção')} value={form.immediateAction} onChange={(value) => update('immediateAction', value)} placeholder={tr('Descreva a ação, conversa ou intervenção.')} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label={tr('Consequência potencial')} value={form.potentialConsequence} onChange={(value) => update('potentialConsequence', value)} placeholder={tr('Consequência potencial')} />
              <InputField label={tr('Pessoa informada')} value={form.personNotified} onChange={(value) => update('personNotified', value)} placeholder={tr('Supervisor, liderança, OIM...')} />
              <SelectField label={tr('Tipo de observação')} value={form.observationType} options={translatedObservationTypes} onChange={(value) => update('observationType', value)} />
              <SelectField label={tr('Categoria de risco')} value={form.riskCategory} options={translatedRiskCategories} onChange={(value) => update('riskCategory', value)} />
              <SelectField label={tr('Severidade')} value={form.severity} options={translatedSeverityOptions} onChange={(value) => update('severity', value)} />
              <SelectField label={tr('Probabilidade')} value={form.likelihood} options={translatedLikelihoodOptions} onChange={(value) => update('likelihood', value)} />
              <SelectField label={tr('Risco residual após a ação')} value={form.residualRiskLevel} options={translatedRiskOptions} onChange={(value) => update('residualRiskLevel', value)} />
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{tr('Nível de risco')}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge className={cn('border', riskClasses[riskLevel])}>{tr(riskLabels[riskLevel])}</Badge>
                  {riskLevel === 'critical' ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              <InputField label={tr('Ação recomendada')} value={form.recommendedAction} onChange={(value) => update('recommendedAction', value)} placeholder={tr('Ação definitiva ou melhoria')} />
              <InputField label={tr('Responsável')} value={form.responsibleName} onChange={(value) => update('responsibleName', value)} placeholder={tr('Nome ou função')} />
              <div className="space-y-2">
                <Label>{tr('Prazo')}</Label>
                <DatePicker
                  value={form.dueDate}
                  onChange={(value) => update('dueDate', value)}
                  disabled={createObservation.isPending}
                />
              </div>
            </div>
            <Separator />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CheckOption label={tr('Ação de acompanhamento requerida')} checked={enforcedFollowup} onChange={(value) => update('requiresFollowup', value)} disabled={enforcedFollowup && !form.requiresFollowup} />
              <CheckOption label={tr('Ordem de serviço requerida')} checked={form.workOrderRequired} onChange={(value) => update('workOrderRequired', value)} />
              <CheckOption label={tr('Stop Work exercido')} checked={form.stopWork} onChange={(value) => update('stopWork', value)} />
              <CheckOption label={tr('Potencial de fatalidade')} checked={form.fatalityPotential} onChange={(value) => update('fatalityPotential', value)} />
              <CheckOption label={tr('Requer investigação')} checked={form.requiresInvestigation} onChange={(value) => update('requiresInvestigation', value)} />
              <CheckOption label={tr('Requer CMMS')} checked={form.requiresCmms} onChange={(value) => update('requiresCmms', value)} />
              <CheckOption label={tr('Compartilhar em TBT')} checked={form.shareInTbt} onChange={(value) => update('shareInTbt', value)} />
              <CheckOption label={tr('Cartão indicado')} checked={form.nominatedGoodCard} onChange={(value) => update('nominatedGoodCard', value)} />
            </div>
            <TextAreaField label={tr('Aprendizado')} value={form.learning} onChange={(value) => update('learning', value)} placeholder={tr('Aprendizado compartilhável.')} rows={3} />
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <ReviewStep
            form={form}
            selectedShipName={selectedShip?.name || '-'}
            riskLevel={riskLevel}
            enforcedFollowup={enforcedFollowup}
          />
        )}

        <div className="sticky bottom-0 z-20 -mx-4 flex flex-col-reverse gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-center sm:justify-end lg:-mx-6 lg:px-6">
          <Button type="button" variant="outline" onClick={resetForm}>
            {tr('Limpar')}
          </Button>
          {step > 0 && (
            <Button type="button" variant="outline" onClick={goBack} disabled={createObservation.isPending}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              {tr('Voltar')}
            </Button>
          )}
          {isLastStep ? (
            <Button type="submit" disabled={createObservation.isPending || !canCreate || !shipId}>
              {createObservation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {tr('Salvar observação')}
            </Button>
          ) : (
            <Button type="button" onClick={goNext} disabled={createObservation.isPending}>
              {tr('Próximo')}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function BcoSection({ form, updateChecklist }: { form: FormState; updateChecklist: (group: 'behaviourChecks' | 'conditionChecks' | 'equipmentChecks', key: string, status: TemplateChecklistStatus) => void }) {
  const tr = useSafetyObservationText();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{tr('Comportamento / Condição / Equipamento')}</CardTitle>
        <CardDescription>{tr('Marque Seguro ou Inseguro para cada item do cartão azul.')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-3">
        <ChecklistMatrix title={tr('Comportamento')} options={translateOptions(behaviourItems, tr)} values={form.behaviourChecks} onChange={(key, status) => updateChecklist('behaviourChecks', key, status)} />
        <ChecklistMatrix title={tr('Condição')} options={translateOptions(conditionItems, tr)} values={form.conditionChecks} onChange={(key, status) => updateChecklist('conditionChecks', key, status)} />
        <ChecklistMatrix title={tr('Equipamento')} options={translateOptions(equipmentItems, tr)} values={form.equipmentChecks} onChange={(key, status) => updateChecklist('equipmentChecks', key, status)} />
      </CardContent>
    </Card>
  );
}

function PsfSection({
  form,
  updateChecklist,
  toggleFlag,
  update,
}: {
  form: FormState;
  updateChecklist: (group: 'processSafetySafeguards' | 'processSafetyFundamentals', key: string, status: TemplateChecklistStatus) => void;
  toggleFlag: (group: 'weepsSeepsTypes' | 'leakLocations' | 'mainCauses', key: string) => void;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const tr = useSafetyObservationText();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr('Vazamentos e exsudações (W&S)')}</CardTitle>
          <CardDescription>{tr('Tipo, volume, local do vazamento e causa principal do cartão laranja.')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FlagGrid title={tr('Tipo e volume')} options={translateOptions(weepsSeepsTypes, tr)} values={form.weepsSeepsTypes} onToggle={(key) => toggleFlag('weepsSeepsTypes', key)} />
          <div className="grid gap-4 md:grid-cols-4">
            <InputField label="Medidor LEL (%)" value={form.meterLel} onChange={(value) => update('meterLel', value)} placeholder="%" />
            <InputField label="Medidor H2S (ppm)" value={form.meterH2s} onChange={(value) => update('meterH2s', value)} placeholder="ppm" />
            <InputField label={tr('Distância do vazamento (m)')} value={form.distanceFromLeak} onChange={(value) => update('distanceFromLeak', value)} placeholder="m" />
            <InputField label={tr('Gotas por minuto')} value={form.dropsPerMin} onChange={(value) => update('dropsPerMin', value)} placeholder={tr('gotas/min')} />
          </div>
          <FlagGrid title={tr('Local do vazamento')} options={translateOptions(leakLocations, tr)} values={form.leakLocations} onToggle={(key) => toggleFlag('leakLocations', key)} columns="lg:grid-cols-3" />
          <FlagGrid title={tr('Causa principal')} options={translateOptions(mainCauses, tr)} values={form.mainCauses} onToggle={(key) => toggleFlag('mainCauses', key)} columns="lg:grid-cols-3" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{tr('Segurança de Processo')}</CardTitle>
          <CardDescription>{tr('Salvaguardas e fundamentos de segurança de processo com Seguro / Inseguro.')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          <ChecklistMatrix title={tr('Principais salvaguardas de segurança de processo')} options={translateOptions(processSafetySafeguards, tr)} values={form.processSafetySafeguards} onChange={(key, status) => updateChecklist('processSafetySafeguards', key, status)} />
          <ChecklistMatrix title={tr('Fundamentos de segurança de processo (PSF)')} options={translateOptions(processSafetyFundamentals, tr)} values={form.processSafetyFundamentals} onChange={(key, status) => updateChecklist('processSafetyFundamentals', key, status)} />
        </CardContent>
      </Card>
    </div>
  );
}

function selectedLabels(values: TemplateFlags, options: ReadonlyArray<Option>) {
  return options.filter(([key]) => values[key]).map(([, label]) => label);
}

function WizardProgress({ step }: { step: number }) {
  const tr = useSafetyObservationText();
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {WIZARD_STEPS.map((item, index) => {
            const active = index === step;
            const complete = index < step;
            return (
              <div key={item.key} className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                    active && 'border-primary bg-primary text-primary-foreground',
                    complete && 'border-emerald-500 bg-emerald-500 text-white',
                    !active && !complete && 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <div className="min-w-0">
                  <p className={cn('truncate text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
                    {tr(item.title)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{tr(item.description)}</p>
                </div>
                {index < WIZARD_STEPS.length - 1 && (
                  <div className="hidden h-px flex-1 bg-border lg:block" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewStep({
  form,
  selectedShipName,
  riskLevel,
  enforcedFollowup,
}: {
  form: FormState;
  selectedShipName: string;
  riskLevel: SafetyRiskLevel;
  enforcedFollowup: boolean;
}) {
  const tr = useSafetyObservationText();
  const departmentsText = selectedLabels(form.departmentFlags, departments).map(tr).join(', ') || '-';
  const locationsText = selectedLabels(form.locationOptions, locationOptions).map(tr).join(', ') || '-';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{tr('Revisão antes do envio')}</CardTitle>
        <CardDescription>{tr('Confira os principais dados. Use Voltar para ajustar qualquer etapa.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryItem label={tr('Modelo')} value={form.cardTemplate === 'bco' ? tr('Comportamento / Condição') : tr('Segurança de Processo')} />
          <SummaryItem label={tr('Navio')} value={selectedShipName} />
          <SummaryItem label={tr('Localização')} value={form.area || '-'} />
          <SummaryItem label={tr('Data')} value={form.observedAt ? new Date(form.observedAt).toLocaleString(undefined) : '-'} />
          <SummaryItem label={tr('Departamento')} value={departmentsText} />
          <SummaryItem label={tr('Onde aconteceu')} value={locationsText} />
          <SummaryItem label={tr('Tipo')} value={tr(optionLabel(form.observationType, observationTypes))} />
          <SummaryItem label={tr('Categoria')} value={form.cardTemplate === 'psf' ? tr('Segurança de processo') : tr(optionLabel(form.riskCategory, riskCategories))} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <SummaryText label={tr('Observação')} value={form.description} />
          <SummaryText label={tr('Percepção de risco')} value={form.riskPerception} />
          <SummaryText label={tr('Ação / discussão / intervenção')} value={form.immediateAction} />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3">
          <Badge className={cn('border', riskClasses[riskLevel])}>{tr('Risco')} {tr(riskLabels[riskLevel])}</Badge>
          <Badge variant="outline">{tr('Severidade')}: {tr(optionLabel(form.severity, severityOptions))}</Badge>
          <Badge variant="outline">{tr('Probabilidade')}: {tr(optionLabel(form.likelihood, likelihoodOptions))}</Badge>
          {enforcedFollowup && <Badge variant="outline" className="border-orange-200 text-orange-700">{tr('Acompanhamento requerido')}</Badge>}
          {form.stopWork && <Badge variant="outline">{tr('Stop Work exercido')}</Badge>}
          {form.workOrderRequired && <Badge variant="outline">{tr('Ordem de serviço requerida')}</Badge>}
          {form.requiresInvestigation && <Badge variant="outline">{tr('Investigação requerida')}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

function optionLabel<T extends string>(value: T, options: ReadonlyArray<readonly [T, string]>) {
  return options.find(([optionValue]) => optionValue === value)?.[1] ?? value;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-medium">{value || '-'}</p>
    </div>
  );
}

function SummaryText({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 min-h-16 whitespace-pre-wrap text-sm">{value || '-'}</p>
    </div>
  );
}

function TemplateButton({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded-md border p-4 text-left transition-colors', active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{title}</p>
        {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}

function ReadOnlyField({ icon: Icon, label, value }: { icon: typeof ShipIcon; label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">{value}</div>
    </div>
  );
}

function FlagGrid({ title, options, values, onToggle, columns = 'lg:grid-cols-2' }: { title: string; options: ReadonlyArray<Option>; values: TemplateFlags; onToggle: (key: string) => void; columns?: string }) {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label>{title}</Label>
      <div className={cn('grid gap-2 sm:grid-cols-2', columns)}>
        {options.map(([key, label]) => (
          <label key={key} className="flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Checkbox checked={values[key]} onCheckedChange={() => onToggle(key)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ChecklistMatrix({ title, options, values, onChange }: { title: string; options: ReadonlyArray<Option>; values: TemplateChecklist; onChange: (key: string, status: TemplateChecklistStatus) => void }) {
  const tr = useSafetyObservationText();
  return (
    <div className="rounded-md border">
      <div className="grid grid-cols-[1fr_72px_72px] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span className="text-center">{tr('Seguro')}</span>
        <span className="text-center">{tr('Inseguro')}</span>
      </div>
      <div className="divide-y">
        {options.map(([key, label]) => (
          <div key={key} className="grid grid-cols-[1fr_72px_72px] items-center gap-2 px-3 py-2 text-sm">
            <span className="min-w-0">{label}</span>
            <div className="flex justify-center">
              <Checkbox checked={values[key] === 'safe'} onCheckedChange={() => onChange(key, 'safe')} />
            </div>
            <div className="flex justify-center">
              <Checkbox checked={values[key] === 'unsafe'} onCheckedChange={() => onChange(key, 'unsafe')} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<readonly [T, string]>; onChange: (value: T) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger className="w-full bg-background"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function CheckOption({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn('flex min-h-11 items-center gap-3 rounded-md border p-3 text-sm', disabled && 'opacity-70')}>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} />
      <span>{label}</span>
    </label>
  );
}

function TextAreaField({ label, value, onChange, placeholder, rows = 5 }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; rows?: number }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} />
    </div>
  );
}
