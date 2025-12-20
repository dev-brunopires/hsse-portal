import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UserFavorite {
  id: string;
  user_id: string;
  entity_type: 'equipment' | 'ship';
  entity_id: string;
  created_at: string;
}

export function useFavorites(entityType?: 'equipment' | 'ship') {
  return useQuery({
    queryKey: ['user-favorites', entityType],
    queryFn: async (): Promise<UserFavorite[]> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return [];

      let query = supabase
        .from('user_favorites')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as UserFavorite[];
    },
  });
}

export function useIsFavorite(entityType: 'equipment' | 'ship', entityId: string) {
  const { data: favorites = [] } = useFavorites(entityType);
  return favorites.some(f => f.entity_id === entityId);
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
    }: {
      entityType: 'equipment' | 'ship';
      entityId: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) throw new Error('Usuário não autenticado');

      // Check if already favorited
      const { data: existing } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', user.user.id)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .maybeSingle();

      if (existing) {
        // Remove favorite
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
        return { action: 'removed' };
      } else {
        // Add favorite
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: user.user.id,
            entity_type: entityType,
            entity_id: entityId,
          });

        if (error) throw error;
        return { action: 'added' };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['user-favorites'] });
      toast.success(result.action === 'added' ? 'Adicionado aos favoritos!' : 'Removido dos favoritos!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar favoritos');
      console.error('Error toggling favorite:', error);
    },
  });
}
