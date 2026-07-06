-- Backfill access for the Safety Observation form page.
-- Users who already had access to OBS Cards before this page existed should
-- not be locked out after a hard refresh.

WITH obs_module AS (
  SELECT id
  FROM public.app_modules
  WHERE key = 'obs_cards'
)
INSERT INTO public.app_module_pages (module_id, key, name, route, description, sort_order, is_active)
SELECT
  obs_module.id,
  'safety_observation',
  'Formulario de Observacao de Seguranca',
  '/obs-cards/safety-observation',
  'Registro operacional de observacoes de seguranca por navio e area',
  15,
  true
FROM obs_module
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
  'obs_cards',
  'safety_observation',
  true,
  BOOL_OR(COALESCE(existing.can_create, false) OR COALESCE(existing.can_edit, false) OR COALESCE(existing.can_admin, false)),
  BOOL_OR(COALESCE(existing.can_edit, false) OR COALESCE(existing.can_admin, false)),
  false,
  false,
  BOOL_OR(COALESCE(existing.can_export, false) OR COALESCE(existing.can_admin, false)),
  BOOL_OR(COALESCE(existing.can_admin, false))
FROM public.user_module_permissions existing
WHERE existing.module_key = 'obs_cards'
  AND existing.page_key IN ('dashboard', 'upload', 'datasets')
  AND COALESCE(existing.can_view, false) = true
GROUP BY existing.user_id, existing.organization_id
ON CONFLICT (user_id, organization_id, module_key, page_key) DO UPDATE
SET can_view = public.user_module_permissions.can_view OR excluded.can_view,
    can_create = public.user_module_permissions.can_create OR excluded.can_create,
    can_edit = public.user_module_permissions.can_edit OR excluded.can_edit,
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
  'obs_cards',
  'safety_observation',
  true,
  BOOL_OR(COALESCE(existing.can_create, false) OR COALESCE(existing.can_edit, false) OR COALESCE(existing.can_admin, false)),
  BOOL_OR(COALESCE(existing.can_edit, false) OR COALESCE(existing.can_admin, false)),
  false,
  false,
  BOOL_OR(COALESCE(existing.can_export, false) OR COALESCE(existing.can_admin, false)),
  BOOL_OR(COALESCE(existing.can_admin, false))
FROM public.access_profile_permissions existing
WHERE existing.module_key = 'obs_cards'
  AND existing.page_key IN ('dashboard', 'upload', 'datasets')
  AND COALESCE(existing.can_view, false) = true
GROUP BY existing.profile_id
ON CONFLICT (profile_id, module_key, page_key) DO UPDATE
SET can_view = public.access_profile_permissions.can_view OR excluded.can_view,
    can_create = public.access_profile_permissions.can_create OR excluded.can_create,
    can_edit = public.access_profile_permissions.can_edit OR excluded.can_edit,
    can_export = public.access_profile_permissions.can_export OR excluded.can_export,
    can_admin = public.access_profile_permissions.can_admin OR excluded.can_admin,
    updated_at = now();
