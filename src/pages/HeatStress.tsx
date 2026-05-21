import { useTranslation } from 'react-i18next';
import { Thermometer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

export default function HeatStress() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('navigation.heatStress')}
        icon={Thermometer}
      />
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Thermometer className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">{t('navigation.comingSoon')}</p>
      </div>
    </div>
  );
}
