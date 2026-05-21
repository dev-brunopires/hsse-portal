
CREATE TABLE public.heat_stress_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID,
  ship_id UUID NOT NULL,
  sector TEXT NOT NULL,
  environment_type TEXT NOT NULL CHECK (environment_type IN ('no_solar', 'with_solar')),
  tbn NUMERIC(5,2) NOT NULL,
  tg NUMERIC(5,2) NOT NULL,
  tbs NUMERIC(5,2),
  metabolic_rate NUMERIC(6,2) NOT NULL,
  ibutg NUMERIC(5,2) NOT NULL,
  nho_status TEXT NOT NULL CHECK (nho_status IN ('normal', 'action', 'above_limit')),
  notes TEXT,
  measured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_heat_stress_ship ON public.heat_stress_measurements(ship_id);
CREATE INDEX idx_heat_stress_org ON public.heat_stress_measurements(organization_id);
CREATE INDEX idx_heat_stress_measured_at ON public.heat_stress_measurements(measured_at DESC);

ALTER TABLE public.heat_stress_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view heat stress from their ships"
ON public.heat_stress_measurements FOR SELECT
USING (user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins and technicians can insert heat stress"
ON public.heat_stress_measurements FOR INSERT
WITH CHECK (is_admin_or_technician(auth.uid()) AND user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins and technicians can update heat stress"
ON public.heat_stress_measurements FOR UPDATE
USING (is_admin_or_technician(auth.uid()) AND user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins can delete heat stress"
ON public.heat_stress_measurements FOR DELETE
USING ((has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid())) AND user_has_ship_access(auth.uid(), ship_id));

CREATE TRIGGER update_heat_stress_updated_at
BEFORE UPDATE ON public.heat_stress_measurements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
