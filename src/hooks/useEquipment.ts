import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useShipFilter } from '@/contexts/ShipFilterContext';

export type Equipment = Tables<'equipment'>;
export type EquipmentInsert = TablesInsert<'equipment'>;
export type EquipmentUpdate = TablesUpdate<'equipment'>;

export interface EquipmentWithCategory extends Equipment {
  categories?: { name: string; icon: string } | null;
  ships?: { id: string; name: string; code: string | null } | null;
}

export function useEquipment() {
  const { selectedShipId, isFilterEnabled } = useShipFilter();
  
  return useQuery({
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
      
      if (error) throw error;
      return data as EquipmentWithCategory[];
    },
  });
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
