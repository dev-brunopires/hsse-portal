import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export function useUnits() {
  const { organization } = useOrganization();
  
  return useQuery({
    queryKey: ['units', organization?.id],
    queryFn: async () => {
      // Get units from ships table (source of truth)
      let query = supabase
        .from('ships')
        .select('name')
        .order('name');
      
      // Filter by organization if available
      if (organization?.id) {
        query = query.eq('organization_id', organization.id);
      }
      
      const { data: ships, error } = await query;
      
      if (error) throw error;

      return ships?.map(ship => ship.name) || [];
    },
    enabled: !!organization?.id,
  });
}
