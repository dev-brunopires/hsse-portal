
CREATE OR REPLACE FUNCTION public.enforce_single_favorite_ship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.entity_type = 'ship' THEN
    DELETE FROM public.user_favorites
    WHERE user_id = NEW.user_id
      AND entity_type = 'ship'
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_favorite_ship
  AFTER INSERT ON public.user_favorites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_favorite_ship();
