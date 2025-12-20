import { useState, useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useOnboarding() {
  const { user } = useAuth();
  const [hasCompleted, setHasCompleted] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch onboarding status from database
  useEffect(() => {
    const fetchOnboardingStatus = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', user.id)
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
  }, [user?.id]);

  const steps: DriveStep[] = [
    {
      element: '[data-tour="sidebar"]',
      popover: {
        title: 'Menu Principal',
        description: 'Navegue entre as seções do sistema usando o menu lateral. Aqui você encontra acesso rápido a todos os módulos.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="dashboard"]',
      popover: {
        title: 'Dashboard',
        description: 'Visualize métricas, alertas e o status geral dos equipamentos em tempo real.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="equipment"]',
      popover: {
        title: 'Equipamentos',
        description: 'Cadastre e gerencie todos os equipamentos de segurança. Acompanhe datas de validade e histórico de inspeções.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="inspections"]',
      popover: {
        title: 'Inspeções',
        description: 'Registre inspeções, adicione fotos e assinatura digital. Acompanhe o calendário de inspeções pendentes.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="alerts"]',
      popover: {
        title: 'Alertas',
        description: 'Receba notificações sobre equipamentos com inspeções vencidas, certificados expirando e manutenções pendentes.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="reports"]',
      popover: {
        title: 'Relatórios',
        description: 'Gere relatórios detalhados em PDF e Excel. Filtre por período, embarcação e status.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="profile"]',
      popover: {
        title: 'Seu Perfil',
        description: 'Acesse seu perfil para configurar suas informações pessoais e preferências do sistema.',
        side: 'left',
        align: 'start',
      },
    },
    {
      popover: {
        title: '✍️ Assinatura Digital',
        description: `
          <div class="text-sm space-y-2">
            <p><strong>Importante:</strong> Configure sua assinatura digital para agilizar suas inspeções!</p>
            <p>Acesse <strong>Meu Perfil → Assinatura</strong> para:</p>
            <ul class="list-disc pl-4 space-y-1">
              <li>Desenhar sua assinatura padrão</li>
              <li>Ativar "Assinar automaticamente" para usar sua assinatura em todas as inspeções</li>
            </ul>
            <p class="text-muted-foreground mt-2">Isso economiza tempo e garante a padronização dos seus relatórios.</p>
          </div>
        `,
        side: 'over',
        align: 'center',
      },
    },
    {
      popover: {
        title: 'Atalhos de Teclado',
        description: `
          <div class="text-sm space-y-1">
            <p><kbd class="px-1 bg-muted rounded">Alt+D</kbd> Dashboard</p>
            <p><kbd class="px-1 bg-muted rounded">Alt+E</kbd> Equipamentos</p>
            <p><kbd class="px-1 bg-muted rounded">Alt+I</kbd> Inspeções</p>
            <p><kbd class="px-1 bg-muted rounded">Alt+R</kbd> Relatórios</p>
            <p><kbd class="px-1 bg-muted rounded">Alt+A</kbd> Alertas</p>
          </div>
        `,
        side: 'over',
        align: 'center',
      },
    },
    {
      popover: {
        title: 'Pronto para começar!',
        description: 'Você pode reiniciar este tour a qualquer momento nas Configurações. Não se esqueça de configurar sua assinatura digital no seu perfil! 🚢',
        side: 'over',
        align: 'center',
      },
    },
  ];

  const markOnboardingComplete = async () => {
    if (!user?.id) return;

    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
    }
  };

  const startTour = useCallback(() => {
    setIsRunning(true);
    
    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      popoverClass: 'onboarding-popover',
      nextBtnText: 'Próximo',
      prevBtnText: 'Anterior',
      doneBtnText: 'Concluir',
      progressText: '{{current}} de {{total}}',
      steps,
      onDestroyStarted: () => {
        setIsRunning(false);
        setHasCompleted(true);
        markOnboardingComplete();
        driverObj.destroy();
      },
    });

    driverObj.drive();
  }, [user?.id]);

  const resetTour = useCallback(async () => {
    if (!user?.id) return;

    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: false })
        .eq('user_id', user.id);
      
      setHasCompleted(false);
    } catch (error) {
      console.error('Error resetting tour:', error);
    }
  }, [user?.id]);

  const skipTour = useCallback(async () => {
    setHasCompleted(true);
    await markOnboardingComplete();
  }, [user?.id]);

  return {
    hasCompleted,
    isRunning,
    isLoading,
    startTour,
    resetTour,
    skipTour,
  };
}
