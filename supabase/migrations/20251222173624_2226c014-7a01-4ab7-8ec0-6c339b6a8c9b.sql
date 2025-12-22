-- Drop the existing policy that causes circular dependency
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;

-- Create a simpler policy that allows users to view organizations they belong to
-- This avoids the circular dependency by using a direct subquery
CREATE POLICY "Users can view their organization"
ON public.organizations
FOR SELECT
USING (
  is_platform_owner(auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM public.user_organizations uo 
    WHERE uo.user_id = auth.uid() 
    AND uo.organization_id = organizations.id
  )
);