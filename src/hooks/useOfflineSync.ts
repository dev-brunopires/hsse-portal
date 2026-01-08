import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { hapticSuccess, hapticWarning } from '@/utils/hapticFeedback';

// Push notification helper for sync completion
const showSyncPushNotification = async (title: string, body: string) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        tag: 'sync-completed',
      });
    } else {
      new Notification(title, { body, icon: '/pwa-192x192.png' });
    }
  } catch (error) {
    console.error('Error showing sync push notification:', error);
  }
};

export interface PendingInspection {
  id: string;
  equipment_id: string;
  equipment_name: string;
  equipment_code: string;
  status: string;
  observations: string | null;
  recommendations: string | null;
  checklist_items: Array<{
    description: string;
    status: string;
    notes: string | null;
  }>;
  signature_data: string | null;
  inspector_id: string;
  ship_id: string | null;
  timestamp: number;
}

interface PendingAction {
  id: string;
  type: 'create_inspection' | 'update_inspection' | 'create_equipment';
  data: PendingInspection | any;
  timestamp: number;
  retryCount?: number;
}

const PENDING_ACTIONS_KEY = 'safeship_pending_actions';
const OFFLINE_DATA_KEY = 'safeship_offline_data';
const CACHE_TIMESTAMP_KEY = 'safeship_cache_timestamp';
const MAX_RETRY_COUNT = 3;
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours

// Safe initialization of state
const getInitialOnlineState = () => {
  try {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  } catch {
    return true;
  }
};

const getInitialPendingActions = (): PendingAction[] => {
  try {
    const stored = localStorage.getItem(PENDING_ACTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export function useOfflineSync() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(getInitialOnlineState);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>(getInitialPendingActions);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Save pending actions to localStorage when they change
  useEffect(() => {
    localStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(pendingActions));
  }, [pendingActions]);

  // Pre-cache critical data for offline use
  const preCacheData = useCallback(async () => {
    if (!isOnline) return;

    try {
      // Cache equipment data
      const { data: equipment } = await supabase
        .from('equipment')
        .select('id, name, internal_code, status, category_id, ship_id, location, serial_number')
        .limit(500);

      // Cache categories
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, description, inspection_frequency');

      // Cache ships
      const { data: ships } = await supabase
        .from('ships')
        .select('id, name, code');

      // Cache checklist templates
      const { data: templates } = await supabase
        .from('checklist_templates')
        .select(`
          id,
          name,
          category_id,
          checklist_template_items (
            id,
            description,
            is_required,
            order_index
          )
        `);

      const offlineData = {
        equipment: equipment || [],
        categories: categories || [],
        ships: ships || [],
        templates: templates || [],
        timestamp: Date.now(),
      };

      localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(offlineData));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      
      console.log('Offline data cached successfully');
    } catch (error) {
      console.error('Error pre-caching data:', error);
    }
  }, [isOnline]);

  // Check if cache is stale and refresh
  const checkAndRefreshCache = useCallback(async () => {
    const lastCache = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    const lastCacheTime = lastCache ? parseInt(lastCache, 10) : 0;
    
    if (Date.now() - lastCacheTime > CACHE_MAX_AGE) {
      await preCacheData();
    }
  }, [preCacheData]);

  // Sync pending inspections when online
  const syncPendingInspections = useCallback(async () => {
    if (!isOnline || pendingActions.length === 0) return;

    setIsSyncing(true);
    const inspectionActions = pendingActions.filter(a => a.type === 'create_inspection');
    let syncedCount = 0;
    const failedActions: string[] = [];

    for (const action of inspectionActions) {
      try {
        const inspection = action.data as PendingInspection;
        
        // Create the inspection
        const { data: newInspection, error: inspectionError } = await supabase
          .from('inspections')
          .insert({
            equipment_id: inspection.equipment_id,
            inspector_id: inspection.inspector_id,
            status: inspection.status,
            observations: inspection.observations,
            recommendations: inspection.recommendations,
            signature_data: inspection.signature_data,
            signed_at: inspection.signature_data ? new Date().toISOString() : null,
            ship_id: inspection.ship_id,
          })
          .select()
          .single();

        if (inspectionError) throw inspectionError;

        // Create checklist items
        if (inspection.checklist_items.length > 0 && newInspection) {
          const { error: checklistError } = await supabase
            .from('inspection_checklist_items')
            .insert(
              inspection.checklist_items.map(item => ({
                inspection_id: newInspection.id,
                description: item.description,
                status: item.status,
                notes: item.notes,
              }))
            );

          if (checklistError) console.error('Checklist error:', checklistError);
        }

        // Update equipment
        if (newInspection) {
          await supabase
            .from('equipment')
            .update({
              last_inspection: newInspection.inspection_date,
              status: inspection.status === 'non-compliant' ? 'maintenance' : 'active',
            })
            .eq('id', inspection.equipment_id);
        }

        // Remove synced action
        setPendingActions(prev => prev.filter(a => a.id !== action.id));
        syncedCount++;
      } catch (error) {
        console.error('Error syncing inspection:', error);
        
        // Increment retry count
        const retryCount = (action.retryCount || 0) + 1;
        if (retryCount >= MAX_RETRY_COUNT) {
          failedActions.push(action.id);
        } else {
          setPendingActions(prev => 
            prev.map(a => a.id === action.id ? { ...a, retryCount } : a)
          );
        }
      }
    }

    setIsSyncing(false);
    setLastSyncTime(Date.now());

    if (syncedCount > 0) {
      hapticSuccess();
      toast.success(t('offline.syncCompleted'), {
        description: t('offline.syncCompletedDesc', { count: syncedCount }),
      });
      
      // Show push notification for sync completion
      showSyncPushNotification(
        t('offline.syncCompleted'),
        t('offline.syncCompletedDesc', { count: syncedCount })
      );
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    }

    if (failedActions.length > 0) {
      hapticWarning();
      toast.error(t('offline.syncFailed'), {
        description: t('offline.syncFailedDesc', { count: failedActions.length }),
      });
    }
  }, [isOnline, pendingActions, queryClient, t]);

  // Online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      hapticSuccess();
      toast.success(t('offline.connectionRestored'), {
        description: t('offline.connectionRestoredDesc'),
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      hapticWarning();
      toast.error(t('offline.offlineMode'), {
        description: t('offline.offlineModeDesc'),
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [t]);

  // Auto-sync when coming online and refresh cache
  useEffect(() => {
    if (isOnline) {
      if (pendingActions.length > 0) {
        syncPendingInspections();
      }
      checkAndRefreshCache();
    }
  }, [isOnline, syncPendingInspections, checkAndRefreshCache, pendingActions.length]);

  // Initial cache on mount
  useEffect(() => {
    if (isOnline) {
      checkAndRefreshCache();
    }
  }, []);

  // Add a pending action
  const addPendingAction = useCallback((type: PendingAction['type'], data: any) => {
    const action: PendingAction = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    setPendingActions(prev => [...prev, action]);
    
    toast.info(t('offline.savedLocally'), {
      description: t('offline.savedLocallyDesc'),
    });
    
    return action.id;
  }, [t]);

  // Add pending inspection (convenience method)
  const addPendingInspection = useCallback((inspection: Omit<PendingInspection, 'id' | 'timestamp'>) => {
    const pendingInspection: PendingInspection = {
      ...inspection,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    
    return addPendingAction('create_inspection', pendingInspection);
  }, [addPendingAction]);

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
  const getOfflineData = useCallback(<T = any>(key?: string): T | null => {
    try {
      const offlineData = JSON.parse(localStorage.getItem(OFFLINE_DATA_KEY) || '{}');
      if (key) {
        return offlineData[key]?.data || null;
      }
      return offlineData as T;
    } catch (e) {
      console.error('Error getting offline data:', e);
      return null;
    }
  }, []);

  // Get pending inspections for display
  const getPendingInspections = useCallback((): PendingInspection[] => {
    return pendingActions
      .filter(a => a.type === 'create_inspection')
      .map(a => a.data as PendingInspection);
  }, [pendingActions]);

  // Check if cache is available and valid
  const isCacheAvailable = useCallback((): boolean => {
    const lastCache = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!lastCache) return false;
    
    const lastCacheTime = parseInt(lastCache, 10);
    return Date.now() - lastCacheTime < CACHE_MAX_AGE;
  }, []);

  return {
    isOnline,
    pendingActions,
    pendingCount: pendingActions.length,
    isSyncing,
    lastSyncTime,
    addPendingAction,
    addPendingInspection,
    removePendingAction,
    clearPendingActions,
    cacheOfflineData,
    getOfflineData,
    getPendingInspections,
    syncPendingInspections,
    preCacheData,
    isCacheAvailable,
  };
}
