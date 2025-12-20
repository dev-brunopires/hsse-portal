import { AlertTriangle, Clock, XCircle, AlertCircle, ArrowRight, Bell } from 'lucide-react';
import { Alert } from '@/types/equipment';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ModernAlertsListProps {
  alerts: Alert[];
}

const alertTypeConfig = {
  expired: { 
    icon: XCircle, 
    color: 'text-red-600 dark:text-red-400', 
    bg: 'bg-red-500/10',
    label: 'Vencido'
  },
  expiring: { 
    icon: Clock, 
    color: 'text-amber-600 dark:text-amber-400', 
    bg: 'bg-amber-500/10',
    label: 'Expirando'
  },
  inspection_due: { 
    icon: AlertCircle, 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-500/10',
    label: 'Inspeção'
  },
  non_compliant: { 
    icon: AlertTriangle, 
    color: 'text-red-600 dark:text-red-400', 
    bg: 'bg-red-500/10',
    label: 'Reprovado'
  },
};

const severityBorder = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-blue-500',
};

export function ModernAlertsList({ alerts }: ModernAlertsListProps) {
  const formatAlertDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, "dd 'de' MMM", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-5 border-b bg-gradient-to-r from-red-500/5 via-amber-500/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 rounded-xl">
              <Bell className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Alertas</h3>
              <p className="text-sm text-muted-foreground">{alerts.length} itens requerem atenção</p>
            </div>
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {alerts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Nenhum alerta no momento</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const config = alertTypeConfig[alert.type];
              const Icon = config.icon;
              
              return (
                <div
                  key={alert.id}
                  className={cn(
                    'p-4 flex items-start gap-3 border-l-4 transition-all duration-200',
                    'hover:bg-muted/30 cursor-pointer group',
                    severityBorder[alert.severity]
                  )}
                >
                  <div className={cn('p-2 rounded-xl shrink-0', config.bg)}>
                    <Icon className={cn('h-4 w-4', config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
                        config.bg, config.color
                      )}>
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatAlertDate(alert.date)}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-foreground truncate">
                      {alert.equipmentName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {alert.message}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t bg-muted/20">
        <Button variant="ghost" size="sm" className="w-full gap-2" asChild>
          <Link to="/alerts">
            Ver todos os alertas
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
