-- Add signature field to inspections table
ALTER TABLE public.inspections 
ADD COLUMN IF NOT EXISTS signature_data text,
ADD COLUMN IF NOT EXISTS signed_at timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN public.inspections.signature_data IS 'Base64 encoded signature image';
COMMENT ON COLUMN public.inspections.signed_at IS 'Timestamp when the inspection was signed';