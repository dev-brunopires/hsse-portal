
-- ============ OBS CARDS MODULE ============

-- Datasets table
CREATE TABLE public.obs_card_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  original_filename text,
  row_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing', -- processing | ready | failed
  column_mapping jsonb,
  error_message text,
  source_storage_path text,
  uploaded_by uuid,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obs_card_datasets TO authenticated;
GRANT ALL ON public.obs_card_datasets TO service_role;

ALTER TABLE public.obs_card_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obs_datasets_select_same_org"
  ON public.obs_card_datasets FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_organization(auth.uid(), organization_id));

CREATE POLICY "obs_datasets_insert_admin_master"
  ON public.obs_card_datasets FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_admin_master(auth.uid()) OR public.is_platform_owner(auth.uid()))
    AND public.user_belongs_to_organization(auth.uid(), organization_id)
  );

CREATE POLICY "obs_datasets_update_admin_master"
  ON public.obs_card_datasets FOR UPDATE
  TO authenticated
  USING (
    (public.is_admin_master(auth.uid()) OR public.is_platform_owner(auth.uid()))
    AND public.user_belongs_to_organization(auth.uid(), organization_id)
  );

CREATE POLICY "obs_datasets_delete_admin_master"
  ON public.obs_card_datasets FOR DELETE
  TO authenticated
  USING (
    (public.is_admin_master(auth.uid()) OR public.is_platform_owner(auth.uid()))
    AND public.user_belongs_to_organization(auth.uid(), organization_id)
  );

CREATE TRIGGER trg_obs_datasets_updated_at
  BEFORE UPDATE ON public.obs_card_datasets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_obs_datasets_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.obs_card_datasets
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_changes();

-- Cards table
CREATE TABLE public.obs_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.obs_card_datasets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  obs_type text, -- BCO | PSO
  status text,   -- SAFE | UNSAFE
  creation_date date,
  area text,
  department text,
  description text,
  action_taken text,
  responsible text,
  due_date date,
  close_date date,
  category text,
  severity text, -- low | medium | high
  time_to_close_days integer,
  is_open boolean,
  month integer,
  year integer,
  raw_row jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_obs_cards_dataset ON public.obs_cards(dataset_id);
CREATE INDEX idx_obs_cards_org ON public.obs_cards(organization_id);
CREATE INDEX idx_obs_cards_type ON public.obs_cards(obs_type);
CREATE INDEX idx_obs_cards_creation ON public.obs_cards(creation_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obs_cards TO authenticated;
GRANT ALL ON public.obs_cards TO service_role;

ALTER TABLE public.obs_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obs_cards_select_same_org"
  ON public.obs_cards FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_organization(auth.uid(), organization_id));

CREATE POLICY "obs_cards_insert_admin_master"
  ON public.obs_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_admin_master(auth.uid()) OR public.is_platform_owner(auth.uid()))
    AND public.user_belongs_to_organization(auth.uid(), organization_id)
  );

CREATE POLICY "obs_cards_update_admin_master"
  ON public.obs_cards FOR UPDATE
  TO authenticated
  USING (
    (public.is_admin_master(auth.uid()) OR public.is_platform_owner(auth.uid()))
    AND public.user_belongs_to_organization(auth.uid(), organization_id)
  );

CREATE POLICY "obs_cards_delete_admin_master"
  ON public.obs_cards FOR DELETE
  TO authenticated
  USING (
    (public.is_admin_master(auth.uid()) OR public.is_platform_owner(auth.uid()))
    AND public.user_belongs_to_organization(auth.uid(), organization_id)
  );

CREATE TRIGGER trg_obs_cards_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.obs_cards
  FOR EACH ROW EXECUTE FUNCTION public.log_generic_changes();

-- Storage bucket (private, per-org isolation in path)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('obs-cards-uploads', 'obs-cards-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "obs_uploads_select_org"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'obs-cards-uploads'
    AND public.user_belongs_to_organization(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

CREATE POLICY "obs_uploads_insert_admin_master"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'obs-cards-uploads'
    AND (public.is_admin_master(auth.uid()) OR public.is_platform_owner(auth.uid()))
    AND public.user_belongs_to_organization(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

CREATE POLICY "obs_uploads_delete_admin_master"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'obs-cards-uploads'
    AND (public.is_admin_master(auth.uid()) OR public.is_platform_owner(auth.uid()))
    AND public.user_belongs_to_organization(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

-- Extend revert_audit_log allowlist
CREATE OR REPLACE FUNCTION public.revert_audit_log(_log_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log public.audit_logs%ROWTYPE;
  v_allowed_tables text[] := ARRAY[
    'equipment','inspections','ships','categories','profiles',
    'certificates','maintenance_requests','heat_stress_measurements',
    'ship_areas','equipment_relationships',
    'obs_card_datasets','obs_cards'
  ];
  v_sets text;
  v_user uuid;
  v_user_name text;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT (public.is_admin_master(v_user) OR public.is_platform_owner(v_user)) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  SELECT * INTO v_log FROM public.audit_logs WHERE id = _log_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'log_not_found'; END IF;
  IF v_log.reverted_at IS NOT NULL THEN RAISE EXCEPTION 'already_reverted'; END IF;
  IF NOT (v_log.table_name = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'table_not_revertable: %', v_log.table_name;
  END IF;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user;

  IF v_log.action = 'INSERT' THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', v_log.table_name) USING v_log.record_id;
  ELSIF v_log.action = 'DELETE' THEN
    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)',
      v_log.table_name, v_log.table_name
    ) USING v_log.old_data;
  ELSIF v_log.action = 'UPDATE' THEN
    SELECT string_agg(format('%I = r.%I', column_name, column_name), ', ') INTO v_sets
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = v_log.table_name
      AND column_name <> 'id' AND v_log.old_data ? column_name;
    IF v_sets IS NULL THEN RAISE EXCEPTION 'no_columns_to_restore'; END IF;
    EXECUTE format(
      'UPDATE public.%I AS t SET %s FROM jsonb_populate_record(NULL::public.%I, $1) AS r WHERE t.id = $2',
      v_log.table_name, v_sets, v_log.table_name
    ) USING v_log.old_data, v_log.record_id;
  ELSE
    RAISE EXCEPTION 'unknown_action: %', v_log.action;
  END IF;

  UPDATE public.audit_logs
     SET reverted_at = now(), reverted_by = v_user, reverted_by_name = v_user_name
   WHERE id = _log_id;

  RETURN jsonb_build_object('success', true, 'log_id', _log_id);
END;
$function$;
