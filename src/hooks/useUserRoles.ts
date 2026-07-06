import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useOrganization } from '@/contexts/OrganizationContext';

export type UserRole = Tables<'user_roles'>;
export type AppRole = Enums<'app_role'>;

export function useUserRoles() {
  const { organization } = useOrganization();
  
  return useQuery({
    queryKey: ['user_roles', organization?.id],
    queryFn: async () => {
      let query = supabase
        .from('user_roles')
        .select('*');
      
      // Filter by organization if available
      if (organization?.id) {
        query = query.eq('organization_id', organization.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: !!organization?.id,
  });
}

export function useUpdateUserRole() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      if (!organization?.id) {
        throw new Error('Organização não encontrada');
      }

      // First check if user already has a role in this organization
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('organization_id', organization.id)
        .maybeSingle();
      
      if (existing) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId)
          .eq('organization_id', organization.id);
        
        if (error) throw error;
      } else {
        // Insert new role with organization_id
        const { error } = await supabase
          .from('user_roles')
          .insert({ 
            user_id: userId, 
            role: newRole,
            organization_id: organization.id,
          });
        
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
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!organization?.id) {
        throw new Error(t('userRoles.organizationNotFound', 'Organizacao nao encontrada'));
      }

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId, organizationId: organization.id },
      });

      if (error) {
        let message = error.message || t('userRoles.errorRemoving');
        const response = (error as { context?: Response }).context;
        if (response) {
          try {
            const payload = await response.clone().json() as { error?: string };
            if (payload.error) message = payload.error;
          } catch {
            // Keep the SDK message when the response is not JSON.
          }
        }
        throw new Error(message);
      }

      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(String(data.error || t('userRoles.errorRemoving')));
      }

      return data;
    },
    onMutate: async (userId: string) => {
      await queryClient.cancelQueries({ queryKey: ['profiles'] });
      const previousProfiles = queryClient.getQueriesData<Array<{ user_id: string }>>({
        queryKey: ['profiles'],
      });

      queryClient.setQueriesData<Array<{ user_id: string }>>(
        { queryKey: ['profiles'] },
        (profiles) => profiles?.filter((profile) => profile.user_id !== userId),
      );

      return { previousProfiles };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
      queryClient.invalidateQueries({ queryKey: ['user_ships'] });
      toast({
        title: t('userRoles.userRemoved'),
        description: t('userRoles.userRemovedDesc'),
      });
    },
    onError: (error: Error, _userId, context) => {
      context?.previousProfiles.forEach(([queryKey, profiles]) => {
        queryClient.setQueryData(queryKey, profiles);
      });
      toast({
        title: t('userRoles.errorRemoving'),
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
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
