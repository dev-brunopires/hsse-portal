import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode, Hash, Loader2 } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hapticButton, hapticError } from '@/utils/hapticFeedback';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getAllFromStore, type CachedEquipment } from '@/utils/offlineStorage';

interface MobileScanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: (equipmentId: string) => void;
  onOpenScanner: () => void;
}

export function MobileScanDrawer({ open, onOpenChange, onResolved, onOpenScanner }: MobileScanDrawerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [mode, setMode] = useState<'menu' | 'code'>('menu');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const CODE_REGEX = /^\d{6}$/;

  const reset = () => {
    setMode('menu');
    setCode('');
    setError(null);
    setLoading(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleQrOption = () => {
    hapticButton();
    onOpenChange(false);
    setTimeout(() => {
      reset();
      onOpenScanner();
    }, 150);
  };

  const handleCodeOption = () => {
    hapticButton();
    setMode('code');
  };

  const resolveByCode = async (rawCode: string): Promise<string | null> => {
    const trimmed = rawCode.trim();
    if (!trimmed) return null;

    // Online lookup
    if (navigator.onLine) {
      try {
        const isShortCode = /^\d{6}$/.test(trimmed);
        let query = supabase.from('equipment').select('id').limit(1);
        if (isShortCode) {
          query = query.eq('short_code', trimmed);
        } else {
          query = query.eq('internal_code', trimmed);
        }
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        if (data?.id) return data.id;
      } catch {
        // fall through to offline
      }
    }

    // Offline / fallback lookup
    try {
      const cached = await getAllFromStore<CachedEquipment>('equipment');
      const found = cached.find(
        (e) =>
          e.short_code === trimmed ||
          (e as any).internal_code === trimmed ||
          e.id === trimmed
      );
      return found?.id || null;
    } catch {
      return null;
    }
  };

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    const id = await resolveByCode(code);
    setLoading(false);
    if (id) {
      hapticButton();
      onOpenChange(false);
      setTimeout(() => {
        reset();
        onResolved(id);
      }, 150);
    } else {
      hapticError();
      toast({
        title: t('inspections.equipmentNotFound'),
        description: t('inspections.qrNotMatchEquipment'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="pwa-safe-bottom">
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader className="text-left">
            <DrawerTitle>
              {mode === 'menu' ? t('equipment.findEquipment') : t('equipment.searchByCode')}
            </DrawerTitle>
            <DrawerDescription>
              {mode === 'menu'
                ? t('equipment.findEquipmentDescription')
                : t('equipment.searchByCodeDescription')}
            </DrawerDescription>
          </DrawerHeader>

          {mode === 'menu' ? (
            <div className="grid grid-cols-2 gap-3 px-4 pb-4">
              <button
                type="button"
                onClick={handleQrOption}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-5 transition-colors hover:bg-accent active:scale-95 min-h-[120px]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <QrCode className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium">{t('equipment.scanQRCode')}</span>
              </button>

              <button
                type="button"
                onClick={handleCodeOption}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-5 transition-colors hover:bg-accent active:scale-95 min-h-[120px]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Hash className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium">{t('equipment.searchByCode')}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitCode} className="px-4 pb-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="equipment-code">{t('equipment.codeLabel')}</Label>
                <Input
                  id="equipment-code"
                  autoFocus
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t('equipment.codePlaceholder')}
                  className="text-base"
                />
              </div>
              <Button type="submit" className="w-full" disabled={!code.trim() || loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.search')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode('menu')}
                disabled={loading}
              >
                {t('common.back')}
              </Button>
            </form>
          )}

          {mode === 'menu' && (
            <DrawerFooter className="pt-2">
              <DrawerClose asChild>
                <Button variant="outline">{t('common.cancel')}</Button>
              </DrawerClose>
            </DrawerFooter>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
