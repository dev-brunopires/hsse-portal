-- Add short_code column to equipment table for quick identification
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS short_code text;

-- Create unique index for short_code
CREATE UNIQUE INDEX IF NOT EXISTS equipment_short_code_unique_idx ON public.equipment (short_code) WHERE short_code IS NOT NULL;

-- Create function to generate unique 6-digit code
CREATE OR REPLACE FUNCTION generate_equipment_short_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    -- Generate a random 6-digit code (100000-999999)
    new_code := LPAD(FLOOR(random() * 900000 + 100000)::text, 6, '0');
    
    -- Check if this code already exists
    SELECT EXISTS(SELECT 1 FROM equipment WHERE short_code = new_code) INTO code_exists;
    
    -- If code doesn't exist, we can use it
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- Create trigger to auto-generate short_code on insert
CREATE OR REPLACE FUNCTION set_equipment_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := generate_equipment_short_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS equipment_short_code_trigger ON public.equipment;

CREATE TRIGGER equipment_short_code_trigger
  BEFORE INSERT ON public.equipment
  FOR EACH ROW
  EXECUTE FUNCTION set_equipment_short_code();

-- Generate short_codes for existing equipment that don't have one
UPDATE public.equipment
SET short_code = generate_equipment_short_code()
WHERE short_code IS NULL;