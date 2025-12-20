import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LoginLog {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  action: 'login' | 'logout' | 'failed_login';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export function useLoginLogs(userId?: string, limit: number = 100) {
  return useQuery({
    queryKey: ['login-logs', userId, limit],
    queryFn: async (): Promise<LoginLog[]> => {
      let query = supabase
        .from('login_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LoginLog[];
    },
  });
}

export function useCreateLoginLog() {
  return useMutation({
    mutationFn: async ({
      userId,
      userEmail,
      userName,
      action,
    }: {
      userId: string;
      userEmail?: string;
      userName?: string;
      action: 'login' | 'logout' | 'failed_login';
    }) => {
      const { error } = await supabase
        .from('login_logs')
        .insert({
          user_id: userId,
          user_email: userEmail,
          user_name: userName,
          action,
          user_agent: navigator.userAgent,
        });

      if (error) throw error;
    },
  });
}
