import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

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
}

export function useObsDatasets() {
  const { organization } = useOrganization();
  return useQuery({
    queryKey: ['obs-datasets', organization?.id],
    enabled: !!organization?.id,
    queryFn: async (): Promise<ObsDataset[]> => {
      const { data, error } = await supabase
        .from('obs_card_datasets' as any)
        .select('*')
        .eq('organization_id', organization!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
  });
}

export function useObsCards(datasetId: string | null) {
  const [data, setData] = useState<ObsCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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

      setIsLoading(true);
      setIsFetching(true);

      const all: ObsCard[] = [];
      const pageSize = 1000;
      let from = 0;
      let expectedCount: number | null = null;

      try {
        while (!cancelled) {
          const query = supabase
            .from('obs_cards' as any)
            .select('*', expectedCount === null ? { count: 'exact' } : undefined)
            .eq('dataset_id', datasetId)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, from + pageSize - 1);

          const { data: batch, error: batchError, count } = await query;

          if (batchError) throw batchError;
          if (expectedCount === null) expectedCount = count;

          const rows = (batch || []) as any as ObsCard[];
          all.push(...rows);

          if (cancelled) return;

          const isFirstBatch = from === 0;
          const loadedAllKnownRows = expectedCount !== null && all.length >= expectedCount;
          const reachedLastPage = rows.length < pageSize;
          const shouldFlush = isFirstBatch || loadedAllKnownRows || reachedLastPage || all.length % 5000 === 0;

          if (shouldFlush) setData([...all]);
          if (isFirstBatch) setIsLoading(false);

          if (loadedAllKnownRows || reachedLastPage) break;

          from += pageSize;
          await new Promise((resolve) => window.setTimeout(resolve, 0));
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
  }, [datasetId]);

  return { data, isLoading, isFetching, error };
}
