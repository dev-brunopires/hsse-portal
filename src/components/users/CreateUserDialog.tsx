import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
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
import { Shield, User, Eye, Loader2, Crown, UserCheck, UserPlus, Info, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOrganization } from '@/contexts/OrganizationContext';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  const createUserSchema = z.object({
    email: z.string().email(t('users.invalidEmail')),
    password: z.string().min(6, t('users.passwordMinLength')),
    fullName: z.string().min(2, t('users.nameMinLength')),
    nationality: z.enum(['brazilian', 'foreigner']),
    role: z.enum(['admin_master', 'admin', 'supervisor', 'technician', 'viewer']),
  });

  type CreateUserFormData = z.infer<typeof createUserSchema>;

  const roleOptions = [
    { 
      value: 'admin_master', 
      label: t('roles.admin_master'), 
      description: t('roles.adminMasterDesc'),
      icon: Crown,
      hasAllShips: true,
    },
    { 
      value: 'admin', 
      label: t('roles.admin'), 
      description: t('roles.adminDesc'),
      icon: Shield,
      hasAllShips: true,
    },
    { 
      value: 'supervisor', 
      label: t('roles.supervisor'), 
      description: t('roles.supervisorDesc'),
      icon: UserCheck,
      hasAllShips: false,
    },
    { 
      value: 'technician', 
      label: t('roles.technician'), 
      description: t('roles.technicianDesc'),
      icon: User,
      hasAllShips: false,
    },
    { 
      value: 'viewer', 
      label: t('roles.viewer'), 
      description: t('roles.viewerDesc'),
      icon: Eye,
      hasAllShips: false,
    },
  ] as const;

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      nationality: 'brazilian',
      role: 'viewer',
    },
  });

  const selectedRole = form.watch('role');
  
  // Check if selected role has automatic access to all ships
  const roleHasAllShips = roleOptions.find(r => r.value === selectedRole)?.hasAllShips || false;

  const getFunctionErrorMessage = async (error: unknown) => {
    const fallback = error instanceof Error ? error.message : t('users.errorCreatingUserDesc');
    const context = (error as { context?: unknown })?.context;

    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: string; message?: string };
        return payload.error || payload.message || fallback;
      } catch {
        return fallback;
      }
    }

    return fallback;
  };

  const onSubmit = async (data: CreateUserFormData) => {
    setIsSubmitting(true);

    // Define language based on nationality
    const language = data.nationality === 'brazilian' ? 'pt-BR' : 'en';

    try {
      if (!organization?.id || !organization.name.toLowerCase().includes('sbm')) {
        throw new Error('Organizacao SBM nao encontrada no contexto atual. Selecione a organizacao SBM antes de cadastrar usuarios.');
      }

      // Use backend function so the admin session is not affected
      const { data: result, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          role: data.role,
          language: language,
          organizationId: organization.id,
        },
      });

      if (error) {
        throw new Error(await getFunctionErrorMessage(error));
      }

      if (!result?.success) {
        throw new Error(result?.error || t('users.errorCreatingUserDesc'));
      }

      queryClient.invalidateQueries({ queryKey: ['profiles'] });

      toast({
        title: t('users.userCreated'),
        description: `${data.fullName} ${t('users.userCreatedDesc')}`,
      });

      form.reset();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Error creating user:', error);
      toast({
        title: t('users.errorCreatingUser'),
        description: error instanceof Error ? error.message : t('users.errorCreatingUserDesc'),
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
            {t('users.createUser')}
          </DialogTitle>
          <DialogDescription>
            {t('users.fillDataToCreate')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.fullNameRequired')} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t('users.userName')} {...field} />
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
                  <FormLabel>{t('users.emailRequired')} *</FormLabel>
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
                  <FormLabel>{t('users.passwordRequired')} *</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={t('users.minPasswordChars')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nationality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {t('users.nationality')} *
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('users.selectNationality')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border border-border shadow-lg z-50">
                      <SelectItem value="brazilian">
                        <div className="flex items-center gap-2">
                          🇧🇷 {t('users.brazilian')}
                        </div>
                      </SelectItem>
                      <SelectItem value="foreigner">
                        <div className="flex items-center gap-2">
                          🌍 {t('users.foreigner')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    {field.value === 'brazilian' 
                      ? t('users.systemConfiguredPortuguese') 
                      : t('users.systemConfiguredEnglish')}
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.accessProfile')} *</FormLabel>
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

            {/* Ship assignment info */}
            {!roleHasAllShips && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {t('users.assignShipsAfterCreate')}
                </AlertDescription>
              </Alert>
            )}

            {roleHasAllShips && (
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  {t('users.autoAccessAllShips')}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('users.creating')}
                  </>
                ) : (
                  t('users.createUserBtn')
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
