import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, isAfter, isBefore, startOfMonth, endOfMonth } from 'date-fns';
import type { DashboardStats, Alert, CategoryStats, StatusStats, EquipmentStatus } from '@/types/equipment';
import { getEffectiveEquipmentStatus } from '@/utils/equipmentStatus';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const today = new Date();
      const thirtyDaysFromNow = addDays(today, 30);

      // Fetch all equipment with categories
      const { data: equipment, error: equipmentError } = await supabase
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
          categories (name)
        `);

      if (equipmentError) throw equipmentError;

      // Fetch pending inspections (next 30 days)
      const { data: pendingInspectionsData, error: inspectionsError } = await supabase
        .from('equipment')
        .select('id')
        .not('next_inspection', 'is', null)
        .lte('next_inspection', thirtyDaysFromNow.toISOString().split('T')[0]);

      if (inspectionsError) throw inspectionsError;

      const todayStr = today.toISOString().split('T')[0];
      
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
            message: `Reprovado: ${eq.effectiveResult.reasons.join(', ')}`,
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
                message: 'Certificado expira em breve',
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
            message: 'Equipamento reprovado em inspeção',
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
              message: 'Inspeção programada para esta semana',
              equipmentId: eq.id,
              equipmentName: `${eq.name} ${eq.internal_code}`,
              date: eq.next_inspection,
              severity: 'low',
            });
          }
        }
      });

      // Sort alerts by severity (high first) and limit to 10
      const sortedAlerts = alerts
        .sort((a, b) => {
          const severityOrder = { high: 0, medium: 1, low: 2 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        })
        .slice(0, 10);

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
      };
    },
  });
}
