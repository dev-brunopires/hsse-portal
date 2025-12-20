-- Create function to check if user is admin_master (has all permissions)
CREATE OR REPLACE FUNCTION public.is_admin_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin_master'
  );
$$;

-- Update is_admin_or_technician to include admin_master and supervisor
CREATE OR REPLACE FUNCTION public.is_admin_or_technician(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin_master', 'admin', 'technician', 'supervisor')
  );
$$;

-- Create function to check if user can manage users (admin_master or admin)
CREATE OR REPLACE FUNCTION public.can_manage_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin_master', 'admin')
  );
$$;