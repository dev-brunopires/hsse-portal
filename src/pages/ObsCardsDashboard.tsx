import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShieldAlert, Upload, Database, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, Activity, Users,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ModernKPICard } from '@/components/dashboard/ModernKPICard';
import { useObsDatasets, useObsCards, type ObsCard } from '@/hooks/useObsCards';

const PALETTE = ['hsl(207 80% 35%)', 'hsl(14 87% 55%)', 'hsl(204 56% 46%)', 'hsl(45 90% 55%)', 'hsl(160 60% 40%)', 'hsl(280 60% 55%)', 'hsl(0 70% 55%)'];

type Filters = {
  type: 'ALL' | 'BCO' | 'PSO';
  area: string;
  department: string;
  status: string;
  severity: string;
};

const DEFAULT_FILTERS: Filters = {
  type: 'ALL',
  area: 'ALL',
  department: 'ALL',
  status: 'ALL',
  severity: 'ALL',
};

function applyFilters(cards: ObsCard[], f: Filters): ObsCard[] {
  return cards.filter((c) => {
    if (f.type !== 'ALL' && c.obs_type !== f.type) return false;
    if (f.area !== 'ALL' && (c.area || '') !== f.area) return false;
    if (f.department !== 'ALL' && (c.department || '') !== f.department) return false;
    if (f.status !== 'ALL' && c.status !== f.status) return false;
    if (f.severity !== 'ALL' && c.severity !== f.severity) return false;
    return true;
  });
}

function groupCount<T>(items: T[], key: (i: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = key(it) || '—';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

export default function ObsCardsDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: datasets, isLoading: dsLoading } = useObsDatasets();
  const [datasetId, setDatasetId] = useState<string | null>(params.get('dataset'));
  const { data: cards, isLoading: cardsLoading } = useObsCards(datasetId);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Pick first ready dataset if none selected
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
    const total = filtered.length;
    const safe = filtered.filter((c) => c.status === 'SAFE').length;
    const unsafe = filtered.filter((c) => c.status === 'UNSAFE').length;
    const bco = filtered.filter((c) => c.obs_type === 'BCO').length;
    const pso = filtered.filter((c) => c.obs_type === 'PSO').length;
    const open = filtered.filter((c) => c.is_open).length;
    const closed = total - open;
    const ttcArr = filtered.map((c) => c.time_to_close_days).filter((v): v is number => v != null);
    const avgTtc = ttcArr.length ? Math.round(ttcArr.reduce((a, b) => a + b, 0) / ttcArr.length) : 0;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = filtered.filter((c) => c.is_open && c.due_date && c.due_date < today).length;
    return { total, safe, unsafe, bco, pso, open, closed, avgTtc, overdue };
  }, [filtered]);

  const monthly = useMemo(() => {
    const map = new Map<string, { name: string; BCO: number; PSO: number }>();
    for (const c of filtered) {
      if (!c.year || !c.month) continue;
      const key = `${c.year}-${String(c.month).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { name: key, BCO: 0, PSO: 0 });
      const entry = map.get(key)!;
      if (c.obs_type === 'BCO') entry.BCO++;
      if (c.obs_type === 'PSO') entry.PSO++;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const byCategory = useMemo(() => groupCount(filtered, (c) => c.category).sort((a, b) => b.value - a.value), [filtered]);
  const byArea = useMemo(() => groupCount(filtered, (c) => c.area).sort((a, b) => b.value - a.value).slice(0, 10), [filtered]);
  const byDept = useMemo(() => groupCount(filtered, (c) => c.department).sort((a, b) => b.value - a.value).slice(0, 10), [filtered]);
  const bySeverity = useMemo(() => groupCount(filtered, (c) => c.severity), [filtered]);
  const typeDist = useMemo(() => [
    { name: 'BCO', value: stats.bco },
    { name: 'PSO', value: stats.pso },
  ], [stats]);

  const allAreas = useMemo(() => Array.from(new Set((cards || []).map((c) => c.area).filter(Boolean))) as string[], [cards]);
  const allDepts = useMemo(() => Array.from(new Set((cards || []).map((c) => c.department).filter(Boolean))) as string[], [cards]);

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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/obs-cards/datasets')}>
              <Database className="h-4 w-4 mr-2" />
              {t('obsCards.nav.datasets')}
            </Button>
            <Button onClick={() => navigate('/obs-cards/upload')}>
              <Upload className="h-4 w-4 mr-2" />
              {t('obsCards.datasets.newUpload')}
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
              <label className="text-xs text-muted-foreground mb-1 block">{t('obsCards.filters.type')}</label>
              <Select value={filters.type} onValueChange={(v: any) => setFilters({ ...filters, type: v })}>
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
              <label className="text-xs text-muted-foreground mb-1 block">{t('obsCards.filters.severity')}</label>
              <Select value={filters.severity} onValueChange={(v) => setFilters({ ...filters, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('obsCards.filters.all')}</SelectItem>
                  <SelectItem value="low">{t('obsCards.severity.low')}</SelectItem>
                  <SelectItem value="medium">{t('obsCards.severity.medium')}</SelectItem>
                  <SelectItem value="high">{t('obsCards.severity.high')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {cardsLoading ? (
        <div className="p-12 flex justify-center"><Spinner size="lg" /></div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
            <TabsTrigger value="overview">{t('obsCards.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="bco">{t('obsCards.tabs.bco')}</TabsTrigger>
            <TabsTrigger value="pso">{t('obsCards.tabs.pso')}</TabsTrigger>
            <TabsTrigger value="areas">{t('obsCards.tabs.areas')}</TabsTrigger>
            <TabsTrigger value="performance">{t('obsCards.tabs.performance')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ModernKPICard title={t('obsCards.kpis.total')} value={stats.total} icon={Activity} variant="info" />
              <ModernKPICard title={t('obsCards.kpis.safe')} value={stats.safe} icon={CheckCircle2} variant="success" />
              <ModernKPICard title={t('obsCards.kpis.unsafe')} value={stats.unsafe} icon={AlertTriangle} variant="danger" />
              <ModernKPICard title={t('obsCards.kpis.overdue')} value={stats.overdue} icon={Clock} variant="warning" />
              <ModernKPICard title={t('obsCards.kpis.bco')} value={stats.bco} icon={Users} variant="default" />
              <ModernKPICard title={t('obsCards.kpis.pso')} value={stats.pso} icon={ShieldAlert} variant="default" />
              <ModernKPICard title={t('obsCards.kpis.open')} value={stats.open} icon={TrendingUp} variant="warning" />
              <ModernKPICard
                title={t('obsCards.kpis.avgClosingTime')}
                value={`${stats.avgTtc} ${t('obsCards.kpis.days')}`}
                icon={Clock}
                variant="info"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle>{t('obsCards.charts.monthlyTrend')}</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="BCO" stroke={PALETTE[0]} strokeWidth={2} />
                      <Line type="monotone" dataKey="PSO" stroke={PALETTE[1]} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('obsCards.charts.typeDistribution')}</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typeDist} dataKey="value" nameKey="name" outerRadius={90} label>
                        {typeDist.map((_, i) => <Cell key={i} fill={PALETTE[i]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('obsCards.charts.byCategory')}</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byCategory}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="value" fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t('obsCards.charts.bySeverity')}</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={bySeverity} dataKey="value" nameKey="name" outerRadius={90} label>
                        {bySeverity.map((_, i) => <Cell key={i} fill={PALETTE[i + 2]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="bco">
            <SubsetView cards={filtered.filter((c) => c.obs_type === 'BCO')} />
          </TabsContent>
          <TabsContent value="pso">
            <SubsetView cards={filtered.filter((c) => c.obs_type === 'PSO')} />
          </TabsContent>

          <TabsContent value="areas">
            <Card>
              <CardHeader><CardTitle>{t('obsCards.charts.topAreas')}</CardTitle></CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byArea} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" fontSize={12} />
                    <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                    <Tooltip />
                    <Bar dataKey="value" fill={PALETTE[1]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardHeader><CardTitle>{t('obsCards.charts.performanceRanking')}</CardTitle></CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDept} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" fontSize={12} />
                    <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                    <Tooltip />
                    <Bar dataKey="value" fill={PALETTE[2]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SubsetView({ cards }: { cards: ObsCard[] }) {
  const { t } = useTranslation();
  const byCat = useMemo(() => groupCount(cards, (c) => c.category).sort((a, b) => b.value - a.value), [cards]);
  const byArea = useMemo(() => groupCount(cards, (c) => c.area).sort((a, b) => b.value - a.value).slice(0, 10), [cards]);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle>{t('obsCards.charts.byCategory')}</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCat}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t('obsCards.charts.topAreas')}</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byArea} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="name" fontSize={11} width={100} />
              <Tooltip />
              <Bar dataKey="value" fill={PALETTE[1]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
