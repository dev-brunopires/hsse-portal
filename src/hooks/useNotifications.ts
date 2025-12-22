import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'reminder';
  ship_id: string | null;
  organization_id: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  ship?: {
    id: string;
    name: string;
  } | null;
  is_read?: boolean;
}

export interface NotificationInsert {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'alert' | 'reminder';
  ship_id?: string | null;
  expires_at?: string | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ['notifications', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get notifications
      let query = supabase
        .from('notifications')
        .select(`
          *,
          ship:ships (
            id,
            name
          )
        `)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false });
      
      // Filter by organization if available
      if (organization?.id) {
        query = query.eq('organization_id', organization.id);
      }

      const { data: notifications, error: notifError } = await query;

      if (notifError) throw notifError;

      // Get read notifications for this user
      const { data: reads, error: readsError } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id);

      if (readsError) throw readsError;

      const readIds = new Set(reads?.map(r => r.notification_id) || []);

      // Mark notifications as read/unread
      return (notifications || []).map(n => ({
        ...n,
        is_read: readIds.has(n.id),
      })) as Notification[];
    },
    enabled: !!user?.id && !!organization?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useUnreadNotifications() {
  const { data: notifications = [] } = useNotifications();
  return notifications.filter(n => !n.is_read);
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('notification_reads')
        .upsert(
          {
            notification_id: notificationId,
            user_id: user.id,
          },
          {
            onConflict: 'notification_id,user_id',
            ignoreDuplicates: true,
          }
        );

      if (error) throw error;
    },
    onMutate: async (notificationId) => {
      const uid = user?.id;
      if (!uid) return;

      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      const previous = queryClient.getQueryData<Notification[]>([
        'notifications',
        uid,
      ]);

      queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
        (old ?? []).map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );

      return { previous, uid };
    },
    onError: (_err, _notificationId, ctx) => {
      if (ctx?.previous && ctx?.uid) {
        queryClient.setQueryData(['notifications', ctx.uid], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: notifications = [] } = useNotifications();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const unreadNotifications = notifications.filter((n) => !n.is_read);

      if (unreadNotifications.length === 0) return;

      const { error } = await supabase
        .from('notification_reads')
        .upsert(
          unreadNotifications.map((n) => ({
            notification_id: n.id,
            user_id: user.id,
          })),
          {
            onConflict: 'notification_id,user_id',
            ignoreDuplicates: true,
          }
        );

      if (error) throw error;
    },
    onMutate: async () => {
      const uid = user?.id;
      if (!uid) return;

      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      const previous = queryClient.getQueryData<Notification[]>([
        'notifications',
        uid,
      ]);

      queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
        (old ?? []).map((n) => ({ ...n, is_read: true }))
      );

      return { previous, uid };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous && ctx?.uid) {
        queryClient.setQueryData(['notifications', ctx.uid], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (notification: NotificationInsert) => {
      if (!organization?.id) {
        throw new Error('Organização não encontrada');
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert({
          ...notification,
          created_by: user?.id,
          organization_id: organization.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: 'Notificação Criada',
        description: 'A notificação foi enviada com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar notificação.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: 'Notificação Removida',
        description: 'A notificação foi removida com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover notificação.',
        variant: 'destructive',
      });
    },
  });
}
