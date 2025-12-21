import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          <AlertDialogTitle>{t('dialogs.removeShip')}</AlertDialogTitle>
          <AlertDialogDescription>
            <span dangerouslySetInnerHTML={{ 
              __html: t('dialogs.removeShipConfirm', { name: ship.name }) 
            }} />
            <br /><br />
            {t('dialogs.removeShipWarning')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteShip.isPending}
          >
            {deleteShip.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('dialogs.removing')}
              </>
            ) : (
              t('dialogs.removeShip')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
