-- Drop the existing admin-only policy
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;

-- Create new policy that includes technicians and supervisors
CREATE POLICY "Admins technicians and supervisors can manage categories" 
ON public.categories 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  is_admin_master(auth.uid()) OR 
  has_role(auth.uid(), 'technician'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  is_admin_master(auth.uid()) OR 
  has_role(auth.uid(), 'technician'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);