
CREATE TABLE public.ship_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id uuid NOT NULL,
  organization_id uuid,
  name text NOT NULL,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ship_id, name)
);

CREATE INDEX idx_ship_areas_ship ON public.ship_areas(ship_id);

ALTER TABLE public.ship_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ship areas from their ships"
ON public.ship_areas FOR SELECT
USING (user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins and technicians can insert ship areas"
ON public.ship_areas FOR INSERT
WITH CHECK (is_admin_or_technician(auth.uid()) AND user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins and technicians can update ship areas"
ON public.ship_areas FOR UPDATE
USING (is_admin_or_technician(auth.uid()) AND user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins can delete ship areas"
ON public.ship_areas FOR DELETE
USING ((has_role(auth.uid(),'admin'::app_role) OR is_admin_master(auth.uid())) AND user_has_ship_access(auth.uid(), ship_id));

CREATE TRIGGER update_ship_areas_updated_at
BEFORE UPDATE ON public.ship_areas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-fill organization_id from ship
CREATE OR REPLACE FUNCTION public.set_ship_area_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id FROM public.ships WHERE id = NEW.ship_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_ship_area_org_trg
BEFORE INSERT ON public.ship_areas
FOR EACH ROW EXECUTE FUNCTION public.set_ship_area_org();
