import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ClipboardList, Users, Hammer, GraduationCap, BookOpenCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { EVV_FORMS, type EvvFormType } from '../catalog';

const ICONS: Record<EvvFormType, React.ComponentType<{ className?: string }>> = {
  safeguard: ClipboardList,
  leaders_engagement: Users,
  workers_engagement: Hammer,
  tlo: GraduationCap,
  aar: BookOpenCheck,
};

export default function FormSelector() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader title={t('evv.forms.title')} description={t('evv.forms.subtitle')} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {EVV_FORMS.map((f) => {
          const Icon = ICONS[f.id];
          return (
            <Link key={f.id} to={`/evv/forms/${f.id}`}>
              <Card className="hover:border-primary transition-colors h-full">
                <CardHeader>
                  <Icon className="h-7 w-7 text-primary" />
                  <CardTitle className="text-base mt-2">{t(f.titleKey)}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{t(f.descKey)}</CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
