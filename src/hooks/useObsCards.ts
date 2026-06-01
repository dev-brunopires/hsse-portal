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
  return useQuery({
    queryKey: ['obs-cards', datasetId],
    enabled: !!datasetId,
    queryFn: async (): Promise<ObsCard[]> => {
      const all: ObsCard[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('obs_cards' as any)
          .select('*')
          .eq('dataset_id', datasetId!)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data || []) as any as ObsCard[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });
}
