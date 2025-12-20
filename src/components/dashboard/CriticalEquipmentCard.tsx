import { useMemo } from 'react';
import { AlertOctagon, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEquipment } from '@/hooks/useEquipment';
import { getEffectiveEquipmentStatus } from '@/utils/equipmentStatus';

export function CriticalEquipmentCard() {
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
          issues.push('Certificado vencido');
        }

        // Expired hydrostatic test
        if (eq.expiry_date && eq.expiry_date < today) {
          score += 40;
          issues.push('Teste hidrostático vencido');
        }

        // Rejected status
        if (effectiveResult.effectiveStatus === 'rejected') {
          score += 30;
          if (!issues.includes('Reprovado')) issues.push('Reprovado');
        }

        // Overdue inspection
        if (eq.next_inspection && eq.next_inspection < today) {
          score += 20;
          issues.push('Inspeção atrasada');
        }

        // Attention status
        if (eq.status === 'maintenance') {
          score += 10;
          issues.push('Em manutenção');
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
  }, [equipment]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertOctagon className="h-5 w-5" />
            Equipamentos Críticos
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
              <CardTitle className="text-base">Top 10 Equipamentos Críticos</CardTitle>
              <CardDescription>Requerem atenção imediata</CardDescription>
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
            <p className="text-sm">Nenhum equipamento crítico</p>
            <p className="text-xs">Tudo está em ordem! 🎉</p>
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
