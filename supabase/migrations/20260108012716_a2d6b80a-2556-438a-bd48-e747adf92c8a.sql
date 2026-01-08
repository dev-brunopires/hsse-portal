-- Add policy for admin_master users to upload organization logos
CREATE POLICY "Admin master can upload organization logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'organization-logos' 
  AND auth.role() = 'authenticated'
  AND is_admin_master(auth.uid())
);

-- Add policy for admin_master users to update organization logos
CREATE POLICY "Admin master can update organization logos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'organization-logos' 
  AND auth.role() = 'authenticated'
  AND is_admin_master(auth.uid())
);

-- Add policy for admin_master users to delete organization logos
CREATE POLICY "Admin master can delete organization logos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'organization-logos' 
  AND auth.role() = 'authenticated'
  AND is_admin_master(auth.uid())
);