CREATE TABLE IF NOT EXISTS public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  countries text[] NOT NULL DEFAULT '{}',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regions_name_org_unique UNIQUE (organization_id, name),
  CONSTRAINT regions_countries_not_empty CHECK (array_length(countries, 1) IS NOT NULL)
);

ALTER TABLE public.ships
ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_regions_organization ON public.regions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ships_region ON public.ships(region_id);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view organization regions" ON public.regions;
CREATE POLICY "Users can view organization regions"
ON public.regions FOR SELECT
TO authenticated
USING (public.user_belongs_to_organization(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Admins can insert organization regions" ON public.regions;
CREATE POLICY "Admins can insert organization regions"
ON public.regions FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_admin_master(auth.uid()) OR public.is_platform_owner(auth.uid()))
  AND public.user_belongs_to_organization(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "Admins can update organization regions" ON public.regions;
CREATE POLICY "Admins can update organization regions"
ON public.regions FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_admin_master(auth.uid()) OR public.is_platform_owner(auth.uid()))
  AND public.user_belongs_to_organization(auth.uid(), organization_id)
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_admin_master(auth.uid()) OR public.is_platform_owner(auth.uid()))
  AND public.user_belongs_to_organization(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "Admins can delete organization regions" ON public.regions;
CREATE POLICY "Admins can delete organization regions"
ON public.regions FOR DELETE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_admin_master(auth.uid()) OR public.is_platform_owner(auth.uid()))
  AND public.user_belongs_to_organization(auth.uid(), organization_id)
);

DROP TRIGGER IF EXISTS update_regions_updated_at ON public.regions;
CREATE TRIGGER update_regions_updated_at
BEFORE UPDATE ON public.regions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
