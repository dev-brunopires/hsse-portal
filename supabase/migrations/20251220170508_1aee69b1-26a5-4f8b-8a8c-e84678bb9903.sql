-- Make manufacturing_date and acquisition_date columns nullable
ALTER TABLE public.equipment ALTER COLUMN manufacturing_date DROP NOT NULL;
ALTER TABLE public.equipment ALTER COLUMN acquisition_date DROP NOT NULL;