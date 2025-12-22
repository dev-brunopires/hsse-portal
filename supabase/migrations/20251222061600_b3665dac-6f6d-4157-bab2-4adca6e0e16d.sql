
-- Update user_has_ship_access to check organization membership for admins
CREATE OR REPLACE FUNCTION public.user_has_ship_access(_user_id uuid, _ship_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    -- If no ship is specified, allow access (for backwards compatibility)
    _ship_id IS NULL
    OR
    -- Admin and admin_master have access to ships in their organization
    (
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id AND role IN ('admin_master', 'admin')
      )
      AND EXISTS (
        SELECT 1 FROM public.ships s
        JOIN public.user_organizations uo ON uo.organization_id = s.organization_id
        WHERE s.id = _ship_id AND uo.user_id = _user_id
      )
    )
    OR
    -- User is directly assigned to this ship
    EXISTS (
      SELECT 1 FROM public.user_ships 
      WHERE user_id = _user_id AND ship_id = _ship_id
    )
$function$;
