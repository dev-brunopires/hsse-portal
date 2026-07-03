CREATE OR REPLACE FUNCTION public.get_my_access_context()
RETURNS TABLE(role public.app_role, ship_ids uuid[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_role AS (
    SELECT ur.role
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    ORDER BY CASE ur.role
      WHEN 'admin_master'::public.app_role THEN 1
      WHEN 'admin'::public.app_role THEN 2
      WHEN 'supervisor'::public.app_role THEN 3
      WHEN 'technician'::public.app_role THEN 4
      WHEN 'viewer'::public.app_role THEN 5
      ELSE 6
    END
    LIMIT 1
  ),
  accessible_ships AS (
    SELECT CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.platform_owners po
        WHERE po.user_id = auth.uid()
      ) THEN ARRAY(
        SELECT s.id
        FROM public.ships s
        ORDER BY s.name
      )
      WHEN EXISTS (
        SELECT 1
        FROM my_role mr
        WHERE mr.role IN ('admin_master'::public.app_role, 'admin'::public.app_role)
      ) THEN ARRAY(
        SELECT s.id
        FROM public.ships s
        INNER JOIN public.user_organizations uo ON uo.organization_id = s.organization_id
        WHERE uo.user_id = auth.uid()
        ORDER BY s.name
      )
      ELSE ARRAY(
        SELECT us.ship_id
        FROM public.user_ships us
        WHERE us.user_id = auth.uid()
        ORDER BY us.created_at, us.ship_id
      )
    END AS ship_ids
  )
  SELECT
    (SELECT mr.role FROM my_role mr) AS role,
    COALESCE((SELECT accessible_ships.ship_ids FROM accessible_ships), ARRAY[]::uuid[]) AS ship_ids
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_my_access_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_access_context() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_access_context() TO authenticated;
