-- Create enum for maintenance types
CREATE TYPE maintenance_type AS ENUM ('preventive', 'corrective');

-- Create enum for maintenance request status
CREATE TYPE maintenance_status AS ENUM ('pending', 'approved', 'in_progress', 'completed', 'rejected');

-- Create enum for maintenance priority
CREATE TYPE maintenance_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Create maintenance requests table
CREATE TABLE public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  ship_id UUID REFERENCES public.ships(id),
  type maintenance_type NOT NULL DEFAULT 'corrective',
  priority maintenance_priority NOT NULL DEFAULT 'medium',
  status maintenance_status NOT NULL DEFAULT 'pending',
  
  -- Request details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  problem_identified TEXT,
  
  -- Dates
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  requested_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  started_at TIMESTAMP WITH TIME ZONE,
  started_by UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID,
  rejection_reason TEXT,
  
  -- Scheduled date for preventive maintenance
  scheduled_date DATE,
  
  -- Completion details
  work_performed TEXT,
  parts_used TEXT,
  observations TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create maintenance request photos table
CREATE TABLE public.maintenance_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  photo_type TEXT NOT NULL DEFAULT 'problem', -- 'problem', 'during', 'after'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for maintenance_requests
CREATE POLICY "Users can view maintenance requests from their ships"
ON public.maintenance_requests
FOR SELECT
USING (user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins and technicians can insert maintenance requests"
ON public.maintenance_requests
FOR INSERT
WITH CHECK (is_admin_or_technician(auth.uid()) AND user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins and technicians can update maintenance requests"
ON public.maintenance_requests
FOR UPDATE
USING (is_admin_or_technician(auth.uid()) AND user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins can delete maintenance requests"
ON public.maintenance_requests
FOR DELETE
USING ((has_role(auth.uid(), 'admin') OR is_admin_master(auth.uid())) AND user_has_ship_access(auth.uid(), ship_id));

-- RLS policies for maintenance_photos
CREATE POLICY "Users can view maintenance photos from their ships"
ON public.maintenance_photos
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.maintenance_requests mr
  WHERE mr.id = maintenance_photos.maintenance_request_id
  AND user_has_ship_access(auth.uid(), mr.ship_id)
));

CREATE POLICY "Admins and technicians can manage maintenance photos"
ON public.maintenance_photos
FOR ALL
USING (is_admin_or_technician(auth.uid()))
WITH CHECK (is_admin_or_technician(auth.uid()));

-- Create index for performance
CREATE INDEX idx_maintenance_requests_equipment ON public.maintenance_requests(equipment_id);
CREATE INDEX idx_maintenance_requests_ship ON public.maintenance_requests(ship_id);
CREATE INDEX idx_maintenance_requests_status ON public.maintenance_requests(status);
CREATE INDEX idx_maintenance_photos_request ON public.maintenance_photos(maintenance_request_id);

-- Trigger to update updated_at
CREATE TRIGGER update_maintenance_requests_updated_at
BEFORE UPDATE ON public.maintenance_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for maintenance photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-photos', 'maintenance-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for maintenance photos
CREATE POLICY "Users can view maintenance photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'maintenance-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Admins and technicians can upload maintenance photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'maintenance-photos' AND is_admin_or_technician(auth.uid()));

CREATE POLICY "Admins and technicians can delete maintenance photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'maintenance-photos' AND is_admin_or_technician(auth.uid()));