import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useUserOrganization, useOrganizationBySubdomain, Organization } from '@/hooks/useOrganizations';

interface OrganizationContextType {
  organization: Organization | null;
  isLoading: boolean;
  subdomain: string | null;
  logoUrl: string | null;
  logoWhiteUrl: string | null;
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
  
  useEffect(() => {
    const detected = getSubdomainFromHostname();
    setSubdomain(detected);
  }, []);

  // First try to get org from subdomain (for login page)
  const { data: orgFromSubdomain, isLoading: isLoadingSubdomain } = useOrganizationBySubdomain(subdomain);
  
  // Then try to get from user's organization (for authenticated users)
  const { data: userOrg, isLoading: isLoadingUserOrg } = useUserOrganization();

  // Prefer user's organization if available, otherwise use subdomain
  const organization = useMemo(() => {
    return userOrg || orgFromSubdomain || null;
  }, [userOrg, orgFromSubdomain]);

  const isLoading = isLoadingSubdomain || isLoadingUserOrg;

  const value = useMemo(() => ({
    organization,
    isLoading,
    subdomain,
    logoUrl: organization?.logo_url || null,
    logoWhiteUrl: organization?.logo_white_url || null,
  }), [organization, isLoading, subdomain]);

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
