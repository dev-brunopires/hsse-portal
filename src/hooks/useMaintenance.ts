import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n';

export interface MaintenancePlan {
  id: string;
  equipment_id: string;
  title: string;
  description: string | null;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  next_due_date: string;
  last_completed_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  equipment?: {
    name: string;
    internal_code: string;
    ship_id: string | null;
    ships?: { name: string } | null;
  };
}

export interface MaintenanceLog {
  id: string;
  maintenance_plan_id: string;
  equipment_id: string;
  completed_by: string | null;
  completed_at: string;
  notes: string | null;
  status: 'completed' | 'partial' | 'skipped';
  created_at: string;
  profiles?: { full_name: string } | null;
}

export function useMaintenancePlans() {
  return useQuery({
    queryKey: ['maintenance-plans'],
    queryFn: async (): Promise<MaintenancePlan[]> => {
      const { data, error } = await supabase
        .from('maintenance_plans')
        .select(`
          *,
          equipment (
            name,
            internal_code,
            ship_id,
            ships (name)
          )
        `)
        .order('next_due_date', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as MaintenancePlan[];
    },
  });
}

export function useUpcomingMaintenance(days: number = 30) {
  return useQuery({
    queryKey: ['upcoming-maintenance', days],
    queryFn: async (): Promise<MaintenancePlan[]> => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const { data, error } = await supabase
        .from('maintenance_plans')
        .select(`
          *,
          equipment (
            name,
            internal_code,
            ship_id,
            ships (name)
          )
        `)
        .lte('next_due_date', futureDate.toISOString().split('T')[0])
        .order('next_due_date', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as MaintenancePlan[];
    },
  });
}

export function useMaintenanceLogs(planId?: string) {
  return useQuery({
    queryKey: ['maintenance-logs', planId],
    queryFn: async (): Promise<MaintenanceLog[]> => {
      let query = supabase
        .from('maintenance_logs')
        .select('*')
        .order('completed_at', { ascending: false });

      if (planId) {
        query = query.eq('maintenance_plan_id', planId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MaintenanceLog[];
    },
    enabled: planId !== undefined,
  });
}

export function useCreateMaintenancePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plan: Omit<MaintenancePlan, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('maintenance_plans')
        .insert(plan)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-plans'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-maintenance'] });
      toast.success(i18n.t('hooks.maintenance.planCreated'));
    },
    onError: (error) => {
      toast.error(i18n.t('hooks.maintenance.planCreateError'));
      console.error('Error creating maintenance plan:', error);
    },
  });
}

export function useUpdateMaintenancePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MaintenancePlan> & { id: string }) => {
      const { data, error } = await supabase
        .from('maintenance_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-plans'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-maintenance'] });
      toast.success(i18n.t('hooks.maintenance.planUpdated'));
    },
    onError: (error) => {
      toast.error(i18n.t('hooks.maintenance.planUpdateError'));
      console.error('Error updating maintenance plan:', error);
    },
  });
}

export function useDeleteMaintenancePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('maintenance_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-plans'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-maintenance'] });
      toast.success(i18n.t('hooks.maintenance.planDeleted'));
    },
    onError: (error) => {
      toast.error(i18n.t('hooks.maintenance.planDeleteError'));
      console.error('Error deleting maintenance plan:', error);
    },
  });
}

export function useCompleteMaintenance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      planId,
      equipmentId,
      notes,
      status = 'completed',
    }: {
      planId: string;
      equipmentId: string;
      notes?: string;
      status?: 'completed' | 'partial' | 'skipped';
    }) => {
      const { data: user } = await supabase.auth.getUser();

      // Create log entry
      const { error: logError } = await supabase
        .from('maintenance_logs')
        .insert({
          maintenance_plan_id: planId,
          equipment_id: equipmentId,
          completed_by: user?.user?.id,
          notes,
          status,
        });

      if (logError) throw logError;

      // Update plan with next due date
      const { data: plan } = await supabase
        .from('maintenance_plans')
        .select('frequency, next_due_date')
        .eq('id', planId)
        .single();

      if (plan) {
        const nextDate = calculateNextDueDate(plan.next_due_date, plan.frequency);
        await supabase
          .from('maintenance_plans')
          .update({
            last_completed_date: new Date().toISOString().split('T')[0],
            next_due_date: nextDate,
          })
          .eq('id', planId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-plans'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-logs'] });
      toast.success(i18n.t('hooks.maintenance.completed'));
    },
    onError: (error) => {
      toast.error(i18n.t('hooks.maintenance.completeError'));
      console.error('Error completing maintenance:', error);
    },
  });
}

function calculateNextDueDate(currentDate: string, frequency: string): string {
  const date = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  
  return date.toISOString().split('T')[0];
}
