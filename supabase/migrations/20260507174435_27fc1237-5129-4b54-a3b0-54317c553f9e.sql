-- 1) Backfill ship_id em inspeções órfãs
UPDATE public.inspections i
SET ship_id = e.ship_id
FROM public.equipment e
WHERE i.equipment_id = e.id AND i.ship_id IS NULL AND e.ship_id IS NOT NULL;

-- 2) Profiles: remover policy ampla e criar policies separadas
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

CREATE POLICY "Users can view own full profile"
ON public.profiles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view org profiles"
ON public.profiles FOR SELECT
USING (
  is_platform_owner(auth.uid())
  OR (user_belongs_to_organization(auth.uid(), organization_id)
      AND (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid())))
);

-- View pública sem campos sensíveis para listagens (usada pelo client)
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT id, user_id, full_name, email, avatar_url, position, department,
       organization_id, unit, language, created_at, updated_at
FROM public.profiles
WHERE user_belongs_to_organization(auth.uid(), organization_id)
   OR user_id = auth.uid()
   OR is_platform_owner(auth.uid());

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- 3) Inspections: nunca expor quando ship_id IS NULL (exceto inspetor / admin)
DROP POLICY IF EXISTS "Users can view inspections from their ships" ON public.inspections;

CREATE POLICY "Users can view inspections from their ships"
ON public.inspections FOR SELECT
USING (
  (ship_id IS NOT NULL AND user_has_ship_access(auth.uid(), ship_id))
  OR inspector_id = auth.uid()
  OR is_platform_owner(auth.uid())
  OR is_admin_master(auth.uid())
);

-- Trigger: forçar ship_id a partir do equipment quando NULL
CREATE OR REPLACE FUNCTION public.set_inspection_ship_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ship_id IS NULL THEN
    SELECT ship_id INTO NEW.ship_id FROM public.equipment WHERE id = NEW.equipment_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_inspection_ship_id ON public.inspections;
CREATE TRIGGER trg_set_inspection_ship_id
BEFORE INSERT OR UPDATE ON public.inspections
FOR EACH ROW EXECUTE FUNCTION public.set_inspection_ship_id();

-- 4) inspection_checklist_items: corrigir argumentos invertidos
DROP POLICY IF EXISTS "Users can view checklist items of inspections they have access " ON public.inspection_checklist_items;

CREATE POLICY "Users can view checklist items of accessible inspections"
ON public.inspection_checklist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.inspections i
    WHERE i.id = inspection_checklist_items.inspection_id
      AND (
        is_platform_owner(auth.uid())
        OR is_admin_master(auth.uid())
        OR (i.ship_id IS NOT NULL AND user_has_ship_access(auth.uid(), i.ship_id))
        OR i.inspector_id = auth.uid()
      )
  )
);

-- 5) Checklist templates / items: restringir por organização
DROP POLICY IF EXISTS "All authenticated users can view checklist templates" ON public.checklist_templates;
CREATE POLICY "Users can view checklist templates in their org"
ON public.checklist_templates FOR SELECT
USING (
  is_platform_owner(auth.uid())
  OR organization_id IS NULL
  OR user_belongs_to_organization(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "All authenticated users can view checklist template items" ON public.checklist_template_items;
CREATE POLICY "Users can view template items in their org"
ON public.checklist_template_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.checklist_templates t
    WHERE t.id = checklist_template_items.template_id
      AND (
        is_platform_owner(auth.uid())
        OR t.organization_id IS NULL
        OR user_belongs_to_organization(auth.uid(), t.organization_id)
      )
  )
);

-- 6) equipment_documents: restringir por navio do equipamento
DROP POLICY IF EXISTS "All authenticated users can view equipment documents" ON public.equipment_documents;
CREATE POLICY "Users can view equipment documents from their ships"
ON public.equipment_documents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.equipment e
    WHERE e.id = equipment_documents.equipment_id
      AND user_has_ship_access(auth.uid(), e.ship_id)
  )
);

-- 7) inspection_photos: restringir por inspeção acessível
DROP POLICY IF EXISTS "All authenticated users can view inspection photos" ON public.inspection_photos;
CREATE POLICY "Users can view inspection photos from accessible inspections"
ON public.inspection_photos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.inspections i
    WHERE i.id = inspection_photos.inspection_id
      AND (
        is_platform_owner(auth.uid())
        OR is_admin_master(auth.uid())
        OR (i.ship_id IS NOT NULL AND user_has_ship_access(auth.uid(), i.ship_id))
        OR i.inspector_id = auth.uid()
      )
  )
);

-- 8) notifications: ship_id NULL exige mesma org
DROP POLICY IF EXISTS "Users can view relevant notifications" ON public.notifications;
CREATE POLICY "Users can view relevant notifications"
ON public.notifications FOR SELECT
USING (
  is_platform_owner(auth.uid())
  OR is_admin_master(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (ship_id IS NOT NULL AND user_has_ship_access(auth.uid(), ship_id))
  OR (ship_id IS NULL AND organization_id IS NOT NULL
      AND user_belongs_to_organization(auth.uid(), organization_id))
);

-- 9) user_roles: impedir admin de conceder admin_master/admin
DROP POLICY IF EXISTS "Admins can insert roles in their organization" ON public.user_roles;
CREATE POLICY "Admins can insert roles in their organization"
ON public.user_roles FOR INSERT
WITH CHECK (
  user_belongs_to_organization(auth.uid(), organization_id)
  AND (
    is_admin_master(auth.uid())
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND role NOT IN ('admin_master'::app_role, 'admin'::app_role))
  )
);

DROP POLICY IF EXISTS "Admins can update roles in their organization" ON public.user_roles;
CREATE POLICY "Admins can update roles in their organization"
ON public.user_roles FOR UPDATE
USING (
  user_belongs_to_organization(auth.uid(), organization_id)
  AND (
    is_admin_master(auth.uid())
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND role NOT IN ('admin_master'::app_role, 'admin'::app_role))
  )
)
WITH CHECK (
  user_belongs_to_organization(auth.uid(), organization_id)
  AND (
    is_admin_master(auth.uid())
    OR (has_role(auth.uid(), 'admin'::app_role)
        AND role NOT IN ('admin_master'::app_role, 'admin'::app_role))
  )
);

-- 10) Storage buckets privados: restringir leitura ao prefixo da própria organização
-- Helper: pega o organization_id do usuário (pode haver mais de um, então usar belongs)
DROP POLICY IF EXISTS "Authenticated users can view equipment documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view equipment-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view inspection-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view certificates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view maintenance-photos" ON storage.objects;

CREATE POLICY "Org members can view equipment-documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'equipment-documents'
  AND (
    is_platform_owner(auth.uid())
    OR user_belongs_to_organization(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
);

CREATE POLICY "Org members can view inspection-photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'inspection-photos'
  AND (
    is_platform_owner(auth.uid())
    OR user_belongs_to_organization(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
);

CREATE POLICY "Org members can view certificates"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'certificates'
  AND (
    is_platform_owner(auth.uid())
    OR user_belongs_to_organization(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
);

CREATE POLICY "Org members can view maintenance-photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'maintenance-photos'
  AND (
    is_platform_owner(auth.uid())
    OR user_belongs_to_organization(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
);