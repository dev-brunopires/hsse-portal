import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useEffect } from 'react';
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

const OFFLINE_EQUIPMENT_KEY = 'safeship_offline_equipment';

// Cache equipment data for offline use
const cacheEquipmentData = (data: EquipmentWithCategory[]) => {
  try {
    localStorage.setItem(OFFLINE_EQUIPMENT_KEY, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.error('Error caching equipment data:', e);
  }
};

// Get cached equipment data
const getCachedEquipment = (): EquipmentWithCategory[] | null => {
  try {
    const cached = localStorage.getItem(OFFLINE_EQUIPMENT_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Cache valid for 24 hours
      if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
        return parsed.data;
      }
    }
    return null;
  } catch (e) {
    console.error('Error getting cached equipment:', e);
    return null;
  }
};

export function useEquipment() {
  const { selectedShipId, isFilterEnabled } = useShipFilter();
  
  const query = useQuery({
    queryKey: ['equipment', selectedShipId ?? 'all'],
    queryFn: async () => {
      let queryBuilder = supabase
        .from('equipment')
        .select(`
          *,
          categories (name, icon),
          ships (id, name, code)
        `)
        .order('created_at', { ascending: false });
      
      // Apply ship filter for admin/admin_master when a specific ship is selected
      if (isFilterEnabled && selectedShipId) {
        queryBuilder = queryBuilder.eq('ship_id', selectedShipId);
      }
      
      const { data: equipmentData, error } = await queryBuilder;
      
      if (error) {
        // If offline, return cached data
        if (!navigator.onLine) {
          const cached = getCachedEquipment();
          if (cached) {
            return selectedShipId 
              ? cached.filter(e => e.ship_id === selectedShipId)
              : cached;
          }
        }
        throw error;
      }
      
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
      
      return enrichedData as EquipmentWithCategory[];
    },
    // Provide placeholder data when offline
    placeholderData: () => {
      if (!navigator.onLine) {
        const cached = getCachedEquipment();
        if (cached) {
          return selectedShipId 
            ? cached.filter(e => e.ship_id === selectedShipId)
            : cached;
        }
      }
      return undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Cache data when successfully fetched
  useEffect(() => {
    if (query.data && navigator.onLine) {
      cacheEquipmentData(query.data);
    }
  }, [query.data]);

  return query;
}

export function useEquipmentById(id: string | undefined) {
  return useQuery({
    queryKey: ['equipment', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('equipment')
        .select(`
          *,
          categories (name, icon),
          ships (id, name, code)
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as EquipmentWithCategory | null;
    },
    enabled: !!id,
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
