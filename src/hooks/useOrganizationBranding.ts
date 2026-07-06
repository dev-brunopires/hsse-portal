import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';

export interface OrganizationBranding {
  name: string;
  logoUrl: string | null;
  logoWhiteUrl: string | null;
  primaryColor: [number, number, number];
}

// Default branding when no organization is set
const DEFAULT_BRANDING: OrganizationBranding = {
  name: 'HSSE Connect',
  logoUrl: null,
  logoWhiteUrl: null,
  primaryColor: [22, 85, 154], // Default blue
};

/**
 * Hook to get organization branding for reports and QR codes
 */
export function useOrganizationBranding(): OrganizationBranding {
  const { organization, logoUrl, logoWhiteUrl } = useOrganization();

  if (!organization) {
    return DEFAULT_BRANDING;
  }

  return {
    name: organization.name,
    logoUrl: logoUrl,
    logoWhiteUrl: logoWhiteUrl,
    primaryColor: [22, 85, 154], // Can be extended to support custom colors per org
  };
}

/**
 * Fetches organization branding by user ID (for use outside React components)
 */
export async function fetchOrganizationBranding(userId: string): Promise<OrganizationBranding> {
  try {
    // Get user's organization
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!userOrg?.organization_id) {
      return DEFAULT_BRANDING;
    }

    // Get organization details
    const { data: org } = await supabase
      .from('organizations')
      .select('name, logo_url, logo_white_url')
      .eq('id', userOrg.organization_id)
      .single();

    if (!org) {
      return DEFAULT_BRANDING;
    }

    return {
      name: org.name,
      logoUrl: org.logo_url,
      logoWhiteUrl: org.logo_white_url,
      primaryColor: [22, 85, 154],
    };
  } catch (error) {
    console.error('Error fetching organization branding:', error);
    return DEFAULT_BRANDING;
  }
}

/**
 * Converts an image URL to base64 for PDF embedding
 */
export async function loadImageAsBase64(url: string | null): Promise<string | null> {
  if (!url) return null;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}
