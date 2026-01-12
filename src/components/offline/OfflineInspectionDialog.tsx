import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ClipboardCheck, 
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ClipboardList,
  FileText,
  WifiOff,
  Zap,
  Package,
  Camera,
} from 'lucide-react';
import { SignaturePad } from '@/components/inspections/SignaturePad';
import { useIsTabletOrMobile } from '@/hooks/use-mobile';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { OfflinePhotoCapture } from './OfflinePhotoCapture';
import { type PendingPhoto, removePhotosByInspection } from '@/utils/offlineStorage';

interface CachedEquipment {
  id: string;
  name: string;
  internal_code: string;
  status: string;
  category_id: string;
  ship_id: string | null;
  location: string;
  serial_number: string;
}

interface CachedCategory {
  id: string;
  name: string;
  description: string | null;
  inspection_frequency: string;
}

interface CachedTemplate {
  id: string;
  name: string;
  category_id: string;
  checklist_template_items: Array<{
    id: string;
    description: string;
    is_required: boolean;
    order_index: number;
  }>;
}

interface ChecklistItem {
  id: string;
  description: string;
  status: 'pending' | 'ok' | 'attention' | 'fail';
  notes: string;
  required: boolean;
}

interface OfflineInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: CachedEquipment;
  categories: CachedCategory[];
  templates: CachedTemplate[];
  onSuccess?: () => void;
}

const createInspectionSchema = (t: (key: string) => string) => z.object({
  overallStatus: z.enum(['approved', 'attention', 'rejected']),
  observations: z.string().optional(),
  recommendations: z.string().optional(),
});

type InspectionFormData = z.infer<ReturnType<typeof createInspectionSchema>>;

// Default fallback checklist
const getDefaultChecklist = (t: (key: string) => string): ChecklistItem[] => {
  return [
    { id: '1', description: t('inspectionForm.defaultChecklist.accessible'), status: 'pending', notes: '', required: true },
    { id: '2', description: t('inspectionForm.defaultChecklist.labelVisible'), status: 'pending', notes: '', required: true },
    { id: '3', description: t('inspectionForm.defaultChecklist.noCorrosion'), status: 'pending', notes: '', required: true },
    { id: '4', description: t('inspectionForm.defaultChecklist.sealIntact'), status: 'pending', notes: '', required: true },
    { id: '5', description: t('inspectionForm.defaultChecklist.validDate'), status: 'pending', notes: '', required: true },
  ];
};

export function OfflineInspectionDialog({ 
  open, 
  onOpenChange, 
  equipment,
  categories,
  templates,
  onSuccess,
}: OfflineInspectionDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isTabletOrMobile = useIsTabletOrMobile();
  const { addPendingInspection } = useOfflineSync();
  
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [offlinePhotos, setOfflinePhotos] = useState<PendingPhoto[]>([]);
  
  // Generate a stable inspection ID for photos before submission
  const [pendingInspectionId] = useState(() => crypto.randomUUID());

  const inspectionSchema = createInspectionSchema(t);
  
  const form = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      overallStatus: 'approved',
      observations: '',
      recommendations: '',
    },
  });

  // Get category name
  const categoryName = useMemo(() => {
    return categories.find(c => c.id === equipment.category_id)?.name || '-';
  }, [categories, equipment.category_id]);

  // Load checklist from template
  useEffect(() => {
    if (open) {
      // Find template for equipment category
      const template = templates.find(t => t.category_id === equipment.category_id);
      
      if (template?.checklist_template_items && template.checklist_template_items.length > 0) {
        const templateItems: ChecklistItem[] = template.checklist_template_items
          .sort((a, b) => a.order_index - b.order_index)
          .map((item, index) => ({
            id: item.id || `item-${index}`,
            description: item.description,
            status: 'pending',
            notes: '',
            required: item.is_required ?? true,
          }));
        setChecklist(templateItems);
      } else {
        setChecklist(getDefaultChecklist(t));
      }
      
      form.reset({
        overallStatus: 'approved',
        observations: '',
        recommendations: '',
      });
      setSignatureData(null);
      setOfflinePhotos([]);
    }
  }, [open, equipment, templates, form, t]);

  const updateChecklistItem = (itemId: string, field: 'status' | 'notes', value: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const getStatusCounts = () => {
    const counts = { ok: 0, attention: 0, fail: 0, pending: 0 };
    checklist.forEach(item => {
      counts[item.status]++;
    });
    return counts;
  };

  const calculateOverallStatus = (): 'compliant' | 'attention' | 'non-compliant' => {
    const counts = getStatusCounts();
    if (counts.fail > 0) return 'non-compliant';
    if (counts.attention > 0) return 'attention';
    if (counts.pending > 0) return 'attention';
    return 'compliant';
  };

  const onSubmit = async (data: InspectionFormData) => {
    const pendingItems = checklist.filter(item => item.status === 'pending' && item.required);
    if (pendingItems.length > 0) {
      toast.error(t('inspectionForm.incompleteChecklist'), {
        description: t('inspectionForm.pendingRequiredItems', { count: pendingItems.length }),
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      addPendingInspection({
        id: pendingInspectionId, // Use the same ID as photos for association
        equipment_id: equipment.id,
        equipment_name: equipment.name,
        equipment_code: equipment.internal_code,
        status: calculateOverallStatus(),
        observations: data.observations || null,
        recommendations: data.recommendations || null,
        checklist_items: checklist.map(item => ({
          description: item.description,
          status: item.status,
          notes: item.notes,
        })),
        signature_data: signatureData,
        inspector_id: user?.id || '',
        ship_id: equipment.ship_id,
        photos: offlinePhotos.map(p => p.id),
      });
      
      toast.success(t('inspectionForm.inspectionSavedOffline'), {
        description: t('inspectionForm.willSyncWhenOnline'),
      });
      
      onOpenChange(false);
      form.reset();
      setChecklist([]);
      setSignatureData(null);
      setOfflinePhotos([]);
      onSuccess?.();
    } catch (error) {
      console.error('Error saving offline inspection:', error);
      toast.error(t('inspectionForm.errorSaving'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick inspection - mark all as OK
  const handleQuickInspection = async () => {
    setIsSubmitting(true);

    try {
      const quickChecklist = checklist.map(item => ({
        description: item.description,
        status: 'ok' as const,
        notes: '',
      }));

      addPendingInspection({
        id: pendingInspectionId, // Use the same ID as photos for association
        equipment_id: equipment.id,
        equipment_name: equipment.name,
        equipment_code: equipment.internal_code,
        status: 'compliant',
        observations: t('inspectionForm.quickInspection'),
        recommendations: null,
        checklist_items: quickChecklist,
        signature_data: signatureData,
        inspector_id: user?.id || '',
        ship_id: equipment.ship_id,
        photos: offlinePhotos.map(p => p.id),
      });

      toast.success(t('inspectionForm.inspectionSavedOffline'), {
        description: t('inspectionForm.willSyncWhenOnline'),
      });

      onOpenChange(false);
      form.reset();
      setChecklist([]);
      setSignatureData(null);
      setOfflinePhotos([]);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating quick inspection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusCounts = getStatusCounts();
  const completedCount = checklist.length - statusCounts.pending;
  const progressPercent = checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0;

  const headerContent = (
    <>
      <div className="flex items-center gap-2 text-xl font-semibold">
        <ClipboardCheck className="h-5 w-5 text-primary" />
        {t('offline.offlineInspection')}
        <Badge variant="outline" className="ml-2 gap-1 bg-status-warning/10 text-status-warning border-status-warning/30">
          <WifiOff className="h-3 w-3" />
          {t('inspectionForm.offline')}
        </Badge>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Package className="h-4 w-4" />
        <span className="font-medium text-foreground">{equipment.internal_code}</span>
        <span>-</span>
        <span>{equipment.name}</span>
        <Badge variant="secondary" className="text-xs ml-2">
          {categoryName}
        </Badge>
      </div>
    </>
  );

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col min-h-0">
        <Tabs defaultValue="checklist" className="flex-1 flex flex-col overflow-hidden min-h-0">
          <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
            <TabsTrigger value="checklist" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspectionForm.checklist')}</span>
              {statusCounts.pending > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {statusCounts.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="photos" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspectionForm.photos')}</span>
              {offlinePhotos.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {offlinePhotos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="observations" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspectionForm.observationsTab')}</span>
            </TabsTrigger>
            <TabsTrigger value="signature" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspectionForm.sign')}</span>
              {signatureData && (
                <CheckCircle2 className="h-4 w-4 text-status-success" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Checklist */}
          <TabsContent value="checklist" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('inspectionForm.checklistProgress')}</span>
                  <span className="font-medium">{completedCount}/{checklist.length}</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-status-success" />
                    {statusCounts.ok} {t('inspectionForm.ok')}
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-status-warning" />
                    {statusCounts.attention} {t('inspectionForm.attentionStatus')}
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-status-danger" />
                    {statusCounts.fail} {t('inspectionForm.fail')}
                  </span>
                </div>
              </div>

              {/* Checklist items */}
              <div className="space-y-3">
                {checklist.map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg bg-card space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{item.description}</span>
                          {item.required && (
                            <Badge variant="outline" className="text-xs bg-status-danger/10 text-status-danger border-status-danger/30">
                              {t('inspectionForm.required')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <RadioGroup
                      value={item.status}
                      onValueChange={(value) => updateChecklistItem(item.id, 'status', value)}
                      className="flex flex-wrap gap-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="ok" id={`${item.id}-ok`} />
                        <Label htmlFor={`${item.id}-ok`} className="flex items-center gap-1 text-sm cursor-pointer">
                          <CheckCircle2 className="h-4 w-4 text-status-success" />
                          {t('inspectionForm.ok')}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="attention" id={`${item.id}-attention`} />
                        <Label htmlFor={`${item.id}-attention`} className="flex items-center gap-1 text-sm cursor-pointer">
                          <AlertTriangle className="h-4 w-4 text-status-warning" />
                          {t('inspectionForm.attentionStatus')}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fail" id={`${item.id}-fail`} />
                        <Label htmlFor={`${item.id}-fail`} className="flex items-center gap-1 text-sm cursor-pointer">
                          <XCircle className="h-4 w-4 text-status-danger" />
                          {t('inspectionForm.fail')}
                        </Label>
                      </div>
                    </RadioGroup>
                    {(item.status === 'attention' || item.status === 'fail') && (
                      <Textarea
                        placeholder={t('inspectionForm.addNotesForItem')}
                        value={item.notes}
                        onChange={(e) => updateChecklistItem(item.id, 'notes', e.target.value)}
                        className="min-h-[60px] text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab: Photos */}
          <TabsContent value="photos" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              <p className="text-sm text-muted-foreground">
                {t('offline.photosInstructions')}
              </p>
              <OfflinePhotoCapture
                inspectionId={pendingInspectionId}
                photos={offlinePhotos}
                onPhotosChange={setOfflinePhotos}
                maxPhotos={5}
                disabled={isSubmitting}
              />
            </div>
          </TabsContent>

          {/* Tab: Observations */}
          <TabsContent value="observations" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-6 pb-4 px-1">
              <FormField
                control={form.control}
                name="observations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('inspectionForm.observations')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t('inspectionForm.observationsPlaceholder')}
                        className="min-h-[120px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="recommendations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('inspectionForm.recommendations')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t('inspectionForm.recommendationsPlaceholder')}
                        className="min-h-[120px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          {/* Tab: Signature */}
          <TabsContent value="signature" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              <p className="text-sm text-muted-foreground">
                {t('inspectionForm.signatureInstructions')}
              </p>
              <SignaturePad
                onSave={setSignatureData}
                initialSignature={signatureData || undefined}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t mt-4 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleQuickInspection}
            disabled={isSubmitting}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            {t('inspectionForm.launchAsCompliant')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('inspectionForm.saveOffline')}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );

  // Use drawer for both mobile and tablet for better touch experience
  if (isTabletOrMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="flex-shrink-0">
            <DrawerTitle className="flex flex-col gap-1">
              {headerContent}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden px-4 pb-4">
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            {headerContent}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {formContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}
