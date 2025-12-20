-- Add foreign key constraint from equipment.created_by to profiles.user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'equipment_created_by_fkey'
    AND table_name = 'equipment'
  ) THEN
    ALTER TABLE public.equipment
    ADD CONSTRAINT equipment_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;
  END IF;
END $$;