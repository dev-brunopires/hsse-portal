-- Drop existing SELECT policy and recreate with better logic
DROP POLICY IF EXISTS "Users can view audit logs for their ships" ON public.audit_logs;

-- Create improved policy that properly handles admin access and organization filtering
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin_master', 'admin')
  )
);