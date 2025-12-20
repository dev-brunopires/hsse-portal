import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';
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
            Bem-vindo ao SafeShip!
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Sistema de Gestão de Inspeções de Equipamentos de Segurança Marítima.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Gostaria de fazer um tour rápido pelo sistema? Você vai aprender sobre:
          </p>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Navegação e principais funcionalidades
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Cadastro e inspeção de equipamentos
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Relatórios e alertas do sistema
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <strong>Como configurar sua assinatura digital</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Atalhos de teclado
            </li>
          </ul>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleSkip} className="w-full sm:w-auto">
            <X className="h-4 w-4 mr-2" />
            Pular
          </Button>
          <Button onClick={handleStartTour} className="w-full sm:w-auto">
            <Rocket className="h-4 w-4 mr-2" />
            Iniciar Tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
