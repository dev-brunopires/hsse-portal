import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Thermometer, Flame, Sun, Activity, Save, Loader2, Plus, Trash2,
  ChevronLeft, ChevronRight, FileDown, Ship as ShipIcon, MapPin, Cloud,
  CheckCircle2, AlertTriangle, AlertOctagon, FileText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useShips } from '@/hooks/useShips';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatDateTime } from '@/utils/dateFormat';
import { downloadHeatStressPDF, type HeatStressPDFData } from '@/utils/generateHeatStressPDF';
import { cn } from '@/lib/utils';
import { AreaCombobox } from '@/components/ships/AreaCombobox';


type EnvType = 'no_solar' | 'with_solar';
type NhoStatus = 'normal' | 'action' | 'above_limit';

interface Reading { tbn: string; tg: string; tbs: string; }

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
}


const METABOLIC_PRESETS: { key: string; value: number }[] = [
  { key: 'rest', value: 115 },
  { key: 'light', value: 180 },
  { key: 'moderate', value: 300 },
  { key: 'heavy', value: 415 },
  { key: 'veryHeavy', value: 520 },
];

// NHO 06 — limites de tolerância simplificados (regime contínuo)
function classifyNho(ibutg: number, metabolic: number): NhoStatus {
  let lt: number; let na: number;
  if (metabolic <= 180) { lt = 30.0; na = 28.0; }
  else if (metabolic <= 300) { lt = 26.7; na = 25.0; }
  else if (metabolic <= 415) { lt = 25.0; na = 23.0; }
  else { lt = 23.0; na = 21.5; }
  if (ibutg >= lt) return 'above_limit';
  if (ibutg >= na) return 'action';
  return 'normal';
}

function useStatusBadge() {
  const { t } = useTranslation();
  return (status: NhoStatus, size: 'sm' | 'md' = 'sm') => {
    const cls = size === 'md' ? 'text-sm py-1 px-3' : '';
    if (status === 'above_limit') return (
      <Badge className={cn('bg-red-100 text-red-800 hover:bg-red-100 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900', cls)}>
        {t('heatStress.status.aboveLimit')}
      </Badge>
    );
    if (status === 'action') return (
      <Badge className={cn('bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900', cls)}>
        {t('heatStress.status.action')}
      </Badge>
    );
    return <Badge variant="secondary" className={cn('font-normal', cls)}>{t('heatStress.status.normal')}</Badge>;
  };
}


export default function HeatStress() {
  const { t } = useTranslation();
  const { user, profile, isAdmin, isAdminMaster, isSupervisor } = useAuth() as any;
  const canDelete = isAdmin || isAdminMaster || isSupervisor;
  const { organization } = useOrganization();
  const branding = useOrganizationBranding();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: ships = [], isLoading: shipsLoading } = useShips();
  const statusBadge = useStatusBadge();

  const STEPS = [
    { id: 1, title: t('heatStress.steps.info'), icon: ShipIcon },
    { id: 2, title: t('heatStress.steps.measurements'), icon: Thermometer },
    { id: 3, title: t('heatStress.steps.summary'), icon: FileText },
  ];


  // wizard state - ship comes from global header filter
  const { selectedShipId } = useShipFilter();
  const [step, setStep] = useState(1);
  const [sector, setSector] = useState('');
  const [envType, setEnvType] = useState<EnvType>('no_solar');
  const [metabolicPreset, setMetabolicPreset] = useState<string>('180');
  const [metabolicCustom, setMetabolicCustom] = useState('');
  const [notes, setNotes] = useState('');
  const [readings, setReadings] = useState<Reading[]>([{ tbn: '', tg: '', tbs: '' }]);

  // Use globally selected ship; fallback to first ship if header is on "All"
  const shipId = selectedShipId || ships[0]?.id || '';

  const metabolic = metabolicCustom ? Number(metabolicCustom) : Number(metabolicPreset);
  const selectedShip = ships.find(s => s.id === shipId);

  // valid readings = pelo menos tbn e tg numéricos (+ tbs se with_solar)
  const validReadings = useMemo(() => readings
    .map(r => ({
      tbn: Number(r.tbn),
      tg: Number(r.tg),
      tbs: r.tbs !== '' ? Number(r.tbs) : null,
    }))
    .filter(r => !isNaN(r.tbn) && r.tbn > 0 && !isNaN(r.tg) && r.tg > 0
      && (envType !== 'with_solar' || (r.tbs !== null && !isNaN(r.tbs) && r.tbs > 0))),
  [readings, envType]);

  const averages = useMemo(() => {
    if (validReadings.length === 0) return null;
    const n = validReadings.length;
    const avgTbn = validReadings.reduce((s, r) => s + r.tbn, 0) / n;
    const avgTg = validReadings.reduce((s, r) => s + r.tg, 0) / n;
    const avgTbs = envType === 'with_solar'
      ? validReadings.reduce((s, r) => s + (r.tbs || 0), 0) / n
      : null;
    return { avgTbn, avgTg, avgTbs };
  }, [validReadings, envType]);

  const ibutg = useMemo(() => {
    if (!averages) return null;
    if (envType === 'with_solar') {
      return Number((0.7 * averages.avgTbn + 0.2 * averages.avgTg + 0.1 * (averages.avgTbs || 0)).toFixed(2));
    }
    return Number((0.7 * averages.avgTbn + 0.3 * averages.avgTg).toFixed(2));
  }, [averages, envType]);

  const finalStatus = ibutg !== null && metabolic > 0 ? classifyNho(ibutg, metabolic) : null;

  const canGoStep2 = !!shipId && !!sector.trim() && metabolic > 0;
  const canGoStep3 = validReadings.length > 0 && ibutg !== null;

  // ===== Histórico =====
  const { data: measurements = [], isLoading: measurementsLoading } = useQuery({
    queryKey: ['heat-stress-measurements', shipId],
    queryFn: async () => {
      if (!shipId) return [] as Measurement[];
      const { data, error } = await (supabase as any)
        .from('heat_stress_measurements')
        .select('*')
        .eq('ship_id', shipId)
        .order('measured_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as Measurement[];
    },
    enabled: !!shipId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!ibutg || !averages || !finalStatus) throw new Error(t('heatStress.toast.incompleteData'));
      const payload = {
        ship_id: shipId,
        organization_id: organization?.id || null,
        sector: sector.trim(),
        environment_type: envType,
        tbn: Number(averages.avgTbn.toFixed(2)),
        tg: Number(averages.avgTg.toFixed(2)),
        tbs: envType === 'with_solar' && averages.avgTbs != null ? Number(averages.avgTbs.toFixed(2)) : null,
        metabolic_rate: metabolic,
        ibutg,
        nho_status: finalStatus,
        notes: notes.trim() || null,
        readings: validReadings.map(r => ({
          tbn: Number(r.tbn.toFixed(2)),
          tg: Number(r.tg.toFixed(2)),
          tbs: r.tbs != null ? Number(r.tbs.toFixed(2)) : null,
        })),
        created_by: user?.id || null,
      };
      const { data, error } = await (supabase as any)
        .from('heat_stress_measurements')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Measurement;
    },
    onSuccess: async (saved) => {
      toast({ title: t('heatStress.toast.savedTitle'), description: t('heatStress.toast.savedDescription') });
      queryClient.invalidateQueries({ queryKey: ['heat-stress-measurements', shipId] });

      // Gera e baixa o PDF automaticamente
      await downloadHeatStressPDF({
        shipName: selectedShip?.name || '—',
        sector: sector.trim(),
        environmentType: envType,
        metabolicRate: metabolic,
        readings: validReadings,
        avgTbn: averages!.avgTbn,
        avgTg: averages!.avgTg,
        avgTbs: averages!.avgTbs,
        ibutg: ibutg!,
        nhoStatus: finalStatus!,
        inspectorName: profile?.full_name || undefined,
        measuredAt: saved.measured_at,
        notes: notes.trim() || null,
        branding,
      });

      // Reset wizard
      setStep(1);
      setSector('');
      setNotes('');
      setReadings([{ tbn: '', tg: '', tbs: '' }]);
    },
    onError: (err: Error) => {
      toast({ title: t('heatStress.toast.errorTitle'), description: err.message, variant: 'destructive' });
    },
  });

  const downloadHistoryPDF = async (m: Measurement) => {
    const ship = ships.find(s => s.id === m.ship_id);
    const storedReadings = Array.isArray(m.readings) && m.readings.length > 0
      ? m.readings.map(r => ({
          tbn: Number(r.tbn),
          tg: Number(r.tg),
          tbs: r.tbs != null ? Number(r.tbs) : null,
        }))
      : [{ tbn: Number(m.tbn), tg: Number(m.tg), tbs: m.tbs != null ? Number(m.tbs) : null }];

    await downloadHeatStressPDF({
      shipName: ship?.name || '—',
      sector: m.sector,
      environmentType: m.environment_type,
      metabolicRate: Number(m.metabolic_rate),
      readings: storedReadings,
      avgTbn: Number(m.tbn),
      avgTg: Number(m.tg),
      avgTbs: m.tbs != null ? Number(m.tbs) : null,
      ibutg: Number(m.ibutg),
      nhoStatus: m.nho_status,
      measuredAt: m.measured_at,
      notes: m.notes,
      branding,
    });
  };


  const updateReading = (i: number, field: keyof Reading, value: string) => {
    setReadings(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };
  const addReading = () => {
    if (readings.length >= 5) return;
    setReadings(prev => [...prev, { tbn: '', tg: '', tbs: '' }]);
  };
  const removeReading = (i: number) => {
    setReadings(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Thermometer}
        title={t('heatStress.title')}
        subtitle={t('heatStress.subtitle')}
      />


      {/* WIZARD */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex items-center gap-3 overflow-x-auto">
              {STEPS.map((s, idx) => {
                const Icon = s.icon;
                const active = step === s.id;
                const completed = step > s.id;
                return (
                  <div key={s.id} className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
                      active && 'bg-primary text-primary-foreground',
                      completed && 'bg-primary/10 text-primary',
                      !active && !completed && 'bg-muted text-muted-foreground',
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="font-medium">{s.id}. {s.title}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <Separator className={cn('w-8 shrink-0', completed ? 'bg-primary/40' : '')} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ============ STEP 1: INFORMAÇÕES ============ */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <CardTitle className="text-base">{t('heatStress.info.title')}</CardTitle>
                <CardDescription>
                  {t('heatStress.info.description')}
                </CardDescription>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ShipIcon className="h-3.5 w-3.5 text-muted-foreground" /> {t('heatStress.info.ship')}
                  </Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                    {selectedShip?.name || t('heatStress.info.shipPlaceholder')}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {t('heatStress.info.sector')}
                  </Label>
                  <AreaCombobox
                    shipId={shipId}
                    value={sector}
                    onChange={setSector}
                    placeholder={t('heatStress.info.sectorPlaceholder')}
                    disabled={!shipId}
                  />
                </div>


                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Cloud className="h-3.5 w-3.5 text-muted-foreground" /> {t('heatStress.info.envType')}
                  </Label>
                  <Select value={envType} onValueChange={(v) => setEnvType(v as EnvType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_solar">{t('heatStress.info.envNoSolar')}</SelectItem>
                      <SelectItem value="with_solar">{t('heatStress.info.envWithSolar')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" /> {t('heatStress.info.metabolic')}
                  </Label>
                  <Select
                    value={metabolicCustom ? 'custom' : metabolicPreset}
                    onValueChange={(v) => {
                      if (v === 'custom') setMetabolicCustom(String(metabolic || ''));
                      else { setMetabolicCustom(''); setMetabolicPreset(v); }
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METABOLIC_PRESETS.map(p => (
                        <SelectItem key={p.value} value={String(p.value)}>{t(`heatStress.metabolicPresets.${p.key}`)}</SelectItem>
                      ))}
                      <SelectItem value="custom">{t('heatStress.info.metabolicCustom')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {metabolicCustom !== '' && (
                    <Input
                      type="number" min={0} value={metabolicCustom}
                      onChange={(e) => setMetabolicCustom(e.target.value)}
                      placeholder={t('heatStress.info.metabolicCustomPlaceholder')}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('heatStress.info.notes')}</Label>
                <Textarea
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('heatStress.info.notesPlaceholder')}
                  rows={3}
                />
              </div>

            </div>
          )}

          {/* ============ STEP 2: MEDIÇÕES ============ */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{t('heatStress.measurements.title')}</CardTitle>
                  <CardDescription>
                    {t('heatStress.measurements.description')}
                  </CardDescription>
                </div>
                <Button
                  variant="outline" size="sm" onClick={addReading}
                  disabled={readings.length >= 5}
                >
                  <Plus className="h-4 w-4 mr-1" /> {t('heatStress.measurements.addReading')} ({readings.length}/5)
                </Button>
              </div>

              <div className="space-y-3">
                {readings.map((r, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg border bg-muted/20">
                    <div className="col-span-12 sm:col-span-1 flex sm:flex-col items-center sm:items-start gap-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{t('heatStress.measurements.reading')}</span>
                      <span className="text-lg font-semibold tabular-nums">{i + 1}</span>
                    </div>
                    <div className="col-span-12 sm:col-span-3 space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <Thermometer className="h-3 w-3 text-muted-foreground" /> {t('heatStress.history.colTbn')} (°C)
                      </Label>
                      <Input type="number" step="0.1" value={r.tbn}
                        onChange={(e) => updateReading(i, 'tbn', e.target.value)} placeholder="0.0" />
                    </div>
                    <div className="col-span-12 sm:col-span-3 space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <Flame className="h-3 w-3 text-muted-foreground" /> {t('heatStress.history.colTg')} (°C)
                      </Label>
                      <Input type="number" step="0.1" value={r.tg}
                        onChange={(e) => updateReading(i, 'tg', e.target.value)} placeholder="0.0" />
                    </div>
                    <div className="col-span-10 sm:col-span-3 space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <Sun className="h-3 w-3 text-muted-foreground" /> {t('heatStress.history.colTbs')} (°C)
                      </Label>
                      <Input
                        type="number" step="0.1" value={r.tbs}
                        onChange={(e) => updateReading(i, 'tbs', e.target.value)}
                        disabled={envType !== 'with_solar'}
                        placeholder={envType === 'with_solar' ? '0.0' : '—'}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-2 flex justify-end">
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => removeReading(i)} disabled={readings.length === 1}
                        aria-label={t('heatStress.measurements.remove')}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {averages && (
                <div className="rounded-lg border bg-muted/30 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label={t('heatStress.measurements.avgTbn')} value={`${averages.avgTbn.toFixed(2)} °C`} />
                  <Stat label={t('heatStress.measurements.avgTg')} value={`${averages.avgTg.toFixed(2)} °C`} />
                  <Stat
                    label={t('heatStress.measurements.avgTbs')}
                    value={averages.avgTbs != null ? `${averages.avgTbs.toFixed(2)} °C` : '—'}
                  />
                  <Stat
                    label={t('heatStress.measurements.ibutg')}
                    value={ibutg !== null ? `${ibutg.toFixed(2)} °C` : '—'}
                    emphasis
                  />
                </div>
              )}

            </div>
          )}

          {/* ============ STEP 3: RESUMO ============ */}
          {step === 3 && ibutg !== null && averages && finalStatus && (
            <div className="space-y-5">
              <div>
                <CardTitle className="text-base">{t('heatStress.summary.title')}</CardTitle>
                <CardDescription>
                  {t('heatStress.summary.description')}
                </CardDescription>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard label={t('heatStress.summary.shipLabel')} value={selectedShip?.name || '—'} icon={ShipIcon} />
                <InfoCard label={t('heatStress.summary.sectorLabel')} value={sector} icon={MapPin} />
                <InfoCard label={t('heatStress.summary.envLabel')} value={envType === 'with_solar' ? t('heatStress.info.envWithSolarShort') : t('heatStress.info.envNoSolarShort')} icon={Cloud} />
                <InfoCard label={t('heatStress.summary.metabolicLabel')} value={`${metabolic.toFixed(0)} W`} icon={Activity} />
              </div>

              {/* IBUTG destaque */}
              <div className="rounded-xl border bg-gradient-to-br from-muted/40 to-muted/10 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('heatStress.summary.ibutgCalculated')}</p>
                  <p className="text-4xl font-bold tabular-nums mt-1">{ibutg.toFixed(2)} <span className="text-2xl text-muted-foreground">°C</span></p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('heatStress.summary.averageOf', { count: validReadings.length })} —{' '}
                    {envType === 'with_solar'
                      ? t('heatStress.summary.formulaWithSolar')
                      : t('heatStress.summary.formulaNoSolar')}
                  </p>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{t('heatStress.summary.nhoStatus')}</span>
                  <div className="flex items-center gap-2">
                    {finalStatus === 'normal' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                    {finalStatus === 'action' && <AlertTriangle className="h-5 w-5 text-amber-600" />}
                    {finalStatus === 'above_limit' && <AlertOctagon className="h-5 w-5 text-red-600" />}
                    {statusBadge(finalStatus, 'md')}
                  </div>
                </div>
              </div>

              {/* Tabela de leituras */}
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead className="text-right">{t('heatStress.history.colTbn')} (°C)</TableHead>
                      <TableHead className="text-right">{t('heatStress.history.colTg')} (°C)</TableHead>
                      {envType === 'with_solar' && <TableHead className="text-right">{t('heatStress.history.colTbs')} (°C)</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validReadings.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{i + 1}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.tbn.toFixed(1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.tg.toFixed(1)}</TableCell>
                        {envType === 'with_solar' && (
                          <TableCell className="text-right tabular-nums">{r.tbs != null ? r.tbs.toFixed(1) : '—'}</TableCell>
                        )}
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell>{t('heatStress.summary.avgRow')}</TableCell>
                      <TableCell className="text-right tabular-nums">{averages.avgTbn.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{averages.avgTg.toFixed(2)}</TableCell>
                      {envType === 'with_solar' && (
                        <TableCell className="text-right tabular-nums">{averages.avgTbs?.toFixed(2) ?? '—'}</TableCell>
                      )}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {notes && (
                <div className="rounded-lg border p-3 bg-muted/20">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{t('heatStress.summary.notesLabel')}</p>
                  <p className="text-sm whitespace-pre-wrap">{notes}</p>
                </div>
              )}

            </div>
          )}

          {/* ============ FOOTER NAV ============ */}
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1 || saveMutation.isPending}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> {t('heatStress.nav.back')}
            </Button>
            <div className="flex items-center gap-2">
              {step < 3 && (
                <Button
                  onClick={() => setStep(s => s + 1)}
                  disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3)}
                >
                  {t('heatStress.nav.continue')} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {step === 3 && (
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Save className="h-4 w-4 mr-2" />}
                  {t('heatStress.nav.saveAndDownload')}
                </Button>
              )}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* ============ HISTÓRICO ============ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('heatStress.history.title')}</CardTitle>
          <CardDescription>
            {t('heatStress.history.subtitle', { ship: selectedShip?.name || t('heatStress.history.selectShip') })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('heatStress.history.colDateTime')}</TableHead>
                  <TableHead>{t('heatStress.history.colSector')}</TableHead>
                  <TableHead className="text-right">{t('heatStress.history.colTbn')}</TableHead>
                  <TableHead className="text-right">{t('heatStress.history.colTg')}</TableHead>
                  <TableHead className="text-right">{t('heatStress.history.colTbs')}</TableHead>
                  <TableHead className="text-right">{t('heatStress.history.colIbutg')}</TableHead>
                  <TableHead className="text-right">{t('heatStress.history.colRate')}</TableHead>
                  <TableHead>{t('heatStress.history.colStatus')}</TableHead>
                  <TableHead className="text-right">{t('heatStress.history.colPdf')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {measurementsLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> {t('heatStress.history.loading')}
                    </TableCell>
                  </TableRow>
                ) : measurements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      {t('heatStress.history.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  measurements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(m.measured_at)}</TableCell>
                      <TableCell className="font-medium">{m.sector}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(m.tbn).toFixed(1)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(m.tg).toFixed(1)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.tbs != null ? Number(m.tbs).toFixed(1) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{Number(m.ibutg).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(m.metabolic_rate).toFixed(0)}</TableCell>
                      <TableCell>{statusBadge(m.nho_status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => downloadHistoryPDF(m)}
                          aria-label={t('heatStress.history.downloadPdf')}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}

              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('tabular-nums', emphasis ? 'text-2xl font-bold' : 'text-lg font-semibold')}>
        {value}
      </p>
    </div>
  );
}

function InfoCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ShipIcon }) {
  return (
    <div className="rounded-lg border p-3 flex items-center gap-3 bg-card">
      <div className="p-2 rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
