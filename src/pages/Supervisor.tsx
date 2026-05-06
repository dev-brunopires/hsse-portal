import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useProfiles } from '@/hooks/useProfiles';
import { useInspectorStats } from '@/hooks/useInspectorStats';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, ClipboardCheck, Wrench, AlertTriangle, Award,
  Clock, TrendingUp, BarChart3, CheckCircle, XCircle
} from 'lucide-react';
import { format, subDays, differenceInDays } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Supervisor() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? enUS : ptBR;
  const { selectedShipId, isFilterEnabled, isReady } = useShipFilter();
  const { data: profiles = [] } = useProfiles();
  const { data: inspectorData, isLoading: inspectorLoading } = useInspectorStats();

  // Fetch team pending tasks
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['supervisor-team-data', selectedShipId],
    enabled: isReady,
    queryFn: async () => {
      // Get all technicians/admins
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const techIds = roles?.filter(r => ['technician', 'admin', 'admin_master', 'supervisor'].includes(r.role)).map(r => r.user_id) || [];

      // Pending inspections per user (equipment needing inspection)
      const today = new Date().toISOString().split('T')[0];

      let pendingInspQuery = supabase
        .from('equipment')
        .select('id, next_inspection, ship_id')
        .lte('next_inspection', today)
        .not('next_inspection', 'is', null);

      if (isFilterEnabled && selectedShipId) {
        pendingInspQuery = pendingInspQuery.eq('ship_id', selectedShipId);
      }

      const { data: pendingEquip } = await pendingInspQuery;

      // Pending maintenance
      let pendingMaintQuery = supabase
        .from('maintenance_requests')
        .select('id, status, priority, equipment_id, title, due_date, requested_by')
        .in('status', ['pending', 'approved', 'in_progress']);

      if (isFilterEnabled && selectedShipId) {
        pendingMaintQuery = pendingMaintQuery.eq('ship_id', selectedShipId);
      }

      const { data: pendingMaint } = await pendingMaintQuery;

      // Recent inspections (last 30 days)
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0];
      let recentInspQuery = supabase
        .from('inspections')
        .select('id, status, inspector_id, inspection_date')
        .gte('inspection_date', thirtyDaysAgo);

      if (isFilterEnabled && selectedShipId) {
        recentInspQuery = recentInspQuery.eq('ship_id', selectedShipId);
      }

      const { data: recentInsp } = await recentInspQuery;

      // Group recent inspections by inspector
      const inspByInspector = new Map<string, { total: number; compliant: number; nc: number }>();
      recentInsp?.forEach(insp => {
        const current = inspByInspector.get(insp.inspector_id) || { total: 0, compliant: 0, nc: 0 };
        current.total++;
        if (insp.status === 'compliant') current.compliant++;
        else current.nc++;
        inspByInspector.set(insp.inspector_id, current);
      });

      // Overdue maintenance
      const overdueMaint = pendingMaint?.filter(m => m.due_date && m.due_date < today) || [];

      return {
        pendingInspections: pendingEquip?.length || 0,
        pendingMaintenance: pendingMaint?.length || 0,
        overdueMaintenance: overdueMaint.length,
        criticalMaintenance: pendingMaint?.filter(m => m.priority === 'critical').length || 0,
        recentInspections: recentInsp?.length || 0,
        inspByInspector,
        techIds,
        topMaintenances: pendingMaint?.sort((a, b) => {
          const prio = { critical: 0, high: 1, medium: 2, low: 3 };
          return (prio[a.priority] || 3) - (prio[b.priority] || 3);
        }).slice(0, 5) || [],
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = inspectorLoading || teamLoading;

  // Team productivity chart data
  const teamChartData = useMemo(() => {
    if (!teamData || !profiles.length) return [];

    return Array.from(teamData.inspByInspector.entries()).map(([id, stats]) => {
      const profile = profiles.find(p => p.user_id === id);
      return {
        name: profile?.full_name?.split(' ').slice(0, 2).join(' ') || t('common.noData'),
        inspections: stats.total,
        compliant: stats.compliant,
        nc: stats.nc,
      };
    }).sort((a, b) => b.inspections - a.inspections).slice(0, 8);
  }, [teamData, profiles, t]);

  const priorityLabels: Record<string, string> = {
    low: t('maintenance.priorityLow'),
    medium: t('maintenance.priorityMedium'),
    high: t('maintenance.priorityHigh'),
    critical: t('maintenance.priorityCritical'),
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-blue-500/10 text-blue-600',
    medium: 'bg-amber-500/10 text-amber-600',
    high: 'bg-orange-500/10 text-orange-600',
    critical: 'bg-red-500/10 text-red-600',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('supervisor.title')}
        subtitle={t('supervisor.subtitle')}
        icon={Users}
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))}
          </div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <>
          {/* KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{teamData?.recentInspections || 0}</p>
                    <p className="text-xs text-muted-foreground">{t('supervisor.inspections30d')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{teamData?.pendingInspections || 0}</p>
                    <p className="text-xs text-muted-foreground">{t('supervisor.overdueInspections')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-500/10">
                    <Wrench className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{teamData?.pendingMaintenance || 0}</p>
                    <p className="text-xs text-muted-foreground">{t('supervisor.pendingMaintenance')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-destructive/10">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{teamData?.criticalMaintenance || 0}</p>
                    <p className="text-xs text-muted-foreground">{t('supervisor.criticalItems')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team Productivity Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t('supervisor.teamProductivity')}</CardTitle>
                    <CardDescription>{t('supervisor.teamProductivityDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {teamChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={teamChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                      <Tooltip contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }} />
                      <Bar dataKey="compliant" name={t('supervisor.compliant')} stackId="a" fill="hsl(var(--chart-2))" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="nc" name={t('supervisor.nonCompliant')} stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">{t('common.noData')}</div>
                )}
              </CardContent>
            </Card>

            {/* Inspector Rankings */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Award className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t('supervisor.inspectorRanking')}</CardTitle>
                    <CardDescription>{t('supervisor.inspectorRankingDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-3 pr-2">
                    {inspectorData?.inspectorStats.map((inspector, index) => (
                      <div key={inspector.inspectorId} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {index < 3 && (
                              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                                {index + 1}
                              </span>
                            )}
                            <span className="font-medium text-sm">{inspector.inspectorName}</span>
                          </div>
                          <Badge variant="secondary">{inspector.totalInspections}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{t('inspectorPerformance.inspections')}</span>
                          <span className="font-medium">{inspector.totalInspections}</span>
                        </div>
                        <Progress value={inspectorData?.inspectorStats[0] ? (inspector.totalInspections / inspectorData.inspectorStats[0].totalInspections) * 100 : 0} className="h-1.5" />
                      </div>
                    )) || (
                      <div className="text-center py-8 text-muted-foreground text-sm">{t('common.noData')}</div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Critical Maintenance Queue */}
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <Wrench className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <CardTitle>{t('supervisor.maintenanceQueue')}</CardTitle>
                  <CardDescription>{t('supervisor.maintenanceQueueDesc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {teamData?.topMaintenances.length ? (
                <div className="space-y-3">
                  {teamData.topMaintenances.map((maint) => {
                    const isOverdue = maint.due_date && maint.due_date < new Date().toISOString().split('T')[0];
                    return (
                      <div key={maint.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3 min-w-0">
                          <Badge className={priorityColors[maint.priority]}>{priorityLabels[maint.priority]}</Badge>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{maint.title}</p>
                            {maint.due_date && (
                              <p className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                {isOverdue ? `⚠ ${t('supervisor.overdue')}` : ''} {format(new Date(maint.due_date), 'dd/MM/yyyy', { locale: dateLocale })}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline">{maint.status}</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  {t('supervisor.noUrgent')}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
