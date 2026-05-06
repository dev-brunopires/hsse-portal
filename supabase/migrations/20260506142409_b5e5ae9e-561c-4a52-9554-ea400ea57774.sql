-- Restrict direct INSERT on audit_logs: only triggers (SECURITY DEFINER) and service role can write.
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.audit_logs;

-- Restrict login_logs admin viewing to platform owners only (no longer admin_master across orgs).
DROP POLICY IF EXISTS "Users can view own login logs" ON public.login_logs;
CREATE POLICY "Users can view own login logs"
ON public.login_logs
FOR SELECT
USING ((user_id = auth.uid()) OR is_platform_owner(auth.uid()));