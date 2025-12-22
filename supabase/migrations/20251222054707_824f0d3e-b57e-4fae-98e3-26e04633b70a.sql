
-- Migrate existing data to SBM organization
UPDATE public.ships SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.categories SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.notifications SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.checklist_templates SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.user_roles SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;
UPDATE public.profiles SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE organization_id IS NULL;

-- Migrate existing users to user_organizations
INSERT INTO public.user_organizations (user_id, organization_id)
SELECT DISTINCT user_id, '00000000-0000-0000-0000-000000000001'::uuid
FROM public.profiles
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Update RLS policies for ships to include organization filtering
DROP POLICY IF EXISTS "Admins can manage ships" ON public.ships;
DROP POLICY IF EXISTS "Users can view assigned ships" ON public.ships;

CREATE POLICY "Admins can manage ships"
ON public.ships FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid())) 
  AND user_belongs_to_organization(auth.uid(), organization_id)
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid())) 
  AND user_belongs_to_organization(auth.uid(), organization_id)
);

CREATE POLICY "Users can view assigned ships"
ON public.ships FOR SELECT
USING (
  user_belongs_to_organization(auth.uid(), organization_id) AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    is_admin_master(auth.uid()) OR 
    id IN (SELECT ship_id FROM user_ships WHERE user_id = auth.uid())
  )
);

-- Update RLS policies for categories
DROP POLICY IF EXISTS "All authenticated users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Admins technicians and supervisors can manage categories" ON public.categories;

CREATE POLICY "Users can view categories in their organization"
ON public.categories FOR SELECT
USING (user_belongs_to_organization(auth.uid(), organization_id));

CREATE POLICY "Admins technicians and supervisors can manage categories"
ON public.categories FOR ALL
USING (
  user_belongs_to_organization(auth.uid(), organization_id) AND
  (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()) OR has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
)
WITH CHECK (
  user_belongs_to_organization(auth.uid(), organization_id) AND
  (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()) OR has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
);

-- Update RLS policies for profiles to include organization
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view profiles in their organization"
ON public.profiles FOR SELECT
USING (
  user_belongs_to_organization(auth.uid(), organization_id) OR 
  user_id = auth.uid() OR
  is_platform_owner(auth.uid())
);

-- Update RLS policies for user_roles to include organization
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Admins can view roles in their organization"
ON public.user_roles FOR SELECT
USING (
  (user_belongs_to_organization(auth.uid(), organization_id) AND
  (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()))) OR
  user_id = auth.uid()
);

CREATE POLICY "Admins can insert roles in their organization"
ON public.user_roles FOR INSERT
WITH CHECK (
  user_belongs_to_organization(auth.uid(), organization_id) AND
  (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()))
);

CREATE POLICY "Admins can update roles in their organization"
ON public.user_roles FOR UPDATE
USING (
  user_belongs_to_organization(auth.uid(), organization_id) AND
  (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()))
);

CREATE POLICY "Admins can delete roles in their organization"
ON public.user_roles FOR DELETE
USING (
  user_belongs_to_organization(auth.uid(), organization_id) AND
  (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()))
);
