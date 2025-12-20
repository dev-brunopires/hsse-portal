import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useUpdateProfile } from '@/hooks/useUserRoles';
import { useUnits } from '@/hooks/useUnits';
import type { ProfileWithRole } from '@/hooks/useProfiles';

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithRole | null;
}

export function UserEditDialog({ open, onOpenChange, user }: UserEditDialogProps) {
  const [fullName, setFullName] = useState('');
  const [unit, setUnit] = useState('');
  const updateProfile = useUpdateProfile();
  const { data: units = [] } = useUnits();

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setUnit(user.unit || '');
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    
    await updateProfile.mutateAsync({
      userId: user.user_id,
      fullName,
      unit: unit || undefined,
    });
    
    onOpenChange(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize as informações do usuário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome do usuário"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unidade</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma unidade" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {units.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Nenhuma unidade cadastrada
                  </SelectItem>
                ) : (
                  units.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={updateProfile.isPending || !fullName.trim()}>
            {updateProfile.isPending ? (
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
