import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { Category } from '@/hooks/useCategories';
import type { Ship } from '@/hooks/useShips';
import type { EquipmentWithCategory } from '@/hooks/useEquipmentPaginated';

const EQUIPMENT_PAGE_SIZE = 100;

/**
 * Prefetches data for common routes to enable instant navigation.
 * The query keys intentionally match the hooks used by the pages.
 */
export function useRoutePrefetch() {
  const queryClient = useQueryClient();
  const { selectedShipId, isFilterEnabled, isReady } = useShipFilter();
  const { organization, isPlatformOwnerWithoutOrg, isLoading: isOrgLoading } = useOrganization();

  useEffect(() => {
    if (!isReady || isOrgLoading) return;
    if (!organization?.id && !isPlatformOwnerWithoutOrg) return;

    const prefetchEquipment = async () => {
      await queryClient.prefetchInfiniteQuery({
        queryKey: ['equipment-paginated', selectedShipId, '', 'all', undefined, undefined, undefined],
        queryFn: async ({ pageParam = 0 }) => {
          const pageIndex = Number(pageParam);
          let queryBuilder = supabase
            .from('equipment')
            .select(`
              *,
              categories (name, icon),
              ships (id, name, code)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(
              pageIndex * EQUIPMENT_PAGE_SIZE,
              (pageIndex + 1) * EQUIPMENT_PAGE_SIZE - 1,
            );

          if (isFilterEnabled && selectedShipId) {
            queryBuilder = queryBuilder.eq('ship_id', selectedShipId);
          }

          const { data: equipmentData, error, count } = await queryBuilder;

          if (error) throw error;

          const creatorIds = [
            ...new Set(equipmentData?.map(equipment => equipment.created_by).filter(Boolean) || []),
          ];
          let profilesMap: Record<string, string> = {};

          if (creatorIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('user_id, full_name')
              .in('user_id', creatorIds);

            if (profiles) {
              profilesMap = profiles.reduce((acc, profile) => {
                acc[profile.user_id] = profile.full_name;
                return acc;
              }, {} as Record<string, string>);
            }
          }

          const enrichedData = equipmentData?.map(equipment => ({
            ...equipment,
            created_by_profile: equipment.created_by
              ? { full_name: profilesMap[equipment.created_by] || null }
              : null,
          })) || [];

          return {
            data: enrichedData as EquipmentWithCategory[],
            nextPage: enrichedData.length === EQUIPMENT_PAGE_SIZE ? pageIndex + 1 : undefined,
            totalCount: count || 0,
          };
        },
        initialPageParam: 0,
        getNextPageParam: lastPage => lastPage.nextPage,
        staleTime: 1000 * 60 * 5,
      });
    };

    const prefetchCategories = async () => {
      await queryClient.prefetchQuery({
        queryKey: ['categories', organization?.id, isPlatformOwnerWithoutOrg],
        queryFn: async () => {
          if (isPlatformOwnerWithoutOrg) {
            const { data, error } = await supabase
              .from('categories')
              .select('*')
              .order('name');

            if (error) throw error;
            return data as Category[];
          }

          if (!organization?.id) return [];

          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('organization_id', organization.id)
            .order('name');

          if (error) throw error;
          return data as Category[];
        },
        staleTime: 1000 * 60 * 10,
      });
    };

    const prefetchShips = async () => {
      await queryClient.prefetchQuery({
        queryKey: ['ships', organization?.id, isPlatformOwnerWithoutOrg],
        queryFn: async () => {
          if (isPlatformOwnerWithoutOrg) {
            const { data, error } = await supabase
              .from('ships')
              .select('*')
              .order('name');

            if (error) throw error;
            return data as Ship[];
          }

          if (!organization?.id) return [];

          const { data, error } = await supabase
            .from('ships')
            .select('*')
            .eq('organization_id', organization.id)
            .order('name');

          if (error) throw error;
          return data as Ship[];
        },
        staleTime: 1000 * 60 * 10,
      });
    };

    const timeout = setTimeout(() => {
      Promise.all([
        prefetchCategories(),
        prefetchShips(),
        prefetchEquipment(),
      ]).catch(console.error);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [
    queryClient,
    selectedShipId,
    isFilterEnabled,
    isReady,
    organization?.id,
    isPlatformOwnerWithoutOrg,
    isOrgLoading,
  ]);
}

/**
 * Prefetches a specific route's data on hover/focus.
 */
export function usePrefetchOnHover(route: 'equipment' | 'inspections' | 'maintenance' | 'certificates') {
  const queryClient = useQueryClient();
  const { selectedShipId, isFilterEnabled } = useShipFilter();

  const prefetch = async () => {
    switch (route) {
      case 'equipment':
        await queryClient.prefetchInfiniteQuery({
          queryKey: ['equipment-paginated', selectedShipId, '', 'all', undefined, undefined, undefined],
          queryFn: async ({ pageParam = 0 }) => {
            const pageIndex = Number(pageParam);
            let queryBuilder = supabase
              .from('equipment')
              .select(`
                *,
                categories (name, icon),
                ships (id, name, code)
              `, { count: 'exact' })
              .order('created_at', { ascending: false })
              .range(
                pageIndex * EQUIPMENT_PAGE_SIZE,
                (pageIndex + 1) * EQUIPMENT_PAGE_SIZE - 1,
              );

            if (isFilterEnabled && selectedShipId) {
              queryBuilder = queryBuilder.eq('ship_id', selectedShipId);
            }

            const { data, error, count } = await queryBuilder;

            if (error) throw error;

            const equipment = (data || []).map(item => ({
              ...item,
              created_by_profile: null,
            }));

            return {
              data: equipment as EquipmentWithCategory[],
              nextPage: equipment.length === EQUIPMENT_PAGE_SIZE ? pageIndex + 1 : undefined,
              totalCount: count || 0,
            };
          },
          initialPageParam: 0,
          getNextPageParam: lastPage => lastPage.nextPage,
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
          queryKey: ['certificates', selectedShipId, {}, undefined],
          staleTime: 1000 * 60 * 2,
        });
        break;
    }
  };

  return { prefetch };
}
