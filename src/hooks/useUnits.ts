import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      // Get unique units from profiles
      const { data: profileUnits, error: profileError } = await supabase
        .from('profiles')
        .select('unit')
        .not('unit', 'is', null);
      
      if (profileError) throw profileError;

      // Get unique units from equipment
      const { data: equipmentUnits, error: equipmentError } = await supabase
        .from('equipment')
        .select('unit')
        .not('unit', 'is', null);
      
      if (equipmentError) throw equipmentError;

      // Combine and deduplicate
      const allUnits = new Set<string>();
      
      profileUnits?.forEach(p => {
        if (p.unit && p.unit.trim()) {
          allUnits.add(p.unit.trim());
        }
      });
      
      equipmentUnits?.forEach(e => {
        if (e.unit && e.unit.trim()) {
          allUnits.add(e.unit.trim());
        }
      });

      return Array.from(allUnits).sort();
    },
  });
}
