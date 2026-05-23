-- 1. Add revert tracking columns to audit_logs
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS reverted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reverted_by uuid,
  ADD COLUMN IF NOT EXISTS reverted_by_name text,
  ADD COLUMN IF NOT EXISTS revert_log_id uuid;

-- 2. Generic revert function (admin_master / platform_owner only)
CREATE OR REPLACE FUNCTION public.revert_audit_log(_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log public.audit_logs%ROWTYPE;
  v_allowed_tables text[] := ARRAY[
    'equipment','inspections','ships','categories','profiles',
    'certificates','maintenance_requests','heat_stress_measurements',
    'ship_areas','equipment_relationships'
  ];
  v_sets text;
  v_user uuid;
  v_user_name text;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT (public.is_admin_master(v_user) OR public.is_platform_owner(v_user)) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  SELECT * INTO v_log FROM public.audit_logs WHERE id = _log_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'log_not_found'; END IF;

  IF v_log.reverted_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_reverted';
  END IF;

  IF NOT (v_log.table_name = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'table_not_revertable: %', v_log.table_name;
  END IF;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user;

  IF v_log.action = 'INSERT' THEN
    -- Undo creation: delete the record
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', v_log.table_name)
      USING v_log.record_id;

  ELSIF v_log.action = 'DELETE' THEN
    -- Undo deletion: recreate the record
    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)',
      v_log.table_name, v_log.table_name
    ) USING v_log.old_data;

  ELSIF v_log.action = 'UPDATE' THEN
    -- Restore previous values for columns present in old_data
    SELECT string_agg(format('%I = r.%I', column_name, column_name), ', ')
      INTO v_sets
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = v_log.table_name
      AND column_name <> 'id'
      AND v_log.old_data ? column_name;

    IF v_sets IS NULL THEN
      RAISE EXCEPTION 'no_columns_to_restore';
    END IF;

    EXECUTE format(
      'UPDATE public.%I AS t SET %s FROM jsonb_populate_record(NULL::public.%I, $1) AS r WHERE t.id = $2',
      v_log.table_name, v_sets, v_log.table_name
    ) USING v_log.old_data, v_log.record_id;
  ELSE
    RAISE EXCEPTION 'unknown_action: %', v_log.action;
  END IF;

  -- Mark original log as reverted
  UPDATE public.audit_logs
     SET reverted_at = now(),
         reverted_by = v_user,
         reverted_by_name = v_user_name
   WHERE id = _log_id;

  RETURN jsonb_build_object('success', true, 'log_id', _log_id);
END;
$$;

REVOKE ALL ON FUNCTION public.revert_audit_log(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.revert_audit_log(uuid) TO authenticated;

-- 3. Generic audit logger for additional tables
CREATE OR REPLACE FUNCTION public.log_generic_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_cols TEXT[];
  old_json JSONB;
  new_json JSONB;
  v_user_id UUID;
  v_user_name TEXT;
  v_tbl text := TG_TABLE_NAME;
  v_rec_id uuid;
BEGIN
  v_user_id := auth.uid();
  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user_id;

  IF TG_OP = 'INSERT' THEN
    v_rec_id := (to_jsonb(NEW)->>'id')::uuid;
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_id, user_name)
    VALUES (v_tbl, v_rec_id, 'INSERT', to_jsonb(NEW), v_user_id, v_user_name);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    v_rec_id := (new_json->>'id')::uuid;

    SELECT ARRAY_AGG(key) INTO changed_cols
    FROM jsonb_each(new_json) n
    WHERE n.value IS DISTINCT FROM (old_json -> n.key)
      AND n.key NOT IN ('updated_at');

    IF changed_cols IS NOT NULL AND array_length(changed_cols, 1) > 0 THEN
      INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_name)
      VALUES (v_tbl, v_rec_id, 'UPDATE', old_json, new_json, changed_cols, v_user_id, v_user_name);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_rec_id := (to_jsonb(OLD)->>'id')::uuid;
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, user_id, user_name)
    VALUES (v_tbl, v_rec_id, 'DELETE', to_jsonb(OLD), v_user_id, v_user_name);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 4. Attach generic audit trigger to missing tables (drop & recreate idempotently)
DROP TRIGGER IF EXISTS audit_certificates_changes ON public.certificates;
CREATE TRIGGER audit_certificates_changes
AFTER INSERT OR UPDATE OR DELETE ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.log_generic_changes();

DROP TRIGGER IF EXISTS audit_maintenance_requests_changes ON public.maintenance_requests;
CREATE TRIGGER audit_maintenance_requests_changes
AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_requests
FOR EACH ROW EXECUTE FUNCTION public.log_generic_changes();

DROP TRIGGER IF EXISTS audit_heat_stress_changes ON public.heat_stress_measurements;
CREATE TRIGGER audit_heat_stress_changes
AFTER INSERT OR UPDATE OR DELETE ON public.heat_stress_measurements
FOR EACH ROW EXECUTE FUNCTION public.log_generic_changes();

DROP TRIGGER IF EXISTS audit_ship_areas_changes ON public.ship_areas;
CREATE TRIGGER audit_ship_areas_changes
AFTER INSERT OR UPDATE OR DELETE ON public.ship_areas
FOR EACH ROW EXECUTE FUNCTION public.log_generic_changes();