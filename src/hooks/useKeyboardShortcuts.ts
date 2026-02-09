import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
}

const shortcuts: ShortcutConfig[] = [];

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const registerShortcut = useCallback((config: ShortcutConfig) => {
    shortcuts.push(config);
    return () => {
      const index = shortcuts.findIndex(s => 
        s.key === config.key && 
        s.ctrl === config.ctrl && 
        s.alt === config.alt && 
        s.shift === config.shift
      );
      if (index > -1) shortcuts.splice(index, 1);
    };
  }, []);

  useEffect(() => {
    // Register default navigation shortcuts
    const defaultShortcuts: ShortcutConfig[] = [
      { key: 'd', alt: true, action: () => navigate('/'), description: t('hooks.keyboard.goToDashboard') },
      { key: 'e', alt: true, action: () => navigate('/equipment'), description: t('hooks.keyboard.goToEquipment') },
      { key: 'i', alt: true, action: () => navigate('/inspections'), description: t('hooks.keyboard.goToInspections') },
      { key: 'r', alt: true, action: () => navigate('/reports'), description: t('hooks.keyboard.goToReports') },
      { key: 'a', alt: true, action: () => navigate('/alerts'), description: t('hooks.keyboard.goToAlerts') },
      { key: 'u', alt: true, action: () => navigate('/users'), description: t('hooks.keyboard.goToUsers') },
      { key: 'c', alt: true, action: () => navigate('/categories'), description: t('hooks.keyboard.goToCategories') },
      { key: 's', alt: true, action: () => navigate('/settings'), description: t('hooks.keyboard.goToSettings') },
      { key: 'p', alt: true, action: () => navigate('/profile'), description: t('hooks.keyboard.goToProfile') },
    ];

    defaultShortcuts.forEach(s => shortcuts.push(s));

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      defaultShortcuts.forEach(s => {
        const index = shortcuts.indexOf(s);
        if (index > -1) shortcuts.splice(index, 1);
      });
    };
  }, [navigate, t]);

  return { registerShortcut, shortcuts };
}

export function getShortcutsList(): { key: string; description: string }[] {
  const t = i18n.t.bind(i18n);
  return [
    { key: 'Alt + D', description: t('hooks.keyboard.goToDashboard') },
    { key: 'Alt + E', description: t('hooks.keyboard.goToEquipment') },
    { key: 'Alt + I', description: t('hooks.keyboard.goToInspections') },
    { key: 'Alt + R', description: t('hooks.keyboard.goToReports') },
    { key: 'Alt + A', description: t('hooks.keyboard.goToAlerts') },
    { key: 'Alt + U', description: t('hooks.keyboard.goToUsers') },
    { key: 'Alt + C', description: t('hooks.keyboard.goToCategories') },
    { key: 'Alt + S', description: t('hooks.keyboard.goToSettings') },
    { key: 'Alt + P', description: t('hooks.keyboard.goToProfile') },
  ];
}
