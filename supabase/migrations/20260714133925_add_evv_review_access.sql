-- Register the V&V review queue in the fine-grained access model.

WITH evv_module AS (
  SELECT id
  FROM public.app_modules
  WHERE key = 'evv'
)
INSERT INTO public.app_module_pages (module_id, key, name, route, description, sort_order, is_active)
SELECT
  evv_module.id,
  'review',
  'Revisao V&V',
  '/evv/review',
  'Fila de revisao de formularios V&V por supervisores e administradores',
  35,
  true
FROM evv_module
ON CONFLICT (module_id, key) DO UPDATE
SET name = excluded.name,
    route = excluded.route,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

INSERT INTO public.user_module_permissions (
  user_id,
  organization_id,
  module_key,
  page_key,
  can_view,
  can_create,
  can_edit,
  can_delete,
  can_approve,
  can_export,
  can_admin
)
SELECT
  existing.user_id,
  existing.organization_id,
  'evv',
  'review',
  true,
  false,
  false,
  false,
  true,
  BOOL_OR(COALESCE(existing.can_export, false) OR COALESCE(existing.can_admin, false)),
  BOOL_OR(COALESCE(existing.can_admin, false))
FROM public.user_module_permissions existing
WHERE existing.module_key = 'evv'
  AND existing.page_key IN ('history', 'reports')
  AND (
    COALESCE(existing.can_approve, false)
    OR COALESCE(existing.can_admin, false)
    OR COALESCE(existing.can_edit, false)
  )
GROUP BY existing.user_id, existing.organization_id
ON CONFLICT (user_id, organization_id, module_key, page_key) DO UPDATE
SET can_view = public.user_module_permissions.can_view OR excluded.can_view,
    can_approve = public.user_module_permissions.can_approve OR excluded.can_approve,
    can_export = public.user_module_permissions.can_export OR excluded.can_export,
    can_admin = public.user_module_permissions.can_admin OR excluded.can_admin,
    updated_at = now();

INSERT INTO public.access_profile_permissions (
  profile_id,
  module_key,
  page_key,
  can_view,
  can_create,
  can_edit,
  can_delete,
  can_approve,
  can_export,
  can_admin
)
SELECT
  existing.profile_id,
  'evv',
  'review',
  true,
  false,
  false,
  false,
  true,
  BOOL_OR(COALESCE(existing.can_export, false) OR COALESCE(existing.can_admin, false)),
  BOOL_OR(COALESCE(existing.can_admin, false))
FROM public.access_profile_permissions existing
WHERE existing.module_key = 'evv'
  AND existing.page_key IN ('history', 'reports')
  AND (
    COALESCE(existing.can_approve, false)
    OR COALESCE(existing.can_admin, false)
    OR COALESCE(existing.can_edit, false)
  )
GROUP BY existing.profile_id
ON CONFLICT (profile_id, module_key, page_key) DO UPDATE
SET can_view = public.access_profile_permissions.can_view OR excluded.can_view,
    can_approve = public.access_profile_permissions.can_approve OR excluded.can_approve,
    can_export = public.access_profile_permissions.can_export OR excluded.can_export,
    can_admin = public.access_profile_permissions.can_admin OR excluded.can_admin,
    updated_at = now();
