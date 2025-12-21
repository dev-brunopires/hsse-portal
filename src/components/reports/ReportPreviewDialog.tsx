import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  onExportPDF: () => void;
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
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      await onExportPDF();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        {/* Summary Stats */}
        {summary && summary.length > 0 && (
          <div className="flex flex-wrap gap-3 py-2">
            {summary.map((stat, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg"
              >
                <span className="text-sm text-muted-foreground">{stat.label}:</span>
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

        {/* Data Preview Table */}
        <ScrollArea className="flex-1 max-h-[400px] border rounded-lg">
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
        </ScrollArea>

        {data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">{t('reports.noDataToShow')}</p>
          </div>
        )}

        <Separator />

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportExcel}
            disabled={data.length === 0 || isExporting || exporting !== null}
          >
            {exporting === 'excel' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {t('reports.exportExcel')}
          </Button>
          <Button
            className="gap-2"
            onClick={handleExportPDF}
            disabled={data.length === 0 || isExporting || exporting !== null}
          >
            {exporting === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('reports.exportPDF')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
