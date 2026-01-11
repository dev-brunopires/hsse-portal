// Offline indicator component with sync status and debug panel
import { useState } from 'react';
import { WifiOff, Cloud, RefreshCw, ChevronUp, ChevronDown, ClipboardCheck, Wifi, Database, Trash2, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function OfflineIndicator() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { 
    isOnline, 
    pendingCount, 
    isSyncing, 
    getPendingInspections, 
    syncPendingInspections,
    clearPendingActions,
    preCacheData,
    isCacheAvailable,
    lastSyncTime,
  } = useOfflineSync();
  const [expanded, setExpanded] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const pendingInspections = getPendingInspections();

  const handleViewCachedData = () => {
    navigate('/offline');
  };

  const handleForceSync = async () => {
    if (pendingCount > 0) {
      await syncPendingInspections();
    } else {
      toast.info(t('offline.noPendingActions'));
    }
  };

  const handleRefreshCache = async () => {
    toast.loading(t('offline.refreshingCache'));
    await preCacheData();
    toast.dismiss();
    toast.success(t('offline.cacheRefreshed'));
  };

  const handleClearPending = () => {
    clearPendingActions();
    toast.success(t('offline.pendingCleared'));
  };

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
                {(pendingCount > 0 || !isOnline) && (
                  expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />
                )}
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-3 border-t border-white/20 pt-3">
                {/* View Cached Data Button */}
                {!isOnline && (
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="w-full"
                    onClick={handleViewCachedData}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t('offline.viewCachedData')}
                  </Button>
                )}
                
                {pendingCount > 0 && (
                  <>
                    <p className="text-xs font-medium opacity-80">{t('offline.inspectionsAwaitingSync')}</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {pendingInspections.map((inspection) => (
                        <div 
                          key={inspection.id} 
                          className="flex items-center gap-3 bg-white/10 rounded-lg px-3 py-2"
                        >
                          <ClipboardCheck className="h-4 w-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{inspection.equipment_name}</p>
                            <p className="text-xs opacity-70">{t('offline.code')}: {inspection.equipment_code}</p>
                          </div>
                          <span className="text-xs opacity-70 flex-shrink-0">
                            {format(new Date(inspection.timestamp), 'HH:mm')}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      {isOnline && (
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="flex-1"
                          onClick={handleForceSync}
                          disabled={isSyncing}
                        >
                          <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                          {isSyncing ? t('offline.syncing') : t('offline.syncNow')}
                        </Button>
                      )}
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" className="flex-shrink-0">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('offline.clearPendingTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>{t('offline.clearPendingDescription')}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearPending}>{t('common.confirm')}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Mobile online status indicator */}
      {showOnlineIndicator && (
        <div className="fixed bottom-20 right-4 lg:hidden z-40">
          <Collapsible open={showDebugPanel} onOpenChange={setShowDebugPanel}>
            <CollapsibleTrigger asChild>
              <button className="bg-status-success/90 text-status-success-foreground rounded-full p-2 shadow-lg">
                <Wifi className="h-4 w-4" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="absolute bottom-10 right-0 bg-card border rounded-lg shadow-lg p-3 min-w-[200px] space-y-2">
                <p className="text-xs font-medium text-foreground">{t('offline.syncStatus')}</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>📶 {t('offline.online')}</p>
                  <p>📦 {t('offline.pending')}: {pendingCount}</p>
                  <p>💾 Cache: {isCacheAvailable() ? '✓' : '✗'}</p>
                  {lastSyncTime && (
                    <p>🕐 {t('offline.lastSync')}: {format(new Date(lastSyncTime), 'HH:mm')}</p>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={handleRefreshCache}>
                    <Database className="h-3 w-3 mr-1" />
                    Cache
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-xs h-8"
                    onClick={handleForceSync}
                    disabled={isSyncing || pendingCount === 0}
                  >
                    <RefreshCw className={cn("h-3 w-3 mr-1", isSyncing && "animate-spin")} />
                    Sync
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </>
  );
}
