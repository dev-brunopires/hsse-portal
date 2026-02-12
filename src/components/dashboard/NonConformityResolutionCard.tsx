import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, Clock, TrendingDown } from 'lucide-react';
import { differenceInDays, subMonths } from 'date-fns';

export function NonConformityResolutionCard() {
  const { t } = useTranslation();
  const { selectedShipId, isFilterEnabled, isReady } = useShipFilter();

  const { data, isLoading } = useQuery({
    queryKey: ['non-conformity-resolution', selectedShipId],
    enabled: isReady,
    queryFn: async () => {
      const sixMonthsAgo = subMonths(new Date(), 6).toISOString().split('T')[0];

      let query = supabase
        .from('inspections')
        .select('id, status, inspection_date, equipment_id, created_at')
        .in('status', ['non-compliant', 'attention'])
        .gte('inspection_date', sixMonthsAgo);

      if (isFilterEnabled && selectedShipId) {
        query = query.eq('ship_id', selectedShipId);
      }

      const { data: ncInspections } = await query;

      // For each NC inspection, check if there's a subsequent compliant one
      let resolved = 0;
      let totalDays = 0;
      const total = ncInspections?.length || 0;

      if (ncInspections) {
        for (const nc of ncInspections) {
          const { data: resolved_ } = await supabase
            .from('inspections')
            .select('inspection_date')
            .eq('equipment_id', nc.equipment_id)
            .eq('status', 'compliant')
            .gt('inspection_date', nc.inspection_date)
            .order('inspection_date', { ascending: true })
            .limit(1);

          if (resolved_ && resolved_.length > 0) {
            resolved++;
            totalDays += differenceInDays(
              new Date(resolved_[0].inspection_date),
              new Date(nc.inspection_date)
            );
          }
        }
      }

      const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
      const avgDays = resolved > 0 ? Math.round(totalDays / resolved) : 0;

      return {
        total,
        resolved,
        pending: total - resolved,
        resolutionRate,
        avgResolutionDays: avgDays,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-destructive/10 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <CardTitle>{t('dashboard.ncResolution')}</CardTitle>
            <CardDescription>{t('dashboard.ncResolutionDesc')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resolution rate */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">{t('dashboard.resolutionRate')}</span>
            <span className="font-bold text-lg">{data.resolutionRate}%</span>
          </div>
          <Progress value={data.resolutionRate} className="h-3" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="flex items-center justify-center gap-1 text-destructive mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xl font-bold">{data.total}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('dashboard.totalNC')}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xl font-bold">{data.resolved}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('dashboard.resolved')}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xl font-bold">{data.pending}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('dashboard.pendingNC')}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="flex items-center justify-center gap-1 text-primary mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xl font-bold">{data.avgResolutionDays}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('dashboard.avgDays')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
