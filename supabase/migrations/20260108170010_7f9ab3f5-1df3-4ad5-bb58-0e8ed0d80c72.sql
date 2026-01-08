-- Fix overly permissive RLS policy on inspection_checklist_items
-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "All authenticated users can view checklist items" ON public.inspection_checklist_items;

-- Create a proper policy that restricts access based on ship access through the inspection
CREATE POLICY "Users can view checklist items of inspections they have access to"
ON public.inspection_checklist_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.inspections i
    WHERE i.id = inspection_checklist_items.inspection_id
    AND (
      -- Platform owners can see all
      public.is_platform_owner(auth.uid())
      OR
      -- Users with ship access can see
      (i.ship_id IS NOT NULL AND public.user_has_ship_access(i.ship_id, auth.uid()))
      OR
      -- Admin/Admin Master of the organization can see all within their org
      public.is_admin_master(auth.uid())
    )
  )
);