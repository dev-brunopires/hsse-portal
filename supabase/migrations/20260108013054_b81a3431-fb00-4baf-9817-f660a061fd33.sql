-- Allow organization-level admin_master users to update their own organization record (needed for logo upload in Settings)
CREATE POLICY "Admin master can update their organization"
ON public.organizations
FOR UPDATE
USING (
  is_platform_owner(auth.uid())
  OR (
    is_admin_master(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_organizations uo
      WHERE uo.user_id = auth.uid()
        AND uo.organization_id = organizations.id
    )
  )
)
WITH CHECK (
  is_platform_owner(auth.uid())
  OR (
    is_admin_master(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_organizations uo
      WHERE uo.user_id = auth.uid()
        AND uo.organization_id = organizations.id
    )
  )
);

-- Tighten insert policies that were flagged as overly permissive
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='System can insert audit logs') THEN
    EXECUTE 'DROP POLICY "System can insert audit logs" ON public.audit_logs';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='login_logs' AND policyname='System can insert login logs') THEN
    EXECUTE 'DROP POLICY "System can insert login logs" ON public.login_logs';
  END IF;
END $$;

CREATE POLICY "Users can insert their own audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND user_id IS NOT NULL
  AND user_id = auth.uid()
);

CREATE POLICY "Users can insert their own login logs"
ON public.login_logs
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND user_id = auth.uid()
);
