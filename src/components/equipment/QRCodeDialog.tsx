import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, QrCode, Copy, Check } from 'lucide-react';
import { useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: {
    id: string;
    name: string;
    internalCode: string;
    shortCode?: string;
    categoryName?: string;
    location?: string;
  } | null;
}

export function QRCodeDialog({ open, onOpenChange, equipment }: QRCodeDialogProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!equipment) return null;

  // URL que abre diretamente o formulário de inspeção
  const baseUrl = window.location.origin;
  const inspectionUrl = `${baseUrl}/inspections?scan=${equipment.id}`;

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
    
    toast({
      title: 'Download iniciado',
      description: `QR Code do equipamento ${equipment.internalCode} baixado.`,
    });
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(inspectionUrl);
    setCopied(true);
    toast({
      title: 'Link copiado',
      description: 'Link de inspeção copiado para a área de transferência.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintLabel = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta QR - ${equipment.internalCode}</title>
          <style>
            @page {
              size: 60mm 40mm;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body { 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              width: 60mm;
              height: 40mm;
              font-family: Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .label {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 4px;
              width: 100%;
              height: 100%;
              border: 1px solid #ddd;
            }
            .qr-container {
              flex-shrink: 0;
              position: relative;
            }
            .qr-container svg {
              width: 32mm !important;
              height: 32mm !important;
            }
            .short-code-overlay {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: white;
              padding: 1px 3px;
              border-radius: 2px;
            }
            .short-code {
              font-size: 6pt;
              font-weight: bold;
              font-family: monospace;
            }
            .info {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              overflow: hidden;
            }
            .quick-code {
              font-size: 14pt;
              font-weight: bold;
              font-family: monospace;
              color: #000;
              margin-bottom: 1px;
            }
            .code {
              font-size: 8pt;
              font-weight: bold;
              margin-bottom: 2px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              color: #666;
            }
            .name {
              font-size: 7pt;
              color: #333;
              margin-bottom: 2px;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            .location {
              font-size: 6pt;
              color: #666;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .scan-text {
              font-size: 5pt;
              color: #999;
              margin-top: 2px;
            }
          </style>
        </head>
        <body>
            <div class="label">
              <div class="qr-container">
                ${svg.outerHTML}
                ${equipment.shortCode ? `<div class="short-code-overlay"><span class="short-code">${equipment.shortCode}</span></div>` : ''}
              </div>
              <div class="info">
                ${equipment.shortCode ? `<div class="quick-code">${equipment.shortCode}</div>` : ''}
                <div class="code">${equipment.internalCode}</div>
                <div class="name">${equipment.name}</div>
                ${equipment.location ? `<div class="location">📍 ${equipment.location}</div>` : ''}
                <div class="scan-text">Escaneie para inspeção</div>
              </div>
            </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 100);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintFull = () => {
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
              font-family: Arial, sans-serif;
            }
            .container { 
              text-align: center;
              padding: 40px;
              border: 2px solid #000;
              border-radius: 16px;
            }
            .quick-code {
              font-size: 48px;
              font-weight: bold;
              font-family: monospace;
              letter-spacing: 4px;
              margin-bottom: 8px;
            }
            h1 { 
              font-size: 18px; 
              margin-bottom: 4px;
              color: #666;
            }
            .name { 
              font-size: 18px; 
              color: #333; 
              margin-bottom: 16px;
            }
            .location { 
              font-size: 14px; 
              color: #666; 
              margin-bottom: 8px;
            }
            .qr-wrapper {
              position: relative;
              display: inline-block;
              margin: 20px 0;
            }
            .qr-wrapper svg { 
              display: block;
            }
            .qr-center-code {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-family: monospace;
              font-weight: bold;
              font-size: 14px;
            }
            .instructions {
              font-size: 14px;
              color: #666;
              margin-top: 16px;
              padding: 12px;
              background: #f5f5f5;
              border-radius: 8px;
            }
            .search-note {
              font-size: 12px;
              color: #999;
              margin-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            ${equipment.shortCode ? `<div class="quick-code">${equipment.shortCode}</div>` : ''}
            <h1>${equipment.internalCode}</h1>
            <div class="name">${equipment.name}</div>
            ${equipment.location ? `<div class="location">📍 ${equipment.location}</div>` : ''}
            <div class="qr-wrapper">
              ${svg.outerHTML}
              ${equipment.shortCode ? `<div class="qr-center-code">${equipment.shortCode}</div>` : ''}
            </div>
            <div class="instructions">
              📱 Escaneie o QR Code para registrar inspeção
            </div>
            ${equipment.shortCode ? `<div class="search-note">Ou pesquise pelo código: <strong>${equipment.shortCode}</strong></div>` : ''}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 100);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            QR Code do Equipamento
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          <div ref={qrRef} className="bg-white p-4 rounded-lg border shadow-sm relative">
            <QRCodeSVG 
              value={inspectionUrl} 
              size={180}
              level="H"
              includeMargin
            />
            {/* Short code overlay in center of QR */}
            {equipment.shortCode && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white px-2 py-1 rounded shadow-sm border">
                  <span className="font-mono text-sm font-bold text-gray-800">
                    {equipment.shortCode}
                  </span>
                </div>
              </div>
            )}
          </div>
          {equipment.shortCode && (
            <p className="font-mono text-2xl font-bold mt-4 text-primary">{equipment.shortCode}</p>
          )}
          <p className="font-mono text-sm text-muted-foreground">{equipment.internalCode}</p>
          <p className="text-muted-foreground text-center">{equipment.name}</p>
          {equipment.location && (
            <p className="text-sm text-muted-foreground mt-1">📍 {equipment.location}</p>
          )}
        </div>

        <div className="bg-muted/50 p-3 rounded-lg text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Ao escanear, abre o formulário de inspeção deste equipamento
          </p>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 text-xs h-7"
            onClick={handleCopyUrl}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copiado!' : 'Copiar link'}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Opções de impressão:</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="gap-2" onClick={handlePrintLabel}>
              <Printer className="h-4 w-4" />
              Etiqueta (60x40mm)
            </Button>
            <Button variant="outline" className="gap-2" onClick={handlePrintFull}>
              <Printer className="h-4 w-4" />
              Página Completa
            </Button>
          </div>
          <Button variant="secondary" className="w-full gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Baixar PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
