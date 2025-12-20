import { Bell, BellOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

export function NotificationSettingsCard() {
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
      toast.success('Notificações ativadas com sucesso!');
      // Check for alerts immediately
      await checkUpcomingInspections();
      await checkExpiredCertificates();
    } else {
      toast.error('Permissão para notificações negada');
    }
  };

  const handleTestNotification = async () => {
    await checkUpcomingInspections();
    await checkExpiredCertificates();
    toast.success('Verificação de alertas concluída');
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BellOff className="h-4 w-4" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Seu navegador não suporta notificações push
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
              <CardTitle className="text-base">Notificações Push</CardTitle>
              <CardDescription className="text-xs">
                Receba alertas sobre inspeções e vencimentos
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
            {permission === 'granted' ? 'Ativado' : 'Desativado'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {permission === 'granted' ? (
          <>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Você receberá notificações automáticas</span>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Inspeções próximas do vencimento</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>Certificados expirados</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span>Equipamentos com status crítico</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handleTestNotification}
            >
              Verificar Alertas Agora
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              <span>Notificações desativadas</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Ative as notificações para receber alertas sobre inspeções próximas do vencimento e certificados expirados.
            </p>
            <Button 
              className="w-full" 
              onClick={handleEnableNotifications}
            >
              <Bell className="h-4 w-4 mr-2" />
              Ativar Notificações
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
