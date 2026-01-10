import { useEffect } from 'react';
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
import { Wrench, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { MaintenanceType, MaintenancePriority } from '@/hooks/useMaintenanceRequests';

interface EditMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: {
    id: string;
    type: MaintenanceType;
    priority: MaintenancePriority;
    title: string;
    description: string;
    problem_identified: string | null;
    work_order: string | null;
    scheduled_date: string | null;
    due_date: string | null;
  } | null;
}

export function EditMaintenanceDialog({ 
  open, 
  onOpenChange, 
  request 
}: EditMaintenanceDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const formSchema = z.object({
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

  // Update form when request changes
  useEffect(() => {
    if (request) {
      form.reset({
        type: request.type,
        priority: request.priority,
        title: request.title,
        description: request.description,
        problem_identified: request.problem_identified || '',
        work_order: request.work_order || '',
        scheduled_date: request.scheduled_date || '',
        due_date: request.due_date || '',
      });
    }
  }, [request, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!request) throw new Error('No request to update');

      const { error } = await supabase
        .from('maintenance_requests')
        .update({
          type: data.type,
          priority: data.priority,
          title: data.title,
          description: data.description,
          problem_identified: data.problem_identified || null,
          work_order: data.work_order || null,
          scheduled_date: data.scheduled_date || null,
          due_date: data.due_date || null,
        })
        .eq('id', request.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-request', request?.id] });
      toast({
        title: t('maintenanceForm.maintenanceUpdated'),
        description: t('maintenanceForm.changesSuccessfullySaved'),
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: t('maintenanceForm.errorUpdating'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const watchType = form.watch('type');

  const onSubmit = (data: FormData) => {
    updateMutation.mutate(data);
  };

  const priorityOptions = [
    { value: 'low', label: t('maintenance.priorityLow'), color: 'text-muted-foreground' },
    { value: 'medium', label: t('maintenance.priorityMedium'), color: 'text-blue-600' },
    { value: 'high', label: t('maintenance.priorityHigh'), color: 'text-orange-600' },
    { value: 'critical', label: t('maintenance.priorityCritical'), color: 'text-red-600' },
  ];

  if (!request) return null;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('maintenanceForm.editMaintenance')}
      description={t('maintenanceForm.editMaintenanceDesc')}
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
                  <FormLabel>{t('maintenanceForm.completionDeadline')}</FormLabel>
                  <FormControl>
                    <DatePickerField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('maintenanceForm.selectDeadline')}
                    />
                  </FormControl>
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
          </ResponsiveDialogBody>

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('dialogs.saveChanges')}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
