import { useEffect, useRef, useState } from 'react';
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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>('qr-reader-' + Math.random().toString(36).substr(2, 9));

  const startScanning = async () => {
    setError(null);
    setIsScanning(true);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerRef.current);
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Ignore errors during scanning
        }
      );

      setHasPermission(true);
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      setIsScanning(false);
      
      if (err.toString().includes('Permission')) {
        setHasPermission(false);
        setError('Permissão para usar a câmera foi negada. Por favor, permita o acesso à câmera nas configurações do navegador.');
      } else {
        setError('Erro ao iniciar a câmera. Verifique se seu dispositivo possui câmera.');
      }
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        // Ignore stop errors
      }
    }
    setIsScanning(false);
  };

  const handleScanSuccess = (decodedText: string) => {
    stopScanning();
    
    try {
      // Try to parse as URL with equipment ID
      const url = new URL(decodedText);
      const scanParam = url.searchParams.get('scan');
      if (scanParam) {
        onScan(scanParam);
        onOpenChange(false);
        return;
      }
    } catch {
      // Not a URL, try to parse as JSON
    }

    try {
      const data = JSON.parse(decodedText);
      if (data.id) {
        onScan(data.id);
        onOpenChange(false);
        return;
      }
    } catch {
      // Not JSON either
    }

    // If the scanned text is a UUID-like string, try using it directly
    if (decodedText.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      onScan(decodedText);
      onOpenChange(false);
      return;
    }

    setError('QR Code inválido. Certifique-se de escanear um QR code de equipamento válido.');
  };

  useEffect(() => {
    if (open) {
      // Small delay to ensure the container is rendered
      const timer = setTimeout(() => {
        startScanning();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopScanning();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

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
          <div 
            id={containerRef.current}
            className="w-full aspect-square bg-muted rounded-lg overflow-hidden relative"
          >
            {!isScanning && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <Camera className="h-12 w-12 mb-2" />
                <p className="text-sm">Inicializando câmera...</p>
                <Loader2 className="h-6 w-6 animate-spin mt-2" />
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <CameraOff className="h-5 w-5 text-destructive mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      startScanning();
                    }}
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
            ) : (
              <p>Posicione o QR code dentro da área de leitura</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
