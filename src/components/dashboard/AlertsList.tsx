import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { Alert } from '@/types/equipment';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface AlertsListProps {
  alerts: Alert[];
}

export function AlertsList({ alerts }: AlertsListProps) {
  const { t } = useTranslation();
  
  const alertTypeConfig = {
    expired: { icon: XCircle, color: 'text-status-danger', bg: 'bg-status-danger/10' },
    expiring: { icon: Clock, color: 'text-status-warning', bg: 'bg-status-warning/10' },
    inspection_due: { icon: AlertCircle, color: 'text-accent', bg: 'bg-accent/10' },
    non_compliant: { icon: AlertTriangle, color: 'text-status-danger', bg: 'bg-status-danger/10' },
    maintenance_overdue: { icon: AlertTriangle, color: 'text-status-danger', bg: 'bg-status-danger/10' },
    maintenance_pending: { icon: Clock, color: 'text-status-warning', bg: 'bg-status-warning/10' },
  };

  const severityStyles = {
    high: 'border-l-status-danger',
    medium: 'border-l-status-warning',
    low: 'border-l-accent',
  };

  const getAlertMessage = (alert: Alert) => {
    if (alert.messageKey) {
      if (alert.reasonKeys && alert.reasonKeys.length > 0) {
        return `${t(alert.messageKey)}: ${alert.reasonKeys.map(key => t(key)).join(', ')}`;
      }
      if (alert.messageParams?.title) {
        return `${t(alert.messageKey)}: ${alert.messageParams.title}`;
      }
      return t(alert.messageKey);
    }
    return alert.message;
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">{t('dashboard.recentAlerts')}</h3>
        <p className="text-sm text-muted-foreground">{t('dashboard.itemsRequireAttention')}</p>
      </div>
      <div className="divide-y divide-border">
        {alerts.map((alert) => {
          const config = alertTypeConfig[alert.type as keyof typeof alertTypeConfig] || alertTypeConfig.expired;
          const Icon = config.icon;
          
          return (
            <div
              key={alert.id}
              className={cn(
                'p-4 flex items-start gap-4 border-l-4 transition-colors hover:bg-muted/50',
                severityStyles[alert.severity]
              )}
            >
              <div className={cn('p-2 rounded-lg', config.bg)}>
                <Icon className={cn('h-5 w-5', config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{getAlertMessage(alert)}</p>
                <p className="text-sm text-muted-foreground truncate">{alert.equipmentName}</p>
                <p className="text-xs text-muted-foreground mt-1">{alert.date}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-3 bg-muted/30 text-center">
        <Link to="/alerts" className="text-sm text-primary font-medium hover:underline">
          {t('dashboard.viewAllAlerts')}
        </Link>
      </div>
    </div>
  );
}