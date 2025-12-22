import { useMemo } from 'react';
import { AlertOctagon, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { useEquipment } from '@/hooks/useEquipment';
import { getEffectiveEquipmentStatus } from '@/utils/equipmentStatus';
import { useTranslation } from 'react-i18next';

export function CriticalEquipmentCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: equipment = [], isLoading } = useEquipment();

  const criticalEquipment = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    return equipment
      .map((eq) => {
        const effectiveResult = getEffectiveEquipmentStatus(eq);
        let score = 0;
        const issues: string[] = [];

        // Expired certificate
        if (eq.certificate_expiry && eq.certificate_expiry < today) {
          score += 40;
          issues.push(t('criticalEquipment.certificateExpired'));
        }

        // Expired hydrostatic test
        if (eq.expiry_date && eq.expiry_date < today) {
          score += 40;
          issues.push(t('criticalEquipment.hydrostaticExpired'));
        }

        // Rejected status
        if (effectiveResult.effectiveStatus === 'rejected') {
          score += 30;
          const rejectedLabel = t('criticalEquipment.rejected');
          if (!issues.includes(rejectedLabel)) issues.push(rejectedLabel);
        }

        // Overdue inspection
        if (eq.next_inspection && eq.next_inspection < today) {
          score += 20;
          issues.push(t('criticalEquipment.overdueInspection'));
        }

        // Attention status
        if (eq.status === 'maintenance') {
          score += 10;
          issues.push(t('criticalEquipment.inMaintenance'));
        }

        return {
          ...eq,
          criticalScore: score,
          issues,
          effectiveStatus: effectiveResult.effectiveStatus,
        };
      })
      .filter((eq) => eq.criticalScore > 0)
      .sort((a, b) => b.criticalScore - a.criticalScore)
      .slice(0, 10);
  }, [equipment, t]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertOctagon className="h-5 w-5" />
            {t('criticalEquipment.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
            ))}
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
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertOctagon className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-base">{t('criticalEquipment.top10Title')}</CardTitle>
              <CardDescription>{t('criticalEquipment.requiresAttention')}</CardDescription>
            </div>
          </div>
          {criticalEquipment.length > 0 && (
            <Badge variant="destructive">{criticalEquipment.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {criticalEquipment.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertOctagon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('criticalEquipment.noCritical')}</p>
            <p className="text-xs">{t('criticalEquipment.allInOrder')}</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-3 pr-4">
              {criticalEquipment.map((eq, index) => (
                <div
                  key={eq.id}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate('/equipment')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg text-muted-foreground">
                          #{index + 1}
                        </span>
                        <span className="font-medium text-sm truncate">{eq.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{eq.internal_code}</p>
                      <div className="flex flex-wrap gap-1">
                        {eq.issues.map((issue, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-xs bg-red-500/10 text-red-600 border-red-200"
                          >
                            {issue}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
