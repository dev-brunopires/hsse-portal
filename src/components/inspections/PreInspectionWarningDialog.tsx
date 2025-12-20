import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  Calendar, 
  Clock, 
  MessageSquare, 
  CheckCircle2,
  XCircle,
  ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Inspection } from '@/hooks/useInspections';
import type { EquipmentWithCategory } from '@/hooks/useEquipment';

interface PreInspectionWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: EquipmentWithCategory;
  lastInspection: Inspection | null;
  onProceed: () => void;
}

export function PreInspectionWarningDialog({
  open,
  onOpenChange,
  equipment,
  lastInspection,
  onProceed,
}: PreInspectionWarningDialogProps) {
  const today = new Date().toISOString().split('T')[0];
  
  // Check for critical issues
  const isCertificateExpired = equipment.certificate_expiry && equipment.certificate_expiry < today;
  const isInspectionOverdue = equipment.next_inspection && equipment.next_inspection < today;
  const isEquipmentExpired = equipment.expiry_date && equipment.expiry_date < today;
  const isStatusCritical = equipment.status === 'expired' || equipment.status === 'rejected';
  
  // Check for pending recommendations
  const hasRecommendations = lastInspection?.recommendations && lastInspection.recommendations.trim().length > 0;
  const hasActionsTaken = lastInspection?.actions_taken && lastInspection.actions_taken.trim().length > 0;
  const lastInspectionHadIssues = lastInspection?.status === 'attention' || lastInspection?.status === 'non-compliant';

  const criticalIssuesCount = [isCertificateExpired, isInspectionOverdue, isEquipmentExpired, isStatusCritical].filter(Boolean).length;
  const hasPendingRecommendations = hasRecommendations && !hasActionsTaken;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <AlertDialogHeader className="pb-2">
          <AlertDialogTitle className="flex items-center gap-3 text-xl text-destructive">
            <div className="p-2 rounded-full bg-destructive/10 animate-pulse">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <span>Atenção Antes de Inspecionar!</span>
              <div className="flex items-center gap-2 mt-1">
                {criticalIssuesCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {criticalIssuesCount} Alerta{criticalIssuesCount > 1 ? 's' : ''} Crítico{criticalIssuesCount > 1 ? 's' : ''}
                  </Badge>
                )}
                {hasPendingRecommendations && (
                  <Badge variant="outline" className="text-xs border-warning text-warning">
                    Recomendações Pendentes
                  </Badge>
                )}
              </div>
            </div>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            O equipamento <strong className="text-foreground">{equipment.internal_code} - {equipment.name}</strong> possui pendências importantes.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ScrollArea className="flex-1 max-h-[400px] pr-4">
          <div className="space-y-4 py-2">
            {/* Critical Alerts Section */}
            {criticalIssuesCount > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-destructive flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  ALERTAS CRÍTICOS
                </h4>

                {isCertificateExpired && (
                  <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
                    <AlertTriangle className="h-5 w-5" />
                    <AlertTitle className="font-bold text-lg">Certificado Vencido</AlertTitle>
                    <AlertDescription className="mt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Venceu em{' '}
                          <strong>
                            {format(new Date(equipment.certificate_expiry + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </strong>
                        </span>
                      </div>
                      <p className="mt-2 font-medium">
                        ⚠️ Verifique se o certificado foi renovado antes de prosseguir!
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                {isInspectionOverdue && (
                  <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
                    <Clock className="h-5 w-5" />
                    <AlertTitle className="font-bold text-lg">Inspeção Atrasada</AlertTitle>
                    <AlertDescription className="mt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Estava programada para{' '}
                          <strong>
                            {format(new Date(equipment.next_inspection + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </strong>
                        </span>
                      </div>
                      <p className="mt-2 font-medium">
                        ⚠️ Este equipamento está com a inspeção periódica atrasada!
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                {isEquipmentExpired && (
                  <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
                    <AlertTriangle className="h-5 w-5" />
                    <AlertTitle className="font-bold text-lg">Validade do Equipamento Expirada</AlertTitle>
                    <AlertDescription className="mt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Expirou em{' '}
                          <strong>
                            {format(new Date(equipment.expiry_date + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </strong>
                        </span>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {isStatusCritical && (
                  <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
                    <XCircle className="h-5 w-5" />
                    <AlertTitle className="font-bold text-lg">
                      Equipamento {equipment.status === 'rejected' ? 'Reprovado' : 'Vencido'}
                    </AlertTitle>
                    <AlertDescription>
                      Este equipamento está marcado como {equipment.status === 'rejected' ? 'REPROVADO' : 'VENCIDO'}.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {criticalIssuesCount > 0 && (hasRecommendations || lastInspectionHadIssues) && (
              <Separator />
            )}

            {/* Last Inspection Issues */}
            {lastInspectionHadIssues && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-warning flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  ÚLTIMA INSPEÇÃO COM PROBLEMAS
                </h4>
                <Alert className="border-2 border-warning bg-warning/10">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <AlertTitle className="font-bold text-warning">
                    Status: {lastInspection?.status === 'non-compliant' ? 'Não Conforme' : 'Atenção'}
                  </AlertTitle>
                  <AlertDescription className="text-warning-foreground">
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Realizada em{' '}
                        {lastInspection?.inspection_date && 
                          format(new Date(lastInspection.inspection_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })
                        }
                      </span>
                    </div>
                    <p className="mt-2 font-medium">
                      A última inspeção apresentou problemas. Verifique se foram resolvidos!
                    </p>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Recommendations Section */}
            {hasRecommendations && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-primary flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  RECOMENDAÇÕES DA ÚLTIMA INSPEÇÃO
                </h4>
                <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                  <p className="text-sm whitespace-pre-wrap font-medium">{lastInspection?.recommendations}</p>
                  <p className="text-xs text-muted-foreground mt-3">
                    Registrado em{' '}
                    {lastInspection?.inspection_date && 
                      format(new Date(lastInspection.inspection_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })
                    }
                  </p>
                </div>

                {hasActionsTaken ? (
                  <div className="p-4 rounded-lg border-2 border-status-success/30 bg-status-success/5">
                    <div className="flex items-center gap-2 text-status-success font-semibold text-sm mb-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Ações Tomadas na Última Inspeção:
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{lastInspection?.actions_taken}</p>
                  </div>
                ) : (
                  <Alert className="border-2 border-warning bg-warning/10">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertTitle className="text-warning font-bold">Sem Ações Registradas</AlertTitle>
                    <AlertDescription className="text-warning-foreground">
                      Não há registro de ações tomadas para as recomendações acima.
                      <br />
                      <strong>Certifique-se de verificar e documentar as ações realizadas nesta inspeção!</strong>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator className="my-2" />

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="flex-1 sm:flex-none">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onProceed}
            className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Estou Ciente, Prosseguir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
