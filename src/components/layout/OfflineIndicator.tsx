import { useState } from 'react';
import { WifiOff, Cloud, RefreshCw, ChevronUp, ChevronDown, ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing, getPendingInspections, syncPendingInspections } = useOfflineSync();
  const [expanded, setExpanded] = useState(false);
  const pendingInspections = getPendingInspections();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className={cn(
      "fixed bottom-4 left-4 z-50 rounded-lg shadow-lg transition-all max-w-sm",
      isOnline 
        ? "bg-status-warning text-status-warning-foreground" 
        : "bg-status-danger text-status-danger-foreground"
    )}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-2 w-full">
            {isOnline ? (
              isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <span className="text-sm font-medium flex-1 text-left">
              {isOnline 
                ? isSyncing 
                  ? 'Sincronizando...' 
                  : `${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}`
                : 'Modo Offline'
              }
            </span>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="bg-white/20 text-current">
                {pendingCount}
              </Badge>
            )}
            {pendingCount > 0 && (
              expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </CollapsibleTrigger>
        
        {pendingCount > 0 && (
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-2 border-t border-white/20 pt-2">
              <p className="text-xs opacity-80">Inspeções pendentes:</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {pendingInspections.map((inspection) => (
                  <div 
                    key={inspection.id} 
                    className="flex items-center gap-2 text-xs bg-white/10 rounded px-2 py-1"
                  >
                    <ClipboardCheck className="h-3 w-3" />
                    <span className="truncate flex-1">
                      {inspection.equipment_code} - {inspection.equipment_name}
                    </span>
                    <span className="opacity-70">
                      {format(new Date(inspection.timestamp), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
              {isOnline && (
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="w-full text-xs"
                  onClick={() => syncPendingInspections()}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    'Sincronizar Agora'
                  )}
                </Button>
              )}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}
