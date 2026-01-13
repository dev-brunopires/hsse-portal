-- Drop and recreate the RPC function to include login_background_url
DROP FUNCTION IF EXISTS public.get_org_branding_by_subdomain(text);

CREATE FUNCTION public.get_org_branding_by_subdomain(_subdomain text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  subdomain text,
  logo_url text,
  logo_white_url text,
  login_background_url text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.slug,
    o.subdomain,
    o.logo_url,
    o.logo_white_url,
    o.login_background_url,
    o.is_active
  FROM organizations o
  WHERE o.subdomain = _subdomain
  LIMIT 1;
END;
$$;