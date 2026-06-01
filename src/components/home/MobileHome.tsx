import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, HeartPulse, ClipboardCheck, ShieldAlert, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { hapticButton } from '@/utils/hapticFeedback';
import { prefetchRouteChunk } from '@/utils/routeChunkPrefetch';

type SectionTone = 'primary' | 'success' | 'warning' | 'danger';

interface Section {
  key: string;
  titleKey: string;
  subtitleKey: string;
  icon: React.ElementType;
  path: string;
  tone: SectionTone;
}

const SECTIONS: Section[] = [
  {
    key: 'equipment',
    titleKey: 'mobileHome.sections.equipment.title',
    subtitleKey: 'mobileHome.sections.equipment.subtitle',
    icon: Package,
    path: '/equipment',
    tone: 'primary',
  },
  {
    key: 'health',
    titleKey: 'mobileHome.sections.health.title',
    subtitleKey: 'mobileHome.sections.health.subtitle',
    icon: HeartPulse,
    path: '/health-check',
    tone: 'success',
  },
  {
    key: 'vv',
    titleKey: 'mobileHome.sections.vv.title',
    subtitleKey: 'mobileHome.sections.vv.subtitle',
    icon: ClipboardCheck,
    path: '/inspections',
    tone: 'warning',
  },
  {
    key: 'hsse',
    titleKey: 'mobileHome.sections.hsse.title',
    subtitleKey: 'mobileHome.sections.hsse.subtitle',
    icon: ShieldAlert,
    path: '/heat-stress',
    tone: 'danger',
  },
];

const TONE_CLASSES: Record<SectionTone, { iconBg: string; iconFg: string; accent: string }> = {
  primary: {
    iconBg: 'bg-primary/10',
    iconFg: 'text-primary',
    accent: 'bg-primary',
  },
  success: {
    iconBg: 'bg-emerald-500/10',
    iconFg: 'text-emerald-600 dark:text-emerald-400',
    accent: 'bg-emerald-500',
  },
  warning: {
    iconBg: 'bg-amber-500/10',
    iconFg: 'text-amber-600 dark:text-amber-400',
    accent: 'bg-amber-500',
  },
  danger: {
    iconBg: 'bg-red-500/10',
    iconFg: 'text-red-600 dark:text-red-400',
    accent: 'bg-red-500',
  },
};

export function MobileHome() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const dateLocale = i18n.language === 'en' ? enUS : ptBR;

  const todayLabel = useMemo(
    () => format(new Date(), 'dd MMM, yyyy', { locale: dateLocale }),
    [dateLocale]
  );

  const firstName = useMemo(() => {
    const fullName = profile?.full_name || user?.email || '';
    return fullName.split(' ')[0] || '';
  }, [profile?.full_name, user?.email]);

  const handleNavigate = (path: string) => {
    hapticButton();
    navigate(path);
  };

  return (
    <div className="px-4 pt-4 pb-8 space-y-6">
      {/* Greeting header */}
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          {todayLabel}
        </p>
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          {firstName
            ? t('mobileHome.greetingWithName', { name: firstName })
            : t('mobileHome.greeting')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('mobileHome.subtitle')}
        </p>
      </header>

      {/* Sections grid */}
      <section aria-label={t('mobileHome.sectionsLabel')}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">
            {t('mobileHome.sectionsTitle')}
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const tone = TONE_CLASSES[section.tone];
            return (
              <button
                key={section.key}
                onClick={() => handleNavigate(section.path)}
                onTouchStart={() => prefetchRouteChunk(section.path)}
                onMouseEnter={() => prefetchRouteChunk(section.path)}
                className={cn(
                  'group relative flex flex-col items-start gap-3 p-4 rounded-2xl',
                  'bg-card border border-border shadow-sm',
                  'transition-all touch-manipulation',
                  'active:scale-[0.97] active:shadow-none',
                  'min-h-[150px] text-left'
                )}
                aria-label={t(section.titleKey)}
              >
                <span className="text-[10px] text-muted-foreground font-medium">
                  {todayLabel}
                </span>

                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-xl',
                    tone.iconBg
                  )}
                >
                  <Icon className={cn('h-5 w-5', tone.iconFg)} />
                </div>

                <div className="flex-1 min-w-0 w-full">
                  <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                    {t(section.titleKey)}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                    {t(section.subtitleKey)}
                  </p>
                </div>

                <div className="flex items-center justify-between w-full pt-1 border-t border-border/60">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t('mobileHome.access')}
                  </span>
                  <ChevronRight className={cn('h-4 w-4', tone.iconFg)} />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
