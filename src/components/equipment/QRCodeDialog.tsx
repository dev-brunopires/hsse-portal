import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, QrCode } from 'lucide-react';
import { useRef } from 'react';

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: {
    id: string;
    name: string;
    internalCode: string;
  } | null;
}

export function QRCodeDialog({ open, onOpenChange, equipment }: QRCodeDialogProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  if (!equipment) return null;

  const qrValue = JSON.stringify({
    id: equipment.id,
    code: equipment.internalCode,
    name: equipment.name,
  });

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const link = document.createElement('a');
      link.download = `qrcode_${equipment.internalCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${equipment.internalCode}</title>
          <style>
            body { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0; 
              font-family: system-ui, sans-serif;
            }
            .container { text-align: center; }
            h1 { font-size: 18px; margin-bottom: 8px; }
            p { font-size: 14px; color: #666; margin: 4px 0; }
            svg { margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${equipment.name}</h1>
            <p>${equipment.internalCode}</p>
            ${svg.outerHTML}
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            QR Code do Equipamento
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-6">
          <div ref={qrRef} className="bg-white p-4 rounded-lg">
            <QRCodeSVG 
              value={qrValue} 
              size={200}
              level="H"
              includeMargin
            />
          </div>
          <p className="font-mono text-lg font-bold mt-4">{equipment.internalCode}</p>
          <p className="text-muted-foreground">{equipment.name}</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Baixar PNG
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
