CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;

ALTER FUNCTION public.get_dashboard_stats_internal(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_dashboard_stats_internal(uuid) SET SCHEMA private;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_dashboard_stats_internal(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_ship_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, private
AS $$
DECLARE
  caller uuid := (SELECT auth.uid());
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_ship_id IS NOT NULL AND NOT (
    public.is_platform_owner(caller)
    OR public.user_has_ship_access(caller, p_ship_id)
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN private.get_dashboard_stats_internal(p_ship_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;
