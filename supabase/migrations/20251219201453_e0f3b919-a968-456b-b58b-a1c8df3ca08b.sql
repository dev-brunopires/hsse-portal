-- Create storage buckets for documents and photos
INSERT INTO storage.buckets (id, name, public) VALUES ('equipment-documents', 'equipment-documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-photos', 'inspection-photos', false);

-- RLS policies for equipment-documents bucket
CREATE POLICY "Authenticated users can view equipment documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'equipment-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Admins and technicians can upload equipment documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'equipment-documents' 
  AND public.is_admin_or_technician(auth.uid())
);

CREATE POLICY "Admins and technicians can update equipment documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'equipment-documents' 
  AND public.is_admin_or_technician(auth.uid())
);

CREATE POLICY "Admins can delete equipment documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'equipment-documents' 
  AND public.has_role(auth.uid(), 'admin')
);

-- RLS policies for inspection-photos bucket
CREATE POLICY "Authenticated users can view inspection photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'inspection-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Admins and technicians can upload inspection photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'inspection-photos' 
  AND public.is_admin_or_technician(auth.uid())
);

CREATE POLICY "Admins and technicians can update inspection photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'inspection-photos' 
  AND public.is_admin_or_technician(auth.uid())
);

CREATE POLICY "Admins can delete inspection photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'inspection-photos' 
  AND public.has_role(auth.uid(), 'admin')
);