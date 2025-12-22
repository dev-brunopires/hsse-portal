import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

// Helper to extract subdomain from hostname
function getSubdomainFromHostname(): string | null {
  if (typeof window === 'undefined') return null;
  
  const hostname = window.location.hostname;
  
  // For localhost development, use query parameter
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const params = new URLSearchParams(window.location.search);
    return params.get('org') || null;
  }
  
  // For preview/staging domains (e.g., xxx.lovable.app)
  if (hostname.endsWith('.lovable.app') || hostname.endsWith('.vercel.app')) {
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
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  
  useEffect(() => {
    const detected = getSubdomainFromHostname();
    setSubdomain(detected);
  }, []);

  // Check if user is a platform owner
  useEffect(() => {
    const checkPlatformOwner = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('platform_owners')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        setIsPlatformOwner(!!data);
      }
      setAuthReady(true);
    };
    
    checkPlatformOwner();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkPlatformOwner();
    });
    
    return () => subscription.unsubscribe();
  }, []);

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
  });

  // Get org from user's membership
  const { data: userOrg, isLoading: isLoadingUserOrg, isFetched: isUserOrgFetched, error: userOrgError } = useQuery({
    queryKey: ['user-organization'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
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
    enabled: authReady,
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
  // - User org query must finish (if authReady)
  // - For platform owners without org, we should NOT be loading forever
  const isLoading = useMemo(() => {
    if (subdomain && isLoadingSubdomain) return true;
    if (!authReady) return true;
    if (isLoadingUserOrg) return true;
    return false;
  }, [subdomain, isLoadingSubdomain, authReady, isLoadingUserOrg]);

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
