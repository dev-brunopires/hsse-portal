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
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Ship, MapPin } from 'lucide-react';
import { useCreateShip, useUpdateShip, type Ship as ShipType } from '@/hooks/useShips';
import { ShipAreasManager } from './ShipAreasManager';
import { useCreateShipArea } from '@/hooks/useShipAreas';
import { useRegions } from '@/hooks/useRegions';

interface ShipFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ship?: ShipType | null;
}

const shipSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  code: z.string().optional(),
  description: z.string().optional(),
  region_id: z.string().optional(),
});

type ShipFormData = z.infer<typeof shipSchema>;

export function ShipFormDialog({ open, onOpenChange, ship }: ShipFormDialogProps) {
  const { t } = useTranslation();
  const createShip = useCreateShip();
  const updateShip = useUpdateShip();
  const createArea = useCreateShipArea();
  const { data: regions = [] } = useRegions();
  const isEditing = !!ship;

  const [draftAreas, setDraftAreas] = useState<string[]>([]);

  const form = useForm<ShipFormData>({
    resolver: zodResolver(shipSchema),
    defaultValues: { name: '', code: '', description: '', region_id: 'none' },
  });

  useEffect(() => {
    if (ship) {
      form.reset({
        name: ship.name,
        code: ship.code || '',
        description: ship.description || '',
        region_id: ship.region_id || 'none',
      });
    } else {
      form.reset({ name: '', code: '', description: '', region_id: 'none' });
      setDraftAreas([]);
    }
  }, [ship, form, open]);

  const onSubmit = async (data: ShipFormData) => {
    try {
      if (isEditing && ship) {
        await updateShip.mutateAsync({
          id: ship.id,
          name: data.name,
          code: data.code,
          description: data.description,
          region_id: data.region_id === 'none' ? null : data.region_id,
        });
      } else {
        const created = await createShip.mutateAsync({
          name: data.name,
          code: data.code,
          description: data.description,
          region_id: data.region_id === 'none' ? null : data.region_id,
        });
        // Persist draft areas
        if (created?.id && draftAreas.length > 0) {
          await Promise.all(
            draftAreas.map((name) =>
              createArea.mutateAsync({ ship_id: created.id, name }).catch(() => null)
            )
          );
        }
      }
      onOpenChange(false);
    } catch (error) {
      // handled
    }
  };

  const isSubmitting = createShip.isPending || updateShip.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
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

              <FormField
                control={form.control}
                name="region_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('regions.region')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('regions.selectRegion')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t('regions.noRegion')}</SelectItem>
                        {regions.map((region) => (
                          <SelectItem key={region.id} value={region.id}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {t('shipAreas.title', 'Áreas / Locais físicos')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('shipAreas.help', 'Cadastre as áreas físicas deste navio. Elas ficarão disponíveis ao selecionar localização de equipamentos, medições e demais módulos.')}
                </p>
              </div>
              <ShipAreasManager
                shipId={ship?.id}
                draftAreas={draftAreas}
                onDraftChange={setDraftAreas}
              />
            </div>

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
