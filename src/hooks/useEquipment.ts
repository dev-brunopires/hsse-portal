import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useEffect } from 'react';

export type Equipment = Tables<'equipment'>;
export type EquipmentInsert = TablesInsert<'equipment'>;
export type EquipmentUpdate = TablesUpdate<'equipment'>;

export interface EquipmentWithCategory extends Equipment {
  categories?: { name: string; icon: string } | null;
  ships?: { id: string; name: string; code: string | null } | null;
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
    queryKey: ['equipment', selectedShipId],
    queryFn: async () => {
      let query = supabase
        .from('equipment')
        .select(`
          *,
          categories (name, icon),
          ships (id, name, code)
        `)
        .order('created_at', { ascending: false });
      
      // Apply ship filter for admin/admin_master when a specific ship is selected
      if (isFilterEnabled && selectedShipId) {
        query = query.eq('ship_id', selectedShipId);
      }
      
      const { data, error } = await query;
      
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
      
      return data as EquipmentWithCategory[];
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
        title: 'Equipamento Cadastrado',
        description: 'O equipamento foi cadastrado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao Cadastrar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
        title: 'Equipamento Atualizado',
        description: 'O equipamento foi atualizado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao Atualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
        title: 'Equipamento Excluído',
        description: 'O equipamento foi excluído com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao Excluir',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
