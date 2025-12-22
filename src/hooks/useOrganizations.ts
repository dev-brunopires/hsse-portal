import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  logo_url: string | null;
  logo_white_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationData {
  name: string;
  slug: string;
  subdomain: string;
  logo_url?: string;
  logo_white_url?: string;
}

export interface UpdateOrganizationData {
  id: string;
  name?: string;
  slug?: string;
  subdomain?: string;
  logo_url?: string | null;
  logo_white_url?: string | null;
  is_active?: boolean;
}

// Get all organizations (for platform owners)
export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Organization[];
    },
  });
}

// Get single organization by subdomain
export function useOrganizationBySubdomain(subdomain: string | null) {
  return useQuery({
    queryKey: ['organization', 'subdomain', subdomain],
    queryFn: async () => {
      if (!subdomain) return null;
      
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('subdomain', subdomain)
        .eq('is_active', true)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data as Organization;
    },
    enabled: !!subdomain,
  });
}

// Get current user's organization
export function useUserOrganization() {
  return useQuery({
    queryKey: ['user-organization'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_organizations')
        .select(`
          organization_id,
          organizations:organization_id (
            id,
            name,
            slug,
            subdomain,
            logo_url,
            logo_white_url,
            is_active
          )
        `)
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      
      return data?.organizations as Organization | null;
    },
  });
}

// Check if current user is a platform owner
export function useIsPlatformOwner() {
  return useQuery({
    queryKey: ['is-platform-owner'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('platform_owners')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    },
  });
}

// Create organization
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: CreateOrganizationData) => {
      const { data: org, error } = await supabase
        .from('organizations')
        .insert({
          name: data.name,
          slug: data.slug,
          subdomain: data.subdomain,
          logo_url: data.logo_url || null,
          logo_white_url: data.logo_white_url || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return org as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast({
        title: t('organizations.created'),
        description: t('organizations.createdDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('organizations.createError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update organization
export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: UpdateOrganizationData) => {
      const { id, ...updates } = data;
      const { data: org, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return org as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['user-organization'] });
      toast({
        title: t('organizations.updated'),
        description: t('organizations.updatedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('organizations.updateError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete organization
export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast({
        title: t('organizations.deleted'),
        description: t('organizations.deletedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('organizations.deleteError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Assign user to organization
export function useAssignUserToOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ userId, organizationId }: { userId: string; organizationId: string }) => {
      const { error } = await supabase
        .from('user_organizations')
        .insert({
          user_id: userId,
          organization_id: organizationId,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organization'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({
        title: t('organizations.userAssigned'),
        description: t('organizations.userAssignedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('organizations.assignError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
