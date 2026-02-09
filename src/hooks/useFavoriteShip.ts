import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns the favorite ship ID for the current user, or null if none.
 */
export function useFavoriteShip() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['favorite-ship', user?.id],
    queryFn: async (): Promise<string | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_favorites')
        .select('entity_id')
        .eq('user_id', user.id)
        .eq('entity_type', 'ship')
        .maybeSingle();

      if (error) throw error;
      return data?.entity_id ?? null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 30, // 30 min - rarely changes
  });
}

/**
 * Mutation to set or unset a favorite ship.
 * Setting a new favorite automatically removes the previous one (via DB trigger).
 */
export function useSetFavoriteShip() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      shipId,
      shipName,
    }: {
      shipId: string | null; // null = remove favorite
      shipName?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      if (shipId === null) {
        // Remove all ship favorites for this user
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('entity_type', 'ship');

        if (error) throw error;
        return { action: 'removed' as const, shipName };
      }

      // Check if this ship is already favorited
      const { data: existing } = await supabase
        .from('user_favorites')
        .select('id, entity_id')
        .eq('user_id', user.id)
        .eq('entity_type', 'ship')
        .maybeSingle();

      if (existing?.entity_id === shipId) {
        // Toggle off - remove favorite
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
        return { action: 'removed' as const, shipName };
      }

      // Set new favorite (trigger will remove old one)
      const { error } = await supabase
        .from('user_favorites')
        .insert({
          user_id: user.id,
          entity_type: 'ship',
          entity_id: shipId,
        });

      if (error) throw error;
      return { action: 'added' as const, shipName };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['favorite-ship'] });
      queryClient.invalidateQueries({ queryKey: ['user-favorites'] });

      if (result.action === 'added') {
        toast.success(
          i18n.t('hooks.favoriteShip.setSuccess', { name: result.shipName || '' })
        );
      } else {
        toast.success(i18n.t('hooks.favoriteShip.removedSuccess'));
      }
    },
    onError: () => {
      toast.error(i18n.t('hooks.favoriteShip.error'));
    },
  });
}
