import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
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

type Option = readonly [string, string];

const departments = [
  ['production', 'Producao'],
  ['cargo', 'Carga'],
  ['maintenance', 'Manutencao'],
  ['safety', 'Seguranca'],
  ['other', 'Outro'],
  ['subcontractor_visitor', 'Subcontratado / visitante'],
] as const;

const locationOptions = [
  ['turret', 'Turret'],
  ['cargo_main_deck', 'Convés principal de carga'],
  ['cargo_tanks', 'Tanques de carga'],
  ['engine_room', 'Casa de maquinas'],
  ['topsides', 'Topsides'],
  ['pump_room', 'Sala de bombas'],
  ['other', 'Outro'],
] as const;

const behaviourItems = [
  ['appropriate_ppe_head_face_respiratory', 'EPI adequado (cabeca, face, respiratorio)'],
  ['appropriate_ppe_arms_hands_body', 'EPI adequado (bracos, maos, corpo)'],
  ['appropriate_ppe_legs_feet', 'EPI adequado (pernas e pes)'],
  ['tools_equipment_correctly_used', 'Ferramentas / equipamentos usados corretamente'],
  ['manual_handling', 'Manuseio manual'],
  ['procedures_known_understood', 'Procedimentos conhecidos e compreendidos'],
  ['procedures_followed', 'Procedimentos seguidos'],
  ['work_preparation_ptw_tra', 'Preparacao do trabalho (PTW / TRA)'],
  ['intervention_stop_work_make_safe', 'Intervencao (autoridade de parar o trabalho, tornar seguro)'],
  ['effective_communication_toolbox', 'Comunicacao efetiva / DDS'],
  ['other', 'Outro'],
] as const;

const conditionItems = [
  ['simops', 'SIMOPS'],
  ['change_in_work_environment', 'Mudanca no ambiente de trabalho'],
  ['access_and_egress', 'Acesso e saida'],
  ['housekeeping_waste_management', 'Organizacao / gestao de residuos'],
  ['slips_and_trips', 'Escorregoes e tropeços'],
  ['work_at_height', 'Trabalho em altura'],
  ['dropped_objects', 'Objetos caidos'],
  ['cable_management', 'Gestao de cabos'],
  ['ventilation', 'Ventilacao'],
  ['noise', 'Ruido'],
  ['lighting', 'Iluminacao'],
  ['chemical_and_substances', 'Produtos quimicos e substancias'],
  ['barrier_signs_notices', 'Barreiras, sinalizacoes e avisos'],
  ['other', 'Outro'],
] as const;

const equipmentItems = [
  ['electrical', 'Eletrico'],
  ['scaffolding', 'Andaimes'],
  ['lifting_and_rigging', 'Içamento e rigging'],
  ['welding_and_cutting', 'Solda e corte'],
  ['power_and_hand_held_tools', 'Ferramentas eletricas e manuais'],
  ['tools_equipment_good_condition', 'Ferramentas / equipamentos em boas condicoes'],
  ['isolations_in_place', 'Isolamentos aplicados'],
  ['other', 'Outro'],
] as const;

const operatingModes = [
  ['running', 'Operacao'],
  ['maintenance', 'Manutencao'],
  ['standby', 'Standby'],
] as const;

const weepsSeepsTypes = [
  ['hc_gas', 'Gas HC'],
  ['non_hc_gas', 'Gas nao HC'],
  ['steam', 'Vapor'],
  ['hc_oil', 'Oleo HC'],
  ['lube_oil', 'Oleo lubrificante'],
  ['chemicals', 'Quimicos'],
  ['prod_h2o', 'Agua produzida'],
  ['h2o', 'Agua'],
  ['other', 'Outro'],
] as const;

const leakLocations = [
  ['instrument_fitting', 'Conexao de instrumento'],
  ['flange', 'Flange'],
  ['weld', 'Solda'],
  ['actuator_seal_or_body', 'Selo ou corpo do atuador'],
  ['heat_exchanger', 'Trocador de calor'],
  ['flexible_hoses', 'Mangueiras flexiveis'],
  ['pipework_pipeline_main_body', 'Corpo principal de tubulacao / pipeline'],
  ['welded_connection', 'Conexao soldada'],
  ['valve_seal', 'Selo de valvula'],
  ['valve_body', 'Corpo de valvula'],
  ['pump_seal', 'Selo de bomba (incl. selo de eixo)'],
  ['pump_body', 'Corpo de bomba'],
  ['process_instrument', 'Instrumento de processo'],
  ['tubing_threaded_connection', 'Tubing / conexao roscada'],
  ['other_equipment', 'Outro equipamento'],
] as const;

const mainCauses = [
  ['vibration', 'Vibracao'],
  ['corrosion_under_insulation', 'Corrosao sob isolamento'],
  ['other_external_corrosion', 'Outra corrosao externa'],
  ['internal_corrosion', 'Corrosao interna'],
  ['erosion', 'Erosao'],
  ['mechanical_impact', 'Impacto mecanico'],
  ['mechanical_stress', 'Tensao mecanica'],
  ['over_pressurization', 'Sobrepressurizacao'],
  ['material_failure', 'Falha de material'],
  ['equipment_catastrophic_failure', 'Falha catastrofica de equipamento'],
  ['mal_operation', 'Operacao inadequada'],
  ['wear_and_tear', 'Desgaste'],
  ['extreme_weather', 'Clima extremo'],
  ['not_determined', 'Nao determinado'],
] as const;

const processSafetySafeguards = [
  ['safe_operating_limits', 'Limites operacionais seguros'],
  ['safety_locks_interlock', 'Travas de seguranca / intertravamento'],
  ['procedures_available', 'Procedimentos disponiveis'],
  ['drawings_up_to_date', 'Desenhos atualizados (P&ID, PFD, diagramas)'],
  ['data_up_to_date', 'Dados atualizados (ajustes, registros, informacoes)'],
  ['temporary_hoses_cable_management', 'Mangueiras temporarias / gestao de cabos'],
] as const;

const processSafetyFundamentals = [
  ['two_barriers_hydrocarbon_chemical_drains_vents', 'Sempre usar duas barreiras para drenos e vents de hidrocarbonetos e quimicos'],
  ['remain_in_attendance_critical_transfer_draining', 'Permanecer presente durante transferencia critica ou drenagem'],
  ['interim_mitigating_measures_failure_safe_critical_equipment', 'Aplicar medidas mitigadoras interinas em falha de equipamento critico de seguranca'],
  ['procedures_sign_off_high_risk_activities', 'Em atividades de alto risco, seguir procedimentos e assinar cada etapa'],
  ['walk_the_line_verify_validate', 'Percorrer a linha, verificar e validar qualquer mudanca de alinhamento'],
  ['moc_for_change', 'Sempre usar MOC ao fazer uma mudanca'],
  ['verify_tightness_after_maintenance', 'Verificar estanqueidade completa apos manutencao'],
  ['check_equipment_pressure_free_drained', 'Confirmar equipamento sem pressao, drenado e com isolamento seguro antes de iniciar'],
  ['moc_backflow_protection', 'Realizar MOC e instalar protecao contra refluxo ao conectar utilidades ao processo'],
  ['respond_to_critical_alarms', 'Responder a alarmes criticos'],
] as const;

const observationTypes = [
  ['unsafe_condition', 'Condicao insegura'],
  ['unsafe_act', 'Ato inseguro'],
  ['safe_behavior', 'Comportamento seguro'],
  ['good_practice', 'Boa pratica'],
  ['near_miss', 'Quase acidente'],
  ['process_safety', 'Seguranca de processo'],
] as const;

const riskCategories = [
  ['line_of_fire', 'Linha de fogo'],
  ['dropped_object', 'Objeto queda / dropped object'],
  ['fall_from_height', 'Queda de altura'],
  ['lifting', 'Movimentacao de carga'],
  ['electrical', 'Eletricidade'],
  ['pressure', 'Pressao / linhas pressurizadas'],
  ['chemical', 'Produtos quimicos'],
  ['fire_explosion', 'Incendio / explosao'],
  ['loto', 'LOTO / isolamento'],
  ['process_safety', 'Seguranca de processo'],
  ['housekeeping', 'Housekeeping'],
] as const;

const severityOptions: Array<[SafetySeverity, string]> = [
  ['low', 'Baixa'],
  ['medium', 'Media'],
  ['high', 'Alta'],
  ['critical', 'Critica'],
];

const likelihoodOptions: Array<[SafetyLikelihood, string]> = [
  ['unlikely', 'Improvavel'],
  ['possible', 'Possivel'],
  ['likely', 'Provavel'],
  ['very_likely', 'Muito provavel'],
];

const riskLabels: Record<SafetyRiskLevel, string> = {
  low: 'Baixo',
  medium: 'Medio',
  high: 'Alto',
  critical: 'Critico',
};

const riskClasses: Record<SafetyRiskLevel, string> = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  medium: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
  high: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100',
  critical: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
};

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

  const shipId = selectedShipId || ships[0]?.id || '';
  const selectedShip = ships.find((ship) => ship.id === shipId);
  const canCreate = access.can('obs_cards', 'safety_observation', 'create');
  const riskLevel = useMemo(() => calculateRiskLevel(form.severity, form.likelihood), [form.severity, form.likelihood]);
  const enforcedFollowup = form.requiresFollowup || form.stopWork || form.fatalityPotential || ['high', 'critical'].includes(riskLevel);

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
      toast({ title: 'Sessao invalida', description: 'Faca login novamente.', variant: 'destructive' });
      return;
    }
    if (!shipId) {
      toast({ title: 'Navio obrigatorio', description: 'Selecione um navio no topo do sistema.', variant: 'destructive' });
      return;
    }
    if (!canCreate) {
      toast({ title: 'Sem permissao', description: 'Seu perfil nao pode criar observacoes de seguranca.', variant: 'destructive' });
      return;
    }
    if (!form.area.trim() || !form.description.trim()) {
      toast({ title: 'Campos obrigatorios', description: 'Preencha area/local e descricao da observacao.', variant: 'destructive' });
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
      potential_consequence: form.potentialConsequence.trim() || (form.cardTemplate === 'psf' ? 'Perda de contencao em seguranca de processo' : 'Consequencia nao especificada no cartao de observacao'),
      severity: form.severity,
      likelihood: form.likelihood,
      risk_level: riskLevel,
      residual_risk_level: form.residualRiskLevel,
      stop_work: form.stopWork,
      fatality_potential: form.fatalityPotential,
      description: form.description.trim(),
      risk_perception: form.riskPerception.trim() || form.potentialConsequence.trim() || 'Nao especificado',
      immediate_action: form.immediateAction.trim() || 'Nao especificado',
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

    toast({ title: 'Observacao registrada', description: 'O cartao foi salvo com todos os campos do modelo selecionado.' });
    setForm({ ...initialForm, observerName: profile?.full_name || '', observedAt: localDateTimeValue() });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={ClipboardList}
        title="Formulario de Observacao de Seguranca"
        subtitle="Modelos Comportamento / Condicao e Fundamentos de Seguranca de Processo."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <ShipIcon className="h-3.5 w-3.5" />
            {shipsLoading ? 'Carregando navio' : selectedShip?.name || 'Nenhum navio disponivel'}
          </Badge>
          <Badge className={cn('border gap-1', riskClasses[riskLevel])}>
            <ShieldAlert className="h-3.5 w-3.5" />
            Risco {riskLabels[riskLevel]}
          </Badge>
          {enforcedFollowup && (
            <Badge variant="outline" className="border-orange-200 text-orange-700 gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Acompanhamento requerido
            </Badge>
          )}
        </div>
        <Button type="button" variant="outline" onClick={() => navigate('/obs-cards')}>
          Cartao de Observacao com IA
        </Button>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Modelo do cartao</CardTitle>
            <CardDescription>Selecione o formulario fisico correspondente.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <TemplateButton
              active={form.cardTemplate === 'bco'}
              title="Comportamento / Condicao"
              description="Cartao azul: comportamento, condicao e equipamento."
              onClick={() => update('cardTemplate', 'bco')}
            />
            <TemplateButton
              active={form.cardTemplate === 'psf'}
              title="Seguranca de Processo"
              description="Cartao laranja: W&S, causas, salvaguardas e PSF."
              onClick={() => update('cardTemplate', 'psf')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Identificacao e local</CardTitle>
            <CardDescription>Navio da conta, area cadastrada do navio e campos do cabecalho do cartao.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <ReadOnlyField icon={ShipIcon} label="Navio da conta" value={selectedShip?.name || 'Selecione um navio no topo'} />
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                Localizacao / outro local
              </Label>
              <AreaCombobox shipId={shipId} value={form.area} onChange={(value) => update('area', value)} placeholder="Selecione ou crie a area" disabled={!shipId || createObservation.isPending} />
            </div>
            <InputField label="Nome" value={form.observerName} onChange={(value) => update('observerName', value)} placeholder="Nome do observador" />
            <div className="space-y-2">
              <Label>Data</Label>
              <DateTimePicker
                value={form.observedAt}
                onChange={(value) => update('observedAt', value)}
                disabled={createObservation.isPending}
              />
            </div>
            <FlagGrid title="Departamento" options={departments} values={form.departmentFlags} onToggle={(key) => toggleFlag('departmentFlags', key)} />
            <FlagGrid title="Onde aconteceu?" options={locationOptions} values={form.locationOptions} onToggle={(key) => toggleFlag('locationOptions', key)} />
            {form.cardTemplate === 'psf' && (
              <>
                <SelectField label="Modo operacional" value={form.operatingMode} options={operatingModes} onChange={(value) => update('operatingMode', value)} />
                <CheckOption label="Visita do gerente ao local" checked={form.managerSiteVisit} onChange={(value) => update('managerSiteVisit', value)} />
              </>
            )}
          </CardContent>
        </Card>

        {form.cardTemplate === 'bco' ? (
          <BcoSection form={form} updateChecklist={updateChecklist} />
        ) : (
          <PsfSection form={form} updateChecklist={updateChecklist} toggleFlag={toggleFlag} update={update} />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Descricao, acao e risco</CardTitle>
            <CardDescription>Campos narrativos e controle de acompanhamento / ordem de servico.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <TextAreaField label="Descreva sua observacao" value={form.description} onChange={(value) => update('description', value)} placeholder="Descreva objetivamente o que foi observado." />
              <TextAreaField label="Percepcao de risco" value={form.riskPerception} onChange={(value) => update('riskPerception', value)} placeholder="Qual era o risco percebido?" />
              <TextAreaField label="Descreva sua acao / discussao / intervencao" value={form.immediateAction} onChange={(value) => update('immediateAction', value)} placeholder="Descreva a acao, conversa ou intervencao." />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Consequencia potencial" value={form.potentialConsequence} onChange={(value) => update('potentialConsequence', value)} placeholder="Consequencia potencial" />
              <InputField label="Pessoa informada" value={form.personNotified} onChange={(value) => update('personNotified', value)} placeholder="Supervisor, lideranca, OIM..." />
              <SelectField label="Tipo de observacao" value={form.observationType} options={observationTypes} onChange={(value) => update('observationType', value)} />
              <SelectField label="Categoria de risco" value={form.riskCategory} options={riskCategories} onChange={(value) => update('riskCategory', value)} />
              <SelectField label="Severidade" value={form.severity} options={severityOptions} onChange={(value) => update('severity', value)} />
              <SelectField label="Probabilidade" value={form.likelihood} options={likelihoodOptions} onChange={(value) => update('likelihood', value)} />
              <SelectField label="Risco residual apos a acao" value={form.residualRiskLevel} options={Object.entries(riskLabels) as Array<[SafetyRiskLevel, string]>} onChange={(value) => update('residualRiskLevel', value)} />
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Nivel de risco</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge className={cn('border', riskClasses[riskLevel])}>{riskLabels[riskLevel]}</Badge>
                  {riskLevel === 'critical' ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              <InputField label="Acao recomendada" value={form.recommendedAction} onChange={(value) => update('recommendedAction', value)} placeholder="Acao definitiva ou melhoria" />
              <InputField label="Responsavel" value={form.responsibleName} onChange={(value) => update('responsibleName', value)} placeholder="Nome ou funcao" />
              <div className="space-y-2">
                <Label>Prazo</Label>
                <DatePicker
                  value={form.dueDate}
                  onChange={(value) => update('dueDate', value)}
                  disabled={createObservation.isPending}
                />
              </div>
            </div>
            <Separator />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CheckOption label="Acao de acompanhamento requerida" checked={enforcedFollowup} onChange={(value) => update('requiresFollowup', value)} disabled={enforcedFollowup && !form.requiresFollowup} />
              <CheckOption label="Ordem de servico requerida" checked={form.workOrderRequired} onChange={(value) => update('workOrderRequired', value)} />
              <CheckOption label="Stop Work exercido" checked={form.stopWork} onChange={(value) => update('stopWork', value)} />
              <CheckOption label="Potencial de fatalidade" checked={form.fatalityPotential} onChange={(value) => update('fatalityPotential', value)} />
              <CheckOption label="Requer investigacao" checked={form.requiresInvestigation} onChange={(value) => update('requiresInvestigation', value)} />
              <CheckOption label="Requer CMMS" checked={form.requiresCmms} onChange={(value) => update('requiresCmms', value)} />
              <CheckOption label="Compartilhar em TBT" checked={form.shareInTbt} onChange={(value) => update('shareInTbt', value)} />
              <CheckOption label="Cartao indicado" checked={form.nominatedGoodCard} onChange={(value) => update('nominatedGoodCard', value)} />
            </div>
            <TextAreaField label="Aprendizado" value={form.learning} onChange={(value) => update('learning', value)} placeholder="Aprendizado compartilhavel." rows={3} />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setForm({ ...initialForm, observerName: profile?.full_name || '', observedAt: localDateTimeValue() })}>
            Limpar
          </Button>
          <Button type="submit" disabled={createObservation.isPending || !canCreate || !shipId}>
            {createObservation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar observacao
          </Button>
        </div>
      </form>
    </div>
  );
}

function BcoSection({ form, updateChecklist }: { form: FormState; updateChecklist: (group: 'behaviourChecks' | 'conditionChecks' | 'equipmentChecks', key: string, status: TemplateChecklistStatus) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Comportamento / Condicao / Equipamento</CardTitle>
        <CardDescription>Marque Seguro ou Inseguro para cada item do cartao azul.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-3">
        <ChecklistMatrix title="Comportamento" options={behaviourItems} values={form.behaviourChecks} onChange={(key, status) => updateChecklist('behaviourChecks', key, status)} />
        <ChecklistMatrix title="Condicao" options={conditionItems} values={form.conditionChecks} onChange={(key, status) => updateChecklist('conditionChecks', key, status)} />
        <ChecklistMatrix title="Equipamento" options={equipmentItems} values={form.equipmentChecks} onChange={(key, status) => updateChecklist('equipmentChecks', key, status)} />
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
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vazamentos e exsudacoes (W&S)</CardTitle>
          <CardDescription>Tipo, volume, local do vazamento e causa principal do cartao laranja.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FlagGrid title="Tipo e volume" options={weepsSeepsTypes} values={form.weepsSeepsTypes} onToggle={(key) => toggleFlag('weepsSeepsTypes', key)} />
          <div className="grid gap-4 md:grid-cols-4">
            <InputField label="Medidor LEL (%)" value={form.meterLel} onChange={(value) => update('meterLel', value)} placeholder="%" />
            <InputField label="Medidor H2S (ppm)" value={form.meterH2s} onChange={(value) => update('meterH2s', value)} placeholder="ppm" />
            <InputField label="Distancia do vazamento (m)" value={form.distanceFromLeak} onChange={(value) => update('distanceFromLeak', value)} placeholder="m" />
            <InputField label="Gotas por minuto" value={form.dropsPerMin} onChange={(value) => update('dropsPerMin', value)} placeholder="gotas/min" />
          </div>
          <FlagGrid title="Local do vazamento" options={leakLocations} values={form.leakLocations} onToggle={(key) => toggleFlag('leakLocations', key)} columns="lg:grid-cols-3" />
          <FlagGrid title="Causa principal" options={mainCauses} values={form.mainCauses} onToggle={(key) => toggleFlag('mainCauses', key)} columns="lg:grid-cols-3" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seguranca de Processo</CardTitle>
          <CardDescription>Salvaguardas e fundamentos de seguranca de processo com Seguro / Inseguro.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          <ChecklistMatrix title="Principais salvaguardas de seguranca de processo" options={processSafetySafeguards} values={form.processSafetySafeguards} onChange={(key, status) => updateChecklist('processSafetySafeguards', key, status)} />
          <ChecklistMatrix title="Fundamentos de seguranca de processo (PSF)" options={processSafetyFundamentals} values={form.processSafetyFundamentals} onChange={(key, status) => updateChecklist('processSafetyFundamentals', key, status)} />
        </CardContent>
      </Card>
    </div>
  );
}

function selectedLabels(values: TemplateFlags, options: ReadonlyArray<Option>) {
  return options.filter(([key]) => values[key]).map(([, label]) => label);
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
  return (
    <div className="rounded-md border">
      <div className="grid grid-cols-[1fr_72px_72px] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span className="text-center">Seguro</span>
        <span className="text-center">Inseguro</span>
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
