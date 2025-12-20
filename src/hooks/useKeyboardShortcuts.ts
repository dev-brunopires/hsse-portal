import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

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
      { key: 'd', alt: true, action: () => navigate('/'), description: 'Ir para Dashboard' },
      { key: 'e', alt: true, action: () => navigate('/equipment'), description: 'Ir para Equipamentos' },
      { key: 'i', alt: true, action: () => navigate('/inspections'), description: 'Ir para Inspeções' },
      { key: 'r', alt: true, action: () => navigate('/reports'), description: 'Ir para Relatórios' },
      { key: 'a', alt: true, action: () => navigate('/alerts'), description: 'Ir para Alertas' },
      { key: 'u', alt: true, action: () => navigate('/users'), description: 'Ir para Usuários' },
      { key: 'c', alt: true, action: () => navigate('/categories'), description: 'Ir para Categorias' },
      { key: 's', alt: true, action: () => navigate('/settings'), description: 'Ir para Configurações' },
      { key: 'p', alt: true, action: () => navigate('/profile'), description: 'Ir para Perfil' },
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
  }, [navigate]);

  return { registerShortcut, shortcuts };
}

export function getShortcutsList(): { key: string; description: string }[] {
  return [
    { key: 'Alt + D', description: 'Ir para Dashboard' },
    { key: 'Alt + E', description: 'Ir para Equipamentos' },
    { key: 'Alt + I', description: 'Ir para Inspeções' },
    { key: 'Alt + R', description: 'Ir para Relatórios' },
    { key: 'Alt + A', description: 'Ir para Alertas' },
    { key: 'Alt + U', description: 'Ir para Usuários' },
    { key: 'Alt + C', description: 'Ir para Categorias' },
    { key: 'Alt + S', description: 'Ir para Configurações' },
    { key: 'Alt + P', description: 'Ir para Perfil' },
  ];
}
