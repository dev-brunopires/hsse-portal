import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, differenceInHours } from 'date-fns';
import { useShipFilter } from '@/contexts/ShipFilterContext';

export interface InspectorStats {
  inspectorId: string;
  inspectorName: string;
  totalInspections: number;
  approvedCount: number;
  attentionCount: number;
  rejectedCount: number;
  approvalRate: number;
  averageTimeHours: number;
}

export interface PerformanceMetrics {
  inspectorStats: InspectorStats[];
  overallStats: {
    totalInspections: number;
    averagePerInspector: number;
    bestPerformer: string;
    mostProductiveInspector: string;
  };
}

export function useInspectorStats(startDate?: Date, endDate?: Date) {
  const { selectedShipId, isFilterEnabled } = useShipFilter();
  const defaultStartDate = startOfMonth(subMonths(new Date(), 2));
  const defaultEndDate = endOfMonth(new Date());

  return useQuery({
    queryKey: ['inspector-stats', startDate?.toISOString(), endDate?.toISOString(), selectedShipId],
    queryFn: async (): Promise<PerformanceMetrics> => {
      const from = (startDate || defaultStartDate).toISOString().split('T')[0];
      const to = (endDate || defaultEndDate).toISOString().split('T')[0];

      // Fetch inspections with inspector profiles
      let query = supabase
        .from('inspections')
        .select(`
          id,
          status,
          inspection_date,
          created_at,
          inspector_id
        `)
        .gte('inspection_date', from)
        .lte('inspection_date', to);
      
      // Apply ship filter when enabled
      if (isFilterEnabled && selectedShipId) {
        query = query.eq('ship_id', selectedShipId);
      }
      
      const { data: inspections, error } = await query;

      if (error) throw error;

      // Fetch profiles
      const inspectorIds = [...new Set(inspections?.map(i => i.inspector_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', inspectorIds);

      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = p.full_name;
        return acc;
      }, {} as Record<string, string>);

      // Calculate stats per inspector
      const statsMap = new Map<string, {
        total: number;
        approved: number;
        attention: number;
        rejected: number;
        createdTimes: Date[];
      }>();

      (inspections || []).forEach(inspection => {
        const current = statsMap.get(inspection.inspector_id) || {
          total: 0,
          approved: 0,
          attention: 0,
          rejected: 0,
          createdTimes: [],
        };

        current.total++;
        if (inspection.status === 'compliant') current.approved++;
        else if (inspection.status === 'attention') current.attention++;
        else if (inspection.status === 'rejected' || inspection.status === 'non-compliant') current.rejected++;
        
        current.createdTimes.push(new Date(inspection.created_at));
        statsMap.set(inspection.inspector_id, current);
      });

      const inspectorStats: InspectorStats[] = Array.from(statsMap.entries()).map(([inspectorId, stats]) => {
        // Calculate average time between inspections
        let avgTime = 0;
        if (stats.createdTimes.length > 1) {
          const sorted = stats.createdTimes.sort((a, b) => a.getTime() - b.getTime());
          let totalDiff = 0;
          for (let i = 1; i < sorted.length; i++) {
            totalDiff += differenceInHours(sorted[i], sorted[i - 1]);
          }
          avgTime = totalDiff / (sorted.length - 1);
        }

        return {
          inspectorId,
          inspectorName: profileMap[inspectorId] || 'Desconhecido',
          totalInspections: stats.total,
          approvedCount: stats.approved,
          attentionCount: stats.attention,
          rejectedCount: stats.rejected,
          approvalRate: stats.total > 0 ? (stats.approved / stats.total) * 100 : 0,
          averageTimeHours: avgTime,
        };
      }).sort((a, b) => b.totalInspections - a.totalInspections);

      const totalInspections = inspectorStats.reduce((sum, s) => sum + s.totalInspections, 0);
      const bestPerformer = inspectorStats.reduce((best, current) => 
        current.approvalRate > (best?.approvalRate || 0) ? current : best
      , inspectorStats[0]);
      const mostProductive = inspectorStats[0];

      return {
        inspectorStats,
        overallStats: {
          totalInspections,
          averagePerInspector: inspectorStats.length > 0 ? totalInspections / inspectorStats.length : 0,
          bestPerformer: bestPerformer?.inspectorName || '-',
          mostProductiveInspector: mostProductive?.inspectorName || '-',
        },
      };
    },
  });
}
