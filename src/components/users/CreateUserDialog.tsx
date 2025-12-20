import { useState } from 'react';
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
  FormDescription,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, User, Eye, Loader2, Crown, UserCheck, UserPlus, Ship } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useShips } from '@/hooks/useShips';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const createUserSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  role: z.enum(['admin_master', 'admin', 'supervisor', 'technician', 'viewer']),
  shipIds: z.array(z.string()).optional(),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

const roleOptions = [
  { 
    value: 'admin_master', 
    label: 'Admin Master', 
    description: 'Acesso total e irrestrito ao sistema',
    icon: Crown,
    hasAllShips: true,
  },
  { 
    value: 'admin', 
    label: 'Administrador', 
    description: 'Acesso total ao sistema, pode gerenciar usuários e configurações',
    icon: Shield,
    hasAllShips: true,
  },
  { 
    value: 'supervisor', 
    label: 'Supervisor', 
    description: 'Pode supervisionar inspeções e aprovar relatórios',
    icon: UserCheck,
    hasAllShips: false,
  },
  { 
    value: 'technician', 
    label: 'Técnico', 
    description: 'Pode criar e editar equipamentos e inspeções',
    icon: User,
    hasAllShips: false,
  },
  { 
    value: 'viewer', 
    label: 'Visualizador', 
    description: 'Apenas visualização de dados',
    icon: Eye,
    hasAllShips: false,
  },
] as const;

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: ships = [], isLoading: shipsLoading } = useShips();

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      role: 'viewer',
      shipIds: [],
    },
  });

  const selectedRole = form.watch('role');
  const selectedShipIds = form.watch('shipIds') || [];
  
  // Check if selected role has automatic access to all ships
  const roleHasAllShips = roleOptions.find(r => r.value === selectedRole)?.hasAllShips || false;

  const handleShipToggle = (shipId: string, checked: boolean) => {
    const current = form.getValues('shipIds') || [];
    if (checked) {
      form.setValue('shipIds', [...current, shipId]);
    } else {
      form.setValue('shipIds', current.filter(id => id !== shipId));
    }
  };

  const onSubmit = async (data: CreateUserFormData) => {
    setIsSubmitting(true);

    try {
      // Use backend function so the admin session is not affected
      const { data: result, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          role: data.role,
          shipIds: roleHasAllShips ? [] : (data.shipIds || []), // Don't send ships for admin roles
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao criar usuário');
      }

      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['user-ships'] });
      queryClient.invalidateQueries({ queryKey: ['all-user-ships'] });

      toast({
        title: 'Usuário Criado',
        description: `${data.fullName} foi cadastrado com sucesso.`,
      });

      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Erro ao Criar Usuário',
        description: error.message || 'Ocorreu um erro ao criar o usuário.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Cadastrar Novo Usuário
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para criar um novo usuário no sistema
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do usuário" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha *</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perfil de Acesso *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border border-border shadow-lg z-50">
                      {roleOptions.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          <div className="flex items-center gap-2">
                            <role.icon className="h-4 w-4" />
                            <span>{role.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                {roleOptions.find(r => r.value === selectedRole)?.description}
              </p>
            </div>

            {/* Ship Selection */}
            <FormField
              control={form.control}
              name="shipIds"
              render={() => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Ship className="h-4 w-4" />
                    Navios Atribuídos
                  </FormLabel>
                  {roleHasAllShips ? (
                    <div className="rounded-lg border border-border bg-muted/50 p-3">
                      <p className="text-sm text-muted-foreground">
                        Este perfil tem acesso automático a todos os navios.
                      </p>
                    </div>
                  ) : (
                    <>
                      <FormDescription>
                        Selecione os navios que este usuário terá acesso
                      </FormDescription>
                      <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-md p-3">
                        {shipsLoading ? (
                          <p className="text-sm text-muted-foreground">Carregando navios...</p>
                        ) : ships.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum navio cadastrado</p>
                        ) : (
                          ships.map((ship) => (
                            <div key={ship.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`ship-${ship.id}`}
                                checked={selectedShipIds.includes(ship.id)}
                                onCheckedChange={(checked) => handleShipToggle(ship.id, checked as boolean)}
                              />
                              <label
                                htmlFor={`ship-${ship.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {ship.name} {ship.code ? `(${ship.code})` : ''}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                      {!roleHasAllShips && selectedShipIds.length === 0 && (
                        <p className="text-xs text-amber-600">
                          Atenção: Usuário sem navio não poderá ver equipamentos ou criar inspeções.
                        </p>
                      )}
                    </>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Criando...
                  </>
                ) : (
                  'Criar Usuário'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}