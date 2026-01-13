import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { telemetry, TelemetryEvent } from '@/utils/clientTelemetry';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  Download, 
  Trash2, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Clock, 
  User, 
  Building2,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Diagnostics() {
  const { t, i18n } = useTranslation();
  const { user, profile, role, isPlatformOwner, sessionUnstable } = useAuth();
  const { organization, subdomain, isLoading: orgLoading } = useOrganization();
  
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sessionInfo, setSessionInfo] = useState<{ expiresAt: number | null; lastRefresh: number | null }>({
    expiresAt: null,
    lastRefresh: null,
  });

  // Only admin_master and platform_owner can access
  const canAccess = role === 'admin_master' || isPlatformOwner;

  useEffect(() => {
    // Load telemetry buffer
    setEvents(telemetry.readLocal());

    // Get session info
    const getSessionInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionInfo({
          expiresAt: session.expires_at ? session.expires_at * 1000 : null,
          lastRefresh: Date.now(),
        });
      }
    };
    getSessionInfo();

    // Network status listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshEvents = () => {
    setEvents(telemetry.readLocal());
  };

  const clearLocalBuffer = () => {
    localStorage.removeItem('client_telemetry_buffer_v1');
    setEvents([]);
  };

  const exportLogs = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user?.id,
        email: user?.email,
        role: role,
        isPlatformOwner,
      },
      organization: organization ? {
        id: organization.id,
        name: organization.name,
        subdomain: organization.subdomain,
      } : null,
      session: {
        expiresAt: sessionInfo.expiresAt ? new Date(sessionInfo.expiresAt).toISOString() : null,
        isUnstable: sessionUnstable,
      },
      network: {
        isOnline,
      },
      telemetryEvents: events,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return <Badge variant="destructive" className="text-xs"><XCircle className="w-3 h-3 mr-1" />error</Badge>;
      case 'warn':
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />warn</Badge>;
      case 'info':
        return <Badge variant="secondary" className="text-xs"><Info className="w-3 h-3 mr-1" />info</Badge>;
      case 'debug':
        return <Badge variant="outline" className="text-xs">debug</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{level}</Badge>;
    }
  };

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  const sessionExpiresIn = sessionInfo.expiresAt 
    ? Math.max(0, Math.round((sessionInfo.expiresAt - Date.now()) / 1000 / 60))
    : null;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            {t('diagnostics.title', 'Diagnóstico do Sistema')}
          </h1>
          <p className="text-muted-foreground">
            {t('diagnostics.description', 'Monitoramento de sessão, rede e telemetria')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshEvents}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh', 'Atualizar')}
          </Button>
          <Button variant="default" size="sm" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" />
            {t('diagnostics.exportLogs', 'Exportar Logs')}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Network Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
              {t('diagnostics.network', 'Rede')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Online
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" />
                  Offline
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Session Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('diagnostics.session', 'Sessão')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {sessionUnstable ? (
                <Badge variant="destructive">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {t('header.sessionUnstable', 'Instável')}
                </Badge>
              ) : (
                <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {t('diagnostics.stable', 'Estável')}
                </Badge>
              )}
              {sessionExpiresIn !== null && (
                <p className="text-xs text-muted-foreground">
                  {t('diagnostics.expiresIn', 'Expira em')}: {sessionExpiresIn} min
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* User Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              {t('diagnostics.user', 'Usuário')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-sm font-medium truncate">{profile?.full_name || user?.email}</p>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  {role}
                </Badge>
                {isPlatformOwner && (
                  <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30 text-xs">
                    Platform Owner
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organization Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {t('diagnostics.organization', 'Organização')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orgLoading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading', 'Carregando...')}</p>
            ) : organization ? (
              <div className="space-y-1">
                <p className="text-sm font-medium truncate">{organization.name}</p>
                <p className="text-xs text-muted-foreground">
                  {subdomain || organization.subdomain}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('diagnostics.noOrganization', 'Sem organização')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Telemetry Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {t('diagnostics.telemetryBuffer', 'Buffer de Telemetria')}
              </CardTitle>
              <CardDescription>
                {events.length} {t('diagnostics.eventsStored', 'eventos armazenados localmente')}
              </CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearLocalBuffer}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('diagnostics.clearBuffer', 'Limpar')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] rounded-md border">
            {events.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {t('diagnostics.noEvents', 'Nenhum evento registrado')}
              </div>
            ) : (
              <div className="divide-y">
                {[...events].reverse().map((event, index) => (
                  <div key={index} className="p-3 hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getLevelBadge(event.level)}
                        <span className="font-mono text-sm font-medium">{event.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(event.ts), 'HH:mm:ss', { locale: i18n.language === 'pt-BR' ? ptBR : undefined })}
                      </span>
                    </div>
                    {event.data && Object.keys(event.data).length > 0 && (
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {t('diagnostics.debugInfo', 'Informações de Debug')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
{JSON.stringify({
  userAgent: navigator.userAgent,
  language: navigator.language,
  hostname: window.location.hostname,
  pathname: window.location.pathname,
  search: window.location.search,
  subdomain,
  timestamp: new Date().toISOString(),
}, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}