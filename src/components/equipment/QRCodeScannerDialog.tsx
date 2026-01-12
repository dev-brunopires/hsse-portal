import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, Loader2, QrCode, CheckCircle2, AlertCircle, Scan, SwitchCamera } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface QRCodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (equipmentId: string) => void;
}

type ScannerState = 'initializing' | 'scanning' | 'success' | 'error' | 'permission-denied';

// Check if camera permission was already granted
const checkCameraPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  try {
    // First check if we have a cached permission state
    const cachedPermission = localStorage.getItem('camera_permission_state');
    if (cachedPermission === 'granted') {
      return 'granted';
    }

    // Use Permissions API if available
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      localStorage.setItem('camera_permission_state', result.state);
      return result.state as 'granted' | 'denied' | 'prompt';
    }

    // Fallback: check if we've successfully used camera before
    return cachedPermission === 'denied' ? 'denied' : 'prompt';
  } catch {
    // Permissions API not supported, check localStorage
    const cachedPermission = localStorage.getItem('camera_permission_state');
    return cachedPermission as 'granted' | 'denied' | 'prompt' || 'prompt';
  }
};

// Mark camera permission as granted after successful access
const markCameraPermissionGranted = () => {
  localStorage.setItem('camera_permission_state', 'granted');
};

// Mark camera permission as denied
const markCameraPermissionDenied = () => {
  localStorage.setItem('camera_permission_state', 'denied');
};

export function QRCodeScannerDialog({ open, onOpenChange, onScan }: QRCodeScannerDialogProps) {
  const { t } = useTranslation();
  const [scannerState, setScannerState] = useState<ScannerState>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [containerId, setContainerId] = useState(() => `qr-reader-${Date.now()}`);
  const [scanProgress, setScanProgress] = useState(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  const isCleaningUpRef = useRef(false);
  const progressIntervalRef = useRef<number | null>(null);

  const cleanupScanner = useCallback(async () => {
    // Clear progress interval first
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // Prevent multiple simultaneous cleanups
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    const scanner = scannerRef.current;
    if (scanner) {
      try {
        const state = scanner.getState();
        
        // State 2 = SCANNING, State 1 = NOT_STARTED
        if (state === 2) {
          await scanner.stop();
        }
        
        scanner.clear();
      } catch (err) {
        // Force stop even if there's an error
        try {
          await scanner.stop();
        } catch {
          // Ignore secondary errors
        }
      }
      scannerRef.current = null;
    }

    isCleaningUpRef.current = false;
  }, []);

  const handleScanSuccess = useCallback((decodedText: string) => {
    setScannerState('success');
    setScanProgress(100);
    
    // Brief success animation before processing
    setTimeout(() => {
      cleanupScanner();
      
      let equipmentId: string | null = null;

      // Try to parse as URL with equipment ID
      try {
        const url = new URL(decodedText);
        const scanParam = url.searchParams.get('scan');
        if (scanParam) {
          equipmentId = scanParam;
        }
      } catch {
        // Not a URL
      }

      // Try to parse as JSON
      if (!equipmentId) {
        try {
          const data = JSON.parse(decodedText);
          if (data.id) {
            equipmentId = data.id;
          }
        } catch {
          // Not JSON
        }
      }

      // Try as UUID directly
      if (!equipmentId && decodedText.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        equipmentId = decodedText;
      }

      if (equipmentId) {
        onScan(equipmentId);
        onOpenChange(false);
      } else {
        setScannerState('error');
        setErrorMessage(t('qrScanner.invalidQRCode'));
      }
    }, 600);
  }, [cleanupScanner, onScan, onOpenChange, t]);

  const attemptStartScanning = useCallback(async (attempt: number, cameraFacingMode: 'environment' | 'user') => {
    if (!isMountedRef.current || isCleaningUpRef.current) return;

    const containerElement = document.getElementById(containerId);

    if (!containerElement) {
      if (attempt < 12) {
        window.setTimeout(() => {
          attemptStartScanning(attempt + 1, cameraFacingMode);
        }, 150);
        return;
      }

      if (isMountedRef.current) {
        setScannerState('error');
        setErrorMessage(t('qrScanner.couldNotInitialize'));
        setIsSwitchingCamera(false);
      }
      return;
    }

    setErrorMessage(null);
    if (!isSwitchingCamera) {
      setScannerState('initializing');
    }

    try {
      await cleanupScanner();

      if (!isMountedRef.current) return;

      scannerRef.current = new Html5Qrcode(containerId);

      await scannerRef.current.start(
        { facingMode: cameraFacingMode },
        {
          fps: 20,
          qrbox: { width: 200, height: 200 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Ignore scan errors - this is normal behavior when no QR is detected
        }
      );

      // Camera access was successful, mark permission as granted
      markCameraPermissionGranted();
      setPermissionChecked(true);

      if (isMountedRef.current) {
        setScannerState('scanning');
        setScanProgress(0);
        setIsSwitchingCamera(false);
        
        // Animate scanning progress for visual feedback
        progressIntervalRef.current = window.setInterval(() => {
          setScanProgress(prev => {
            if (prev >= 95) return 5;
            return prev + 5;
          });
        }, 200);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setIsSwitchingCamera(false);
        const errStr = String(err);
        if (errStr.includes('Permission') || errStr.includes('NotAllowedError')) {
          markCameraPermissionDenied();
          setScannerState('permission-denied');
          setErrorMessage(t('qrScanner.permissionDeniedError'));
        } else if (errStr.includes('NotFoundError') || errStr.includes('NotFound')) {
          setScannerState('error');
          setErrorMessage(t('qrScanner.noCameraFound'));
        } else {
          setScannerState('error');
          setErrorMessage(t('qrScanner.cameraStartError'));
        }
      }
    }
  }, [cleanupScanner, containerId, handleScanSuccess, isSwitchingCamera, t]);

  const startScanning = useCallback(async (cameraFacingMode?: 'environment' | 'user') => {
    await attemptStartScanning(0, cameraFacingMode || facingMode);
  }, [attemptStartScanning, facingMode]);

  const handleSwitchCamera = useCallback(async () => {
    if (isSwitchingCamera || scannerState !== 'scanning') return;
    
    setIsSwitchingCamera(true);
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacingMode);
    
    // Cleanup current scanner and restart with new camera
    await cleanupScanner();
    setContainerId(`qr-reader-${Date.now()}`);
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      startScanning(newFacingMode);
    }, 100);
  }, [facingMode, isSwitchingCamera, scannerState, cleanupScanner, startScanning]);

  // Handle dialog open/close - check permission first
  useEffect(() => {
    if (open) {
      isMountedRef.current = true;
      setErrorMessage(null);
      setScannerState('initializing');
      setScanProgress(0);
      setFacingMode('environment');
      setIsSwitchingCamera(false);
      setContainerId(`qr-reader-${Date.now()}`);
      
      // Pre-check camera permission to avoid repeated prompts
      checkCameraPermission().then((permission) => {
        if (permission === 'denied') {
          setScannerState('permission-denied');
          setErrorMessage(t('qrScanner.permissionDeniedError'));
        }
        setPermissionChecked(true);
      });
    } else {
      cleanupScanner();
      setPermissionChecked(false);
    }
    
    return () => {
      if (!open) {
        cleanupScanner();
      }
    };
  }, [open, cleanupScanner, t]);

  // Start scanning when the containerId is rendered and permission is not denied
  useEffect(() => {
    if (!open || isSwitchingCamera || !permissionChecked) return;
    if (scannerState === 'permission-denied') return;

    const timeout = window.setTimeout(() => {
      if (isMountedRef.current) startScanning();
    }, 50);

    return () => window.clearTimeout(timeout);
  }, [open, containerId, startScanning, isSwitchingCamera, permissionChecked, scannerState]);

  // Cleanup on unmount and page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && scannerRef.current) {
        cleanupScanner();
      }
    };

    const handleBeforeUnload = () => {
      cleanupScanner();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      isMountedRef.current = false;
      cleanupScanner();
    };
  }, [cleanupScanner]);

  const handleRetry = () => {
    // Clear permission denied state from localStorage to allow re-prompting
    localStorage.removeItem('camera_permission_state');
    setErrorMessage(null);
    setScannerState('initializing');
    setPermissionChecked(true);
    startScanning();
  };

  const getStateConfig = () => {
    switch (scannerState) {
      case 'initializing':
        return {
          icon: Camera,
          title: t('qrScanner.initializingCamera'),
          subtitle: t('qrScanner.waitingScanner'),
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          showLoader: true,
        };
      case 'scanning':
        return {
          icon: Scan,
          title: isSwitchingCamera ? t('qrScanner.switchingCamera') : t('qrScanner.scanning'),
          subtitle: isSwitchingCamera 
            ? t('qrScanner.waitCameraSwitch') 
            : t('qrScanner.positionQRCode'),
          color: 'text-primary',
          bgColor: 'bg-primary/5',
          showLoader: isSwitchingCamera,
        };
      case 'success':
        return {
          icon: CheckCircle2,
          title: t('qrScanner.qrCodeDetected'),
          subtitle: t('qrScanner.processingEquipment'),
          color: 'text-green-600',
          bgColor: 'bg-green-50 dark:bg-green-950/30',
          showLoader: false,
        };
      case 'error':
        return {
          icon: AlertCircle,
          title: t('qrScanner.scannerError'),
          subtitle: errorMessage || t('qrScanner.unexpectedError'),
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          showLoader: false,
        };
      case 'permission-denied':
        return {
          icon: CameraOff,
          title: t('qrScanner.cameraBlocked'),
          subtitle: t('qrScanner.permissionDenied'),
          color: 'text-amber-600',
          bgColor: 'bg-amber-50 dark:bg-amber-950/30',
          showLoader: false,
        };
    }
  };

  const stateConfig = getStateConfig();
  const StateIcon = stateConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg transition-colors duration-300",
              scannerState === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-primary/10'
            )}>
              <QrCode className={cn(
                "h-5 w-5 transition-colors duration-300",
                scannerState === 'success' ? 'text-green-600' : 'text-primary'
              )} />
            </div>
            {t('qrScanner.dialogTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('qrScanner.dialogDescription')}
            <span className="block text-xs mt-1 text-muted-foreground/80">
              💡 {t('qrScanner.screenTip')}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scanner container */}
          <div
            key={containerId}
            className={cn(
              "relative w-full aspect-square rounded-xl overflow-hidden transition-all duration-300 border-2",
              scannerState === 'scanning' && "border-primary/50 shadow-lg shadow-primary/10",
              scannerState === 'success' && "border-green-500/50 shadow-lg shadow-green-500/20",
              scannerState === 'error' && "border-destructive/50",
              scannerState === 'permission-denied' && "border-amber-500/50",
              (scannerState === 'initializing') && "border-muted bg-muted"
            )}
          >
            {/* Camera feed container - hide library's built-in qrbox */}
            <div 
              id={containerId} 
              className="absolute inset-0 [&_#qr-shaded-region]:hidden [&>div>div]:border-none"
            />

            {/* Camera switch button - only show when scanning */}
            {scannerState === 'scanning' && !isSwitchingCamera && (
              <div className="absolute top-3 right-3 z-20">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg hover:bg-background/90 border border-border/50"
                      onClick={handleSwitchCamera}
                    >
                      <SwitchCamera className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>{t('qrScanner.switchToCamera')} {facingMode === 'environment' ? t('qrScanner.front') : t('qrScanner.back')}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Camera indicator badge */}
            {scannerState === 'scanning' && (
              <div className="absolute top-3 left-3 z-20">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs font-medium border border-border/50">
                  <Camera className="h-3 w-3" />
                  {facingMode === 'environment' ? t('qrScanner.backCamera') : t('qrScanner.frontCamera')}
                </div>
              </div>
            )}

            {/* Scanning frame overlay - only show when scanning */}
            {scannerState === 'scanning' && !isSwitchingCamera && (
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* Corner brackets */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-56 h-56">
                    {/* Top-left corner */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg animate-pulse" />
                    {/* Top-right corner */}
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg animate-pulse" />
                    {/* Bottom-left corner */}
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg animate-pulse" />
                    {/* Bottom-right corner */}
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg animate-pulse" />
                    
                    {/* Scanning line animation */}
                    <div 
                      className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent transition-all duration-200"
                      style={{ 
                        top: `${scanProgress}%`,
                        opacity: 0.8,
                        boxShadow: '0 0 8px hsl(var(--primary))'
                      }}
                    />
                  </div>
                </div>
                
                {/* Semi-transparent overlay outside scanning area */}
                <div className="absolute inset-0 bg-black/40">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-transparent" 
                       style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }} />
                </div>
              </div>
            )}

            {/* Switching camera overlay */}
            {isSwitchingCamera && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-background/80 backdrop-blur-sm">
                <SwitchCamera className="h-12 w-12 text-primary animate-pulse" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  {t('qrScanner.switchingTo')} {facingMode === 'environment' ? t('qrScanner.back') : t('qrScanner.front')}...
                </p>
                <Loader2 className="h-5 w-5 animate-spin mt-2 text-primary" />
              </div>
            )}

            {/* Success overlay */}
            {scannerState === 'success' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-green-500/20 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white dark:bg-gray-900 rounded-full p-4 shadow-xl animate-in zoom-in duration-300">
                  <CheckCircle2 className="h-16 w-16 text-green-500 animate-in spin-in-180 duration-500" />
                </div>
                <p className="mt-4 text-lg font-semibold text-white drop-shadow-lg">
                  {t('qrScanner.qrCodeDetected')}
                </p>
              </div>
            )}

            {/* Initializing overlay */}
            {scannerState === 'initializing' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-muted">
                <div className="relative">
                  <Camera className="h-16 w-16 text-muted-foreground animate-pulse" />
                  <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4 font-medium">
                  {t('qrScanner.initializingCamera')}
                </p>
                <div className="mt-2 w-32 h-1 bg-muted-foreground/20 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {/* Error/Permission denied overlay */}
            {(scannerState === 'error' || scannerState === 'permission-denied') && (
              <div className={cn(
                "absolute inset-0 flex flex-col items-center justify-center z-10 p-6",
                stateConfig.bgColor
              )}>
                <div className={cn(
                  "rounded-full p-4 mb-4",
                  scannerState === 'error' ? 'bg-destructive/20' : 'bg-amber-500/20'
                )}>
                  <StateIcon className={cn("h-12 w-12", stateConfig.color)} />
                </div>
                <p className={cn("text-lg font-semibold mb-2", stateConfig.color)}>
                  {stateConfig.title}
                </p>
                <p className="text-sm text-center text-muted-foreground max-w-xs">
                  {stateConfig.subtitle}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="mt-4"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {t('qrScanner.retry')}
                </Button>
              </div>
            )}
          </div>

          {/* Status indicator bar */}
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
            stateConfig.bgColor
          )}>
            <div className={cn(
              "p-2 rounded-full transition-colors duration-300",
              scannerState === 'scanning' && "bg-primary/20 animate-pulse",
              scannerState === 'success' && "bg-green-500/20",
              scannerState === 'error' && "bg-destructive/20",
              scannerState === 'permission-denied' && "bg-amber-500/20",
              scannerState === 'initializing' && "bg-muted-foreground/20"
            )}>
              {stateConfig.showLoader ? (
                <Loader2 className={cn("h-5 w-5 animate-spin", stateConfig.color)} />
              ) : (
                <StateIcon className={cn("h-5 w-5", stateConfig.color)} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium truncate", stateConfig.color)}>
                {stateConfig.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {stateConfig.subtitle}
              </p>
            </div>
            {scannerState === 'scanning' && !isSwitchingCamera && (
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}