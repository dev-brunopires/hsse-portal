import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { hapticSuccess, hapticWarning } from '@/utils/hapticFeedback';
import * as offlineDB from '@/utils/offlineStorage';
import { generateInspectionPhotoPath, getCurrentOrganizationId } from '@/utils/storageHelpers';

// Push notification helper for sync completion
const showSyncPushNotification = async (title: string, body: string, tag: string = 'sync-completed') => {
  if (!('Notification' in window)) return;
  
  // Request permission if not granted
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  
  if (Notification.permission !== 'granted') return;
  
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        tag,
      });
    } else {
      new Notification(title, { body, icon: '/pwa-192x192.png' });
    }
  } catch (error) {
    console.error('Error showing push notification:', error);
  }
};

// Re-export types from offlineStorage
export type { 
  PendingInspection, 
  PendingMaintenance,
  PendingAction, 
  PendingPhoto,
  CachedEquipment,
  CachedCategory,
  CachedShip,
  CachedTemplate,
  CachedMaintenancePlan,
  StorageStats,
} from '@/utils/offlineStorage';

const MAX_RETRY_COUNT = 3;
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours
const EQUIPMENT_BATCH_SIZE = 500; // Fetch in batches for large datasets

// Safe initialization of state
const getInitialOnlineState = () => {
  try {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  } catch {
    return true;
  }
};

export function useOfflineSync() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(getInitialOnlineState);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [cacheStats, setCacheStats] = useState<offlineDB.StorageStats | null>(null);
  const queryClient = useQueryClient();
  const syncInProgressRef = useRef(false);

  // Load initial pending count
  useEffect(() => {
    const loadPendingCount = async () => {
      try {
        const count = await offlineDB.getPendingActionsCount();
        setPendingCount(count);
      } catch (error) {
        console.error('Error loading pending count:', error);
      }
    };
    loadPendingCount();
  }, []);

  // Refresh storage stats
  const refreshStats = useCallback(async () => {
    try {
      const stats = await offlineDB.getStorageStats();
      setCacheStats(stats);
      setPendingCount(stats.pendingActionsCount);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  }, []);

  // Pre-cache critical data for offline use with pagination for large datasets
  const preCacheData = useCallback(async () => {
    if (!isOnline) return;

    try {
      console.log('Starting offline data caching...');

      // Get total equipment count first
      const { count: totalEquipment } = await supabase
        .from('equipment')
        .select('*', { count: 'exact', head: true });

      console.log(`Total equipment to cache: ${totalEquipment}`);

      // Fetch equipment in batches to handle 2000+ items
      const allEquipment: offlineDB.CachedEquipment[] = [];
      let offset = 0;
      
      while (offset < (totalEquipment || 0)) {
        const { data: batch } = await supabase
          .from('equipment')
          .select('id, name, internal_code, status, category_id, ship_id, location, serial_number, short_code')
          .range(offset, offset + EQUIPMENT_BATCH_SIZE - 1)
          .order('internal_code', { ascending: true });

        if (batch) {
          allEquipment.push(...batch);
          console.log(`Cached ${allEquipment.length}/${totalEquipment} equipment`);
        }
        
        offset += EQUIPMENT_BATCH_SIZE;
      }

      // Cache equipment in IndexedDB
      await offlineDB.cacheEquipment(allEquipment);

      // Cache categories
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, description, inspection_frequency');
      
      if (categories) {
        await offlineDB.cacheCategories(categories);
      }

      // Cache ships
      const { data: ships } = await supabase
        .from('ships')
        .select('id, name, code');
      
      if (ships) {
        await offlineDB.cacheShips(ships);
      }

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
      
      if (templates) {
        await offlineDB.cacheTemplates(templates);
      }

      // Cache maintenance plans with equipment info
      const { data: maintenancePlans } = await supabase
        .from('maintenance_plans')
        .select(`
          id,
          equipment_id,
          title,
          description,
          frequency,
          next_due_date,
          priority,
          equipment (
            name,
            internal_code,
            ship_id,
            ships (name)
          )
        `)
        .order('next_due_date', { ascending: true });

      if (maintenancePlans) {
        const cachedPlans: offlineDB.CachedMaintenancePlan[] = maintenancePlans.map((plan: any) => ({
          id: plan.id,
          equipment_id: plan.equipment_id,
          title: plan.title,
          description: plan.description,
          frequency: plan.frequency,
          next_due_date: plan.next_due_date,
          priority: plan.priority,
          equipment_name: plan.equipment?.name || '',
          equipment_code: plan.equipment?.internal_code || '',
          ship_id: plan.equipment?.ship_id || null,
          ship_name: plan.equipment?.ships?.name || null,
        }));
        await offlineDB.cacheMaintenancePlans(cachedPlans);
      }

      // Set cache timestamp
      await offlineDB.setCacheTimestamp();

      // Refresh stats
      await refreshStats();

      console.log('Offline data cached successfully');
      toast.success(t('offline.cacheUpdated'), {
        description: t('offline.cacheUpdatedDesc', { count: allEquipment.length }),
      });
    } catch (error) {
      console.error('Error pre-caching data:', error);
      toast.error(t('offline.cacheError'));
    }
  }, [isOnline, t, refreshStats]);

  // Check if cache is stale and notify/refresh
  const checkAndRefreshCache = useCallback(async () => {
    const cacheTimestamp = await offlineDB.getCacheTimestamp();
    const isValid = await offlineDB.isCacheValid(CACHE_MAX_AGE);
    
    if (!isValid && cacheTimestamp) {
      // Cache is stale - notify user
      const hoursSinceUpdate = Math.round((Date.now() - cacheTimestamp) / (1000 * 60 * 60));
      
      toast.warning(t('offline.cacheExpired'), {
        description: t('offline.cacheExpiredDesc', { hours: hoursSinceUpdate }),
        duration: 8000,
      });
      
      // Show push notification for cache expiry
      showSyncPushNotification(
        t('offline.cacheExpired'),
        t('offline.cacheExpiredDesc', { hours: hoursSinceUpdate }),
        'cache-expired'
      );
      
      if (isOnline) {
        await preCacheData();
      }
    } else if (!cacheTimestamp && isOnline) {
      // No cache exists, create one
      await preCacheData();
    }
  }, [preCacheData, isOnline, t]);

  // Upload pending photos for an inspection
  const uploadPendingPhotos = useCallback(async (
    localInspectionId: string,
    serverInspectionId: string
  ): Promise<void> => {
    const photos = await offlineDB.getPhotosByInspection(localInspectionId);
    if (photos.length === 0) return;

    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) return;

    for (const photo of photos) {
      try {
        // Convert base64 back to blob
        const blob = offlineDB.base64ToBlob(photo.base64Data, photo.mimeType);
        const file = new File([blob], photo.fileName, { type: photo.mimeType });
        
        // Upload to storage
        const filePath = generateInspectionPhotoPath(organizationId, serverInspectionId, photo.fileName);
        const { error: uploadError } = await supabase.storage
          .from('inspection-photos')
          .upload(filePath, file);
        
        if (uploadError) {
          console.error('Photo upload error:', uploadError);
          continue;
        }

        // Create photo record in database
        await supabase
          .from('inspection_photos')
          .insert({
            inspection_id: serverInspectionId,
            file_name: photo.fileName,
            file_path: filePath,
          });

        // Remove from local storage
        await offlineDB.removePhoto(photo.id);
      } catch (error) {
        console.error('Error uploading photo:', error);
      }
    }
  }, []);

  // Sync pending inspections when online
  const syncPendingInspections = useCallback(async () => {
    if (!isOnline || syncInProgressRef.current) return;

    const pendingActions = await offlineDB.getPendingActions();
    const inspectionActions = pendingActions.filter(a => a.type === 'create_inspection');
    
    if (inspectionActions.length === 0) return;

    syncInProgressRef.current = true;
    setIsSyncing(true);
    
    let syncedCount = 0;
    const failedActions: string[] = [];

    for (const action of inspectionActions) {
      try {
        const inspection = action.data as offlineDB.PendingInspection;
        
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

        // Upload photos if any
        if (newInspection) {
          await uploadPendingPhotos(inspection.id, newInspection.id);
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
        await offlineDB.removePendingAction(action.id);
        syncedCount++;
      } catch (error) {
        console.error('Error syncing inspection:', error);
        
        // Increment retry count
        const retryCount = (action.retryCount || 0) + 1;
        if (retryCount >= MAX_RETRY_COUNT) {
          failedActions.push(action.id);
        } else {
          await offlineDB.updatePendingAction({ ...action, retryCount });
        }
      }
    }

    syncInProgressRef.current = false;
    setIsSyncing(false);
    setLastSyncTime(Date.now());
    await refreshStats();

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
  }, [isOnline, queryClient, t, uploadPendingPhotos, refreshStats]);

  // Sync pending maintenance when online
  const syncPendingMaintenance = useCallback(async () => {
    if (!isOnline || syncInProgressRef.current) return;

    const pendingActions = await offlineDB.getPendingActions();
    const maintenanceActions = pendingActions.filter(a => a.type === 'complete_maintenance');
    
    if (maintenanceActions.length === 0) return;

    syncInProgressRef.current = true;
    setIsSyncing(true);
    
    let syncedCount = 0;
    const failedActions: string[] = [];

    for (const action of maintenanceActions) {
      try {
        const maintenance = action.data as offlineDB.PendingMaintenance;
        
        const { data: user } = await supabase.auth.getUser();
        
        // Create maintenance log entry
        const { error: logError } = await supabase
          .from('maintenance_logs')
          .insert({
            maintenance_plan_id: maintenance.plan_id,
            equipment_id: maintenance.equipment_id,
            completed_by: user?.user?.id || maintenance.completed_by,
            notes: maintenance.notes,
            status: maintenance.status,
          });

        if (logError) throw logError;

        // Calculate next due date based on frequency
        const calculateNextDueDate = (currentDate: string, frequency: string): string => {
          const date = new Date(currentDate);
          switch (frequency) {
            case 'daily': date.setDate(date.getDate() + 1); break;
            case 'weekly': date.setDate(date.getDate() + 7); break;
            case 'monthly': date.setMonth(date.getMonth() + 1); break;
            case 'quarterly': date.setMonth(date.getMonth() + 3); break;
            case 'yearly': date.setFullYear(date.getFullYear() + 1); break;
          }
          return date.toISOString().split('T')[0];
        };

        // Update plan with next due date
        const nextDate = calculateNextDueDate(maintenance.next_due_date, maintenance.frequency);
        await supabase
          .from('maintenance_plans')
          .update({
            last_completed_date: new Date().toISOString().split('T')[0],
            next_due_date: nextDate,
          })
          .eq('id', maintenance.plan_id);

        // Remove synced action
        await offlineDB.removePendingAction(action.id);
        syncedCount++;
      } catch (error) {
        console.error('Error syncing maintenance:', error);
        
        // Increment retry count
        const retryCount = (action.retryCount || 0) + 1;
        if (retryCount >= MAX_RETRY_COUNT) {
          failedActions.push(action.id);
        } else {
          await offlineDB.updatePendingAction({ ...action, retryCount });
        }
      }
    }

    syncInProgressRef.current = false;
    setIsSyncing(false);
    setLastSyncTime(Date.now());
    await refreshStats();

    if (syncedCount > 0) {
      hapticSuccess();
      toast.success(t('offline.maintenanceSyncCompleted'), {
        description: t('offline.maintenanceSyncCompletedDesc', { count: syncedCount }),
      });
      
      // Show push notification for sync completion
      showSyncPushNotification(
        t('offline.maintenanceSyncCompleted'),
        t('offline.maintenanceSyncCompletedDesc', { count: syncedCount }),
        'maintenance-sync-completed'
      );
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['maintenance-plans'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-logs'] });
    }

    if (failedActions.length > 0) {
      hapticWarning();
      toast.error(t('offline.syncFailed'), {
        description: t('offline.syncFailedDesc', { count: failedActions.length }),
      });
    }
  }, [isOnline, queryClient, t, refreshStats]);

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
      syncPendingInspections();
      syncPendingMaintenance();
      checkAndRefreshCache();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-retry failed sync every 30 seconds when online with pending actions
  useEffect(() => {
    if (!isOnline || isSyncing) return;

    const retryInterval = setInterval(async () => {
      const pendingActions = await offlineDB.getPendingActions();
      const hasFailedActions = pendingActions.some(a => (a.retryCount || 0) > 0);
      
      if (hasFailedActions && isOnline && !syncInProgressRef.current) {
        console.log('Auto-retry sync triggered for failed actions');
        syncPendingInspections();
        syncPendingMaintenance();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(retryInterval);
  }, [isOnline, isSyncing, syncPendingInspections]);

  // Initial cache check on mount
  useEffect(() => {
    if (isOnline) {
      checkAndRefreshCache();
    }
    refreshStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Add a pending action
  const addPendingAction = useCallback(async (
    type: offlineDB.PendingAction['type'], 
    data: any
  ): Promise<string> => {
    const action: offlineDB.PendingAction = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    await offlineDB.addPendingAction(action);
    await refreshStats();
    
    toast.info(t('offline.savedLocally'), {
      description: t('offline.savedLocallyDesc'),
    });
    
    return action.id;
  }, [t, refreshStats]);

  // Add pending inspection (convenience method)
  // If the inspection already has an id (e.g., for photo association), use it
  const addPendingInspection = useCallback(async (
    inspection: Omit<offlineDB.PendingInspection, 'id' | 'timestamp'> & { id?: string }
  ): Promise<string> => {
    const pendingInspection: offlineDB.PendingInspection = {
      ...inspection,
      id: inspection.id || crypto.randomUUID(),
      timestamp: Date.now(),
    };
    
    return addPendingAction('create_inspection', pendingInspection);
  }, [addPendingAction]);

  // Add pending maintenance (convenience method)
  const addPendingMaintenance = useCallback(async (
    maintenance: Omit<offlineDB.PendingMaintenance, 'id' | 'timestamp'>
  ): Promise<string> => {
    const pendingMaintenance: offlineDB.PendingMaintenance = {
      ...maintenance,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    
    return addPendingAction('complete_maintenance', pendingMaintenance);
  }, [addPendingAction]);

  // Remove a pending action
  const removePendingAction = useCallback(async (id: string) => {
    await offlineDB.removePendingAction(id);
    await refreshStats();
  }, [refreshStats]);

  // Clear all pending actions
  const clearPendingActions = useCallback(async () => {
    await offlineDB.clearPendingActions();
    await refreshStats();
  }, [refreshStats]);

  // Get offline data from IndexedDB
  const getOfflineData = useCallback(async () => {
    try {
      const [equipment, categories, ships, templates, maintenancePlans, cacheTimestamp] = await Promise.all([
        offlineDB.getEquipment(),
        offlineDB.getCategories(),
        offlineDB.getShips(),
        offlineDB.getTemplates(),
        offlineDB.getMaintenancePlans(),
        offlineDB.getCacheTimestamp(),
      ]);

      return {
        equipment,
        categories,
        ships,
        templates,
        maintenancePlans,
        timestamp: cacheTimestamp,
      };
    } catch (error) {
      console.error('Error getting offline data:', error);
      return null;
    }
  }, []);

  // Get pending inspections for display
  const getPendingInspections = useCallback(async (): Promise<offlineDB.PendingInspection[]> => {
    const actions = await offlineDB.getPendingActions();
    return actions
      .filter(a => a.type === 'create_inspection')
      .map(a => a.data as offlineDB.PendingInspection);
  }, []);

  // Get pending maintenance for display
  const getPendingMaintenance = useCallback(async (): Promise<offlineDB.PendingMaintenance[]> => {
    const actions = await offlineDB.getPendingActions();
    return actions
      .filter(a => a.type === 'complete_maintenance')
      .map(a => a.data as offlineDB.PendingMaintenance);
  }, []);

  // Check if cache is available and valid
  const isCacheAvailable = useCallback(async (): Promise<boolean> => {
    return offlineDB.isCacheValid(CACHE_MAX_AGE);
  }, []);

  // Add photo to pending inspection
  const addPendingPhoto = useCallback(async (
    file: File,
    inspectionId: string
  ): Promise<offlineDB.PendingPhoto> => {
    return offlineDB.processAndStorePhoto(file, inspectionId);
  }, []);

  // Get photos for inspection
  const getPendingPhotos = useCallback(async (
    inspectionId: string
  ): Promise<offlineDB.PendingPhoto[]> => {
    return offlineDB.getPhotosByInspection(inspectionId);
  }, []);

  // Remove pending photo
  const removePendingPhoto = useCallback(async (photoId: string) => {
    await offlineDB.removePhoto(photoId);
    await refreshStats();
  }, [refreshStats]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    cacheStats,
    addPendingAction,
    addPendingInspection,
    addPendingMaintenance,
    removePendingAction,
    clearPendingActions,
    getOfflineData,
    getPendingInspections,
    getPendingMaintenance,
    syncPendingInspections,
    syncPendingMaintenance,
    preCacheData,
    isCacheAvailable,
    refreshStats,
    // Photo operations
    addPendingPhoto,
    getPendingPhotos,
    removePendingPhoto,
  };
}
