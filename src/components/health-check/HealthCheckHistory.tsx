import { CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { HealthStatus } from '@/hooks/useHealthCheck';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

interface HistoryEntry {
  timestamp: number;
  status: HealthStatus;
  summary: string;
}

interface HealthCheckHistoryProps {
  history: HistoryEntry[];
}

const statusConfig: Record<HealthStatus, { icon: typeof CheckCircle2; color: string }> = {
  ok: { icon: CheckCircle2, color: 'text-green-600 dark:text-green-400' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400' },
  error: { icon: XCircle, color: 'text-red-600 dark:text-red-400' },
  pending: { icon: Clock, color: 'text-muted-foreground' },
  running: { icon: Clock, color: 'text-blue-600 dark:text-blue-400' },
};

export function HealthCheckHistory({ history }: HealthCheckHistoryProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'pt-BR' ? ptBR : enUS;

  if (history.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{t('healthCheck.history')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {history.map((entry, index) => {
              const config = statusConfig[entry.status];
              const Icon = config.icon;
              
              return (
                <div 
                  key={index}
                  className="flex items-center justify-between text-sm py-2 px-3 rounded-md bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', config.color)} />
                    <span className="text-muted-foreground">
                      {format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale })}
                    </span>
                  </div>
                  <span className="font-medium">{entry.summary}</span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
