import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getEvvCategories, type EvvFormType } from '../catalog';
import type { EvvAnswers, EvvScope } from '../types';

interface Filters {
  environment: string;
  vessel_id: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { environment: 'all', vessel_id: 'all', from: '', to: '' };

interface ReportRow {
  id: string;
  form_type: EvvFormType;
  scope: Pick<EvvScope, 'environment' | 'vessel_ids'>;
  answers: EvvAnswers;
  review_status: string | null;
  submitted_at: string | null;
}

const CHART_COLORS = ['#00569f', '#22c55e', '#f59e0b', '#ef4444', '#64748b'];

export default function EvvReports() {
  const { t } = useTranslation();
  const { organization } = useOrganization();
  const [filters, setFilters] = useState<Filters>(EMPTY);

  const { data: vessels = [] } = useQuery({
    queryKey: ['evv-org-ships', organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('ships')
        .select('id, name')
        .eq('organization_id', organization!.id)
        .order('name');
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ['evv-submissions-report', organization?.id, filters],
    enabled: !!organization?.id,
    queryFn: async () => {
      // The generated database types predate the eV&V migration.
      let q = supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('evv_submissions' as any)
        .select('id, form_type, scope, answers, review_status, submitted_at')
        .eq('organization_id', organization!.id)
        .eq('status', 'completed');
      if (filters.from) q = q.gte('submitted_at', filters.from);
      if (filters.to) q = q.lte('submitted_at', filters.to + 'T23:59:59');
      const { data, error } = await q;
      if (error) return [] as ReportRow[];
      return ((data ?? []) as unknown as ReportRow[]).filter((r) => {
        const s = r.scope;
        if (filters.environment !== 'all' && s.environment !== filters.environment) return false;
        if (filters.vessel_id !== 'all' && !(s.vessel_ids ?? []).includes(filters.vessel_id)) return false;
        return true;
      });
    },
  });

  const summary = useMemo(() => {
    let effective = 0;
    let notEffective = 0;
    let notAssessed = 0;
    const reviewCounts = new Map<string, number>();
    const formCounts = new Map<string, number>();

    rows.forEach((row) => {
      const review = row.review_status ?? 'pending';
      reviewCounts.set(review, (reviewCounts.get(review) ?? 0) + 1);
      formCounts.set(row.form_type, (formCounts.get(row.form_type) ?? 0) + 1);
      Object.values(row.answers ?? {}).forEach((answer) => {
        if (answer.rating === 'effective') effective += 1;
        if (answer.rating === 'not_effective') notEffective += 1;
        if (answer.rating === 'not_assessed') notAssessed += 1;
      });
    });

    return {
      effective,
      notEffective,
      notAssessed,
      pending: reviewCounts.get('pending') ?? 0,
      approved: reviewCounts.get('approved') ?? 0,
      rejected: reviewCounts.get('rejected') ?? 0,
      reviewData: Array.from(reviewCounts.entries()).map(([name, value]) => ({ name: t(`evv.review.${name}`), value })),
      formData: Array.from(formCounts.entries()).map(([name, value]) => ({
        name: t(`evv.forms.${name === 'leaders_engagement' ? 'leaders' : name === 'workers_engagement' ? 'workers' : name}.title`),
        value,
      })),
    };
  }, [rows, t]);

  const chartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const answers = r.answers || {};
      for (const [qid, answer] of Object.entries(answers)) {
        if (answer?.rating !== 'not_effective') continue;
        // find question text
        let label = qid;
        for (const cat of getEvvCategories(r.form_type as EvvFormType)) {
          const q = cat.questions.find((q) => q.id === qid);
          if (q) { label = `${cat.name} — ${q.text.slice(0, 40)}…`; break; }
        }
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} title={t('evv.reports.title')} description={t('evv.reports.subtitle')} />

      <Card>
        <CardHeader><CardTitle>{t('evv.reports.filters')}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label>{t('evv.scope.environment')}</Label>
            <Select value={filters.environment} onValueChange={(v) => setFilters({ ...filters, environment: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="fpso">FPSO</SelectItem>
                <SelectItem value="project">{t('evv.environment.project')}</SelectItem>
                <SelectItem value="office">{t('evv.environment.office')}</SelectItem>
                <SelectItem value="yard">{t('evv.environment.yard')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('evv.scope.vessel')}</Label>
            <Select value={filters.vessel_id} onValueChange={(v) => setFilters({ ...filters, vessel_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {vessels.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('evv.reports.from')}</Label>
            <DatePicker
              value={filters.from}
              onChange={(value) => setFilters({ ...filters, from: value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('evv.reports.to')}</Label>
            <DatePicker
              value={filters.to}
              onChange={(value) => setFilters({ ...filters, to: value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label={t('evv.reports.totalRecords')} value={rows.length} />
        <MetricCard label={t('evv.review.pending')} value={summary.pending} />
        <MetricCard label={t('evv.review.approved')} value={summary.approved} />
        <MetricCard label={t('evv.review.rejected')} value={summary.rejected} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('evv.reports.reviewStatus')}</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={summary.reviewData} dataKey="value" nameKey="name" outerRadius={96} label>
                  {summary.reviewData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('evv.reports.byForm')}</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.formData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('evv.reports.ratingDistribution')}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <MetricCard label={t('evv.rating.effective')} value={summary.effective} tone="success" />
          <MetricCard label={t('evv.rating.not_effective')} value={summary.notEffective} tone="danger" />
          <MetricCard label={t('evv.rating.not_assessed')} value={summary.notAssessed} tone="muted" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('evv.reports.topDeviations')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t('evv.reports.totalSubmissions', { count: rows.length })}
          </p>
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={300} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' | 'muted' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={
          tone === 'success' ? 'mt-2 text-2xl font-semibold text-emerald-600'
            : tone === 'danger' ? 'mt-2 text-2xl font-semibold text-destructive'
              : tone === 'muted' ? 'mt-2 text-2xl font-semibold text-muted-foreground'
                : 'mt-2 text-2xl font-semibold text-foreground'
        }>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
