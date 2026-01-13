-- Add login background field to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS login_background_url TEXT;