import { useTranslation } from 'react-i18next';
import { Bell, Shield, Database, Mail, Plug, Rocket, Building2, Settings as SettingsIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationSettingsCard } from '@/components/dashboard/NotificationSettingsCard';
import { IFSIntegrationCard } from '@/components/settings/IFSIntegrationCard';
import { OrganizationSettingsCard } from '@/components/settings/OrganizationSettingsCard';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function Settings() {
  const { t } = useTranslation();
  const { resetTour, startTour } = useOnboarding();
  const { organization } = useOrganization();

  const handleRestartTour = () => {
    resetTour();
    setTimeout(() => startTour(), 300);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={SettingsIcon}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.notifications')}</span>
          </TabsTrigger>
          {organization && (
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('settings.organization')}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.security')}</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.integrations')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-6 space-y-6">
          <NotificationSettingsCard />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                {t('settings.alertPreferences')}
              </CardTitle>
              <CardDescription>{t('settings.configureAlertTypes')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-alerts">{t('settings.emailAlerts')}</Label>
                  <p className="text-sm text-muted-foreground">{t('settings.emailAlertsDesc')}</p>
                </div>
                <Switch id="email-alerts" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="dashboard-alerts">{t('settings.dashboardAlerts')}</Label>
                  <p className="text-sm text-muted-foreground">{t('settings.dashboardAlertsDesc')}</p>
                </div>
                <Switch id="dashboard-alerts" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="expiry-alerts">{t('settings.expiryAlerts')}</Label>
                  <p className="text-sm text-muted-foreground">{t('settings.expiryAlertsDesc')}</p>
                </div>
                <Switch id="expiry-alerts" defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {organization && (
          <TabsContent value="organization" className="mt-6">
            <OrganizationSettingsCard />
          </TabsContent>
        )}

        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {t('settings.securitySettings')}
              </CardTitle>
              <CardDescription>{t('settings.accountSecuritySettings')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start">
                {t('settings.changePassword')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                {t('settings.configureTwoFactor')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                {t('settings.manageSessions')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                {t('settings.data')}
              </CardTitle>
              <CardDescription>{t('settings.dataManagement')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start">
                {t('settings.exportData')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                {t('settings.importData')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                {t('settings.manualBackup')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                {t('settings.externalIntegrations')}
              </CardTitle>
              <CardDescription>{t('settings.connectOtherSystems')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.externalApi')}</Label>
                  <p className="text-sm text-muted-foreground">{t('settings.enableApiAccess')}</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.sapSync')}</Label>
                  <p className="text-sm text-muted-foreground">{t('settings.integrateWithSap')}</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          <IFSIntegrationCard />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                {t('settings.systemTour')}
              </CardTitle>
              <CardDescription>{t('settings.restartTourDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleRestartTour} variant="outline" className="w-full">
                <Rocket className="h-4 w-4 mr-2" />
                {t('settings.restartOnboardingTour')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}