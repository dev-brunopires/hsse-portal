import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserShip {
  id: string;
  user_id: string;
  ship_id: string;
  created_at: string;
  ship?: {
    id: string;
    name: string;
    code: string | null;
  };
}

export function useUserShips(userId?: string) {
  return useQuery({
    queryKey: ['user-ships', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_ships')
        .select(`
          *,
          ship:ships (
            id,
            name,
            code
          )
        `)
        .eq('user_id', userId);
      
      if (error) throw error;
      return data as UserShip[];
    },
    enabled: !!userId,
  });
}

export function useAllUserShips() {
  return useQuery({
    queryKey: ['all-user-ships'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_ships')
        .select(`
          *,
          ship:ships (
            id,
            name,
            code
          )
        `);
      
      if (error) throw error;
      return data as UserShip[];
    },
  });
}

export function useAssignUserToShip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, shipId }: { userId: string; shipId: string }) => {
      const { data, error } = await supabase
        .from('user_ships')
        .insert({
          user_id: userId,
          ship_id: shipId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-ships', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['all-user-ships'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({
        title: 'Navio Atribuído',
        description: 'O usuário foi atribuído ao navio com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao Atribuir',
        description: error.message?.includes('duplicate') 
          ? 'O usuário já está atribuído a este navio.'
          : error.message || 'Erro ao atribuir usuário ao navio.',
        variant: 'destructive',
      });
    },
  });
}

export function useRemoveUserFromShip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, shipId }: { userId: string; shipId: string }) => {
      const { error } = await supabase
        .from('user_ships')
        .delete()
        .eq('user_id', userId)
        .eq('ship_id', shipId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-ships', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['all-user-ships'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({
        title: 'Navio Removido',
        description: 'O usuário foi removido do navio.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao Remover',
        description: error.message || 'Erro ao remover usuário do navio.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateUserShips() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, shipIds }: { userId: string; shipIds: string[] }) => {
      // First, delete all existing assignments
      const { error: deleteError } = await supabase
        .from('user_ships')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) throw deleteError;

      // Then, insert new assignments
      if (shipIds.length > 0) {
        const { error: insertError } = await supabase
          .from('user_ships')
          .insert(
            shipIds.map(shipId => ({
              user_id: userId,
              ship_id: shipId,
            }))
          );
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-ships', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['all-user-ships'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({
        title: 'Navios Atualizados',
        description: 'Os navios do usuário foram atualizados.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao Atualizar',
        description: error.message || 'Erro ao atualizar navios do usuário.',
        variant: 'destructive',
      });
    },
  });
}
