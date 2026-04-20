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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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

// Available label sizes (mm)
type LabelSizeKey = 'small' | 'medium' | 'large';
const LABEL_SIZES: Record<LabelSizeKey, { width: number; height: number; qr: number; shortCode: number; titleSize: number; locSize: number }> = {
  small:  { width: 90,  height: 70,  qr: 50, shortCode: 12, titleSize: 11, locSize: 9 },
  medium: { width: 120, height: 90,  qr: 65, shortCode: 16, titleSize: 14, locSize: 11 },
  large:  { width: 150, height: 120, qr: 85, shortCode: 20, titleSize: 18, locSize: 13 },
};

// Primary brand color - navy blue matching the app theme
const BRAND_COLOR = '#003366';

export function QRCodeDialog({ open, onOpenChange, equipment }: QRCodeDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [labelSize, setLabelSize] = useState<LabelSizeKey>('medium');
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

    const width = 800;
    const height = 960;
    const padding = 40;
    
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
    ctx.fillRect(padding, padding, width - padding * 2, 100);

    // Load and draw logo (organization logo or fallback to text)
    const drawLogoAndContent = () => {
      if (logoBase64) {
        const logoImg = new Image();
        logoImg.onload = () => {
          ctx.drawImage(logoImg, width / 2 - 100, padding + 16, 200, 68);
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
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      const displayName = organizationName.length > 20 ? organizationName.substring(0, 17) + '...' : organizationName;
      ctx.fillText(displayName, width / 2, padding + 64);
    };

    drawLogoAndContent();

    const drawContent = () => {
      // Internal code
      ctx.fillStyle = '#666666';
      ctx.font = '28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(equipment.internalCode, width / 2, padding + 160);

      // QR Code
      const qrSvg = qrRef.current?.querySelector('svg');
      if (qrSvg) {
        const qrData = new XMLSerializer().serializeToString(qrSvg);
        const qrImg = new Image();
        qrImg.onload = () => {
          const qrSize = 460;
          const qrX = (width - qrSize) / 2;
          const qrY = padding + 190;

          // White background for QR
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);

          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

          // Short code in center of QR (only place we show it)
          if (equipment.shortCode) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(qrX + qrSize / 2 - 92, qrY + qrSize / 2 - 24, 184, 48);
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 36px monospace';
            ctx.fillText(equipment.shortCode, width / 2, qrY + qrSize / 2 + 12);
          }

          // Equipment name
          ctx.fillStyle = '#333333';
          ctx.font = '28px Arial';
          const name = equipment.name.length > 40 ? equipment.name.substring(0, 37) + '...' : equipment.name;
          ctx.fillText(name, width / 2, qrY + qrSize + 50);

          // Location
          if (equipment.location) {
            ctx.fillStyle = '#666666';
            ctx.font = '32px Arial';
            ctx.fillText(`📍 ${equipment.location}`, width / 2, qrY + qrSize + 85);
          }

          // Footer instruction
          ctx.fillStyle = BRAND_COLOR;
          ctx.fillRect(padding, height - padding - 80, width - padding * 2, 80);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 24px Arial';
          ctx.fillText(`📱 ${t('qrCode.scanToInspect')}`, width / 2, height - padding - 30);

          // Download with organization name in filename
          const orgSlug = organizationName.toLowerCase().replace(/\s+/g, '_');
          const link = document.createElement('a');
          link.download = `qrcode_${orgSlug}_${equipment.shortCode || equipment.internalCode}.png`;
          link.href = canvas.toDataURL('image/png', 1.0);
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
    const cfg = LABEL_SIZES[labelSize];

    // Generate logo HTML based on organization
    const logoHtml = logoBase64
      ? `<img src="${logoBase64}" style="height: ${Math.round(cfg.height * 0.18)}px; width: auto;" alt="${organizationName}" />`
      : `<span style="color: white; font-weight: bold; font-size: ${cfg.titleSize}pt;">${organizationName}</span>`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta ${organizationName} - ${equipment.shortCode || equipment.internalCode}</title>
          <style>
            @page {
              size: ${cfg.width}mm ${cfg.height}mm;
              margin: 0;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              display: flex;
              align-items: center;
              justify-content: center;
              width: ${cfg.width}mm;
              height: ${cfg.height}mm;
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
              padding: 4px 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: ${Math.round(cfg.height * 0.13)}mm;
            }
            .content {
              display: flex;
              align-items: center;
              gap: 4mm;
              padding: 3mm 3mm;
              flex: 1;
              min-height: 0;
            }
            .qr-container {
              flex-shrink: 0;
              background: white;
              padding: 3mm;
              border-radius: 2mm;
            }
            .qr-container svg {
              width: ${cfg.qr}mm !important;
              height: ${cfg.qr}mm !important;
              display: block;
            }
            .info {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 1.5mm;
              overflow: hidden;
              min-width: 0;
            }
            .short-code-box {
              background: ${BRAND_COLOR};
              color: white;
              padding: 2mm 3mm;
              border-radius: 2mm;
              text-align: center;
              font-family: 'Courier New', monospace;
              font-size: ${cfg.shortCode}pt;
              font-weight: 900;
              letter-spacing: 0.15em;
              line-height: 1.1;
            }
            .code {
              font-size: ${cfg.titleSize}pt;
              font-weight: bold;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              color: #222;
            }
            .name {
              font-size: ${cfg.locSize}pt;
              color: #333;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
              line-height: 1.2;
            }
            .location {
              font-size: ${cfg.locSize - 1}pt;
              color: #666;
              word-break: break-word;
              line-height: 1.2;
            }
            .footer {
              background: #f0f0f0;
              padding: 1.5mm;
              text-align: center;
              font-size: ${Math.max(7, cfg.locSize - 2)}pt;
              color: ${BRAND_COLOR};
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="header">${logoHtml}</div>
            <div class="content">
              <div class="qr-container">${svg.outerHTML}</div>
              <div class="info">
                ${equipment.shortCode ? `<div class="short-code-box">${equipment.shortCode}</div>` : ''}
                <div class="code">${equipment.internalCode}</div>
                <div class="name">${equipment.name}</div>
                ${equipment.location ? `<div class="location">📍 ${equipment.location}</div>` : ''}
              </div>
            </div>
            <div class="footer">📱 ${scanText}</div>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => { window.print(); window.close(); }, 100);
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
              width: 560px;
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
              height: 56px;
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
              font-size: 14px; 
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
              width: 400px;
              height: 400px;
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

            <div ref={qrRef} className="bg-white p-4 sm:p-5 rounded-lg border mt-3">
              <QRCodeSVG
                value={inspectionUrl}
                size={isMobile ? 260 : 360}
                level="H"
                includeMargin
                marginSize={4}
              />
            </div>

            {equipment.shortCode && (
              <div className="mt-3 bg-primary text-primary-foreground px-4 py-2 rounded-md font-mono font-black text-xl tracking-[0.2em] shadow-sm">
                {equipment.shortCode}
              </div>
            )}

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

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('labelSize.label')}</Label>
          <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSizeKey)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">{t('labelSize.small')}</SelectItem>
              <SelectItem value="medium">{t('labelSize.medium')}</SelectItem>
              <SelectItem value="large">{t('labelSize.large')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

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