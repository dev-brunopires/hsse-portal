import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShipFilter } from '@/contexts/ShipFilterContext';

/**
 * Prefetches data for common routes to enable instant navigation
 */
export function useRoutePrefetch() {
  const queryClient = useQueryClient();
  const { selectedShipId, isFilterEnabled, isReady } = useShipFilter();

  useEffect(() => {
    if (!isReady) return;

    // Prefetch equipment data (most accessed)
    // Use the same queryKey format as the actual hooks
    const prefetchEquipment = async () => {
      await queryClient.prefetchQuery({
        queryKey: ['equipment', selectedShipId],
        queryFn: async () => {
          let queryBuilder = supabase
            .from('equipment')
            .select('id, name, internal_code, status, category_id, ship_id, certificate_expiry, next_inspection')
            .order('created_at', { ascending: false })
            .limit(50);
          
          if (isFilterEnabled && selectedShipId) {
            queryBuilder = queryBuilder.eq('ship_id', selectedShipId);
          }
          
          const { data } = await queryBuilder;
          return data || [];
        },
        staleTime: 1000 * 60 * 5,
      });
    };

    // Prefetch categories (usually small dataset)
    const prefetchCategories = async () => {
      await queryClient.prefetchQuery({
        queryKey: ['categories'],
        queryFn: async () => {
          const { data } = await supabase
            .from('categories')
            .select('id, name, icon, inspection_frequency')
            .order('name');
          return data || [];
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
      });
    };

    // Prefetch ships (usually small dataset)
    const prefetchShips = async () => {
      await queryClient.prefetchQuery({
        queryKey: ['ships'],
        queryFn: async () => {
          const { data } = await supabase
            .from('ships')
            .select('id, name, code')
            .order('name');
          return data || [];
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
      });
    };

    // Run prefetches in parallel with delay to not block initial render
    const timeout = setTimeout(() => {
      Promise.all([
        prefetchEquipment(),
        prefetchCategories(),
        prefetchShips(),
      ]).catch(console.error);
    }, 1000); // Wait 1 second after initial render

    return () => clearTimeout(timeout);
  }, [queryClient, selectedShipId, isFilterEnabled, isReady]);
}

/**
 * Prefetches a specific route's data on hover/focus
 */
export function usePrefetchOnHover(route: 'equipment' | 'inspections' | 'maintenance' | 'certificates') {
  const queryClient = useQueryClient();
  const { selectedShipId, isFilterEnabled } = useShipFilter();

  const prefetch = async () => {
    switch (route) {
      case 'equipment':
        await queryClient.prefetchQuery({
          queryKey: ['equipment', selectedShipId],
          staleTime: 1000 * 60 * 2,
        });
        break;
      case 'inspections':
        await queryClient.prefetchQuery({
          queryKey: ['inspections', selectedShipId],
          staleTime: 1000 * 60 * 2,
        });
        break;
      case 'maintenance':
        await queryClient.prefetchQuery({
          queryKey: ['maintenance-requests', selectedShipId],
          staleTime: 1000 * 60 * 2,
        });
        break;
      case 'certificates':
        await queryClient.prefetchQuery({
          queryKey: ['certificates'],
          staleTime: 1000 * 60 * 2,
        });
        break;
    }
  };

  return { prefetch };
}
