import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
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
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, FileText, FileSpreadsheet, Loader2, Eye } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  format?: (value: any) => string;
}

interface ReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  data: Record<string, any>[];
  columns: Column[];
  onExportPDF: (preview?: boolean) => void;
  onExportExcel: () => void;
  isExporting?: boolean;
  summary?: {
    label: string;
    value: string | number;
    color?: string;
  }[];
}

export function ReportPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  data,
  columns,
  onExportPDF,
  onExportExcel,
  isExporting = false,
  summary,
}: ReportPreviewDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'preview' | null>(null);

  const handlePreviewPDF = async () => {
    setExporting('preview');
    try {
      await onExportPDF(true);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      await onExportPDF(false);
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      await onExportExcel();
    } finally {
      setExporting(null);
    }
  };

  const getCellValue = (item: Record<string, any>, column: Column) => {
    const value = item[column.key];
    if (column.format) {
      return column.format(value);
    }
    return value ?? '—';
  };

  const headerContent = (
    <div className="flex items-center gap-2">
      <Eye className="h-5 w-5 text-primary" />
      <span>{title}</span>
    </div>
  );

  const content = (
    <>
      {/* Summary Stats */}
      {summary && summary.length > 0 && (
        <div className="flex flex-wrap gap-2 py-2">
          {summary.map((stat, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg text-xs sm:text-sm"
            >
              <span className="text-muted-foreground">{stat.label}:</span>
              <Badge
                variant="secondary"
                className={stat.color || ''}
              >
                {stat.value}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <Separator />

      {/* Data Preview - Mobile: Cards, Desktop: Table */}
      {isMobile ? (
        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">{t('reports.noDataToShow')}</p>
            </div>
          ) : (
            <>
              {data.slice(0, 30).map((item, index) => (
                <div
                  key={index}
                  className="bg-card border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {columns.slice(0, 6).map((col) => (
                      <div key={col.key} className="space-y-0.5">
                        <p className="text-xs text-muted-foreground truncate">{col.label}</p>
                        <p className="font-medium truncate">{getCellValue(item, col)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {data.length > 30 && (
                <div className="text-center py-3 text-xs text-muted-foreground">
                  {t('reports.showing')} 30 {t('reports.of')} {data.length} {t('reports.records')}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 max-h-[400px] border rounded-lg overflow-auto">
            <div className="min-w-full">
              <table className="w-full text-sm">
                <thead className="bg-muted/70 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-10">
                      #
                    </th>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className="px-3 py-2 text-left font-medium text-muted-foreground"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.slice(0, 50).map((item, index) => (
                    <tr
                      key={index}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-3 py-2 text-muted-foreground">
                        {index + 1}
                      </td>
                      {columns.map((col) => (
                        <td key={col.key} className="px-3 py-2">
                          {getCellValue(item, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.length > 50 && (
              <div className="text-center py-3 text-sm text-muted-foreground bg-muted/50 border-t">
                {t('reports.showing')} 50 {t('reports.of')} {data.length} {t('reports.records')}. {t('reports.exportedFileContainsAll')}
              </div>
            )}
          </div>

          {data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">{t('reports.noDataToShow')}</p>
            </div>
          )}
        </>
      )}

      <Separator />

      {/* Footer Actions */}
      <div className={`flex gap-2 pt-2 ${isMobile ? 'flex-col' : 'flex-row justify-end'}`}>
        <Button variant="outline" onClick={() => onOpenChange(false)} className={isMobile ? 'w-full' : ''}>
          {t('common.cancel')}
        </Button>
        
        <div className={`flex gap-2 ${isMobile ? 'flex-col' : ''}`}>
          <Button
            variant="outline"
            className="gap-2 flex-1"
            onClick={handleExportExcel}
            disabled={data.length === 0 || isExporting || exporting !== null}
          >
            {exporting === 'excel' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Excel
          </Button>
          <Button
            variant="outline"
            className="gap-2 flex-1"
            onClick={handlePreviewPDF}
            disabled={data.length === 0 || isExporting || exporting !== null}
          >
            {exporting === 'preview' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {isMobile ? 'Preview' : t('common.previewPDF')}
          </Button>
          <Button
            className="gap-2 flex-1"
            onClick={handleExportPDF}
            disabled={data.length === 0 || isExporting || exporting !== null}
          >
            {exporting === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PDF
          </Button>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh] flex flex-col">
          <DrawerHeader className="pb-2 border-b border-border flex-shrink-0">
            <DrawerTitle>{headerContent}</DrawerTitle>
            {description && (
              <DrawerDescription>{description}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 flex flex-col">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{headerContent}</DialogTitle>
          <DialogDescription className={description ? '' : 'sr-only'}>
            {description || title}
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
