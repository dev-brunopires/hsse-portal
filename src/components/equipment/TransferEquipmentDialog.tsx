import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRightLeft } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useShips } from '@/hooks/useShips';
import { useCreateEquipmentTransfer } from '@/hooks/useEquipmentTransfers';

interface TransferEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: {
    id: string;
    name: string;
    internal_code: string;
    ship_id: string | null;
  };
}

export function TransferEquipmentDialog({
  open,
  onOpenChange,
  equipment,
}: TransferEquipmentDialogProps) {
  const { t } = useTranslation();
  const { data: ships = [] } = useShips();
  const createTransfer = useCreateEquipmentTransfer();

  const formSchema = z.object({
    to_ship_id: z.string().min(1, t('transferEquipment.selectDestination')),
    reason: z.string().optional(),
    notes: z.string().optional(),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      to_ship_id: '',
      reason: '',
      notes: '',
    },
  });

  const availableShips = ships.filter((ship) => ship.id !== equipment.ship_id);

  const onSubmit = async (values: FormValues) => {
    await createTransfer.mutateAsync({
      equipmentId: equipment.id,
      fromShipId: equipment.ship_id,
      toShipId: values.to_ship_id,
      reason: values.reason,
      notes: values.notes,
    });

    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            {t('transferEquipment.title')}
          </DialogTitle>
          <DialogDescription>
            {equipment.name} - {equipment.internal_code}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="to_ship_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transferEquipment.destinationShip')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('transferEquipment.selectShip')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableShips.map((ship) => (
                        <SelectItem key={ship.id} value={ship.id}>
                          {ship.name}
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
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transferEquipment.reason')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('transferEquipment.reasonPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transferEquipment.notes')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('transferEquipment.notesPlaceholder')}
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('transferEquipment.cancel')}
              </Button>
              <Button type="submit" disabled={createTransfer.isPending}>
                {createTransfer.isPending ? t('transferEquipment.transferring') : t('transferEquipment.confirmTransfer')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}