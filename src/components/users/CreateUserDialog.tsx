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
import { Shield, User, Eye, Loader2, Crown, UserCheck, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useUnits } from '@/hooks/useUnits';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const createUserSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  unit: z.string().optional(),
  role: z.enum(['admin_master', 'admin', 'supervisor', 'technician', 'viewer']),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

const roleOptions = [
  { 
    value: 'admin_master', 
    label: 'Admin Master', 
    description: 'Acesso total e irrestrito ao sistema',
    icon: Crown 
  },
  { 
    value: 'admin', 
    label: 'Administrador', 
    description: 'Acesso total ao sistema, pode gerenciar usuários e configurações',
    icon: Shield 
  },
  { 
    value: 'supervisor', 
    label: 'Supervisor', 
    description: 'Pode supervisionar inspeções e aprovar relatórios',
    icon: UserCheck 
  },
  { 
    value: 'technician', 
    label: 'Técnico', 
    description: 'Pode criar e editar equipamentos e inspeções',
    icon: User 
  },
  { 
    value: 'viewer', 
    label: 'Visualizador', 
    description: 'Apenas visualização de dados',
    icon: Eye 
  },
] as const;

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: units = [] } = useUnits();

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      unit: '',
      role: 'viewer',
    },
  });

  const onSubmit = async (data: CreateUserFormData) => {
    setIsSubmitting(true);
    
    try {
      // Create user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: data.fullName,
          },
        },
      });

      if (authError) throw authError;
      
      if (!authData.user) {
        throw new Error('Erro ao criar usuário');
      }

      // Update profile with unit
      if (data.unit) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ unit: data.unit })
          .eq('user_id', authData.user.id);
        
        if (profileError) console.error('Error updating unit:', profileError);
      }

      // Update role (the trigger creates 'viewer' by default, so we update if different)
      if (data.role !== 'viewer') {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: data.role as any })
          .eq('user_id', authData.user.id);
        
        if (roleError) {
          // If update fails, try insert
          await supabase
            .from('user_roles')
            .insert({ user_id: authData.user.id, role: data.role as any });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      
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

  const selectedRole = form.watch('role');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma unidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border border-border shadow-lg z-50">
                      {units.length === 0 ? (
                        <SelectItem value="_empty" disabled>
                          Nenhuma unidade cadastrada
                        </SelectItem>
                      ) : (
                        units.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
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
