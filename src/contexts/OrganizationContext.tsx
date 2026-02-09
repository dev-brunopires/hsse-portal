import React, { createContext, useContext, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { telemetry } from '@/utils/clientTelemetry';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  logo_url: string | null;
  logo_white_url: string | null;
  login_background_url: string | null;
  is_active: boolean;
}

interface OrganizationContextType {
  organization: Organization | null;
  isLoading: boolean;
  subdomain: string | null;
  logoUrl: string | null;
  logoWhiteUrl: string | null;
  loginBackgroundUrl: string | null;
  isPlatformOwnerWithoutOrg: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const getSubdomainFromHostname = (search: string): string | null => {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;
  const params = new URLSearchParams(search);

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return params.get('org') || null;
  }

  if (
    hostname.endsWith('.lovable.app') ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.lovableproject.com')
  ) {
    return params.get('org') || null;
  }

  if (hostname.endsWith('opensafebrasil.com')) {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0];
      if (subdomain && subdomain !== 'www') {
        return subdomain;
      }
    }
    return params.get('org') || null;
  }

  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain && subdomain !== 'www') {
      return subdomain;
    }
  }

  return params.get('org') || null;
};

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, isPlatformOwner, loading: authLoading } = useAuth();

  const subdomain = useMemo(() => getSubdomainFromHostname(location.search), [location.search]);
  
  // Get org from subdomain (for login page)
  const { data: orgFromSubdomain, isLoading: isLoadingSubdomain } = useQuery({
    queryKey: ['organization', 'subdomain', subdomain],
    queryFn: async () => {
      if (!subdomain) return null;
      
      const { data, error } = await supabase
        .rpc('get_org_branding_by_subdomain', { _subdomain: subdomain })
        .maybeSingle();
      
      if (error) {
        telemetry.error('org_subdomain_fetch_error', { subdomain, error: error.message });
        throw error;
      }
      return data as Organization | null;
    },
    enabled: !!subdomain,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });

  // Get org from user's membership
  const { data: userOrg, isLoading: isLoadingUserOrg, isFetched: isUserOrgFetched } = useQuery({
    queryKey: ['user-organization', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      try {
        const result = await supabase
          .from('user_organizations')
          .select(`
            organization_id,
            organizations:organization_id (
              id, name, slug, subdomain,
              logo_url, logo_white_url, login_background_url, is_active
            )
          `)
          .eq('user_id', user.id)
          .maybeSingle();

        if (result?.error) {
          telemetry.error('org_user_org_fetch_error', { userId: user.id, error: result.error.message });
          return null;
        }

        return result?.data?.organizations as Organization | null;
      } catch (e) {
        telemetry.warn('org_user_org_fetch_timeout', { userId: user.id, error: String(e) });
        return null;
      }
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: false,
  });

  const organization = useMemo(() => userOrg || orgFromSubdomain || null, [userOrg, orgFromSubdomain]);

  const isPlatformOwnerWithoutOrg = useMemo(() => {
    return isPlatformOwner && isUserOrgFetched && !organization;
  }, [isPlatformOwner, isUserOrgFetched, organization]);

  const isLoading = useMemo(() => {
    if (authLoading) return true;
    if (subdomain && isLoadingSubdomain) return true;
    if (user?.id && isLoadingUserOrg) return true;
    return false;
  }, [subdomain, isLoadingSubdomain, authLoading, user?.id, isLoadingUserOrg]);

  const value = useMemo(() => ({
    organization,
    isLoading,
    subdomain,
    logoUrl: organization?.logo_url || null,
    logoWhiteUrl: organization?.logo_white_url || null,
    loginBackgroundUrl: organization?.login_background_url || null,
    isPlatformOwnerWithoutOrg,
  }), [organization, isLoading, subdomain, isPlatformOwnerWithoutOrg]);

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
