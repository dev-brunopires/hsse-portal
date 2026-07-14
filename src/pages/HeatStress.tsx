import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cloud,
  FileDown,
  FileText,
  Flame,
  Loader2,
  MapPin,
  Plus,
  Save,
  Ship as ShipIcon,
  Sun,
  Thermometer,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useShips } from '@/hooks/useShips';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { DatePicker, DateTimePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { AreaCombobox } from '@/components/ships/AreaCombobox';
import { formatDateTime } from '@/utils/dateFormat';
import { downloadHeatStressPDF, type HeatStressPDFData } from '@/utils/generateHeatStressPDF';
import { cn } from '@/lib/utils';

type EnvType = 'no_solar' | 'with_solar';
type NhoStatus = 'normal' | 'action' | 'above_limit';
type YesNo = 'yes' | 'no';

interface Reading {
  tbn: string;
  tg: string;
  tbs: string;
}

interface MetabolicStage {
  description: string;
  activity: string;
  duration: string;
  rate: string;
}

interface HeatStressDetails {
  evaluation_at?: string;
  expiration_date?: string;
  ptw_number?: string;
  main_activity?: string;
  evaluator_name?: string;
  additional_info?: string;
  confined_or_artificial?: YesNo;
  heat_index?: {
    temperature_c?: number | null;
    relative_humidity?: number | null;
    value?: number | null;
    potential_risk?: string | null;
  };
  monitor?: {
    manufacturer?: string;
    model?: string;
    serial_number?: string;
    calibration_date?: string;
  };
  variation_check?: {
    tbn: boolean;
    tg: boolean;
    tbs: boolean | null;
  };
  metabolic_stages?: Array<{
    description: string;
    activity: string;
    duration: number;
    rate: number;
  }>;
  clothing?: {
    type: string;
    increment: number;
  };
  corrected_ibutg?: number;
  action_level?: number;
  exposure_limit?: number;
  ceiling_value?: number | null;
  conclusion?: string;
  control_measures?: string;
}

interface Measurement {
  id: string;
  ship_id: string;
  sector: string;
  environment_type: EnvType;
  tbn: number;
  tg: number;
  tbs: number | null;
  metabolic_rate: number;
  ibutg: number;
  nho_status: NhoStatus;
  notes: string | null;
  measured_at: string;
  created_by: string | null;
  readings?: Array<{ tbn: number; tg: number; tbs: number | null }> | null;
  details?: HeatStressDetails | null;
}

interface SupabaseQueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface SupabaseTableQuery<T> extends PromiseLike<SupabaseQueryResult<T>> {
  select(columns?: string): SupabaseTableQuery<T>;
  eq(column: string, value: string): SupabaseTableQuery<T>;
  order(column: string, options?: { ascending?: boolean }): SupabaseTableQuery<T>;
  limit(count: number): SupabaseTableQuery<T>;
  insert(value: unknown): SupabaseTableQuery<T>;
  delete(): SupabaseTableQuery<T>;
  single(): SupabaseTableQuery<T>;
}

type HeatStressTableClient = {
  from(table: 'heat_stress_measurements'): SupabaseTableQuery<Measurement[] | Measurement>;
};

const heatStressTable = supabase as unknown as HeatStressTableClient;

const WIZARD_STEPS = [
  { key: 'identification', titleKey: 'wizard.identification', descriptionKey: 'wizard.identificationDesc' },
  { key: 'environment', titleKey: 'wizard.environment', descriptionKey: 'wizard.environmentDesc' },
  { key: 'readings', titleKey: 'wizard.readings', descriptionKey: 'wizard.readingsDesc' },
  { key: 'metabolism', titleKey: 'wizard.metabolism', descriptionKey: 'wizard.metabolismDesc' },
  { key: 'review', titleKey: 'wizard.review', descriptionKey: 'wizard.reviewDesc' },
] as const;

const METABOLIC_ACTIVITIES = [
  ['Sentado em repouso', 115],
  ['Em pé, agachado ou ajoelhado em repouso', 126],
  ['Sentado trabalhando com as mãos', 171],
  ['Abertura de válvulas de fácil acesso', 180],
  ['Inspeção visual de equipamentos', 215],
  ['Almoxarifado', 216],
  ['Manutenção elétrica e instrumentação', 243],
  ['Em pé, agachado ou ajoelhado trabalhando com um braço', 261],
  ['Em pé, agachado ou ajoelhado trabalhando com dois braços', 279],
  ['Descendo escada com ou sem carga', 279],
  ['Manutenção mecânica', 279],
  ['Operação de carga', 279],
  ['Operação e manutenção na sala de máquinas', 279],
  ['Sentado trabalhando com os braços', 288],
  ['Em pé, agachado ou ajoelhado trabalhando com mãos e/ou braços', 315],
  ['Andando no plano sem carga ou com carga até 10 kg', 315],
  ['Trabalhando com carrinho de mão', 315],
  ['Subindo escada sem ou com carga', 333],
  ['Montagem de andaimes', 333],
  ['Limpeza de tanque', 349],
  ['Trabalho vigoroso com o corpo', 349],
  ['Andando no plano com carga até 30 kg', 450],
  ['Trabalho em local de difícil acesso', 468],
  ['Manobra de válvulas', 468],
  ['Trabalho vigoroso pesado com o corpo', 630],
  ['Subindo escada com carga até 20 kg por mais de 2 horas', 738],
] as const;

const CLOTHING_OPTIONS = [
  ['Uniforme de trabalho (calça e camisa de manga comprida)', 0],
  ['Macacão de tecido', 0],
  ['Vestimenta ou macacão forrado (tecido duplo)', 3],
  ['Macacão de polipropileno SMS', 0.5],
  ['Macacão de poliolefina (Tyvek)', 2],
  ['Macacão de uso limitado impermeável ao vapor', 11],
  ['Avental longo de manga comprida impermeável ao vapor', 4],
  ['Macacão impermeável ao vapor', 10],
  ['Macacão impermeável ao vapor sobreposto à roupa de trabalho', 12],
] as const;

function localDateTimeValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function localDateValue(daysFromNow = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function numberOrNull(value: string) {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function checkVariation(values: Array<number | null>, required: boolean) {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!required && valid.length === 0) return null;
  if (valid.length < 2) return true;
  return Math.max(...valid) - Math.min(...valid) <= 0.4;
}

function calcHeatIndex(tempC: number | null, humidity: number | null) {
  if (tempC == null || humidity == null) return null;
  const tempF = tempC * 9 / 5 + 32;
  const rh = humidity;
  const hiF = -42.379 + 2.04901523 * tempF + 10.14333127 * rh - 0.22475541 * tempF * rh
    - 0.00683783 * tempF * tempF - 0.05481717 * rh * rh
    + 0.00122874 * tempF * tempF * rh + 0.00085282 * tempF * rh * rh
    - 0.00000199 * tempF * tempF * rh * rh;
  return Number(((hiF - 32) * 5 / 9).toFixed(1));
}

function heatRiskLabel(heatIndex: number | null) {
  if (heatIndex == null) return null;
  if (heatIndex < 32) return 'Risco I';
  if (heatIndex < 41) return 'Risco II';
  return 'Risco III';
}

function interpolate(points: Array<[number, number]>, metabolic: number) {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (metabolic <= sorted[0][0]) return sorted[0][1];
  if (metabolic >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
  for (let index = 1; index < sorted.length; index += 1) {
    const [x2, y2] = sorted[index];
    const [x1, y1] = sorted[index - 1];
    if (metabolic <= x2) {
      const ratio = (metabolic - x1) / (x2 - x1);
      return Number((y1 + (y2 - y1) * ratio).toFixed(1));
    }
  }
  return sorted[sorted.length - 1][1];
}

function actionLevelFor(metabolic: number) {
  return interpolate([[100, 31.7], [180, 28.1], [226, 26.7], [313, 24.7], [414, 23.0], [503, 21.8], [738, 19.0]], metabolic);
}

function exposureLimitFor(metabolic: number) {
  return interpolate([[100, 33.7], [180, 30.8], [300, 26.7], [415, 25.0], [520, 23.0], [738, 20.0]], metabolic);
}

function ceilingFor(metabolic: number) {
  if (metabolic < 240) return null;
  return interpolate([[240, 31.0], [300, 30.0], [415, 28.0], [520, 26.5], [738, 24.0]], metabolic);
}

function classifyNho(correctedIbutg: number, metabolic: number): NhoStatus {
  const action = actionLevelFor(metabolic);
  const limit = exposureLimitFor(metabolic);
  if (correctedIbutg >= limit) return 'above_limit';
  if (correctedIbutg >= action) return 'action';
  return 'normal';
}

function conclusionFor(correctedIbutg: number, metabolic: number) {
  const action = actionLevelFor(metabolic);
  const limit = exposureLimitFor(metabolic);
  if (correctedIbutg < action) return 'Risco I - Abaixo do Nível de Ação';
  if (correctedIbutg < limit) return 'Risco II - Entre o Nível de Ação e o Limite de Exposição';
  return 'Risco III - Acima do Limite de Exposição';
}

function controlMeasuresFor(status: NhoStatus) {
  if (status === 'above_limit') {
    return 'Interromper ou replanejar a atividade, reduzir exposição, reforçar pausas, hidratação, ventilação/exaustão e avaliação da liderança de HSSE.';
  }
  if (status === 'action') {
    return 'Aplicar controles preventivos, hidratação programada, pausas, monitoramento dos trabalhadores e reavaliação se as condições mudarem.';
  }
  return 'Manter controles existentes, hidratação, observação de sintomas e reavaliar em caso de mudança de condição ambiental ou atividade.';
}

function statusLabel(status: NhoStatus) {
  if (status === 'above_limit') return 'Acima do Limite';
  if (status === 'action') return 'Nível de Ação';
  return 'Normal';
}

function statusBadge(status: NhoStatus, size: 'sm' | 'md' = 'sm') {
  const cls = size === 'md' ? 'text-sm py-1 px-3' : '';
  if (status === 'above_limit') {
    return <Badge className={cn('bg-red-100 text-red-800 hover:bg-red-100 border-red-200', cls)}>{statusLabel(status)}</Badge>;
  }
  if (status === 'action') {
    return <Badge className={cn('bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200', cls)}>{statusLabel(status)}</Badge>;
  }
  return <Badge variant="secondary" className={cn('font-normal', cls)}>{statusLabel(status)}</Badge>;
}

export default function HeatStress() {
  const { t } = useTranslation();
  const { user, profile, isAdmin, isAdminMaster, isSupervisor } = useAuth() as ReturnType<typeof useAuth> & { isSupervisor?: boolean };
  const canDelete = isAdmin || isAdminMaster || isSupervisor;
  const { organization } = useOrganization();
  const branding = useOrganizationBranding();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedShipId } = useShipFilter();
  const { data: ships = [], isLoading: shipsLoading } = useShips();

  const [step, setStep] = useState(0);
  const [sector, setSector] = useState('');
  const [evaluationAt, setEvaluationAt] = useState(localDateTimeValue());
  const [expirationDate, setExpirationDate] = useState(localDateValue(7));
  const [ptwNumber, setPtwNumber] = useState('');
  const [mainActivity, setMainActivity] = useState('');
  const [evaluatorName, setEvaluatorName] = useState(profile?.full_name || '');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [confinedOrArtificial, setConfinedOrArtificial] = useState<YesNo>('yes');
  const [envType, setEnvType] = useState<EnvType>('no_solar');
  const [ambientTemp, setAmbientTemp] = useState('');
  const [relativeHumidity, setRelativeHumidity] = useState('');
  const [monitorManufacturer, setMonitorManufacturer] = useState('');
  const [monitorModel, setMonitorModel] = useState('');
  const [monitorSerial, setMonitorSerial] = useState('');
  const [calibrationDate, setCalibrationDate] = useState('');
  const [readings, setReadings] = useState<Reading[]>([{ tbn: '', tg: '', tbs: '' }]);
  const [metabolicStages, setMetabolicStages] = useState<MetabolicStage[]>([
    { description: '', activity: 'Em pé, agachado ou ajoelhado trabalhando com dois braços', duration: '60', rate: '279' },
  ]);
  const [clothingType, setClothingType] = useState<string>(CLOTHING_OPTIONS[1][0]);
  const [clothingIncrement, setClothingIncrement] = useState(String(CLOTHING_OPTIONS[1][1]));
  const [notes, setNotes] = useState('');

  const shipId = selectedShipId || ships[0]?.id || '';
  const selectedShip = ships.find((ship) => ship.id === shipId);
  const heatIndex = calcHeatIndex(numberOrNull(ambientTemp), numberOrNull(relativeHumidity));
  const heatRisk = heatRiskLabel(heatIndex);

  const validReadings = useMemo(() => readings
    .map((reading) => ({
      tbn: numberOrNull(reading.tbn),
      tg: numberOrNull(reading.tg),
      tbs: numberOrNull(reading.tbs),
    }))
    .filter((reading) => reading.tbn != null && reading.tg != null && (envType !== 'with_solar' || reading.tbs != null))
    .map((reading) => ({
      tbn: reading.tbn as number,
      tg: reading.tg as number,
      tbs: reading.tbs,
    })), [envType, readings]);

  const variationCheck = useMemo(() => ({
    tbn: checkVariation(validReadings.map((reading) => reading.tbn), true) ?? true,
    tg: checkVariation(validReadings.map((reading) => reading.tg), true) ?? true,
    tbs: checkVariation(validReadings.map((reading) => reading.tbs), envType === 'with_solar'),
  }), [envType, validReadings]);

  const averages = useMemo(() => {
    if (validReadings.length === 0) return null;
    const count = validReadings.length;
    const avgTbn = validReadings.reduce((sum, reading) => sum + reading.tbn, 0) / count;
    const avgTg = validReadings.reduce((sum, reading) => sum + reading.tg, 0) / count;
    const avgTbs = envType === 'with_solar'
      ? validReadings.reduce((sum, reading) => sum + (reading.tbs ?? 0), 0) / count
      : null;
    return { avgTbn, avgTg, avgTbs };
  }, [envType, validReadings]);

  const ibutg = useMemo(() => {
    if (!averages) return null;
    if (envType === 'with_solar') {
      return Number((0.7 * averages.avgTbn + 0.2 * averages.avgTg + 0.1 * (averages.avgTbs ?? 0)).toFixed(2));
    }
    return Number((0.7 * averages.avgTbn + 0.3 * averages.avgTg).toFixed(2));
  }, [averages, envType]);

  const normalizedStages = useMemo(() => metabolicStages
    .map((stage) => ({
      description: stage.description.trim(),
      activity: stage.activity,
      duration: numberOrNull(stage.duration) ?? 0,
      rate: numberOrNull(stage.rate) ?? 0,
    }))
    .filter((stage) => stage.duration > 0 && stage.rate > 0), [metabolicStages]);

  const totalDuration = normalizedStages.reduce((sum, stage) => sum + stage.duration, 0);
  const metabolic = totalDuration > 0
    ? normalizedStages.reduce((sum, stage) => sum + stage.duration * stage.rate, 0) / totalDuration
    : 0;
  const increment = Number(clothingIncrement) || 0;
  const correctedIbutg = ibutg == null ? null : Number((ibutg + increment).toFixed(2));
  const actionLevel = metabolic > 0 ? actionLevelFor(metabolic) : null;
  const exposureLimit = metabolic > 0 ? exposureLimitFor(metabolic) : null;
  const ceilingValue = metabolic > 0 ? ceilingFor(metabolic) : null;
  const finalStatus = correctedIbutg != null && metabolic > 0 ? classifyNho(correctedIbutg, metabolic) : null;
  const conclusion = correctedIbutg != null && metabolic > 0 ? conclusionFor(correctedIbutg, metabolic) : null;
  const controlMeasures = finalStatus ? controlMeasuresFor(finalStatus) : '';

  const canGoStep1 = !!shipId && !!sector.trim() && !!evaluationAt && !!mainActivity.trim() && !!evaluatorName.trim();
  const canGoStep2 = !!envType && !!confinedOrArtificial;
  const canGoStep3 = validReadings.length > 0 && ibutg != null && variationCheck.tbn && variationCheck.tg && (variationCheck.tbs !== false);
  const canGoStep4 = normalizedStages.length > 0 && totalDuration === 60 && metabolic > 0;

  const { data: measurements = [], isLoading: measurementsLoading } = useQuery({
    queryKey: ['heat-stress-measurements', shipId],
    queryFn: async () => {
      if (!shipId) return [] as Measurement[];
      const { data, error } = await heatStressTable
        .from('heat_stress_measurements')
        .select('*')
        .eq('ship_id', shipId)
        .order('measured_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!shipId,
  });

  const creatorIds = useMemo(() => Array.from(new Set(measurements.map((m) => m.created_by).filter(Boolean))) as string[], [measurements]);
  const { data: creatorsMap = {} } = useQuery({
    queryKey: ['heat-stress-creators', creatorIds.sort().join(',')],
    queryFn: async () => {
      if (creatorIds.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', creatorIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      ((data || []) as Array<{ user_id: string; full_name: string | null }>).forEach((profileRow) => {
        map[profileRow.user_id] = profileRow.full_name || '';
      });
      return map;
    },
    enabled: creatorIds.length > 0,
  });

  const details = (): HeatStressDetails => ({
    evaluation_at: evaluationAt,
    expiration_date: expirationDate || undefined,
    ptw_number: ptwNumber.trim() || undefined,
    main_activity: mainActivity.trim(),
    evaluator_name: evaluatorName.trim(),
    additional_info: additionalInfo.trim() || undefined,
    confined_or_artificial: confinedOrArtificial,
    heat_index: {
      temperature_c: numberOrNull(ambientTemp),
      relative_humidity: numberOrNull(relativeHumidity),
      value: heatIndex,
      potential_risk: heatRisk,
    },
    monitor: {
      manufacturer: monitorManufacturer.trim(),
      model: monitorModel.trim(),
      serial_number: monitorSerial.trim(),
      calibration_date: calibrationDate,
    },
    variation_check: variationCheck,
    metabolic_stages: normalizedStages,
    clothing: {
      type: clothingType,
      increment,
    },
    corrected_ibutg: correctedIbutg ?? undefined,
    action_level: actionLevel ?? undefined,
    exposure_limit: exposureLimit ?? undefined,
    ceiling_value: ceilingValue,
    conclusion: conclusion ?? undefined,
    control_measures: controlMeasures,
  });

  const pdfData = (measurement?: Measurement): HeatStressPDFData => ({
    shipName: selectedShip?.name || '—',
    sector: measurement?.sector ?? sector.trim(),
    environmentType: measurement?.environment_type ?? envType,
    metabolicRate: Number(measurement?.metabolic_rate ?? metabolic),
    readings: measurement?.readings?.length ? measurement.readings : validReadings,
    avgTbn: Number(measurement?.tbn ?? averages?.avgTbn ?? 0),
    avgTg: Number(measurement?.tg ?? averages?.avgTg ?? 0),
    avgTbs: measurement?.tbs ?? averages?.avgTbs ?? null,
    ibutg: Number(measurement?.ibutg ?? ibutg ?? 0),
    nhoStatus: measurement?.nho_status ?? finalStatus ?? 'normal',
    inspectorName: measurement?.created_by ? creatorsMap[measurement.created_by] : evaluatorName || profile?.full_name || undefined,
    measuredAt: measurement?.measured_at ?? evaluationAt,
    notes: measurement?.notes ?? (notes.trim() || null),
    branding,
    details: measurement?.details ?? details(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!averages || ibutg == null || correctedIbutg == null || !finalStatus) throw new Error('Dados incompletos');
      const payload = {
        ship_id: shipId,
        organization_id: organization?.id || null,
        sector: sector.trim(),
        environment_type: envType,
        tbn: Number(averages.avgTbn.toFixed(2)),
        tg: Number(averages.avgTg.toFixed(2)),
        tbs: envType === 'with_solar' && averages.avgTbs != null ? Number(averages.avgTbs.toFixed(2)) : null,
        metabolic_rate: Number(metabolic.toFixed(2)),
        ibutg,
        nho_status: finalStatus,
        notes: notes.trim() || null,
        readings: validReadings.map((reading) => ({
          tbn: Number(reading.tbn.toFixed(2)),
          tg: Number(reading.tg.toFixed(2)),
          tbs: reading.tbs != null ? Number(reading.tbs.toFixed(2)) : null,
        })),
        details: details(),
        measured_at: new Date(evaluationAt).toISOString(),
        created_by: user?.id || null,
      };
      const { data, error } = await heatStressTable
        .from('heat_stress_measurements')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Measurement;
    },
    onSuccess: async (saved) => {
      toast({ title: 'Medição registrada', description: 'Heat Stress salvo com todos os campos da avaliação.' });
      queryClient.invalidateQueries({ queryKey: ['heat-stress-measurements', shipId] });
      await downloadHeatStressPDF(pdfData(saved));
      setStep(0);
      setSector('');
      setPtwNumber('');
      setMainActivity('');
      setAdditionalInfo('');
      setNotes('');
      setReadings([{ tbn: '', tg: '', tbs: '' }]);
      setMetabolicStages([{ description: '', activity: 'Em pé, agachado ou ajoelhado trabalhando com dois braços', duration: '60', rate: '279' }]);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await heatStressTable
        .from('heat_stress_measurements')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Medição excluída', description: 'A medição foi removida com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['heat-stress-measurements', shipId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });

  const nextDisabled = (step === 0 && !canGoStep1) || (step === 1 && !canGoStep2) || (step === 2 && !canGoStep3) || (step === 3 && !canGoStep4);
  const addReading = () => setReadings((current) => current.length >= 6 ? current : [...current, { tbn: '', tg: '', tbs: '' }]);
  const updateReading = (index: number, field: keyof Reading, value: string) => setReadings((current) => current.map((reading, rowIndex) => rowIndex === index ? { ...reading, [field]: value } : reading));
  const removeReading = (index: number) => setReadings((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index));

  const addStage = () => setMetabolicStages((current) => current.length >= 7 ? current : [...current, { description: '', activity: 'Sentado em repouso', duration: '', rate: '115' }]);
  const updateStage = (index: number, patch: Partial<MetabolicStage>) => setMetabolicStages((current) => current.map((stage, rowIndex) => rowIndex === index ? { ...stage, ...patch } : stage));
  const removeStage = (index: number) => setMetabolicStages((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Thermometer}
        title={t('heatStress.title')}
        subtitle={t('heatStress.operationalSubtitle')}
      />

      <WizardProgress step={step} />

      <Card>
        <CardContent className="space-y-6 pt-6">
          {step === 0 && (
            <section className="space-y-5">
              <SectionTitle title={t('heatStress.wizard.identificationTitle')} description={t('heatStress.wizard.identificationSubtitle')} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ReadOnlyField icon={ShipIcon} label={t('heatStress.form.unit')} value={shipsLoading ? t('common.loading') : selectedShip?.name || t('heatStress.form.noShip')} />
                <Field label={t('heatStress.form.activityLocation')}>
                  <AreaCombobox shipId={shipId} value={sector} onChange={setSector} placeholder={t('heatStress.form.areaPlaceholder')} disabled={!shipId} />
                </Field>
                <Field label={t('heatStress.form.ptwNumber')}>
                  <Input value={ptwNumber} onChange={(event) => setPtwNumber(event.target.value)} placeholder="N/A" />
                </Field>
                <Field label={t('heatStress.form.evaluationDateTime')}>
                  <DateTimePicker value={evaluationAt} onChange={setEvaluationAt} />
                </Field>
                <Field label={t('heatStress.form.expirationDate')}>
                  <DatePicker value={expirationDate} onChange={setExpirationDate} />
                </Field>
                <Field label={t('heatStress.form.evaluator')}>
                  <Input value={evaluatorName} onChange={(event) => setEvaluatorName(event.target.value)} placeholder={t('heatStress.form.evaluatorPlaceholder')} />
                </Field>
              </div>
              <Field label={t('heatStress.form.mainActivity')}>
                <Input value={mainActivity} onChange={(event) => setMainActivity(event.target.value)} placeholder={t('heatStress.form.mainActivityPlaceholder')} />
              </Field>
              <Field label={t('heatStress.form.additionalInfo')}>
                <Textarea value={additionalInfo} onChange={(event) => setAdditionalInfo(event.target.value)} rows={3} placeholder={t('heatStress.form.additionalInfoPlaceholder')} />
              </Field>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-5">
              <SectionTitle title={t('heatStress.form.environmentEquipment')} description={t('heatStress.form.environmentEquipmentDesc')} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('heatStress.form.confinedQuestion')}>
                  <Select value={confinedOrArtificial} onValueChange={(value) => setConfinedOrArtificial(value as YesNo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{t('common.yes')}</SelectItem>
                      <SelectItem value="no">{t('common.no')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t('heatStress.form.solarQuestion')}>
                  <Select value={envType} onValueChange={(value) => setEnvType(value as EnvType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_solar">{t('common.no')}</SelectItem>
                      <SelectItem value="with_solar">{t('common.yes')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t('heatStress.form.ambientTemp')}>
                  <Input type="number" step="0.1" value={ambientTemp} onChange={(event) => setAmbientTemp(event.target.value)} />
                </Field>
                <Field label={t('heatStress.form.relativeHumidity')}>
                  <Input type="number" step="0.1" value={relativeHumidity} onChange={(event) => setRelativeHumidity(event.target.value)} />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <MetricCard label={t('heatStress.form.heatIndex')} value={heatIndex != null ? `${heatIndex.toFixed(1)} °C` : '-'} icon={Sun} />
                <MetricCard label={t('heatStress.form.potentialRisk')} value={heatRisk ? t(`heatStress.risk.${heatRisk}`) : '-'} icon={AlertTriangle} />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label={t('heatStress.form.manufacturer')}>
                  <Input value={monitorManufacturer} onChange={(event) => setMonitorManufacturer(event.target.value)} placeholder="Ex.: TSQUEST" />
                </Field>
                <Field label={t('heatStress.form.model')}>
                  <Input value={monitorModel} onChange={(event) => setMonitorModel(event.target.value)} placeholder="Ex.: Quest Temp" />
                </Field>
                <Field label={t('heatStress.form.serialNumber')}>
                  <Input value={monitorSerial} onChange={(event) => setMonitorSerial(event.target.value)} />
                </Field>
                <Field label={t('heatStress.form.calibrationDate')}>
                  <DatePicker value={calibrationDate} onChange={setCalibrationDate} />
                </Field>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <SectionTitle title={t('heatStress.form.readingsTitle')} description={t('heatStress.form.readingsDesc')} />
                <Button variant="outline" size="sm" onClick={addReading} disabled={readings.length >= 6}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('heatStress.form.reading')} ({readings.length}/6)
                </Button>
              </div>
              <div className="space-y-3">
                {readings.map((reading, index) => (
                  <div key={index} className="grid grid-cols-12 items-end gap-2 rounded-md border bg-muted/20 p-3">
                    <div className="col-span-12 sm:col-span-1">
                      <span className="text-xs text-muted-foreground">{t('heatStress.form.reading')}</span>
                      <p className="text-lg font-semibold">{index + 1}</p>
                    </div>
                    <TempInput className="col-span-12 sm:col-span-3" label="tg (°C)" icon={Flame} value={reading.tg} onChange={(value) => updateReading(index, 'tg', value)} />
                    <TempInput className="col-span-12 sm:col-span-3" label="tbs (°C)" icon={Sun} value={reading.tbs} onChange={(value) => updateReading(index, 'tbs', value)} disabled={envType !== 'with_solar'} />
                    <TempInput className="col-span-10 sm:col-span-3" label="tbn (°C)" icon={Thermometer} value={reading.tbn} onChange={(value) => updateReading(index, 'tbn', value)} />
                    <div className="col-span-2 flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => removeReading(index)} disabled={readings.length === 1}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label={t('heatStress.measurements.avgTbn')} value={averages ? `${averages.avgTbn.toFixed(2)} °C` : '-'} icon={Thermometer} />
                <MetricCard label={t('heatStress.measurements.avgTg')} value={averages ? `${averages.avgTg.toFixed(2)} °C` : '-'} icon={Flame} />
                <MetricCard label={t('heatStress.measurements.avgTbs')} value={averages?.avgTbs != null ? `${averages.avgTbs.toFixed(2)} °C` : '-'} icon={Sun} />
                <MetricCard label="IBUTG" value={ibutg != null ? `${ibutg.toFixed(2)} °C` : '-'} icon={Activity} highlight />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <VariationBadge label={t('heatStress.form.variationTbn')} ok={variationCheck.tbn} />
                <VariationBadge label={t('heatStress.form.variationTg')} ok={variationCheck.tg} />
                <VariationBadge label={t('heatStress.form.variationTbs')} ok={variationCheck.tbs} />
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <SectionTitle title={t('heatStress.form.metabolismTitle')} description={t('heatStress.form.metabolismDesc')} />
                <Button variant="outline" size="sm" onClick={addStage} disabled={metabolicStages.length >= 7}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('heatStress.form.stage')}
                </Button>
              </div>
              <div className="space-y-3">
                {metabolicStages.map((stage, index) => (
                  <div key={index} className="grid gap-3 rounded-md border bg-muted/20 p-3 lg:grid-cols-[1.4fr_2fr_120px_120px_44px] lg:items-end">
                    <Field label={t('heatStress.form.serviceStage')}>
                      <Input value={stage.description} onChange={(event) => updateStage(index, { description: event.target.value })} placeholder={t('heatStress.form.serviceStagePlaceholder')} />
                    </Field>
                    <Field label={t('heatStress.form.activityRate')}>
                      <Select
                        value={stage.activity}
                        onValueChange={(value) => {
                          const selected = METABOLIC_ACTIVITIES.find(([label]) => label === value);
                          updateStage(index, { activity: value, rate: String(selected?.[1] ?? stage.rate) });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-80">
                          {METABOLIC_ACTIVITIES.map(([label, rate]) => (
                            <SelectItem key={label} value={label}>{label} ({rate} W)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('heatStress.form.durationMin')}>
                      <Input type="number" min={0} max={60} value={stage.duration} onChange={(event) => updateStage(index, { duration: event.target.value })} />
                    </Field>
                    <Field label={t('heatStress.form.rateW')}>
                      <Input type="number" min={0} value={stage.rate} onChange={(event) => updateStage(index, { rate: event.target.value })} />
                    </Field>
                    <Button variant="ghost" size="icon" onClick={() => removeStage(index)} disabled={metabolicStages.length === 1}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard label={t('heatStress.form.totalDuration')} value={`${totalDuration.toFixed(0)} min`} icon={ClipboardList} highlight={totalDuration !== 60} />
                <MetricCard label={t('heatStress.form.weightedRate')} value={metabolic > 0 ? `${metabolic.toFixed(0)} W` : '-'} icon={Activity} />
                <MetricCard label={t('heatStress.form.validation')} value={totalDuration === 60 ? t('heatStress.form.valid60') : t('heatStress.form.adjustDuration')} icon={totalDuration === 60 ? CheckCircle2 : AlertTriangle} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('heatStress.form.clothingType')}>
                  <Select
                    value={clothingType}
                    onValueChange={(value) => {
                      const selected = CLOTHING_OPTIONS.find(([label]) => label === value);
                      setClothingType(value);
                      setClothingIncrement(String(selected?.[1] ?? 0));
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLOTHING_OPTIONS.map(([label, inc]) => (
                        <SelectItem key={label} value={label}>{label} (+{inc} °C)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t('heatStress.form.ibutgIncrement')}>
                  <Input type="number" step="0.1" value={clothingIncrement} onChange={(event) => setClothingIncrement(event.target.value)} />
                </Field>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-5">
              <SectionTitle title={t('heatStress.form.reviewTitle')} description={t('heatStress.form.reviewDesc')} />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="IBUTG" value={ibutg != null ? `${ibutg.toFixed(2)} °C` : '-'} icon={Thermometer} />
                <MetricCard label={t('heatStress.form.clothingIncrement')} value={`+${increment.toFixed(1)} °C`} icon={Sun} />
                <MetricCard label={t('heatStress.form.correctedIbutg')} value={correctedIbutg != null ? `${correctedIbutg.toFixed(2)} °C` : '-'} icon={Activity} highlight />
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs text-muted-foreground">{t('common.status')}</p>
                  <div className="mt-2">{finalStatus ? statusBadge(finalStatus, 'md') : '-'}</div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard label={t('heatStress.form.actionLevel')} value={actionLevel != null ? `${actionLevel.toFixed(1)} °C` : '-'} icon={AlertTriangle} />
                <MetricCard label={t('heatStress.form.exposureLimit')} value={exposureLimit != null ? `${exposureLimit.toFixed(1)} °C` : '-'} icon={AlertOctagon} />
                <MetricCard label={t('heatStress.form.ceilingValue')} value={ceilingValue != null ? `${ceilingValue.toFixed(1)} °C` : '-'} icon={FileText} />
              </div>
              <div className="rounded-md border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('heatStress.form.conclusion')}</p>
                <p className="mt-1 text-lg font-semibold">{conclusion || '-'}</p>
              </div>
              <Field label={t('heatStress.form.controlMeasures')}>
                <Textarea value={controlMeasures} readOnly rows={3} />
              </Field>
              <Field label={t('heatStress.form.finalNotes')}>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder={t('heatStress.form.finalNotesPlaceholder')} />
              </Field>
            </section>
          )}

          <Separator />
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || saveMutation.isPending}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              {t('heatStress.nav.back')}
            </Button>
            {step < WIZARD_STEPS.length - 1 ? (
              <Button onClick={() => setStep((current) => Math.min(WIZARD_STEPS.length - 1, current + 1))} disabled={nextDisabled}>
                {t('heatStress.nav.continue')}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || correctedIbutg == null || !finalStatus}>
                {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {t('heatStress.nav.saveAndDownload')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('heatStress.history.title')}</CardTitle>
          <CardDescription>{selectedShip?.name ? t('heatStress.history.subtitle', { ship: selectedShip.name }) : t('heatStress.history.selectShip')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('heatStress.history.colDateTime')}</TableHead>
                  <TableHead>{t('heatStress.history.colSector')}</TableHead>
                  <TableHead className="text-right">Tbn</TableHead>
                  <TableHead className="text-right">Tg</TableHead>
                  <TableHead className="text-right">Tbs</TableHead>
                  <TableHead className="text-right">IBUTG</TableHead>
                  <TableHead className="text-right">{t('heatStress.history.colCorrected')}</TableHead>
                  <TableHead>{t('heatStress.history.colStatus')}</TableHead>
                  <TableHead>{t('heatStress.history.colResponsible')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {measurementsLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      {t('common.loading')}
                    </TableCell>
                  </TableRow>
                ) : measurements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">{t('heatStress.history.empty')}</TableCell>
                  </TableRow>
                ) : measurements.map((measurement) => (
                  <TableRow key={measurement.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(measurement.measured_at)}</TableCell>
                    <TableCell className="font-medium">{measurement.sector}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(measurement.tbn).toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(measurement.tg).toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{measurement.tbs != null ? Number(measurement.tbs).toFixed(1) : '-'}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{Number(measurement.ibutg).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{measurement.details?.corrected_ibutg != null ? Number(measurement.details.corrected_ibutg).toFixed(2) : '-'}</TableCell>
                    <TableCell>{statusBadge(measurement.nho_status)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{measurement.created_by ? creatorsMap[measurement.created_by] || '-' : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { void downloadHeatStressPDF(pdfData(measurement)); }} aria-label={t('heatStress.history.downloadPdf')}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={deleteMutation.isPending}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('heatStress.history.deleteConfirmTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('heatStress.history.deleteConfirmDescription', { sector: measurement.sector, date: formatDateTime(measurement.measured_at) })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(measurement.id)}>
                                  {t('common.delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WizardProgress({ step }: { step: number }) {
  const { t } = useTranslation();
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
                  <p className={cn('truncate text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{t(`heatStress.${item.titleKey}`)}</p>
                  <p className="truncate text-xs text-muted-foreground">{t(`heatStress.${item.descriptionKey}`)}</p>
                </div>
                {index < WIZARD_STEPS.length - 1 && <div className="hidden h-px flex-1 bg-border lg:block" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <CardTitle className="text-lg">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ReadOnlyField({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
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

function TempInput({ label, icon: Icon, value, onChange, disabled, className }: { label: string; icon: LucideIcon; value: string; onChange: (value: string) => void; disabled?: boolean; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="flex items-center gap-1.5 text-xs">
        <Icon className="h-3 w-3 text-muted-foreground" />
        {label}
      </Label>
      <Input type="number" step="0.1" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder={disabled ? '-' : '0.0'} />
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, highlight = false }: { label: string; value: string; icon: LucideIcon; highlight?: boolean }) {
  return (
    <div className={cn('rounded-md border bg-background p-3', highlight && 'border-primary/30 bg-primary/5')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function VariationBadge({ label, ok }: { label: string; ok: boolean | null }) {
  const neutral = ok == null;
  return (
    <div className={cn(
      'flex items-center justify-between rounded-md border p-3 text-sm',
      neutral && 'bg-muted/20 text-muted-foreground',
      ok === true && 'border-emerald-200 bg-emerald-50 text-emerald-700',
      ok === false && 'border-red-200 bg-red-50 text-red-700',
    )}>
      <span>{label}</span>
      <span className="font-medium">{neutral ? 'N/A' : ok ? 'Atende' : 'Não atende'}</span>
    </div>
  );
}
