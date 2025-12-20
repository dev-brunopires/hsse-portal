import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useDeleteShip, type Ship } from '@/hooks/useShips';

interface DeleteShipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ship: Ship | null;
}

export function DeleteShipDialog({ open, onOpenChange, ship }: DeleteShipDialogProps) {
  const deleteShip = useDeleteShip();

  const handleDelete = async () => {
    if (!ship) return;
    
    try {
      await deleteShip.mutateAsync(ship.id);
      onOpenChange(false);
    } catch (error) {
      // Error handled in mutation
    }
  };

  if (!ship) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover Navio</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover o navio <strong>{ship.name}</strong>?
            <br /><br />
            Esta ação não pode ser desfeita. Equipamentos e inspeções associados a este navio 
            perderão a referência.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteShip.isPending}
          >
            {deleteShip.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Removendo...
              </>
            ) : (
              'Remover Navio'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
