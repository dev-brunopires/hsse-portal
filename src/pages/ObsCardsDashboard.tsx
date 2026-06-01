import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShieldAlert, Upload, Database, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, Activity, Users, FileDown, Flame,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LabelList,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ModernKPICard } from '@/components/dashboard/ModernKPICard';
import { fetchAllObsCards, useObsDatasets, useObsCards, type ObsCard } from '@/hooks/useObsCards';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';
import { ClassifyDatasetButton } from '@/components/obs-cards/ClassifyDatasetButton';
import { exportObsCardsConsolidated, exportObsCardsBySector } from '@/utils/obsCardsPdfExport';
import { getObsCardTimeToCloseStats, getObsCardWeight } from '@/utils/obsCardsSummary';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import i18n from '@/i18n';

const PALETTE = [
  'hsl(207 80% 35%)',
  'hsl(14 87% 55%)',
  'hsl(204 56% 46%)',
  'hsl(45 90% 55%)',
  'hsl(160 60% 40%)',
  'hsl(280 60% 55%)',
  'hsl(0 70% 55%)',
];

const RISK_COLOR: Record<string, string> = {
  low: 'hsl(160 60% 40%)',
  medium: 'hsl(45 90% 55%)',
  high: 'hsl(25 90% 50%)',
  critical: 'hsl(0 75% 50%)',
};

type Period = 'month' | 'quarter' | 'year';

type Filters = {
  type: 'ALL' | 'BCO' | 'PSO';
  area: string;
  department: string;
  status: string;
  severity: string;
  riskLevel: string;
  period: Period;
};

const DEFAULT_FILTERS: Filters = {
  type: 'ALL',
  area: 'ALL',
  department: 'ALL',
  status: 'ALL',
  severity: 'ALL',
  riskLevel: 'ALL',
  period: 'month',
};

const getDateLocale = () => (i18n.language === 'en' ? enUS : ptBR);

function applyFilters(cards: ObsCard[], f: Filters): ObsCard[] {
  return cards.filter((c) => {
    if (f.type !== 'ALL' && c.obs_type !== f.type) return false;
    if (f.area !== 'ALL' && (c.area || '') !== f.area) return false;
    if (f.department !== 'ALL' && (c.department || '') !== f.department) return false;
    if (f.status !== 'ALL' && c.status !== f.status) return false;
    if (f.severity !== 'ALL' && c.severity !== f.severity) return false;
    if (f.riskLevel !== 'ALL' && (c.ai_risk_level || '') !== f.riskLevel) return false;
    return true;
  });
}

function groupCount<T extends Partial<ObsCard>>(items: T[], key: (i: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = (key(it) || '—').toString().trim() || '—';
    map.set(k, (map.get(k) || 0) + getObsCardWeight(it));
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function periodKey(c: ObsCard, p: Period): { key: string; label: string } | null {
  if (!c.year) return null;
  if (p === 'year') return { key: `${c.year}`, label: `${c.year}` };
  if (p === 'quarter') {
    if (!c.month) return null;
    const q = Math.floor((c.month - 1) / 3) + 1;
    return { key: `${c.year}-Q${q}`, label: `Q${q}/${c.year}` };
  }
  if (!c.month) return null;
  const d = new Date(c.year, c.month - 1, 1);
  return {
    key: `${c.year}-${String(c.month).padStart(2, '0')}`,
    label: format(d, 'MMM/yyyy', { locale: getDateLocale() }),
  };
}

export default function ObsCardsDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const branding = useOrganizationBranding();
  const { data: datasets, isLoading: dsLoading } = useObsDatasets();
  const [datasetId, setDatasetId] = useState<string | null>(params.get('dataset'));
  const currentDataset = useMemo(
    () => datasets?.find((d) => d.id === datasetId) || null,
    [datasets, datasetId],
  );
  const { data: cards, isLoading: cardsLoading, isFetching: cardsFetching, error: cardsError } = useObsCards(datasetId, currentDataset);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  useEffect(() => {
    if (!datasetId && datasets && datasets.length > 0) {
      const first = datasets.find((d) => d.status === 'ready');
      if (first) {
        setDatasetId(first.id);
        setParams({ dataset: first.id }, { replace: true });
      }
    }
  }, [datasets, datasetId, setParams]);

  const filtered = useMemo(() => (cards ? applyFilters(cards, filters) : []), [cards, filters]);
  const stats = useMemo(() => {
    const total = filtered.reduce((sum, c) => sum + getObsCardWeight(c), 0);
    const safe = filtered.filter((c) => c.status === 'SAFE').reduce((sum, c) => sum + getObsCardWeight(c), 0);
    const unsafe = filtered.filter((c) => c.status === 'UNSAFE').reduce((sum, c) => sum + getObsCardWeight(c), 0);
    const bco = filtered.filter((c) => c.obs_type === 'BCO').reduce((sum, c) => sum + getObsCardWeight(c), 0);
    const pso = filtered.filter((c) => c.obs_type === 'PSO').reduce((sum, c) => sum + getObsCardWeight(c), 0);
    const open = filtered.filter((c) => c.is_open).reduce((sum, c) => sum + getObsCardWeight(c), 0);
    const closed = total - open;
    const ttc = filtered.reduce((acc, c) => {
      const item = getObsCardTimeToCloseStats(c);
      return { sum: acc.sum + item.sum, count: acc.count + item.count };
    }, { sum: 0, count: 0 });
    const avgTtc = ttc.count ? Math.round(ttc.sum / ttc.count) : 0;
    const critical = filtered.filter((c) => c.ai_risk_level === 'critical').reduce((sum, c) => sum + getObsCardWeight(c), 0);
    const high = filtered.filter((c) => c.ai_risk_level === 'high').reduce((sum, c) => sum + getObsCardWeight(c), 0);
    return { total, safe, unsafe, bco, pso, open, closed, avgTtc, critical, high };
  }, [filtered]);

  // Time-aggregated series respecting period selector
  const trend = useMemo(() => {
    const map = new Map<string, { name: string; BCO: number; PSO: number; UNSAFE: number; total: number }>();
    for (const c of filtered) {
      const pk = periodKey(c, filters.period);
      if (!pk) continue;
      if (!map.has(pk.key)) map.set(pk.key, { name: pk.label, BCO: 0, PSO: 0, UNSAFE: 0, total: 0 });
      const e = map.get(pk.key)!;
      e.total++;
      if (c.obs_type === 'BCO') e.BCO++;
      if (c.obs_type === 'PSO') e.PSO++;
      if (c.status === 'UNSAFE') e.UNSAFE++;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [filtered, filters.period]);

  // Severity by period (stacked)
  const severityOverTime = useMemo(() => {
    const map = new Map<string, { name: string; low: number; medium: number; high: number; critical: number }>();
    for (const c of filtered) {
      const pk = periodKey(c, filters.period);
      if (!pk) continue;
      if (!map.has(pk.key)) map.set(pk.key, { name: pk.label, low: 0, medium: 0, high: 0, critical: 0 });
      const e = map.get(pk.key)!;
      const lvl = (c.ai_risk_level || 'medium') as keyof typeof RISK_COLOR;
      if (lvl === 'low' || lvl === 'medium' || lvl === 'high' || lvl === 'critical') e[lvl]++;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [filtered, filters.period]);

  // Risk type ranking — IA only (no "Other")
  const byRiskType = useMemo(
    () => groupCount(filtered.filter((c) => !!c.ai_category), (c) => c.ai_category)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12),
    [filtered],
  );

  const byRiskLevel = useMemo(() => {
    const out = [
      { name: t('obsCards.riskLevel.low'), key: 'low', value: filtered.filter((c) => c.ai_risk_level === 'low').length },
      { name: t('obsCards.riskLevel.medium'), key: 'medium', value: filtered.filter((c) => c.ai_risk_level === 'medium').length },
      { name: t('obsCards.riskLevel.high'), key: 'high', value: filtered.filter((c) => c.ai_risk_level === 'high').length },
      { name: t('obsCards.riskLevel.critical'), key: 'critical', value: filtered.filter((c) => c.ai_risk_level === 'critical').length },
    ];
    return out.filter((o) => o.value > 0);
  }, [filtered, t]);

  const byArea = useMemo(
    () => groupCount(filtered, (c) => c.area).sort((a, b) => b.value - a.value).slice(0, 12),
    [filtered],
  );
  const byDept = useMemo(
    () => groupCount(filtered, (c) => c.department).sort((a, b) => b.value - a.value).slice(0, 12),
    [filtered],
  );
  const typeDist = useMemo(() => [
    { name: 'BCO', value: stats.bco },
    { name: 'PSO', value: stats.pso },
  ], [stats]);

  const allAreas = useMemo(
    () => Array.from(new Set((cards || []).map((c) => c.area).filter(Boolean))) as string[],
    [cards],
  );
  const allDepts = useMemo(
    () => Array.from(new Set((cards || []).map((c) => c.department).filter(Boolean))) as string[],
    [cards],
  );

  const sectorsForPdf = useMemo(
    () => Array.from(new Set((cards || []).map((c) => c.area).filter(Boolean))).sort() as string[],
    [cards],
  );

  const handleExportConsolidated = async () => {
    if (!currentDataset) return;
    await exportObsCardsConsolidated(filtered, {
      datasetName: currentDataset.name,
      branding,
    });
  };

  const handleExportSector = async (sector: string) => {
    if (!currentDataset || !cards) return;
    await exportObsCardsBySector(cards, sector, {
      datasetName: currentDataset.name,
      branding,
    });
  };

  if (dsLoading) {
    return <div className="p-12 flex justify-center"><Spinner size="lg" /></div>;
  }

  if (!datasets || datasets.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ShieldAlert} title={t('obsCards.title')} subtitle={t('obsCards.subtitle')} />
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="mb-4">{t('obsCards.empty.uploadFirst')}</p>
            <Button onClick={() => navigate('/obs-cards/upload')}>
              <Upload className="h-4 w-4 mr-2" />
              {t('obsCards.datasets.newUpload')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldAlert}
        title={t('obsCards.title')}
        subtitle={t('obsCards.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            {datasetId && <ClassifyDatasetButton datasetId={datasetId} />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!currentDataset || filtered.length === 0 || cardsFetching}>
                  <FileDown className="h-4 w-4 mr-2" />
                  {t('obsCards.pdf.exportButton')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={handleExportConsolidated}>
                  <FileDown className="h-4 w-4 mr-2" />
                  {t('obsCards.pdf.consolidated')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Database className="h-4 w-4 mr-2" />
                    {t('obsCards.pdf.bySector')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                    {sectorsForPdf.length === 0 ? (
                      <DropdownMenuItem disabled>{t('obsCards.empty.noData')}</DropdownMenuItem>
                    ) : (
                      sectorsForPdf.map((s) => (
                        <DropdownMenuItem key={s} onClick={() => handleExportSector(s)}>
                          {s}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => navigate('/obs-cards/datasets')}>
              <Database className="h-4 w-4 mr-2" />
              {t('obsCards.nav.datasets')}
            </Button>
            <Button size="sm" onClick={() => navigate('/obs-cards/upload')}>
              <Upload className="h-4 w-4 mr-2" />
              {t('obsCards.datasets.newUpload')}
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('obsCards.filters.dataset')}</label>
              <Select value={datasetId || ''} onValueChange={(v) => { setDatasetId(v); setParams({ dataset: v }, { replace: true }); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {datasets.filter((d) => d.status === 'ready').map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('obsCards.filters.period')}</label>
              <Select value={filters.period} onValueChange={(v: Period) => setFilters({ ...filters, period: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">{t('obsCards.period.month')}</SelectItem>
                  <SelectItem value="quarter">{t('obsCards.period.quarter')}</SelectItem>
                  <SelectItem value="year">{t('obsCards.period.year')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('obsCards.filters.type')}</label>
              <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v as Filters['type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('obsCards.filters.all')}</SelectItem>
                  <SelectItem value="BCO">BCO</SelectItem>
                  <SelectItem value="PSO">PSO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('obsCards.filters.status')}</label>
              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('obsCards.filters.all')}</SelectItem>
                  <SelectItem value="SAFE">SAFE</SelectItem>
                  <SelectItem value="UNSAFE">UNSAFE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('obsCards.filters.area')}</label>
              <Select value={filters.area} onValueChange={(v) => setFilters({ ...filters, area: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('obsCards.filters.all')}</SelectItem>
                  {allAreas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('obsCards.filters.department')}</label>
              <Select value={filters.department} onValueChange={(v) => setFilters({ ...filters, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('obsCards.filters.all')}</SelectItem>
                  {allDepts.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('obsCards.filters.riskLevel')}</label>
              <Select value={filters.riskLevel} onValueChange={(v) => setFilters({ ...filters, riskLevel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('obsCards.filters.all')}</SelectItem>
                  <SelectItem value="low">{t('obsCards.riskLevel.low')}</SelectItem>
                  <SelectItem value="medium">{t('obsCards.riskLevel.medium')}</SelectItem>
                  <SelectItem value="high">{t('obsCards.riskLevel.high')}</SelectItem>
                  <SelectItem value="critical">{t('obsCards.riskLevel.critical')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {cardsError && (!cards || cards.length === 0) ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>{t('common.errorLoadingData')}</p>
          </CardContent>
        </Card>
      ) : cardsLoading ? (
        <div className="p-12 flex justify-center"><Spinner size="lg" /></div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
            <TabsTrigger value="overview">{t('obsCards.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="risk">{t('obsCards.tabs.risk')}</TabsTrigger>
            <TabsTrigger value="areas">{t('obsCards.tabs.areas')}</TabsTrigger>
            <TabsTrigger value="performance">{t('obsCards.tabs.performance')}</TabsTrigger>
            <TabsTrigger value="bco-pso">BCO / PSO</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ModernKPICard title={t('obsCards.kpis.total')} value={stats.total} icon={Activity} variant="info" />
              <ModernKPICard title={t('obsCards.kpis.safe')} value={stats.safe} icon={CheckCircle2} variant="success" />
              <ModernKPICard title={t('obsCards.kpis.unsafe')} value={stats.unsafe} icon={AlertTriangle} variant="danger" />
              <ModernKPICard title={t('obsCards.kpis.open')} value={stats.open} icon={TrendingUp} variant="warning" />
              <ModernKPICard title={t('obsCards.kpis.bco')} value={stats.bco} icon={Users} variant="default" />
              <ModernKPICard title={t('obsCards.kpis.pso')} value={stats.pso} icon={ShieldAlert} variant="default" />
              <ModernKPICard title={t('obsCards.riskLevel.critical')} value={stats.critical} icon={Flame} variant="danger" />
              <ModernKPICard
                title={t('obsCards.kpis.avgClosingTime')}
                value={`${stats.avgTtc} ${t('obsCards.kpis.days')}`}
                icon={Clock}
                variant="info"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle>{t('obsCards.charts.trend')}</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id="gBco" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={PALETTE[0]} stopOpacity={0.7} />
                          <stop offset="95%" stopColor={PALETTE[0]} stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="gPso" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={PALETTE[1]} stopOpacity={0.7} />
                          <stop offset="95%" stopColor={PALETTE[1]} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="BCO" stackId="1" stroke={PALETTE[0]} fill="url(#gBco)" />
                      <Area type="monotone" dataKey="PSO" stackId="1" stroke={PALETTE[1]} fill="url(#gPso)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('obsCards.charts.typeDistribution')}</CardTitle></CardHeader>
                <CardContent className="h-72 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typeDist} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                        {typeDist.map((_, i) => <Cell key={i} fill={PALETTE[i]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-6">
                    <div className="text-3xl font-bold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">{t('obsCards.kpis.total')}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('obsCards.charts.severityOverTime')}</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={severityOverTime}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="low" stackId="s" fill={RISK_COLOR.low} name={t('obsCards.riskLevel.low')} />
                      <Bar dataKey="medium" stackId="s" fill={RISK_COLOR.medium} name={t('obsCards.riskLevel.medium')} />
                      <Bar dataKey="high" stackId="s" fill={RISK_COLOR.high} name={t('obsCards.riskLevel.high')} />
                      <Bar dataKey="critical" stackId="s" fill={RISK_COLOR.critical} name={t('obsCards.riskLevel.critical')} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('obsCards.charts.byRiskLevel')}</CardTitle></CardHeader>
                <CardContent className="h-72 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byRiskLevel} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                        {byRiskLevel.map((d) => <Cell key={d.key} fill={RISK_COLOR[d.key]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* RISK TYPES */}
          <TabsContent value="risk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('obsCards.charts.byRiskType')}</CardTitle>
              </CardHeader>
              <CardContent className="h-[500px]">
                {byRiskType.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Sparkle />
                    <p className="mt-2">{t('obsCards.pdf.noAiData')}</p>
                    <p className="text-xs mt-1">{t('obsCards.charts.runAiFirst')}</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byRiskType} layout="vertical" margin={{ left: 140, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" fontSize={12} />
                      <YAxis type="category" dataKey="name" fontSize={11} width={140} />
                      <Tooltip />
                      <Bar dataKey="value" fill={PALETTE[0]} radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="value" position="right" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AREAS */}
          <TabsContent value="areas">
            <Card>
              <CardHeader><CardTitle>{t('obsCards.charts.topAreas')}</CardTitle></CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byArea} layout="vertical" margin={{ left: 100, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" fontSize={12} />
                    <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                    <Tooltip />
                    <Bar dataKey="value" fill={PALETTE[1]} radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="value" position="right" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PERFORMANCE */}
          <TabsContent value="performance">
            <Card>
              <CardHeader><CardTitle>{t('obsCards.charts.performanceRanking')}</CardTitle></CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDept} layout="vertical" margin={{ left: 100, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" fontSize={12} />
                    <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                    <Tooltip />
                    <Bar dataKey="value" fill={PALETTE[2]} radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="value" position="right" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BCO/PSO compare */}
          <TabsContent value="bco-pso">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SubsetView cards={filtered.filter((c) => c.obs_type === 'BCO')} label="BCO" />
              <SubsetView cards={filtered.filter((c) => c.obs_type === 'PSO')} label="PSO" />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Sparkle() {
  return <ShieldAlert className="h-10 w-10 opacity-40" />;
}

function SubsetView({ cards, label }: { cards: ObsCard[]; label: string }) {
  const { t } = useTranslation();
  const byRisk = useMemo(
    () => groupCount(cards.filter((c) => !!c.ai_category), (c) => c.ai_category)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    [cards],
  );

  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          {t('obsCards.empty.noData')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label} — {t('obsCards.charts.byRiskType')}</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byRisk} layout="vertical" margin={{ left: 100, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis type="number" fontSize={11} />
            <YAxis type="category" dataKey="name" fontSize={10} width={120} />
            <Tooltip />
            <Bar dataKey="value" fill={PALETTE[0]} radius={[0, 4, 4, 0]}>
              <LabelList dataKey="value" position="right" fontSize={10} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
