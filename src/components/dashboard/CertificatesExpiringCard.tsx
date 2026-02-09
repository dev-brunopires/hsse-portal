import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCertificates } from '@/hooks/useCertificates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileCheck, Calendar, ArrowRight, Ship } from 'lucide-react';
import { formatDate } from '@/utils/dateFormat';
import { differenceInDays } from 'date-fns';
import { parseLocalDate } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

type ExpiryRange = '30' | '60' | '90';

const statusColors: Record<string, string> = {
  valid: 'bg-green-500/10 text-green-600 border-green-500/30',
  expiring_soon: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  expired: 'bg-red-500/10 text-red-600 border-red-500/30',
};

export function CertificatesExpiringCard() {
  const { t } = useTranslation();
  const { data: allCertificates = [] } = useCertificates();
  const [selectedRange, setSelectedRange] = useState<ExpiryRange>('30');
  
  const today = new Date();
  
  const getExpiringCertificates = (days: number) => {
    return allCertificates.filter(cert => {
      if (!cert.expiry_date) return false;
      const expiryDate = parseLocalDate(cert.expiry_date);
      if (!expiryDate) return false;
      const daysUntilExpiry = differenceInDays(expiryDate, today);
      // Include expired (negative days) and expiring within range
      return daysUntilExpiry <= days;
    }).sort((a, b) => {
      const dateA = parseLocalDate(a.expiry_date!)!;
      const dateB = parseLocalDate(b.expiry_date!)!;
      return dateA.getTime() - dateB.getTime();
    });
  };

  const getDaysUntilExpiry = (date: string) => {
    return differenceInDays(parseLocalDate(date)!, today);
  };

  const getUrgencyColor = (days: number) => {
    if (days < 0) return 'text-red-600 bg-red-500/10';
    if (days <= 7) return 'text-red-500 bg-red-500/10';
    if (days <= 15) return 'text-orange-500 bg-orange-500/10';
    if (days <= 30) return 'text-yellow-500 bg-yellow-500/10';
    return 'text-blue-500 bg-blue-500/10';
  };

  const counts = {
    '30': getExpiringCertificates(30).length,
    '60': getExpiringCertificates(60).length,
    '90': getExpiringCertificates(90).length,
  };

  const expiringItems = getExpiringCertificates(parseInt(selectedRange));

  const getDaysText = (daysLeft: number) => {
    if (daysLeft < 0) return t('certificates.expired');
    if (daysLeft === 0) return t('expiringCertificates.today');
    if (daysLeft === 1) return `1 ${t('expiringCertificates.day')}`;
    return `${daysLeft} ${t('expiringCertificates.days')}`;
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      certificate: t('certificates.types.certificate'),
      document: t('certificates.types.document'),
      license: t('certificates.types.license'),
      permit: t('certificates.types.permit'),
      test_report: t('certificates.types.test_report'),
    };
    return types[type] || type;
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileCheck className="h-5 w-5 text-primary" />
            {t('dashboard.certificatesExpiring')}
          </CardTitle>
          <Link to="/certificates">
            <Button variant="ghost" size="sm" className="gap-1 text-primary">
              {t('common.viewAll')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {t('dashboard.certificatesExpiringSubtitle')}
        </p>
        <div className="flex gap-2 mt-2">
          {(['30', '60', '90'] as ExpiryRange[]).map((range) => (
            <Button
              key={range}
              variant={selectedRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedRange(range)}
              className="gap-1"
            >
              {range} {t('expiringCertificates.days')}
              <Badge 
                variant="secondary" 
                className={cn(
                  "ml-1 h-5 min-w-5 px-1.5",
                  selectedRange === range ? 'bg-primary-foreground/20 text-primary-foreground' : '',
                  counts[range] > 0 && selectedRange !== range ? 'bg-status-danger/20 text-status-danger' : ''
                )}
              >
                {counts[range]}
              </Badge>
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {expiringItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 bg-green-500/10 rounded-full mb-3">
              <Calendar className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('dashboard.noCertificatesExpiring')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('dashboard.allCertificatesValid', { days: selectedRange })}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-2">
              {expiringItems.map((cert) => {
                const daysLeft = getDaysUntilExpiry(cert.expiry_date!);
                const urgencyClass = getUrgencyColor(daysLeft);
                
                return (
                  <Link
                    key={cert.id}
                    to={`/certificates?highlight=${cert.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{cert.name}</p>
                          <Badge variant="outline" className={cn("text-xs flex-shrink-0", statusColors[cert.status])}>
                            {getTypeLabel(cert.type)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="truncate">{cert.equipment?.name}</span>
                          {cert.ships?.name && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Ship className="h-3 w-3" />
                                {cert.ships.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {daysLeft < 0 ? t('certificates.expired') : t('expiringCertificates.expiresIn')}
                          </p>
                          <p className={cn("text-sm font-semibold px-2 py-0.5 rounded", urgencyClass)}>
                            {getDaysText(daysLeft)}
                          </p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground">{t('expiringCertificates.date')}</p>
                          <p className="text-sm">{formatDate(cert.expiry_date)}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
