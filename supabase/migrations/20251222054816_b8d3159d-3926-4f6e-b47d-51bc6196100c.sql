
-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for organization logos
CREATE POLICY "Anyone can view organization logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-logos');

CREATE POLICY "Platform owners can upload organization logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'organization-logos' AND is_platform_owner(auth.uid()));

CREATE POLICY "Platform owners can update organization logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'organization-logos' AND is_platform_owner(auth.uid()));

CREATE POLICY "Platform owners can delete organization logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'organization-logos' AND is_platform_owner(auth.uid()));
