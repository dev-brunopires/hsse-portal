import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface PendingAction {
  id: string;
  type: 'create_inspection' | 'update_inspection' | 'create_equipment';
  data: any;
  timestamp: number;
}

const PENDING_ACTIONS_KEY = 'safeship_pending_actions';
const OFFLINE_DATA_KEY = 'safeship_offline_data';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Load pending actions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(PENDING_ACTIONS_KEY);
    if (stored) {
      try {
        setPendingActions(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading pending actions:', e);
      }
    }
  }, []);

  // Save pending actions to localStorage
  useEffect(() => {
    localStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(pendingActions));
  }, [pendingActions]);

  // Online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Conexão Restaurada',
        description: 'Sincronizando dados pendentes...',
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'Modo Offline',
        description: 'Suas alterações serão salvas localmente.',
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Add a pending action
  const addPendingAction = useCallback((type: PendingAction['type'], data: any) => {
    const action: PendingAction = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: Date.now(),
    };
    
    setPendingActions(prev => [...prev, action]);
    
    toast({
      title: 'Salvo Localmente',
      description: 'Será sincronizado quando a conexão for restaurada.',
    });
    
    return action.id;
  }, [toast]);

  // Remove a pending action
  const removePendingAction = useCallback((id: string) => {
    setPendingActions(prev => prev.filter(a => a.id !== id));
  }, []);

  // Clear all pending actions
  const clearPendingActions = useCallback(() => {
    setPendingActions([]);
    localStorage.removeItem(PENDING_ACTIONS_KEY);
  }, []);

  // Cache data for offline use
  const cacheOfflineData = useCallback((key: string, data: any) => {
    try {
      const offlineData = JSON.parse(localStorage.getItem(OFFLINE_DATA_KEY) || '{}');
      offlineData[key] = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(offlineData));
    } catch (e) {
      console.error('Error caching offline data:', e);
    }
  }, []);

  // Get cached offline data
  const getOfflineData = useCallback((key: string) => {
    try {
      const offlineData = JSON.parse(localStorage.getItem(OFFLINE_DATA_KEY) || '{}');
      return offlineData[key]?.data || null;
    } catch (e) {
      console.error('Error getting offline data:', e);
      return null;
    }
  }, []);

  return {
    isOnline,
    pendingActions,
    pendingCount: pendingActions.length,
    isSyncing,
    addPendingAction,
    removePendingAction,
    clearPendingActions,
    cacheOfflineData,
    getOfflineData,
  };
}
