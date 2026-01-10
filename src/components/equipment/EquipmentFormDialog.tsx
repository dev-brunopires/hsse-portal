import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
  Form,
  FormControl,
  FormDescription,
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  Building2, 
  Calendar, 
  FileText, 
  Upload,
  X,
  Image as ImageIcon,
  File,
  CheckCircle2,
  Loader2,
  Ship,
  Download,
  Eye,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useCreateEquipment, useUpdateEquipment } from '@/hooks/useEquipment';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { uploadEquipmentDocument, getSignedUrl } from '@/hooks/useStorage';
import { useShips } from '@/hooks/useShips';
import { useUserShips } from '@/hooks/useUserShips';
import { DatePickerField } from '@/components/ui/date-picker';
import { useEquipmentDocuments, useDeleteDocument, type EquipmentDocument } from '@/hooks/useEquipmentDocuments';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';

const createEquipmentSchema = (t: (key: string) => string) => z.object({
  // Dados Gerais
  internalCode: z.string().min(1, t('equipmentForm.internalCodeRequired')),
  name: z.string().min(2, t('equipmentForm.nameMinChars')),
  categoryId: z.string().min(1, t('equipmentForm.categoryRequired')),
  type: z.string().min(1, t('equipmentForm.typeRequired')),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().min(1, t('equipmentForm.serialNumberRequired')),
  capacity: z.string().optional(),
  // Localização
  shipId: z.string().min(1, t('equipmentForm.shipRequired')),
  location: z.string().min(1, t('equipmentForm.locationRequired')),
  // Datas
  manufacturingDate: z.string().optional(),
  acquisitionDate: z.string().optional(),
  expiryDate: z.string().optional(),
  certificateExpiry: z.string().optional(),
  // Observações
  observations: z.string().optional(),
});

type EquipmentFormData = z.infer<ReturnType<typeof createEquipmentSchema>>;

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialData?: Partial<EquipmentFormData> & { id?: string; capacity?: string; shipId?: string };
  onSuccess?: () => void;
}


export function EquipmentFormDialog({ 
  open, 
  onOpenChange, 
  mode,
  initialData,
  onSuccess,
}: EquipmentFormDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('general');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, role, isAdmin } = useAuth();
  
  const equipmentSchema = createEquipmentSchema(t);
  
  // Fetch existing documents for edit mode
  const { data: existingDocuments = [], isLoading: documentsLoading } = useEquipmentDocuments(
    mode === 'edit' ? initialData?.id : undefined
  );
  const deleteDocument = useDeleteDocument();
  
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: allShips = [], isLoading: shipsLoading } = useShips();
  const { data: userShips = [], isLoading: userShipsLoading } = useUserShips(user?.id);
  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();

  // Technician/Supervisor: lock to default ship (first ship assigned to the user)
  // Admin and Admin Master should NEVER have locked ships
  const isShipLocked = !isAdmin && (role === 'technician' || role === 'supervisor');
  const defaultUserShip = userShips.find((us) => us.ship)?.ship ?? null;

  // Determine which ships to show based on user role
  // Admins and admin_master see all ships
  const availableShips = useMemo(
    () =>
      isAdmin
        ? allShips
        : (userShips
            .map((us) => us.ship)
            .filter(Boolean) as Array<{ id: string; name: string; code: string | null }>),
    [isAdmin, allShips, userShips]
  );
  
  const isLoadingShips = shipsLoading || userShipsLoading;

  // Debug log (dev only)
  if (import.meta.env.DEV) {
    console.log('[EquipmentFormDialog] Debug:', {
      role,
      isAdmin,
      isShipLocked,
      defaultUserShip,
      userShipsCount: userShips.length,
      availableShipsCount: availableShips.length,
    });
  }

  const form = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      internalCode: initialData?.internalCode || '',
      name: initialData?.name || '',
      categoryId: initialData?.categoryId || '',
      type: initialData?.type || '',
      manufacturer: initialData?.manufacturer || '',
      model: initialData?.model || '',
      serialNumber: initialData?.serialNumber || '',
      capacity: initialData?.capacity || '',
      shipId: initialData?.shipId || '',
      location: initialData?.location || '',
      manufacturingDate: initialData?.manufacturingDate || '',
      acquisitionDate: initialData?.acquisitionDate || '',
      expiryDate: initialData?.expiryDate || '',
      certificateExpiry: initialData?.certificateExpiry || '',
      observations: initialData?.observations || '',
    },
  });

  // Ensure shipId is always set for locked-ship users (technician/supervisor)
  useEffect(() => {
    if (!open) return;

    if (isShipLocked) {
      const lockedShipId = defaultUserShip?.id;
      if (lockedShipId && form.getValues('shipId') !== lockedShipId) {
        form.setValue('shipId', lockedShipId, { shouldValidate: true });
      }
    }
  }, [open, isShipLocked, defaultUserShip?.id, form]);

  const initRef = useRef<{ opened: boolean; key: string | null }>({ opened: false, key: null });

  useEffect(() => {
    if (!open) {
      initRef.current = { opened: false, key: null };
      return;
    }

    // Only initialize/reset the form once per dialog open (or when switching item in edit)
    const key = mode === 'edit' ? `edit:${initialData?.id ?? 'none'}` : 'create';
    if (initRef.current.opened && initRef.current.key === key) return;

    initRef.current = { opened: true, key };

    if (mode === 'edit' && initialData) {
      form.reset({
        internalCode: initialData.internalCode || '',
        name: initialData.name || '',
        categoryId: initialData.categoryId || '',
        type: initialData.type || '',
        manufacturer: initialData.manufacturer || '',
        model: initialData.model || '',
        serialNumber: initialData.serialNumber || '',
        capacity: initialData.capacity || '',
        shipId: initialData.shipId || '',
        location: initialData.location || '',
        manufacturingDate: initialData.manufacturingDate || '',
        acquisitionDate: initialData.acquisitionDate || '',
        expiryDate: initialData.expiryDate || '',
        certificateExpiry: initialData.certificateExpiry || '',
        observations: initialData.observations || '',
      });
      return;
    }

    // Create mode
    // Default ship behavior:
    // - Technician/Supervisor: lock to the account default ship
    // - Others (non-admin): auto-select only if they have a single ship
    let defaultShipId = '';
    if (isShipLocked) {
      defaultShipId = defaultUserShip?.id || '';
    } else if (!isAdmin && availableShips.length === 1) {
      defaultShipId = availableShips[0].id;
    }

    form.reset({
      internalCode: '',
      name: '',
      categoryId: '',
      type: '',
      manufacturer: '',
      model: '',
      serialNumber: '',
      capacity: '',
      shipId: defaultShipId,
      location: '',
      manufacturingDate: '',
      acquisitionDate: '',
      expiryDate: '',
      certificateExpiry: '',
      observations: '',
    });
  }, [
    open,
    mode,
    initialData?.id,
    isShipLocked,
    defaultUserShip?.id,
    isAdmin,
    availableShips.length,
    form,
  ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setUploadedFiles(prev => [...prev, ...Array.from(files)]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleViewExistingDoc = async (doc: EquipmentDocument) => {
    try {
      const { data } = await supabase.storage
        .from('equipment-documents')
        .createSignedUrl(doc.file_path, 3600);
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      toast({
        title: t('equipmentForm.errorOpenDocument'),
        description: t('equipmentForm.cannotOpenDocument'),
        variant: 'destructive',
      });
    }
  };

  const handleDownloadExistingDoc = async (doc: EquipmentDocument) => {
    try {
      const { data } = await supabase.storage
        .from('equipment-documents')
        .createSignedUrl(doc.file_path, 3600);
      
      if (data?.signedUrl) {
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({
        title: t('equipmentForm.errorDownloadDocument'),
        description: t('equipmentForm.cannotDownloadDocument'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteExistingDoc = async (doc: EquipmentDocument) => {
    if (!initialData?.id) return;
    
    setDeletingDocId(doc.id);
    try {
      await deleteDocument.mutateAsync({
        id: doc.id,
        filePath: doc.file_path,
        equipmentId: initialData.id,
      });
    } finally {
      setDeletingDocId(null);
    }
  };

  const onSubmit = async (data: EquipmentFormData) => {
    setIsSubmitting(true);
    
    try {
      // Get the ship name from the selected ship
      const selectedShip =
        availableShips.find((s) => s.id === data.shipId) ||
        (defaultUserShip && defaultUserShip.id === data.shipId ? defaultUserShip : null);

      const unitName = selectedShip?.name || '';

      const equipmentData = {
        internal_code: data.internalCode,
        name: data.name,
        category_id: data.categoryId,
        type: data.type,
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        serial_number: data.serialNumber,
        capacity: data.capacity || null,
        ship_id: data.shipId,
        unit: unitName, // Keep unit for backwards compatibility
        location: data.location,
        manufacturing_date: data.manufacturingDate || null,
        acquisition_date: data.acquisitionDate || null,
        expiry_date: data.expiryDate || null,
        certificate_expiry: data.certificateExpiry || null,
        observations: data.observations || null,
        created_by: user?.id,
      };

      let equipmentId: string;

      if (mode === 'create') {
        const result = await createEquipment.mutateAsync(equipmentData);
        equipmentId = result.id;
      } else if (initialData?.id) {
        await updateEquipment.mutateAsync({ id: initialData.id, ...equipmentData });
        equipmentId = initialData.id;
      } else {
        throw new Error(t('equipmentForm.equipmentIdNotFound'));
      }

      // Upload documents
      if (uploadedFiles.length > 0 && user) {
        for (const file of uploadedFiles) {
          await uploadEquipmentDocument(equipmentId, file, user.id);
        }
      }

      onOpenChange(false);
      form.reset();
      setUploadedFiles([]);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error saving equipment:', error);
      toast({
        title: t('equipmentForm.errorSaving'),
        description: error?.message || t('equipmentForm.checkPermissionsAndShip'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabFields: Record<'general' | 'location' | 'dates' | 'documents', Array<keyof EquipmentFormData>> = {
    general: ['internalCode', 'name', 'categoryId', 'type', 'manufacturer', 'model', 'serialNumber'],
    location: ['shipId', 'location'],
    dates: ['manufacturingDate', 'acquisitionDate'],
    documents: [],
  };

  const onInvalid = (errors: FieldErrors<EquipmentFormData>) => {
    const hasErrors = (fields: Array<keyof EquipmentFormData>) =>
      fields.some((f) => !!(errors as any)[f]);

    if (hasErrors(tabFields.general)) setActiveTab('general');
    else if (hasErrors(tabFields.location)) setActiveTab('location');
    else if (hasErrors(tabFields.dates)) setActiveTab('dates');

    toast({
      title: t('equipmentForm.requiredFields'),
      description: t('equipmentForm.requiredFieldsMessage'),
      variant: 'destructive',
    });
  };

  const tabProgress = {
    general: form.watch('name') && form.watch('categoryId') && form.watch('internalCode'),
    location: form.watch('shipId') && form.watch('location'),
    dates: form.watch('manufacturingDate') || form.watch('acquisitionDate') || form.watch('expiryDate') || form.watch('certificateExpiry'),
    documents: true,
  };

  const headerContent = (
    <>
      <div className="flex items-center gap-2 text-xl font-semibold">
        <Package className="h-5 w-5 text-primary" />
        {mode === 'create' ? t('equipmentForm.newEquipment') : t('equipmentForm.editEquipment')}
      </div>
      <p className="text-sm text-muted-foreground">
        {t('equipmentForm.fillEquipmentInfo')}
      </p>
    </>
  );

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex-1 overflow-hidden flex flex-col min-h-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="general" className="gap-2 relative">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('equipmentForm.general')}</span>
                  {tabProgress.general && (
                    <CheckCircle2 className="h-3 w-3 text-status-success absolute -top-1 -right-1" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="location" className="gap-2 relative">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('equipmentForm.location')}</span>
                  {tabProgress.location && (
                    <CheckCircle2 className="h-3 w-3 text-status-success absolute -top-1 -right-1" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="dates" className="gap-2 relative">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('equipmentForm.dates')}</span>
                  {tabProgress.dates && (
                    <CheckCircle2 className="h-3 w-3 text-status-success absolute -top-1 -right-1" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-2 relative">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('equipmentForm.documents')}</span>
                  {(uploadedFiles.length > 0 || existingDocuments.length > 0) && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                      {uploadedFiles.length + existingDocuments.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto px-1 pb-2">
                {/* General Tab */}
                <TabsContent value="general" className="space-y-4 mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <FormField
                      control={form.control}
                      name="internalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipmentForm.internalCode')} *</FormLabel>
                          <FormControl>
                            <Input placeholder={t('equipmentForm.internalCodePlaceholder')} {...field} />
                          </FormControl>
                          <FormDescription>
                            {t('equipmentForm.internalCodeDescription')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipmentForm.category')} *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={categoriesLoading}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={categoriesLoading ? t('equipmentForm.loading') : t('equipmentForm.selectCategory')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-popover border border-border shadow-lg z-50">
                              {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('equipmentForm.equipmentName')} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t('equipmentForm.equipmentNamePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipmentForm.type')} *</FormLabel>
                          <FormControl>
                            <Input placeholder={t('equipmentForm.typePlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="serialNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipmentForm.serialNumber')} *</FormLabel>
                          <FormControl>
                            <Input placeholder={t('equipmentForm.serialNumberPlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <FormField
                      control={form.control}
                      name="manufacturer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipmentForm.manufacturer')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('equipmentForm.manufacturerPlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipmentForm.model')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('equipmentForm.modelPlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('equipmentForm.capacity')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('equipmentForm.capacityPlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* Location Tab */}
                <TabsContent value="location" className="space-y-4 mt-0">
                  <FormField
                    control={form.control}
                    name="shipId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('equipmentForm.shipFpso')} *</FormLabel>
                        {isShipLocked ? (
                          // Technician/Supervisor: show locked ship badge instead of dropdown
                          isLoadingShips ? (
                            <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-muted/50">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              <span className="text-muted-foreground">{t('equipmentForm.loadingShip')}</span>
                            </div>
                          ) : !defaultUserShip ? (
                            <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-destructive/10">
                              <Ship className="h-4 w-4 text-destructive" />
                              <span className="text-destructive">{t('equipmentForm.noShipLinked')}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-muted/50">
                              <Ship className="h-4 w-4 text-primary" />
                              <span className="font-medium">{defaultUserShip.name}</span>
                              {defaultUserShip.code && (
                                <span className="text-muted-foreground text-sm">({defaultUserShip.code})</span>
                              )}
                            </div>
                          )
                        ) : (
                          // Admin/Admin Master: show dropdown to select ship
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value} 
                            disabled={isLoadingShips || availableShips.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={isLoadingShips ? t('equipmentForm.loading') : t('equipmentForm.selectShip')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-popover border border-border shadow-lg z-50">
                              {availableShips.length === 0 ? (
                                <SelectItem value="__no_ships__" disabled>
                                  {t('equipmentForm.noShipRegistered')}
                                </SelectItem>
                              ) : (
                                availableShips.map((ship) => (
                                  <SelectItem key={ship.id} value={ship.id}>
                                    {ship.name} {ship.code ? `(${ship.code})` : ''}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        )}
                        {isShipLocked && (
                          <FormDescription>
                            {t('equipmentForm.defaultShip')}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('equipmentForm.physicalLocation')} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t('equipmentForm.physicalLocationPlaceholder')} {...field} />
                        </FormControl>
                        <FormDescription>
                          {t('equipmentForm.locationDescription')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="observations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('equipmentForm.observations')}</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={t('equipmentForm.observationsPlaceholder')}
                            rows={4}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* Dates Tab */}
                <TabsContent value="dates" className="space-y-4 mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <FormField
                      control={form.control}
                      name="manufacturingDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('equipmentForm.manufacturingDate')}</FormLabel>
                          <FormControl>
                            <DatePickerField
                              value={field.value}
                              onChange={field.onChange}
                              placeholder={t('equipmentForm.selectDate')}
                              fromYear={1950}
                              toYear={new Date().getFullYear()}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="acquisitionDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('equipmentForm.acquisitionDate')}</FormLabel>
                          <FormControl>
                            <DatePickerField
                              value={field.value}
                              onChange={field.onChange}
                              placeholder={t('equipmentForm.selectDate')}
                              fromYear={1990}
                              toYear={new Date().getFullYear() + 1}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <FormField
                      control={form.control}
                      name="expiryDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('equipmentForm.expiryDate')}</FormLabel>
                          <FormControl>
                            <DatePickerField
                              value={field.value}
                              onChange={field.onChange}
                              placeholder={t('equipmentForm.selectDate')}
                              fromYear={new Date().getFullYear()}
                              toYear={new Date().getFullYear() + 30}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('equipmentForm.expiryDateDescription')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="certificateExpiry"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('equipmentForm.certificateExpiry')}</FormLabel>
                          <FormControl>
                            <DatePickerField
                              value={field.value}
                              onChange={field.onChange}
                              placeholder={t('equipmentForm.selectDate')}
                              fromYear={new Date().getFullYear()}
                              toYear={new Date().getFullYear() + 30}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('equipmentForm.certificateExpiryDescription')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <h4 className="font-medium text-sm mb-2">Informações Importantes</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• A data de validade determina quando o equipamento precisa ser substituído</li>
                      <li>• A validade do certificado indica quando a recertificação é necessária</li>
                      <li>• Alertas serão gerados automaticamente antes do vencimento</li>
                    </ul>
                  </div>
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="space-y-4 mt-0">
                  {/* Collapsible Recommendations - at the top */}
                  <Collapsible open={showRecommendations} onOpenChange={setShowRecommendations}>
                    <CollapsibleTrigger asChild>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        className="w-full justify-between p-3 bg-primary/5 rounded-lg border border-primary/20 hover:bg-primary/10"
                      >
                        <span className="font-medium text-sm text-primary">Documentos Recomendados</span>
                        {showRecommendations ? (
                          <ChevronUp className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-primary" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 border-t-0 rounded-t-none -mt-2">
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Certificado de conformidade do fabricante</li>
                          <li>• Nota fiscal de aquisição</li>
                          <li>• Laudo de inspeção inicial</li>
                          <li>• Manual do equipamento</li>
                          <li>• Fotos do equipamento instalado</li>
                        </ul>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Upload area */}
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="font-medium text-foreground text-sm">
                        {t('equipmentForm.clickOrDragFiles')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('equipmentForm.filesAccepted')}
                      </p>
                    </label>
                  </div>

                  {/* Existing documents (edit mode) */}
                  {mode === 'edit' && existingDocuments.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {t('equipmentForm.existingDocuments')} ({existingDocuments.length})
                      </h4>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {existingDocuments.map((doc) => (
                          <div 
                            key={doc.id}
                            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border"
                          >
                            {doc.file_type.startsWith('image/') ? (
                              <ImageIcon className="h-5 w-5 text-primary flex-shrink-0" />
                            ) : (
                              <File className="h-5 w-5 text-primary flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{doc.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'Tamanho desconhecido'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleViewExistingDoc(doc)}
                                title="Visualizar"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDownloadExistingDoc(doc)}
                                title="Baixar"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteExistingDoc(doc)}
                                disabled={deletingDocId === doc.id}
                                title="Excluir"
                              >
                                {deletingDocId === doc.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Loading state for documents */}
                  {mode === 'edit' && documentsLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">{t('equipmentForm.loading')}</span>
                    </div>
                  )}

                  {/* New files to upload */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        {t('equipmentForm.addNewDocuments')} ({uploadedFiles.length})
                      </h4>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto">
                        {uploadedFiles.map((file, index) => (
                          <div 
                            key={index}
                            className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20"
                          >
                            {file.type.startsWith('image/') ? (
                              <ImageIcon className="h-5 w-5 text-primary flex-shrink-0" />
                            ) : (
                              <File className="h-5 w-5 text-primary flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / 1024).toFixed(1)} KB - <span className="text-primary">Novo</span>
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 mt-4 border-t border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                {activeTab !== 'general' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const tabs = ['general', 'location', 'dates', 'documents'];
                      const currentIndex = tabs.indexOf(activeTab);
                      if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
                    }}
                  >
                    {t('common.previous')}
                  </Button>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t('equipmentForm.cancel')}
                </Button>
                
                {activeTab !== 'documents' ? (
                  <Button
                    type="button"
                    onClick={async () => {
                      const tabs = ['general', 'location', 'dates', 'documents'] as const;
                      const currentIndex = tabs.indexOf(activeTab as (typeof tabs)[number]);
                      const currentTab = tabs[currentIndex] ?? 'general';

                      const ok = await form.trigger(tabFields[currentTab]);
                      if (!ok) {
                        toast({
                          title: t('equipmentForm.requiredFields'),
                          description: t('equipmentForm.requiredFieldsMessage'),
                          variant: 'destructive',
                        });
                        return;
                      }

                      if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1]);
                    }}
                  >
                    {t('common.next')}
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting} className="gap-2">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('equipmentForm.saving')}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        {t('equipmentForm.save')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
  );

  if (isMobile) {
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
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden flex flex-col bg-card border border-border" hideCloseButton>
        <DialogHeader className="pb-4 border-b border-border flex-shrink-0">
          <DialogTitle>{headerContent}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden min-h-0">
          {formContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}
