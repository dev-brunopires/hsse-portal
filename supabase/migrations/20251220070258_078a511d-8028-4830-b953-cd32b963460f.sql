-- Drop existing policy and create a new one that includes admin_master
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;

CREATE POLICY "Admins can manage categories" 
ON public.categories 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()));