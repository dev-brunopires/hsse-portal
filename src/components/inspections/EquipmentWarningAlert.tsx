import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Info, Calendar, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Inspection } from '@/hooks/useInspections';
import type { EquipmentWithCategory } from '@/hooks/useEquipment';

interface EquipmentWarningAlertProps {
  equipment: EquipmentWithCategory;
  lastInspection: Inspection | null;
}

export function EquipmentWarningAlert({ equipment, lastInspection }: EquipmentWarningAlertProps) {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if certificate is expired
  const isCertificateExpired = equipment.certificate_expiry && equipment.certificate_expiry < today;
  
  // Check if inspection is overdue (next_inspection date has passed)
  const isInspectionOverdue = equipment.next_inspection && equipment.next_inspection < today;
  
  // Check if equipment expiry date has passed
  const isEquipmentExpired = equipment.expiry_date && equipment.expiry_date < today;
  
  // Check if equipment status is expired/rejected
  const isStatusExpiredOrRejected = equipment.status === 'expired' || equipment.status === 'rejected';
  
  // Check if there are recommendations from last inspection
  const hasRecommendations = lastInspection?.recommendations && lastInspection.recommendations.trim().length > 0;
  const hasObservations = lastInspection?.observations && lastInspection.observations.trim().length > 0;
  const hasActionsTaken = lastInspection?.actions_taken && lastInspection.actions_taken.trim().length > 0;
  
  // Check if last inspection had issues
  const lastInspectionHadIssues = lastInspection?.status === 'attention' || lastInspection?.status === 'non-compliant';

  const hasAnyWarning = isCertificateExpired || isInspectionOverdue || isEquipmentExpired || isStatusExpiredOrRejected || hasRecommendations || hasObservations || lastInspectionHadIssues;

  if (!hasAnyWarning) return null;

  return (
    <div className="space-y-3 animate-in fade-in-50 slide-in-from-top-2 duration-300">
      {/* Certificate Expired Alert */}
      {isCertificateExpired && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-semibold">Certificado Vencido</AlertTitle>
          <AlertDescription className="mt-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                O certificado deste equipamento venceu em{' '}
                <strong>
                  {format(new Date(equipment.certificate_expiry + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </strong>
              </span>
            </div>
            <p className="mt-1 text-sm opacity-90">
              Verifique se o certificado foi renovado antes de prosseguir com a inspeção.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Inspection Overdue Alert */}
      {isInspectionOverdue && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <Clock className="h-4 w-4" />
          <AlertTitle className="font-semibold">Inspeção Atrasada</AlertTitle>
          <AlertDescription className="mt-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                A inspeção estava prevista para{' '}
                <strong>
                  {format(new Date(equipment.next_inspection + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </strong>
              </span>
            </div>
            <p className="mt-1 text-sm opacity-90">
              Este equipamento está com a inspeção periódica atrasada.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Equipment Expiry Date Alert */}
      {isEquipmentExpired && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-semibold">Equipamento com Validade Expirada</AlertTitle>
          <AlertDescription className="mt-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                A validade deste equipamento expirou em{' '}
                <strong>
                  {format(new Date(equipment.expiry_date + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </strong>
              </span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Equipment Status Alert */}
      {isStatusExpiredOrRejected && !isCertificateExpired && !isEquipmentExpired && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-semibold">
            Equipamento {equipment.status === 'rejected' ? 'Reprovado' : 'Vencido'}
          </AlertTitle>
          <AlertDescription>
            Este equipamento está marcado como {equipment.status === 'rejected' ? 'reprovado' : 'vencido'}. 
            Verifique se as pendências foram resolvidas.
          </AlertDescription>
        </Alert>
      )}

      {/* Last Inspection Status Alert */}
      {lastInspectionHadIssues && (
        <Alert className="border-warning/50 bg-warning/10">
          <Info className="h-4 w-4 text-warning" />
          <AlertTitle className="font-semibold text-warning">
            Última Inspeção: {lastInspection?.status === 'non-compliant' ? 'Não Conforme' : 'Atenção'}
          </AlertTitle>
          <AlertDescription className="text-warning-foreground">
            <div className="flex items-center gap-2 text-sm opacity-90">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Realizada em{' '}
                {lastInspection?.inspection_date && 
                  format(new Date(lastInspection.inspection_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })
                }
              </span>
            </div>
            <p className="mt-1 text-sm">
              A última inspeção apresentou problemas. Verifique se foram corrigidos.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Recommendations from Last Inspection */}
      {hasRecommendations && (
        <Alert className="border-primary/30 bg-primary/5">
          <MessageSquare className="h-4 w-4 text-primary" />
          <AlertTitle className="font-semibold text-primary">Recomendações da Última Inspeção</AlertTitle>
          <AlertDescription>
            <div className="mt-2 p-3 bg-background/80 rounded-md border border-border/50">
              <p className="text-sm whitespace-pre-wrap">{lastInspection?.recommendations}</p>
            </div>
            {hasActionsTaken && (
              <div className="mt-3 p-3 bg-status-success/10 rounded-md border border-status-success/30">
                <div className="flex items-center gap-2 text-status-success font-medium text-sm mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ações Tomadas na Última Inspeção:
                </div>
                <p className="text-sm whitespace-pre-wrap">{lastInspection?.actions_taken}</p>
              </div>
            )}
            {lastInspection?.inspection_date && (
              <p className="text-xs text-muted-foreground mt-2">
                Registrado em {format(new Date(lastInspection.inspection_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Observations from Last Inspection (if no recommendations but has observations) */}
      {hasObservations && !hasRecommendations && (
        <Alert className="border-muted-foreground/30 bg-muted/30">
          <Info className="h-4 w-4 text-muted-foreground" />
          <AlertTitle className="font-semibold">Observações da Última Inspeção</AlertTitle>
          <AlertDescription>
            <div className="mt-2 p-3 bg-background/80 rounded-md border border-border/50">
              <p className="text-sm whitespace-pre-wrap">{lastInspection?.observations}</p>
            </div>
            {lastInspection?.inspection_date && (
              <p className="text-xs text-muted-foreground mt-2">
                Registrado em {format(new Date(lastInspection.inspection_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
