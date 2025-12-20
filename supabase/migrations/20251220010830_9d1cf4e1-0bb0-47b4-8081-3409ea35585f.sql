-- Create ships table
CREATE TABLE public.ships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on ships
ALTER TABLE public.ships ENABLE ROW LEVEL SECURITY;

-- Create user_ships junction table
CREATE TABLE public.user_ships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ship_id uuid NOT NULL REFERENCES public.ships(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, ship_id)
);

-- Enable RLS on user_ships
ALTER TABLE public.user_ships ENABLE ROW LEVEL SECURITY;

-- Add ship_id to equipment table
ALTER TABLE public.equipment ADD COLUMN ship_id uuid REFERENCES public.ships(id);

-- Add ship_id to inspections (for filtering)
ALTER TABLE public.inspections ADD COLUMN ship_id uuid REFERENCES public.ships(id);

-- Function to check if user has access to a ship
CREATE OR REPLACE FUNCTION public.user_has_ship_access(_user_id uuid, _ship_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admin and admin_master have access to all ships
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _user_id AND role IN ('admin_master', 'admin')
    )
    OR
    -- User is assigned to this ship
    EXISTS (
      SELECT 1 FROM public.user_ships 
      WHERE user_id = _user_id AND ship_id = _ship_id
    )
    OR
    -- If no ship is specified, allow access (for backwards compatibility)
    _ship_id IS NULL
$$;

-- Function to get user's ship IDs
CREATE OR REPLACE FUNCTION public.get_user_ship_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ship_id FROM public.user_ships WHERE user_id = _user_id
$$;

-- RLS policies for ships table
CREATE POLICY "Admins can manage ships"
ON public.ships FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()));

CREATE POLICY "Users can view assigned ships"
ON public.ships FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_admin_master(auth.uid())
  OR id IN (SELECT ship_id FROM public.user_ships WHERE user_id = auth.uid())
);

-- RLS policies for user_ships table
CREATE POLICY "Admins can manage user_ships"
ON public.user_ships FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()));

CREATE POLICY "Users can view own ship assignments"
ON public.user_ships FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid()));

-- Drop existing equipment policies and recreate with ship filtering
DROP POLICY IF EXISTS "All authenticated users can view equipment" ON public.equipment;
DROP POLICY IF EXISTS "Admins and technicians can insert equipment" ON public.equipment;
DROP POLICY IF EXISTS "Admins and technicians can update equipment" ON public.equipment;
DROP POLICY IF EXISTS "Admins can delete equipment" ON public.equipment;

CREATE POLICY "Users can view equipment from their ships"
ON public.equipment FOR SELECT
USING (user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins and technicians can insert equipment"
ON public.equipment FOR INSERT
WITH CHECK (is_admin_or_technician(auth.uid()) AND user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins and technicians can update equipment"
ON public.equipment FOR UPDATE
USING (is_admin_or_technician(auth.uid()) AND user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins can delete equipment"
ON public.equipment FOR DELETE
USING ((has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid())) AND user_has_ship_access(auth.uid(), ship_id));

-- Drop existing inspection policies and recreate with ship filtering
DROP POLICY IF EXISTS "All authenticated users can view inspections" ON public.inspections;
DROP POLICY IF EXISTS "Admins and technicians can insert inspections" ON public.inspections;
DROP POLICY IF EXISTS "Admins and technicians can update inspections" ON public.inspections;
DROP POLICY IF EXISTS "Admins can delete inspections" ON public.inspections;

CREATE POLICY "Users can view inspections from their ships"
ON public.inspections FOR SELECT
USING (user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins and technicians can insert inspections"
ON public.inspections FOR INSERT
WITH CHECK (is_admin_or_technician(auth.uid()) AND user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins and technicians can update inspections"
ON public.inspections FOR UPDATE
USING (is_admin_or_technician(auth.uid()) AND user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins can delete inspections"
ON public.inspections FOR DELETE
USING ((has_role(auth.uid(), 'admin'::app_role) OR is_admin_master(auth.uid())) AND user_has_ship_access(auth.uid(), ship_id));

-- Update trigger for ships
CREATE TRIGGER update_ships_updated_at
BEFORE UPDATE ON public.ships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();