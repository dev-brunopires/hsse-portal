import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
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
  const { organization, isPlatformOwnerWithoutOrg, isLoading: isOrgLoading } = useOrganization();

  return useQuery({
    queryKey: ['notifications', user?.id, organization?.id, isPlatformOwnerWithoutOrg],
    queryFn: async () => {
      if (!user?.id) return [];

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
      
      if (organization?.id) {
        query = query.eq('organization_id', organization.id);
      } else if (!isPlatformOwnerWithoutOrg) {
        return [];
      }

      const { data: notifications, error: notifError } = await query;
      if (notifError) throw notifError;

      const { data: reads, error: readsError } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id);

      if (readsError) throw readsError;

      const readIds = new Set(reads?.map(r => r.notification_id) || []);

      return (notifications || []).map(n => ({
        ...n,
        is_read: readIds.has(n.id),
      })) as Notification[];
    },
    enabled: !!user?.id && !isOrgLoading && (!!organization?.id || isPlatformOwnerWithoutOrg),
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
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

      // Use the full queryKey that matches the actual query
      const queryKey = ['notifications', uid];
      const previous = queryClient.getQueriesData<Notification[]>({ queryKey });

      // Update all matching queries optimistically
      queryClient.setQueriesData<Notification[]>({ queryKey }, (old) =>
        (old ?? []).map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );

      return { previous, uid };
    },
    onError: (_err, _notificationId, ctx) => {
      if (ctx?.previous) {
        // Restore all matched queries
        for (const [key, data] of ctx.previous) {
          queryClient.setQueryData(key, data);
        }
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

      const queryKey = ['notifications', uid];
      const previous = queryClient.getQueriesData<Notification[]>({ queryKey });

      queryClient.setQueriesData<Notification[]>({ queryKey }, (old) =>
        (old ?? []).map((n) => ({ ...n, is_read: true }))
      );

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        for (const [key, data] of ctx.previous) {
          queryClient.setQueryData(key, data);
        }
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (notification: NotificationInsert) => {
      if (!organization?.id) {
        throw new Error(t('hooks.notifications.orgNotFound'));
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
        title: t('hooks.notifications.created'),
        description: t('hooks.notifications.createdDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('hooks.auth.error'),
        description: error.message || t('hooks.notifications.createError'),
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

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
        title: t('hooks.notifications.deleted'),
        description: t('hooks.notifications.deletedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('hooks.auth.error'),
        description: error.message || t('hooks.notifications.deleteError'),
        variant: 'destructive',
      });
    },
  });
}
