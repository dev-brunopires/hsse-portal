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
import { Input } from '@/components/ui/input';
import { Camera, CameraOff, Loader2, QrCode, CheckCircle2, AlertCircle, Scan, SwitchCamera, Keyboard, Search, Flashlight, FlashlightOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';


interface QRCodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (equipmentId: string) => void;
}

type ScannerState = 'initializing' | 'scanning' | 'success' | 'error' | 'permission-denied';

// LocalStorage keys
const CAMERA_PERMISSION_KEY = 'camera_permission_state';
const CAMERA_FACING_MODE_KEY = 'camera_facing_mode';

// Check if camera permission was already granted
const checkCameraPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  try {
    // First check if we have a cached permission state
    const cachedPermission = localStorage.getItem(CAMERA_PERMISSION_KEY);
    if (cachedPermission === 'granted') {
      return 'granted';
    }

    // Use Permissions API if available
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      localStorage.setItem(CAMERA_PERMISSION_KEY, result.state);
      return result.state as 'granted' | 'denied' | 'prompt';
    }

    // Fallback: check if we've successfully used camera before
    return cachedPermission === 'denied' ? 'denied' : 'prompt';
  } catch {
    // Permissions API not supported, check localStorage
    const cachedPermission = localStorage.getItem(CAMERA_PERMISSION_KEY);
    return cachedPermission as 'granted' | 'denied' | 'prompt' || 'prompt';
  }
};

// Mark camera permission as granted after successful access
const markCameraPermissionGranted = () => {
  localStorage.setItem(CAMERA_PERMISSION_KEY, 'granted');
};

// Mark camera permission as denied
const markCameraPermissionDenied = () => {
  localStorage.setItem(CAMERA_PERMISSION_KEY, 'denied');
};

// Get saved camera facing mode
const getSavedFacingMode = (): 'environment' | 'user' => {
  const saved = localStorage.getItem(CAMERA_FACING_MODE_KEY);
  return saved === 'user' ? 'user' : 'environment';
};

// Save camera facing mode preference
const saveFacingMode = (mode: 'environment' | 'user') => {
  localStorage.setItem(CAMERA_FACING_MODE_KEY, mode);
};

export function QRCodeScannerDialog({ open, onOpenChange, onScan }: QRCodeScannerDialogProps) {
  const { t } = useTranslation();
  const [scannerState, setScannerState] = useState<ScannerState>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [containerId, setContainerId] = useState(() => `qr-reader-${Date.now()}`);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  const isCleaningUpRef = useRef(false);
  const isStartingRef = useRef(false);
  const lastScannedRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  const cleanupScanner = useCallback(async () => {
    // Prevent multiple simultaneous cleanups
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;
    isStartingRef.current = false;

    const scanner = scannerRef.current;
    scannerRef.current = null; // Clear ref immediately to prevent reuse
    
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
        try {
          scanner.clear();
        } catch {
          // Ignore clear errors
        }
      }
    }

    isCleaningUpRef.current = false;
  }, []);

  const handleScanSuccess = useCallback((decodedText: string) => {
    const now = Date.now();
    
    // Debounce: ignore duplicate scans within 1.5 seconds
    if (
      lastScannedRef.current === decodedText && 
      now - lastScanTimeRef.current < 1500
    ) {
      return;
    }
    
    // Prevent processing if already in success/error state
    if (scannerState === 'success' || scannerState === 'error') {
      return;
    }
    
    lastScannedRef.current = decodedText;
    lastScanTimeRef.current = now;
    
    setScannerState('success');
    
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
  }, [cleanupScanner, onScan, onOpenChange, t, scannerState]);

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
          fps: 10, // Reduced from 20 to 10 for better mobile performance
          qrbox: { width: 200, height: 200 },
          aspectRatio: 1.0,
          disableFlip: false,
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

      // Check torch/flash support
      try {
        const videoElement = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
        if (videoElement && videoElement.srcObject) {
          const track = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
          const capabilities = track.getCapabilities?.() as any;
          if (capabilities?.torch) {
            setTorchSupported(true);
          }
        }
      } catch {
        // Torch not supported
      }

      if (isMountedRef.current) {
        setScannerState('scanning');
        setIsSwitchingCamera(false);
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
    
    // Save preference to localStorage
    saveFacingMode(newFacingMode);
    
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
      // Load saved camera preference from localStorage
      setFacingMode(getSavedFacingMode());
      setIsSwitchingCamera(false);
      setContainerId(`qr-reader-${Date.now()}`);
      setShowManualInput(false);
      setManualCode('');
      setTorchOn(false);
      setTorchSupported(false);
      // Reset debounce refs when dialog opens
      lastScannedRef.current = null;
      lastScanTimeRef.current = 0;
      
      // Pre-check camera permission to avoid repeated prompts
      checkCameraPermission().then((permission) => {
        if (permission === 'denied') {
          setScannerState('permission-denied');
          setErrorMessage(t('qrScanner.permissionDeniedError'));
        }
        setPermissionChecked(true);
      });
    } else {
      // Dialog is closing - cleanup immediately
      isMountedRef.current = false;
      setPermissionChecked(false);
      
      // Force immediate cleanup
      const scanner = scannerRef.current;
      if (scanner) {
        scannerRef.current = null;
        isCleaningUpRef.current = true;
        isStartingRef.current = false;
        
        // Stop scanner synchronously if possible
        try {
          const state = scanner.getState();
          if (state === 2) {
            scanner.stop().then(() => {
              try { scanner.clear(); } catch {}
            }).catch(() => {
              try { scanner.clear(); } catch {}
            }).finally(() => {
              isCleaningUpRef.current = false;
            });
          } else {
            try { scanner.clear(); } catch {}
            isCleaningUpRef.current = false;
          }
        } catch {
          try { scanner.clear(); } catch {}
          isCleaningUpRef.current = false;
        }
      }
    }
    
    // Cleanup on effect re-run or unmount
    return () => {
      cleanupScanner();
    };
  }, [open, cleanupScanner, t]);

  // Start scanning only once per open (prevents flicker/restart loops on mobile)
  useEffect(() => {
    if (!open || isSwitchingCamera || !permissionChecked) return;
    if (scannerState !== 'initializing') return;
    if (isCleaningUpRef.current || isStartingRef.current || scannerRef.current) return;

    const timeout = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      if (isCleaningUpRef.current || isStartingRef.current || scannerRef.current) return;

      isStartingRef.current = true;
      Promise.resolve(startScanning()).finally(() => {
        isStartingRef.current = false;
      });
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

  const handleRetry = async () => {
    // Clear permission state from localStorage to allow re-prompting
    localStorage.removeItem(CAMERA_PERMISSION_KEY);

    setErrorMessage(null);
    setIsSwitchingCamera(false);
    // Keep saved camera preference on retry
    setFacingMode(getSavedFacingMode());
    setScannerState('initializing');
    setPermissionChecked(true);
    setShowManualInput(false);
    setManualCode('');
    setTorchOn(false);
    setTorchSupported(false);

    await cleanupScanner();
    setContainerId(`qr-reader-${Date.now()}`);
  };

  // Handle manual code submission
  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;

    // UUID pattern
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Short code pattern (6 digits)
    const shortCodePattern = /^\d{6}$/;

    if (uuidPattern.test(code)) {
      // Direct UUID
      setScannerState('success');
      setTimeout(() => {
        onScan(code);
        onOpenChange(false);
      }, 300);
    } else if (shortCodePattern.test(code)) {
      // Short code - pass it to onScan, the parent will handle lookup
      setScannerState('success');
      setTimeout(() => {
        onScan(code);
        onOpenChange(false);
      }, 300);
    } else {
      setErrorMessage(t('qrScanner.invalidManualCode'));
    }
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
              "relative w-full rounded-xl overflow-hidden transition-all duration-300 border-2",
              "aspect-[4/3] sm:aspect-square",
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

            {/* Camera controls - only show when scanning */}
            {scannerState === 'scanning' && !isSwitchingCamera && (
              <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
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
                {torchSupported && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className={cn(
                          "h-10 w-10 rounded-full backdrop-blur-sm shadow-lg border border-border/50",
                          torchOn ? "bg-yellow-400/90 hover:bg-yellow-400 text-black" : "bg-background/80 hover:bg-background/90"
                        )}
                        onClick={async () => {
                          try {
                            const videoElement = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
                            if (videoElement && videoElement.srcObject) {
                              const track = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
                              await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
                              setTorchOn(!torchOn);
                            }
                          } catch {}
                        }}
                      >
                        {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>{torchOn ? t('qrScanner.flashOff') : t('qrScanner.flashOn')}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg hover:bg-background/90 border border-border/50"
                      onClick={() => setShowManualInput(true)}
                    >
                      <Keyboard className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>{t('qrScanner.enterManually')}</p>
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
                {/* Corner brackets - static, no animation */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-56 h-56">
                    {/* Top-left corner */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                    {/* Top-right corner */}
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                    {/* Bottom-left corner */}
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                    {/* Bottom-right corner */}
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                    
                    {/* Scanning line - CSS animation only, no JS state updates */}
                    <div 
                      className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line"
                      style={{ 
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

            {/* Error/Permission denied overlay - with manual input option */}
            {(scannerState === 'error' || scannerState === 'permission-denied') && !showManualInput && (
              <div className={cn(
                "absolute inset-0 flex flex-col items-center justify-center z-10 p-4 overflow-y-auto",
                stateConfig.bgColor
              )}>
                <div className={cn(
                  "rounded-full p-3 mb-3 shrink-0",
                  scannerState === 'error' ? 'bg-destructive/20' : 'bg-amber-500/20'
                )}>
                  <StateIcon className={cn("h-10 w-10", stateConfig.color)} />
                </div>
                <p className={cn("text-base font-semibold mb-1 text-center", stateConfig.color)}>
                  {stateConfig.title}
                </p>
                <p className="text-xs text-center text-muted-foreground max-w-[90%] mb-4 leading-relaxed">
                  {stateConfig.subtitle}
                </p>
                <div className="flex flex-col gap-2 w-full max-w-[200px]">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleRetry}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {t('qrScanner.retry')}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowManualInput(true)}
                  >
                    <Keyboard className="h-4 w-4 mr-2" />
                    {t('qrScanner.enterManually')}
                  </Button>
                </div>
              </div>
            )}

            {/* Manual input overlay */}
            {showManualInput && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-6 bg-background">
                <div className="rounded-full p-4 mb-4 bg-primary/10">
                  <Keyboard className="h-12 w-12 text-primary" />
                </div>
                <p className="text-lg font-semibold mb-2 text-foreground">
                  {t('qrScanner.manualInputTitle')}
                </p>
                <p className="text-sm text-center text-muted-foreground max-w-xs mb-4">
                  {t('qrScanner.manualInputDescription')}
                </p>
                <div className="w-full max-w-xs space-y-3">
                  <Input
                    placeholder={t('qrScanner.manualInputPlaceholder')}
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value);
                      setErrorMessage(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleManualSubmit();
                      }
                    }}
                    className="text-center font-mono text-lg tracking-wider"
                    autoFocus
                  />
                  {errorMessage && (
                    <p className="text-xs text-destructive text-center">{errorMessage}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setShowManualInput(false);
                        setManualCode('');
                        setErrorMessage(null);
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleManualSubmit}
                      disabled={!manualCode.trim()}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      {t('qrScanner.searchEquipment')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status indicator bar - simplified, fewer animations */}
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg transition-colors duration-300",
            stateConfig.bgColor
          )}>
            <div className={cn(
              "p-2 rounded-full",
              scannerState === 'scanning' && "bg-primary/20",
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
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}