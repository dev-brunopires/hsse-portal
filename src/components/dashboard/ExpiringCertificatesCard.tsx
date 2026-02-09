import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEquipment } from '@/hooks/useEquipment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, ShieldAlert } from 'lucide-react';
import { formatDate } from '@/utils/dateFormat';
import { differenceInDays } from 'date-fns';
import { parseLocalDate } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';

type ExpiryRange = '30' | '60' | '90';

export function ExpiringCertificatesCard() {
  const { t } = useTranslation();
  const { data: equipment = [] } = useEquipment();
  const [selectedRange, setSelectedRange] = useState<ExpiryRange>('30');
  
  const today = new Date();
  
  const getExpiringEquipment = (days: number) => {
    return equipment.filter(item => {
      if (!item.certificate_expiry) return false;
      const expiryDate = parseLocalDate(item.certificate_expiry);
      if (!expiryDate) return false;
      const daysUntilExpiry = differenceInDays(expiryDate, today);
      return daysUntilExpiry >= 0 && daysUntilExpiry <= days;
    }).sort((a, b) => {
      const dateA = parseLocalDate(a.certificate_expiry!)!;
      const dateB = parseLocalDate(b.certificate_expiry!)!;
      return dateA.getTime() - dateB.getTime();
    });
  };

  const getDaysUntilExpiry = (date: string) => {
    return differenceInDays(parseLocalDate(date)!, today);
  };

  const getUrgencyColor = (days: number) => {
    if (days <= 7) return 'text-red-500 bg-red-500/10';
    if (days <= 15) return 'text-orange-500 bg-orange-500/10';
    if (days <= 30) return 'text-yellow-500 bg-yellow-500/10';
    return 'text-blue-500 bg-blue-500/10';
  };

  const counts = {
    '30': getExpiringEquipment(30).length,
    '60': getExpiringEquipment(60).length,
    '90': getExpiringEquipment(90).length,
  };

  const expiringItems = getExpiringEquipment(parseInt(selectedRange));

  const getDaysText = (daysLeft: number) => {
    if (daysLeft === 0) return t('expiringCertificates.today');
    if (daysLeft === 1) return `1 ${t('expiringCertificates.day')}`;
    return `${daysLeft} ${t('expiringCertificates.days')}`;
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
            {t('expiringCertificates.title')}
          </CardTitle>
        </div>
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
                  selectedRange === range ? 'bg-primary-foreground/20 text-primary-foreground' : ''
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
            <p className="text-sm text-muted-foreground">
              {t('expiringCertificates.noCertificatesExpiring', { days: selectedRange })}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-2">
              {expiringItems.map((item) => {
                const daysLeft = getDaysUntilExpiry(item.certificate_expiry!);
                const urgencyClass = getUrgencyColor(daysLeft);
                
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {item.internal_code}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{item.ships?.name || item.unit}</span>
                        <span>•</span>
                        <span>{item.location}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{t('expiringCertificates.expiresIn')}</p>
                        <p className={cn("text-sm font-semibold px-2 py-0.5 rounded", urgencyClass)}>
                          {getDaysText(daysLeft)}
                        </p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">{t('expiringCertificates.date')}</p>
                        <p className="text-sm">{formatDate(item.certificate_expiry)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
