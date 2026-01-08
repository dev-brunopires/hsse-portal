import React, { createContext, useContext, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  logo_url: string | null;
  logo_white_url: string | null;
  is_active: boolean;
}

interface OrganizationContextType {
  organization: Organization | null;
  isLoading: boolean;
  subdomain: string | null;
  logoUrl: string | null;
  logoWhiteUrl: string | null;
  isPlatformOwnerWithoutOrg: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

// Helper to extract subdomain from hostname - memoize at module level
const getSubdomainFromHostname = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const hostname = window.location.hostname;
  
  // For localhost development, use query parameter
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const params = new URLSearchParams(window.location.search);
    return params.get('org') || null;
  }
  
  // For preview/staging domains (e.g., xxx.lovable.app)
  if (hostname.endsWith('.lovable.app') || hostname.endsWith('.vercel.app') || hostname.endsWith('.lovableproject.com')) {
    const params = new URLSearchParams(window.location.search);
    return params.get('org') || null;
  }
  
  // For production domains like sbmoffshore.safeship.app
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0]; // First part is the subdomain
  }
  
  // Single domain or www - try to get from query param
  const params = new URLSearchParams(window.location.search);
  return params.get('org') || null;
};

// Cache subdomain at module level to avoid recalculating
const cachedSubdomain = getSubdomainFromHostname();

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  // Reuse isPlatformOwner from AuthContext to avoid duplicate query
  const { user, isPlatformOwner, loading: authLoading } = useAuth();
  const [subdomain] = useState<string | null>(cachedSubdomain);

  // Get org from subdomain (for login page)
  const { data: orgFromSubdomain, isLoading: isLoadingSubdomain } = useQuery({
    queryKey: ['organization', 'subdomain', subdomain],
    queryFn: async () => {
      if (!subdomain) return null;
      
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('subdomain', subdomain)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data as Organization | null;
    },
    enabled: !!subdomain,
    staleTime: 1000 * 60 * 30, // 30 minutes - org data rarely changes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  // Get org from user's membership - only when user is available
  const { data: userOrg, isLoading: isLoadingUserOrg, isFetched: isUserOrgFetched } = useQuery({
    queryKey: ['user-organization', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Try to get user's organization membership
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
        .maybeSingle();
      
      // Handle RLS errors gracefully - user might be platform owner without org membership
      if (error) {
        console.warn('Error fetching user organization:', error.message);
        return null;
      }
      
      return data?.organizations as Organization | null;
    },
    enabled: !!user && !authLoading,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: false, // Don't retry on RLS errors
  });

  // Prefer user's organization if available, otherwise use subdomain
  const organization = useMemo(() => {
    return userOrg || orgFromSubdomain || null;
  }, [userOrg, orgFromSubdomain]);

  // Platform owner without org is only when we've checked everything and found nothing
  const isPlatformOwnerWithoutOrg = useMemo(() => {
    return isPlatformOwner && isUserOrgFetched && !organization;
  }, [isPlatformOwner, isUserOrgFetched, organization]);

  // Loading is done when:
  // - If subdomain exists, subdomain query must finish
  // - User org query must finish (if user exists)
  // - For platform owners without org, we should NOT be loading forever
  const isLoading = useMemo(() => {
    if (authLoading) return true;
    if (subdomain && isLoadingSubdomain) return true;
    if (user && isLoadingUserOrg) return true;
    return false;
  }, [subdomain, isLoadingSubdomain, authLoading, user, isLoadingUserOrg]);

  const value = useMemo(() => ({
    organization,
    isLoading,
    subdomain,
    logoUrl: organization?.logo_url || null,
    logoWhiteUrl: organization?.logo_white_url || null,
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
