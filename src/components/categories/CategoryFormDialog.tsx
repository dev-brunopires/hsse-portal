import { useState, useEffect } from 'react';
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
  FormDescription,
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
import { 
  Loader2, FolderOpen, Flame, Wind, Shield, Waves, Gauge, ArrowUp, Package, HardHat, LifeBuoy, Anchor,
  FireExtinguisher, Siren, AlertTriangle, Zap, Droplets, Thermometer, Activity, Radio, Bell,
  Construction, Wrench, Settings, Cog, Truck, Building, Factory, Warehouse, Cylinder, CircleDot,
  ShieldCheck, ShieldAlert, Eye, Camera, Lock, Key, Plug, Power, BatteryCharging,
  TriangleAlert, OctagonAlert, CircleAlert, Megaphone, Volume2, Flashlight, Lightbulb
} from 'lucide-react';
import { useCreateCategory, useUpdateCategory, type Category } from '@/hooks/useCategories';

const categorySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  icon: z.string().min(1, 'Selecione um ícone'),
  inspection_frequency: z.string().min(1, 'Selecione a frequência'),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  category?: Category | null;
}

const iconOptions = [
  // Combate a incêndio
  { value: 'fire-extinguisher', label: 'Extintor', icon: FireExtinguisher },
  { value: 'flame', label: 'Fogo', icon: Flame },
  { value: 'droplets', label: 'Mangueira/Água', icon: Droplets },
  { value: 'waves', label: 'Hidrante', icon: Waves },
  { value: 'siren', label: 'Alarme', icon: Siren },
  { value: 'megaphone', label: 'Sirene', icon: Megaphone },
  
  // Segurança e alertas
  { value: 'shield', label: 'Escudo', icon: Shield },
  { value: 'shield-check', label: 'Proteção', icon: ShieldCheck },
  { value: 'shield-alert', label: 'Alerta Segurança', icon: ShieldAlert },
  { value: 'alert-triangle', label: 'Atenção', icon: AlertTriangle },
  { value: 'triangle-alert', label: 'Perigo', icon: TriangleAlert },
  { value: 'octagon-alert', label: 'Parada', icon: OctagonAlert },
  { value: 'circle-alert', label: 'Aviso', icon: CircleAlert },
  
  // Equipamentos industriais
  { value: 'cylinder', label: 'Cilindro', icon: Cylinder },
  { value: 'gauge', label: 'Manômetro', icon: Gauge },
  { value: 'thermometer', label: 'Termômetro', icon: Thermometer },
  { value: 'activity', label: 'Monitor', icon: Activity },
  
  // EPIs e proteção
  { value: 'hard-hat', label: 'Capacete', icon: HardHat },
  { value: 'eye', label: 'Óculos/Visão', icon: Eye },
  { value: 'life-buoy', label: 'Boia', icon: LifeBuoy },
  
  // Elétrica e energia
  { value: 'zap', label: 'Elétrico', icon: Zap },
  { value: 'plug', label: 'Tomada', icon: Plug },
  { value: 'power', label: 'Energia', icon: Power },
  { value: 'battery-charging', label: 'Bateria', icon: BatteryCharging },
  { value: 'lightbulb', label: 'Iluminação', icon: Lightbulb },
  { value: 'flashlight', label: 'Lanterna', icon: Flashlight },
  
  // Ferramentas e manutenção
  { value: 'wrench', label: 'Ferramenta', icon: Wrench },
  { value: 'settings', label: 'Configuração', icon: Settings },
  { value: 'cog', label: 'Engrenagem', icon: Cog },
  { value: 'construction', label: 'Construção', icon: Construction },
  
  // Comunicação e monitoramento
  { value: 'radio', label: 'Rádio', icon: Radio },
  { value: 'bell', label: 'Notificação', icon: Bell },
  { value: 'volume-2', label: 'Som', icon: Volume2 },
  { value: 'camera', label: 'Câmera', icon: Camera },
  
  // Estruturas e locais
  { value: 'building', label: 'Prédio', icon: Building },
  { value: 'factory', label: 'Fábrica', icon: Factory },
  { value: 'warehouse', label: 'Armazém', icon: Warehouse },
  { value: 'truck', label: 'Veículo', icon: Truck },
  
  // Outros
  { value: 'wind', label: 'Ventilação', icon: Wind },
  { value: 'arrow-up', label: 'Altura', icon: ArrowUp },
  { value: 'package', label: 'Pacote', icon: Package },
  { value: 'anchor', label: 'Âncora', icon: Anchor },
  { value: 'lock', label: 'Cadeado', icon: Lock },
  { value: 'key', label: 'Chave', icon: Key },
  { value: 'circle-dot', label: 'Ponto', icon: CircleDot },
];

const frequencyOptions = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
  { value: 'custom', label: 'Personalizada' },
];

export function CategoryFormDialog({ open, onOpenChange, mode, category }: CategoryFormDialogProps) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
      icon: 'package',
      inspection_frequency: 'monthly',
    },
  });

  useEffect(() => {
    if (open && category && mode === 'edit') {
      form.reset({
        name: category.name,
        description: category.description || '',
        icon: category.icon || 'package',
        inspection_frequency: category.inspection_frequency,
      });
    } else if (open && mode === 'create') {
      form.reset({
        name: '',
        description: '',
        icon: 'package',
        inspection_frequency: 'monthly',
      });
    }
  }, [open, category, mode, form]);

  const onSubmit = async (data: CategoryFormData) => {
    if (mode === 'create') {
      await createCategory.mutateAsync({
        name: data.name,
        description: data.description || null,
        icon: data.icon,
        inspection_frequency: data.inspection_frequency,
      });
    } else if (category) {
      await updateCategory.mutateAsync({
        id: category.id,
        name: data.name,
        description: data.description || null,
        icon: data.icon,
        inspection_frequency: data.inspection_frequency,
      });
    }
    onOpenChange(false);
  };

  const isSubmitting = createCategory.isPending || updateCategory.isPending;
  const selectedIcon = iconOptions.find(i => i.value === form.watch('icon'));
  const IconComponent = selectedIcon?.icon || FolderOpen;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            {mode === 'create' ? 'Nova Categoria' : 'Editar Categoria'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Crie uma nova categoria de equipamentos' 
              : 'Atualize as informações da categoria'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Extintores de Incêndio" {...field} />
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
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva a categoria..."
                      rows={3}
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
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ícone *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              <IconComponent className="h-4 w-4" />
                              <span>{selectedIcon?.label}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {iconOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <option.icon className="h-4 w-4" />
                              <span>{option.label}</span>
                            </div>
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
                name="inspection_frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequência de Inspeção *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {frequencyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Define quando inspeções devem ser realizadas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : mode === 'create' ? (
                  'Criar Categoria'
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
