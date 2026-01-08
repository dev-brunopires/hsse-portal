import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { DatePickerField } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ClipboardCheck, 
  Loader2,
  Save,
} from 'lucide-react';
import { useUpdateInspection, type InspectionWithDetails } from '@/hooks/useInspections';

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
  const updateInspection = useUpdateInspection();

  const editInspectionSchema = z.object({
    status: z.enum(['compliant', 'attention', 'non-compliant']),
    inspection_date: z.string().min(1, t('validation.required')),
    next_inspection_date: z.string().optional(),
    observations: z.string().optional(),
    recommendations: z.string().optional(),
    actions_taken: z.string().optional(),
  });

  const statusOptions = [
    { value: 'compliant', label: t('editInspection.statusCompliant') },
    { value: 'attention', label: t('editInspection.statusAttention') },
    { value: 'non-compliant', label: t('editInspection.statusNonCompliant') },
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
    }
  }, [open, inspection, form]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col bg-card border border-border" hideCloseButton>
        <DialogHeader className="pb-4 border-b border-border pr-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            {t('editInspection.title')}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {inspection.equipment?.internal_code} - {inspection.equipment?.name}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1">
              <div className="space-y-4 py-4 px-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>{t('editInspection.status')} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('editInspection.select')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-popover border border-border shadow-lg z-50">
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="inspection_date"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>{t('editInspection.date')} *</FormLabel>
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
                      <FormItem className="space-y-2">
                        <FormLabel>{t('editInspection.next')}</FormLabel>
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

                <FormField
                  control={form.control}
                  name="actions_taken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('editInspection.actionsTaken')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('editInspection.actionsTakenPlaceholder')}
                          className="min-h-[60px] resize-none"
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
                      <FormLabel>{t('editInspection.observations')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('editInspection.observationsPlaceholder')}
                          className="min-h-[60px] resize-none"
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
                      <FormLabel>{t('editInspection.recommendations')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('editInspection.recommendationsPlaceholder')}
                          className="min-h-[60px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
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
      </DialogContent>
    </Dialog>
  );
}
