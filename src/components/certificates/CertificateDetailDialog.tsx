import { useTranslation } from 'react-i18next';
import {
  FileText,
  Download,
  Calendar,
  Building2,
  Package,
  RefreshCw,
  Edit,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Clock,
  History,
} from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import {
  useDeleteCertificate,
  useCertificateFileUrl,
  useCertificateRenewals,
  type Certificate,
} from '@/hooks/useCertificates';
import { formatDate } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';

interface CertificateDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificate: Certificate | null;
  onEdit: (certificate: Certificate) => void;
  onRenew: (certificate: Certificate) => void;
}

export function CertificateDetailDialog({
  open,
  onOpenChange,
  certificate,
  onEdit,
  onRenew,
}: CertificateDetailDialogProps) {
  const { t } = useTranslation();

  const deleteCertificate = useDeleteCertificate();
  const { data: fileUrl } = useCertificateFileUrl(certificate?.file_path || undefined);
  const { data: renewals = [] } = useCertificateRenewals(certificate?.id);

  if (!certificate) return null;

  const daysUntilExpiry = certificate.expiry_date
    ? differenceInDays(parseISO(certificate.expiry_date), new Date())
    : null;

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'valid':
        return {
          icon: ShieldCheck,
          color: 'text-green-600 bg-green-500/10',
          label: t('certificates.status.valid'),
        };
      case 'expiring_soon':
        return {
          icon: Clock,
          color: 'text-yellow-600 bg-yellow-500/10',
          label: t('certificates.status.expiringSoon'),
        };
      case 'expired':
        return {
          icon: AlertTriangle,
          color: 'text-red-600 bg-red-500/10',
          label: t('certificates.status.expired'),
        };
      default:
        return {
          icon: FileText,
          color: 'text-muted-foreground bg-muted',
          label: status,
        };
    }
  };

  const statusInfo = getStatusInfo(certificate.status);
  const StatusIcon = statusInfo.icon;

  const handleDelete = async () => {
    await deleteCertificate.mutateAsync(certificate.id);
    onOpenChange(false);
  };

  const handleDownload = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-2xl max-h-[90vh]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', statusInfo.color)}>
              <StatusIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{certificate.name}</h2>
              {certificate.certificate_number && (
                <p className="text-sm text-muted-foreground">
                  Nº {certificate.certificate_number}
                </p>
              )}
            </div>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Status Banner */}
            <div className={cn('p-4 rounded-lg flex items-center justify-between', statusInfo.color)}>
              <div className="flex items-center gap-3">
                <StatusIcon className="h-6 w-6" />
                <div>
                  <p className="font-semibold">{statusInfo.label}</p>
                  {daysUntilExpiry !== null && (
                    <p className="text-sm">
                      {daysUntilExpiry <= 0
                        ? t('certificates.expiredDaysAgo', { days: Math.abs(daysUntilExpiry) })
                        : t('certificates.expiresInDays', { days: daysUntilExpiry })}
                    </p>
                  )}
                </div>
              </div>
              {(certificate.status === 'expired' || certificate.status === 'expiring_soon') && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onRenew(certificate)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('certificates.renew')}
                </Button>
              )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  {t('certificates.equipment')}
                </div>
                <p className="font-medium">{certificate.equipment?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {certificate.equipment?.internal_code}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  {t('certificates.issuer')}
                </div>
                <p className="font-medium">{certificate.issuer || '-'}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {t('certificates.issueDate')}
                </div>
                <p className="font-medium">
                  {certificate.issue_date ? formatDate(certificate.issue_date) : '-'}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {t('certificates.expiryDate')}
                </div>
                <p className={cn(
                  'font-medium',
                  daysUntilExpiry !== null && daysUntilExpiry <= 0 && 'text-red-600',
                  daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30 && 'text-yellow-600'
                )}>
                  {certificate.expiry_date ? formatDate(certificate.expiry_date) : '-'}
                </p>
              </div>
            </div>

            {certificate.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">{t('certificates.notes')}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {certificate.notes}
                  </p>
                </div>
              </>
            )}

            {/* File */}
            {certificate.file_name && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">{t('certificates.attachedFile')}</h4>
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{certificate.file_name}</p>
                      {certificate.file_size && (
                        <p className="text-xs text-muted-foreground">
                          {(certificate.file_size / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      {t('common.download')}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Renewal History */}
            {renewals.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    {t('certificates.renewalHistory')}
                  </h4>
                  <div className="space-y-2">
                    {renewals.map((renewal) => (
                      <div
                        key={renewal.id}
                        className="p-3 border rounded-lg bg-muted/30 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            {formatDate(renewal.renewed_at)}
                          </span>
                          <Badge variant="outline" className="text-green-600">
                            {t('certificates.renewed')}
                          </Badge>
                        </div>
                        <p className="mt-1">
                          {renewal.previous_expiry_date && (
                            <>
                              <span className="line-through text-muted-foreground">
                                {formatDate(renewal.previous_expiry_date)}
                              </span>
                              {' → '}
                            </>
                          )}
                          <span className="font-medium">
                            {formatDate(renewal.new_expiry_date)}
                          </span>
                        </p>
                        {renewal.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {renewal.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                {t('common.delete')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('certificates.deleteConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('certificates.deleteConfirmDesc')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onEdit(certificate)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('common.edit')}
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
