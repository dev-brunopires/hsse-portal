import { Bell, AlertTriangle, Clock, XCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { Alert } from '@/types/equipment';

const alertTypeConfig = {
  expired: { icon: XCircle, color: 'text-status-danger', bg: 'bg-status-danger/10', label: 'Vencido' },
  expiring: { icon: Clock, color: 'text-status-warning', bg: 'bg-status-warning/10', label: 'Expirando' },
  inspection_due: { icon: Bell, color: 'text-accent', bg: 'bg-accent/10', label: 'Inspeção' },
  non_compliant: { icon: AlertTriangle, color: 'text-status-danger', bg: 'bg-status-danger/10', label: 'Não Conforme' },
};

export default function Alerts() {
  const { data: stats, isLoading, error } = useDashboardStats();

  const alerts = stats?.recentAlerts || [];
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const mediumCount = alerts.filter(a => a.severity === 'medium').length;
  const lowCount = alerts.filter(a => a.severity === 'low').length;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
            <p className="text-muted-foreground">
              Notificações e itens que requerem atenção
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Erro ao carregar alertas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
          <p className="text-muted-foreground">
            Notificações e itens que requerem atenção
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <CheckCircle className="h-4 w-4" />
          Marcar todos como lidos
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{alerts.length}</p>
          </CardContent>
        </Card>
        <Card className="border-status-danger/30 bg-status-danger/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-status-danger">Alta Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-status-danger">{highCount}</p>
          </CardContent>
        </Card>
        <Card className="border-status-warning/30 bg-status-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-status-warning">Média Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-status-warning">{mediumCount}</p>
          </CardContent>
        </Card>
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-accent">Baixa Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-accent">{lowCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todos os Alertas</CardTitle>
          <CardDescription>Lista completa de alertas ativos</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-status-success" />
              <p className="text-lg font-medium">Nenhum alerta ativo</p>
              <p className="text-sm">Todos os equipamentos estão em conformidade.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {alerts.map((alert) => {
                const config = alertTypeConfig[alert.type];
                const Icon = config.icon;
                
                return (
                  <div
                    key={alert.id}
                    className="p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn('p-2 rounded-lg', config.bg)}>
                      <Icon className={cn('h-5 w-5', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded', config.bg, config.color)}>
                          {config.label}
                        </span>
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded',
                          alert.severity === 'high' && 'bg-status-danger/10 text-status-danger',
                          alert.severity === 'medium' && 'bg-status-warning/10 text-status-warning',
                          alert.severity === 'low' && 'bg-accent/10 text-accent',
                        )}>
                          {alert.severity === 'high' ? 'Alta' : alert.severity === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                      </div>
                      <p className="font-medium text-foreground mt-1">{alert.message}</p>
                      <p className="text-sm text-muted-foreground">{alert.equipmentName}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">Ver Detalhes</Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
