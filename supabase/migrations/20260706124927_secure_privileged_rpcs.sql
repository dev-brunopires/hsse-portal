CREATE SCHEMA IF NOT EXISTS private;

ALTER FUNCTION public.delete_obs_card_dataset_batch(uuid, integer)
RENAME TO delete_obs_card_dataset_batch_internal;
ALTER FUNCTION public.delete_obs_card_dataset_batch_internal(uuid, integer)
SET SCHEMA private;
REVOKE ALL ON FUNCTION private.delete_obs_card_dataset_batch_internal(uuid, integer)
FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.delete_obs_card_dataset_batch(
  _dataset_id uuid,
  _batch_size integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  caller uuid := (SELECT auth.uid());
  dataset_org uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT organization_id
  INTO dataset_org
  FROM public.obs_card_datasets
  WHERE id = _dataset_id;

  IF dataset_org IS NULL THEN
    RAISE EXCEPTION 'dataset_not_found';
  END IF;

  IF NOT (
    public.is_platform_owner(caller)
    OR (
      public.is_admin_master(caller)
      AND public.user_belongs_to_organization(caller, dataset_org)
    )
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN private.delete_obs_card_dataset_batch_internal(
    _dataset_id,
    LEAST(GREATEST(_batch_size, 1), 1000)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_obs_card_dataset_batch(uuid, integer)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_obs_card_dataset_batch(uuid, integer)
TO authenticated;

-- This older all-at-once deletion endpoint is unused by the portal.
REVOKE ALL ON FUNCTION public.delete_obs_card_dataset(uuid)
FROM PUBLIC, anon, authenticated;

-- Maintenance functions are invoked by triggers/jobs, not directly by clients.
REVOKE ALL ON FUNCTION public.generate_pending_for_equipment(uuid, integer)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_pending_inspections()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.regenerate_pending_for_category(uuid)
FROM PUBLIC, anon, authenticated;
