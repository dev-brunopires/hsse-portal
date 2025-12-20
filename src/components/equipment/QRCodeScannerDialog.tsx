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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerIdRef = useRef<string>(`qr-reader-${Date.now()}`);
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

  const startScanning = useCallback(async () => {
    if (!isMountedRef.current || isCleaningUpRef.current) return;
    
    const containerId = containerIdRef.current;
    const containerElement = document.getElementById(containerId);
    
    if (!containerElement) {
      console.log('Container not found, retrying...');
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
        
        if (err.toString().includes('Permission')) {
          setHasPermission(false);
          setError('Permissão para usar a câmera foi negada. Por favor, permita o acesso à câmera nas configurações do navegador.');
        } else if (err.toString().includes('NotAllowedError')) {
          setHasPermission(false);
          setError('Acesso à câmera negado. Verifique as permissões do navegador.');
        } else {
          setError('Erro ao iniciar a câmera. Verifique se seu dispositivo possui câmera.');
        }
      }
    }
  }, [cleanupScanner, handleScanSuccess]);

  // Handle dialog open/close
  useEffect(() => {
    if (open) {
      isMountedRef.current = true;
      // Generate new container ID when opening
      containerIdRef.current = `qr-reader-${Date.now()}`;
      
      // Start scanning after a delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          startScanning();
        }
      }, 300);
      
      return () => {
        clearTimeout(timer);
      };
    } else {
      // Cleanup when dialog closes
      cleanupScanner();
    }
  }, [open, startScanning, cleanupScanner]);

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
          {/* Scanner container - key forces remount on each open */}
          <div 
            key={containerIdRef.current}
            id={containerIdRef.current}
            className="w-full aspect-square bg-muted rounded-lg overflow-hidden relative"
          >
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
