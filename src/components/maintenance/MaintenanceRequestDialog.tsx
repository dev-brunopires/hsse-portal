import { useState } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wrench, Upload, X, Loader2, Camera } from 'lucide-react';
import { useEquipment } from '@/hooks/useEquipment';
import { useCreateMaintenanceRequest, type MaintenanceType, type MaintenancePriority } from '@/hooks/useMaintenanceRequests';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  equipment_id: z.string().min(1, 'Selecione o equipamento'),
  type: z.enum(['preventive', 'corrective']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres').max(200),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  problem_identified: z.string().optional(),
  scheduled_date: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface MaintenanceRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedEquipmentId?: string;
}

export function MaintenanceRequestDialog({ 
  open, 
  onOpenChange, 
  preSelectedEquipmentId 
}: MaintenanceRequestDialogProps) {
  const [photos, setPhotos] = useState<File[]>([]);
  const { data: equipment = [], isLoading: equipmentLoading } = useEquipment();
  const createRequest = useCreateMaintenanceRequest();
  const { user } = useAuth();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      equipment_id: preSelectedEquipmentId || '',
      type: 'corrective',
      priority: 'medium',
      title: '',
      description: '',
      problem_identified: '',
      scheduled_date: '',
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
        scheduled_date: data.scheduled_date || undefined,
        requested_by: user.id,
      },
      photos,
    });

    form.reset();
    setPhotos([]);
    onOpenChange(false);
  };

  const priorityOptions = [
    { value: 'low', label: 'Baixa', color: 'text-muted-foreground' },
    { value: 'medium', label: 'Média', color: 'text-blue-600' },
    { value: 'high', label: 'Alta', color: 'text-orange-600' },
    { value: 'critical', label: 'Crítica', color: 'text-red-600' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col bg-card">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Nova Solicitação de Manutenção
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para registrar uma solicitação de manutenção
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 min-h-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pb-4 pr-2">
              {/* Type and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Manutenção *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-border">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="corrective">Corretiva</SelectItem>
                          <SelectItem value="preventive">Preventiva</SelectItem>
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
                      <FormLabel>Prioridade *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-border">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                    <FormLabel>Equipamento *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={equipmentLoading}>
                      <FormControl>
                        <SelectTrigger className="border-border">
                          <SelectValue placeholder={equipmentLoading ? 'Carregando...' : 'Selecione o equipamento'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
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
                      <FormLabel>Data Programada</FormLabel>
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

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título *</FormLabel>
                    <FormControl>
                      <Input className="border-border" placeholder="Breve descrição do problema ou serviço" {...field} />
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
                    <FormLabel>Descrição Detalhada *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva o problema ou serviço necessário em detalhes..."
                        className="min-h-[80px] border-border resize-none"
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
                    <FormLabel>Causa/Problema Identificado</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Se já identificou a causa do problema, descreva aqui..."
                        className="min-h-[60px] border-border resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Photos */}
              <div className="space-y-3">
                <FormLabel>Fotos do Problema</FormLabel>
                <div className="flex flex-wrap gap-3">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Foto ${index + 1}`}
                        className="h-20 w-20 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="h-20 w-20 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-1">Adicionar</span>
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
                  Anexe fotos que ilustrem o problema ou situação atual do equipamento
                </p>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createRequest.isPending}>
                  {createRequest.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Solicitação
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
