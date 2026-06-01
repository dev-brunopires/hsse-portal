import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  buildObsCardsDashboardSummary,
  getObsCardsDashboardSummary,
  summaryToObsCards,
  withObsCardsDashboardSummary,
} from '@/utils/obsCardsSummary';

export interface ObsDataset {
  id: string;
  organization_id: string;
  name: string;
  original_filename: string | null;
  row_count: number;
  status: string;
  uploaded_by_name: string | null;
  uploaded_by: string | null;
  created_at: string;
  error_message: string | null;
  column_mapping: unknown;
}

export interface ObsCard {
  id: string;
  dataset_id: string;
  organization_id: string;
  obs_type: string | null;
  status: string | null;
  creation_date: string | null;
  area: string | null;
  department: string | null;
  description: string | null;
  action_taken: string | null;
  responsible: string | null;
  due_date: string | null;
  close_date: string | null;
  category: string | null;
  ai_category: string | null;
  ai_risk_level: string | null;
  ai_reasoning: string | null;
  severity: string | null;
  time_to_close_days: number | null;
  is_open: boolean | null;
  month: number | null;
  year: number | null;
  __summary_count?: number;
  __summary_time_to_close_sum?: number;
  __summary_time_to_close_count?: number;
}

async function fetchObsCardsPage(datasetId: string, from: number, pageSize: number): Promise<ObsCard[]> {
  const { data, error } = await supabase
    .from('obs_cards')
    .select('*')
    .eq('dataset_id', datasetId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return (data || []) as unknown as ObsCard[];
}

export async function fetchAllObsCards(datasetId: string): Promise<ObsCard[]> {
  const all: ObsCard[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const rows = await fetchObsCardsPage(datasetId, from, pageSize);
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  return all;
}

export function useObsDatasets() {
  const { organization } = useOrganization();
  return useQuery({
    queryKey: ['obs-datasets', organization?.id],
    enabled: !!organization?.id,
    queryFn: async (): Promise<ObsDataset[]> => {
      const { data, error } = await supabase
        .from('obs_card_datasets')
        .select('*')
        .eq('organization_id', organization!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ObsDataset[];
    },
  });
}

export function useObsCards(datasetId: string | null, dataset?: ObsDataset | null) {
  const [data, setData] = useState<ObsCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [rebuildSummaryKey, setRebuildSummaryKey] = useState(0);

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ datasetId?: string; rebuildSummary?: boolean }>).detail;
      const targetDatasetId = detail?.datasetId;
      if (!targetDatasetId || targetDatasetId === datasetId) {
        setReloadKey((value) => value + 1);
        if (detail?.rebuildSummary) setRebuildSummaryKey((value) => value + 1);
      }
    };

    window.addEventListener('obs-cards:refresh', handleRefresh);
    return () => window.removeEventListener('obs-cards:refresh', handleRefresh);
  }, [datasetId]);

  useEffect(() => {
    let cancelled = false;

    async function loadCards() {
      setData([]);
      setError(null);

      if (!datasetId) {
        setIsLoading(false);
        setIsFetching(false);
        return;
      }

      const savedSummary = rebuildSummaryKey === 0 ? getObsCardsDashboardSummary(dataset?.column_mapping) : null;
      if (savedSummary) {
        setData(summaryToObsCards(savedSummary, { datasetId, organizationId: dataset?.organization_id }));
        setIsLoading(false);
        setIsFetching(false);
        return;
      }

      setIsLoading(true);
      setIsFetching(true);

      const all: ObsCard[] = [];
      const pageSize = 1000;
      let from = 0;

      try {
        while (!cancelled) {
          const rows = await fetchObsCardsPage(datasetId, from, pageSize);
          all.push(...rows);

          if (cancelled) return;

          const isFirstBatch = from === 0;
          const reachedLastPage = rows.length < pageSize;
          const shouldFlush = isFirstBatch || reachedLastPage || all.length % 5000 === 0;

          if (shouldFlush) setData([...all]);
          if (isFirstBatch) setIsLoading(false);

          if (reachedLastPage) break;

          from += pageSize;
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }

        if (!cancelled && all.length > 0) {
          const summary = buildObsCardsDashboardSummary(all);
          setData(summaryToObsCards(summary, { datasetId, organizationId: dataset?.organization_id }));
          await supabase
            .from('obs_card_datasets')
            .update({ column_mapping: withObsCardsDashboardSummary(dataset?.column_mapping, summary) })
            .eq('id', datasetId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load OBS cards'));
          if (all.length > 0) setData([...all]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsFetching(false);
        }
      }
    }

    loadCards();

    return () => {
      cancelled = true;
    };
  }, [datasetId, dataset?.column_mapping, dataset?.organization_id, reloadKey, rebuildSummaryKey]);

  return { data, isLoading, isFetching, error };
}
