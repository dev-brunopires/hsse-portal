import React, { createContext, useContext, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

// Helper to extract organization subdomain.
// In preview/staging environments we use the `?org=` query param.
const getSubdomainFromHostname = (search: string): string | null => {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;
  const params = new URLSearchParams(search);

  // For localhost development, use query parameter
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return params.get('org') || null;
  }

  // For preview/staging domains
  if (
    hostname.endsWith('.lovable.app') ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.lovableproject.com')
  ) {
    return params.get('org') || null;
  }

  // For production domain (opensafebrasil.com)
  if (hostname.endsWith('opensafebrasil.com')) {
    return params.get('org') || null;
  }

  // For production domains like sbmoffshore.safeship.app
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0] || null;
  }

  // Single domain or www - try to get from query param
  return params.get('org') || null;
};

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  
  // Use local state for auth - single source from supabase client cache
  const [userId, setUserId] = useState<string | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const mountedRef = useRef(true);
  const initDoneRef = useRef(false);

  // Listen to auth state changes - but avoid redundant getSession calls
  useEffect(() => {
    mountedRef.current = true;
    
    const initAuth = async () => {
      // Skip if already initialized (avoid race with onAuthStateChange)
      if (initDoneRef.current) return;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mountedRef.current) return;
        
        const currentUserId = session?.user?.id || null;
        setUserId(currentUserId);

        if (currentUserId) {
          let timeoutId: number | undefined;
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = window.setTimeout(() => reject(new Error('timeout')), 8000);
          });

          try {
            const result = await Promise.race([
              supabase.rpc('is_platform_owner', { _user_id: currentUserId }),
              timeoutPromise.then(() => { throw new Error('timeout'); }),
            ]) as any;

            if (mountedRef.current) {
              setIsPlatformOwner(!!result?.data);
            }
          } catch (err) {
            telemetry.error('org_context_platform_owner_error', { error: String(err) });
          } finally {
            if (timeoutId) window.clearTimeout(timeoutId);
          }
        } else {
          setIsPlatformOwner(false);
        }
      } catch (err) {
        telemetry.error('org_context_init_error', { error: String(err) });
      } finally {
        if (mountedRef.current) {
          setAuthLoading(false);
          initDoneRef.current = true;
        }
      }
    };

    initAuth();

    // Keep a ref to compare previous user id correctly (closure issue fix)
    let previousUserIdLocal: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;
      
      const currentUserId = session?.user?.id || null;
      
      setUserId(currentUserId);

      // Only fetch platform owner status if user changed (use local var to avoid stale closure)
      if (currentUserId && currentUserId !== previousUserIdLocal) {
        previousUserIdLocal = currentUserId;
        let timeoutId: number | undefined;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error('timeout')), 8000);
        });

        try {
          const result = await Promise.race([
            supabase.rpc('is_platform_owner', { _user_id: currentUserId }),
            timeoutPromise.then(() => { throw new Error('timeout'); }),
          ]) as any;

          if (mountedRef.current) {
            setIsPlatformOwner(!!result?.data);
          }
        } catch (err) {
          telemetry.error('org_context_platform_owner_error', { error: String(err) });
        } finally {
          if (timeoutId) window.clearTimeout(timeoutId);
        }
      } else if (!currentUserId) {
        setIsPlatformOwner(false);
      }
      
      if (mountedRef.current) {
        setAuthLoading(false);
        initDoneRef.current = true;
      }
      
      // Clear user org cache on sign out
      if (event === 'SIGNED_OUT') {
        queryClient.removeQueries({ queryKey: ['user-organization'] });
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []); // Empty deps - only run once

  // Recompute subdomain whenever URL query changes (SPA navigation)
  const subdomain = useMemo(() => getSubdomainFromHostname(location.search), [location.search]);
  
  // Get org from subdomain (for login page) - uses SECURITY DEFINER function to bypass RLS
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
    staleTime: 1000 * 60 * 30, // 30 minutes - org data rarely changes
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });

  // Get org from user's membership - only when user is available
  const { data: userOrg, isLoading: isLoadingUserOrg, isFetched: isUserOrgFetched } = useQuery({
    queryKey: ['user-organization', userId],
    queryFn: async () => {
      if (!userId) return null;

      // Try to get user's organization membership (with timeout to avoid infinite loading)
      let timeoutId: number | undefined;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('timeout')), 10000);
      });

      try {
        const result = await Promise.race([
          supabase
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
                login_background_url,
                is_active
              )
            `)
            .eq('user_id', userId)
            .maybeSingle(),
          timeoutPromise.then(() => { throw new Error('timeout'); }),
        ]) as any;

        // Handle RLS errors gracefully - user might be platform owner without org membership
        if (result?.error) {
          telemetry.error('org_user_org_fetch_error', { userId, error: result.error.message });
          return null;
        }

        return result?.data?.organizations as Organization | null;
      } catch (e) {
        telemetry.warn('org_user_org_fetch_timeout', { userId, error: String(e) });
        return null;
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    },
    enabled: !!userId && !authLoading,
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
    if (userId && isLoadingUserOrg) return true;
    return false;
  }, [subdomain, isLoadingSubdomain, authLoading, userId, isLoadingUserOrg]);

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
