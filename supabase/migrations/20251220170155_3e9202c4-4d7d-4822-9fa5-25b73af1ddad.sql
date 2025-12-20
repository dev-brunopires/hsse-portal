-- Make manufacturer and model columns nullable
ALTER TABLE public.equipment ALTER COLUMN manufacturer DROP NOT NULL;
ALTER TABLE public.equipment ALTER COLUMN model DROP NOT NULL;