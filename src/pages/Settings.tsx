import { Settings as SettingsIcon, Bell, Shield, Database, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function Settings() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Configurações gerais do sistema
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notificações
            </CardTitle>
            <CardDescription>Configure as preferências de alertas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-alerts">Alertas por E-mail</Label>
              <Switch id="email-alerts" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="dashboard-alerts">Alertas no Dashboard</Label>
              <Switch id="dashboard-alerts" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="expiry-alerts">Alertas de Vencimento</Label>
              <Switch id="expiry-alerts" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Segurança
            </CardTitle>
            <CardDescription>Configurações de segurança da conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full">Alterar Senha</Button>
            <Button variant="outline" className="w-full">Configurar 2FA</Button>
            <Button variant="outline" className="w-full">Gerenciar Sessões</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Dados
            </CardTitle>
            <CardDescription>Gerenciamento de dados do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full">Exportar Dados</Button>
            <Button variant="outline" className="w-full">Importar Dados</Button>
            <Button variant="outline" className="w-full">Backup Manual</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Integrações
            </CardTitle>
            <CardDescription>Conectar com outros sistemas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>API Externa</Label>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <Label>Sincronização SAP</Label>
              <Switch />
            </div>
            <Button variant="outline" className="w-full mt-4">Configurar Integrações</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
