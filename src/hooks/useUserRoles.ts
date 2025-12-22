import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export type UserRole = Tables<'user_roles'>;
export type AppRole = Enums<'app_role'>;

export function useUserRoles() {
  return useQuery({
    queryKey: ['user_roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');
      
      if (error) throw error;
      return data as UserRole[];
    },
  });
}

export function useUpdateUserRole() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      // First check if user already has a role
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      if (existing) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
      toast({
        title: t('userRoles.profileUpdated'),
        description: t('userRoles.profileUpdatedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('userRoles.errorUpdating'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      // Get the current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error(t('auth.notAuthenticated', 'Not authenticated'));
      }

      // Call the edge function to delete the user completely
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('userRoles.errorRemoving'));
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
      queryClient.invalidateQueries({ queryKey: ['user_ships'] });
      toast({
        title: t('userRoles.userRemoved'),
        description: t('userRoles.userRemovedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('userRoles.errorRemoving'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateProfile() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, fullName, unit }: { userId: string; fullName: string; unit?: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName, 
          unit: unit || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({
        title: t('userRoles.profileUpdated'),
        description: t('userRoles.dataUpdated'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('userRoles.errorUpdatingData'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
