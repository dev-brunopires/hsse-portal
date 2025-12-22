import { useState } from 'react';
import { WifiOff, Cloud, RefreshCw, ChevronUp, ChevronDown, ClipboardCheck, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

export function OfflineIndicator() {
  const { t } = useTranslation();
  const { isOnline, pendingCount, isSyncing, getPendingInspections, syncPendingInspections } = useOfflineSync();
  const [expanded, setExpanded] = useState(false);
  const pendingInspections = getPendingInspections();

  // Always show a subtle indicator on mobile when online with no pending
  const showOnlineIndicator = isOnline && pendingCount === 0;

  return (
    <>
      {/* Offline/Pending indicator */}
      {(!isOnline || pendingCount > 0) && (
        <div className={cn(
          "fixed bottom-20 lg:bottom-4 left-4 right-4 lg:right-auto z-50 rounded-xl shadow-lg transition-all lg:max-w-sm",
          isOnline 
            ? "bg-status-warning text-status-warning-foreground" 
            : "bg-status-danger text-status-danger-foreground"
        )}>
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-3 px-4 py-3 w-full">
                {isOnline ? (
                  isSyncing ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <Cloud className="h-5 w-5" />
                  )
                ) : (
                  <WifiOff className="h-5 w-5" />
                )}
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">
                    {isOnline 
                      ? isSyncing 
                        ? t('offline.syncing')
                        : t('offline.pendingInspections', { count: pendingCount })
                      : t('offline.offlineMode')
                    }
                  </p>
                  <p className="text-xs opacity-80">
                    {isOnline 
                      ? t('offline.awaitingSync')
                      : t('offline.changesSavedLocally')
                    }
                  </p>
                </div>
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="bg-white/20 text-current text-sm px-2.5 py-0.5">
                    {pendingCount}
                  </Badge>
                )}
                {pendingCount > 0 && (
                  expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />
                )}
              </button>
            </CollapsibleTrigger>
            
            {pendingCount > 0 && (
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3 border-t border-white/20 pt-3">
                  <p className="text-xs font-medium opacity-80">{t('offline.inspectionsAwaitingSync')}</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pendingInspections.map((inspection) => (
                      <div 
                        key={inspection.id} 
                        className="flex items-center gap-3 bg-white/10 rounded-lg px-3 py-2"
                      >
                        <ClipboardCheck className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {inspection.equipment_name}
                          </p>
                          <p className="text-xs opacity-70">
                            {t('offline.code')}: {inspection.equipment_code}
                          </p>
                        </div>
                        <span className="text-xs opacity-70 flex-shrink-0">
                          {format(new Date(inspection.timestamp), 'HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                  {isOnline && (
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="w-full"
                      onClick={() => syncPendingInspections()}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          {t('offline.syncing')}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {t('offline.syncNow')}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CollapsibleContent>
            )}
          </Collapsible>
        </div>
      )}

      {/* Mobile online status indicator (subtle) */}
      {showOnlineIndicator && (
        <div className="fixed bottom-20 right-4 lg:hidden z-40">
          <div className="bg-status-success/90 text-status-success-foreground rounded-full p-2 shadow-lg">
            <Wifi className="h-4 w-4" />
          </div>
        </div>
      )}
    </>
  );
}
