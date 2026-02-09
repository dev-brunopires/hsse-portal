import { useIsTabletOrMobile } from '@/hooks/use-mobile';
import { getLocalToday } from '@/utils/dateFormat';
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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
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
import { ptBR, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();
  const isTabletOrMobile = useIsTabletOrMobile();
  const dateLocale = i18n.language === 'pt-BR' ? ptBR : enUS;
  const today = getLocalToday();
  
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

  const formatDateLong = (dateStr: string) => {
    return format(new Date(dateStr + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: dateLocale });
  };

  const formatDateShort = (dateStr: string) => {
    return format(new Date(dateStr + 'T00:00:00'), "dd/MM/yyyy", { locale: dateLocale });
  };

  const headerContent = (
    <div className="flex items-center gap-3 text-xl text-destructive">
      <div className="p-2 rounded-full bg-destructive/10 animate-pulse">
        <ShieldAlert className="h-6 w-6 text-destructive" />
      </div>
      <div>
        <span className="font-semibold">{t('preInspectionWarning.attentionBeforeInspecting')}</span>
        <div className="flex items-center gap-2 mt-1">
          {criticalIssuesCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {criticalIssuesCount} {criticalIssuesCount > 1 ? t('preInspectionWarning.criticalAlerts') : t('preInspectionWarning.criticalAlert')}
            </Badge>
          )}
          {hasPendingRecommendations && (
            <Badge variant="outline" className="text-xs border-warning text-warning">
              {t('preInspectionWarning.pendingRecommendations')}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );

  const descriptionContent = (
    <p className="text-base text-muted-foreground">
      {t('inspectionForm.equipment')} <strong className="text-foreground">{equipment.internal_code} - {equipment.name}</strong> {t('preInspectionWarning.hasPendingIssues')}
    </p>
  );

  const alertsContent = (
    <ScrollArea className="flex-1 max-h-[60vh] pr-4">
      <div className="space-y-4 py-2 pb-4">
        {/* Critical Alerts Section */}
        {criticalIssuesCount > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-destructive flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              {t('preInspectionWarning.criticalAlertsSection')}
            </h4>

            {isCertificateExpired && (
              <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="font-bold text-lg">{t('equipmentWarning.certificateExpired')}</AlertTitle>
                <AlertDescription className="mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {t('preInspectionWarning.expiredOn')}{' '}
                      <strong>
                        {formatDateLong(equipment.certificate_expiry!)}
                      </strong>
                    </span>
                  </div>
                  <p className="mt-2 font-medium">
                    ⚠️ {t('preInspectionWarning.verifyCertificateRenewed')}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {isInspectionOverdue && (
              <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
                <Clock className="h-5 w-5" />
                <AlertTitle className="font-bold text-lg">{t('equipmentWarning.inspectionOverdue')}</AlertTitle>
                <AlertDescription className="mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {t('preInspectionWarning.scheduledFor')}{' '}
                      <strong>
                        {formatDateLong(equipment.next_inspection!)}
                      </strong>
                    </span>
                  </div>
                  <p className="mt-2 font-medium">
                    ⚠️ {t('preInspectionWarning.inspectionOverdueWarning')}
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {isEquipmentExpired && (
              <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="font-bold text-lg">{t('preInspectionWarning.equipmentExpiryExpired')}</AlertTitle>
                <AlertDescription className="mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {t('preInspectionWarning.expiredAt')}{' '}
                      <strong>
                        {formatDateLong(equipment.expiry_date!)}
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
                  {equipment.status === 'rejected' ? t('equipmentWarning.equipmentRejected') : t('equipmentWarning.equipmentExpiredStatus')}
                </AlertTitle>
                <AlertDescription>
                  {t('equipmentWarning.markedAs')} {equipment.status === 'rejected' ? t('common.rejected').toUpperCase() : t('equipment.statusExpired').toUpperCase()}.
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
              {t('preInspectionWarning.lastInspectionWithProblems')}
            </h4>
            <Alert className="border-2 border-warning bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <AlertTitle className="font-bold text-warning">
                {t('preInspectionWarning.statusLabel')}: {lastInspection?.status === 'non-compliant' ? t('equipmentWarning.nonCompliant') : t('equipmentWarning.attention')}
              </AlertTitle>
              <AlertDescription className="text-warning-foreground">
                <div className="flex items-center gap-2 text-sm mt-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {t('equipmentWarning.performedOn')}{' '}
                    {lastInspection?.inspection_date && formatDateShort(lastInspection.inspection_date)}
                  </span>
                </div>
                <p className="mt-2 font-medium">
                  {t('preInspectionWarning.lastInspectionIssuesWarning')}
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
              {t('preInspectionWarning.recommendationsSection')}
            </h4>
            <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
              <p className="text-sm whitespace-pre-wrap font-medium">{lastInspection?.recommendations}</p>
              <p className="text-xs text-muted-foreground mt-3">
                {t('equipmentWarning.registeredOn')}{' '}
                {lastInspection?.inspection_date && formatDateShort(lastInspection.inspection_date)}
              </p>
            </div>

            {hasActionsTaken ? (
              <div className="p-4 rounded-lg border-2 border-status-success/30 bg-status-success/5">
                <div className="flex items-center gap-2 text-status-success font-semibold text-sm mb-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('equipmentWarning.actionsTakenLastInspection')}:
                </div>
                <p className="text-sm whitespace-pre-wrap">{lastInspection?.actions_taken}</p>
              </div>
            ) : (
              <Alert className="border-2 border-warning bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle className="text-warning font-bold">{t('preInspectionWarning.noActionsRegistered')}</AlertTitle>
                <AlertDescription className="text-warning-foreground">
                  {t('preInspectionWarning.noActionsRegisteredMessage')}
                  <br />
                  <strong>{t('preInspectionWarning.verifyAndDocument')}</strong>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );

  // Use drawer for both mobile and tablet for better touch experience
  if (isTabletOrMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] flex flex-col">
          <DrawerHeader className="pb-2 border-b border-border flex-shrink-0">
            <DrawerTitle>{headerContent}</DrawerTitle>
            <DrawerDescription asChild>{descriptionContent}</DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
            {alertsContent}
          </div>
          <Separator />
          <DrawerFooter className="flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1 min-h-[44px]"
            >
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={onProceed}
              className="flex-1 min-h-[44px] gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {t('preInspectionWarning.iAmAwareProceed')}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <AlertDialogHeader className="pb-2">
          <AlertDialogTitle>{headerContent}</AlertDialogTitle>
          <AlertDialogDescription asChild>{descriptionContent}</AlertDialogDescription>
        </AlertDialogHeader>

        {alertsContent}

        <Separator className="my-2" />

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="flex-1 sm:flex-none">
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onProceed}
            className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {t('preInspectionWarning.iAmAwareProceed')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}