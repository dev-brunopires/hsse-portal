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
import { Camera, CameraOff, Loader2, QrCode, CheckCircle2, AlertCircle, Scan, SwitchCamera, Keyboard, Search, Flashlight, FlashlightOff, ZoomIn, Contrast, Delete, Lightbulb } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
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
  const [zoom, setZoom] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number; max: number; step: number } | null>(null);
  const [highContrast, setHighContrast] = useState(false);

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
    const decodedValue = decodedText.trim();
    const now = Date.now();
    
    // Debounce: ignore duplicate scans within 1.5 seconds
    if (
      lastScannedRef.current === decodedValue && 
      now - lastScanTimeRef.current < 1500
    ) {
      return;
    }
    
    // Prevent processing if already in success/error state
    if (scannerState === 'success' || scannerState === 'error') {
      return;
    }
    
    lastScannedRef.current = decodedValue;
    lastScanTimeRef.current = now;
    
    setScannerState('success');
    
    // Brief success animation before processing
    setTimeout(() => {
      cleanupScanner();
      
      let equipmentId: string | null = null;

      // Try to parse as URL with equipment ID
      try {
          const url = new URL(decodedValue);
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
          const data = JSON.parse(decodedValue);
          if (data.id) {
            equipmentId = data.id;
          }
        } catch {
          // Not JSON
        }
      }

      // Try as UUID directly
      if (!equipmentId && decodedValue.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        equipmentId = decodedValue;
      }

      // Try as compact 6-digit equipment short code
      if (!equipmentId && decodedValue.match(/^\d{6}$/)) {
        equipmentId = decodedValue;
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
          fps: 15,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
          disableFlip: false,
          videoConstraints: {
            facingMode: cameraFacingMode,
            // @ts-expect-error advanced constraints not in types
            advanced: [{ focusMode: 'continuous' }],
          },
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

      // Detect torch and zoom capabilities
      try {
        const videoElement = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
        if (videoElement && videoElement.srcObject) {
          const track = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
          const capabilities = track.getCapabilities?.() as any;
          if (capabilities?.torch) {
            setTorchSupported(true);
          }
          if (capabilities?.zoom) {
            setZoomCapabilities({
              min: capabilities.zoom.min ?? 1,
              max: capabilities.zoom.max ?? 1,
              step: capabilities.zoom.step ?? 0.1,
            });
            const settings = track.getSettings?.() as any;
            if (settings?.zoom) setZoom(settings.zoom);
          }
        }
      } catch {
        // Capabilities not supported
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
    saveFacingMode(newFacingMode);

    try {
      // Cleanup current scanner — keep the SAME containerId so the DOM
      // node still exists when we restart. Recreating the id leads to a
      // stale-closure race where attemptStartScanning looks up the old id.
      await cleanupScanner();
      // Small delay to let html5-qrcode release the MediaStream fully
      await new Promise((r) => setTimeout(r, 150));
      await attemptStartScanning(0, newFacingMode);
    } catch {
      setIsSwitchingCamera(false);
      setScannerState('error');
      setErrorMessage(t('qrScanner.cameraStartError'));
    }
  }, [facingMode, isSwitchingCamera, scannerState, cleanupScanner, attemptStartScanning, t]);

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
      setZoom(1);
      setZoomCapabilities(null);
      setHighContrast(false);
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

  // Apply zoom to camera track when zoom changes
  useEffect(() => {
    if (!zoomCapabilities || scannerState !== 'scanning') return;
    try {
      const videoElement = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
      if (videoElement && videoElement.srcObject) {
        const track = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
        track.applyConstraints({ advanced: [{ zoom } as any] }).catch(() => {});
      }
    } catch {
      // ignore
    }
  }, [zoom, zoomCapabilities, scannerState, containerId]);

  // Ambient Light Sensor: auto-enable torch in low-light (industrial environments)
  // Only triggers once per scan session to avoid annoyance
  useEffect(() => {
    if (scannerState !== 'scanning' || !torchSupported || torchOn) return;
    if (typeof window === 'undefined' || !('AmbientLightSensor' in window)) return;

    let sensor: any = null;
    let triggered = false;

    try {
      // @ts-expect-error - AmbientLightSensor experimental API
      sensor = new window.AmbientLightSensor({ frequency: 1 });

      sensor.addEventListener('reading', async () => {
        if (triggered || torchOn) return;
        // Threshold: < 15 lux is considered dark (typical industrial dim area)
        if (sensor.illuminance != null && sensor.illuminance < 15) {
          triggered = true;
          try {
            const videoElement = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
            if (videoElement?.srcObject) {
              const track = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
              await track.applyConstraints({ advanced: [{ torch: true } as any] });
              setTorchOn(true);
            }
          } catch {
            // Torch couldn't be activated automatically
          }
        }
      });

      sensor.addEventListener('error', () => {
        // Permission denied or sensor unavailable - silent fail
      });

      sensor.start();
    } catch {
      // AmbientLightSensor not supported or blocked
    }

    return () => {
      try {
        sensor?.stop();
      } catch {
        // ignore
      }
    };
  }, [scannerState, torchSupported, torchOn, containerId]);


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
    setZoom(1);
    setZoomCapabilities(null);
    setHighContrast(false);

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
      <DialogContent className="sm:max-w-md w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] mx-auto p-3 sm:p-6 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
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
            <span className="flex items-center gap-1.5 text-xs mt-1 text-muted-foreground/80">
              <Lightbulb className="h-3.5 w-3.5" />
              {t('qrScanner.screenTip')}
            </span>
          </DialogDescription>
        </DialogHeader>

                <div className="space-y-3">
          {/* Manual input mode - replaces scanner entirely */}
          {showManualInput ? (
            <div className="w-full rounded-xl border-2 border-primary/30 bg-background p-3 sm:p-4 flex flex-col items-center">
              <div className="rounded-full p-2 mb-2 bg-primary/10">
                <Keyboard className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              </div>
              <p className="text-base font-semibold mb-1 text-foreground">
                {t('qrScanner.manualInputTitle')}
              </p>
              <p className="text-xs text-center text-muted-foreground mb-3">
                {t('qrScanner.manualInputDescription')}
              </p>
              <div className="w-full space-y-3">
                <Input
                  placeholder={t('qrScanner.manualInputPlaceholder')}
                  value={manualCode}
                  onChange={(e) => {
                    setManualCode(e.target.value);
                    setErrorMessage(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleManualSubmit();
                  }}
                  inputMode="numeric"
                  className="text-center font-mono text-xl sm:text-2xl tracking-[0.2em] sm:tracking-[0.3em] h-12 sm:h-14"
                  autoFocus
                />
                {/* Large numeric keypad - glove-friendly */}
                <div className="grid grid-cols-3 gap-2">
                  {['1','2','3','4','5','6','7','8','9'].map((digit) => (
                    <Button
                      key={digit}
                      type="button"
                      variant="outline"
                      className="h-12 sm:h-14 text-xl sm:text-2xl font-semibold touch-manipulation active:scale-95"
                      onClick={() => {
                        setErrorMessage(null);
                        setManualCode((prev) => (prev + digit).slice(0, 36));
                      }}
                    >
                      {digit}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 sm:h-14 text-sm sm:text-base touch-manipulation active:scale-95"
                    onClick={() => {
                      setErrorMessage(null);
                      setManualCode('');
                    }}
                  >
                    {t('qrScanner.clear')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 sm:h-14 text-xl sm:text-2xl font-semibold touch-manipulation active:scale-95"
                    onClick={() => {
                      setErrorMessage(null);
                      setManualCode((prev) => (prev + '0').slice(0, 36));
                    }}
                  >
                    0
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 sm:h-14 touch-manipulation active:scale-95"
                    onClick={() => {
                      setErrorMessage(null);
                      setManualCode((prev) => prev.slice(0, -1));
                    }}
                    aria-label={t('qrScanner.backspace')}
                  >
                    <Delete className="h-6 w-6" />
                  </Button>
                </div>
                {errorMessage && (
                  <p className="text-xs text-destructive text-center">{errorMessage}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-12"
                    onClick={() => {
                      setShowManualInput(false);
                      setManualCode('');
                      setErrorMessage(null);
                      handleRetry();
                    }}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {t('qrScanner.retry')}
                  </Button>
                  <Button
                    className="flex-1 h-12"
                    onClick={handleManualSubmit}
                    disabled={!manualCode.trim()}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {t('qrScanner.searchEquipment')}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Scanner container */}
              <div
                key={containerId}
                className={cn(
                  "relative w-full rounded-lg overflow-hidden transition-all duration-300 border",
                  "aspect-[4/3] sm:aspect-square",
                  scannerState === 'scanning' && "border-primary/40",
                  scannerState === 'success' && "border-green-500/50",
                  scannerState === 'error' && "border-destructive/50",
                  scannerState === 'permission-denied' && "border-amber-500/50",
                  (scannerState === 'initializing') && "border-muted bg-muted"
                )}
              >
                {/* Camera feed container */}
                <div 
                  id={containerId} 
                  className={cn(
                    "absolute inset-0 [&_#qr-shaded-region]:hidden [&>div>div]:border-none transition-[filter] duration-200 [&_video]:object-cover",
                    highContrast && "[&_video]:[filter:contrast(1.35)_brightness(1.1)_grayscale(1)]"
                  )}
                />

                {/* Camera controls - top right */}
                {scannerState === 'scanning' && !isSwitchingCamera && (
                  <div className="absolute top-2 right-2 z-20 flex gap-1.5">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-11 w-11 rounded-full bg-background/80 backdrop-blur-sm border border-border/50"
                      onClick={handleSwitchCamera}
                      aria-label={t('qrScanner.switchToCamera')}
                    >
                      <SwitchCamera className="h-5 w-5" />
                    </Button>
                    {torchSupported && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className={cn(
                          "h-11 w-11 rounded-full backdrop-blur-sm border border-border/50",
                          torchOn ? "bg-primary/90 hover:bg-primary text-primary-foreground" : "bg-background/80 hover:bg-background/90"
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
                        aria-label={t('qrScanner.flashlight')}
                      >
                        {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="icon"
                      className={cn(
                        "h-11 w-11 rounded-full backdrop-blur-sm border border-border/50",
                        highContrast ? "bg-primary/90 hover:bg-primary text-primary-foreground" : "bg-background/80 hover:bg-background/90"
                      )}
                      onClick={() => setHighContrast((v) => !v)}
                      aria-label={t('qrScanner.highContrast')}
                    >
                      <Contrast className="h-5 w-5" />
                    </Button>
                  </div>
                )}

                {/* Scanning frame overlay */}
                {scannerState === 'scanning' && !isSwitchingCamera && (
                  <div className="absolute inset-0 pointer-events-none z-10">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative h-52 w-52 rounded-md border border-primary/90 bg-transparent">
                        <div className="absolute -top-px -left-px h-7 w-7 border-t-2 border-l-2 border-primary" />
                        <div className="absolute -top-px -right-px h-7 w-7 border-t-2 border-r-2 border-primary" />
                        <div className="absolute -bottom-px -left-px h-7 w-7 border-b-2 border-l-2 border-primary" />
                        <div className="absolute -bottom-px -right-px h-7 w-7 border-b-2 border-r-2 border-primary" />
                        <div className="absolute inset-x-8 top-1/2 h-px bg-primary/80" />
                      </div>
                    </div>
                    <div className="absolute inset-x-4 bottom-4 text-center">
                      <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm border border-border/50">
                        {t('qrScanner.positionQRCode')}
                      </span>
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
                    "absolute inset-0 z-30 flex flex-col items-center justify-center p-3 overflow-y-auto",
                    stateConfig.bgColor
                  )}>
                    <div className="flex flex-col items-center w-full max-w-[260px] my-auto">
                      <div className={cn(
                        "rounded-full p-2.5 mb-2 shrink-0",
                        scannerState === 'error' ? 'bg-destructive/20' : 'bg-amber-500/20'
                      )}>
                        <StateIcon className={cn("h-8 w-8 sm:h-10 sm:w-10", stateConfig.color)} />
                      </div>
                      <p className={cn("text-sm sm:text-base font-semibold mb-1 text-center", stateConfig.color)}>
                        {stateConfig.title}
                      </p>
                      <p className="text-[11px] sm:text-xs text-center text-muted-foreground mb-3 leading-snug break-words">
                        {stateConfig.subtitle}
                      </p>
                      <div className="flex flex-col gap-2 w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-9"
                          onClick={handleRetry}
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          {t('qrScanner.retry')}
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full h-9"
                          onClick={() => setShowManualInput(true)}
                        >
                          <Keyboard className="h-4 w-4 mr-2" />
                          {t('qrScanner.enterManually')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Zoom slider - shown when zoom is supported */}
              {scannerState === 'scanning' && !isSwitchingCamera && zoomCapabilities && zoomCapabilities.max > zoomCapabilities.min && (
                <div className="flex items-center gap-3 px-1">
                  <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Slider
                    value={[zoom]}
                    min={zoomCapabilities.min}
                    max={zoomCapabilities.max}
                    step={zoomCapabilities.step || 0.1}
                    onValueChange={(v) => setZoom(v[0])}
                    className="flex-1"
                    aria-label={t('qrScanner.zoom')}
                  />
                  <span className="text-xs font-mono text-muted-foreground w-10 text-right tabular-nums">
                    {zoom.toFixed(1)}x
                  </span>
                </div>
              )}

              {/* Action button below scanner - enter code manually */}
              {scannerState === 'scanning' && !isSwitchingCamera && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full min-h-11"
                  onClick={() => {
                    cleanupScanner();
                    setShowManualInput(true);
                  }}
                >
                  <Keyboard className="h-4 w-4 mr-2" />
                  {t('qrScanner.enterManually')}
                </Button>
              )}
            </>
          )}

          {/* Status indicator bar */}
          {scannerState !== 'scanning' && <div className={cn(
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
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}