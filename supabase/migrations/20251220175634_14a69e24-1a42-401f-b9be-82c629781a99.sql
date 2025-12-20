-- =====================================================
-- 1. MANUTENÇÃO PREVENTIVA - Tabela de planos de manutenção
-- =====================================================
CREATE TABLE public.maintenance_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'monthly', -- daily, weekly, monthly, quarterly, yearly
  next_due_date DATE NOT NULL,
  last_completed_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Registro de manutenções executadas
CREATE TABLE public.maintenance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  maintenance_plan_id UUID NOT NULL REFERENCES public.maintenance_plans(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed', -- completed, partial, skipped
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- 2. CHECKLIST CUSTOMIZÁVEL POR CATEGORIA
-- =====================================================
CREATE TABLE public.checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- 4. HISTÓRICO DE TRANSFERÊNCIAS
-- =====================================================
CREATE TABLE public.equipment_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  from_ship_id UUID REFERENCES public.ships(id),
  to_ship_id UUID NOT NULL REFERENCES public.ships(id),
  transferred_by UUID REFERENCES auth.users(id),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- 9. LOGS DE LOGIN
-- =====================================================
CREATE TABLE public.login_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT,
  user_name TEXT,
  action TEXT NOT NULL DEFAULT 'login', -- login, logout, failed_login
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- 12. FAVORITOS
-- =====================================================
CREATE TABLE public.user_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- equipment, ship
  entity_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Maintenance Plans RLS
ALTER TABLE public.maintenance_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view maintenance plans from their ships" 
ON public.maintenance_plans FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM equipment e 
    WHERE e.id = equipment_id 
    AND user_has_ship_access(auth.uid(), e.ship_id)
  )
);

CREATE POLICY "Admins and technicians can manage maintenance plans" 
ON public.maintenance_plans FOR ALL 
USING (is_admin_or_technician(auth.uid()))
WITH CHECK (is_admin_or_technician(auth.uid()));

-- Maintenance Logs RLS
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view maintenance logs from their ships" 
ON public.maintenance_logs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM equipment e 
    WHERE e.id = equipment_id 
    AND user_has_ship_access(auth.uid(), e.ship_id)
  )
);

CREATE POLICY "Admins and technicians can manage maintenance logs" 
ON public.maintenance_logs FOR ALL 
USING (is_admin_or_technician(auth.uid()))
WITH CHECK (is_admin_or_technician(auth.uid()));

-- Checklist Templates RLS
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view checklist templates" 
ON public.checklist_templates FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage checklist templates" 
ON public.checklist_templates FOR ALL 
USING (has_role(auth.uid(), 'admin') OR is_admin_master(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin') OR is_admin_master(auth.uid()));

-- Checklist Template Items RLS
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view checklist template items" 
ON public.checklist_template_items FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage checklist template items" 
ON public.checklist_template_items FOR ALL 
USING (has_role(auth.uid(), 'admin') OR is_admin_master(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin') OR is_admin_master(auth.uid()));

-- Equipment Transfers RLS
ALTER TABLE public.equipment_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transfers from their ships" 
ON public.equipment_transfers FOR SELECT 
USING (
  user_has_ship_access(auth.uid(), from_ship_id) OR 
  user_has_ship_access(auth.uid(), to_ship_id)
);

CREATE POLICY "Admins and technicians can manage transfers" 
ON public.equipment_transfers FOR ALL 
USING (is_admin_or_technician(auth.uid()))
WITH CHECK (is_admin_or_technician(auth.uid()));

-- Login Logs RLS
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own login logs" 
ON public.login_logs FOR SELECT 
USING (user_id = auth.uid() OR is_admin_master(auth.uid()));

CREATE POLICY "System can insert login logs" 
ON public.login_logs FOR INSERT 
WITH CHECK (true);

-- User Favorites RLS
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own favorites" 
ON public.user_favorites FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger for maintenance_plans
CREATE TRIGGER update_maintenance_plans_updated_at
BEFORE UPDATE ON public.maintenance_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update timestamp trigger for checklist_templates
CREATE TRIGGER update_checklist_templates_updated_at
BEFORE UPDATE ON public.checklist_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_maintenance_plans_equipment ON public.maintenance_plans(equipment_id);
CREATE INDEX idx_maintenance_plans_next_due ON public.maintenance_plans(next_due_date);
CREATE INDEX idx_maintenance_logs_plan ON public.maintenance_logs(maintenance_plan_id);
CREATE INDEX idx_checklist_templates_category ON public.checklist_templates(category_id);
CREATE INDEX idx_equipment_transfers_equipment ON public.equipment_transfers(equipment_id);
CREATE INDEX idx_equipment_transfers_date ON public.equipment_transfers(transfer_date);
CREATE INDEX idx_login_logs_user ON public.login_logs(user_id);
CREATE INDEX idx_login_logs_created ON public.login_logs(created_at);
CREATE INDEX idx_user_favorites_user ON public.user_favorites(user_id);