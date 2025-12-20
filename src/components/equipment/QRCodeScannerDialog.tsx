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
import { Camera, CameraOff, Loader2, QrCode } from 'lucide-react';

interface QRCodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (equipmentId: string) => void;
}

export function QRCodeScannerDialog({ open, onOpenChange, onScan }: QRCodeScannerDialogProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [containerId, setContainerId] = useState(() => `qr-reader-${Date.now()}`);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  const isCleaningUpRef = useRef(false);

  const cleanupScanner = useCallback(async () => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // Html5QrcodeScannerState.SCANNING
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        // Ignore cleanup errors
        console.log('Scanner cleanup:', err);
      }
      scannerRef.current = null;
    }

    isCleaningUpRef.current = false;
    if (isMountedRef.current) {
      setIsScanning(false);
    }
  }, []);

  const handleScanSuccess = useCallback((decodedText: string) => {
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
      setError('QR Code inválido. Certifique-se de escanear um QR code de equipamento válido.');
    }
  }, [cleanupScanner, onScan, onOpenChange]);

  const attemptStartScanning = useCallback(async (attempt: number) => {
    if (!isMountedRef.current || isCleaningUpRef.current) return;

    const containerElement = document.getElementById(containerId);

    // Radix Dialog renders through a portal; depending on animation timing,
    // the container might not be in the DOM yet. Retry a few times.
    if (!containerElement) {
      if (attempt < 12) {
        if (isMountedRef.current) setIsInitializing(true);
        window.setTimeout(() => {
          attemptStartScanning(attempt + 1);
        }, 150);
        return;
      }

      if (isMountedRef.current) {
        setIsInitializing(false);
        setIsScanning(false);
        setError('Não foi possível inicializar o leitor de QR code. Feche e abra novamente para tentar.');
      }
      return;
    }

    setError(null);
    setIsInitializing(true);

    try {
      // Cleanup any existing scanner
      await cleanupScanner();

      if (!isMountedRef.current) return;

      // Create new scanner instance
      scannerRef.current = new Html5Qrcode(containerId);

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 200, height: 200 },
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Ignore scan errors
        }
      );

      if (isMountedRef.current) {
        setIsScanning(true);
        setHasPermission(true);
        setIsInitializing(false);
      }
    } catch (err: any) {
      console.error('Error starting scanner:', err);

      if (isMountedRef.current) {
        setIsScanning(false);
        setIsInitializing(false);

        const errStr = String(err);
        if (errStr.includes('Permission') || errStr.includes('NotAllowedError')) {
          setHasPermission(false);
          setError('Acesso à câmera negado. Verifique as permissões do navegador e tente novamente.');
        } else if (errStr.includes('NotFoundError') || errStr.includes('NotFound')) {
          setError('Nenhuma câmera encontrada no dispositivo.');
        } else {
          setError('Erro ao iniciar a câmera. Verifique se seu dispositivo possui câmera e se o site está em HTTPS.');
        }
      }
    }
  }, [cleanupScanner, containerId, handleScanSuccess]);

  const startScanning = useCallback(async () => {
    await attemptStartScanning(0);
  }, [attemptStartScanning]);

  // Handle dialog open/close
  useEffect(() => {
    if (open) {
      isMountedRef.current = true;
      setError(null);
      setHasPermission(null);
      setIsScanning(false);
      setIsInitializing(true);

      // Generate a new container id (forces the DOM node to remount)
      setContainerId(`qr-reader-${Date.now()}`);
    } else {
      cleanupScanner();
    }
  }, [open, cleanupScanner]);

  // Start scanning when the containerId is rendered
  useEffect(() => {
    if (!open) return;

    const t = window.setTimeout(() => {
      if (isMountedRef.current) startScanning();
    }, 50);

    return () => window.clearTimeout(t);
  }, [open, containerId, startScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanupScanner();
    };
  }, [cleanupScanner]);

  const handleRetry = () => {
    setError(null);
    startScanning();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Escanear QR Code
          </DialogTitle>
          <DialogDescription>
            Aponte a câmera para o QR code do equipamento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scanner container (React must NOT render children inside the element that html5-qrcode mutates) */}
          <div
            key={containerId}
            className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden"
          >
            <div id={containerId} className="absolute inset-0" />

            {(isInitializing || (!isScanning && !error)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground z-10 bg-muted">
                <Camera className="h-12 w-12 mb-2" />
                <p className="text-sm">Inicializando câmera...</p>
                <Loader2 className="h-6 w-6 animate-spin mt-2" />
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <CameraOff className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                  >
                    Tentar Novamente
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            {hasPermission === false ? (
              <p>Acesso à câmera negado. Verifique as permissões do navegador.</p>
            ) : isScanning ? (
              <p>Posicione o QR code dentro da área de leitura</p>
            ) : (
              <p>Aguarde a inicialização da câmera</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
