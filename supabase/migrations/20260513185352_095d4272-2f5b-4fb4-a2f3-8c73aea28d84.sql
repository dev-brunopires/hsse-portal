DROP POLICY IF EXISTS "Admins can view org profiles" ON public.profiles;

CREATE POLICY "Admins and supervisors can view org profiles"
ON public.profiles
FOR SELECT
USING (
  is_platform_owner(auth.uid())
  OR (
    user_belongs_to_organization(auth.uid(), organization_id)
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_admin_master(auth.uid())
      OR has_role(auth.uid(), 'supervisor'::app_role)
    )
  )
);

DROP POLICY IF EXISTS "Admins can view roles in their organization" ON public.user_roles;

CREATE POLICY "Admins and supervisors can view roles in their organization"
ON public.user_roles
FOR SELECT
USING (
  (
    user_belongs_to_organization(auth.uid(), organization_id)
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_admin_master(auth.uid())
      OR has_role(auth.uid(), 'supervisor'::app_role)
    )
  )
  OR user_id = auth.uid()
);