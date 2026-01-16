import { useState, useEffect } from 'react';
import { RefreshCw, Check, AlertCircle, Cloud, CloudOff, Image, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { getPhotosCount } from '@/utils/offlineStorage';

export function SyncProgressIndicator() {
  const { t } = useTranslation();
  const { isOnline, isSyncing, pendingCount, lastSyncTime, cacheStats } = useOfflineSync();
  const [showIndicator, setShowIndicator] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [initialPendingCount, setInitialPendingCount] = useState(0);
  const [pendingPhotosCount, setPendingPhotosCount] = useState(0);
  const [currentEquipment, setCurrentEquipment] = useState<string | null>(null);

  // Load pending photos count
  useEffect(() => {
    const loadPhotosCount = async () => {
      try {
        const count = await getPhotosCount();
        setPendingPhotosCount(count);
      } catch (error) {
        console.error('Error loading photos count:', error);
      }
    };
    loadPhotosCount();
  }, [pendingCount, cacheStats]);

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
      
      // Auto-close after 1.5 seconds when complete (100%)
      const timer = setTimeout(() => {
        handleClose();
      }, 1500);
      
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

  const handleClose = () => {
    setShowIndicator(false);
    setSyncStatus('idle');
    setSyncProgress(0);
    setInitialPendingCount(0);
    setCurrentEquipment(null);
  };

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
      "bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg",
      "animate-in slide-in-from-right-5 fade-in duration-300",
      "min-w-[220px] max-w-[300px]"
    )}>
      <div className="p-3">
        {/* Header with close button */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getStatusIcon()}
            <span className="text-sm font-medium text-foreground truncate">
              {getStatusText()}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 hover:bg-muted"
            onClick={handleClose}
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">{t('common.close')}</span>
          </Button>
        </div>
        
        {/* Progress bar */}
        {(syncStatus === 'syncing' || syncProgress > 0) && (
          <div className="mb-2">
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
        
        {/* Current equipment being synced */}
        {syncStatus === 'syncing' && currentEquipment && (
          <p className="text-xs text-muted-foreground truncate mb-1">
            {currentEquipment}
          </p>
        )}
        
        {/* Pending photos indicator */}
        {syncStatus === 'idle' && pendingPhotosCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Image className="h-3 w-3" />
            <span>{t('offline.pendingPhotosCount', { count: pendingPhotosCount })}</span>
          </div>
        )}
        
        {/* Last sync time */}
        {lastSyncTime && syncStatus === 'idle' && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('offline.lastSync')}: {new Date(lastSyncTime).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}
