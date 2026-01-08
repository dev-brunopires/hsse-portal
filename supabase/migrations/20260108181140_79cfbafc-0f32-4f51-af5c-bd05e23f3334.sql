-- Expose only public organization branding for the login page without making the whole organizations table publicly readable.

CREATE OR REPLACE FUNCTION public.get_org_branding_by_subdomain(_subdomain text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  subdomain text,
  logo_url text,
  logo_white_url text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug, o.subdomain, o.logo_url, o.logo_white_url, o.is_active
  FROM public.organizations o
  WHERE o.subdomain = _subdomain
    AND o.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_branding_by_subdomain(text) TO anon, authenticated;
