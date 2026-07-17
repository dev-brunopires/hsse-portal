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
    path: '/equipment-dashboard',
    tone: 'primary',
  },
  {
    key: 'health',
    titleKey: 'mobileHome.sections.health.title',
    subtitleKey: 'mobileHome.sections.health.subtitle',
    icon: HeartPulse,
    path: '/heat-stress',
    tone: 'success',
  },
  {
    key: 'vv',
    titleKey: 'mobileHome.sections.vv.title',
    subtitleKey: 'mobileHome.sections.vv.subtitle',
    icon: ClipboardCheck,
    path: '/evv',
    tone: 'warning',
  },
  {
    key: 'hsse',
    titleKey: 'mobileHome.sections.hsse.title',
    subtitleKey: 'mobileHome.sections.hsse.subtitle',
    icon: ShieldAlert,
    path: '/obs-cards',
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
    if (!path) return;
    hapticButton();
    navigate(path);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-8 pt-4 sm:px-6 lg:space-y-8 lg:px-8 lg:pt-8">
      <header className="space-y-1 lg:space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground lg:text-sm">
          {todayLabel}
        </p>
        <h1 className="text-2xl font-bold leading-tight text-foreground lg:text-4xl">
          {firstName
            ? t('mobileHome.greetingWithName', { name: firstName })
            : t('mobileHome.greeting')}
        </h1>
        <p className="text-sm text-muted-foreground lg:text-base">
          {t('mobileHome.subtitle')}
        </p>
      </header>

      <section aria-label={t('mobileHome.sectionsLabel')}>
        <div className="mb-3 flex items-center justify-between lg:mb-5">
          <h2 className="text-base font-semibold text-foreground lg:text-xl">
            {t('mobileHome.sectionsTitle')}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 xl:gap-5">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const tone = TONE_CLASSES[section.tone];
            const isDisabled = !section.path;
            return (
              <button
                key={section.key}
                onClick={() => handleNavigate(section.path)}
                onTouchStart={() => section.path && prefetchRouteChunk(section.path)}
                onMouseEnter={() => section.path && prefetchRouteChunk(section.path)}
                disabled={isDisabled}
                className={cn(
                  'group relative flex flex-col items-start gap-3 rounded-2xl p-4 lg:gap-4 lg:rounded-xl lg:p-5',
                  'bg-card border border-border shadow-sm',
                  'transition-all touch-manipulation hover:border-primary/40 hover:shadow-md',
                  'active:scale-[0.97] active:shadow-none',
                  'min-h-[150px] text-left lg:min-h-[210px]',
                  isDisabled && 'opacity-60 cursor-not-allowed active:scale-100'
                )}
                aria-label={t(section.titleKey)}
              >
                <span className="text-[10px] font-medium text-muted-foreground lg:text-xs">
                  {isDisabled ? t('mobileHome.comingSoon') : todayLabel}
                </span>

                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl lg:h-12 lg:w-12',
                    tone.iconBg
                  )}
                >
                  <Icon className={cn('h-5 w-5 lg:h-6 lg:w-6', tone.iconFg)} />
                </div>

                <div className="flex-1 min-w-0 w-full">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground lg:text-lg">
                    {t(section.titleKey)}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground lg:text-sm">
                    {t(section.subtitleKey)}
                  </p>
                </div>

                <div className="flex w-full items-center justify-between border-t border-border/60 pt-1 lg:pt-3">
                  <span className="text-[11px] font-medium text-muted-foreground lg:text-sm">
                    {isDisabled ? t('mobileHome.comingSoon') : t('mobileHome.access')}
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
