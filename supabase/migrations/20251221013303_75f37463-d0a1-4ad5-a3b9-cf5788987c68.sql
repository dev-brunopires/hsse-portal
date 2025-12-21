-- Add work_order field to maintenance_requests table
ALTER TABLE public.maintenance_requests 
ADD COLUMN work_order TEXT;