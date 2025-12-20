import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      // Get units from ships table (source of truth)
      const { data: ships, error } = await supabase
        .from('ships')
        .select('name')
        .order('name');
      
      if (error) throw error;

      return ships?.map(ship => ship.name) || [];
    },
  });
}
