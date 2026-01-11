import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, isAfter, isBefore, startOfMonth, endOfMonth } from 'date-fns';
import type { DashboardStats, Alert, CategoryStats, StatusStats, EquipmentStatus } from '@/types/equipment';
import { getEffectiveEquipmentStatus } from '@/utils/equipmentStatus';
import { useShipFilter } from '@/contexts/ShipFilterContext';

export function useDashboardStats() {
  const { selectedShipId, isFilterEnabled, isReady } = useShipFilter();
  
  return useQuery({
    queryKey: ['dashboard-stats', selectedShipId],
    enabled: isReady, // Wait for ship filter to be initialized
    queryFn: async (): Promise<DashboardStats> => {
      const today = new Date();
      const thirtyDaysFromNow = addDays(today, 30);
      const todayStr = today.toISOString().split('T')[0];

      // Single optimized query for equipment with categories
      let equipmentQuery = supabase
        .from('equipment')
        .select(`
          id,
          name,
          internal_code,
          status,
          category_id,
          certificate_expiry,
          expiry_date,
          next_inspection,
          ship_id,
          categories (name)
        `);
      
      // Apply ship filter for admin/admin_master when a specific ship is selected
      if (isFilterEnabled && selectedShipId) {
        equipmentQuery = equipmentQuery.eq('ship_id', selectedShipId);
      }

      // Fetch maintenance requests in parallel with equipment
      let maintenanceQuery = supabase
        .from('maintenance_requests')
        .select('id, status, due_date, type, priority, title, equipment_id, ship_id');
      
      if (isFilterEnabled && selectedShipId) {
        maintenanceQuery = maintenanceQuery.eq('ship_id', selectedShipId);
      }

      // Execute both queries in parallel
      const [equipmentResult, maintenanceResult] = await Promise.all([
        equipmentQuery,
        maintenanceQuery,
      ]);

      if (equipmentResult.error) throw equipmentResult.error;
      if (maintenanceResult.error) throw maintenanceResult.error;

      const equipment = equipmentResult.data;
      const maintenanceData = maintenanceResult.data;

      // Calculate pending inspections from loaded equipment data (no separate query needed)
      const pendingInspectionsData = equipment?.filter(e => 
        e.next_inspection && e.next_inspection <= thirtyDaysFromNow.toISOString().split('T')[0]
      ) || [];

      // Fetch equipment names for maintenance alerts (only if needed)
      const maintenanceEquipmentIds = [...new Set((maintenanceData || []).map(m => m.equipment_id))];
      let maintenanceEquipmentMap = new Map<string, { id: string; name: string; internal_code: string }>();
      
      if (maintenanceEquipmentIds.length > 0) {
        const { data: maintenanceEquipment } = await supabase
          .from('equipment')
          .select('id, name, internal_code')
          .in('id', maintenanceEquipmentIds);
        
        maintenanceEquipmentMap = new Map((maintenanceEquipment || []).map(e => [e.id, e]));
      }

      const totalEquipment = equipment?.length || 0;
      
      // Calculate effective status for each equipment
      const equipmentWithEffectiveStatus = equipment?.map(e => ({
        ...e,
        effectiveResult: getEffectiveEquipmentStatus(e)
      })) || [];

      const activeEquipment = equipmentWithEffectiveStatus.filter(e => 
        e.effectiveResult.effectiveStatus === 'active'
      ).length;
      
      const expiredEquipment = equipmentWithEffectiveStatus.filter(e => 
        e.effectiveResult.effectiveStatus === 'expired' || 
        e.effectiveResult.effectiveStatus === 'rejected'
      ).length;
      
      // Count equipment with expired certificates (regardless of status)
      const expiredCertificates = equipment?.filter(e => {
        if (!e.certificate_expiry) return false;
        return e.certificate_expiry < todayStr;
      }).length || 0;
      
      const pendingInspections = pendingInspectionsData?.length || 0;

      // Calculate compliance rate - using effective status
      const nonCompliantEquipment = equipmentWithEffectiveStatus.filter(e => {
        const effectiveStatus = e.effectiveResult.effectiveStatus;
        return effectiveStatus === 'expired' || effectiveStatus === 'rejected' || effectiveStatus === 'inactive';
      }).length;
      
      const compliantEquipment = totalEquipment - nonCompliantEquipment;
      const complianceRate = totalEquipment > 0 
        ? Number(((compliantEquipment / totalEquipment) * 100).toFixed(1))
        : 0;

      // Maintenance stats
      const pendingMaintenance = maintenanceData?.filter(m => m.status === 'pending' || m.status === 'approved').length || 0;
      const inProgressMaintenance = maintenanceData?.filter(m => m.status === 'in_progress').length || 0;
      const overdueMaintenance = maintenanceData?.filter(m => {
        if (m.status === 'completed' || m.status === 'rejected') return false;
        if (!m.due_date) return false;
        return m.due_date < todayStr;
      }).length || 0;

      // Group by category (using effective status)
      const categoryMap = new Map<string, { count: number; compliant: number; nonCompliant: number }>();
      equipmentWithEffectiveStatus.forEach(eq => {
        const categoryName = eq.categories?.name || 'Sem Categoria';
        const current = categoryMap.get(categoryName) || { count: 0, compliant: 0, nonCompliant: 0 };
        current.count++;
        const effectiveStatus = eq.effectiveResult.effectiveStatus;
        if (effectiveStatus === 'active' || effectiveStatus === 'maintenance') {
          current.compliant++;
        } else {
          current.nonCompliant++;
        }
        categoryMap.set(categoryName, current);
      });

      const byCategory: CategoryStats[] = Array.from(categoryMap.entries()).map(([category, stats]) => ({
        category,
        count: stats.count,
        compliant: stats.compliant,
        nonCompliant: stats.nonCompliant,
      }));

      // Group by effective status
      const statusMap = new Map<EquipmentStatus, number>();
      const statusList: EquipmentStatus[] = ['active', 'maintenance', 'expired', 'rejected', 'inactive'];
      statusList.forEach(s => statusMap.set(s, 0));
      
      equipmentWithEffectiveStatus.forEach(eq => {
        const effectiveStatus = eq.effectiveResult.effectiveStatus;
        statusMap.set(effectiveStatus, (statusMap.get(effectiveStatus) || 0) + 1);
      });

      const byStatus: StatusStats[] = statusList.map(status => ({
        status,
        count: statusMap.get(status) || 0,
      }));

      // Generate alerts (using effective status)
      const alerts: Alert[] = [];

      equipmentWithEffectiveStatus.forEach(eq => {
        // Auto-rejected equipment (expired certificate/hydrostatic test)
        if (eq.effectiveResult.isAutoRejected) {
          alerts.push({
            id: `alert-auto-rejected-${eq.id}`,
            type: 'non_compliant',
            message: `Reprovado: ${eq.effectiveResult.reasons.join(', ')}`, // Fallback
            messageKey: 'alerts.msgRejectedAuto',
            reasonKeys: eq.effectiveResult.reasonKeys,
            equipmentId: eq.id,
            equipmentName: `${eq.name} ${eq.internal_code}`,
            date: today.toISOString().split('T')[0],
            severity: 'high',
          });
        } else {
          // Expiring certificates (only if not already expired)
          if (eq.certificate_expiry) {
            const certExpiry = new Date(eq.certificate_expiry);
            if (isBefore(certExpiry, thirtyDaysFromNow) && isAfter(certExpiry, today)) {
              alerts.push({
                id: `alert-expiring-${eq.id}`,
                type: 'expiring',
                message: 'Certificado expira em breve', // Fallback
                messageKey: 'alerts.msgCertificateExpiring',
                equipmentId: eq.id,
                equipmentName: `${eq.name} ${eq.internal_code}`,
                date: eq.certificate_expiry,
                severity: 'medium',
              });
            }
          }
        }

        // Rejected equipment (stored status)
        if (eq.status === 'rejected' && !eq.effectiveResult.isAutoRejected) {
          alerts.push({
            id: `alert-rejected-${eq.id}`,
            type: 'non_compliant',
            message: 'Equipamento reprovado em inspeção', // Fallback
            messageKey: 'alerts.msgEquipmentRejected',
            equipmentId: eq.id,
            equipmentName: `${eq.name} ${eq.internal_code}`,
            date: today.toISOString().split('T')[0],
            severity: 'high',
          });
        }

        // Upcoming inspections
        if (eq.next_inspection) {
          const nextInsp = new Date(eq.next_inspection);
          if (isAfter(nextInsp, today) && isBefore(nextInsp, addDays(today, 7))) {
            alerts.push({
              id: `alert-inspection-${eq.id}`,
              type: 'inspection_due',
              message: 'Inspeção programada para esta semana', // Fallback
              messageKey: 'alerts.msgInspectionScheduled',
              equipmentId: eq.id,
              equipmentName: `${eq.name} ${eq.internal_code}`,
              date: eq.next_inspection,
              severity: 'low',
            });
          }
        }
      });

      // Add maintenance alerts
      maintenanceData?.forEach(m => {
        if (m.status === 'completed' || m.status === 'rejected') return;
        
        const equipmentInfo = maintenanceEquipmentMap.get(m.equipment_id);
        const equipmentName = equipmentInfo ? `${equipmentInfo.name} ${equipmentInfo.internal_code}` : 'Equipamento';

        // Overdue maintenance
        if (m.due_date && m.due_date < todayStr) {
          const messageKey = m.type === 'corrective' 
            ? 'alerts.msgMaintenanceCorrectiveOverdue' 
            : 'alerts.msgMaintenancePreventiveOverdue';
          alerts.push({
            id: `alert-maint-overdue-${m.id}`,
            type: 'maintenance_overdue',
            message: `Manutenção ${m.type === 'corrective' ? 'corretiva' : 'preventiva'} atrasada: ${m.title}`, // Fallback
            messageKey,
            messageParams: { title: m.title },
            equipmentId: m.equipment_id,
            equipmentName,
            date: m.due_date,
            severity: 'high',
            maintenanceId: m.id,
          });
        }
        // Pending critical/high priority maintenance
        else if ((m.priority === 'critical' || m.priority === 'high') && m.status === 'pending') {
          const messageKey = m.priority === 'critical' 
            ? 'alerts.msgMaintenanceCriticalPending' 
            : 'alerts.msgMaintenanceHighPending';
          alerts.push({
            id: `alert-maint-pending-${m.id}`,
            type: 'maintenance_pending',
            message: `Manutenção ${m.priority === 'critical' ? 'crítica' : 'alta prioridade'} pendente: ${m.title}`, // Fallback
            messageKey,
            messageParams: { title: m.title },
            equipmentId: m.equipment_id,
            equipmentName,
            date: m.due_date || todayStr,
            severity: m.priority === 'critical' ? 'high' : 'medium',
            maintenanceId: m.id,
          });
        }
      });

      // Sort alerts by severity (high first) and limit to 15
      const sortedAlerts = alerts
        .sort((a, b) => {
          const severityOrder = { high: 0, medium: 1, low: 2 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        })
        .slice(0, 15);

      return {
        totalEquipment,
        activeEquipment,
        expiredEquipment,
        expiredCertificates,
        pendingInspections,
        complianceRate,
        byCategory,
        byStatus,
        recentAlerts: sortedAlerts,
        pendingMaintenance,
        overdueMaintenance,
        inProgressMaintenance,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes cache to reduce API calls
    refetchOnWindowFocus: false, // Prevent refetch on tab switch
  });
}
