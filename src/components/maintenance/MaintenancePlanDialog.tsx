import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { formatLocalDate } from '@/utils/dateFormat';
import { ptBR, enUS } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useEquipment } from '@/hooks/useEquipment';
import { useCreateMaintenancePlan } from '@/hooks/useMaintenance';

interface MaintenancePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MaintenancePlanDialog({ open, onOpenChange }: MaintenancePlanDialogProps) {
  const { t, i18n } = useTranslation();
  const { data: equipment = [] } = useEquipment();
  const createPlan = useCreateMaintenancePlan();

  const dateLocale = i18n.language === 'pt-BR' ? ptBR : enUS;

  const formSchema = z.object({
    equipment_id: z.string().min(1, t('maintenance.selectEquipmentValidation')),
    title: z.string().min(1, t('maintenance.titleRequired')),
    description: z.string().optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    next_due_date: z.date({ required_error: t('maintenance.dateRequired') }),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      equipment_id: '',
      title: '',
      description: '',
      frequency: 'monthly',
      priority: 'medium',
    },
  });

  const onSubmit = async (values: FormValues) => {
    await createPlan.mutateAsync({
      equipment_id: values.equipment_id,
      title: values.title,
      description: values.description || null,
      frequency: values.frequency,
      priority: values.priority,
      next_due_date: formatLocalDate(values.next_due_date),
      last_completed_date: null,
      created_by: null,
    });

    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('maintenance.newMaintenancePlan')}</DialogTitle>
          <DialogDescription>
            {t('maintenance.configurePreventive')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="equipment_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('navigation.equipment')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('maintenanceForm.selectEquipment')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {equipment.map((eq) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.name} - {eq.internal_code}
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('maintenance.maintenanceTitle')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('maintenance.maintenanceTitlePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('maintenance.descriptionOptional')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('maintenance.maintenanceDetails')}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('maintenance.frequency')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">{t('maintenance.frequencyDaily')}</SelectItem>
                        <SelectItem value="weekly">{t('maintenance.frequencyWeekly')}</SelectItem>
                        <SelectItem value="monthly">{t('maintenance.frequencyMonthly')}</SelectItem>
                        <SelectItem value="quarterly">{t('maintenance.frequencyQuarterly')}</SelectItem>
                        <SelectItem value="yearly">{t('maintenance.frequencyYearly')}</SelectItem>
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
                    <FormLabel>{t('maintenance.priority')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">{t('maintenance.priorityLow')}</SelectItem>
                        <SelectItem value="medium">{t('maintenance.priorityMedium')}</SelectItem>
                        <SelectItem value="high">{t('maintenance.priorityHigh')}</SelectItem>
                        <SelectItem value="critical">{t('maintenance.priorityCritical')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="next_due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t('maintenance.nextDate')}</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'dd/MM/yyyy', { locale: dateLocale })
                          ) : (
                            <span>{t('maintenance.selectDate')}</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        locale={dateLocale}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createPlan.isPending}>
                {createPlan.isPending ? t('maintenance.saving') : t('maintenance.createPlan')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
