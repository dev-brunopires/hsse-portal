ALTER TABLE public.safety_observations
  ADD COLUMN IF NOT EXISTS card_template text NOT NULL DEFAULT 'bco'
    CHECK (card_template IN ('bco', 'psf')),
  ADD COLUMN IF NOT EXISTS observer_name text,
  ADD COLUMN IF NOT EXISTS observer_department text,
  ADD COLUMN IF NOT EXISTS location_options jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS behaviour_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS condition_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS equipment_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS operating_mode text,
  ADD COLUMN IF NOT EXISTS manager_site_visit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS work_order_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weeps_seeps jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS leak_locations jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS main_causes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS process_safety_safeguards jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS process_safety_fundamentals jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_safety_observations_card_template
  ON public.safety_observations(card_template);

CREATE INDEX IF NOT EXISTS idx_safety_observations_location_options
  ON public.safety_observations USING gin(location_options);

CREATE INDEX IF NOT EXISTS idx_safety_observations_process_safety_fundamentals
  ON public.safety_observations USING gin(process_safety_fundamentals);
