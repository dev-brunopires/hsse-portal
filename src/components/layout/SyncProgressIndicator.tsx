import { useState, useEffect } from 'react';
import { RefreshCw, Check, AlertCircle, Cloud, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Progress } from '@/components/ui/progress';

export function SyncProgressIndicator() {
  const { t } = useTranslation();
  const { isOnline, isSyncing, pendingCount, lastSyncTime } = useOfflineSync();
  const [showIndicator, setShowIndicator] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [initialPendingCount, setInitialPendingCount] = useState(0);

  // Show indicator when syncing or when there's a status change
  useEffect(() => {
    if (isSyncing) {
      setShowIndicator(true);
      setSyncStatus('syncing');
      if (initialPendingCount === 0) {
        setInitialPendingCount(pendingCount);
      }
    }
  }, [isSyncing, pendingCount, initialPendingCount]);

  // Update progress based on pending count
  useEffect(() => {
    if (isSyncing && initialPendingCount > 0) {
      const syncedCount = initialPendingCount - pendingCount;
      const progress = Math.round((syncedCount / initialPendingCount) * 100);
      setSyncProgress(progress);
    }
  }, [isSyncing, pendingCount, initialPendingCount]);

  // Handle sync completion
  useEffect(() => {
    if (!isSyncing && syncStatus === 'syncing') {
      if (pendingCount === 0) {
        setSyncStatus('success');
        setSyncProgress(100);
      } else if (pendingCount > 0 && pendingCount < initialPendingCount) {
        // Partial sync
        setSyncStatus('success');
      } else {
        setSyncStatus('error');
      }
      
      // Reset after showing result
      const timer = setTimeout(() => {
        setShowIndicator(false);
        setSyncStatus('idle');
        setSyncProgress(0);
        setInitialPendingCount(0);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isSyncing, pendingCount, syncStatus, initialPendingCount]);

  // Show indicator when coming online with pending items
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      setShowIndicator(true);
      setInitialPendingCount(pendingCount);
    }
  }, [isOnline, pendingCount, isSyncing]);

  if (!showIndicator) {
    return null;
  }

  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return isOnline 
          ? <Cloud className="h-4 w-4 text-primary" /> 
          : <CloudOff className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (syncStatus) {
      case 'syncing':
        return t('offline.syncing');
      case 'success':
        return t('offline.syncCompleted');
      case 'error':
        return t('offline.syncFailed');
      default:
        return t('offline.pendingSync', { count: pendingCount });
    }
  };

  const getProgressColor = () => {
    switch (syncStatus) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-destructive';
      default:
        return '';
    }
  };

  return (
    <div className={cn(
      "fixed top-16 right-4 z-50",
      "bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-md",
      "animate-in slide-in-from-right-5 fade-in duration-300",
      "min-w-[200px] max-w-[280px]"
    )}>
      <div className="p-3">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium text-foreground flex-1">
            {getStatusText()}
          </span>
        </div>
        
        {(syncStatus === 'syncing' || syncProgress > 0) && (
          <div className="mt-2">
            <Progress 
              value={syncProgress} 
              className={cn("h-1.5", getProgressColor())}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {syncProgress}%
              </span>
              {initialPendingCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {initialPendingCount - pendingCount}/{initialPendingCount}
                </span>
              )}
            </div>
          </div>
        )}
        
        {lastSyncTime && syncStatus === 'idle' && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('offline.lastSync')}: {new Date(lastSyncTime).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}
