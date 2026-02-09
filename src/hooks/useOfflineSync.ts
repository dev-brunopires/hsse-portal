import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { hapticSuccess, hapticWarning } from '@/utils/hapticFeedback';
import * as offlineDB from '@/utils/offlineStorage';
import { generateInspectionPhotoPath, getCurrentOrganizationId } from '@/utils/storageHelpers';
import { useShipFilter } from '@/contexts/ShipFilterContext';

// Bug #5: Safe wrapper — returns null if outside ShipFilterProvider
function useShipFilterSafe(): { selectedShipId: string | null } {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useShipFilter();
  } catch {
    return { selectedShipId: null };
  }
}

// Push notification helper for sync completion
const showSyncPushNotification = async (
  title: string, 
  body: string, 
  tag: string = 'sync-completed',
  requireInteraction: boolean = false
) => {
  if (!('Notification' in window)) return;
  
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
        badge: '/pwa-192x192.png',
        tag,
        requireInteraction,
        data: { 
          type: tag,
          timestamp: Date.now(),
        },
      } as NotificationOptions);
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
  CachedLastInspection,
  StorageStats,
} from '@/utils/offlineStorage';

const MAX_RETRY_COUNT = 5;
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours
const EQUIPMENT_BATCH_SIZE = 500;
const MIN_CACHE_CHECK_INTERVAL = 1000 * 60 * 5; // 5 minutes between cache checks
const SESSION_CACHE_KEY = 'offline_cache_checked_this_session';

// Exponential backoff configuration
const BASE_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;

const calculateBackoffDelay = (retryCount: number): number => {
  const exponentialDelay = Math.min(
    BASE_RETRY_DELAY * Math.pow(2, retryCount),
    MAX_RETRY_DELAY
  );
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(exponentialDelay + jitter);
};

const waitWithBackoff = (retryCount: number): Promise<void> => {
  const delay = calculateBackoffDelay(retryCount);
  console.log(`Retry ${retryCount}: waiting ${delay}ms before next attempt`);
  return new Promise(resolve => setTimeout(resolve, delay));
};

const getInitialOnlineState = () => {
  try {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  } catch {
    return true;
  }
};

// Module-level singleton guards
let globalCacheInProgress = false;
let globalLastCacheCheck = 0;
let pendingShipSync: string | null = null; // Bug #4: queue for pending ship sync

// ===== Singleton online/offline listener =====
// Registered once globally, notifies all hook instances via callbacks set.
type NetworkCallback = (online: boolean) => void;
const networkCallbacks = new Set<NetworkCallback>();
let networkListenersRegistered = false;

function registerNetworkListeners() {
  if (networkListenersRegistered) return;
  networkListenersRegistered = true;

  window.addEventListener('online', () => {
    networkCallbacks.forEach(cb => cb(true));
  });
  window.addEventListener('offline', () => {
    networkCallbacks.forEach(cb => cb(false));
  });
}

// Singleton toast guard: only the first callback in the set fires the toast
let lastNetworkToastFired = 0;
const NETWORK_TOAST_DEBOUNCE = 500; // ms

// Sync progress state type
export interface SyncProgressState {
  currentItem: string | null;
  currentIndex: number;
  totalItems: number;
  percentage: number;
  type: 'inspection' | 'maintenance' | null;
}

/**
 * Get the ship IDs accessible to the current user.
 * Admins/admin_master see all ships in their org; others see assigned ships.
 */
async function getUserShipIds(): Promise<string[] | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Check if admin/admin_master (they see all ships in org)
  const { data: role } = await supabase.rpc('get_user_role', { _user_id: user.id });
  
  if (role === 'admin' || role === 'admin_master') {
    // Check if user has a favorite ship — download only that one
    const { data: fav } = await supabase
      .from('user_favorites')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_type', 'ship')
      .maybeSingle();

    if (fav?.entity_id) {
      return [fav.entity_id]; // Download only the favorite ship
    }
    // No favorite = download all (no ship filter)
    return null;
  }

  // For technicians/supervisors/viewers, get assigned ships
  const { data: shipIds } = await supabase.rpc('get_user_ship_ids', { _user_id: user.id });
  return shipIds || [];
}

export function useOfflineSync() {
  const { t } = useTranslation();
  const { selectedShipId } = useShipFilterSafe(); // Bug #5: safe access
  const [isOnline, setIsOnline] = useState(getInitialOnlineState);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [cacheStats, setCacheStats] = useState<offlineDB.StorageStats | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgressState>({
    currentItem: null,
    currentIndex: 0,
    totalItems: 0,
    percentage: 0,
    type: null,
  });
  const queryClient = useQueryClient();
  const syncInProgressRef = useRef(false);
  const mountedRef = useRef(true);
  const syncedShipsRef = useRef<Map<string, number>>(new Map()); // shipId -> timestamp of last sync
  const SHIP_SYNC_COOLDOWN = 1000 * 60 * 5; // 5 min cooldown before re-syncing same ship

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
      if (!mountedRef.current) return;
      setCacheStats(stats);
      setPendingCount(stats.pendingActionsCount);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  }, []);

  /**
   * Pre-cache data for offline use.
   * - First sync: full download filtered by user's ships
   * - Subsequent syncs: delta sync using updated_at timestamp
   */
  const preCacheData = useCallback(async () => {
    if (!isOnline || globalCacheInProgress) return;
    
    globalCacheInProgress = true;

    try {
      console.log('Starting offline data caching...');

      // Determine which ships this user can access
      const userShipIds = await getUserShipIds();
      const lastSyncTs = await offlineDB.getLastSyncTimestamp();
      const isFullSync = !lastSyncTs;
      const syncStartTime = new Date().toISOString();

      console.log(isFullSync ? 'Full sync (first time)' : `Delta sync since ${lastSyncTs}`);
      if (userShipIds) {
        console.log(`Filtering by ${userShipIds.length} user ships`);
      }

      // ===== Equipment sync =====
      if (isFullSync) {
        // Full sync: clear and download all
        await fullSyncEquipment(userShipIds);
      } else {
        // Delta sync: only fetch updated/new records
        await deltaSyncEquipment(userShipIds, lastSyncTs);
      }

      // ===== Other data (small datasets, always full refresh) =====
      await Promise.all([
        syncCategories(),
        syncShips(),
        syncTemplates(),
        syncMaintenancePlans(userShipIds),
      ]);

      // ===== Last inspections (delta-aware) =====
      await syncLastInspections(lastSyncTs);

      // Save sync timestamp
      await offlineDB.setLastSyncTimestamp(syncStartTime);
      await offlineDB.setCacheTimestamp();
      await refreshStats();

      const equipCount = await offlineDB.getEquipmentCount();
      console.log(`Offline data cached successfully (${equipCount} equipment)`);
      
      const isFirstCache = !sessionStorage.getItem(SESSION_CACHE_KEY);
      if (isFirstCache) {
        toast.success(t('offline.cacheUpdated'), {
          id: 'cache-updated',
          description: t('offline.cacheUpdatedDesc', { count: equipCount }),
        });
      }
    } catch (error) {
      console.error('Error pre-caching data:', error);
      toast.error(t('offline.cacheError'), { id: 'cache-error' });
    } finally {
      globalCacheInProgress = false;
      // Bug #4: process pending ship sync after initial cache completes
      if (pendingShipSync) {
        const shipId = pendingShipSync;
        pendingShipSync = null;
        syncForShipInternal(shipId);
      }
    }
  }, [isOnline, t, refreshStats]);

  // ===== Sync helper functions =====

  async function fullSyncEquipment(shipIds: string[] | null) {
    // Get total count with ship filter
    let countQuery = supabase
      .from('equipment')
      .select('*', { count: 'exact', head: true });
    
    if (shipIds && shipIds.length > 0) {
      countQuery = countQuery.in('ship_id', shipIds);
    }
    
    const { count: totalEquipment } = await countQuery;
    console.log(`Total equipment to cache: ${totalEquipment}`);

    const allEquipment: offlineDB.CachedEquipment[] = [];
    let offset = 0;
    
    while (offset < (totalEquipment || 0)) {
      let query = supabase
        .from('equipment')
        .select(`
          id, name, internal_code, status, category_id, ship_id, location, serial_number, short_code,
          type, manufacturer, model, capacity, manufacturing_date, acquisition_date,
          expiry_date, certificate_expiry, last_inspection, next_inspection, observations, updated_at
        `)
        .range(offset, offset + EQUIPMENT_BATCH_SIZE - 1)
        .order('internal_code', { ascending: true });

      if (shipIds && shipIds.length > 0) {
        query = query.in('ship_id', shipIds);
      }

      const { data: batch } = await query;

      if (batch) {
        allEquipment.push(...batch);
        console.log(`Fetched ${allEquipment.length}/${totalEquipment} equipment`);
      }
      
      offset += EQUIPMENT_BATCH_SIZE;
    }

    // Full replace on first sync
    await offlineDB.cacheEquipment(allEquipment);
  }

  async function deltaSyncEquipment(shipIds: string[] | null, lastSyncTs: string) {
    // Fetch only records updated since last sync
    let query = supabase
      .from('equipment')
      .select(`
        id, name, internal_code, status, category_id, ship_id, location, serial_number, short_code,
        type, manufacturer, model, capacity, manufacturing_date, acquisition_date,
        expiry_date, certificate_expiry, last_inspection, next_inspection, observations, updated_at
      `)
      .gte('updated_at', lastSyncTs)
      .order('internal_code', { ascending: true });

    if (shipIds && shipIds.length > 0) {
      query = query.in('ship_id', shipIds);
    }

    // Paginate delta results (could be large after long offline period)
    const updatedEquipment: offlineDB.CachedEquipment[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch } = await query.range(offset, offset + EQUIPMENT_BATCH_SIZE - 1);
      
      if (batch && batch.length > 0) {
        updatedEquipment.push(...batch);
        offset += EQUIPMENT_BATCH_SIZE;
        hasMore = batch.length === EQUIPMENT_BATCH_SIZE;
      } else {
        hasMore = false;
      }
    }

    if (updatedEquipment.length > 0) {
      // Upsert (insert or update) without clearing existing data
      await offlineDB.upsertEquipment(updatedEquipment);
      console.log(`Delta synced ${updatedEquipment.length} equipment`);
    }

    // Check for deleted equipment: compare local IDs with server IDs
    // Only do this occasionally (every 6 hours) to avoid expensive queries
    const lastDeleteCheck = await offlineDB.getMetadata<number>('last_delete_check');
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    
    if (!lastDeleteCheck || Date.now() - lastDeleteCheck > SIX_HOURS) {
      await checkDeletedEquipment(shipIds);
      await offlineDB.setMetadata('last_delete_check', Date.now());
    }
  }

  async function checkDeletedEquipment(shipIds: string[] | null) {
    try {
      // Get all server IDs
      let query = supabase.from('equipment').select('id');
      if (shipIds && shipIds.length > 0) {
        query = query.in('ship_id', shipIds);
      }

      const serverIds = new Set<string>();
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch } = await query.range(offset, offset + 1000 - 1);
        if (batch && batch.length > 0) {
          batch.forEach(r => serverIds.add(r.id));
          offset += 1000;
          hasMore = batch.length === 1000;
        } else {
          hasMore = false;
        }
      }

      // Get local IDs
      const localIds = await offlineDB.getEquipmentIds();
      
      // Find IDs that exist locally but not on server
      const deletedIds = localIds.filter(id => !serverIds.has(id));
      
      if (deletedIds.length > 0) {
        await offlineDB.removeDeletedEquipment(deletedIds);
        console.log(`Removed ${deletedIds.length} deleted equipment from cache`);
      }
    } catch (error) {
      console.error('Error checking deleted equipment:', error);
    }
  }

  async function syncCategories() {
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, description, inspection_frequency');
    if (categories) {
      await offlineDB.cacheCategories(categories);
    }
  }

  async function syncShips() {
    const { data: ships } = await supabase
      .from('ships')
      .select('id, name, code');
    if (ships) {
      await offlineDB.cacheShips(ships);
    }
  }

  async function syncTemplates() {
    const { data: templates } = await supabase
      .from('checklist_templates')
      .select(`
        id, name, category_id,
        checklist_template_items (id, description, is_required, order_index)
      `);
    if (templates) {
      await offlineDB.cacheTemplates(templates);
    }
  }

  async function syncMaintenancePlans(shipIds: string[] | null) {
    let query = supabase
      .from('maintenance_plans')
      .select(`
        id, equipment_id, title, description, frequency, next_due_date, priority,
        equipment (name, internal_code, ship_id, ships (name))
      `)
      .order('next_due_date', { ascending: true });

    // Note: maintenance_plans don't have ship_id directly, filter via equipment join
    const { data: maintenancePlans } = await query;

    if (maintenancePlans) {
      let cachedPlans: offlineDB.CachedMaintenancePlan[] = maintenancePlans.map((plan: any) => ({
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

      // Filter by ship IDs if needed
      if (shipIds && shipIds.length > 0) {
        cachedPlans = cachedPlans.filter(p => p.ship_id && shipIds.includes(p.ship_id));
      }

      await offlineDB.cacheMaintenancePlans(cachedPlans);
    }
  }

  async function syncLastInspections(lastSyncTs: string | undefined) {
    // Get equipment IDs from local cache
    const equipmentIds = await offlineDB.getEquipmentIds();
    if (equipmentIds.length === 0) return;

    const lastInspections: offlineDB.CachedLastInspection[] = [];
    const INSPECTION_BATCH_SIZE = 200;
    
    for (let i = 0; i < equipmentIds.length; i += INSPECTION_BATCH_SIZE) {
      const batchIds = equipmentIds.slice(i, i + INSPECTION_BATCH_SIZE);
      
      let query = supabase
        .from('inspections')
        .select(`
          id, equipment_id, inspection_date, status, observations,
          recommendations, actions_taken,
          profiles!inspections_inspector_id_fkey (full_name)
        `)
        .in('equipment_id', batchIds)
        .order('inspection_date', { ascending: false });

      // For delta sync, only fetch inspections created since last sync
      if (lastSyncTs) {
        query = query.gte('created_at', lastSyncTs);
      }

      const { data: inspections } = await query;

      if (inspections) {
        const inspectionsByEquipment = new Map<string, any>();
        for (const insp of inspections) {
          if (!inspectionsByEquipment.has(insp.equipment_id)) {
            inspectionsByEquipment.set(insp.equipment_id, insp);
          }
        }
        
        inspectionsByEquipment.forEach((insp, equipId) => {
          lastInspections.push({
            id: insp.id,
            equipment_id: equipId,
            inspection_date: insp.inspection_date,
            status: insp.status,
            observations: insp.observations,
            recommendations: insp.recommendations,
            actions_taken: insp.actions_taken,
            inspector_name: (insp.profiles as any)?.full_name || null,
          });
        });
      }
      
      console.log(`Synced ${lastInspections.length}/${equipmentIds.length} last inspections`);
    }
    
    if (lastSyncTs && lastInspections.length > 0) {
      // Delta: upsert only changed inspections
      await offlineDB.upsertManyInStore(offlineDB.STORES.LAST_INSPECTIONS as any, lastInspections);
    } else if (!lastSyncTs) {
      // Full sync: replace all
      await offlineDB.cacheLastInspections(lastInspections);
    }
  }

  // Check if cache is stale and notify/refresh (with throttling)
  const checkAndRefreshCache = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - globalLastCacheCheck < MIN_CACHE_CHECK_INTERVAL) {
      return;
    }
    globalLastCacheCheck = now;

    const sessionChecked = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!force && sessionChecked) {
      return;
    }

    const cacheTimestamp = await offlineDB.getCacheTimestamp();
    const isValid = await offlineDB.isCacheValid(CACHE_MAX_AGE);
    
    if (!isValid && cacheTimestamp) {
      if (isOnline) {
        await preCacheData();
      }
    } else if (!cacheTimestamp && isOnline) {
      await preCacheData();
    }

    sessionStorage.setItem(SESSION_CACHE_KEY, 'true');
  }, [preCacheData, isOnline]);

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
        const blob = offlineDB.base64ToBlob(photo.base64Data, photo.mimeType);
        const file = new File([blob], photo.fileName, { type: photo.mimeType });
        
        const filePath = generateInspectionPhotoPath(organizationId, serverInspectionId, photo.fileName);
        const { error: uploadError } = await supabase.storage
          .from('inspection-photos')
          .upload(filePath, file);
        
        if (uploadError) {
          console.error('Photo upload error:', uploadError);
          continue;
        }

        await supabase
          .from('inspection_photos')
          .insert({
            inspection_id: serverInspectionId,
            file_name: photo.fileName,
            file_path: filePath,
          });

        await offlineDB.removePhoto(photo.id);
      } catch (error) {
        console.error('Error uploading photo:', error);
      }
    }
  }, []);

  // Check if a recent inspection exists for the same equipment (prevents duplicates)
  const checkDuplicateInspection = useCallback(async (
    equipmentId: string,
    timestamp: number,
    windowMs: number = 5 * 60 * 1000
  ): Promise<boolean> => {
    try {
      const minDate = new Date(timestamp - windowMs).toISOString();
      const maxDate = new Date(timestamp + windowMs).toISOString();
      
      const { data, error } = await supabase
        .from('inspections')
        .select('id')
        .eq('equipment_id', equipmentId)
        .gte('created_at', minDate)
        .lte('created_at', maxDate)
        .limit(1);
      
      if (error) {
        console.error('Error checking duplicate:', error);
        return false;
      }
      
      return (data?.length || 0) > 0;
    } catch {
      return false;
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
    
    const totalItems = inspectionActions.length;
    setSyncProgress({
      currentItem: null,
      currentIndex: 0,
      totalItems,
      percentage: 0,
      type: 'inspection',
    });
    
    let syncedCount = 0;
    let skippedCount = 0;
    const failedActions: string[] = [];
    const processedActionIds = new Set<string>();

    for (let i = 0; i < inspectionActions.length; i++) {
      const action = inspectionActions[i];
      if (processedActionIds.has(action.id)) {
        console.log('Skipping duplicate action in batch:', action.id);
        continue;
      }
      processedActionIds.add(action.id);
      
      try {
        const inspection = action.data as offlineDB.PendingInspection;
        
        const currentIndex = i + 1;
        const percentage = Math.round((currentIndex / totalItems) * 100);
        setSyncProgress({
          currentItem: inspection.equipment_name || `Inspeção ${currentIndex}`,
          currentIndex,
          totalItems,
          percentage,
          type: 'inspection',
        });
        
        const isDuplicate = await checkDuplicateInspection(
          inspection.equipment_id,
          inspection.timestamp
        );
        
        if (isDuplicate) {
          console.log('Skipping duplicate inspection for equipment:', inspection.equipment_id);
          await offlineDB.removePendingAction(action.id);
          await offlineDB.removePhotosByInspection(inspection.id);
          skippedCount++;
          continue;
        }
        
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

        if (newInspection) {
          await uploadPendingPhotos(inspection.id, newInspection.id);
        }

        if (newInspection) {
          await supabase
            .from('equipment')
            .update({
              last_inspection: newInspection.inspection_date,
              status: inspection.status === 'non-compliant' ? 'maintenance' : 'active',
            })
            .eq('id', inspection.equipment_id);
        }

        await offlineDB.removePendingAction(action.id);
        syncedCount++;
      } catch (error) {
        console.error('Error syncing inspection:', error);
        
        const retryCount = (action.retryCount || 0) + 1;
        
        if (retryCount >= MAX_RETRY_COUNT) {
          failedActions.push(action.id);
          await offlineDB.removePendingAction(action.id);
          console.log(`Inspection sync permanently failed after ${MAX_RETRY_COUNT} attempts`);
        } else {
          await offlineDB.updatePendingAction({ ...action, retryCount });
          await waitWithBackoff(retryCount);
        }
      }
    }

    setSyncProgress(prev => ({
      ...prev,
      percentage: 100,
      currentItem: null,
    }));
    
    syncInProgressRef.current = false;
    setIsSyncing(false);
    setLastSyncTime(Date.now());
    await refreshStats();

    if (syncedCount > 0) {
      hapticSuccess();
      toast.success(t('offline.syncCompleted'), {
        id: 'sync-completed',
        description: t('offline.syncCompletedDesc', { count: syncedCount }),
      });
      
      showSyncPushNotification(
        t('offline.syncCompleted'),
        t('offline.syncCompletedDesc', { count: syncedCount })
      );
      
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    }
    
    if (skippedCount > 0) {
      console.log(`Skipped ${skippedCount} duplicate inspections`);
    }

    if (failedActions.length > 0) {
      hapticWarning();
      toast.error(t('offline.syncFailed'), {
        id: 'sync-failed',
        description: t('offline.syncFailedDesc', { count: failedActions.length }),
      });
    }
  }, [isOnline, queryClient, t, uploadPendingPhotos, refreshStats, checkDuplicateInspection]);

  // Sync pending maintenance when online
  const syncPendingMaintenance = useCallback(async () => {
    if (!isOnline || syncInProgressRef.current) return;

    const pendingActions = await offlineDB.getPendingActions();
    const maintenanceActions = pendingActions.filter(a => a.type === 'complete_maintenance');
    
    if (maintenanceActions.length === 0) return;

    syncInProgressRef.current = true;
    setIsSyncing(true);
    
    const totalItems = maintenanceActions.length;
    setSyncProgress({
      currentItem: null,
      currentIndex: 0,
      totalItems,
      percentage: 0,
      type: 'maintenance',
    });
    
    let syncedCount = 0;
    const failedActions: string[] = [];

    for (let i = 0; i < maintenanceActions.length; i++) {
      const action = maintenanceActions[i];
      try {
        const maintenance = action.data as offlineDB.PendingMaintenance;
        
        const currentIndex = i + 1;
        const percentage = Math.round((currentIndex / totalItems) * 100);
        setSyncProgress({
          currentItem: maintenance.equipment_name || `Manutenção ${currentIndex}`,
          currentIndex,
          totalItems,
          percentage,
          type: 'maintenance',
        });
        
        const { data: user } = await supabase.auth.getUser();
        
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

        const nextDate = calculateNextDueDate(maintenance.next_due_date, maintenance.frequency);
        await supabase
          .from('maintenance_plans')
          .update({
            last_completed_date: new Date().toISOString().split('T')[0],
            next_due_date: nextDate,
          })
          .eq('id', maintenance.plan_id);

        await offlineDB.removePendingAction(action.id);
        syncedCount++;
      } catch (error) {
        console.error('Error syncing maintenance:', error);
        
        const retryCount = (action.retryCount || 0) + 1;
        
        if (retryCount >= MAX_RETRY_COUNT) {
          failedActions.push(action.id);
          await offlineDB.removePendingAction(action.id);
          console.log(`Maintenance sync permanently failed after ${MAX_RETRY_COUNT} attempts`);
        } else {
          await offlineDB.updatePendingAction({ ...action, retryCount });
          await waitWithBackoff(retryCount);
        }
      }
    }

    setSyncProgress(prev => ({
      ...prev,
      percentage: 100,
      currentItem: null,
    }));
    
    syncInProgressRef.current = false;
    setIsSyncing(false);
    setLastSyncTime(Date.now());
    await refreshStats();

    if (syncedCount > 0) {
      hapticSuccess();
      toast.success(t('offline.maintenanceSyncCompleted'), {
        id: 'maintenance-sync-completed',
        description: t('offline.maintenanceSyncCompletedDesc', { count: syncedCount }),
      });
      
      showSyncPushNotification(
        t('offline.maintenanceSyncCompleted'),
        t('offline.maintenanceSyncCompletedDesc', { count: syncedCount }),
        'maintenance-sync-completed'
      );
      
      queryClient.invalidateQueries({ queryKey: ['maintenance-plans'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-logs'] });
    }

    if (failedActions.length > 0) {
      hapticWarning();
      toast.error(t('offline.syncFailed'), {
        id: 'maintenance-sync-failed',
        description: t('offline.syncFailedDesc', { count: failedActions.length }),
      });
    }
  }, [isOnline, queryClient, t, refreshStats]);

  // Online/offline event listeners — singleton pattern
  useEffect(() => {
    registerNetworkListeners();

    const callback: NetworkCallback = (online) => {
      setIsOnline(online);

      // Debounce: only the first hook instance within the window fires the toast
      const now = Date.now();
      if (now - lastNetworkToastFired < NETWORK_TOAST_DEBOUNCE) return;
      lastNetworkToastFired = now;

      if (online) {
        hapticSuccess();
        toast.success(t('offline.connectionRestored'), {
          id: 'network-status',
          description: t('offline.connectionRestoredDesc'),
        });
      } else {
        hapticWarning();
        toast.error(t('offline.offlineMode'), {
          id: 'network-status',
          description: t('offline.offlineModeDesc'),
        });
      }
    };

    networkCallbacks.add(callback);
    return () => { networkCallbacks.delete(callback); };
  }, [t]);

  // Auto-sync when coming online and refresh cache
  useEffect(() => {
    if (isOnline) {
      syncPendingInspections();
      syncPendingMaintenance();
      checkAndRefreshCache();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync data for a specific ship (incremental)
  // Bug #4: internal function referenced by preCacheData's finally block
  const syncForShipInternal = async (shipId: string) => {
    if (!isOnline) return;

    globalCacheInProgress = true;
    try {
      console.log(`Syncing data for ship ${shipId}...`);
      const shipIds = [shipId];
      const lastSyncTs = await offlineDB.getLastSyncTimestamp();

      if (lastSyncTs) {
        await deltaSyncEquipment(shipIds, lastSyncTs);
      } else {
        await fullSyncEquipment(shipIds);
      }

      // Bug #1: Also sync categories, ships, and templates
      await Promise.all([
        syncCategories(),
        syncShips(),
        syncTemplates(),
        syncMaintenancePlans(shipIds),
      ]);

      await syncLastInspections(lastSyncTs);
      await offlineDB.setCacheTimestamp();
      await refreshStats();

      syncedShipsRef.current.set(shipId, Date.now());

      const equipCount = await offlineDB.getEquipmentCount();
      console.log(`Ship ${shipId} synced (${equipCount} total equipment in cache)`);
      
      // Bug #3: Only show toast if there are meaningful data counts
      if (equipCount > 0) {
        toast(t('offline.cacheUpdated'), {
          id: 'ship-cache-updated',
          description: t('offline.cacheUpdatedDesc', { count: equipCount }),
        });
      }
    } catch (error) {
      console.error(`Error syncing ship ${shipId}:`, error);
    } finally {
      globalCacheInProgress = false;
    }
  };

  const syncForShip = useCallback(async (shipId: string) => {
    // Bug #4: If cache is in progress, queue this ship for later
    if (globalCacheInProgress) {
      console.log(`Cache in progress, queuing ship ${shipId} for later`);
      pendingShipSync = shipId;
      return;
    }
    
    if (!isOnline) return;

    // Check cooldown
    const lastSync = syncedShipsRef.current.get(shipId);
    if (lastSync && Date.now() - lastSync < SHIP_SYNC_COOLDOWN) {
      console.log(`Ship ${shipId} synced recently, skipping`);
      return;
    }

    await syncForShipInternal(shipId);
  }, [isOnline, t, refreshStats]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync when selected ship changes
  useEffect(() => {
    if (!selectedShipId || !isOnline) return;

    // Skip if this ship was already synced recently
    const lastSync = syncedShipsRef.current.get(selectedShipId);
    if (lastSync && Date.now() - lastSync < SHIP_SYNC_COOLDOWN) return;

    syncForShip(selectedShipId);
  }, [selectedShipId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    }, 30000);

    return () => clearInterval(retryInterval);
  }, [isOnline, isSyncing, syncPendingInspections]);

  // Initial stats refresh on mount + cleanup
  useEffect(() => {
    mountedRef.current = true;
    refreshStats();
    return () => {
      mountedRef.current = false;
    };
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
      id: 'saved-locally',
      description: t('offline.savedLocallyDesc'),
    });
    
    return action.id;
  }, [t, refreshStats]);

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

  const removePendingAction = useCallback(async (id: string) => {
    await offlineDB.removePendingAction(id);
    await refreshStats();
  }, [refreshStats]);

  const clearPendingActions = useCallback(async () => {
    await offlineDB.clearPendingActions();
    await refreshStats();
  }, [refreshStats]);

  const getOfflineData = useCallback(async () => {
    try {
      const [equipment, categories, ships, templates, maintenancePlans, lastInspections, cacheTimestamp] = await Promise.all([
        offlineDB.getEquipment(),
        offlineDB.getCategories(),
        offlineDB.getShips(),
        offlineDB.getTemplates(),
        offlineDB.getMaintenancePlans(),
        offlineDB.getLastInspections(),
        offlineDB.getCacheTimestamp(),
      ]);

      return {
        equipment,
        categories,
        ships,
        templates,
        maintenancePlans,
        lastInspections,
        timestamp: cacheTimestamp,
      };
    } catch (error) {
      console.error('Error getting offline data:', error);
      return null;
    }
  }, []);

  const getLastInspectionOffline = useCallback(async (equipmentId: string): Promise<offlineDB.CachedLastInspection | undefined> => {
    return offlineDB.getLastInspectionByEquipment(equipmentId);
  }, []);

  const getPendingInspections = useCallback(async (): Promise<offlineDB.PendingInspection[]> => {
    const actions = await offlineDB.getPendingActions();
    return actions
      .filter(a => a.type === 'create_inspection')
      .map(a => a.data as offlineDB.PendingInspection);
  }, []);

  const getPendingMaintenance = useCallback(async (): Promise<offlineDB.PendingMaintenance[]> => {
    const actions = await offlineDB.getPendingActions();
    return actions
      .filter(a => a.type === 'complete_maintenance')
      .map(a => a.data as offlineDB.PendingMaintenance);
  }, []);

  const isCacheAvailable = useCallback(async (): Promise<boolean> => {
    return offlineDB.isCacheValid(CACHE_MAX_AGE);
  }, []);

  const addPendingPhoto = useCallback(async (
    file: File,
    inspectionId: string
  ): Promise<offlineDB.PendingPhoto> => {
    return offlineDB.processAndStorePhoto(file, inspectionId);
  }, []);

  const getPendingPhotos = useCallback(async (
    inspectionId: string
  ): Promise<offlineDB.PendingPhoto[]> => {
    return offlineDB.getPhotosByInspection(inspectionId);
  }, []);

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
    syncProgress,
    addPendingAction,
    addPendingInspection,
    addPendingMaintenance,
    removePendingAction,
    clearPendingActions,
    getOfflineData,
    getLastInspectionOffline,
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
