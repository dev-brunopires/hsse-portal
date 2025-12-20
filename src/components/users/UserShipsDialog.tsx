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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Ship, Anchor } from 'lucide-react';
import { useShips } from '@/hooks/useShips';
import { useUserShips, useUpdateUserShips } from '@/hooks/useUserShips';
import { type ProfileWithRole } from '@/hooks/useProfiles';

interface UserShipsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithRole | null;
}

export function UserShipsDialog({ open, onOpenChange, user }: UserShipsDialogProps) {
  const { data: ships, isLoading: shipsLoading } = useShips();
  const { data: userShips, isLoading: userShipsLoading } = useUserShips(user?.user_id);
  const updateUserShips = useUpdateUserShips();
  
  const [selectedShips, setSelectedShips] = useState<string[]>([]);

  useEffect(() => {
    if (userShips) {
      setSelectedShips(userShips.map(us => us.ship_id));
    }
  }, [userShips]);

  const handleToggleShip = (shipId: string) => {
    setSelectedShips(prev => 
      prev.includes(shipId)
        ? prev.filter(id => id !== shipId)
        : [...prev, shipId]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    
    try {
      await updateUserShips.mutateAsync({
        userId: user.user_id,
        shipIds: selectedShips,
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const isLoading = shipsLoading || userShipsLoading;

  if (!user) return null;

  const userRole = user.user_roles?.[0]?.role as string | undefined;
  const isAdminRole = userRole === 'admin' || userRole === 'admin_master';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Anchor className="h-5 w-5 text-primary" />
            Atribuir Navios
          </DialogTitle>
          <DialogDescription>
            Selecione os navios que <strong>{user.full_name}</strong> terá acesso
          </DialogDescription>
        </DialogHeader>

        {isAdminRole && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm text-primary">
              <strong>Nota:</strong> Usuários com perfil Admin ou Admin Master 
              têm acesso a todos os navios automaticamente.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : ships && ships.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Ship className="h-12 w-12 mb-2" />
            <p>Nenhum navio cadastrado</p>
            <p className="text-sm">Cadastre navios primeiro na aba "Navios"</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px] pr-4">
            <div className="space-y-2">
              {ships?.map((ship) => (
                <label
                  key={ship.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedShips.includes(ship.id)}
                    onCheckedChange={() => handleToggleShip(ship.id)}
                    disabled={isAdminRole}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <Ship className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{ship.name}</p>
                      {ship.code && (
                        <p className="text-xs text-muted-foreground">{ship.code}</p>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateUserShips.isPending || isAdminRole}
          >
            {updateUserShips.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
