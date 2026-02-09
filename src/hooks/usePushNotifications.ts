import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { addDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getLocalToday, formatLocalDate } from '@/utils/dateFormat';

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, any>;
}

export function usePushNotifications() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback(async (options: PushNotificationOptions) => {
    if (!isSupported || permission !== 'granted') return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || '/pwa-192x192.png',
        tag: options.tag,
        data: options.data,
      });
      return true;
    } catch (error) {
      // Fallback to regular notification
      try {
        new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/pwa-192x192.png',
          tag: options.tag,
        });
        return true;
      } catch (fallbackError) {
        console.error('Error showing notification:', fallbackError);
        return false;
      }
    }
  }, [isSupported, permission]);

  const checkUpcomingInspections = useCallback(async () => {
    if (!user?.id || permission !== 'granted') return;

    try {
      const today = new Date();
      const sevenDaysFromNow = addDays(today, 7);

      const { data: equipment } = await supabase
        .from('equipment')
        .select('id, name, internal_code, next_inspection')
        .not('next_inspection', 'is', null)
        .lte('next_inspection', formatLocalDate(sevenDaysFromNow))
        .gte('next_inspection', formatLocalDate(today));

      if (equipment && equipment.length > 0) {
        // Show grouped notification
        await showNotification({
          title: t('pushNotifications.upcomingInspections'),
          body: t('pushNotifications.upcomingInspectionsBody', { count: equipment.length }),
          tag: 'upcoming-inspections',
          data: { type: 'upcoming-inspections', count: equipment.length },
        });
      }
    } catch (error) {
      console.error('Error checking upcoming inspections:', error);
    }
  }, [user?.id, permission, showNotification, t]);

  const checkExpiredCertificates = useCallback(async () => {
    if (!user?.id || permission !== 'granted') return;

    try {
      const today = getLocalToday();

      const { data: equipment } = await supabase
        .from('equipment')
        .select('id, name, internal_code, certificate_expiry')
        .not('certificate_expiry', 'is', null)
        .lt('certificate_expiry', today);

      if (equipment && equipment.length > 0) {
        await showNotification({
          title: t('pushNotifications.expiredCertificates'),
          body: t('pushNotifications.expiredCertificatesBody', { count: equipment.length }),
          tag: 'expired-certificates',
          data: { type: 'expired-certificates', count: equipment.length },
        });
      }
    } catch (error) {
      console.error('Error checking expired certificates:', error);
    }
  }, [user?.id, permission, showNotification, t]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    checkUpcomingInspections,
    checkExpiredCertificates,
  };
}
