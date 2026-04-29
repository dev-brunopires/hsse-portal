import { useInfiniteQuery, useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useTranslation } from 'react-i18next';
import { translateError } from '@/utils/errorTranslation';

export type Equipment = Tables<'equipment'>;
export type EquipmentInsert = TablesInsert<'equipment'>;
export type EquipmentUpdate = TablesUpdate<'equipment'>;

export interface EquipmentWithCategory extends Equipment {
  categories?: { name: string; icon: string } | null;
  ships?: { id: string; name: string; code: string | null } | null;
  created_by_profile?: { full_name: string } | null;
}

interface EquipmentFilters {
  search?: string;
  status?: string;
  categoryId?: string;
  manufacturer?: string;
  unit?: string;
}

const PAGE_SIZE = 100;

export function useEquipmentPaginated(filters: EquipmentFilters = {}) {
  const { selectedShipId, isFilterEnabled } = useShipFilter();
  const { search, status, categoryId, manufacturer, unit } = filters;
  
  return useInfiniteQuery({
    queryKey: ['equipment-paginated', selectedShipId, search, status, categoryId, manufacturer, unit],
    queryFn: async ({ pageParam = 0 }) => {
      let queryBuilder = supabase
        .from('equipment')
        .select(`
          *,
          categories (name, icon),
          ships (id, name, code)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);
      
      // Apply ship filter for admin/admin_master when a specific ship is selected
      if (isFilterEnabled && selectedShipId) {
        queryBuilder = queryBuilder.eq('ship_id', selectedShipId);
      }
      
      // Apply server-side search filter using ilike for text search
      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        queryBuilder = queryBuilder.or(
          `name.ilike.${searchTerm},internal_code.ilike.${searchTerm},serial_number.ilike.${searchTerm},location.ilike.${searchTerm},short_code.ilike.${searchTerm},capacity.ilike.${searchTerm}`
        );
      }
      
      // Apply server-side status filter
      if (status && status !== 'all') {
        queryBuilder = queryBuilder.eq('status', status);
      }
      
      // Apply server-side category filter
      if (categoryId) {
        queryBuilder = queryBuilder.eq('category_id', categoryId);
      }
      
      // Apply server-side manufacturer filter
      if (manufacturer) {
        queryBuilder = queryBuilder.eq('manufacturer', manufacturer);
      }
      
      // Apply server-side unit filter
      if (unit) {
        queryBuilder = queryBuilder.eq('unit', unit);
      }
      
      const { data: equipmentData, error, count } = await queryBuilder;
      
      if (error) throw error;
      
      // Fetch creator profiles separately
      const creatorIds = [...new Set(equipmentData?.map(e => e.created_by).filter(Boolean) || [])];
      let profilesMap: Record<string, string> = {};
      
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', creatorIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = p.full_name;
            return acc;
          }, {} as Record<string, string>);
        }
      }
      
      // Merge profile data with equipment
      const enrichedData = equipmentData?.map(e => ({
        ...e,
        created_by_profile: e.created_by ? { full_name: profilesMap[e.created_by] || null } : null,
      })) || [];
      
      return {
        data: enrichedData as EquipmentWithCategory[],
        nextPage: enrichedData.length === PAGE_SIZE ? pageParam + 1 : undefined,
        totalCount: count || 0,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get total count for a category (server-side)
export function useEquipmentCount(categoryId?: string) {
  const { selectedShipId, isFilterEnabled } = useShipFilter();
  
  return useQuery({
    queryKey: ['equipment-count', selectedShipId, categoryId],
    queryFn: async () => {
      let queryBuilder = supabase
        .from('equipment')
        .select('id', { count: 'exact', head: true });
      
      if (isFilterEnabled && selectedShipId) {
        queryBuilder = queryBuilder.eq('ship_id', selectedShipId);
      }
      
      if (categoryId) {
        queryBuilder = queryBuilder.eq('category_id', categoryId);
      }
      
      const { count, error } = await queryBuilder;
      
      if (error) throw error;
      
      return count || 0;
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (equipment: EquipmentInsert) => {
      const { data, error } = await supabase
        .from('equipment')
        .insert(equipment)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-count'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-counts-by-category'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-total-count'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({
        title: t('hooks.equipment.created'),
        description: t('hooks.equipment.createdDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.equipment.createError'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, ...equipment }: EquipmentUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('equipment')
        .update(equipment)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-count'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-counts-by-category'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-total-count'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({
        title: t('hooks.equipment.updated'),
        description: t('hooks.equipment.updatedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.equipment.updateError'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-count'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-counts-by-category'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-total-count'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({
        title: t('hooks.equipment.deleted'),
        description: t('hooks.equipment.deletedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.equipment.deleteError'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}
