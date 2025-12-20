import { Bell, Shield, Database, Mail, Plug, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationSettingsCard } from '@/components/dashboard/NotificationSettingsCard';
import { IFSIntegrationCard } from '@/components/settings/IFSIntegrationCard';
import { useOnboarding } from '@/hooks/useOnboarding';
export default function Settings() {
  const { resetTour, startTour } = useOnboarding();

  const handleRestartTour = () => {
    resetTour();
    setTimeout(() => startTour(), 300);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Configurações gerais do sistema
        </p>
      </div>

      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Segurança</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="h-4 w-4" />
            <span className="hidden sm:inline">Integrações</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-6 space-y-6">
          <NotificationSettingsCard />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Preferências de Alertas
              </CardTitle>
              <CardDescription>Configure quais tipos de alertas deseja receber</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-alerts">Alertas por E-mail</Label>
                  <p className="text-sm text-muted-foreground">Receba notificações por e-mail</p>
                </div>
                <Switch id="email-alerts" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="dashboard-alerts">Alertas no Dashboard</Label>
                  <p className="text-sm text-muted-foreground">Exibir alertas na tela principal</p>
                </div>
                <Switch id="dashboard-alerts" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="expiry-alerts">Alertas de Vencimento</Label>
                  <p className="text-sm text-muted-foreground">Notificar sobre inspeções vencidas</p>
                </div>
                <Switch id="expiry-alerts" defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Segurança
              </CardTitle>
              <CardDescription>Configurações de segurança da conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start">
                Alterar Senha
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Configurar Autenticação em Dois Fatores (2FA)
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Gerenciar Sessões Ativas
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Dados
              </CardTitle>
              <CardDescription>Gerenciamento de dados do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start">
                Exportar Dados
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Importar Dados
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Backup Manual
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Integrações Externas
              </CardTitle>
              <CardDescription>Conectar com outros sistemas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>API Externa</Label>
                  <p className="text-sm text-muted-foreground">Habilitar acesso via API</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sincronização SAP</Label>
                  <p className="text-sm text-muted-foreground">Integrar com sistema SAP</p>
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
                Tour do Sistema
              </CardTitle>
              <CardDescription>Reinicie o tour de introdução ao sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleRestartTour} variant="outline" className="w-full">
                <Rocket className="h-4 w-4 mr-2" />
                Reiniciar Tour de Onboarding
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
