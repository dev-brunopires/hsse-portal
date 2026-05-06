import { useState, useEffect, useRef } from 'react';
import { getLocalToday } from '@/utils/dateFormat';
import confetti from 'canvas-confetti';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useIsMobile, useIsTabletOrMobile } from '@/hooks/use-mobile';
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
import { Input } from '@/components/ui/input';
import { DatePickerField } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  ClipboardCheck, 
  User, 
  Calendar,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Camera,
  ClipboardList,
  FileText,
  ImageIcon,
  Info,
  PenTool,
  WifiOff,
  Zap,
} from 'lucide-react';
import { SignaturePad } from '@/components/inspections/SignaturePad';
import { Equipment } from '@/types/equipment';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTechniciansAndAdmins } from '@/hooks/useProfiles';
import { useCreateInspection } from '@/hooks/useInspections';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSignature } from '@/hooks/useUserSignature';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useDefaultChecklistTemplate } from '@/hooks/useChecklistTemplates';
import { ConnectionStatus } from '@/components/ui/connection-status';
import { supabase } from '@/integrations/supabase/client';

const createInspectionSchema = (t: (key: string) => string) => z.object({
  inspectorId: z.string().min(1, t('inspectionForm.selectInspectorBefore')),
  inspectionDate: z.string().min(1, t('common.required')),
  overallStatus: z.enum(['approved', 'attention', 'rejected']),
  observations: z.string().optional(),
  recommendations: z.string().optional(),
  nextInspectionDate: z.string().optional(),
});

type InspectionFormData = z.infer<ReturnType<typeof createInspectionSchema>>;

interface InspectionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  onSuccess?: () => void;
  carryoverItems?: Array<{ description: string; status: string; notes?: string | null }>;
  carryoverRecommendations?: string | null;
}

interface ChecklistItem {
  id: string;
  description: string;
  status: 'pending' | 'ok' | 'attention' | 'fail';
  notes: string;
  required: boolean;
}

// Default fallback checklist if no template exists
const getDefaultChecklist = (t: (key: string) => string): ChecklistItem[] => {
  return [
    { id: '1', description: t('inspectionForm.defaultChecklist.accessible'), status: 'pending', notes: '', required: true },
    { id: '2', description: t('inspectionForm.defaultChecklist.labelVisible'), status: 'pending', notes: '', required: true },
    { id: '3', description: t('inspectionForm.defaultChecklist.noCorrosion'), status: 'pending', notes: '', required: true },
    { id: '4', description: t('inspectionForm.defaultChecklist.sealIntact'), status: 'pending', notes: '', required: true },
    { id: '5', description: t('inspectionForm.defaultChecklist.validDate'), status: 'pending', notes: '', required: true },
  ];
};

export function InspectionFormDialog({ 
  open, 
  onOpenChange, 
  equipment,
  onSuccess,
  carryoverItems,
  carryoverRecommendations,
}: InspectionFormDialogProps) {
  const { t } = useTranslation();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isTabletOrMobile = useIsTabletOrMobile();
  
  const { data: inspectors = [], isLoading: inspectorsLoading } = useTechniciansAndAdmins();
  const { data: userSignatureSettings } = useUserSignature();
  const { data: defaultTemplate, isLoading: templateLoading } = useDefaultChecklistTemplate(equipment?.categoryId);
  const createInspection = useCreateInspection();
  const { isOnline, addPendingInspection } = useOfflineSync();

  // When offline, pre-fill inspector with logged-in user since the list won't be available
  const isInspectorDisabledOffline = !isOnline && inspectors.length === 0;

  const inspectionSchema = createInspectionSchema(t);
  
  const form = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      inspectorId: '',
      inspectionDate: getLocalToday(),
      overallStatus: 'approved',
      observations: '',
      recommendations: '',
      nextInspectionDate: '',
    },
  });

  // Load checklist from category template or use default fallback
  useEffect(() => {
    if (open && equipment) {
      // Build base checklist from template or fallback
      let baseItems: ChecklistItem[] = [];
      if (defaultTemplate?.items && defaultTemplate.items.length > 0) {
        baseItems = defaultTemplate.items.map((item, index) => ({
          id: item.id || `item-${index}`,
          description: item.description,
          status: 'pending',
          notes: '',
          required: item.is_required ?? true,
        }));
      } else if (!templateLoading) {
        baseItems = getDefaultChecklist(t);
      }

      // Append carryover items from previous pending inspection
      if (carryoverItems && carryoverItems.length > 0) {
        const existingDescs = new Set(baseItems.map(i => i.description.trim().toLowerCase()));
        carryoverItems.forEach((c, idx) => {
          const desc = `[${t('inspectionCalendar.carryoverItems', 'Pendência da última inspeção')}] ${c.description}`;
          if (!existingDescs.has(desc.trim().toLowerCase())) {
            baseItems.push({
              id: `carryover-${idx}`,
              description: desc,
              status: 'pending',
              notes: c.notes || '',
              required: true,
            });
          }
        });
      }
      setChecklist(baseItems);

      form.reset({
        inspectorId: user?.id || '',
        inspectionDate: getLocalToday(),
        overallStatus: 'approved',
        observations: '',
        recommendations: carryoverRecommendations || '',
        nextInspectionDate: '',
      });
      
      // Auto-apply default signature if enabled
      if (userSignatureSettings?.auto_sign_inspections && userSignatureSettings?.default_signature) {
        setSignatureData(userSignatureSettings.default_signature);
      } else {
        setSignatureData(null);
      }
    }
  }, [open, equipment, defaultTemplate, templateLoading, form, user, userSignatureSettings, t, carryoverItems, carryoverRecommendations]);

  const hasTriggeredConfetti = useRef(false);

  const updateChecklistItem = (itemId: string, field: 'status' | 'notes', value: string) => {
    setChecklist(prev => {
      const newChecklist = prev.map(item => 
        item.id === itemId ? { ...item, [field]: value } : item
      );
      
      // Check if all items are now completed and trigger confetti
      if (field === 'status') {
        const completedCount = newChecklist.filter(i => i.status !== 'pending').length;
        const wasComplete = prev.filter(i => i.status !== 'pending').length === prev.length;
        
        if (completedCount === newChecklist.length && !wasComplete && !hasTriggeredConfetti.current) {
          hasTriggeredConfetti.current = true;
          // Trigger confetti celebration
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6']
          });
          // Reset flag after a short delay to allow re-triggering if user unchecks and rechecks
          setTimeout(() => {
            hasTriggeredConfetti.current = false;
          }, 2000);
        } else if (completedCount < newChecklist.length) {
          hasTriggeredConfetti.current = false;
        }
      }
      
      return newChecklist;
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setUploadedPhotos(prev => [...prev, ...Array.from(files)]);
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
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
    if (!equipment) return;
    
    const pendingItems = checklist.filter(item => item.status === 'pending' && item.required);
    if (pendingItems.length > 0) {
      toast({
        title: t('inspectionForm.incompleteChecklist'),
        description: t('inspectionForm.pendingRequiredItems', { count: pendingItems.length }),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // If offline, save locally
      if (!isOnline) {
        addPendingInspection({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          equipment_code: equipment.internalCode,
          status: calculateOverallStatus(),
          observations: data.observations || null,
          recommendations: data.recommendations || null,
          checklist_items: checklist.map(item => ({
            description: item.description,
            status: item.status,
            notes: item.notes,
          })),
          signature_data: signatureData,
          inspector_id: data.inspectorId,
          ship_id: null, // Will be set from equipment when syncing
        });
        
        toast({
          title: t('inspectionForm.inspectionSavedOffline'),
          description: t('inspectionForm.willSyncWhenOnline'),
        });
        
        onOpenChange(false);
        form.reset();
        setChecklist([]);
        setUploadedPhotos([]);
        setSignatureData(null);
        onSuccess?.();
        return;
      }

      // Online mode - save directly
      await createInspection.mutateAsync({
        inspection: {
          equipment_id: equipment.id,
          inspector_id: data.inspectorId,
          inspection_date: data.inspectionDate,
          status: calculateOverallStatus(),
          observations: data.observations || null,
          recommendations: data.recommendations || null,
          next_inspection_date: data.nextInspectionDate || null,
          signature_data: signatureData,
          signed_at: signatureData ? new Date().toISOString() : null,
        },
        checklistItems: checklist.map(item => ({
          description: item.description,
          status: item.status,
          notes: item.notes,
        })),
        photos: uploadedPhotos,
      });
      
      onOpenChange(false);
      form.reset();
      setChecklist([]);
      setUploadedPhotos([]);
      setSignatureData(null);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating inspection:', error);
      
      // If online request fails, offer to save offline
      toast({
        title: t('inspectionForm.errorSaving'),
        description: t('inspectionForm.saveLocallyQuestion'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick inspection - mark all as OK and submit as compliant
  const handleQuickInspection = async () => {
    if (!equipment) return;

    const formData = form.getValues();
    if (!formData.inspectorId) {
      toast({
        title: t('inspectionForm.inspectorRequired'),
        description: t('inspectionForm.selectInspectorBefore'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Mark all checklist items as OK
      const quickChecklist = checklist.map(item => ({
        description: item.description,
        status: 'ok' as const,
        notes: '',
      }));

      if (!isOnline) {
        addPendingInspection({
          equipment_id: equipment.id,
          equipment_name: equipment.name,
          equipment_code: equipment.internalCode,
          status: 'compliant',
          observations: t('inspectionForm.quickInspection'),
          recommendations: null,
          checklist_items: quickChecklist,
          signature_data: signatureData,
          inspector_id: formData.inspectorId,
          ship_id: null,
        });

        toast({
          title: t('inspectionForm.inspectionSavedOffline'),
          description: t('inspectionForm.willSyncWhenOnline'),
        });
      } else {
        await createInspection.mutateAsync({
          inspection: {
            equipment_id: equipment.id,
            inspector_id: formData.inspectorId,
            inspection_date: formData.inspectionDate || getLocalToday(),
            status: 'compliant',
            observations: t('inspectionForm.quickInspection'),
            recommendations: null,
            next_inspection_date: formData.nextInspectionDate || null,
            signature_data: signatureData,
            signed_at: signatureData ? new Date().toISOString() : null,
          },
          checklistItems: quickChecklist,
          photos: [],
        });

        toast({
          title: t('inspectionForm.inspectionRegistered'),
          description: t('inspectionForm.markedAsCompliant', { code: equipment.internalCode }),
        });
      }

      onOpenChange(false);
      form.reset();
      setChecklist([]);
      setUploadedPhotos([]);
      setSignatureData(null);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating quick inspection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusCounts = getStatusCounts();

  if (!equipment) return null;

  const headerContent = (
    <>
      <div className="flex items-center gap-2 text-xl font-semibold">
        <ClipboardCheck className="h-5 w-5 text-primary" />
        {t('inspectionForm.registerInspection')}
        <ConnectionStatus isOnline={isOnline} className="ml-2" />
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          <strong className="text-foreground">{equipment.internalCode}</strong> - {equipment.name}
        </span>
        <span className="text-xs px-2 py-1 bg-muted rounded">
          {equipment.categoryName}
        </span>
      </div>
    </>
  );

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col min-h-0">
        <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden min-h-0 w-full">
          <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
            <TabsTrigger value="info" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspectionForm.info')}</span>
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspectionForm.checklist')}</span>
              {statusCounts.pending > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {statusCounts.pending}
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
              {uploadedPhotos.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {uploadedPhotos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="signature" className="flex items-center gap-1 px-1 sm:px-3 sm:gap-2">
              <PenTool className="h-4 w-4" />
              <span className="hidden sm:inline">{t('inspectionForm.sign')}</span>
              {signatureData && (
                <CheckCircle2 className="h-4 w-4 text-status-success" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab: Dados Gerais */}
          <TabsContent value="info" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-6 pb-4 px-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="inspectorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {t('inspectionForm.responsibleInspector')} *
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={inspectorsLoading || isInspectorDisabledOffline}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={
                              isInspectorDisabledOffline 
                                ? (inspectors.length === 0 ? t('inspectionForm.offlineInspector') : t('inspectionForm.selectInspector'))
                                : inspectorsLoading ? t('common.loading') : t('inspectionForm.selectInspector')
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border border-border shadow-lg z-50">
                          {/* When offline with no inspectors list, show current user */}
                          {isInspectorDisabledOffline && user ? (
                            <SelectItem key={user.id} value={user.id}>
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                  <WifiOff className="h-3 w-3" />
                                </div>
                                <span>{t('inspectionForm.currentUser')}</span>
                              </div>
                            </SelectItem>
                          ) : (
                            inspectors.map((inspector) => (
                              <SelectItem key={inspector.user_id} value={inspector.user_id}>
                                <div className="flex items-center gap-2">
                                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                    {inspector.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                  </div>
                                  <span>{inspector.full_name}</span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inspectionDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {t('inspectionForm.inspectionDate')} *
                      </FormLabel>
                      <FormControl>
                        <DatePickerField
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={t('inspectionForm.selectDate')}
                          fromYear={new Date().getFullYear() - 5}
                          toYear={new Date().getFullYear() + 1}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="nextInspectionDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col max-w-xs">
                    <FormLabel>{t('inspectionForm.nextScheduledInspection')}</FormLabel>
                    <FormControl>
                      <DatePickerField
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={t('inspectionForm.selectDate')}
                        fromYear={new Date().getFullYear()}
                        toYear={new Date().getFullYear() + 10}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Overall Status Summary */}
              <div className={cn(
                'p-4 rounded-lg border',
                calculateOverallStatus() === 'compliant' && 'border-status-success bg-status-success/10',
                calculateOverallStatus() === 'attention' && 'border-status-warning bg-status-warning/10',
                calculateOverallStatus() === 'non-compliant' && 'border-status-danger bg-status-danger/10',
              )}>
                <div className="flex items-center gap-3">
                  {calculateOverallStatus() === 'compliant' && (
                    <CheckCircle2 className="h-6 w-6 text-status-success" />
                  )}
                  {calculateOverallStatus() === 'attention' && (
                    <AlertTriangle className="h-6 w-6 text-status-warning" />
                  )}
                  {calculateOverallStatus() === 'non-compliant' && (
                    <XCircle className="h-6 w-6 text-status-danger" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {t('inspectionForm.overallStatus')}: {' '}
                      {calculateOverallStatus() === 'compliant' && t('inspectionForm.compliant')}
                      {calculateOverallStatus() === 'attention' && t('inspectionForm.attentionNeeded')}
                      {calculateOverallStatus() === 'non-compliant' && t('inspectionForm.nonCompliant')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {statusCounts.ok} {t('inspectionForm.conforming')} • {statusCounts.attention} {t('inspectionForm.withAttention')} • {statusCounts.fail} {t('inspectionForm.nonConforming')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Checklist */}
          <TabsContent value="checklist" className="flex-1 overflow-y-auto overflow-x-hidden mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1 max-w-full">
              <div className="flex flex-col gap-2 sticky top-0 bg-card py-2 z-10">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t('inspectionForm.verificationItems')}</h3>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-status-success" />
                      {statusCounts.ok}
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4 text-status-warning" />
                      {statusCounts.attention}
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-status-danger" />
                      {statusCounts.fail}
                    </span>
                  </div>
                </div>
                {/* Progress indicator */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${checklist.length > 0 ? ((checklist.filter(i => i.status !== 'pending').length / checklist.length) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {checklist.filter(i => i.status !== 'pending').length}/{checklist.length} {t('inspectionForm.itemsCompleted')}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {checklist.map((item, index) => (
                  <div 
                    key={item.id}
                    className={cn(
                      'p-4 rounded-lg border transition-colors',
                      item.status === 'ok' && 'border-status-success/30 bg-status-success/5',
                      item.status === 'attention' && 'border-status-warning/30 bg-status-warning/5',
                      item.status === 'fail' && 'border-status-danger/30 bg-status-danger/5',
                      item.status === 'pending' && 'border-border bg-card',
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm flex items-center gap-2">
                            {item.description}
                            {item.required ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
                                {t('inspectionForm.requiredBadge')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                                {t('inspectionForm.optionalBadge')}
                              </span>
                            )}
                          </p>
                        </div>

                        <RadioGroup
                          value={item.status}
                          onValueChange={(value) => updateChecklistItem(item.id, 'status', value)}
                          className="flex flex-wrap items-center gap-2 sm:gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="ok" id={`${item.id}-ok`} />
                            <Label 
                              htmlFor={`${item.id}-ok`}
                              className="flex items-center gap-1 text-sm cursor-pointer text-status-success"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {t('inspectionForm.conform')}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="attention" id={`${item.id}-attention`} />
                            <Label 
                              htmlFor={`${item.id}-attention`}
                              className="flex items-center gap-1 text-sm cursor-pointer text-status-warning"
                            >
                              <AlertTriangle className="h-4 w-4" />
                              {t('inspectionForm.attention')}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="fail" id={`${item.id}-fail`} />
                            <Label 
                              htmlFor={`${item.id}-fail`}
                              className="flex items-center gap-1 text-sm cursor-pointer text-status-danger"
                            >
                              <XCircle className="h-4 w-4" />
                              {t('inspectionForm.notConform')}
                            </Label>
                          </div>
                        </RadioGroup>

                        {(item.status === 'attention' || item.status === 'fail') && (
                          <Input
                            placeholder={t('inspectionForm.describeProblem')}
                            value={item.notes}
                            onChange={(e) => updateChecklistItem(item.id, 'notes', e.target.value)}
                            className="text-sm"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab: Observações */}
          <TabsContent value="observations" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-6 pb-4 px-1">
              <FormField
                control={form.control}
                name="observations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('inspectionForm.generalObservations')}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={t('inspectionForm.observationsPlaceholder')}
                        rows={6}
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
                    <FormLabel>{t('inspectionForm.recommendationsActions')}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={t('inspectionForm.necessaryActions')}
                        rows={6}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          {/* Tab: Fotos */}
          <TabsContent value="photos" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium text-sm">{t('inspectionForm.addPhotos')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('inspectionForm.clickOrDragImages')}
                  </p>
                </label>
              </div>

              {uploadedPhotos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {uploadedPhotos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`${t('inspectionForm.evidence')} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('inspectionForm.noPhotosAdded')}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Assinatura */}
          <TabsContent value="signature" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              <p className="text-sm text-muted-foreground text-center">
                {t('inspectionForm.signBelow')}
              </p>
              
              <SignaturePad
                onSave={(data) => {
                  setSignatureData(data);
                  toast({
                    title: t('inspectionForm.signatureCaptured'),
                    description: t('inspectionForm.signatureRegistered'),
                  });
                }}
                initialSignature={signatureData || undefined}
              />
              
              {signatureData && (
                <div className="p-4 rounded-lg border border-status-success bg-status-success/10">
                  <div className="flex items-center gap-2 text-status-success">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">{t('inspectionForm.signatureConfirmed')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('inspectionForm.signatureAttached')}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-border flex-shrink-0 space-y-3">
          <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            {t('inspectionForm.cancel')}
          </Button>
          
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            {/* Quick Inspection Button */}
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={handleQuickInspection}
              className="gap-2 bg-status-success/10 border-status-success/30 text-status-success hover:bg-status-success/20 hover:text-status-success flex-1"
            >
              <Zap className="h-4 w-4" />
              {t('inspectionForm.conform')}
            </Button>

            <Button type="submit" disabled={isSubmitting} className="gap-2 flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">{t('inspectionForm.registering')}</span>
                </>
              ) : !isOnline ? (
                <>
                  <WifiOff className="h-4 w-4" />
                  {t('inspectionForm.saveOffline')}
                </>
              ) : (
                <>
                  <ClipboardCheck className="h-4 w-4" />
                  {t('inspectionForm.finalizeInspection')}
                </>
              )}
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
        <DrawerContent className="max-h-[95vh] flex flex-col">
          <DrawerHeader className="pb-2 border-b border-border flex-shrink-0">
            <DrawerTitle>{headerContent}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col bg-card border border-border">
        <DialogHeader className="pb-4 border-b border-border flex-shrink-0">
          <DialogTitle>{headerContent}</DialogTitle>
          <DialogDescription className="sr-only">{t('inspection.form')}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          {formContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}
