import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  X 
} from 'lucide-react';
import { parseCSV, generateTemplate, type ImportResult, type ImportedEquipment } from '@/utils/importEquipment';
import { useCategories } from '@/hooks/useCategories';
import { useCreateEquipment } from '@/hooks/useEquipment';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ImportEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportEquipmentDialog({ open, onOpenChange }: ImportEquipmentDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, errors: [] as string[] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: categories } = useCategories();
  const createEquipment = useCreateEquipment();
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await parseCSV(file);
    setImportResult(result);
    
    if (result.success && result.data && result.data.length > 0) {
      setStep('preview');
    } else {
      toast({
        title: t('importEquipment.errorProcessing'),
        description: result.errors?.[0] || t('importEquipment.invalidFile'),
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    if (!importResult?.data || !selectedCategory) return;

    setStep('importing');
    setImportProgress({ current: 0, total: importResult.data.length, errors: [] });

    const errors: string[] = [];

    for (let i = 0; i < importResult.data.length; i++) {
      const item = importResult.data[i];
      
      try {
        await createEquipment.mutateAsync({
          internal_code: item.internal_code,
          name: item.name,
          category_id: selectedCategory,
          type: item.type,
          manufacturer: item.manufacturer,
          model: item.model,
          serial_number: item.serial_number,
          capacity: item.capacity || null,
          unit: item.unit,
          location: item.location,
          manufacturing_date: item.manufacturing_date,
          acquisition_date: item.acquisition_date,
          expiry_date: item.expiry_date || null,
          certificate_expiry: item.certificate_expiry || null,
          observations: item.observations || null,
        });
      } catch (error) {
        errors.push(`${item.internal_code}: ${(error as Error).message}`);
      }
      
      setImportProgress(prev => ({ ...prev, current: i + 1, errors }));
    }

    setStep('done');
  };

  const handleClose = () => {
    setStep('upload');
    setImportResult(null);
    setSelectedCategory('');
    setImportProgress({ current: 0, total: 0, errors: [] });
    if (fileInputRef.current) fileInputRef.current.value = '';
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {t('importEquipment.title')}
          </DialogTitle>
          <DialogDescription>
            {t('importEquipment.description')}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">{t('importEquipment.clickToSelect')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('importEquipment.acceptedFormats')}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">{t('importEquipment.downloadTemplate')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('importEquipment.useTemplateDesc')}
                </p>
              </div>
              <Button variant="outline" onClick={generateTemplate} className="gap-2">
                <Download className="h-4 w-4" />
                {t('importEquipment.downloadBtn')}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && importResult?.data && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-status-success/10 border border-status-success/30 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-status-success" />
              <div>
                <p className="font-medium">{importResult.data.length} {t('importEquipment.equipmentFound')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('importEquipment.readyToImport')}
                </p>
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="p-4 bg-status-warning/10 border border-status-warning/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-status-warning" />
                  <p className="font-medium text-status-warning">{t('importEquipment.warnings')}</p>
                </div>
                <ScrollArea className="max-h-32">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-sm text-muted-foreground">{err}</p>
                  ))}
                </ScrollArea>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('importEquipment.categoryForAll')}</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder={t('importEquipment.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-48 border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">{t('importEquipment.code')}</th>
                    <th className="p-2 text-left">{t('importEquipment.name')}</th>
                    <th className="p-2 text-left">{t('importEquipment.manufacturer')}</th>
                    <th className="p-2 text-left">{t('importEquipment.location')}</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.data.slice(0, 10).map((item, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="p-2 font-mono">{item.internal_code}</td>
                      <td className="p-2">{item.name}</td>
                      <td className="p-2">{item.manufacturer}</td>
                      <td className="p-2">{item.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importResult.data.length > 10 && (
                <p className="p-2 text-sm text-muted-foreground text-center">
                  {t('importEquipment.andMore', { count: importResult.data.length - 10 })}
                </p>
              )}
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>{t('importEquipment.cancel')}</Button>
              <Button onClick={handleImport} disabled={!selectedCategory}>
                {t('importEquipment.importEquipments', { count: importResult.data.length })}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="font-medium">{t('importEquipment.importing')}</p>
              <p className="text-sm text-muted-foreground">
                {importProgress.current} {t('importEquipment.ofTotal')} {importProgress.total}
              </p>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center">
              <CheckCircle2 className="h-12 w-12 text-status-success mb-4" />
              <p className="font-medium text-lg">{t('importEquipment.importComplete')}</p>
              <p className="text-muted-foreground">
                {importProgress.current - importProgress.errors.length} {t('importEquipment.importedSuccessfully')}
              </p>
            </div>

            {importProgress.errors.length > 0 && (
              <div className="p-4 bg-status-danger/10 border border-status-danger/30 rounded-lg">
                <p className="font-medium text-status-danger mb-2">
                  {importProgress.errors.length} {t('importEquipment.errorsOnImport')}
                </p>
                <ScrollArea className="max-h-32">
                  {importProgress.errors.map((err, i) => (
                    <p key={i} className="text-sm">{err}</p>
                  ))}
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={handleClose}>{t('importEquipment.close')}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}