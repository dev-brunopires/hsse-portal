CREATE TABLE IF NOT EXISTS public.safety_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  ship_id uuid NOT NULL REFERENCES public.ships(id) ON DELETE CASCADE,
  area text NOT NULL,
  observer_id uuid NOT NULL DEFAULT auth.uid(),
  observed_at timestamptz NOT NULL DEFAULT now(),
  shift text,
  activity_type text NOT NULL,
  observation_type text NOT NULL,
  risk_category text NOT NULL,
  energy_source text,
  people_exposed integer CHECK (people_exposed IS NULL OR people_exposed >= 0),
  potential_consequence text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  likelihood text NOT NULL CHECK (likelihood IN ('unlikely', 'possible', 'likely', 'very_likely')),
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  residual_risk_level text CHECK (residual_risk_level IN ('low', 'medium', 'high', 'critical')),
  stop_work boolean NOT NULL DEFAULT false,
  fatality_potential boolean NOT NULL DEFAULT false,
  description text NOT NULL,
  risk_perception text NOT NULL,
  immediate_action text NOT NULL,
  person_notified text,
  recommended_action text,
  responsible_name text,
  due_date date,
  requires_followup boolean NOT NULL DEFAULT false,
  requires_cmms boolean NOT NULL DEFAULT false,
  requires_investigation boolean NOT NULL DEFAULT false,
  share_in_tbt boolean NOT NULL DEFAULT false,
  nominated_good_card boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  learning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_observations_ship
  ON public.safety_observations(ship_id);

CREATE INDEX IF NOT EXISTS idx_safety_observations_org
  ON public.safety_observations(organization_id);

CREATE INDEX IF NOT EXISTS idx_safety_observations_observed_at
  ON public.safety_observations(observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_safety_observations_status
  ON public.safety_observations(status);

CREATE INDEX IF NOT EXISTS idx_safety_observations_risk_level
  ON public.safety_observations(risk_level);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_observations TO authenticated;
GRANT ALL ON public.safety_observations TO service_role;

ALTER TABLE public.safety_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view safety observations from their ships"
ON public.safety_observations;
CREATE POLICY "Users can view safety observations from their ships"
ON public.safety_observations FOR SELECT
TO authenticated
USING (
  public.user_has_ship_access(auth.uid(), ship_id)
  OR public.is_platform_owner(auth.uid())
);

DROP POLICY IF EXISTS "Users can create safety observations for their ships"
ON public.safety_observations;
CREATE POLICY "Users can create safety observations for their ships"
ON public.safety_observations FOR INSERT
TO authenticated
WITH CHECK (
  observer_id = auth.uid()
  AND public.user_has_ship_access(auth.uid(), ship_id)
);

DROP POLICY IF EXISTS "Creators and HSSE leaders can update safety observations"
ON public.safety_observations;
CREATE POLICY "Creators and HSSE leaders can update safety observations"
ON public.safety_observations FOR UPDATE
TO authenticated
USING (
  public.user_has_ship_access(auth.uid(), ship_id)
  AND (
    observer_id = auth.uid()
    OR public.is_admin_or_technician(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
    OR public.is_platform_owner(auth.uid())
  )
)
WITH CHECK (
  public.user_has_ship_access(auth.uid(), ship_id)
  AND (
    observer_id = auth.uid()
    OR public.is_admin_or_technician(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
    OR public.is_platform_owner(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can delete safety observations"
ON public.safety_observations;
CREATE POLICY "Admins can delete safety observations"
ON public.safety_observations FOR DELETE
TO authenticated
USING (
  public.user_has_ship_access(auth.uid(), ship_id)
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_admin_master(auth.uid())
    OR public.is_platform_owner(auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.set_safety_observation_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.ships
    WHERE id = NEW.ship_id;
  END IF;

  IF NEW.observer_id IS NULL THEN
    NEW.observer_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_safety_observation_org_trg
ON public.safety_observations;
CREATE TRIGGER set_safety_observation_org_trg
BEFORE INSERT ON public.safety_observations
FOR EACH ROW EXECUTE FUNCTION public.set_safety_observation_org();

DROP TRIGGER IF EXISTS update_safety_observations_updated_at
ON public.safety_observations;
CREATE TRIGGER update_safety_observations_updated_at
BEFORE UPDATE ON public.safety_observations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

WITH obs_module AS (
  SELECT id FROM public.app_modules WHERE key = 'obs_cards'
)
INSERT INTO public.app_module_pages (module_id, key, name, route, description, sort_order)
SELECT
  obs_module.id,
  page.key,
  page.name,
  page.route,
  page.description,
  page.sort_order
FROM obs_module
CROSS JOIN (
  VALUES
    ('safety_observation', 'Formulario de Observacao de Seguranca', '/obs-cards/safety-observation', 'Registro operacional de observacoes de seguranca por navio e area', 15)
) AS page(key, name, route, description, sort_order)
ON CONFLICT (module_id, key) DO UPDATE
SET name = excluded.name,
    route = excluded.route,
    description = excluded.description,
    sort_order = excluded.sort_order,
    updated_at = now();

UPDATE public.app_module_pages p
SET name = 'Observation Card com IA',
    updated_at = now()
FROM public.app_modules m
WHERE p.module_id = m.id
  AND m.key = 'obs_cards'
  AND p.key = 'dashboard';
