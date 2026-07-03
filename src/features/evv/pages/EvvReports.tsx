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
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
  submitted_at: string | null;
}

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
        .select('id, form_type, scope, answers, submitted_at')
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
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="office">Office</SelectItem>
                <SelectItem value="yard">Yard</SelectItem>
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
