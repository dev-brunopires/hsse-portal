import { useEffect } from 'react';
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
import { Wrench, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { MaintenanceType, MaintenancePriority } from '@/hooks/useMaintenanceRequests';

const formSchema = z.object({
  type: z.enum(['preventive', 'corrective']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres').max(200),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  problem_identified: z.string().optional(),
  work_order: z.string().optional(),
  scheduled_date: z.string().optional(),
  due_date: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

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
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
        title: 'Manutenção Atualizada',
        description: 'As alterações foram salvas com sucesso.',
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao Atualizar',
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
    { value: 'low', label: 'Baixa', color: 'text-muted-foreground' },
    { value: 'medium', label: 'Média', color: 'text-blue-600' },
    { value: 'high', label: 'Alta', color: 'text-orange-600' },
    { value: 'critical', label: 'Crítica', color: 'text-red-600' },
  ];

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Editar Manutenção
          </DialogTitle>
          <DialogDescription>
            Altere os dados da solicitação de manutenção
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pb-4">
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
                        <SelectTrigger className="border-border focus-visible:ring-offset-0">
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
                        <SelectTrigger className="border-border focus-visible:ring-offset-0">
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

            {/* Due Date */}
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prazo de Conclusão</FormLabel>
                  <FormControl>
                    <DatePickerField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Selecione o prazo limite"
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
                  <FormLabel>WO (Work Order)</FormLabel>
                  <FormControl>
                    <Input 
                      className="border-border focus-visible:ring-offset-0" 
                      placeholder="Número da Work Order relacionada" 
                      {...field} 
                    />
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
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input 
                      className="border-border focus-visible:ring-offset-0" 
                      placeholder="Breve descrição do problema ou serviço" 
                      {...field} 
                    />
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
                      className="min-h-[80px] border-border resize-none focus-visible:ring-offset-0"
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
                      className="min-h-[60px] border-border resize-none focus-visible:ring-offset-0"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}