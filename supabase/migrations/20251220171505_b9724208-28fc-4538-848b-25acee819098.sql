-- Update RLS policy for audit_logs to allow users to see logs for their ships
-- First drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- Create a new policy that allows:
-- 1. Admins to see all logs
-- 2. Non-admins to see logs related to equipment/inspections from their ships
CREATE POLICY "Users can view audit logs for their ships"
ON public.audit_logs
FOR SELECT
USING (
  -- Admins can see everything
  (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin_master', 'admin')
  ))
  OR
  -- Non-admins can see logs for equipment from their ships
  (
    table_name = 'equipment'
    AND EXISTS (
      SELECT 1 FROM equipment e
      JOIN user_ships us ON us.ship_id = e.ship_id
      WHERE e.id = audit_logs.record_id
      AND us.user_id = auth.uid()
    )
  )
  OR
  -- Non-admins can see logs for inspections from their ships
  (
    table_name = 'inspections'
    AND EXISTS (
      SELECT 1 FROM inspections i
      JOIN user_ships us ON us.ship_id = i.ship_id
      WHERE i.id = audit_logs.record_id
      AND us.user_id = auth.uid()
    )
  )
);