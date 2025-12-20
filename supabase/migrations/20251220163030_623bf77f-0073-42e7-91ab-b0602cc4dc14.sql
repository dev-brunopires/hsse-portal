-- Create audit_logs table to track all changes in equipment and inspections
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  user_id UUID,
  user_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin_master', 'admin')
  )
);

-- Only system can insert audit logs (via triggers)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Create function to log equipment changes
CREATE OR REPLACE FUNCTION public.log_equipment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_cols TEXT[];
  old_json JSONB;
  new_json JSONB;
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_id, user_name)
    VALUES ('equipment', NEW.id, 'INSERT', to_jsonb(NEW), v_user_id, v_user_name);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    
    -- Find changed fields
    SELECT ARRAY_AGG(key) INTO changed_cols
    FROM jsonb_each(new_json) n
    WHERE n.value IS DISTINCT FROM (old_json -> n.key)
    AND n.key NOT IN ('updated_at');
    
    -- Only log if there are actual changes
    IF changed_cols IS NOT NULL AND array_length(changed_cols, 1) > 0 THEN
      INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_name)
      VALUES ('equipment', NEW.id, 'UPDATE', old_json, new_json, changed_cols, v_user_id, v_user_name);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, user_id, user_name)
    VALUES ('equipment', OLD.id, 'DELETE', to_jsonb(OLD), v_user_id, v_user_name);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create function to log inspection changes
CREATE OR REPLACE FUNCTION public.log_inspection_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_cols TEXT[];
  old_json JSONB;
  new_json JSONB;
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_id, user_name)
    VALUES ('inspections', NEW.id, 'INSERT', to_jsonb(NEW), v_user_id, v_user_name);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    
    SELECT ARRAY_AGG(key) INTO changed_cols
    FROM jsonb_each(new_json) n
    WHERE n.value IS DISTINCT FROM (old_json -> n.key);
    
    IF changed_cols IS NOT NULL AND array_length(changed_cols, 1) > 0 THEN
      INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_name)
      VALUES ('inspections', NEW.id, 'UPDATE', old_json, new_json, changed_cols, v_user_id, v_user_name);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, user_id, user_name)
    VALUES ('inspections', OLD.id, 'DELETE', to_jsonb(OLD), v_user_id, v_user_name);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create triggers for equipment
CREATE TRIGGER audit_equipment_changes
AFTER INSERT OR UPDATE OR DELETE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.log_equipment_changes();

-- Create triggers for inspections
CREATE TRIGGER audit_inspection_changes
AFTER INSERT OR UPDATE OR DELETE ON public.inspections
FOR EACH ROW EXECUTE FUNCTION public.log_inspection_changes();