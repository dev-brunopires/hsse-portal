import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardStats } from '@/types/equipment';
import { useShipFilter } from '@/contexts/ShipFilterContext';

export function useDashboardStats() {
  const { selectedShipId, isFilterEnabled, isReady } = useShipFilter();
  
  return useQuery({
    queryKey: ['dashboard-stats', selectedShipId],
    enabled: isReady,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      const errorMessage = (error as Error)?.message?.toLowerCase() || '';
      if (errorMessage.includes('jwt') || errorMessage.includes('session')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    queryFn: async (): Promise<DashboardStats> => {
      const shipId = isFilterEnabled && selectedShipId ? selectedShipId : null;

      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_ship_id: shipId,
      });

      if (error) throw error;

      const stats = data as unknown as Record<string, any>;

      return {
        totalEquipment: stats.totalEquipment ?? 0,
        activeEquipment: stats.activeEquipment ?? 0,
        expiredEquipment: stats.expiredEquipment ?? 0,
        expiredCertificates: stats.expiredCertificates ?? 0,
        pendingInspections: stats.pendingInspections ?? 0,
        complianceRate: stats.complianceRate ?? 0,
        byCategory: stats.byCategory ?? [],
        byStatus: stats.byStatus ?? [],
        recentAlerts: stats.recentAlerts ?? [],
        pendingMaintenance: stats.pendingMaintenance ?? 0,
        overdueMaintenance: stats.overdueMaintenance ?? 0,
        inProgressMaintenance: stats.inProgressMaintenance ?? 0,
      };
    },
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}
