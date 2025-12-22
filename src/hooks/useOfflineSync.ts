import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

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
}

const PENDING_ACTIONS_KEY = 'safeship_pending_actions';
const OFFLINE_DATA_KEY = 'safeship_offline_data';

export function useOfflineSync() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Sync pending inspections when online
  const syncPendingInspections = useCallback(async () => {
    if (!isOnline || pendingActions.length === 0) return;

    setIsSyncing(true);
    const inspectionActions = pendingActions.filter(a => a.type === 'create_inspection');
    let syncedCount = 0;

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
      }
    }

    setIsSyncing(false);

    if (syncedCount > 0) {
      toast({
        title: t('offline.syncCompleted'),
        description: t('offline.syncCompletedDesc', { count: syncedCount }),
      });
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    }
  }, [isOnline, pendingActions, toast, queryClient, t]);

  // Online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: t('offline.connectionRestored'),
        description: t('offline.connectionRestoredDesc'),
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: t('offline.offlineMode'),
        description: t('offline.offlineModeDesc'),
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, t]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingActions.length > 0) {
      syncPendingInspections();
    }
  }, [isOnline, syncPendingInspections]);

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
      title: t('offline.savedLocally'),
      description: t('offline.savedLocallyDesc'),
    });
    
    return action.id;
  }, [toast, t]);

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
  const getOfflineData = useCallback((key: string) => {
    try {
      const offlineData = JSON.parse(localStorage.getItem(OFFLINE_DATA_KEY) || '{}');
      return offlineData[key]?.data || null;
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

  return {
    isOnline,
    pendingActions,
    pendingCount: pendingActions.length,
    isSyncing,
    addPendingAction,
    addPendingInspection,
    removePendingAction,
    clearPendingActions,
    cacheOfflineData,
    getOfflineData,
    getPendingInspections,
    syncPendingInspections,
  };
}
