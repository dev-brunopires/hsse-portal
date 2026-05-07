ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS client_action_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS inspections_client_action_id_unique
  ON public.inspections (client_action_id)
  WHERE client_action_id IS NOT NULL;