import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Printer, QrCode, Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { type Category } from '@/hooks/useCategories';

interface PrintCategoryQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}

interface Equipment {
  id: string;
  name: string;
  internal_code: string;
  short_code: string | null;
  location: string;
}

// Available label sizes (mm)
type LabelSizeKey = 'small' | 'medium' | 'large';
const LABEL_SIZES: Record<LabelSizeKey, { width: number; height: number; qr: number; shortCode: number; titleSize: number; locSize: number }> = {
  small:  { width: 90,  height: 70,  qr: 50, shortCode: 12, titleSize: 11, locSize: 9 },
  medium: { width: 120, height: 90,  qr: 65, shortCode: 16, titleSize: 14, locSize: 11 },
  large:  { width: 150, height: 120, qr: 85, shortCode: 20, titleSize: 18, locSize: 13 },
};

const BRAND_COLOR = '#003366';

export function PrintCategoryQRDialog({ open, onOpenChange, category }: PrintCategoryQRDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { organization, logoWhiteUrl } = useOrganization();
  const { selectedShipId, isFilterEnabled } = useShipFilter();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [labelSize, setLabelSize] = useState<LabelSizeKey>('medium');
  const qrRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const organizationName = organization?.name || 'SafeShip';

  // Load equipment for category
  useEffect(() => {
    if (open && category) {
      setLoading(true);
      let query = supabase
        .from('equipment')
        .select('id, name, internal_code, short_code, location, status')
        .eq('category_id', category.id)
        .order('internal_code', { ascending: true });

      if (isFilterEnabled && selectedShipId) {
        query = query.eq('ship_id', selectedShipId);
      }

      query.then(({ data, error }) => {
        if (!error && data) {
          setEquipment(data as any);
          setSelectedIds(new Set(data.map(e => e.id)));
        }
        setLoading(false);
      });
    }
  }, [open, category, selectedShipId, isFilterEnabled]);

  const filteredEquipment = statusFilter === 'all'
    ? equipment
    : equipment.filter(e => (e as any).status === statusFilter);

  // Load logo as base64
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

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(equipment.map(e => e.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handlePrintMultiple = () => {
    const selectedEquipment = equipment.filter(e => selectedIds.has(e.id));
    if (selectedEquipment.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const scanText = t('qrCode.scanToInspect').toUpperCase();

    const logoHtml = logoBase64
      ? `<img src="${logoBase64}" style="height: 16px; width: auto;" alt="${organizationName}" />`
      : `<span style="color: white; font-weight: bold; font-size: 12px;">${organizationName}</span>`;

    // Build QR SVGs using the refs
    const qrSvgs: string[] = [];
    selectedEquipment.forEach(eq => {
      const ref = qrRefs.current.get(eq.id);
      if (ref) {
        const svg = ref.querySelector('svg');
        if (svg) {
          qrSvgs.push(svg.outerHTML);
        }
      }
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${t('qrCode.printMultiple')} - ${category?.name}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8mm;
            }
            .label {
              display: flex;
              flex-direction: column;
              border: 1.5px dashed ${BRAND_COLOR};
              border-radius: 4px;
              overflow: hidden;
              page-break-inside: avoid;
              width: 90mm;
              height: 70mm;
            }
            .header {
              background: ${BRAND_COLOR};
              padding: 3px 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 20px;
            }
            .header img { height: 14px; width: auto; }
            .content {
              display: flex;
              align-items: center;
              gap: 3mm;
              padding: 2.5mm;
              flex: 1;
              min-height: 0;
            }
            .qr-container {
              flex-shrink: 0;
              background: white;
              padding: 2mm;
              border-radius: 1.5mm;
            }
            .qr-container svg {
              width: 48mm !important;
              height: 48mm !important;
              display: block;
            }
            .info {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 1mm;
              overflow: hidden;
              min-width: 0;
            }
            .short-code-box {
              background: ${BRAND_COLOR};
              color: white;
              padding: 1.5mm 2mm;
              border-radius: 1.5mm;
              text-align: center;
              font-family: 'Courier New', monospace;
              font-size: 13pt;
              font-weight: 900;
              letter-spacing: 0.12em;
              line-height: 1.1;
            }
            .code {
              font-size: 10pt;
              font-weight: bold;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              color: #222;
            }
            .name {
              font-size: 8pt;
              color: #333;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
              line-height: 1.2;
            }
            .location {
              font-size: 7.5pt;
              color: #666;
              word-break: break-word;
              line-height: 1.2;
            }
            .footer {
              background: #f0f0f0;
              padding: 1.5mm;
              text-align: center;
              font-size: 6.5pt;
              color: ${BRAND_COLOR};
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${selectedEquipment.map((eq, index) => `
              <div class="label">
                <div class="header">${logoHtml}</div>
                <div class="content">
                  <div class="qr-container">${qrSvgs[index] || ''}</div>
                  <div class="info">
                    ${eq.short_code ? `<div class="short-code-box">${eq.short_code}</div>` : ''}
                    <div class="code">${eq.internal_code}</div>
                    <div class="name">${eq.name}</div>
                    ${eq.location ? `<div class="location">📍 ${eq.location}</div>` : ''}
                  </div>
                </div>
                <div class="footer">📱 ${scanText}</div>
              </div>
            `).join('')}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => { window.print(); window.close(); }, 200);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const content = (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : equipment.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t('categoriesPage.noEquipmentInCategory')}
        </div>
      ) : (
        <>
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
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedIds.size} / {filteredEquipment.length} {t('common.selected')}
              </Badge>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="active">{t('equipment.statusActive')}</SelectItem>
                  <SelectItem value="inactive">{t('equipment.statusInactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {t('common.selectAll')}
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                {t('common.deselectAll')}
  </Button>
            </div>
          </div>

          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="p-2 space-y-1">
              {filteredEquipment.map(eq => (
                <label
                  key={eq.id}
                  className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.has(eq.id)}
                    onCheckedChange={() => toggleSelection(eq.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{eq.internal_code} - {eq.name}</p>
                    {eq.location && (
                      <p className="text-xs text-muted-foreground break-words whitespace-normal leading-tight">📍 {eq.location}</p>
                    )}
                  </div>
                  {/* Hidden QR code for printing */}
                  <div
                    ref={(el) => {
                      if (el) qrRefs.current.set(eq.id, el);
                    }}
                    className="hidden"
                  >
                    <QRCodeSVG
                      value={`${window.location.origin}/inspections?scan=${eq.id}`}
                      size={500}
                      level="H"
                      marginSize={4}
                    />
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>

          <Button
            className="w-full gap-2"
            onClick={handlePrintMultiple}
            disabled={selectedIds.size === 0}
          >
            <Printer className="h-4 w-4" />
            {t('qrCode.printMultiple')} ({selectedIds.size})
          </Button>
        </>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              {t('qrCode.printMultiple')} - {category?.name}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 text-base">
            <QrCode className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">{t('qrCode.printMultiple')} - {category?.name}</span>
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
