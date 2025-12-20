-- Add actions_taken column to inspections table
ALTER TABLE public.inspections 
ADD COLUMN actions_taken text NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.inspections.actions_taken IS 'Actions taken regarding previous inspection recommendations or pending issues';