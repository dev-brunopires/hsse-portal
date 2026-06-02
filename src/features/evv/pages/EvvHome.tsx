import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Cloud, CloudOff, ClipboardList, History, BarChart3, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { countUnsynced, syncAllUnsynced } from '../offline';
import { PageHeader } from '@/components/layout/PageHeader';

export default function EvvHome() {
  const { t } = useTranslation();
  const { user, isAdmin, isAdminMaster, isPlatformOwner } = useAuth();
  const { organization } = useOrganization();
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncing, setSyncing] = useState(false);

  async function refresh() {
    setPending(await countUnsynced());
  }

  useEffect(() => {
    refresh();
    const on = () => { setOnline(true); void handleSync(true); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    // auto-sync on mount if online
    if (typeof navigator !== 'undefined' && navigator.onLine) void handleSync(true);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, organization?.id]);

  async function handleSync(silent = false) {
    if (!user || !organization?.id) {
      if (!silent) toast.error(t('evv.sync.noContext'));
      return;
    }
    if (!navigator.onLine) {
      if (!silent) toast.error(t('evv.sync.offline'));
      return;
    }
    const pendingNow = await countUnsynced();
    if (pendingNow === 0) { if (!silent) toast.info(t('evv.sync.pending', { count: 0 })); return; }
    setSyncing(true);
    const id = silent ? null : toast.loading(t('evv.sync.ongoing'));
    const { synced, failed, lastError } = await syncAllUnsynced(organization.id, user.id);
    if (id) toast.dismiss(id);
    if (failed > 0) {
      toast.error(`${t('evv.sync.partial', { synced, failed })}${lastError ? ` — ${lastError}` : ''}`);
    } else if (synced > 0) {
      toast.success(t('evv.sync.completed', { count: synced }));
    }
    setSyncing(false);
    refresh();
  }

  const canReports = isAdmin || isAdminMaster || isPlatformOwner;

  return (
    <div className="space-y-6">
      <PageHeader icon={ShieldCheck} title={t('evv.title')} description={t('evv.subtitle')} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {online ? <Cloud className="h-5 w-5 text-primary" /> : <CloudOff className="h-5 w-5 text-muted-foreground" />}
            <CardTitle className="text-lg">{t('evv.sync.title')}</CardTitle>
          </div>
          <Button onClick={handleSync} disabled={syncing || pending === 0 || !online}>
            <RefreshCw className={syncing ? 'animate-spin' : ''} />
            {t('evv.sync.button', { count: pending })}
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {online ? t('evv.sync.online') : t('evv.sync.offline')}
          {' · '}
          {t('evv.sync.pending', { count: pending })}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/evv/forms">
          <Card className="hover:border-primary transition-colors h-full">
            <CardHeader>
              <ClipboardList className="h-6 w-6 text-primary" />
              <CardTitle className="text-base mt-2">{t('evv.nav.forms')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{t('evv.home.formsDesc')}</CardContent>
          </Card>
        </Link>
        <Link to="/evv/history">
          <Card className="hover:border-primary transition-colors h-full">
            <CardHeader>
              <History className="h-6 w-6 text-primary" />
              <CardTitle className="text-base mt-2">{t('evv.nav.history')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{t('evv.home.historyDesc')}</CardContent>
          </Card>
        </Link>
        {canReports && (
          <Link to="/evv/reports">
            <Card className="hover:border-primary transition-colors h-full">
              <CardHeader>
                <BarChart3 className="h-6 w-6 text-primary" />
                <CardTitle className="text-base mt-2">{t('evv.nav.reports')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{t('evv.home.reportsDesc')}</CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
