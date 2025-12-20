import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Profile = Tables<'profiles'>;

export interface ProfileWithRole extends Profile {
  user_roles?: { role: 'admin' | 'technician' | 'viewer' }[];
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      
      if (error) throw error;
      
      // Fetch roles separately
      const userIds = profiles.map(p => p.user_id);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      
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
  });
}

export function useTechniciansAndAdmins() {
  return useQuery({
    queryKey: ['profiles', 'inspectors'],
    queryFn: async () => {
      // Fetch all profiles - all users can be inspectors
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      
      if (error) throw error;
      
      // Fetch roles for all users
      const userIds = data.map(p => p.user_id);
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      
      // Combine with role info
      return (data as Profile[]).map(profile => ({
        ...profile,
        role: roleData?.find(r => r.user_id === profile.user_id)?.role,
      }));
    },
  });
}
