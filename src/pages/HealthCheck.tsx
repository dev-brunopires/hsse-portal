import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Activity, 
  RefreshCw, 
  Download, 
  Database, 
  Zap, 
  HardDrive, 
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useHealthCheck, type HealthStatus } from '@/hooks/useHealthCheck';
import { HealthCheckCard } from '@/components/health-check/HealthCheckCard';
import { HealthCheckProgress } from '@/components/health-check/HealthCheckProgress';
import { HealthCheckHistory } from '@/components/health-check/HealthCheckHistory';
import { cn } from '@/lib/utils';

const iconMap: Record<string, typeof Database> = {
  Database,
  Zap,
  HardDrive,
  Shield,
  Activity,
};

const statusConfig: Record<HealthStatus, { icon: typeof CheckCircle2; label: string; color: string; bgColor: string }> = {
  ok: { icon: CheckCircle2, label: 'Operational', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-950' },
  warning: { icon: AlertTriangle, label: 'Degraded', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-950' },
  error: { icon: XCircle, label: 'Down', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-950' },
  pending: { icon: Clock, label: 'Pending', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  running: { icon: RefreshCw, label: 'Checking', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-950' },
};

export default function HealthCheck() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAdminMaster, isPlatformOwner, loading: authLoading } = useAuth();
  const locale = i18n.language === 'pt-BR' ? ptBR : enUS;
  
  const {
    categories,
    isRunning,
    progress,
    totalChecks,
    completedChecks,
    runAllChecks,
    runCategoryCheck,
    lastRunTime,
    history,
  } = useHealthCheck();

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !isAdminMaster && !isPlatformOwner) {
      navigate('/');
    }
  }, [authLoading, isAdminMaster, isPlatformOwner, navigate]);

  if (authLoading) {
    return null;
  }

  if (!isAdminMaster && !isPlatformOwner) {
    return null;
  }

  // Calculate overall status
  const hasError = categories.some(c => c.overallStatus === 'error');
  const hasWarning = categories.some(c => c.overallStatus === 'warning');
  const allPending = categories.every(c => c.overallStatus === 'pending');
  const overallStatus: HealthStatus = isRunning ? 'running' : hasError ? 'error' : hasWarning ? 'warning' : allPending ? 'pending' : 'ok';
  const overallConfig = statusConfig[overallStatus];
  const OverallIcon = overallConfig.icon;

  const handleExport = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      categories: categories.map(cat => ({
        ...cat,
        results: cat.results.map(r => ({
          ...r,
          timestamp: new Date(r.timestamp).toISOString(),
        })),
      })),
      history: history.slice(0, 10),
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-check-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title={t('healthCheck.title')}
        subtitle={t('healthCheck.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isRunning || categories.every(c => c.results.length === 0)}
            >
              <Download className="h-4 w-4 mr-2" />
              {t('healthCheck.export')}
          </Button>
          <Button
            onClick={runAllChecks}
            disabled={isRunning}
            size="sm"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRunning && 'animate-spin')} />
            {isRunning ? t('healthCheck.running') : t('healthCheck.runAll')}
          </Button>
        </div>
        }
      />

      {/* Overall Status Card */}
      <Card className={cn('border-2', overallConfig.bgColor)}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn('p-3 rounded-full', overallConfig.bgColor)}>
                <OverallIcon className={cn('h-8 w-8', overallConfig.color, isRunning && 'animate-spin')} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  {t(`healthCheck.status.${overallStatus}`)}
                </h2>
                <p className="text-muted-foreground">
                  {lastRunTime ? (
                    <>
                      {t('healthCheck.lastCheck')}: {format(new Date(lastRunTime), 'dd/MM/yyyy HH:mm:ss', { locale })}
                    </>
                  ) : (
                    t('healthCheck.neverChecked')
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              {categories.map(cat => {
                const catConfig = statusConfig[cat.overallStatus];
                const CatIcon = catConfig.icon;
                return (
                  <div key={cat.id} className="text-center">
                    <CatIcon className={cn('h-5 w-5 mx-auto mb-1', catConfig.color, cat.overallStatus === 'running' && 'animate-spin')} />
                    <p className="text-xs text-muted-foreground">{cat.name}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <HealthCheckProgress
        progress={progress}
        completedChecks={completedChecks}
        totalChecks={totalChecks}
        isRunning={isRunning}
      />

      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(category => (
          <HealthCheckCard
            key={category.id}
            category={category}
            onRefresh={() => runCategoryCheck(category.id)}
            isRefreshing={category.overallStatus === 'running'}
          />
        ))}
      </div>

      {/* History */}
      <HealthCheckHistory history={history} />
    </div>
  );
}
