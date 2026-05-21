DROP POLICY IF EXISTS "Admins can delete heat stress" ON public.heat_stress_measurements;
CREATE POLICY "Supervisors and above can delete heat stress"
ON public.heat_stress_measurements
FOR DELETE
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_admin_master(auth.uid())
    OR has_role(auth.uid(), 'supervisor'::app_role)
  )
  AND user_has_ship_access(auth.uid(), ship_id)
);