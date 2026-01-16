import { useState, useRef, useMemo } from 'react';
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
  Ship,
  FolderOpen,
  AlertTriangle
} from 'lucide-react';
import { parseCSV, generateTemplate, type ImportResult, type ImportedEquipment } from '@/utils/importEquipment';
import { useCategories } from '@/hooks/useCategories';
import { useShips } from '@/hooks/useShips';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ImportEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportEquipmentDialog({ open, onOpenChange }: ImportEquipmentDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  const [defaultShipId, setDefaultShipId] = useState<string>('');
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, errors: [] as string[] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: categories = [] } = useCategories();
  const { data: ships = [] } = useShips();
  const createEquipment = useCreateEquipment();
  const { toast } = useToast();

  // Create lookup maps for category and ship matching
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(cat => {
      map.set(cat.name.toLowerCase().trim(), cat.id);
    });
    return map;
  }, [categories]);

  const shipMap = useMemo(() => {
    const map = new Map<string, string>();
    ships.forEach(ship => {
      map.set(ship.name.toLowerCase().trim(), ship.id);
      if (ship.code) {
        map.set(ship.code.toLowerCase().trim(), ship.id);
      }
    });
    return map;
  }, [ships]);

  // Analyze imported data for category/ship matching
  const analysisResult = useMemo(() => {
    if (!importResult?.data) return null;

    const withCategory: ImportedEquipment[] = [];
    const withoutCategory: ImportedEquipment[] = [];
    const withShip: ImportedEquipment[] = [];
    const withoutShip: ImportedEquipment[] = [];
    const unmatchedCategories = new Set<string>();
    const unmatchedShips = new Set<string>();

    importResult.data.forEach(item => {
      // Check category
      if (item.category_name) {
        const categoryId = categoryMap.get(item.category_name.toLowerCase().trim());
        if (categoryId) {
          withCategory.push(item);
        } else {
          withoutCategory.push(item);
          unmatchedCategories.add(item.category_name);
        }
      } else {
        withoutCategory.push(item);
      }

      // Check ship
      if (item.ship_name) {
        const shipId = shipMap.get(item.ship_name.toLowerCase().trim());
        if (shipId) {
          withShip.push(item);
        } else {
          withoutShip.push(item);
          unmatchedShips.add(item.ship_name);
        }
      } else {
        withoutShip.push(item);
      }
    });

    return {
      withCategory: withCategory.length,
      withoutCategory: withoutCategory.length,
      withShip: withShip.length,
      withoutShip: withoutShip.length,
      unmatchedCategories: Array.from(unmatchedCategories),
      unmatchedShips: Array.from(unmatchedShips),
    };
  }, [importResult?.data, categoryMap, shipMap]);

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
    if (!importResult?.data) return;

    // Validate that we have defaults when needed
    if (analysisResult && analysisResult.withoutCategory > 0 && !defaultCategoryId) {
      toast({
        title: t('importEquipment.selectDefaultCategory'),
        variant: 'destructive',
      });
      return;
    }

    if (analysisResult && analysisResult.withoutShip > 0 && !defaultShipId) {
      toast({
        title: t('importEquipment.selectDefaultShip'),
        variant: 'destructive',
      });
      return;
    }

    setStep('importing');
    setImportProgress({ current: 0, total: importResult.data.length, errors: [] });

    const errors: string[] = [];

    for (let i = 0; i < importResult.data.length; i++) {
      const item = importResult.data[i];
      
      try {
        // Resolve category ID
        let categoryId = defaultCategoryId;
        if (item.category_name) {
          const matchedCategoryId = categoryMap.get(item.category_name.toLowerCase().trim());
          if (matchedCategoryId) {
            categoryId = matchedCategoryId;
          }
        }

        // Resolve ship ID
        let shipId = defaultShipId;
        if (item.ship_name) {
          const matchedShipId = shipMap.get(item.ship_name.toLowerCase().trim());
          if (matchedShipId) {
            shipId = matchedShipId;
          }
        }

        if (!categoryId) {
          throw new Error(t('importEquipment.noCategoryMatch'));
        }

        if (!shipId) {
          throw new Error(t('importEquipment.noShipMatch'));
        }

        await createEquipment.mutateAsync({
          internal_code: item.internal_code,
          name: item.name,
          category_id: categoryId,
          ship_id: shipId,
          type: item.type,
          manufacturer: item.manufacturer || null,
          model: item.model || null,
          serial_number: item.serial_number,
          capacity: item.capacity || null,
          unit: item.unit,
          location: item.location,
          status: item.status || 'active',
          manufacturing_date: item.manufacturing_date || null,
          acquisition_date: item.acquisition_date || null,
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
    setDefaultCategoryId('');
    setDefaultShipId('');
    setImportProgress({ current: 0, total: 0, errors: [] });
    if (fileInputRef.current) fileInputRef.current.value = '';
    onOpenChange(false);
  };

  const needsDefaultCategory = analysisResult && analysisResult.withoutCategory > 0;
  const needsDefaultShip = analysisResult && analysisResult.withoutShip > 0;
  const canImport = (!needsDefaultCategory || defaultCategoryId) && (!needsDefaultShip || defaultShipId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {t('importEquipment.title')}
          </DialogTitle>
          <DialogDescription>
            {t('importEquipment.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
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

              {/* Help section */}
              <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                <p className="font-medium text-sm">{t('importEquipment.supportedColumns')}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span>• {t('importEquipment.columns.internalCode')}</span>
                  <span>• {t('importEquipment.columns.name')}</span>
                  <span>• {t('importEquipment.columns.category')}</span>
                  <span>• {t('importEquipment.columns.ship')}</span>
                  <span>• {t('importEquipment.columns.type')}</span>
                  <span>• {t('importEquipment.columns.manufacturer')}</span>
                  <span>• {t('importEquipment.columns.model')}</span>
                  <span>• {t('importEquipment.columns.serialNumber')}</span>
                  <span>• {t('importEquipment.columns.capacity')}</span>
                  <span>• {t('importEquipment.columns.unit')}</span>
                  <span>• {t('importEquipment.columns.location')}</span>
                  <span>• {t('importEquipment.columns.status')}</span>
                  <span>• {t('importEquipment.columns.manufacturingDate')}</span>
                  <span>• {t('importEquipment.columns.acquisitionDate')}</span>
                  <span>• {t('importEquipment.columns.expiryDate')}</span>
                  <span>• {t('importEquipment.columns.certificateExpiry')}</span>
                  <span>• {t('importEquipment.columns.observations')}</span>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && importResult?.data && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-status-success/10 border border-status-success/30 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-status-success flex-shrink-0" />
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
                  <ScrollArea className="max-h-24">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-sm text-muted-foreground">{err}</p>
                    ))}
                  </ScrollArea>
                </div>
              )}

              {/* Analysis results */}
              {analysisResult && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Category matching */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{t('importEquipment.categoryMatching')}</span>
                    </div>
                    <div className="flex gap-2">
                      {analysisResult.withCategory > 0 && (
                        <Badge variant="outline" className="bg-status-success/10 text-status-success border-status-success/30">
                          {analysisResult.withCategory} {t('importEquipment.matched')}
                        </Badge>
                      )}
                      {analysisResult.withoutCategory > 0 && (
                        <Badge variant="outline" className="bg-status-warning/10 text-status-warning border-status-warning/30">
                          {analysisResult.withoutCategory} {t('importEquipment.needsDefault')}
                        </Badge>
                      )}
                    </div>
                    {analysisResult.unmatchedCategories.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">{t('importEquipment.notFound')}:</span>{' '}
                        {analysisResult.unmatchedCategories.join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Ship matching */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Ship className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{t('importEquipment.shipMatching')}</span>
                    </div>
                    <div className="flex gap-2">
                      {analysisResult.withShip > 0 && (
                        <Badge variant="outline" className="bg-status-success/10 text-status-success border-status-success/30">
                          {analysisResult.withShip} {t('importEquipment.matched')}
                        </Badge>
                      )}
                      {analysisResult.withoutShip > 0 && (
                        <Badge variant="outline" className="bg-status-warning/10 text-status-warning border-status-warning/30">
                          {analysisResult.withoutShip} {t('importEquipment.needsDefault')}
                        </Badge>
                      )}
                    </div>
                    {analysisResult.unmatchedShips.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">{t('importEquipment.notFound')}:</span>{' '}
                        {analysisResult.unmatchedShips.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Default selectors */}
              <div className="grid grid-cols-2 gap-4">
                {needsDefaultCategory && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-status-warning" />
                      {t('importEquipment.defaultCategory')}
                    </label>
                    <Select value={defaultCategoryId} onValueChange={setDefaultCategoryId}>
                      <SelectTrigger className={cn(!defaultCategoryId && 'border-status-warning')}>
                        <SelectValue placeholder={t('importEquipment.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t('importEquipment.defaultCategoryHelp', { count: analysisResult?.withoutCategory || 0 })}
                    </p>
                  </div>
                )}

                {needsDefaultShip && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-status-warning" />
                      {t('importEquipment.defaultShip')}
                    </label>
                    <Select value={defaultShipId} onValueChange={setDefaultShipId}>
                      <SelectTrigger className={cn(!defaultShipId && 'border-status-warning')}>
                        <SelectValue placeholder={t('importEquipment.selectShip')} />
                      </SelectTrigger>
                      <SelectContent>
                        {ships.map(ship => (
                          <SelectItem key={ship.id} value={ship.id}>{ship.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t('importEquipment.defaultShipHelp', { count: analysisResult?.withoutShip || 0 })}
                    </p>
                  </div>
                )}
              </div>

              {/* Preview table */}
              <ScrollArea className="h-48 border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">{t('importEquipment.code')}</th>
                      <th className="p-2 text-left">{t('importEquipment.name')}</th>
                      <th className="p-2 text-left">{t('equipment.category')}</th>
                      <th className="p-2 text-left">{t('equipment.ship')}</th>
                      <th className="p-2 text-left">{t('importEquipment.location')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.data.slice(0, 10).map((item, i) => {
                      const hasCategoryMatch = item.category_name && categoryMap.get(item.category_name.toLowerCase().trim());
                      const hasShipMatch = item.ship_name && shipMap.get(item.ship_name.toLowerCase().trim());
                      
                      return (
                        <tr key={i} className="border-b border-border">
                          <td className="p-2 font-mono text-xs">{item.internal_code}</td>
                          <td className="p-2">{item.name}</td>
                          <td className="p-2">
                            {item.category_name ? (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs",
                                  hasCategoryMatch 
                                    ? "bg-status-success/10 text-status-success" 
                                    : "bg-status-warning/10 text-status-warning"
                                )}
                              >
                                {item.category_name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">
                                {t('importEquipment.useDefault')}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            {item.ship_name ? (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs",
                                  hasShipMatch 
                                    ? "bg-status-success/10 text-status-success" 
                                    : "bg-status-warning/10 text-status-warning"
                                )}
                              >
                                {item.ship_name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">
                                {t('importEquipment.useDefault')}
                              </span>
                            )}
                          </td>
                          <td className="p-2">{item.location}</td>
                        </tr>
                      );
                    })}
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
                <Button onClick={handleImport} disabled={!canImport}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
