import { WifiOff, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all",
            isOnline 
              ? "bg-status-warning text-status-warning-foreground" 
              : "bg-status-danger text-status-danger-foreground"
          )}>
            {isOnline ? (
              isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">
              {isOnline 
                ? isSyncing 
                  ? 'Sincronizando...' 
                  : `${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}`
                : 'Offline'
              }
            </span>
            {pendingCount > 0 && !isOnline && (
              <Badge variant="secondary" className="bg-white/20 text-current">
                {pendingCount}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          {isOnline 
            ? `${pendingCount} ação(ões) aguardando sincronização`
            : 'Você está offline. As alterações serão salvas localmente.'
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
