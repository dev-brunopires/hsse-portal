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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, KeyRound, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ProfileWithRole } from '@/hooks/useProfiles';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithRole | null;
}

export function ResetPasswordDialog({ open, onOpenChange, user }: ResetPasswordDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    }
  }, [open]);

  if (!user) return null;

  const handleSubmit = async () => {
    if (password.length < 6) {
      toast.error(t('resetPasswordDialog.minLengthError', 'A senha deve ter pelo menos 6 caracteres.'));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('resetPasswordDialog.mismatch', 'As senhas não coincidem.'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { userId: user.user_id, newPassword: password },
      });

      if (error || (data && (data as { error?: string }).error)) {
        const msg = (data as { error?: string })?.error || error?.message || t('resetPasswordDialog.failed', 'Falha ao redefinir senha.');
        toast.error(msg);
        return;
      }

      toast.success(t('resetPasswordDialog.success', 'Senha redefinida com sucesso. Informe a nova senha ao usuário.'));
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('resetPasswordDialog.failed', 'Falha ao redefinir senha.'));
    } finally {
      setLoading(false);
    }
  };

  const generateSuggested = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setPassword(out);
    setConfirmPassword(out);
    setShowPassword(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {t('resetPasswordDialog.title', 'Redefinir senha')}
          </DialogTitle>
          <DialogDescription>
            {t('resetPasswordDialog.description', 'Defina uma nova senha temporária para o usuário. Ele poderá alterá-la após o login.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">{t('auth.email')}</Label>
            <p className="text-sm font-medium">{user.full_name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {t('resetPasswordDialog.warning', 'Esta ação é registrada na auditoria. Compartilhe a nova senha por um canal seguro.')}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="new-password">{t('resetPasswordDialog.newPassword', 'Nova senha')}</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('resetPasswordDialog.newPasswordPlaceholder', 'Mínimo 6 caracteres')}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8"
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('resetPasswordDialog.confirmPassword', 'Confirmar senha')}</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <Button type="button" variant="outline" size="sm" onClick={generateSuggested} className="w-full">
            {t('resetPasswordDialog.generate', 'Gerar senha aleatória')}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !password || !confirmPassword}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('dialogs.saving')}
              </>
            ) : (
              t('resetPasswordDialog.confirm', 'Redefinir senha')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
