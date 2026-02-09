import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

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
        title: t('hooks.userShips.assigned'),
        description: t('hooks.userShips.assignedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('hooks.userShips.assignError'),
        description: error.message?.includes('duplicate') 
          ? t('hooks.userShips.alreadyAssigned')
          : error.message || t('hooks.userShips.assignErrorGeneric'),
        variant: 'destructive',
      });
    },
  });
}

export function useRemoveUserFromShip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

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
        title: t('hooks.userShips.removed'),
        description: t('hooks.userShips.removedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('hooks.userShips.removeError'),
        description: error.message || t('hooks.userShips.removeErrorGeneric'),
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateUserShips() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

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
        title: t('hooks.userShips.updated'),
        description: t('hooks.userShips.updatedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('hooks.userShips.updateError'),
        description: error.message || t('hooks.userShips.updateErrorGeneric'),
        variant: 'destructive',
      });
    },
  });
}
