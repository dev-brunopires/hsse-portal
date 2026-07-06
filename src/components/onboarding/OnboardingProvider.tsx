import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Rocket, X } from 'lucide-react';

export function OnboardingProvider() {
  const { t } = useTranslation();
  const { hasCompleted, isLoading, startTour, skipTour } = useOnboarding();
  const [showWelcome, setShowWelcome] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Only show on dashboard after login and when loading is complete
    if (!isLoading && !hasCompleted && location.pathname === '/') {
      const timer = setTimeout(() => setShowWelcome(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [hasCompleted, isLoading, location.pathname]);

  const handleStartTour = () => {
    setShowWelcome(false);
    setTimeout(() => startTour(), 300);
  };

  const handleSkip = () => {
    setShowWelcome(false);
    skipTour();
  };

  if (hasCompleted) return null;

  return (
    <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Rocket className="h-6 w-6 text-primary" />
            {t('onboarding.welcomeTitle', 'Welcome to HSSE Connect!')}
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {t('onboarding.welcomeDescription', 'Maritime Safety Equipment Inspection Management System.')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {t('onboarding.tourQuestion', 'Would you like to take a quick tour of the system? You will learn about:')}
          </p>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {t('onboarding.tourItem1', 'Navigation and main features')}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {t('onboarding.tourItem2', 'Equipment registration and inspection')}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {t('onboarding.tourItem3', 'Reports and system alerts')}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <strong>{t('onboarding.tourItem4', 'How to set up your digital signature')}</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {t('onboarding.tourItem5', 'Keyboard shortcuts')}
            </li>
          </ul>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleSkip} className="w-full sm:w-auto">
            <X className="h-4 w-4 mr-2" />
            {t('onboarding.skip', 'Skip')}
          </Button>
          <Button onClick={handleStartTour} className="w-full sm:w-auto">
            <Rocket className="h-4 w-4 mr-2" />
            {t('onboarding.startTour', 'Start Tour')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
