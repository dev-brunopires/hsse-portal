
-- Function: generate up to N future pending inspections for a single equipment
CREATE OR REPLACE FUNCTION public.generate_pending_for_equipment(
  _equipment_id uuid,
  _months_ahead integer DEFAULT 12
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _eq RECORD;
  _cat RECORD;
  _base_date date;
  _next_date date;
  _count integer := 0;
  _i integer;
  _last_inspection_id uuid;
BEGIN
  SELECT e.* INTO _eq FROM equipment e WHERE e.id = _equipment_id AND e.status = 'active';
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT c.* INTO _cat FROM categories c WHERE c.id = _eq.category_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Last inspection (for reference)
  SELECT id INTO _last_inspection_id
  FROM inspections
  WHERE equipment_id = _equipment_id
  ORDER BY inspection_date DESC
  LIMIT 1;

  -- Base date: last_inspection or today
  _base_date := COALESCE(_eq.last_inspection, CURRENT_DATE);
  _next_date := _base_date;

  -- Remove future pending (not completed) for this equipment so we can regenerate
  DELETE FROM pending_inspections
  WHERE equipment_id = _equipment_id
    AND status = 'pending'
    AND due_date >= CURRENT_DATE
    AND source = 'auto';

  FOR _i IN 1.._months_ahead LOOP
    _next_date := public.compute_next_inspection_date(_next_date, _cat.inspection_frequency, _cat.inspection_due_day);
    EXIT WHEN _next_date IS NULL;

    INSERT INTO pending_inspections (
      equipment_id, ship_id, organization_id, due_date, source, status,
      carryover_items, carryover_recommendations, previous_inspection_id
    )
    SELECT
      _eq.id, _eq.ship_id,
      (SELECT organization_id FROM ships WHERE id = _eq.ship_id),
      _next_date, 'auto', 'pending',
      '[]'::jsonb, NULL, _last_inspection_id
    ON CONFLICT DO NOTHING;

    _count := _count + 1;

    -- Stop if we move beyond a sane horizon
    EXIT WHEN _next_date > CURRENT_DATE + (_months_ahead * INTERVAL '1 month' + INTERVAL '2 months');
  END LOOP;

  RETURN _count;
END;
$$;

-- Function: regenerate pending for an entire category
CREATE OR REPLACE FUNCTION public.regenerate_pending_for_category(_category_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _eq_id uuid;
  _total integer := 0;
BEGIN
  FOR _eq_id IN
    SELECT id FROM equipment WHERE category_id = _category_id AND status = 'active'
  LOOP
    _total := _total + public.generate_pending_for_equipment(_eq_id, 12);
  END LOOP;
  RETURN _total;
END;
$$;

-- Trigger: when category frequency / inspection_due_day changes, regenerate
CREATE OR REPLACE FUNCTION public.trg_category_regenerate_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.regenerate_pending_for_category(NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.inspection_due_day IS DISTINCT FROM OLD.inspection_due_day)
       OR (NEW.inspection_frequency IS DISTINCT FROM OLD.inspection_frequency) THEN
      PERFORM public.regenerate_pending_for_category(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS category_regenerate_pending ON public.categories;
CREATE TRIGGER category_regenerate_pending
AFTER INSERT OR UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.trg_category_regenerate_pending();

-- Also regenerate when an equipment is inserted or its category/ship changes
CREATE OR REPLACE FUNCTION public.trg_equipment_regenerate_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.generate_pending_for_equipment(NEW.id, 12);
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.category_id IS DISTINCT FROM OLD.category_id)
       OR (NEW.ship_id IS DISTINCT FROM OLD.ship_id)
       OR (NEW.status IS DISTINCT FROM OLD.status)
       OR (NEW.last_inspection IS DISTINCT FROM OLD.last_inspection) THEN
      PERFORM public.generate_pending_for_equipment(NEW.id, 12);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS equipment_regenerate_pending ON public.equipment;
CREATE TRIGGER equipment_regenerate_pending
AFTER INSERT OR UPDATE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.trg_equipment_regenerate_pending();

-- Backfill: regenerate everything once now
DO $$
DECLARE _cat_id uuid;
BEGIN
  FOR _cat_id IN SELECT id FROM categories LOOP
    PERFORM public.regenerate_pending_for_category(_cat_id);
  END LOOP;
END $$;
