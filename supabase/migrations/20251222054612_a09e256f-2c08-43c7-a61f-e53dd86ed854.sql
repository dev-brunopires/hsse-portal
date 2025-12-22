
-- RLS Policies for organizations
CREATE POLICY "Platform owners can manage all organizations"
ON public.organizations FOR ALL
USING (is_platform_owner(auth.uid()))
WITH CHECK (is_platform_owner(auth.uid()));

CREATE POLICY "Users can view their organization"
ON public.organizations FOR SELECT
USING (user_belongs_to_organization(auth.uid(), id));

-- RLS Policies for platform_owners
CREATE POLICY "Platform owners can view platform_owners"
ON public.platform_owners FOR SELECT
USING (is_platform_owner(auth.uid()));

CREATE POLICY "Platform owners can manage platform_owners"
ON public.platform_owners FOR ALL
USING (is_platform_owner(auth.uid()))
WITH CHECK (is_platform_owner(auth.uid()));

-- RLS Policies for user_organizations
CREATE POLICY "Platform owners can manage user_organizations"
ON public.user_organizations FOR ALL
USING (is_platform_owner(auth.uid()))
WITH CHECK (is_platform_owner(auth.uid()));

CREATE POLICY "Admins can manage their org user_organizations"
ON public.user_organizations FOR ALL
USING (
  user_belongs_to_organization(auth.uid(), organization_id) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()))
)
WITH CHECK (
  user_belongs_to_organization(auth.uid(), organization_id) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()))
);

CREATE POLICY "Users can view their own org membership"
ON public.user_organizations FOR SELECT
USING (user_id = auth.uid());

-- Create default SBM organization
INSERT INTO public.organizations (id, name, slug, subdomain, is_active)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'SBM Offshore', 'sbmoffshore', 'sbmoffshore', true);
