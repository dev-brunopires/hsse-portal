import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ClipboardList, Users, Hammer, GraduationCap, BookOpenCheck, FileCog } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { EVV_FORMS, type EvvFormType } from '../catalog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getEvvTemplateCounts } from '../templates';

const ICONS: Record<EvvFormType, React.ComponentType<{ className?: string }>> = {
  safeguard: ClipboardList,
  leaders_engagement: Users,
  workers_engagement: Hammer,
  tlo: GraduationCap,
  aar: BookOpenCheck,
};

export default function FormSelector() {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const refresh = () => setRefreshKey((current) => current + 1);
    window.addEventListener('evv-templates-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('evv-templates-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title={t('evv.forms.title')}
        description={t('evv.forms.subtitle')}
        actions={(
          <Button asChild variant="outline">
            <Link to="/evv/templates">
              <FileCog className="h-4 w-4" />
              {t('evv.nav.templates')}
            </Link>
          </Button>
        )}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-template-version={refreshKey}>
        {EVV_FORMS.map((f) => {
          const Icon = ICONS[f.id];
          const counts = getEvvTemplateCounts(f.id);
          const hasChecklist = counts.checklist > 0;
          return (
            <Link key={f.id} to={`/evv/forms/${f.id}`}>
              <Card className="hover:border-primary transition-colors h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="h-7 w-7 text-primary" />
                    <Badge variant={hasChecklist ? 'default' : 'secondary'}>
                      {hasChecklist ? t('evv.templates.ready') : t('evv.templates.emptyBadge')}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{t(f.titleKey)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{t(f.descKey)}</p>
                  <p>
                    {t('evv.templates.counts', {
                      topics: counts.topics,
                      subtopics: counts.subtopics,
                      checklist: counts.checklist,
                    })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
