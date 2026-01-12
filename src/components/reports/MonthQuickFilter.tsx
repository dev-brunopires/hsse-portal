import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

interface MonthQuickFilterProps {
  value: string;
  onChange: (value: string) => void;
  onDateRangeChange: (startDate: string, endDate: string) => void;
}

export function MonthQuickFilter({ value, onChange, onDateRangeChange }: MonthQuickFilterProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? enUS : ptBR;
  
  // Generate last 12 months
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: dateLocale }),
      startDate: format(monthStart, 'yyyy-MM-dd'),
      endDate: format(monthEnd, 'yyyy-MM-dd'),
    };
  });

  const handleChange = (selectedValue: string) => {
    onChange(selectedValue);
    
    if (selectedValue === 'all') {
      onDateRangeChange('', '');
    } else {
      const month = months.find(m => m.value === selectedValue);
      if (month) {
        onDateRangeChange(month.startDate, month.endDate);
      }
    }
  };

  return (
    <div className="space-y-2">
      <Label>{t('reports.quickMonth')}</Label>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder={t('reports.selectMonth')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('reports.allPeriod')}</SelectItem>
          {months.map(month => (
            <SelectItem key={month.value} value={month.value}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
