ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_audit_log_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ship_id uuid;
BEGIN
  NEW.organization_id := COALESCE(
    NEW.organization_id,
    NULLIF(NEW.new_data->>'organization_id', '')::uuid,
    NULLIF(NEW.old_data->>'organization_id', '')::uuid
  );

  IF NEW.organization_id IS NULL THEN
    v_ship_id := COALESCE(
      NULLIF(NEW.new_data->>'ship_id', '')::uuid,
      NULLIF(NEW.old_data->>'ship_id', '')::uuid
    );

    IF v_ship_id IS NOT NULL THEN
      SELECT organization_id
      INTO NEW.organization_id
      FROM public.ships
      WHERE id = v_ship_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_audit_log_organization_trigger ON public.audit_logs;
CREATE TRIGGER set_audit_log_organization_trigger
BEFORE INSERT OR UPDATE OF old_data, new_data ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_log_organization();

UPDATE public.audit_logs
SET organization_id = COALESCE(
  NULLIF(new_data->>'organization_id', '')::uuid,
  NULLIF(old_data->>'organization_id', '')::uuid
)
WHERE organization_id IS NULL
  AND COALESCE(new_data->>'organization_id', old_data->>'organization_id') IS NOT NULL;

UPDATE public.audit_logs al
SET organization_id = s.organization_id
FROM public.ships s
WHERE al.organization_id IS NULL
  AND s.id = COALESCE(
    NULLIF(al.new_data->>'ship_id', '')::uuid,
    NULLIF(al.old_data->>'ship_id', '')::uuid
  );

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_created_at
  ON public.audit_logs (organization_id, created_at DESC);

DROP POLICY IF EXISTS "Admins can view audit logs for their organization"
  ON public.audit_logs;

CREATE POLICY "Admins can view audit logs for their organization"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  public.is_platform_owner((SELECT auth.uid()))
  OR (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('admin_master', 'admin')
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_organizations uo
        WHERE uo.user_id = (SELECT auth.uid())
          AND uo.organization_id = audit_logs.organization_id
      )
      OR (
        audit_logs.organization_id IS NULL
        AND (
          (table_name = 'equipment' AND EXISTS (
            SELECT 1
            FROM public.equipment e
            JOIN public.ships s ON s.id = e.ship_id
            JOIN public.user_organizations uo ON uo.organization_id = s.organization_id
            WHERE e.id = audit_logs.record_id
              AND uo.user_id = (SELECT auth.uid())
          ))
          OR (table_name = 'inspections' AND EXISTS (
            SELECT 1
            FROM public.inspections i
            JOIN public.ships s ON s.id = i.ship_id
            JOIN public.user_organizations uo ON uo.organization_id = s.organization_id
            WHERE i.id = audit_logs.record_id
              AND uo.user_id = (SELECT auth.uid())
          ))
          OR (table_name = 'ships' AND EXISTS (
            SELECT 1
            FROM public.ships s
            JOIN public.user_organizations uo ON uo.organization_id = s.organization_id
            WHERE s.id = audit_logs.record_id
              AND uo.user_id = (SELECT auth.uid())
          ))
          OR (table_name = 'categories' AND EXISTS (
            SELECT 1
            FROM public.categories c
            JOIN public.user_organizations uo ON uo.organization_id = c.organization_id
            WHERE c.id = audit_logs.record_id
              AND uo.user_id = (SELECT auth.uid())
          ))
          OR (table_name = 'profiles' AND EXISTS (
            SELECT 1
            FROM public.profiles p
            JOIN public.user_organizations uo ON uo.organization_id = p.organization_id
            WHERE p.id = audit_logs.record_id
              AND uo.user_id = (SELECT auth.uid())
          ))
        )
      )
    )
  )
);
