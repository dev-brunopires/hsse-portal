import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  changed_fields: string[] | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
  reverted_at: string | null;
  reverted_by: string | null;
  reverted_by_name: string | null;
}

interface UseAuditLogsOptions {
  tableName?: string;
  recordId?: string;
  limit?: number;
}

export function useAuditLogs(options: UseAuditLogsOptions = {}) {
  const { tableName, recordId, limit = 100 } = options;

  return useQuery({
    queryKey: ['audit-logs', tableName, recordId, limit],
    queryFn: async (): Promise<AuditLog[]> => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (tableName) {
        query = query.eq('table_name', tableName);
      }

      if (recordId) {
        query = query.eq('record_id', recordId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as AuditLog[];
    },
  });
}

export function useEquipmentAuditLogs(equipmentId?: string) {
  return useAuditLogs({
    tableName: 'equipment',
    recordId: equipmentId,
    limit: 50,
  });
}

export function useInspectionAuditLogs(inspectionId?: string) {
  return useAuditLogs({
    tableName: 'inspections',
    recordId: inspectionId,
    limit: 50,
  });
}
