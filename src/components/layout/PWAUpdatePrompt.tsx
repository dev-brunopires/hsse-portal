import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { hapticSuccess } from '@/utils/hapticFeedback';

export function PWAUpdatePrompt() {
  const { t } = useTranslation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      // New service worker has taken control, reload
      window.location.reload();
    };

    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        
        // Check for waiting worker
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowPrompt(true);
        }

        // Listen for new worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setShowPrompt(true);
              }
            });
          }
        });

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000); // Every 5 minutes
      } catch (error) {
        console.error('SW check error:', error);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    checkForUpdates();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const handleUpdate = useCallback(() => {
    if (!waitingWorker) return;

    setIsUpdating(true);
    
    // Tell the waiting service worker to skip waiting
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    hapticSuccess();
  }, [waitingWorker]);

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className={cn(
      "fixed top-4 right-4 left-4 lg:left-auto z-[100] lg:max-w-sm",
      "bg-card border border-primary/20 rounded-xl shadow-lg",
      "animate-in slide-in-from-top-5 fade-in duration-300"
    )}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
            <Download className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">{t('pwa.updateAvailable')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('pwa.updateDescription')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -mt-1 -mr-1 flex-shrink-0 touch-manipulation"
            onClick={handleDismiss}
            disabled={isUpdating}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 min-h-[44px] touch-manipulation"
            onClick={handleDismiss}
            disabled={isUpdating}
          >
            {t('pwa.later')}
          </Button>
          <Button
            size="sm"
            className="flex-1 min-h-[44px] touch-manipulation"
            onClick={handleUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t('pwa.updateNow')}
          </Button>
        </div>
      </div>
    </div>
  );
}
