import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Thermometer, Flame, Sun, Activity, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useShips } from '@/hooks/useShips';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/utils/dateFormat';

type EnvType = 'no_solar' | 'with_solar';
type NhoStatus = 'normal' | 'action' | 'above_limit';

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
  measured_at: string;
}

// NHO 06 — Quadro 1 (limites de tolerância simplificados para regime contínuo)
// Cruza IBUTG com taxa metabólica (W) para retornar o status.
function classifyNho(ibutg: number, metabolic: number): NhoStatus {
  // Limites de Tolerância (LT) e Níveis de Ação (NA) aproximados — NHO 06
  let lt: number;
  let na: number;
  if (metabolic <= 180) { lt = 30.0; na = 28.0; }       // Leve
  else if (metabolic <= 300) { lt = 26.7; na = 25.0; }  // Moderada
  else if (metabolic <= 415) { lt = 25.0; na = 23.0; }  // Pesada
  else { lt = 23.0; na = 21.5; }                        // Muito pesada
  if (ibutg >= lt) return 'above_limit';
  if (ibutg >= na) return 'action';
  return 'normal';
}

function statusBadge(status: NhoStatus) {
  if (status === 'above_limit') {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900">
        Acima do Limite de Tolerância
      </Badge>
    );
  }
  if (status === 'action') {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900">
        Nível de Ação
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-normal">Normal</Badge>
  );
}

const METABOLIC_PRESETS = [
  { label: 'Sentado em repouso (115 W)', value: 115 },
  { label: 'Trabalho leve (180 W)', value: 180 },
  { label: 'Trabalho moderado (300 W)', value: 300 },
  { label: 'Trabalho pesado (415 W)', value: 415 },
  { label: 'Trabalho muito pesado (520 W)', value: 520 },
];

export default function HeatStress() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: ships = [], isLoading: shipsLoading } = useShips();

  const [shipId, setShipId] = useState<string>('');
  const [sector, setSector] = useState('');
  const [envType, setEnvType] = useState<EnvType>('no_solar');
  const [tbn, setTbn] = useState('');
  const [tg, setTg] = useState('');
  const [tbs, setTbs] = useState('');
  const [metabolicPreset, setMetabolicPreset] = useState<string>('180');
  const [metabolicCustom, setMetabolicCustom] = useState('');

  useEffect(() => {
    if (!shipId && ships.length > 0) setShipId(ships[0].id);
  }, [ships, shipId]);

  const metabolic = metabolicCustom ? Number(metabolicCustom) : Number(metabolicPreset);

  const ibutg = useMemo(() => {
    const a = Number(tbn);
    const b = Number(tg);
    const c = Number(tbs);
    if (!a || !b) return null;
    if (envType === 'with_solar') {
      if (!c) return null;
      return Number((0.7 * a + 0.2 * b + 0.1 * c).toFixed(2));
    }
    return Number((0.7 * a + 0.3 * b).toFixed(2));
  }, [tbn, tg, tbs, envType]);

  const livePreviewStatus = ibutg !== null && metabolic > 0 ? classifyNho(ibutg, metabolic) : null;

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
      if (!shipId) throw new Error('Selecione um navio');
      if (!sector.trim()) throw new Error('Informe o setor');
      if (ibutg === null) throw new Error('Preencha as temperaturas');
      if (!metabolic || metabolic <= 0) throw new Error('Informe a taxa metabólica');

      const payload = {
        ship_id: shipId,
        organization_id: organization?.id || null,
        sector: sector.trim(),
        environment_type: envType,
        tbn: Number(tbn),
        tg: Number(tg),
        tbs: envType === 'with_solar' ? Number(tbs) : null,
        metabolic_rate: metabolic,
        ibutg,
        nho_status: classifyNho(ibutg, metabolic),
        created_by: user?.id || null,
      };

      const { error } = await (supabase as any)
        .from('heat_stress_measurements')
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Medição registrada', description: 'Heat stress salvo com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['heat-stress-measurements', shipId] });
      setSector('');
      setTbn(''); setTg(''); setTbs('');
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        icon={Thermometer}
        title="Heat Stress"
        subtitle="Monitoramento de exposição ao calor — NHO 06 / FUNDACENTRO"
      />

      {/* FORMULÁRIO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nova Medição</CardTitle>
          <CardDescription>
            Registre as temperaturas no ponto de medição. O IBUTG é calculado em tempo real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Navio</Label>
              <Select value={shipId} onValueChange={setShipId} disabled={shipsLoading}>
                <SelectTrigger><SelectValue placeholder="Selecione o navio" /></SelectTrigger>
                <SelectContent>
                  {ships.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Setor / Área</Label>
              <Input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Ex.: Praça de Máquinas"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Ambiente</Label>
              <Select value={envType} onValueChange={(v) => setEnvType(v as EnvType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_solar">Interno ou Externo sem carga solar</SelectItem>
                  <SelectItem value="with_solar">Externo com carga solar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <TempInput
              icon={Thermometer}
              label="Tbn (°C)"
              hint="Bulbo úmido natural"
              value={tbn}
              onChange={setTbn}
            />
            <TempInput
              icon={Flame}
              label="Tg (°C)"
              hint="Temperatura de globo"
              value={tg}
              onChange={setTg}
            />
            <TempInput
              icon={Sun}
              label="Tbs (°C)"
              hint="Bulbo seco"
              value={tbs}
              onChange={setTbs}
              disabled={envType !== 'with_solar'}
            />
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                Taxa Metabólica (W)
              </Label>
              <Select
                value={metabolicCustom ? 'custom' : metabolicPreset}
                onValueChange={(v) => {
                  if (v === 'custom') { setMetabolicCustom(String(metabolic || '')); }
                  else { setMetabolicCustom(''); setMetabolicPreset(v); }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METABOLIC_PRESETS.map(p => (
                    <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                  ))}
                  <SelectItem value="custom">Personalizado…</SelectItem>
                </SelectContent>
              </Select>
              {metabolicCustom !== '' && (
                <Input
                  type="number"
                  min={0}
                  value={metabolicCustom}
                  onChange={(e) => setMetabolicCustom(e.target.value)}
                  placeholder="W"
                />
              )}
            </div>
          </div>

          {/* IBUTG ao vivo */}
          <div className="rounded-lg border bg-muted/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">IBUTG calculado</p>
              <p className="text-3xl font-semibold tabular-nums">
                {ibutg !== null ? `${ibutg.toFixed(2)} °C` : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {envType === 'with_solar'
                  ? 'Fórmula: 0,7·Tbn + 0,2·Tg + 0,1·Tbs'
                  : 'Fórmula: 0,7·Tbn + 0,3·Tg'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {livePreviewStatus && statusBadge(livePreviewStatus)}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || ibutg === null || !sector.trim() || !shipId}
            >
              {saveMutation.isPending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Save className="h-4 w-4 mr-2" />}
              Calcular e Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* HISTÓRICO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Medições</CardTitle>
          <CardDescription>
            {ships.find(s => s.id === shipId)?.name || 'Selecione um navio'} — últimas 200 medições
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Tbn</TableHead>
                  <TableHead className="text-right">Tg</TableHead>
                  <TableHead className="text-right">Tbs</TableHead>
                  <TableHead className="text-right">IBUTG</TableHead>
                  <TableHead className="text-right">Taxa (W)</TableHead>
                  <TableHead>Status NHO 06</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {measurementsLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : measurements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      Nenhuma medição registrada para este navio.
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

function TempInput({
  icon: Icon, label, hint, value, onChange, disabled,
}: {
  icon: typeof Thermometer;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      <Input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={disabled ? '—' : '0.0'}
      />
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
