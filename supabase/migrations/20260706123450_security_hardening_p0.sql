-- Remove anonymous execution from privileged public functions by default.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.signature);
  END LOOP;
END;
$$;

-- Public organization branding is intentionally available before login.
GRANT EXECUTE ON FUNCTION public.get_org_branding_by_subdomain(text) TO anon, authenticated;

-- Trigger/event-trigger functions are never valid client RPC endpoints.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype IN ('trigger'::regtype, 'event_trigger'::regtype)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn.signature);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND _user_id = (SELECT auth.uid())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_ship_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ship_id
  FROM public.user_ships
  WHERE user_id = _user_id
    AND _user_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.user_organizations
  WHERE user_id = _user_id
    AND _user_id = (SELECT auth.uid())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role IN ('admin_master', 'admin')
    );
$$;

REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_ship_ids(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_organization_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_users(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_ship_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_organization_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_users(uuid) TO authenticated;

-- Keep the existing statistics implementation private and expose a checked wrapper.
ALTER FUNCTION public.get_dashboard_stats(uuid) RENAME TO get_dashboard_stats_internal;
REVOKE ALL ON FUNCTION public.get_dashboard_stats_internal(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_dashboard_stats(p_ship_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := (SELECT auth.uid());
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_ship_id IS NULL THEN
    IF NOT public.is_platform_owner(caller) THEN
      RAISE EXCEPTION 'ship_required';
    END IF;
  ELSIF NOT (
    public.is_platform_owner(caller)
    OR public.user_has_ship_access(caller, p_ship_id)
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN public.get_dashboard_stats_internal(p_ship_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;

-- Remove overlapping permissive policies that let every organization member write.
DROP POLICY IF EXISTS "obs_card_datasets_select" ON public.obs_card_datasets;
DROP POLICY IF EXISTS "obs_card_datasets_insert" ON public.obs_card_datasets;
DROP POLICY IF EXISTS "obs_card_datasets_update" ON public.obs_card_datasets;
DROP POLICY IF EXISTS "obs_card_datasets_delete" ON public.obs_card_datasets;
DROP POLICY IF EXISTS "obs_datasets_select_same_org" ON public.obs_card_datasets;
DROP POLICY IF EXISTS "obs_datasets_insert_admin_master" ON public.obs_card_datasets;
DROP POLICY IF EXISTS "obs_datasets_update_admin_master" ON public.obs_card_datasets;
DROP POLICY IF EXISTS "obs_datasets_delete_admin_master" ON public.obs_card_datasets;

CREATE POLICY "Organization members read observation datasets"
ON public.obs_card_datasets FOR SELECT TO authenticated
USING (
  public.is_platform_owner((SELECT auth.uid()))
  OR public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
);

CREATE POLICY "Administrators create observation datasets"
ON public.obs_card_datasets FOR INSERT TO authenticated
WITH CHECK (
  public.is_platform_owner((SELECT auth.uid()))
  OR (
    public.is_admin_master((SELECT auth.uid()))
    AND public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  )
);

CREATE POLICY "Administrators update observation datasets"
ON public.obs_card_datasets FOR UPDATE TO authenticated
USING (
  public.is_platform_owner((SELECT auth.uid()))
  OR (
    public.is_admin_master((SELECT auth.uid()))
    AND public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  )
)
WITH CHECK (
  public.is_platform_owner((SELECT auth.uid()))
  OR (
    public.is_admin_master((SELECT auth.uid()))
    AND public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  )
);

CREATE POLICY "Administrators delete observation datasets"
ON public.obs_card_datasets FOR DELETE TO authenticated
USING (
  public.is_platform_owner((SELECT auth.uid()))
  OR (
    public.is_admin_master((SELECT auth.uid()))
    AND public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  )
);

DROP POLICY IF EXISTS "obs_cards_select" ON public.obs_cards;
DROP POLICY IF EXISTS "obs_cards_insert" ON public.obs_cards;
DROP POLICY IF EXISTS "obs_cards_update" ON public.obs_cards;
DROP POLICY IF EXISTS "obs_cards_delete" ON public.obs_cards;
DROP POLICY IF EXISTS "obs_cards_select_same_org" ON public.obs_cards;
DROP POLICY IF EXISTS "obs_cards_insert_admin_master" ON public.obs_cards;
DROP POLICY IF EXISTS "obs_cards_update_admin_master" ON public.obs_cards;
DROP POLICY IF EXISTS "obs_cards_delete_admin_master" ON public.obs_cards;

CREATE POLICY "Organization members read observation cards"
ON public.obs_cards FOR SELECT TO authenticated
USING (
  public.is_platform_owner((SELECT auth.uid()))
  OR public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
);

CREATE POLICY "Administrators create observation cards"
ON public.obs_cards FOR INSERT TO authenticated
WITH CHECK (
  public.is_platform_owner((SELECT auth.uid()))
  OR (
    public.is_admin_master((SELECT auth.uid()))
    AND public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  )
);

CREATE POLICY "Administrators update observation cards"
ON public.obs_cards FOR UPDATE TO authenticated
USING (
  public.is_platform_owner((SELECT auth.uid()))
  OR (
    public.is_admin_master((SELECT auth.uid()))
    AND public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  )
)
WITH CHECK (
  public.is_platform_owner((SELECT auth.uid()))
  OR (
    public.is_admin_master((SELECT auth.uid()))
    AND public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  )
);

CREATE POLICY "Administrators delete observation cards"
ON public.obs_cards FOR DELETE TO authenticated
USING (
  public.is_platform_owner((SELECT auth.uid()))
  OR (
    public.is_admin_master((SELECT auth.uid()))
    AND public.user_belongs_to_organization((SELECT auth.uid()), organization_id)
  )
);

-- Constrain private uploads to expected file classes and reasonable sizes.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('avatars', 'organization-logos');

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('inspection-photos', 'maintenance-photos');

UPDATE storage.buckets
SET file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
WHERE id IN ('equipment-documents', 'certificates');

UPDATE storage.buckets
SET file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
WHERE id = 'obs-cards-uploads';

CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  subject_id uuid NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (subject_id, action, window_start)
);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.edge_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.edge_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  _subject_id uuid,
  _action text,
  _limit integer,
  _window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_window timestamptz;
  current_count integer;
BEGIN
  IF _subject_id IS NULL OR _limit < 1 OR _window_seconds < 1 THEN
    RETURN false;
  END IF;

  current_window := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / _window_seconds) * _window_seconds
  );

  INSERT INTO public.edge_rate_limits(subject_id, action, window_start, request_count)
  VALUES (_subject_id, left(_action, 80), current_window, 1)
  ON CONFLICT (subject_id, action, window_start)
  DO UPDATE SET request_count = public.edge_rate_limits.request_count + 1
  RETURNING request_count INTO current_count;

  RETURN current_count <= _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(uuid, text, integer, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(uuid, text, integer, integer)
TO service_role;
