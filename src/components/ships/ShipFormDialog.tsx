import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Ship } from 'lucide-react';
import { useCreateShip, useUpdateShip, type Ship as ShipType } from '@/hooks/useShips';

interface ShipFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ship?: ShipType | null;
}

const shipSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  code: z.string().optional(),
  description: z.string().optional(),
});

type ShipFormData = z.infer<typeof shipSchema>;

export function ShipFormDialog({ open, onOpenChange, ship }: ShipFormDialogProps) {
  const { t } = useTranslation();
  const createShip = useCreateShip();
  const updateShip = useUpdateShip();
  const isEditing = !!ship;

  const form = useForm<ShipFormData>({
    resolver: zodResolver(shipSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
    },
  });

  useEffect(() => {
    if (ship) {
      form.reset({
        name: ship.name,
        code: ship.code || '',
        description: ship.description || '',
      });
    } else {
      form.reset({
        name: '',
        code: '',
        description: '',
      });
    }
  }, [ship, form]);

  const onSubmit = async (data: ShipFormData) => {
    try {
      if (isEditing && ship) {
        await updateShip.mutateAsync({
          id: ship.id,
          name: data.name,
          code: data.code,
          description: data.description,
        });
      } else {
        await createShip.mutateAsync({
          name: data.name,
          code: data.code,
          description: data.description,
        });
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const isSubmitting = createShip.isPending || updateShip.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5 text-primary" />
            {isEditing ? t('dialogs.editShip') : t('dialogs.createShip')}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t('dialogs.updateShipData') : t('dialogs.fillShipData')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dialogs.shipName')} *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Navio Atlântico Sul" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dialogs.shipCode')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: NAS-001" {...field} />
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
                  <FormLabel>{t('common.description')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t('common.observations')} 
                      className="resize-none"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {isEditing ? t('dialogs.saving') : t('dialogs.creating')}
                  </>
                ) : (
                  isEditing ? t('common.save') : t('dialogs.createShipBtn')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
