
-- 1) Add day-of-month config to categories
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS inspection_due_day integer
  CHECK (inspection_due_day IS NULL OR (inspection_due_day BETWEEN 1 AND 31));

-- 2) Create pending_inspections table
CREATE TABLE IF NOT EXISTS public.pending_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL,
  ship_id uuid,
  organization_id uuid,
  due_date date NOT NULL,
  source text NOT NULL DEFAULT 'auto',
  status text NOT NULL DEFAULT 'pending',
  carryover_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  carryover_recommendations text,
  previous_inspection_id uuid,
  completed_inspection_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipment_id, due_date, status)
);

CREATE INDEX IF NOT EXISTS idx_pending_inspections_ship ON public.pending_inspections(ship_id);
CREATE INDEX IF NOT EXISTS idx_pending_inspections_due_date ON public.pending_inspections(due_date);
CREATE INDEX IF NOT EXISTS idx_pending_inspections_status ON public.pending_inspections(status);

ALTER TABLE public.pending_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pending inspections from their ships"
  ON public.pending_inspections FOR SELECT
  USING (public.user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins and technicians can insert pending inspections"
  ON public.pending_inspections FOR INSERT
  WITH CHECK (public.is_admin_or_technician(auth.uid()) AND public.user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins and technicians can update pending inspections"
  ON public.pending_inspections FOR UPDATE
  USING (public.is_admin_or_technician(auth.uid()) AND public.user_has_ship_access(auth.uid(), ship_id));

CREATE POLICY "Admins can delete pending inspections"
  ON public.pending_inspections FOR DELETE
  USING ((public.has_role(auth.uid(), 'admin'::app_role) OR public.is_admin_master(auth.uid())) AND public.user_has_ship_access(auth.uid(), ship_id));

CREATE TRIGGER trg_pending_inspections_updated_at
  BEFORE UPDATE ON public.pending_inspections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Helper: compute next due date from base date + frequency + optional day-of-month
CREATE OR REPLACE FUNCTION public.compute_next_inspection_date(
  _base date,
  _frequency text,
  _due_day integer
) RETURNS date
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_next date;
  v_months int;
  v_target_day int;
  v_last_day int;
BEGIN
  IF _base IS NULL THEN
    RETURN NULL;
  END IF;

  v_months := CASE _frequency
    WHEN 'monthly' THEN 1
    WHEN 'quarterly' THEN 3
    WHEN 'semiannual' THEN 6
    WHEN 'annual' THEN 12
    ELSE 1
  END;

  v_next := (_base + (v_months || ' months')::interval)::date;

  IF _due_day IS NOT NULL THEN
    v_last_day := EXTRACT(DAY FROM (date_trunc('month', v_next) + interval '1 month - 1 day'))::int;
    v_target_day := LEAST(_due_day, v_last_day);
    v_next := make_date(EXTRACT(YEAR FROM v_next)::int, EXTRACT(MONTH FROM v_next)::int, v_target_day);
  END IF;

  RETURN v_next;
END;
$$;

-- 4) Generation function: walks active equipment and creates pending records
CREATE OR REPLACE FUNCTION public.generate_pending_inspections()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_eq record;
  v_due date;
  v_last_insp record;
  v_carryover jsonb;
  v_inserted int := 0;
BEGIN
  FOR v_eq IN
    SELECT e.id, e.ship_id, e.last_inspection, e.next_inspection,
           c.inspection_frequency, c.inspection_due_day,
           s.organization_id
    FROM public.equipment e
    LEFT JOIN public.categories c ON c.id = e.category_id
    LEFT JOIN public.ships s ON s.id = e.ship_id
    WHERE e.status NOT IN ('inactive')
  LOOP
    -- Determine due date: prefer existing next_inspection, else compute from last_inspection
    IF v_eq.next_inspection IS NOT NULL THEN
      v_due := v_eq.next_inspection;
    ELSIF v_eq.last_inspection IS NOT NULL THEN
      v_due := public.compute_next_inspection_date(v_eq.last_inspection, v_eq.inspection_frequency, v_eq.inspection_due_day);
    ELSE
      -- No baseline: schedule for today so it shows up
      v_due := CURRENT_DATE;
    END IF;

    IF v_due IS NULL THEN
      CONTINUE;
    END IF;

    -- Skip if a pending already exists for this equipment+date
    IF EXISTS (
      SELECT 1 FROM public.pending_inspections
      WHERE equipment_id = v_eq.id AND due_date = v_due AND status = 'pending'
    ) THEN
      CONTINUE;
    END IF;

    -- Fetch last inspection for carryover
    SELECT i.id, i.recommendations
      INTO v_last_insp
    FROM public.inspections i
    WHERE i.equipment_id = v_eq.id
    ORDER BY i.inspection_date DESC, i.created_at DESC
    LIMIT 1;

    v_carryover := '[]'::jsonb;
    IF v_last_insp.id IS NOT NULL THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'description', ci.description,
        'status', ci.status,
        'notes', ci.notes
      )), '[]'::jsonb) INTO v_carryover
      FROM public.inspection_checklist_items ci
      WHERE ci.inspection_id = v_last_insp.id
        AND ci.status IN ('attention', 'fail');
    END IF;

    INSERT INTO public.pending_inspections (
      equipment_id, ship_id, organization_id, due_date, source, status,
      carryover_items, carryover_recommendations, previous_inspection_id
    ) VALUES (
      v_eq.id, v_eq.ship_id, v_eq.organization_id, v_due, 'auto', 'pending',
      v_carryover, v_last_insp.recommendations, v_last_insp.id
    )
    ON CONFLICT (equipment_id, due_date, status) DO NOTHING;

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- 5) Mark pending as completed when an inspection is recorded
CREATE OR REPLACE FUNCTION public.complete_pending_inspection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.pending_inspections
  SET status = 'completed',
      completed_inspection_id = NEW.id,
      completed_at = now()
  WHERE equipment_id = NEW.equipment_id
    AND status = 'pending'
    AND due_date <= NEW.inspection_date + INTERVAL '7 days'
    AND due_date >= NEW.inspection_date - INTERVAL '60 days';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complete_pending_on_inspection ON public.inspections;
CREATE TRIGGER trg_complete_pending_on_inspection
  AFTER INSERT ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.complete_pending_inspection();

-- 6) Enable extensions and schedule daily job
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule previous job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('generate-pending-inspections-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'generate-pending-inspections-daily',
  '0 6 * * *',
  $$ SELECT public.generate_pending_inspections(); $$
);

-- Run once now to backfill
SELECT public.generate_pending_inspections();
