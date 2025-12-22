import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface Ship {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateShipData {
  name: string;
  code?: string;
  description?: string;
}

export interface UpdateShipData {
  id: string;
  name?: string;
  code?: string;
  description?: string;
}

export function useShips() {
  const { organization } = useOrganization();
  
  return useQuery({
    queryKey: ['ships', organization?.id],
    queryFn: async () => {
      let query = supabase
        .from('ships')
        .select('*')
        .order('name');
      
      // Filter by organization if available
      if (organization?.id) {
        query = query.eq('organization_id', organization.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Ship[];
    },
    enabled: !!organization?.id,
  });
}

export function useCreateShip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (data: CreateShipData) => {
      if (!organization?.id) {
        throw new Error('Organização não encontrada');
      }

      const { data: ship, error } = await supabase
        .from('ships')
        .insert({
          name: data.name,
          code: data.code || null,
          description: data.description || null,
          organization_id: organization.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return ship;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      toast({
        title: 'Navio Cadastrado',
        description: 'O navio foi cadastrado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao Cadastrar',
        description: error.message || 'Erro ao cadastrar navio.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateShip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateShipData) => {
      const { id, ...updateData } = data;
      const { data: ship, error } = await supabase
        .from('ships')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return ship;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      toast({
        title: 'Navio Atualizado',
        description: 'Os dados do navio foram atualizados.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao Atualizar',
        description: error.message || 'Erro ao atualizar navio.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteShip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ships')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      toast({
        title: 'Navio Removido',
        description: 'O navio foi removido do sistema.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao Remover',
        description: error.message || 'Erro ao remover navio.',
        variant: 'destructive',
      });
    },
  });
}
