import { useMemo } from 'react';
import { Users, TrendingUp, Award, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInspectorStats } from '@/hooks/useInspectorStats';
import { useTranslation } from 'react-i18next';

export function InspectorPerformanceCard() {
  const { t } = useTranslation();
  const { data, isLoading } = useInspectorStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('inspectorPerformance.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.inspectorStats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('inspectorPerformance.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('inspectorPerformance.noInspections')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{t('inspectorPerformance.title')}</CardTitle>
              <CardDescription>{t('inspectorPerformance.last3Months')}</CardDescription>
            </div>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="outline" className="gap-1">
            <TrendingUp className="h-3 w-3" />
            {data.overallStats.totalInspections} {t('inspectorPerformance.inspections')}
          </Badge>
          <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-600">
            <Award className="h-3 w-3" />
            {t('inspectorPerformance.best')}: {data.overallStats.bestPerformer}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[280px]">
          <div className="space-y-4 pr-4">
            {data.inspectorStats.map((inspector, index) => (
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
                  <Badge variant="secondary">{inspector.totalInspections} {t('inspectorPerformance.inspections')}</Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t('inspectorPerformance.inspections')}</span>
                    <span className="font-medium">{inspector.totalInspections}</span>
                  </div>
                  <Progress value={data.inspectorStats.length > 0 ? (inspector.totalInspections / data.inspectorStats[0].totalInspections) * 100 : 0} className="h-2" />

                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    <div className="text-center p-1 rounded bg-green-500/10">
                      <span className="text-green-600 font-medium">{inspector.approvedCount}</span>
                      <p className="text-muted-foreground">{t('inspectorPerformance.approved')}</p>
                    </div>
                    <div className="text-center p-1 rounded bg-amber-500/10">
                      <span className="text-amber-600 font-medium">{inspector.attentionCount}</span>
                      <p className="text-muted-foreground">{t('inspectorPerformance.attention')}</p>
                    </div>
                    <div className="text-center p-1 rounded bg-red-500/10">
                      <span className="text-red-600 font-medium">{inspector.rejectedCount}</span>
                      <p className="text-muted-foreground">{t('inspectorPerformance.rejected')}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}