import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Download, Printer, QrCode, Copy, Check } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useIsMobile } from '@/hooks/use-mobile';

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

// Primary brand color - navy blue matching the app theme
const BRAND_COLOR = '#003366';

export function QRCodeDialog({ open, onOpenChange, equipment }: QRCodeDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { organization, logoWhiteUrl } = useOrganization();
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Load organization logo as base64 for canvas operations
  useEffect(() => {
    if (logoWhiteUrl) {
      fetch(logoWhiteUrl)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => setLogoBase64(reader.result as string);
          reader.readAsDataURL(blob);
        })
        .catch(() => setLogoBase64(null));
    } else {
      setLogoBase64(null);
    }
  }, [logoWhiteUrl]);

  const organizationName = organization?.name || 'SafeShip';

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
    
    canvas.width = width;
    canvas.height = height;

    // White background with rounded corners simulation
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Dashed border for cutting
    ctx.strokeStyle = BRAND_COLOR;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(padding/2, padding/2, width - padding, height - padding);

    // Logo header bar
    ctx.fillStyle = BRAND_COLOR;
    ctx.fillRect(padding, padding, width - padding * 2, 50);

    // Load and draw logo (organization logo or fallback to text)
    const drawLogoAndContent = () => {
      if (logoBase64) {
        const logoImg = new Image();
        logoImg.onload = () => {
          ctx.drawImage(logoImg, width / 2 - 50, padding + 8, 100, 34);
          drawContent();
        };
        logoImg.onerror = () => {
          drawFallbackLogo();
          drawContent();
        };
        logoImg.src = logoBase64;
      } else {
        drawFallbackLogo();
        drawContent();
      }
    };

    const drawFallbackLogo = () => {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      const displayName = organizationName.length > 20 ? organizationName.substring(0, 17) + '...' : organizationName;
      ctx.fillText(displayName, width / 2, padding + 32);
    };

    drawLogoAndContent();

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
          ctx.fillStyle = BRAND_COLOR;
          ctx.fillRect(padding, height - padding - 40, width - padding * 2, 40);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px Arial';
          ctx.fillText(`📱 ${t('qrCode.scanToInspect')}`, width / 2, height - padding - 15);

          // Download with organization name in filename
          const orgSlug = organizationName.toLowerCase().replace(/\s+/g, '_');
          const link = document.createElement('a');
          link.download = `qrcode_${orgSlug}_${equipment.shortCode || equipment.internalCode}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();

          toast({
            title: t('qrCode.downloadStarted'),
            description: t('qrCode.labelDownloaded', { code: equipment.shortCode || equipment.internalCode }),
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
      title: t('qrCode.linkCopied'),
      description: t('qrCode.linkCopiedDescription'),
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintLabel = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const scanText = t('qrCode.scanToInspect').toUpperCase();
    
    // Generate logo HTML based on organization
    const logoHtml = logoBase64 
      ? `<img src="${logoBase64}" style="height: 12px; width: auto;" alt="${organizationName}" />`
      : `<span style="color: white; font-weight: bold; font-size: 10px;">${organizationName}</span>`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta ${organizationName} - ${equipment.shortCode || equipment.internalCode}</title>
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
              border: 2px dashed ${BRAND_COLOR};
              border-radius: 4px;
              overflow: hidden;
            }
            .header {
              background: ${BRAND_COLOR};
              padding: 3px 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 18px;
            }
            .header img {
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
              color: ${BRAND_COLOR};
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="header">
              ${logoHtml}
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
            <div class="footer">📱 ${scanText}</div>
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

    const scanText = t('qrCode.scanToInspect').toUpperCase();
    
    // Generate logo HTML based on organization
    const logoHtml = logoBase64 
      ? `<img src="${logoBase64}" style="height: 28px; width: auto;" alt="${organizationName}" />`
      : `<span style="color: white; font-weight: bold; font-size: 14px;">${organizationName}</span>`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code ${organizationName} - ${equipment.shortCode || equipment.internalCode}</title>
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
              background: #f5f5f5;
            }
            .container { 
              text-align: center;
              border: 2px dashed ${BRAND_COLOR};
              border-radius: 12px;
              overflow: hidden;
              width: 280px;
              background: white;
            }
            .header {
              background: ${BRAND_COLOR};
              padding: 10px 16px;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 48px;
            }
            .header img {
              height: 28px;
              width: auto;
            }
            .body {
              padding: 16px 20px;
              background: white;
            }
            .internal-code { 
              font-size: 13px; 
              color: #666;
              margin-bottom: 2px;
            }
            .name { 
              font-size: 15px; 
              color: #333; 
              margin-bottom: 8px;
              font-weight: 500;
            }
            .location { 
              font-size: 11px; 
              color: #666; 
              margin-bottom: 12px;
            }
            .qr-wrapper {
              position: relative;
              display: inline-block;
              padding: 12px;
              background: white;
              border: 1px solid #e5e5e5;
              border-radius: 8px;
            }
            .qr-wrapper svg { 
              display: block;
              width: 200px;
              height: 200px;
            }
            .qr-center-code {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: white;
              padding: 4px 10px;
              border-radius: 4px;
              font-family: monospace;
              font-weight: bold;
              font-size: 14px;
              border: 1px solid #e5e5e5;
            }
            .footer {
              background: ${BRAND_COLOR};
              padding: 10px;
              color: white;
              font-weight: bold;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${logoHtml}
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
            <div class="footer">📱 ${scanText}</div>
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

  const qrContent = (
    <>
      {/* Preview with organization branding */}
      <div className="flex flex-col items-center">
        <div className="border-2 border-dashed border-primary rounded-lg overflow-hidden w-full max-w-xs">
          {/* Header - Dynamic logo */}
          <div className="bg-primary py-2 px-4 flex justify-center items-center min-h-[40px]">
            {logoWhiteUrl ? (
              <img 
                src={logoWhiteUrl} 
                alt={organizationName} 
                className="h-6 w-auto max-w-[150px] object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    (e.currentTarget.nextElementSibling as HTMLElement).classList.remove('hidden');
                  }
                }}
              />
            ) : null}
            <span className={`text-white font-bold text-sm ${logoWhiteUrl ? 'hidden' : ''}`}>
              {organizationName}
            </span>
          </div>

          {/* Content */}
          <div className="bg-white p-4 flex flex-col items-center">
            <p className="font-mono text-xs text-muted-foreground">{equipment.internalCode}</p>
            
            <div ref={qrRef} className="bg-white p-3 sm:p-4 rounded-lg border mt-3 relative">
              <QRCodeSVG 
                value={inspectionUrl} 
                size={isMobile ? 160 : 190}
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
            <p className="text-xs text-white font-semibold">📱 {t('qrCode.scanToInspect').toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="bg-muted/50 p-3 rounded-lg text-center">
        <p className="text-xs text-muted-foreground mb-2">
          {t('qrScanner.dialogDescription')}
        </p>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 text-xs h-7"
          onClick={handleCopyUrl}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? t('qrCode.linkCopied') : t('qrCode.copyLink')}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{t('reports.printOptions')}:</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="gap-2 text-xs sm:text-sm" onClick={handlePrintLabel}>
            <Printer className="h-4 w-4" />
            <span className="truncate">{t('qrCode.printLabel')}</span>
          </Button>
          <Button variant="outline" className="gap-2 text-xs sm:text-sm" onClick={handlePrintFull}>
            <Printer className="h-4 w-4" />
            <span className="truncate">{t('qrCode.printFull')}</span>
          </Button>
        </div>
        <Button variant="secondary" className="w-full gap-2" onClick={handleDownload}>
          <Download className="h-4 w-4" />
          {t('qrCode.download')} PNG
        </Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              {t('qrCode.dialogTitle')}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6 space-y-4">
            {qrContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            {t('qrCode.dialogTitle')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('qrCode.dialogTitle')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {qrContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}