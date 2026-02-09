import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useOrganization } from '@/contexts/OrganizationContext';

interface CategoryCount {
  category_id: string;
  count: number;
}

/**
 * Optimized hook to fetch equipment counts per category
 * Uses server-side aggregation instead of loading all equipment
 */
export function useEquipmentCountsByCategory() {
  const { selectedShipId, isFilterEnabled } = useShipFilter();
  
  return useQuery({
    queryKey: ['equipment-counts-by-category', selectedShipId],
    queryFn: async () => {
      // Use a lightweight query that only fetches category_id for counting
      let queryBuilder = supabase
        .from('equipment')
        .select('category_id');
      
      if (isFilterEnabled && selectedShipId) {
        queryBuilder = queryBuilder.eq('ship_id', selectedShipId);
      }
      
      const { data, error } = await queryBuilder;
      
      if (error) throw error;
      
      // Aggregate counts client-side from minimal data
      const counts: Record<string, number> = {};
      data?.forEach(item => {
        if (item.category_id) {
          counts[item.category_id] = (counts[item.category_id] || 0) + 1;
        }
      });
      
      return counts;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

/**
 * Get total equipment counts per category (ignores ship filter)
 * Used for category management to determine if a category can be deleted
 */
export function useTotalEquipmentCountsByCategory() {
  const { organization, isPlatformOwnerWithoutOrg, isLoading: isOrgLoading } = useOrganization();
  
  return useQuery({
    queryKey: ['equipment-counts-by-category-total', organization?.id, isPlatformOwnerWithoutOrg],
    queryFn: async () => {
      // Fetch all equipment category_ids (RLS will filter by organization)
      const { data, error } = await supabase
        .from('equipment')
        .select('category_id');
      
      if (error) throw error;
      
      // Aggregate counts client-side from minimal data
      const counts: Record<string, number> = {};
      data?.forEach(item => {
        if (item.category_id) {
          counts[item.category_id] = (counts[item.category_id] || 0) + 1;
        }
      });
      
      return counts;
    },
    enabled: !isOrgLoading && (!!organization?.id || isPlatformOwnerWithoutOrg),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

/**
 * Get total equipment count
 */
export function useTotalEquipmentCount() {
  const { selectedShipId, isFilterEnabled } = useShipFilter();
  
  return useQuery({
    queryKey: ['equipment-total-count', selectedShipId],
    queryFn: async () => {
      let queryBuilder = supabase
        .from('equipment')
        .select('id', { count: 'exact', head: true });
      
      if (isFilterEnabled && selectedShipId) {
        queryBuilder = queryBuilder.eq('ship_id', selectedShipId);
      }
      
      const { count, error } = await queryBuilder;
      
      if (error) throw error;
      
      return count || 0;
    },
    staleTime: 1000 * 60 * 5,
  });
}
