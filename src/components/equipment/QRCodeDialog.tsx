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

// SBM Logo SVG as base64 data URL (white version for orange header)
const SBM_LOGO_WHITE_SVG = `<svg width="120" height="40" viewBox="0 0 437 150" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M30.4461 0.0790735C10.4387 0.0790735 0 17.1605 0 34.0047C0 50.8489 10.4387 67.9303 30.4461 67.9303H123.129V0L30.4461 0.0790735Z" fill="white"/>
<path d="M238.349 0.079071H145.667V68.0094H238.349C258.357 68.0094 268.795 50.928 268.795 34.0838C268.795 17.1605 258.357 0.079071 238.349 0.079071Z" fill="white"/>
<path d="M238.349 82.9557H145.667V150.886H238.349C258.357 150.886 268.795 133.805 268.795 116.96C268.795 100.037 258.357 82.9557 238.349 82.9557Z" fill="white"/>
<path d="M320.198 0.079071C303.354 0.079071 286.272 10.5177 286.272 30.5251V150.886H354.203V30.5251C354.123 10.5177 337.042 0.079071 320.198 0.079071Z" fill="white"/>
<path d="M402.995 0.079071C386.151 0.079071 369.07 10.5177 369.07 30.5251V150.886H437V30.5251C437 10.5177 419.919 0.079071 402.995 0.079071Z" fill="white"/>
<path d="M97.7437 82.9557H5.0611V150.886H97.7437C117.751 150.886 128.19 133.805 128.19 116.96C128.19 100.037 117.751 82.9557 97.7437 82.9557Z" fill="white"/>
</svg>`;

const SBM_LOGO_WHITE_BASE64 = `data:image/svg+xml;base64,${btoa(SBM_LOGO_WHITE_SVG)}`;

export function QRCodeDialog({ open, onOpenChange, equipment }: QRCodeDialogProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!equipment) return null;

  // URL que abre diretamente o formulário de inspeção
  const baseUrl = window.location.origin;
  const inspectionUrl = `${baseUrl}/inspections?scan=${equipment.id}`;

  const handleDownload = () => {
    // Create a styled canvas with logo and border
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 400;
    const height = 480;
    const padding = 20;
    const borderRadius = 16;
    
    canvas.width = width;
    canvas.height = height;

    // White background with rounded corners simulation
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Dashed border for cutting
    ctx.strokeStyle = '#F36F27';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(padding/2, padding/2, width - padding, height - padding);

    // SBM Logo header bar
    ctx.fillStyle = '#F36F27';
    ctx.fillRect(padding, padding, width - padding * 2, 50);

    // Load and draw logo
    const logoImg = new Image();
    logoImg.onload = () => {
      ctx.drawImage(logoImg, width / 2 - 50, padding + 8, 100, 34);
      
      // Continue drawing after logo loads
      drawContent();
    };
    logoImg.onerror = () => {
      // Draw without logo if it fails
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SBM', width / 2, padding + 32);
      drawContent();
    };
    logoImg.src = SBM_LOGO_WHITE_BASE64;

    const drawContent = () => {
      // Internal code
      ctx.fillStyle = '#666666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(equipment.internalCode, width / 2, padding + 90);

      // QR Code
      const qrSvg = qrRef.current?.querySelector('svg');
      if (qrSvg) {
        const qrData = new XMLSerializer().serializeToString(qrSvg);
        const qrImg = new Image();
        qrImg.onload = () => {
          const qrSize = 230;
          const qrX = (width - qrSize) / 2;
          const qrY = padding + 110;

          // White background for QR
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);

          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

          // Short code in center of QR (only place we show it)
          if (equipment.shortCode) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(qrX + qrSize / 2 - 46, qrY + qrSize / 2 - 16, 92, 32);
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 18px monospace';
            ctx.fillText(equipment.shortCode, width / 2, qrY + qrSize / 2 + 7);
          }

          // Equipment name
          ctx.fillStyle = '#333333';
          ctx.font = '14px Arial';
          const name = equipment.name.length > 40 ? equipment.name.substring(0, 37) + '...' : equipment.name;
          ctx.fillText(name, width / 2, qrY + qrSize + 28);

          // Location
          if (equipment.location) {
            ctx.fillStyle = '#666666';
            ctx.font = '12px Arial';
            ctx.fillText(`📍 ${equipment.location}`, width / 2, qrY + qrSize + 48);
          }

          // Footer instruction
          ctx.fillStyle = '#F36F27';
          ctx.fillRect(padding, height - padding - 40, width - padding * 2, 40);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px Arial';
          ctx.fillText('📱 Escaneie para registrar inspeção', width / 2, height - padding - 15);

          // Download
          const link = document.createElement('a');
          link.download = `qrcode_sbm_${equipment.shortCode || equipment.internalCode}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();

          toast({
            title: 'Download iniciado',
            description: `Etiqueta SBM do equipamento ${equipment.shortCode || equipment.internalCode} baixada.`,
          });
        };
        qrImg.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(qrData)));
      }
    };
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
          <title>Etiqueta SBM - ${equipment.shortCode || equipment.internalCode}</title>
          <style>
            @page {
              size: 60mm 45mm;
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
              height: 45mm;
              font-family: Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .label {
              display: flex;
              flex-direction: column;
              width: 100%;
              height: 100%;
              border: 2px dashed #F36F27;
              border-radius: 4px;
              overflow: hidden;
            }
            .header {
              background: #F36F27;
              padding: 3px 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 18px;
            }
            .header svg {
              height: 12px;
              width: auto;
            }
            .content {
              display: flex;
              align-items: center;
              gap: 4px;
              padding: 3px 4px;
              flex: 1;
            }
            .qr-container {
              flex-shrink: 0;
              position: relative;
            }
            .qr-container svg {
              width: 30mm !important;
              height: 30mm !important;
            }
            .short-code-overlay {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: white;
              padding: 1px 4px;
              border-radius: 2px;
            }
            .short-code {
              font-size: 7pt;
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
            .code {
              font-size: 8pt;
              font-weight: bold;
              margin-bottom: 2px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              color: #333;
            }
            .name {
              font-size: 6pt;
              color: #333;
              margin-bottom: 2px;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            .location {
              font-size: 5pt;
              color: #666;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .footer {
              background: #f5f5f5;
              padding: 2px;
              text-align: center;
              font-size: 5pt;
              color: #F36F27;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="header">
              <svg viewBox="0 0 437 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M30.4461 0.0790735C10.4387 0.0790735 0 17.1605 0 34.0047C0 50.8489 10.4387 67.9303 30.4461 67.9303H123.129V0L30.4461 0.0790735Z" fill="white"/>
                <path d="M238.349 0.079071H145.667V68.0094H238.349C258.357 68.0094 268.795 50.928 268.795 34.0838C268.795 17.1605 258.357 0.079071 238.349 0.079071Z" fill="white"/>
                <path d="M238.349 82.9557H145.667V150.886H238.349C258.357 150.886 268.795 133.805 268.795 116.96C268.795 100.037 258.357 82.9557 238.349 82.9557Z" fill="white"/>
                <path d="M320.198 0.079071C303.354 0.079071 286.272 10.5177 286.272 30.5251V150.886H354.203V30.5251C354.123 10.5177 337.042 0.079071 320.198 0.079071Z" fill="white"/>
                <path d="M402.995 0.079071C386.151 0.079071 369.07 10.5177 369.07 30.5251V150.886H437V30.5251C437 10.5177 419.919 0.079071 402.995 0.079071Z" fill="white"/>
                <path d="M97.7437 82.9557H5.0611V150.886H97.7437C117.751 150.886 128.19 133.805 128.19 116.96C128.19 100.037 117.751 82.9557 97.7437 82.9557Z" fill="white"/>
              </svg>
            </div>
            <div class="content">
              <div class="qr-container">
                ${svg.outerHTML}
                ${equipment.shortCode ? `<div class="short-code-overlay"><span class="short-code">${equipment.shortCode}</span></div>` : ''}
              </div>
              <div class="info">
                <div class="code">${equipment.internalCode}</div>
                <div class="name">${equipment.name}</div>
                ${equipment.location ? `<div class="location">📍 ${equipment.location}</div>` : ''}
              </div>
            </div>
            <div class="footer">📱 ESCANEIE PARA INSPEÇÃO</div>
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
          <title>QR Code SBM - ${equipment.shortCode || equipment.internalCode}</title>
          <style>
            body { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0; 
              font-family: Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .container { 
              text-align: center;
              padding: 0;
              border: 3px dashed #F36F27;
              border-radius: 16px;
              overflow: hidden;
              width: 320px;
            }
            .header {
              background: #F36F27;
              padding: 16px;
            }
            .header svg {
              height: 40px;
              width: auto;
            }
            .body {
              padding: 24px;
            }
            .internal-code { 
              font-size: 14px; 
              margin-bottom: 4px;
              color: #666;
            }
            .name { 
              font-size: 16px; 
              color: #333; 
              margin-bottom: 16px;
              font-weight: 500;
            }
            .location { 
              font-size: 12px; 
              color: #666; 
              margin-bottom: 8px;
            }
            .qr-wrapper {
              position: relative;
              display: inline-block;
              margin: 16px 0;
              padding: 16px;
              background: white;
              border: 2px solid #eee;
              border-radius: 12px;
            }
            .qr-wrapper svg { 
              display: block;
              width: 260px;
              height: 260px;
            }
            .qr-center-code {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: white;
              padding: 6px 12px;
              border-radius: 6px;
              font-family: monospace;
              font-weight: bold;
              font-size: 18px;
              border: 1px solid #eee;
            }
            .footer {
              background: #F36F27;
              padding: 12px;
              color: white;
              font-weight: bold;
              font-size: 14px;
            }
            .search-note {
              font-size: 11px;
              color: #999;
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px solid #eee;
            }
            .cut-line {
              position: absolute;
              width: 100%;
              text-align: center;
              font-size: 10px;
              color: #ccc;
              top: -20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <svg viewBox="0 0 437 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M30.4461 0.0790735C10.4387 0.0790735 0 17.1605 0 34.0047C0 50.8489 10.4387 67.9303 30.4461 67.9303H123.129V0L30.4461 0.0790735Z" fill="white"/>
                <path d="M238.349 0.079071H145.667V68.0094H238.349C258.357 68.0094 268.795 50.928 268.795 34.0838C268.795 17.1605 258.357 0.079071 238.349 0.079071Z" fill="white"/>
                <path d="M238.349 82.9557H145.667V150.886H238.349C258.357 150.886 268.795 133.805 268.795 116.96C268.795 100.037 258.357 82.9557 238.349 82.9557Z" fill="white"/>
                <path d="M320.198 0.079071C303.354 0.079071 286.272 10.5177 286.272 30.5251V150.886H354.203V30.5251C354.123 10.5177 337.042 0.079071 320.198 0.079071Z" fill="white"/>
                <path d="M402.995 0.079071C386.151 0.079071 369.07 10.5177 369.07 30.5251V150.886H437V30.5251C437 10.5177 419.919 0.079071 402.995 0.079071Z" fill="white"/>
                <path d="M97.7437 82.9557H5.0611V150.886H97.7437C117.751 150.886 128.19 133.805 128.19 116.96C128.19 100.037 117.751 82.9557 97.7437 82.9557Z" fill="white"/>
              </svg>
            </div>
            <div class="body">
              <div class="internal-code">${equipment.internalCode}</div>
              <div class="name">${equipment.name}</div>
              ${equipment.location ? `<div class="location">📍 ${equipment.location}</div>` : ''}
              <div class="qr-wrapper">
                ${svg.outerHTML}
                ${equipment.shortCode ? `<div class="qr-center-code">${equipment.shortCode}</div>` : ''}
              </div>
            </div>
            <div class="footer">📱 ESCANEIE PARA REGISTRAR INSPEÇÃO</div>
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

        {/* Preview with SBM styling */}
        <div className="flex flex-col items-center">
          <div className="border-2 border-dashed border-primary rounded-lg overflow-hidden w-full max-w-xs">
            {/* Header */}
            <div className="bg-primary py-2 px-4 flex justify-center">
              <svg viewBox="0 0 437 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6">
                <path d="M30.4461 0.0790735C10.4387 0.0790735 0 17.1605 0 34.0047C0 50.8489 10.4387 67.9303 30.4461 67.9303H123.129V0L30.4461 0.0790735Z" fill="white"/>
                <path d="M238.349 0.079071H145.667V68.0094H238.349C258.357 68.0094 268.795 50.928 268.795 34.0838C268.795 17.1605 258.357 0.079071 238.349 0.079071Z" fill="white"/>
                <path d="M238.349 82.9557H145.667V150.886H238.349C258.357 150.886 268.795 133.805 268.795 116.96C268.795 100.037 258.357 82.9557 238.349 82.9557Z" fill="white"/>
                <path d="M320.198 0.079071C303.354 0.079071 286.272 10.5177 286.272 30.5251V150.886H354.203V30.5251C354.123 10.5177 337.042 0.079071 320.198 0.079071Z" fill="white"/>
                <path d="M402.995 0.079071C386.151 0.079071 369.07 10.5177 369.07 30.5251V150.886H437V30.5251C437 10.5177 419.919 0.079071 402.995 0.079071Z" fill="white"/>
                <path d="M97.7437 82.9557H5.0611V150.886H97.7437C117.751 150.886 128.19 133.805 128.19 116.96C128.19 100.037 117.751 82.9557 97.7437 82.9557Z" fill="white"/>
              </svg>
            </div>

            {/* Content */}
            <div className="bg-white p-4 flex flex-col items-center">
              <p className="font-mono text-xs text-muted-foreground">{equipment.internalCode}</p>
              
              <div ref={qrRef} className="bg-white p-4 rounded-lg border mt-3 relative">
                <QRCodeSVG 
                  value={inspectionUrl} 
                  size={190}
                  level="H"
                  includeMargin
                />
                {equipment.shortCode && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-white px-3 py-1 rounded border shadow-sm">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {equipment.shortCode}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-sm text-foreground text-center mt-2 font-medium">{equipment.name}</p>
              {equipment.location && (
                <p className="text-xs text-muted-foreground">📍 {equipment.location}</p>
              )}
            </div>

            {/* Footer */}
            <div className="bg-primary py-1.5 text-center">
              <p className="text-xs text-white font-semibold">📱 ESCANEIE PARA INSPEÇÃO</p>
            </div>
          </div>
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
              Etiqueta (60x45mm)
            </Button>
            <Button variant="outline" className="gap-2" onClick={handlePrintFull}>
              <Printer className="h-4 w-4" />
              Página Completa
            </Button>
          </div>
          <Button variant="secondary" className="w-full gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Baixar PNG (com logo SBM)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}