import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useOrganization } from '@/contexts/OrganizationContext';

export type Profile = Tables<'profiles'>;

export interface ProfileWithRole extends Profile {
  user_roles?: { role: 'admin' | 'technician' | 'viewer' }[];
}

export function useProfiles() {
  const { organization, isPlatformOwnerWithoutOrg, isLoading: isOrgLoading } = useOrganization();
  
  return useQuery({
    queryKey: ['profiles', organization?.id, isPlatformOwnerWithoutOrg],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      
      // Platform owner without org can see all profiles
      // Regular users see only their organization's profiles
      if (!isPlatformOwnerWithoutOrg && organization?.id) {
        query = query.eq('organization_id', organization.id);
      }
      
      const { data: profiles, error } = await query;
      
      if (error) throw error;
      
      // Fetch roles separately
      const userIds = profiles.map(p => p.user_id);
      
      if (userIds.length === 0) {
        return [] as ProfileWithRole[];
      }
      
      let rolesQuery = supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      
      // Filter roles by organization for regular users
      if (!isPlatformOwnerWithoutOrg && organization?.id) {
        rolesQuery = rolesQuery.eq('organization_id', organization.id);
      }
      
      const { data: roles } = await rolesQuery;
      
      const rolesMap = new Map<string, { role: 'admin' | 'technician' | 'viewer' }[]>();
      roles?.forEach(r => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push({ role: r.role as 'admin' | 'technician' | 'viewer' });
        rolesMap.set(r.user_id, existing);
      });
      
      return profiles.map(profile => ({
        ...profile,
        user_roles: rolesMap.get(profile.user_id) || [],
      })) as ProfileWithRole[];
    },
    // Enable when org is ready OR platform owner without org
    enabled: !isOrgLoading && (!!organization?.id || isPlatformOwnerWithoutOrg),
  });
}

export function useTechniciansAndAdmins() {
  const { organization, isPlatformOwnerWithoutOrg, isLoading: isOrgLoading } = useOrganization();
  
  return useQuery({
    queryKey: ['profiles', 'inspectors', organization?.id, isPlatformOwnerWithoutOrg],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      
      // Filter by organization for regular users
      if (!isPlatformOwnerWithoutOrg && organization?.id) {
        query = query.eq('organization_id', organization.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Fetch roles for all users
      const userIds = data.map(p => p.user_id);
      
      if (userIds.length === 0) {
        return [] as (Profile & { role?: string })[];
      }
      
      let rolesQuery = supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      
      // Filter roles by organization for regular users
      if (!isPlatformOwnerWithoutOrg && organization?.id) {
        rolesQuery = rolesQuery.eq('organization_id', organization.id);
      }
      
      const { data: roleData } = await rolesQuery;
      
      // Combine with role info
      return (data as Profile[]).map(profile => ({
        ...profile,
        role: roleData?.find(r => r.user_id === profile.user_id)?.role,
      }));
    },
    // Enable when org is ready OR platform owner without org
    enabled: !isOrgLoading && (!!organization?.id || isPlatformOwnerWithoutOrg),
  });
}
