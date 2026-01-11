import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useIsMobile, useIsTabletOrMobile } from '@/hooks/use-mobile';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  Camera,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateInspection, type InspectionWithDetails, type InspectionChecklistItem, type InspectionPhoto } from '@/hooks/useInspections';
import { useUpdateChecklistItems, useAddInspectionPhoto, useDeleteInspectionPhoto, useUpdateInspectionSignature } from '@/hooks/useInspectionEdit';
import { supabase } from '@/integrations/supabase/client';
import { SignaturePad } from './SignaturePad';

type EditInspectionFormData = {
  status: 'compliant' | 'attention' | 'non-compliant';
  inspection_date: string;
  next_inspection_date?: string;
  observations?: string;
  recommendations?: string;
  actions_taken?: string;
};

interface EditableChecklistItem extends InspectionChecklistItem {
  isModified?: boolean;
}

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
  const isTabletOrMobile = useIsTabletOrMobile();
  const updateInspection = useUpdateInspection();
  const updateChecklistItems = useUpdateChecklistItems();
  const addPhoto = useAddInspectionPhoto();
  const deletePhoto = useDeleteInspectionPhoto();
  const updateSignature = useUpdateInspectionSignature();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [checklistItems, setChecklistItems] = useState<EditableChecklistItem[]>([]);
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);
  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState<string | null>(null);

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

  const checklistStatusOptions = [
    { value: 'ok', label: t('inspections.checklistOk'), icon: CheckCircle2, color: 'text-status-success' },
    { value: 'attention', label: t('inspections.checklistAttention'), icon: AlertTriangle, color: 'text-status-warning' },
    { value: 'fail', label: t('inspections.checklistFail'), icon: XCircle, color: 'text-status-danger' },
  ];

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
      setCurrentSignature(inspection.signature_data || null);
      setIsEditingSignature(false);
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
      
      setChecklistItems((items || []).map(item => ({ ...item, isModified: false })));

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

  const updateChecklistItem = (itemId: string, field: 'status' | 'notes', value: string) => {
    setChecklistItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, [field]: value, isModified: true } 
          : item
      )
    );
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !inspection?.id) return;

    setIsUploadingPhoto(true);
    try {
      for (const file of Array.from(files)) {
        const result = await addPhoto.mutateAsync({
          inspectionId: inspection.id,
          file,
        });
        
        if (result) {
          setPhotos(prev => [...prev, result]);
          if (result.signedUrl) {
            setPhotoUrls(prev => ({ ...prev, [result.id]: result.signedUrl }));
          }
        }
      }
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = async (photo: InspectionPhoto) => {
    setIsDeletingPhoto(photo.id);
    try {
      await deletePhoto.mutateAsync({
        id: photo.id,
        filePath: photo.file_path,
      });
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      setPhotoUrls(prev => {
        const newUrls = { ...prev };
        delete newUrls[photo.id];
        return newUrls;
      });
    } finally {
      setIsDeletingPhoto(null);
    }
  };

  const handleSignatureSave = async (signatureData: string) => {
    if (!inspection?.id) return;
    
    try {
      await updateSignature.mutateAsync({
        inspectionId: inspection.id,
        signatureData,
      });
      setCurrentSignature(signatureData);
      setIsEditingSignature(false);
    } catch (error) {
      console.error('Error updating signature:', error);
    }
  };

  const onSubmit = async (data: EditInspectionFormData) => {
    if (!inspection) return;
    
    try {
      // Update inspection data
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

      // Update modified checklist items
      const modifiedItems = checklistItems.filter(item => item.isModified);
      if (modifiedItems.length > 0) {
        await updateChecklistItems.mutateAsync(
          modifiedItems.map(item => ({
            id: item.id,
            status: item.status,
            notes: item.notes,
          }))
        );
      }
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error updating inspection:', error);
    }
  };

  if (!inspection) return null;

  const getStatusCounts = () => {
    const counts = { ok: 0, attention: 0, fail: 0 };
    checklistItems.forEach(item => {
      if (item.status === 'ok') counts.ok++;
      else if (item.status === 'attention') counts.attention++;
      else if (item.status === 'fail') counts.fail++;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();
  const completedCount = checklistItems.filter(i => i.status !== 'pending').length;
  const progressPercentage = checklistItems.length > 0 
    ? Math.round((completedCount / checklistItems.length) * 100) 
    : 0;

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

          {/* Tab: Checklist (editable) */}
          <TabsContent value="checklist" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              {/* Progress bar */}
              {checklistItems.length > 0 && (
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-border">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{t('editInspection.checklistProgress')}</span>
                    <span className="text-muted-foreground">
                      {completedCount}/{checklistItems.length} ({progressPercentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-status-success" /> {statusCounts.ok} OK
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-status-warning" /> {statusCounts.attention} {t('inspections.checklistAttention')}
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-status-danger" /> {statusCounts.fail} {t('inspections.checklistFail')}
                    </span>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : checklistItems.length > 0 ? (
                <div className="space-y-3">
                  {checklistItems.map((item, index) => (
                    <div 
                      key={item.id} 
                      className={cn(
                        "p-4 rounded-lg border transition-all",
                        item.isModified 
                          ? "border-primary/50 bg-primary/5" 
                          : "border-border bg-muted/30"
                      )}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-sm font-medium text-muted-foreground shrink-0">
                          #{index + 1}
                        </span>
                        <p className="font-medium flex-1">{item.description}</p>
                      </div>
                      
                      {/* Status selection */}
                      <div className="mb-3">
                        <RadioGroup
                          value={item.status}
                          onValueChange={(value) => updateChecklistItem(item.id, 'status', value)}
                          className="flex flex-wrap gap-2"
                        >
                          {checklistStatusOptions.map((option) => {
                            const Icon = option.icon;
                            return (
                              <div key={option.value} className="flex items-center">
                                <RadioGroupItem
                                  value={option.value}
                                  id={`${item.id}-${option.value}`}
                                  className="peer sr-only"
                                />
                                <Label
                                  htmlFor={`${item.id}-${option.value}`}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer transition-all text-sm",
                                    item.status === option.value
                                      ? option.value === 'ok' 
                                        ? "bg-status-success/20 border-status-success text-status-success"
                                        : option.value === 'attention'
                                          ? "bg-status-warning/20 border-status-warning text-status-warning"
                                          : "bg-status-danger/20 border-status-danger text-status-danger"
                                      : "border-border hover:bg-muted"
                                  )}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                  {option.label}
                                </Label>
                              </div>
                            );
                          })}
                        </RadioGroup>
                      </div>
                      
                      {/* Notes input */}
                      <Input
                        placeholder={t('editInspection.itemNotes')}
                        value={item.notes || ''}
                        onChange={(e) => updateChecklistItem(item.id, 'notes', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">{t('inspections.noChecklistItems')}</p>
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
                        className="min-h-[100px] resize-none"
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
                        className="min-h-[100px] resize-none"
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
                        className="min-h-[100px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          {/* Tab: Photos (editable) */}
          <TabsContent value="photos" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              {/* Upload button */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="gap-2"
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t('editInspection.addPhotos')}
                </Button>
                {isMobile && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute('capture', 'environment');
                        fileInputRef.current.click();
                        fileInputRef.current.removeAttribute('capture');
                      }
                    }}
                    disabled={isUploadingPhoto}
                    className="gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    {t('editInspection.takePhoto')}
                  </Button>
                )}
              </div>

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
                        <img 
                          src={photoUrls[photo.id]} 
                          alt={photo.file_name} 
                          className="w-full h-32 object-cover rounded-lg border border-border" 
                        />
                      ) : (
                        <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 truncate">{photo.file_name}</p>
                      
                      {/* Delete button overlay */}
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo)}
                        disabled={isDeletingPhoto === photo.id}
                        className="absolute top-2 right-2 p-1.5 bg-destructive/90 text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive disabled:opacity-50"
                      >
                        {isDeletingPhoto === photo.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </button>
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

          {/* Tab: Signature (editable) */}
          <TabsContent value="signature" className="flex-1 overflow-y-auto mt-4 min-h-0">
            <div className="space-y-4 pb-4 px-1">
              {isEditingSignature ? (
                <div className="space-y-4">
                  <SignaturePad
                    onSave={handleSignatureSave}
                    onCancel={() => setIsEditingSignature(false)}
                    initialSignature={currentSignature || undefined}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingSignature(false)}
                    className="w-full"
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              ) : currentSignature ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-status-success">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">{t('inspectionForm.inspectionSigned')}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingSignature(true)}
                      className="gap-2"
                    >
                      <PenTool className="h-4 w-4" />
                      {t('editInspection.editSignature')}
                    </Button>
                  </div>
                  <div className="border border-border rounded-lg p-4 bg-white">
                    <img 
                      src={currentSignature} 
                      alt={t('inspectionForm.inspectorSignature')} 
                      className="max-w-full h-auto max-h-32 mx-auto"
                    />
                  </div>
                  {inspection.signed_at && (
                    <p className="text-xs text-muted-foreground text-center">
                      {t('inspectionForm.signedAt')}: {new Date(inspection.signed_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <PenTool className="h-12 w-12 mb-2" />
                  <p className="mb-4">{t('inspectionForm.notSigned')}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingSignature(true)}
                    className="gap-2"
                  >
                    <PenTool className="h-4 w-4" />
                    {t('editInspection.addSignature')}
                  </Button>
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
            disabled={updateInspection.isPending || updateChecklistItems.isPending}
            className="gap-2"
          >
            {(updateInspection.isPending || updateChecklistItems.isPending) ? (
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

  // Use drawer for both mobile and tablet for better touch experience
  if (isTabletOrMobile) {
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
