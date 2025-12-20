-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'alert', 'reminder'
  ship_id UUID REFERENCES public.ships(id) ON DELETE CASCADE, -- NULL = notification for all
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE -- NULL = never expires
);

-- Create table to track read notifications per user
CREATE TABLE public.notification_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- Notifications policies
-- Everyone can view notifications for their ships or global notifications
CREATE POLICY "Users can view relevant notifications"
ON public.notifications
FOR SELECT
USING (
  ship_id IS NULL -- Global notification
  OR user_has_ship_access(auth.uid(), ship_id) -- User has access to the ship
  OR is_admin_master(auth.uid()) -- Admin master sees all
  OR has_role(auth.uid(), 'admin'::app_role) -- Admins see all
);

-- Only admins can create notifications
CREATE POLICY "Admins can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  is_admin_master(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can update their own notifications
CREATE POLICY "Admins can update notifications"
ON public.notifications
FOR UPDATE
USING (
  created_by = auth.uid() OR is_admin_master(auth.uid())
);

-- Admins can delete notifications
CREATE POLICY "Admins can delete notifications"
ON public.notifications
FOR DELETE
USING (
  is_admin_master(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Notification reads policies
-- Users can view their own reads
CREATE POLICY "Users can view own notification reads"
ON public.notification_reads
FOR SELECT
USING (user_id = auth.uid());

-- Users can mark notifications as read
CREATE POLICY "Users can mark notifications as read"
ON public.notification_reads
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can delete their own reads (to re-show notification)
CREATE POLICY "Users can delete own notification reads"
ON public.notification_reads
FOR DELETE
USING (user_id = auth.uid());