-- Add signature and auto-sign settings to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS default_signature text,
ADD COLUMN IF NOT EXISTS auto_sign_inspections boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS position text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS notification_email boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_app boolean DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.default_signature IS 'Base64 encoded default signature image';
COMMENT ON COLUMN public.profiles.auto_sign_inspections IS 'Automatically sign inspections with default signature';
COMMENT ON COLUMN public.profiles.phone IS 'User phone number';
COMMENT ON COLUMN public.profiles.position IS 'Job position/title';
COMMENT ON COLUMN public.profiles.department IS 'Department name';
COMMENT ON COLUMN public.profiles.notification_email IS 'Receive email notifications';
COMMENT ON COLUMN public.profiles.notification_app IS 'Receive app notifications';