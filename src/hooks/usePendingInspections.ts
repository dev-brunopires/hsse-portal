import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShipFilter } from '@/contexts/ShipFilterContext';

export interface PendingInspection {
  id: string;
  equipment_id: string;
  ship_id: string | null;
  organization_id: string | null;
  due_date: string;
  source: string;
  status: string;
  carryover_items: Array<{ description: string; status: string; notes: string | null }>;
  carryover_recommendations: string | null;
  previous_inspection_id: string | null;
  completed_inspection_id: string | null;
  completed_at: string | null;
  created_at: string;
  equipment?: { id: string; name: string; internal_code: string } | null;
}

export function usePendingInspections() {
  const { selectedShipId } = useShipFilter();

  return useQuery({
    queryKey: ['pending-inspections', selectedShipId],
    queryFn: async () => {
      let query = supabase
        .from('pending_inspections' as any)
        .select('*, equipment:equipment_id(id, name, internal_code)')
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

      if (selectedShipId) {
        query = query.eq('ship_id', selectedShipId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as PendingInspection[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export async function fetchPendingInspectionById(id: string): Promise<PendingInspection | null> {
  const { data, error } = await supabase
    .from('pending_inspections' as any)
    .select('*, equipment:equipment_id(id, name, internal_code)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as PendingInspection | null;
}
