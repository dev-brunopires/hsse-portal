import type { ObsCard } from '@/hooks/useObsCards';
import type { Json } from '@/integrations/supabase/types';

const SUMMARY_VERSION = 1;

export type ObsCardsSummaryRow = Pick<
  ObsCard,
  | 'obs_type'
  | 'status'
  | 'area'
  | 'department'
  | 'category'
  | 'ai_category'
  | 'ai_risk_level'
  | 'severity'
  | 'is_open'
  | 'month'
  | 'year'
  | 'ship_name'
> & {
  count: number;
  time_to_close_sum: number;
  time_to_close_count: number;
};

export interface ObsCardsDashboardSummary {
  version: typeof SUMMARY_VERSION;
  generated_at: string;
  rows: ObsCardsSummaryRow[];
}

type SummarySourceCard = Partial<ObsCard> & {
  time_to_close_days?: number | null;
  __summary_count?: number;
  __summary_time_to_close_sum?: number;
  __summary_time_to_close_count?: number;
};

const isObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export function getObsCardWeight(card: Partial<ObsCard>): number {
  const value = (card as SummarySourceCard).__summary_count;
  return typeof value === 'number' && value > 0 ? value : 1;
}

export function getObsCardTimeToCloseStats(card: Partial<ObsCard>) {
  const summary = card as SummarySourceCard;
  if (typeof summary.__summary_time_to_close_count === 'number') {
    return {
      sum: summary.__summary_time_to_close_sum || 0,
      count: summary.__summary_time_to_close_count,
    };
  }

  return typeof card.time_to_close_days === 'number'
    ? { sum: card.time_to_close_days, count: 1 }
    : { sum: 0, count: 0 };
}

export function buildObsCardsDashboardSummary(cards: SummarySourceCard[]): ObsCardsDashboardSummary {
  const groups = new Map<string, ObsCardsSummaryRow>();

  for (const card of cards) {
    const count = getObsCardWeight(card);
    const closeStats = getObsCardTimeToCloseStats(card);
    const key = JSON.stringify([
      card.obs_type || null,
      card.status || null,
      card.area || null,
      card.department || null,
      card.category || null,
      card.ai_category || null,
      card.ai_risk_level || null,
      card.severity || null,
      card.is_open ?? null,
      card.month || null,
      card.year || null,
      card.ship_name || null,
    ]);

    const existing = groups.get(key);
    if (existing) {
      existing.count += count;
      existing.time_to_close_sum += closeStats.sum;
      existing.time_to_close_count += closeStats.count;
      continue;
    }

    groups.set(key, {
      obs_type: card.obs_type || null,
      status: card.status || null,
      area: card.area || null,
      department: card.department || null,
      category: card.category || null,
      ai_category: card.ai_category || null,
      ai_risk_level: card.ai_risk_level || null,
      severity: card.severity || null,
      is_open: card.is_open ?? null,
      month: card.month || null,
      year: card.year || null,
      ship_name: card.ship_name || null,
      count,
      time_to_close_sum: closeStats.sum,
      time_to_close_count: closeStats.count,
    });
  }

  return {
    version: SUMMARY_VERSION,
    generated_at: new Date().toISOString(),
    rows: Array.from(groups.values()),
  };
}

export function getObsCardsDashboardSummary(value: unknown): ObsCardsDashboardSummary | null {
  if (!isObject(value)) return null;
  const summary = value.dashboard_summary;
  if (!isObject(summary) || summary.version !== SUMMARY_VERSION || !Array.isArray(summary.rows)) return null;
  return summary as unknown as ObsCardsDashboardSummary;
}

export function withObsCardsDashboardSummary(value: unknown, summary: ObsCardsDashboardSummary): Json {
  const nextValue = !isObject(value)
    ? { fields: value ?? {}, dashboard_summary: summary }
    : ('dashboard_summary' in value || 'fields' in value)
      ? { ...value, dashboard_summary: summary }
      : { fields: value, dashboard_summary: summary };

  return JSON.parse(JSON.stringify(nextValue)) as Json;
}

export function summaryToObsCards(
  summary: ObsCardsDashboardSummary,
  fallback: { datasetId: string; organizationId?: string | null },
): ObsCard[] {
  return summary.rows.map((row, index) => ({
    id: `summary-${fallback.datasetId}-${index}`,
    dataset_id: fallback.datasetId,
    organization_id: fallback.organizationId || '',
    obs_type: row.obs_type,
    status: row.status,
    creation_date: null,
    area: row.area,
    department: row.department,
    description: null,
    action_taken: null,
    responsible: null,
    due_date: null,
    close_date: null,
    category: row.category,
    ai_category: row.ai_category,
    ai_risk_level: row.ai_risk_level,
    ai_reasoning: null,
    severity: row.severity,
    time_to_close_days: null,
    is_open: row.is_open,
    month: row.month,
    year: row.year,
    ship_name: row.ship_name,
    __summary_count: row.count,
    __summary_time_to_close_sum: row.time_to_close_sum,
    __summary_time_to_close_count: row.time_to_close_count,
  }));
}