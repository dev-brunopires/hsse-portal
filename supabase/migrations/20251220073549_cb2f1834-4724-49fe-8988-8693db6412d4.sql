-- Drop existing restrictive delete policy for equipment documents
DROP POLICY IF EXISTS "Admins can delete equipment documents" ON storage.objects;

-- Create new policy that allows admin, admin_master and technicians to delete
CREATE POLICY "Admins and technicians can delete equipment documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'equipment-documents' 
  AND is_admin_or_technician(auth.uid())
);

-- Also update the inspection photos delete policy similarly
DROP POLICY IF EXISTS "Admins can delete inspection photos" ON storage.objects;

CREATE POLICY "Admins and technicians can delete inspection photos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'inspection-photos' 
  AND is_admin_or_technician(auth.uid())
);