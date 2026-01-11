import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { DatePickerField } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ClipboardCheck, 
  Loader2,
  Save,
  Info,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  PenTool,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateInspection, type InspectionWithDetails, type InspectionChecklistItem, type InspectionPhoto } from '@/hooks/useInspections';
import { supabase } from '@/integrations/supabase/client';

type EditInspectionFormData = {
  status: 'compliant' | 'attention' | 'non-compliant';
  inspection_date: string;
  next_inspection_date?: string;
  observations?: string;
  recommendations?: string;
  actions_taken?: string;
};

interface EditInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspection: InspectionWithDetails | null;
  onSuccess?: () => void;
}

export function EditInspectionDialog({ 
  open, 
  onOpenChange, 
  inspection,
  onSuccess,
}: EditInspectionDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const updateInspection = useUpdateInspection();
  
  const [checklistItems, setChecklistItems] = useState<InspectionChecklistItem[]>([]);
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const editInspectionSchema = z.object({
    status: z.enum(['compliant', 'attention', 'non-compliant']),
    inspection_date: z.string().min(1, t('validation.required')),
    next_inspection_date: z.string().optional(),
    observations: z.string().optional(),
    recommendations: z.string().optional(),
    actions_taken: z.string().optional(),
  });

  const statusOptions = [
    { value: 'compliant', label: t('editInspection.statusCompliant'), icon: CheckCircle2, color: 'text-status-success' },
    { value: 'attention', label: t('editInspection.statusAttention'), icon: AlertTriangle, color: 'text-status-warning' },
    { value: 'non-compliant', label: t('editInspection.statusNonCompliant'), icon: XCircle, color: 'text-status-danger' },
  ];

  const checklistStatusLabels: Record<string, { label: string; color: string }> = {
    ok: { label: t('inspections.checklistOk'), color: 'text-status-success bg-status-success/10' },
    fail: { label: t('inspections.checklistFail'), color: 'text-status-danger bg-status-danger/10' },
    attention: { label: t('inspections.checklistAttention'), color: 'text-status-warning bg-status-warning/10' },
  };

  const form = useForm<EditInspectionFormData>({
    resolver: zodResolver(editInspectionSchema),
    defaultValues: {
      status: 'compliant',
      inspection_date: '',
      next_inspection_date: '',
      observations: '',
      recommendations: '',
      actions_taken: '',
    },
  });

  useEffect(() => {
    if (open && inspection) {
      form.reset({
        status: inspection.status as 'compliant' | 'attention' | 'non-compliant',
        inspection_date: inspection.inspection_date,
        next_inspection_date: inspection.next_inspection_date || '',
        observations: inspection.observations || '',
        recommendations: inspection.recommendations || '',
        actions_taken: inspection.actions_taken || '',
      });
      fetchDetails();
    }
  }, [open, inspection, form]);

  const fetchDetails = async () => {
    if (!inspection?.id) return;
    
    setLoading(true);
    try {
      const { data: items } = await supabase
        .from('inspection_checklist_items')
        .select('*')
        .eq('inspection_id', inspection.id)
        .order('created_at', { ascending: true });
      
      setChecklistItems(items || []);

      const { data: photoData } = await supabase
        .from('inspection_photos')
        .select('*')
        .eq('inspection_id', inspection.id);
      
      setPhotos(photoData || []);

      if (photoData && photoData.length > 0) {
        const urls: Record<string, string> = {};
        for (const photo of photoData) {
          const { data } = await supabase.storage
            .from('inspection-photos')
            .createSignedUrl(photo.file_path, 3600);
          if (data?.signedUrl) {
            urls[photo.id] = data.signedUrl;
          }
        }
        setPhotoUrls(urls);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: EditInspectionFormData) => {
    if (!inspection) return;
    
    try {
      await updateInspection.mutateAsync({
        id: inspection.id,
        inspection: {
          status: data.status,
          inspection_date: data.inspection_date,
          next_inspection_date: data.next_inspection_date || null,
          observations: data.observations || null,
          recommendations: data.recommendations || null,
          actions_taken: data.actions_taken || null,
        },
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error updating inspection:', error);
    }
  };

  if (!inspection) return null;

  const headerContent = (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/10">
        <ClipboardCheck className="h-5 w-5 text-primary" />
      </div>
      <div>
        <div className="text-lg font-semibold">{t('editInspection.title')}</div>
        <div className="text-sm text-muted-foreground">
          {inspection.equipment?.internal_code} - {inspection.equipment?.name}
        </div>
      </div>
    </div>
  );

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col min-h-0">
        <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden min-h-0">
          <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
            <TabsTrigger value="info" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspectionForm.info')}</span>
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspectionForm.checklist')}</span>
              {checklistItems.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {checklistItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="observations" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspectionForm.observationsTab')}</span>
            </TabsTrigger>
            <TabsTrigger value="photos" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspectionForm.photos')}</span>
              {photos.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {photos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="signature" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
              <PenTool className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspectionForm.sign')}</span>
              {inspection.signature_data && (
                <CheckCircle2 className="h-4 w-4 text-status-success" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Info */}
          <TabsContent value="info" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('editInspection.status')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('editInspection.select')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border border-border shadow-lg z-50">
                        {statusOptions.map((option) => {
                          const Icon = option.icon;
                          return (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <Icon className={cn("h-4 w-4", option.color)} />
                                {option.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="inspection_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {t('editInspection.date')} *
                      </FormLabel>
                      <FormControl>
                        <DatePickerField
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={t('editInspection.select')}
                          fromYear={new Date().getFullYear() - 5}
                          toYear={new Date().getFullYear() + 1}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="next_inspection_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {t('editInspection.next')}
                      </FormLabel>
                      <FormControl>
                        <DatePickerField
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={t('editInspection.select')}
                          fromYear={new Date().getFullYear()}
                          toYear={new Date().getFullYear() + 5}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab: Checklist (read-only) */}
          <TabsContent value="checklist" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              <p className="text-sm text-muted-foreground mb-4">{t('editInspection.checklistReadOnly')}</p>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : checklistItems.length > 0 ? (
                <div className="space-y-2">
                  {checklistItems.map((item) => {
                    const statusConf = checklistStatusLabels[item.status] || checklistStatusLabels.attention;
                    return (
                      <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                        <span className={cn('text-xs font-medium px-2 py-1 rounded shrink-0', statusConf.color)}>
                          {statusConf.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{item.description}</p>
                          {item.notes && <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">{t('inspections.noChecklistItems')}</p>
              )}
            </div>
          </TabsContent>

          {/* Tab: Observations */}
          <TabsContent value="observations" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              <FormField
                control={form.control}
                name="actions_taken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-status-success" />
                      {t('editInspection.actionsTaken')}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('editInspection.actionsTakenPlaceholder')}
                        className="min-h-[80px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      {t('editInspection.observations')}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('editInspection.observationsPlaceholder')}
                        className="min-h-[80px] resize-none"
                        {...field}
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
                    <FormLabel className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      {t('editInspection.recommendations')}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('editInspection.recommendationsPlaceholder')}
                        className="min-h-[80px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          {/* Tab: Photos (read-only) */}
          <TabsContent value="photos" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : photos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      {photoUrls[photo.id] ? (
                        <img src={photoUrls[photo.id]} alt={photo.file_name} className="w-full h-32 object-cover rounded-lg border border-border" />
                      ) : (
                        <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 truncate">{photo.file_name}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mb-2" />
                  <p>{t('inspections.noPhotos')}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Signature (read-only) */}
          <TabsContent value="signature" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              {inspection.signature_data ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-status-success">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">{t('inspectionForm.inspectionSigned')}</span>
                  </div>
                  <div className="border border-border rounded-lg p-4 bg-white">
                    <img 
                      src={inspection.signature_data} 
                      alt={t('inspectionForm.inspectorSignature')} 
                      className="max-w-full h-auto max-h-32 mx-auto"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <PenTool className="h-12 w-12 mb-2" />
                  <p>{t('inspectionForm.notSigned')}</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('editInspection.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={updateInspection.isPending}
            className="gap-2"
          >
            {updateInspection.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t('editInspection.saveChanges')}
          </Button>
        </div>
      </form>
    </Form>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="pb-4 border-b border-border">
            <DrawerTitle className="sr-only">{t('editInspection.title')}</DrawerTitle>
            {headerContent}
          </DrawerHeader>
          <div className="flex-1 overflow-hidden flex flex-col px-4 pb-4 min-h-0">
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-card border border-border" hideCloseButton>
        <DialogHeader className="pb-4 border-b border-border pr-0">
          <DialogTitle className="sr-only">{t('editInspection.title')}</DialogTitle>
          {headerContent}
        </DialogHeader>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {formContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}
