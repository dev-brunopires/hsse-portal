import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, isAfter, isBefore, startOfMonth, endOfMonth } from 'date-fns';
import type { DashboardStats, Alert, CategoryStats, StatusStats, EquipmentStatus } from '@/types/equipment';

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

      const totalEquipment = equipment?.length || 0;
      const activeEquipment = equipment?.filter(e => e.status === 'active').length || 0;
      const expiredEquipment = equipment?.filter(e => e.status === 'expired' || e.status === 'rejected').length || 0;
      const pendingInspections = pendingInspectionsData?.length || 0;

      // Calculate compliance rate
      const compliantEquipment = equipment?.filter(e => 
        e.status === 'active' || e.status === 'maintenance'
      ).length || 0;
      const complianceRate = totalEquipment > 0 
        ? Number(((compliantEquipment / totalEquipment) * 100).toFixed(1))
        : 0;

      // Group by category
      const categoryMap = new Map<string, { count: number; compliant: number; nonCompliant: number }>();
      equipment?.forEach(eq => {
        const categoryName = eq.categories?.name || 'Sem Categoria';
        const current = categoryMap.get(categoryName) || { count: 0, compliant: 0, nonCompliant: 0 };
        current.count++;
        if (eq.status === 'active' || eq.status === 'maintenance') {
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

      // Group by status
      const statusMap = new Map<EquipmentStatus, number>();
      const statusList: EquipmentStatus[] = ['active', 'maintenance', 'expired', 'rejected', 'inactive'];
      statusList.forEach(s => statusMap.set(s, 0));
      
      equipment?.forEach(eq => {
        const status = eq.status as EquipmentStatus;
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
      });

      const byStatus: StatusStats[] = statusList.map(status => ({
        status,
        count: statusMap.get(status) || 0,
      }));

      // Generate alerts
      const alerts: Alert[] = [];

      equipment?.forEach(eq => {
        // Expired certificates
        if (eq.certificate_expiry) {
          const certExpiry = new Date(eq.certificate_expiry);
          if (isBefore(certExpiry, today)) {
            alerts.push({
              id: `alert-expired-${eq.id}`,
              type: 'expired',
              message: 'Certificado vencido',
              equipmentId: eq.id,
              equipmentName: `${eq.name} ${eq.internal_code}`,
              date: eq.certificate_expiry,
              severity: 'high',
            });
          } else if (isBefore(certExpiry, thirtyDaysFromNow)) {
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

        // Rejected equipment
        if (eq.status === 'rejected') {
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
        pendingInspections,
        complianceRate,
        byCategory,
        byStatus,
        recentAlerts: sortedAlerts,
      };
    },
  });
}
