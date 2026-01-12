import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { addYears } from 'date-fns';

/**
 * Hook to bulk renew multiple certificates
 */
export function useBulkRenewCertificates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      certificateIds, 
      monthsToAdd = 12 
    }: { 
      certificateIds: string[]; 
      monthsToAdd?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const newExpiryDate = addYears(new Date(), monthsToAdd / 12).toISOString().split('T')[0];

      // Update all certificates
      const { error } = await supabase
        .from('certificates')
        .update({ 
          expiry_date: newExpiryDate,
          status: 'valid',
          last_renewal_date: new Date().toISOString(),
          renewed_by: user?.id,
        })
        .in('id', certificateIds);

      if (error) throw error;

      return { count: certificateIds.length, newExpiryDate };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      queryClient.invalidateQueries({ queryKey: ['certificate-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      
      toast.success(i18n.t('certificates.bulkRenewSuccess', { count: result.count }));
    },
    onError: (error: Error) => {
      toast.error(i18n.t('certificates.bulkRenewError'), {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to bulk approve multiple maintenance requests
 */
export function useBulkApproveMaintenanceRequests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('maintenance_requests')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .in('id', requestIds)
        .eq('status', 'pending'); // Only approve pending ones

      if (error) throw error;

      return { count: requestIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      
      toast.success(i18n.t('maintenance.bulkApproveSuccess', { count: result.count }));
    },
    onError: (error: Error) => {
      toast.error(i18n.t('maintenance.bulkApproveError'), {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to bulk complete multiple maintenance requests
 */
export function useBulkCompleteMaintenanceRequests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('maintenance_requests')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
        })
        .in('id', requestIds)
        .in('status', ['approved', 'in_progress']); // Only complete approved/in_progress

      if (error) throw error;

      return { count: requestIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      
      toast.success(i18n.t('maintenance.bulkCompleteSuccess', { count: result.count }));
    },
    onError: (error: Error) => {
      toast.error(i18n.t('maintenance.bulkCompleteError'), {
        description: error.message,
      });
    },
  });
}
