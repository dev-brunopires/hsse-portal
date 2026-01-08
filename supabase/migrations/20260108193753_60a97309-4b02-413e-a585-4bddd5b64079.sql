-- Drop existing policy
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- Create organization-scoped policy for audit logs
CREATE POLICY "Admins can view audit logs for their organization"
ON public.audit_logs
FOR SELECT
USING (
  -- Platform owners can see all audit logs
  public.is_platform_owner(auth.uid())
  OR
  -- Admin/admin_master can see logs for their organization
  (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin_master', 'admin')
    )
    AND (
      -- Equipment logs: check organization via ship
      (table_name = 'equipment' AND EXISTS (
        SELECT 1 FROM equipment e
        JOIN ships s ON s.id = e.ship_id
        JOIN user_organizations uo ON uo.organization_id = s.organization_id
        WHERE e.id = audit_logs.record_id::uuid AND uo.user_id = auth.uid()
      ))
      OR
      -- Inspection logs: check organization via ship
      (table_name = 'inspections' AND EXISTS (
        SELECT 1 FROM inspections i
        JOIN ships s ON s.id = i.ship_id
        JOIN user_organizations uo ON uo.organization_id = s.organization_id
        WHERE i.id = audit_logs.record_id::uuid AND uo.user_id = auth.uid()
      ))
      OR
      -- Ship logs: check organization directly
      (table_name = 'ships' AND EXISTS (
        SELECT 1 FROM ships s
        JOIN user_organizations uo ON uo.organization_id = s.organization_id
        WHERE s.id = audit_logs.record_id::uuid AND uo.user_id = auth.uid()
      ))
      OR
      -- Category logs: check organization directly
      (table_name = 'categories' AND EXISTS (
        SELECT 1 FROM categories c
        JOIN user_organizations uo ON uo.organization_id = c.organization_id
        WHERE c.id = audit_logs.record_id::uuid AND uo.user_id = auth.uid()
      ))
      OR
      -- Profile logs: check organization via profiles table
      (table_name = 'profiles' AND EXISTS (
        SELECT 1 FROM profiles p
        JOIN user_organizations uo ON uo.organization_id = p.organization_id
        WHERE p.id = audit_logs.record_id::uuid AND uo.user_id = auth.uid()
      ))
    )
  )
);