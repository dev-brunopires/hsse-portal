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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useCompleteMaintenance, type MaintenancePlan } from '@/hooks/useMaintenance';
import { Wrench } from 'lucide-react';

interface CompleteMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: MaintenancePlan;
}

export function CompleteMaintenanceDialog({ open, onOpenChange, plan }: CompleteMaintenanceDialogProps) {
  const { t } = useTranslation();
  const completeMaintenance = useCompleteMaintenance();

  const formSchema = z.object({
    status: z.enum(['completed', 'partial', 'skipped']),
    notes: z.string().optional(),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: 'completed',
      notes: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    await completeMaintenance.mutateAsync({
      planId: plan.id,
      equipmentId: plan.equipment_id,
      notes: values.notes,
      status: values.status,
    });

    form.reset();
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title={t('maintenance.registerExecution')}
      description={`${t('maintenance.registerExecutionDesc')}: ${plan.title}`}
      titleIcon={<Wrench className="h-5 w-5 text-primary" />}
      className="sm:max-w-[425px]"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <ResponsiveDialogBody className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('maintenance.executionStatus')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="completed">{t('maintenance.statusCompleted')}</SelectItem>
                      <SelectItem value="partial">{t('maintenance.statusPartial')}</SelectItem>
                      <SelectItem value="skipped">{t('maintenance.statusSkipped')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.observations')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('maintenance.executionDetails')}
                      className="resize-none"
                      rows={3}
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
            <Button type="submit" disabled={completeMaintenance.isPending}>
              {completeMaintenance.isPending ? t('maintenance.saving') : t('maintenance.register')}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
