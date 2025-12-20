-- Create audit trigger for categories table
CREATE OR REPLACE FUNCTION public.log_category_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  changed_cols TEXT[];
  old_json JSONB;
  new_json JSONB;
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  v_user_id := auth.uid();
  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_id, user_name)
    VALUES ('categories', NEW.id, 'INSERT', to_jsonb(NEW), v_user_id, v_user_name);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    
    SELECT ARRAY_AGG(key) INTO changed_cols
    FROM jsonb_each(new_json) n
    WHERE n.value IS DISTINCT FROM (old_json -> n.key)
    AND n.key NOT IN ('updated_at');
    
    IF changed_cols IS NOT NULL AND array_length(changed_cols, 1) > 0 THEN
      INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_name)
      VALUES ('categories', NEW.id, 'UPDATE', old_json, new_json, changed_cols, v_user_id, v_user_name);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, user_id, user_name)
    VALUES ('categories', OLD.id, 'DELETE', to_jsonb(OLD), v_user_id, v_user_name);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create audit trigger for ships table
CREATE OR REPLACE FUNCTION public.log_ship_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  changed_cols TEXT[];
  old_json JSONB;
  new_json JSONB;
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  v_user_id := auth.uid();
  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_id, user_name)
    VALUES ('ships', NEW.id, 'INSERT', to_jsonb(NEW), v_user_id, v_user_name);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    
    SELECT ARRAY_AGG(key) INTO changed_cols
    FROM jsonb_each(new_json) n
    WHERE n.value IS DISTINCT FROM (old_json -> n.key)
    AND n.key NOT IN ('updated_at');
    
    IF changed_cols IS NOT NULL AND array_length(changed_cols, 1) > 0 THEN
      INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_name)
      VALUES ('ships', NEW.id, 'UPDATE', old_json, new_json, changed_cols, v_user_id, v_user_name);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, user_id, user_name)
    VALUES ('ships', OLD.id, 'DELETE', to_jsonb(OLD), v_user_id, v_user_name);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create audit trigger for profiles table (excluding sensitive fields)
CREATE OR REPLACE FUNCTION public.log_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  changed_cols TEXT[];
  old_json JSONB;
  new_json JSONB;
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  v_user_id := auth.uid();
  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user_id;

  -- Remove sensitive fields from logging
  IF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    new_json := new_json - 'default_signature';
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_id, user_name)
    VALUES ('profiles', NEW.id, 'INSERT', new_json, v_user_id, v_user_name);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD) - 'default_signature';
    new_json := to_jsonb(NEW) - 'default_signature';
    
    SELECT ARRAY_AGG(key) INTO changed_cols
    FROM jsonb_each(new_json) n
    WHERE n.value IS DISTINCT FROM (old_json -> n.key)
    AND n.key NOT IN ('updated_at', 'default_signature');
    
    IF changed_cols IS NOT NULL AND array_length(changed_cols, 1) > 0 THEN
      INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_name)
      VALUES ('profiles', NEW.id, 'UPDATE', old_json, new_json, changed_cols, v_user_id, v_user_name);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD) - 'default_signature';
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, user_id, user_name)
    VALUES ('profiles', OLD.id, 'DELETE', old_json, v_user_id, v_user_name);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create triggers for categories
CREATE TRIGGER audit_categories_changes
AFTER INSERT OR UPDATE OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.log_category_changes();

-- Create triggers for ships
CREATE TRIGGER audit_ships_changes
AFTER INSERT OR UPDATE OR DELETE ON public.ships
FOR EACH ROW EXECUTE FUNCTION public.log_ship_changes();

-- Create triggers for profiles
CREATE TRIGGER audit_profiles_changes
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_profile_changes();