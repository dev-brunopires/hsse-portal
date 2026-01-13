import { useState, useEffect, useCallback, useRef } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';

export function useOnboarding() {
  const { t } = useTranslation();
  const [userId, setUserId] = useState<string | null>(null);
  const [hasCompleted, setHasCompleted] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  // Get user ID directly from Supabase to avoid AuthContext dependency during init
  useEffect(() => {
    let mounted = true;

    const initUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && session?.user?.id) {
          setUserId(session.user.id);
          userIdRef.current = session.user.id;
        } else if (mounted) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error getting session:', error);
        if (mounted) setIsLoading(false);
      }
    };

    initUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        const newUserId = session?.user?.id ?? null;
        setUserId(newUserId);
        userIdRef.current = newUserId;
        if (!newUserId) {
          setIsLoading(false);
          setHasCompleted(true);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch onboarding status from database
  useEffect(() => {
    const fetchOnboardingStatus = async () => {
      if (!userId) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', userId)
          .single();

        if (error) {
          console.error('Error fetching onboarding status:', error);
          setHasCompleted(true); // Default to true on error
        } else {
          setHasCompleted(data?.onboarding_completed ?? false);
        }
      } catch (error) {
        console.error('Error fetching onboarding status:', error);
        setHasCompleted(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOnboardingStatus();
  }, [userId]);

  const getSteps = useCallback((): DriveStep[] => [
    {
      element: '[data-tour="sidebar"]',
      popover: {
        title: t('onboarding.mainMenu'),
        description: t('onboarding.mainMenuDesc'),
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="dashboard"]',
      popover: {
        title: t('onboarding.dashboard'),
        description: t('onboarding.dashboardDesc'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="equipment"]',
      popover: {
        title: t('onboarding.equipment'),
        description: t('onboarding.equipmentDesc'),
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="inspections"]',
      popover: {
        title: t('onboarding.inspections'),
        description: t('onboarding.inspectionsDesc'),
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="alerts"]',
      popover: {
        title: t('onboarding.alerts'),
        description: t('onboarding.alertsDesc'),
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="reports"]',
      popover: {
        title: t('onboarding.reports'),
        description: t('onboarding.reportsDesc'),
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="profile"]',
      popover: {
        title: t('onboarding.profile'),
        description: t('onboarding.profileDesc'),
        side: 'left',
        align: 'start',
      },
    },
    {
      popover: {
        title: `✍️ ${t('onboarding.digitalSignature')}`,
        description: t('onboarding.digitalSignatureDesc'),
        side: 'over',
        align: 'center',
      },
    },
    {
      popover: {
        title: t('onboarding.keyboardShortcuts'),
        description: `
          <div class="text-sm space-y-1">
            <p><kbd class="px-1 bg-muted rounded">Alt+D</kbd> Dashboard</p>
            <p><kbd class="px-1 bg-muted rounded">Alt+E</kbd> ${t('navigation.equipment')}</p>
            <p><kbd class="px-1 bg-muted rounded">Alt+I</kbd> ${t('navigation.inspections')}</p>
            <p><kbd class="px-1 bg-muted rounded">Alt+R</kbd> ${t('navigation.reports')}</p>
            <p><kbd class="px-1 bg-muted rounded">Alt+A</kbd> ${t('navigation.alerts')}</p>
          </div>
        `,
        side: 'over',
        align: 'center',
      },
    },
    {
      popover: {
        title: t('onboarding.readyToStart'),
        description: t('onboarding.readyToStartDesc'),
        side: 'over',
        align: 'center',
      },
    },
  ], [t]);

  const markOnboardingComplete = useCallback(async () => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;

    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('user_id', currentUserId);
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
    }
  }, []);

  const startTour = useCallback(() => {
    setIsRunning(true);
    
    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      popoverClass: 'onboarding-popover',
      nextBtnText: t('onboarding.next'),
      prevBtnText: t('onboarding.previous'),
      doneBtnText: t('onboarding.done'),
      progressText: t('onboarding.progress'),
      steps: getSteps(),
      onDestroyStarted: () => {
        setIsRunning(false);
        setHasCompleted(true);
        markOnboardingComplete();
        driverObj.destroy();
      },
    });

    driverObj.drive();
  }, [t, getSteps, markOnboardingComplete]);

  const resetTour = useCallback(async () => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;

    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: false })
        .eq('user_id', currentUserId);
      
      setHasCompleted(false);
    } catch (error) {
      console.error('Error resetting tour:', error);
    }
  }, []);

  const skipTour = useCallback(async () => {
    setHasCompleted(true);
    await markOnboardingComplete();
  }, [markOnboardingComplete]);

  return {
    hasCompleted,
    isRunning,
    isLoading,
    startTour,
    resetTour,
    skipTour,
  };
}
