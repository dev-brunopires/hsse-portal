import { useState, useEffect, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

const ONBOARDING_KEY = 'safeship-onboarding-completed';

export function useOnboarding() {
  const [hasCompleted, setHasCompleted] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    setHasCompleted(completed === 'true');
  }, []);

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
      element: '[data-tour="ship-filter"]',
      popover: {
        title: 'Filtro por Embarcação',
        description: 'Selecione uma embarcação para filtrar todos os dados do sistema. Os dados são automaticamente filtrados em todas as páginas.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="profile"]',
      popover: {
        title: 'Seu Perfil',
        description: 'Configure sua assinatura digital, preferências de notificação e dados pessoais.',
        side: 'left',
        align: 'start',
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
        description: 'Você pode reiniciar este tour a qualquer momento nas Configurações. Boas inspeções! 🚢',
        side: 'over',
        align: 'center',
      },
    },
  ];

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
        localStorage.setItem(ONBOARDING_KEY, 'true');
        setHasCompleted(true);
        driverObj.destroy();
      },
    });

    driverObj.drive();
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY);
    setHasCompleted(false);
  }, []);

  const skipTour = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setHasCompleted(true);
  }, []);

  return {
    hasCompleted,
    isRunning,
    startTour,
    resetTour,
    skipTour,
  };
}
