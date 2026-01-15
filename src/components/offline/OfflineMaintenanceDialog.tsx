import { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Wrench, 
  WifiOff,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Package,
  Ship,
} from 'lucide-react';
import { useIsTabletOrMobile } from '@/hooks/use-mobile';
import { useOfflineSync, type CachedMaintenancePlan } from '@/hooks/useOfflineSync';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { ConnectionStatus } from '@/components/ui/connection-status';

interface OfflineMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: CachedMaintenancePlan;
  onSuccess?: () => void;
}

const createMaintenanceSchema = (t: (key: string) => string) => z.object({
  status: z.enum(['completed', 'partial', 'skipped']),
  notes: z.string().optional(),
});

type MaintenanceFormData = z.infer<ReturnType<typeof createMaintenanceSchema>>;

export function OfflineMaintenanceDialog({ 
  open, 
  onOpenChange, 
  plan,
  onSuccess,
}: OfflineMaintenanceDialogProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isTabletOrMobile = useIsTabletOrMobile();
  const { addPendingMaintenance } = useOfflineSync();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maintenanceSchema = createMaintenanceSchema(t);
  
  const form = useForm<MaintenanceFormData>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      status: 'completed',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        status: 'completed',
        notes: '',
      });
    }
  }, [open, form]);

  const onSubmit = async (data: MaintenanceFormData) => {
    setIsSubmitting(true);
    
    try {
      await addPendingMaintenance({
        plan_id: plan.id,
        plan_title: plan.title,
        equipment_id: plan.equipment_id,
        equipment_name: plan.equipment_name,
        equipment_code: plan.equipment_code,
        status: data.status,
        notes: data.notes || null,
        completed_by: user?.id || '',
        frequency: plan.frequency,
        next_due_date: plan.next_due_date,
        ship_id: plan.ship_id,
      });
      
      toast.success(t('offline.maintenanceSavedOffline'), {
        description: t('offline.willSyncWhenOnline'),
      });
      
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error saving offline maintenance:', error);
      toast.error(t('offline.errorSaving'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const dateLocale = i18n.language === 'pt-BR' ? ptBR : enUS;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-status-danger/10 text-status-danger border-status-danger/30';
      case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
      case 'medium': return 'bg-status-warning/10 text-status-warning border-status-warning/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const headerContent = (
    <>
      <div className="flex items-center gap-2 text-xl font-semibold">
        <Wrench className="h-5 w-5 text-primary" />
        {t('offline.offlineMaintenance')}
        <ConnectionStatus isOnline={false} className="ml-2" />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Package className="h-4 w-4" />
        <span className="font-medium text-foreground">{plan.equipment_code}</span>
        <span>-</span>
        <span>{plan.equipment_name}</span>
      </div>
    </>
  );

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-4 pb-4 px-1">
            {/* Plan info card */}
            <div className="p-4 border rounded-lg bg-card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium">{plan.title}</h4>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  )}
                </div>
                <Badge variant="outline" className={cn("text-xs", getPriorityColor(plan.priority))}>
                  {t(`maintenance.priority${plan.priority.charAt(0).toUpperCase() + plan.priority.slice(1)}`)}
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{t('maintenance.dueDate')}:</span>
                  <span className="font-medium text-foreground">
                    {format(new Date(plan.next_due_date), 'dd/MM/yyyy', { locale: dateLocale })}
                  </span>
                </div>
                {plan.ship_name && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Ship className="h-4 w-4" />
                    <span>{plan.ship_name}</span>
                  </div>
                )}
              </div>

              <Badge variant="secondary" className="text-xs">
                {t(`maintenance.frequency${plan.frequency.charAt(0).toUpperCase() + plan.frequency.slice(1)}`)}
              </Badge>
            </div>

            {/* Status field */}
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
                      <SelectItem value="completed">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-status-success" />
                          {t('maintenance.statusCompleted')}
                        </div>
                      </SelectItem>
                      <SelectItem value="partial">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-status-warning" />
                          {t('maintenance.statusPartial')}
                        </div>
                      </SelectItem>
                      <SelectItem value="skipped">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          {t('maintenance.statusSkipped')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes field */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.observations')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('maintenance.executionDetails')}
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ScrollArea>

        {/* Footer buttons */}
        <div className="flex gap-3 pt-2 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            {t('common.cancel')}
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('maintenance.saving')}
              </>
            ) : (
              <>
                <Wrench className="h-4 w-4 mr-2" />
                {t('maintenance.register')}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );

  if (isTabletOrMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{headerContent}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {t('offline.offlineMaintenance')}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{headerContent}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('offline.offlineMaintenance')}
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}