import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ResponsiveDialog, ResponsiveDialogBody, ResponsiveDialogFooter } from '@/components/ui/responsive-dialog';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DatePickerField } from '@/components/ui/date-picker';
import { Wrench, X, Loader2, Camera } from 'lucide-react';
import { useEquipment } from '@/hooks/useEquipment';
import { useCreateMaintenanceRequest, type MaintenanceType, type MaintenancePriority } from '@/hooks/useMaintenanceRequests';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function MaintenanceRequestDialog({ 
  open, 
  onOpenChange, 
  preSelectedEquipmentId 
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedEquipmentId?: string;
}) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<File[]>([]);
  const { data: equipmentData, isLoading: equipmentLoading } = useEquipment();
  const equipment = equipmentData ?? [];
  const createRequest = useCreateMaintenanceRequest();
  const { user } = useAuth();

  const formSchema = z.object({
    equipment_id: z.string().min(1, t('validation.required')),
    type: z.enum(['preventive', 'corrective']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    title: z.string().min(3, t('validation.minLength', { count: 3 })).max(200),
    description: z.string().min(10, t('validation.minLength', { count: 10 })),
    problem_identified: z.string().optional(),
    work_order: z.string().optional(),
    scheduled_date: z.string().optional(),
    due_date: z.string().optional(),
  });

  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      equipment_id: preSelectedEquipmentId || '',
      type: 'corrective',
      priority: 'medium',
      title: '',
      description: '',
      problem_identified: '',
      work_order: '',
      scheduled_date: '',
      due_date: '',
    },
  });

  const watchType = form.watch('type');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setPhotos(prev => [...prev, ...Array.from(files)]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: FormData) => {
    if (!user?.id) return;

    const selectedEquipment = equipment.find(e => e.id === data.equipment_id);

    await createRequest.mutateAsync({
      request: {
        equipment_id: data.equipment_id,
        ship_id: selectedEquipment?.ship_id || null,
        type: data.type as MaintenanceType,
        priority: data.priority as MaintenancePriority,
        title: data.title,
        description: data.description,
        problem_identified: data.problem_identified || undefined,
        work_order: data.work_order || undefined,
        scheduled_date: data.scheduled_date || undefined,
        due_date: data.due_date || undefined,
        requested_by: user.id,
      },
      photos,
    });

    form.reset();
    setPhotos([]);
    onOpenChange(false);
  };

  const priorityOptions = [
    { value: 'low', label: t('maintenance.priorityLow'), color: 'text-muted-foreground' },
    { value: 'medium', label: t('maintenance.priorityMedium'), color: 'text-blue-600' },
    { value: 'high', label: t('maintenance.priorityHigh'), color: 'text-orange-600' },
    { value: 'critical', label: t('maintenance.priorityCritical'), color: 'text-red-600' },
  ];

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('maintenanceForm.newRequest')}
      description={t('maintenanceForm.fillRequestData')}
      titleIcon={<Wrench className="h-5 w-5 text-primary" />}
      className="max-w-2xl"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <ResponsiveDialogBody className="space-y-4">
            {/* Type and Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('maintenanceForm.maintenanceType')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border border-border z-50">
                        <SelectItem value="corrective">{t('maintenanceForm.corrective')}</SelectItem>
                        <SelectItem value="preventive">{t('maintenanceForm.preventive')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('maintenance.priority')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border border-border z-50">
                        {priorityOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className={opt.color}>{opt.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Equipment */}
            <FormField
              control={form.control}
              name="equipment_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('navigation.equipment')} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={equipmentLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={equipmentLoading ? t('common.loading') : t('maintenanceForm.selectEquipment')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px] bg-popover border border-border z-50">
                      {equipment.map(eq => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.internal_code} - {eq.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Scheduled Date (only for preventive) */}
            {watchType === 'preventive' && (
              <FormField
                control={form.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('maintenanceForm.scheduledDate')}</FormLabel>
                    <FormControl>
                      <DatePickerField
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Due Date */}
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('maintenanceForm.completionDeadline')} 
                    {watchType === 'corrective' && <span className="text-status-warning ml-1">*</span>}
                  </FormLabel>
                  <FormControl>
                    <DatePickerField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('maintenanceForm.selectDeadline')}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t('maintenanceForm.deadlineHelp')}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Work Order */}
            <FormField
              control={form.control}
              name="work_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('maintenanceForm.workOrderNumber')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('maintenanceForm.workOrderPlaceholder')} {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t('maintenanceForm.workOrderHelp')}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('maintenance.requestTitle')} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t('maintenanceForm.titlePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('maintenanceForm.detailedDescription')} *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t('maintenanceForm.detailedDescriptionPlaceholder')}
                      className="min-h-[80px] resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Problem Identified */}
            <FormField
              control={form.control}
              name="problem_identified"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('maintenanceForm.problemCause')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t('maintenanceForm.problemCausePlaceholder')}
                      className="min-h-[60px] resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Photos */}
            <div className="space-y-3">
              <FormLabel>{t('maintenanceForm.problemPhotos')}</FormLabel>
              <div className="flex flex-wrap gap-3">
                {photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Foto ${index + 1}`}
                      className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="h-16 w-16 sm:h-20 sm:w-20 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                  <Camera className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1">{t('maintenanceForm.addPhoto')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('maintenanceForm.photoHelp')}
              </p>
            </div>
          </ResponsiveDialogBody>

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createRequest.isPending}>
              {createRequest.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('maintenanceForm.createRequest')}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
