import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudDownload, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDateTime } from '@/utils/dateFormat';

export function SyncButton() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    cacheStats,
    preCacheData,
    syncPendingInspections,
    syncPendingMaintenance,
  } = useOfflineSync();

  const handleManualSync = useCallback(async () => {
    if (!isOnline) {
      toast.error(t('syncButton.offlineCannotSync'));
      return;
    }
    const toastId = 'manual-sync';
    toast.loading(t('syncButton.syncing'), { id: toastId });
    try {
      await syncPendingInspections({ silent: true });
      await syncPendingMaintenance({ silent: true });
      await preCacheData({ silent: true, force: true });
      toast.success(t('syncButton.syncCompletedShort', 'Sincronização concluída'), { id: toastId });
    } catch {
      toast.error(t('syncButton.error'), { id: toastId });
    }
  }, [isOnline, preCacheData, syncPendingInspections, syncPendingMaintenance, t]);

  const Icon = isSyncing ? Loader2 : !isOnline ? CloudOff : CloudDownload;
  const totalCached = cacheStats?.equipmentCount ?? 0;
  const lastSyncLabel = lastSyncTime
    ? formatDateTime(new Date(lastSyncTime).toISOString())
    : t('syncButton.never');

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      title={t('syncButton.title')}
      aria-label={t('syncButton.title')}
    >
      <Icon
        className={cn(
          'h-5 w-5',
          isSyncing && 'animate-spin text-primary',
          !isOnline && 'text-status-warning'
        )}
      />
      {pendingCount > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-status-warning text-status-warning-foreground text-xs">
          {pendingCount > 9 ? '9+' : pendingCount}
        </Badge>
      )}
    </Button>
  );

  const statusRows = (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between py-2 border-b border-border">
        <span className="text-muted-foreground">{t('syncButton.status')}</span>
        <span className={cn('font-medium', isOnline ? 'text-status-success' : 'text-status-warning')}>
          {isOnline ? t('syncButton.online') : t('syncButton.offline')}
        </span>
      </div>
      <div className="flex items-center justify-between py-2 border-b border-border">
        <span className="text-muted-foreground">{t('syncButton.cachedItems')}</span>
        <span className="font-medium">{totalCached}</span>
      </div>
      <div className="flex items-center justify-between py-2 border-b border-border">
        <span className="text-muted-foreground">{t('syncButton.pending')}</span>
        <span className={cn('font-medium', pendingCount > 0 ? 'text-status-warning' : 'text-foreground')}>
          {pendingCount}
        </span>
      </div>
      <div className="flex items-center justify-between py-2">
        <span className="text-muted-foreground">{t('syncButton.lastSync')}</span>
        <span className="font-medium text-right text-xs">{lastSyncLabel}</span>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <CloudDownload className="h-5 w-5 text-primary" />
              {t('syncButton.title')}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4">
            {statusRows}
            <DrawerClose asChild>
              <Button
                onClick={handleManualSync}
                disabled={!isOnline || isSyncing}
                className="w-full gap-2"
              >
                <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
                {isSyncing ? t('syncButton.syncing') : t('syncButton.syncNow')}
              </Button>
            </DrawerClose>
            <p className="text-xs text-muted-foreground leading-tight text-center">
              {t('syncButton.hint')}
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 bg-popover border border-border shadow-lg z-50"
      >
        <DropdownMenuLabel className="flex items-center gap-2">
          <CloudDownload className="h-4 w-4 text-primary" />
          {t('syncButton.title')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="px-2 py-2 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('syncButton.status')}</span>
            <span
              className={cn(
                'font-medium',
                isOnline ? 'text-status-success' : 'text-status-warning'
              )}
            >
              {isOnline ? t('syncButton.online') : t('syncButton.offline')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('syncButton.cachedItems')}</span>
            <span className="font-medium">{totalCached}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('syncButton.pending')}</span>
            <span
              className={cn(
                'font-medium',
                pendingCount > 0 ? 'text-status-warning' : 'text-foreground'
              )}
            >
              {pendingCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('syncButton.lastSync')}</span>
            <span className="font-medium text-right text-[11px]">{lastSyncLabel}</span>
          </div>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleManualSync}
          disabled={!isOnline || isSyncing}
          className="gap-2 cursor-pointer"
        >
          <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
          {isSyncing ? t('syncButton.syncing') : t('syncButton.syncNow')}
        </DropdownMenuItem>
        <p className="px-2 py-1.5 text-[11px] text-muted-foreground leading-tight">
          {t('syncButton.hint')}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
