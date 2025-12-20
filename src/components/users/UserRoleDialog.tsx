import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, User, Eye, Loader2, Crown, UserCheck, AlertTriangle } from 'lucide-react';
import { useUpdateUserRole } from '@/hooks/useUserRoles';
import type { ProfileWithRole } from '@/hooks/useProfiles';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

type AppRole = 'admin_master' | 'admin' | 'supervisor' | 'technician' | 'viewer';

interface UserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithRole | null;
}

const roleOptions: { value: AppRole; label: string; description: string; icon: React.ElementType }[] = [
  { 
    value: 'admin_master', 
    label: 'Admin Master', 
    description: 'Acesso total e irrestrito ao sistema, pode fazer tudo',
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
];

export function UserRoleDialog({ open, onOpenChange, user }: UserRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<AppRole>('viewer');
  const updateRole = useUpdateUserRole();
  const { isAdminMaster } = useAuth();

  // Get the current role of the user being edited
  const userCurrentRole = user?.user_roles?.[0]?.role as AppRole | undefined;
  const isEditingAdminMaster = userCurrentRole === 'admin_master';

  // Filter role options based on current user's permissions
  const availableRoleOptions = roleOptions.filter(role => {
    // Only admin_master can assign/edit admin_master role
    if (role.value === 'admin_master' && !isAdminMaster) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (user?.user_roles?.[0]?.role) {
      setSelectedRole(user.user_roles[0].role as AppRole);
    } else {
      setSelectedRole('viewer');
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    
    // Prevent admin from editing admin_master
    if (isEditingAdminMaster && !isAdminMaster) {
      return;
    }
    
    await updateRole.mutateAsync({
      userId: user.user_id,
      newRole: selectedRole as any,
    });
    
    onOpenChange(false);
  };

  if (!user) return null;

  // Check if current user (not admin_master) is trying to edit an admin_master
  const cannotEditUser = isEditingAdminMaster && !isAdminMaster;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Perfil de Acesso</DialogTitle>
          <DialogDescription>
            Definindo permissões para <strong>{user.full_name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>

          {cannotEditUser ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Você não tem permissão para editar um Admin Master. Apenas outro Admin Master pode fazer isso.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Perfil de Acesso</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoleOptions.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex items-center gap-2">
                          <role.icon className="h-4 w-4" />
                          <span>{role.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  {roleOptions.find(r => r.value === selectedRole)?.description}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {!cannotEditUser && (
            <Button onClick={handleSubmit} disabled={updateRole.isPending}>
              {updateRole.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
