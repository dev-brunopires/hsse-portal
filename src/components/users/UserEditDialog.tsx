import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPen } from 'lucide-react';
import { useUpdateProfile } from '@/hooks/useUserRoles';
import type { ProfileWithRole } from '@/hooks/useProfiles';

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithRole | null;
}

export function UserEditDialog({ open, onOpenChange, user }: UserEditDialogProps) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const updateProfile = useUpdateProfile();

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    
    await updateProfile.mutateAsync({
      userId: user.user_id,
      fullName,
    });
    
    onOpenChange(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPen className="h-5 w-5 text-primary" />
            {t('dialogs.editUser')}
          </DialogTitle>
          <DialogDescription>
            {t('dialogs.updateUserInfo')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('auth.email')}</Label>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">{t('dialogs.fullName')}</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('users.userName')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={updateProfile.isPending || !fullName.trim()}>
            {updateProfile.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('dialogs.saving')}
              </>
            ) : (
              t('dialogs.saveChanges')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
