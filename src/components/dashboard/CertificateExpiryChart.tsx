import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCertificates } from '@/hooks/useCertificates';
import { format, addMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { CalendarDays, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function CertificateExpiryChart() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'pt-BR' ? ptBR : enUS;
  const { data: certificates = [], isLoading } = useCertificates();

  const chartData = useMemo(() => {
    const months: { month: string; count: number; monthIndex: number }[] = [];
    const today = new Date();

    // Generate next 12 months
    for (let i = 0; i < 12; i++) {
      const monthDate = addMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const count = certificates.filter(cert => {
        if (!cert.expiry_date) return false;
        const expiryDate = parseISO(cert.expiry_date);
        return isWithinInterval(expiryDate, { start: monthStart, end: monthEnd });
      }).length;

      months.push({
        month: format(monthDate, 'MMM', { locale: dateLocale }),
        count,
        monthIndex: i,
      });
    }

    return months;
  }, [certificates, dateLocale]);

  const getBarColor = (monthIndex: number) => {
    if (monthIndex === 0) return 'hsl(var(--destructive))'; // Current month - red
    if (monthIndex <= 2) return 'hsl(var(--warning))'; // Next 2 months - yellow/orange
    return 'hsl(var(--primary))'; // Future - primary color
  };

  const totalExpiring = useMemo(() => {
    return chartData.slice(0, 3).reduce((sum, m) => sum + m.count, 0);
  }, [chartData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              {t('certificates.expiryChart.title')}
            </CardTitle>
            <CardDescription>
              {t('certificates.expiryChart.description')}
            </CardDescription>
          </div>
          {totalExpiring > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-destructive">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">
                {t('certificates.expiryChart.expiringSoon', { count: totalExpiring })}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12 }} 
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ fontWeight: 600 }}
              formatter={(value: number) => [value, t('certificates.expiryChart.certificates')]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.monthIndex)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-destructive" />
            <span>{t('certificates.expiryChart.thisMonth')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-warning" />
            <span>{t('certificates.expiryChart.next3Months')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-primary" />
            <span>{t('certificates.expiryChart.later')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
