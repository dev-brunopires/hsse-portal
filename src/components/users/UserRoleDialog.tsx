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
import { Shield, User, Eye, Loader2 } from 'lucide-react';
import { useUpdateUserRole, type AppRole } from '@/hooks/useUserRoles';
import type { ProfileWithRole } from '@/hooks/useProfiles';

interface UserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithRole | null;
}

const roleOptions: { value: AppRole; label: string; description: string; icon: React.ElementType }[] = [
  { 
    value: 'admin', 
    label: 'Administrador', 
    description: 'Acesso total ao sistema, pode gerenciar usuários e configurações',
    icon: Shield 
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

  useEffect(() => {
    if (user?.user_roles?.[0]?.role) {
      setSelectedRole(user.user_roles[0].role);
    } else {
      setSelectedRole('viewer');
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    
    await updateRole.mutateAsync({
      userId: user.user_id,
      newRole: selectedRole,
    });
    
    onOpenChange(false);
  };

  if (!user) return null;

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

          <div className="space-y-2">
            <Label>Perfil de Acesso</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">
              {roleOptions.find(r => r.value === selectedRole)?.description}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
