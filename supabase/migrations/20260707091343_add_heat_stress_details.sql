ALTER TABLE public.heat_stress_measurements
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_heat_stress_details
  ON public.heat_stress_measurements USING gin(details);
