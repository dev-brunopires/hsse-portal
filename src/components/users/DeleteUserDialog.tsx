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
import { useDeleteUser } from '@/hooks/useUserRoles';
import type { ProfileWithRole } from '@/hooks/useProfiles';

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithRole | null;
}

export function DeleteUserDialog({ open, onOpenChange, user }: DeleteUserDialogProps) {
  const { t } = useTranslation();
  const deleteUser = useDeleteUser();

  const handleDelete = async () => {
    if (!user) return;
    
    await deleteUser.mutateAsync(user.user_id);
    onOpenChange(false);
  };

  if (!user) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dialogs.removeUser')}</AlertDialogTitle>
          <AlertDialogDescription>
            <span dangerouslySetInnerHTML={{ 
              __html: t('dialogs.removeUserConfirm', { name: user.full_name }) 
            }} />
            <br /><br />
            {t('dialogs.removeUserWarning')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteUser.isPending}
          >
            {deleteUser.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('dialogs.removing')}
              </>
            ) : (
              t('dialogs.removeUser')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
