import { Bell, BellOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function NotificationSettingsCard() {
  const { t } = useTranslation();
  const { 
    isSupported, 
    permission, 
    requestPermission,
    checkUpcomingInspections,
    checkExpiredCertificates,
  } = usePushNotifications();

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success(t('notificationSettings.enabledSuccess'));
      // Check for alerts immediately
      await checkUpcomingInspections();
      await checkExpiredCertificates();
    } else {
      toast.error(t('notificationSettings.permissionDenied'));
    }
  };

  const handleTestNotification = async () => {
    await checkUpcomingInspections();
    await checkExpiredCertificates();
    toast.success(t('notificationSettings.alertCheckCompleted'));
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BellOff className="h-4 w-4" />
            {t('notificationSettings.pushNotifications')}
          </CardTitle>
          <CardDescription>
            {t('notificationSettings.browserNotSupported')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{t('notificationSettings.pushNotifications')}</CardTitle>
              <CardDescription className="text-xs">
                {t('notificationSettings.receiveAlerts')}
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={permission === 'granted' 
              ? 'bg-green-500/20 text-green-600 border-green-500/30' 
              : 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30'
            }
          >
            {permission === 'granted' ? t('notificationSettings.enabled') : t('notificationSettings.disabled')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {permission === 'granted' ? (
          <>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>{t('notificationSettings.autoReceiveNotifications')}</span>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>{t('notificationSettings.upcomingInspections')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>{t('notificationSettings.expiredCertificates')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span>{t('notificationSettings.criticalEquipment')}</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handleTestNotification}
            >
              {t('notificationSettings.checkAlertsNow')}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{t('notificationSettings.notificationsDisabled')}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('notificationSettings.enableNotificationsDesc')}
            </p>
            <Button 
              className="w-full" 
              onClick={handleEnableNotifications}
            >
              <Bell className="h-4 w-4 mr-2" />
              {t('notificationSettings.enableNotifications')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
