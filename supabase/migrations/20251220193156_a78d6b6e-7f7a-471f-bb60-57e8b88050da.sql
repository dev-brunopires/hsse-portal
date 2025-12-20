-- Adicionar campo de prazo de conclusão (due_date) na tabela maintenance_requests
ALTER TABLE public.maintenance_requests 
ADD COLUMN IF NOT EXISTS due_date date;