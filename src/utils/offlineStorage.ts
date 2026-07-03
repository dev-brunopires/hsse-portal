/**
 * IndexedDB-based offline storage for large datasets
 * Supports 10,000+ equipment with delta sync and paginated reads
 * localStorage limit is ~5-10MB, IndexedDB supports up to gigabytes
 */

const DB_NAME = 'safeship_offline';
const DB_VERSION = 4; // Incremented to add updated_at index

// Store names
const STORES = {
  EQUIPMENT: 'equipment',
  CATEGORIES: 'categories',
  SHIPS: 'ships',
  TEMPLATES: 'templates',
  PENDING_ACTIONS: 'pending_actions',
  PHOTOS: 'photos',
  METADATA: 'metadata',
  MAINTENANCE_PLANS: 'maintenance_plans',
  LAST_INSPECTIONS: 'last_inspections',
} as const;

// Interfaces
export interface CachedEquipment {
  id: string;
  name: string;
  internal_code: string;
  status: string;
  category_id: string;
  ship_id: string | null;
  location: string;
  serial_number: string;
  short_code?: string;
  type?: string;
  manufacturer?: string | null;
  model?: string | null;
  capacity?: string | null;
  manufacturing_date?: string | null;
  acquisition_date?: string | null;
  expiry_date?: string | null;
  certificate_expiry?: string | null;
  last_inspection?: string | null;
  next_inspection?: string | null;
  last_hydrostatic_test?: string | null;
  next_hydrostatic_test?: string | null;
  last_calibration?: string | null;
  next_calibration?: string | null;
  observations?: string | null;
  updated_at?: string; // For delta sync
}

export interface CachedCategory {
  id: string;
  name: string;
  description: string | null;
  inspection_frequency: string;
}

export interface CachedShip {
  id: string;
  name: string;
  code: string | null;
}

export interface CachedTemplate {
  id: string;
  name: string;
  category_id: string;
  checklist_template_items: Array<{
    id: string;
    description: string;
    is_required: boolean;
    order_index: number;
  }>;
}

export interface CachedMaintenancePlan {
  id: string;
  equipment_id: string;
  title: string;
  description: string | null;
  frequency: string;
  next_due_date: string;
  priority: string;
  equipment_name: string;
  equipment_code: string;
  ship_id: string | null;
  ship_name: string | null;
}

export interface CachedLastInspection {
  id: string;
  equipment_id: string;
  inspection_date: string;
  status: string;
  observations: string | null;
  recommendations: string | null;
  actions_taken: string | null;
  inspector_name: string | null;
}

export interface PendingPhoto {
  id: string;
  inspectionId: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
  createdAt: number;
  ownerUserId?: string;
}

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
  inspection_date?: string | null;
  next_inspection_date?: string | null;
  actions_taken?: string | null;
  timestamp: number;
  photos?: string[];
}

export interface PendingMaintenance {
  id: string;
  plan_id: string;
  plan_title: string;
  equipment_id: string;
  equipment_name: string;
  equipment_code: string;
  status: 'completed' | 'partial' | 'skipped';
  notes: string | null;
  completed_by: string;
  frequency: string;
  next_due_date: string;
  ship_id: string | null;
  timestamp: number;
}

export interface PendingAction {
  id: string;
  type: 'create_inspection' | 'update_inspection' | 'create_equipment' | 'complete_maintenance';
  data: PendingInspection | PendingMaintenance;
  timestamp: number;
  retryCount?: number;
  ownerUserId?: string;
  lastError?: string;
  failedAt?: number;
}

interface StorageMetadata {
  key: string;
  value: unknown;
}

// Paginated result interface
export interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  total: number;
}

// Open/create database
let dbInstance: IDBDatabase | null = null;
let isOpening = false;
let openPromise: Promise<IDBDatabase> | null = null;

export const resetDatabaseInstance = () => {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      console.warn('Error closing database:', e);
    }
  }
  dbInstance = null;
  isOpening = false;
  openPromise = null;
};

export const deleteDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    resetDatabaseInstance();
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      console.log('IndexedDB deleted successfully');
      resolve();
    };
    request.onerror = () => {
      console.error('Error deleting IndexedDB:', request.error);
      reject(request.error);
    };
    request.onblocked = () => {
      console.warn('Database deletion blocked - other tabs may be using it');
      resolve();
    };
  });
};

export const openDatabase = (): Promise<IDBDatabase> => {
  if (dbInstance && dbInstance.objectStoreNames.length > 0) {
    return Promise.resolve(dbInstance);
  }

  if (isOpening && openPromise) {
    return openPromise;
  }

  isOpening = true;
  openPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        isOpening = false;
        openPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        dbInstance = request.result;
        
        dbInstance.onclose = () => {
          console.warn('IndexedDB connection closed');
          resetDatabaseInstance();
        };
        
        dbInstance.onerror = (event) => {
          console.error('IndexedDB error event:', event);
        };
        
        isOpening = false;
        resolve(dbInstance);
      };

      request.onblocked = () => {
        console.warn('Database upgrade blocked - other tabs may need to close');
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.EQUIPMENT)) {
          const equipmentStore = db.createObjectStore(STORES.EQUIPMENT, { keyPath: 'id' });
          equipmentStore.createIndex('ship_id', 'ship_id', { unique: false });
          equipmentStore.createIndex('category_id', 'category_id', { unique: false });
          equipmentStore.createIndex('internal_code', 'internal_code', { unique: false });
          equipmentStore.createIndex('name', 'name', { unique: false });
          equipmentStore.createIndex('updated_at', 'updated_at', { unique: false });
        } else {
          // Add updated_at index if upgrading from v3
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const store = transaction.objectStore(STORES.EQUIPMENT);
          if (!store.indexNames.contains('updated_at')) {
            store.createIndex('updated_at', 'updated_at', { unique: false });
          }
        }

        if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
          db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.SHIPS)) {
          db.createObjectStore(STORES.SHIPS, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.TEMPLATES)) {
          const templateStore = db.createObjectStore(STORES.TEMPLATES, { keyPath: 'id' });
          templateStore.createIndex('category_id', 'category_id', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
          const pendingStore = db.createObjectStore(STORES.PENDING_ACTIONS, { keyPath: 'id' });
          pendingStore.createIndex('type', 'type', { unique: false });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.PHOTOS)) {
          const photoStore = db.createObjectStore(STORES.PHOTOS, { keyPath: 'id' });
          photoStore.createIndex('inspectionId', 'inspectionId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.MAINTENANCE_PLANS)) {
          const maintenanceStore = db.createObjectStore(STORES.MAINTENANCE_PLANS, { keyPath: 'id' });
          maintenanceStore.createIndex('equipment_id', 'equipment_id', { unique: false });
          maintenanceStore.createIndex('ship_id', 'ship_id', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.LAST_INSPECTIONS)) {
          const lastInspectionsStore = db.createObjectStore(STORES.LAST_INSPECTIONS, { keyPath: 'equipment_id' });
          lastInspectionsStore.createIndex('status', 'status', { unique: false });
        }
      };
    } catch (error) {
      console.error('Failed to open IndexedDB:', error);
      isOpening = false;
      openPromise = null;
      reject(error);
    }
  });

  return openPromise;
};

// Generic CRUD operations
const getStore = async (storeName: string, mode: IDBTransactionMode = 'readonly') => {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
};

export const getAllFromStore = async <T>(storeName: string): Promise<T[]> => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getFromStore = async <T>(storeName: string, key: string): Promise<T | undefined> => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getByIndex = async <T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> => {
  const store = await getStore(storeName);
  const index = store.index(indexName);
  return new Promise((resolve, reject) => {
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Paginated read using cursor (avoids loading all into memory)
export const getPaginatedFromStore = async <T>(
  storeName: string,
  offset: number,
  limit: number,
  indexName?: string,
  indexValue?: IDBValidKey
): Promise<PaginatedResult<T>> => {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readonly');
  const store = transaction.objectStore(storeName);

  // Get total count
  const totalPromise = new Promise<number>((resolve, reject) => {
    let countRequest: IDBRequest<number>;
    if (indexName && indexValue !== undefined) {
      const index = store.index(indexName);
      countRequest = index.count(indexValue);
    } else {
      countRequest = store.count();
    }
    countRequest.onsuccess = () => resolve(countRequest.result);
    countRequest.onerror = () => reject(countRequest.error);
  });

  // Get paginated items using cursor
  const itemsPromise = new Promise<T[]>((resolve, reject) => {
    const items: T[] = [];
    let skipped = 0;

    let source: IDBObjectStore | IDBIndex = store;
    if (indexName && indexValue !== undefined) {
      source = store.index(indexName);
    }

    const cursorRequest = indexName && indexValue !== undefined
      ? (source as IDBIndex).openCursor(IDBKeyRange.only(indexValue))
      : source.openCursor();

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) {
        resolve(items);
        return;
      }

      if (skipped < offset) {
        skipped++;
        cursor.continue();
        return;
      }

      if (items.length < limit) {
        items.push(cursor.value);
        cursor.continue();
      } else {
        resolve(items);
      }
    };

    cursorRequest.onerror = () => reject(cursorRequest.error);
  });

  const [total, items] = await Promise.all([totalPromise, itemsPromise]);

  return {
    items,
    hasMore: offset + items.length < total,
    total,
  };
};

export const putInStore = async <T>(storeName: string, item: T): Promise<void> => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Batch upsert (insert or update without clearing first)
export const upsertManyInStore = async <T>(storeName: string, items: T[]): Promise<void> => {
  if (items.length === 0) return;
  const db = await openDatabase();
  
  // Process in chunks of 500 to avoid blocking the main thread
  const CHUNK_SIZE = 500;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      chunk.forEach(item => store.put(item));
    });
  }
};

// Legacy putMany (still used for small datasets)
export const putManyInStore = async <T>(storeName: string, items: T[]): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    items.forEach(item => store.put(item));
  });
};

export const deleteFromStore = async (storeName: string, key: string): Promise<void> => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Delete multiple items by keys
export const deleteManyFromStore = async (storeName: string, keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    keys.forEach(key => store.delete(key));
  });
};

export const clearStore = async (storeName: string): Promise<void> => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearCachedData = async (): Promise<void> => {
  await Promise.all([
    clearStore(STORES.EQUIPMENT),
    clearStore(STORES.CATEGORIES),
    clearStore(STORES.SHIPS),
    clearStore(STORES.TEMPLATES),
    clearStore(STORES.MAINTENANCE_PLANS),
    clearStore(STORES.LAST_INSPECTIONS),
    clearStore(STORES.METADATA),
  ]);
};

export const countInStore = async (storeName: string): Promise<number> => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Get all IDs from a store (lightweight, no full records)
export const getAllIdsFromStore = async (storeName: string): Promise<string[]> => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result as string[]);
    request.onerror = () => reject(request.error);
  });
};

// ===== Equipment operations =====

// Full cache (used only on first sync)
export const cacheEquipment = async (equipment: CachedEquipment[]): Promise<void> => {
  await clearStore(STORES.EQUIPMENT);
  await upsertManyInStore(STORES.EQUIPMENT, equipment);
};

// Incremental upsert (delta sync - does NOT clear existing data)
export const upsertEquipment = async (equipment: CachedEquipment[]): Promise<void> => {
  await upsertManyInStore(STORES.EQUIPMENT, equipment);
};

// Remove deleted equipment (IDs that no longer exist on server)
export const removeDeletedEquipment = async (deletedIds: string[]): Promise<void> => {
  await deleteManyFromStore(STORES.EQUIPMENT, deletedIds);
};

export const getEquipment = async (): Promise<CachedEquipment[]> => {
  return getAllFromStore<CachedEquipment>(STORES.EQUIPMENT);
};

export const getEquipmentPaginated = async (
  offset: number,
  limit: number,
  shipId?: string
): Promise<PaginatedResult<CachedEquipment>> => {
  if (shipId) {
    return getPaginatedFromStore<CachedEquipment>(
      STORES.EQUIPMENT, offset, limit, 'ship_id', shipId
    );
  }
  return getPaginatedFromStore<CachedEquipment>(STORES.EQUIPMENT, offset, limit);
};

export const getEquipmentByShip = async (shipId: string): Promise<CachedEquipment[]> => {
  return getByIndex<CachedEquipment>(STORES.EQUIPMENT, 'ship_id', shipId);
};

export const getEquipmentCount = async (): Promise<number> => {
  return countInStore(STORES.EQUIPMENT);
};

export const getEquipmentIds = async (): Promise<string[]> => {
  return getAllIdsFromStore(STORES.EQUIPMENT);
};

// ===== Categories operations =====
export const cacheCategories = async (categories: CachedCategory[]): Promise<void> => {
  await clearStore(STORES.CATEGORIES);
  await putManyInStore(STORES.CATEGORIES, categories);
};

export const getCategories = async (): Promise<CachedCategory[]> => {
  return getAllFromStore<CachedCategory>(STORES.CATEGORIES);
};

// ===== Ships operations =====
export const cacheShips = async (ships: CachedShip[]): Promise<void> => {
  await clearStore(STORES.SHIPS);
  await putManyInStore(STORES.SHIPS, ships);
};

export const getShips = async (): Promise<CachedShip[]> => {
  return getAllFromStore<CachedShip>(STORES.SHIPS);
};

// ===== Templates operations =====
export const cacheTemplates = async (templates: CachedTemplate[]): Promise<void> => {
  await clearStore(STORES.TEMPLATES);
  await putManyInStore(STORES.TEMPLATES, templates);
};

export const getTemplates = async (): Promise<CachedTemplate[]> => {
  return getAllFromStore<CachedTemplate>(STORES.TEMPLATES);
};

export const getTemplateByCategory = async (categoryId: string): Promise<CachedTemplate | undefined> => {
  const templates = await getByIndex<CachedTemplate>(STORES.TEMPLATES, 'category_id', categoryId);
  return templates[0];
};

// ===== Maintenance Plans operations =====
export const cacheMaintenancePlans = async (plans: CachedMaintenancePlan[]): Promise<void> => {
  await clearStore(STORES.MAINTENANCE_PLANS);
  await putManyInStore(STORES.MAINTENANCE_PLANS, plans);
};

export const getMaintenancePlans = async (): Promise<CachedMaintenancePlan[]> => {
  return getAllFromStore<CachedMaintenancePlan>(STORES.MAINTENANCE_PLANS);
};

export const getMaintenancePlansCount = async (): Promise<number> => {
  return countInStore(STORES.MAINTENANCE_PLANS);
};

// ===== Last Inspections operations =====
export const cacheLastInspections = async (inspections: CachedLastInspection[]): Promise<void> => {
  await clearStore(STORES.LAST_INSPECTIONS);
  await putManyInStore(STORES.LAST_INSPECTIONS, inspections);
};

export const getLastInspections = async (): Promise<CachedLastInspection[]> => {
  return getAllFromStore<CachedLastInspection>(STORES.LAST_INSPECTIONS);
};

export const getLastInspectionByEquipment = async (equipmentId: string): Promise<CachedLastInspection | undefined> => {
  return getFromStore<CachedLastInspection>(STORES.LAST_INSPECTIONS, equipmentId);
};

export const getLastInspectionsCount = async (): Promise<number> => {
  return countInStore(STORES.LAST_INSPECTIONS);
};

// ===== Pending actions operations =====
export const addPendingAction = async (action: PendingAction): Promise<void> => {
  await putInStore(STORES.PENDING_ACTIONS, action);
};

export const getPendingActions = async (ownerUserId?: string): Promise<PendingAction[]> => {
  const actions = await getAllFromStore<PendingAction>(STORES.PENDING_ACTIONS);
  if (!ownerUserId) return actions;
  return actions.filter(action => action.ownerUserId === ownerUserId);
};

export const updatePendingAction = async (action: PendingAction): Promise<void> => {
  await putInStore(STORES.PENDING_ACTIONS, action);
};

export const removePendingAction = async (id: string): Promise<void> => {
  await deleteFromStore(STORES.PENDING_ACTIONS, id);
};

export const clearPendingActions = async (): Promise<void> => {
  await clearStore(STORES.PENDING_ACTIONS);
};

export const getPendingActionsCount = async (ownerUserId?: string): Promise<number> => {
  if (!ownerUserId) return countInStore(STORES.PENDING_ACTIONS);
  const actions = await getPendingActions(ownerUserId);
  return actions.length;
};

// ===== Photo operations =====
export const addPendingPhoto = async (photo: PendingPhoto): Promise<void> => {
  await putInStore(STORES.PHOTOS, photo);
};

export const getPhotosByInspection = async (inspectionId: string, ownerUserId?: string): Promise<PendingPhoto[]> => {
  const photos = await getByIndex<PendingPhoto>(STORES.PHOTOS, 'inspectionId', inspectionId);
  if (!ownerUserId) return photos;
  return photos.filter(photo => photo.ownerUserId === ownerUserId);
};

export const getPhoto = async (id: string): Promise<PendingPhoto | undefined> => {
  return getFromStore<PendingPhoto>(STORES.PHOTOS, id);
};

export const removePhoto = async (id: string): Promise<void> => {
  await deleteFromStore(STORES.PHOTOS, id);
};

export const removePhotosByInspection = async (inspectionId: string, ownerUserId?: string): Promise<void> => {
  const photos = await getPhotosByInspection(inspectionId, ownerUserId);
  for (const photo of photos) {
    await removePhoto(photo.id);
  }
};

export const getAllPendingPhotos = async (): Promise<PendingPhoto[]> => {
  return getAllFromStore<PendingPhoto>(STORES.PHOTOS);
};

export const getPhotosCount = async (): Promise<number> => {
  return countInStore(STORES.PHOTOS);
};

// ===== Metadata operations =====
export const setMetadata = async (key: string, value: unknown): Promise<void> => {
  await putInStore<StorageMetadata>(STORES.METADATA, { key, value });
};

export const getMetadata = async <T = unknown>(key: string): Promise<T | undefined> => {
  const result = await getFromStore<StorageMetadata>(STORES.METADATA, key);
  return result?.value as T | undefined;
};

export const removeMetadata = async (key: string): Promise<void> => {
  await deleteFromStore(STORES.METADATA, key);
};

export const setCacheOwner = async (userId: string): Promise<void> => {
  await setMetadata('cache_owner_user_id', userId);
};

export const getCacheOwner = async (): Promise<string | undefined> => {
  return getMetadata<string>('cache_owner_user_id');
};

// Cache timestamp management
export const setCacheTimestamp = async (): Promise<void> => {
  await setMetadata('cache_timestamp', Date.now());
};

export const getCacheTimestamp = async (): Promise<number | undefined> => {
  return getMetadata<number>('cache_timestamp');
};

// Last sync timestamp for delta sync
export const setLastSyncTimestamp = async (timestamp: string): Promise<void> => {
  await setMetadata('last_sync_timestamp', timestamp);
};

export const getLastSyncTimestamp = async (): Promise<string | undefined> => {
  return getMetadata<string>('last_sync_timestamp');
};

export const isCacheValid = async (maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<boolean> => {
  const timestamp = await getCacheTimestamp();
  if (!timestamp) return false;
  return Date.now() - timestamp < maxAgeMs;
};

export const clearSyncMetadata = async (): Promise<void> => {
  await Promise.all([
    removeMetadata('cache_timestamp'),
    removeMetadata('last_sync_timestamp'),
    removeMetadata('last_delete_check'),
    removeMetadata('cache_owner_user_id'),
  ]);
};

// ===== Storage statistics =====
export interface StorageStats {
  equipmentCount: number;
  categoriesCount: number;
  shipsCount: number;
  templatesCount: number;
  maintenancePlansCount: number;
  lastInspectionsCount: number;
  pendingActionsCount: number;
  photosCount: number;
  estimatedSizeMB: number;
  cacheTimestamp: number | undefined;
}

export const getStorageStats = async (): Promise<StorageStats> => {
  const [
    equipmentCount,
    categoriesCount,
    shipsCount,
    templatesCount,
    maintenancePlansCount,
    lastInspectionsCount,
    pendingActionsCount,
    photosCount,
    cacheTimestamp,
  ] = await Promise.all([
    countInStore(STORES.EQUIPMENT),
    countInStore(STORES.CATEGORIES),
    countInStore(STORES.SHIPS),
    countInStore(STORES.TEMPLATES),
    countInStore(STORES.MAINTENANCE_PLANS),
    countInStore(STORES.LAST_INSPECTIONS),
    countInStore(STORES.PENDING_ACTIONS),
    countInStore(STORES.PHOTOS),
    getCacheTimestamp(),
  ]);

  const estimatedSizeBytes =
    equipmentCount * 1024 +
    categoriesCount * 512 +
    shipsCount * 256 +
    templatesCount * 2048 +
    maintenancePlansCount * 1024 +
    lastInspectionsCount * 512 +
    pendingActionsCount * 10240 +
    photosCount * 512000;

  return {
    equipmentCount,
    categoriesCount,
    shipsCount,
    templatesCount,
    maintenancePlansCount,
    lastInspectionsCount,
    pendingActionsCount,
    photosCount,
    estimatedSizeMB: Math.round((estimatedSizeBytes / (1024 * 1024)) * 100) / 100,
    cacheTimestamp,
  };
};

export const getStorageStatsForUser = async (ownerUserId: string): Promise<StorageStats> => {
  const stats = await getStorageStats();
  const [pendingActionsCount, photos] = await Promise.all([
    getPendingActionsCount(ownerUserId),
    getAllPendingPhotos(),
  ]);

  const photosCount = photos.filter(photo => photo.ownerUserId === ownerUserId).length;

  return {
    ...stats,
    pendingActionsCount,
    photosCount,
    estimatedSizeMB: Math.round((
      stats.equipmentCount * 1024 +
      stats.categoriesCount * 512 +
      stats.shipsCount * 256 +
      stats.templatesCount * 2048 +
      stats.maintenancePlansCount * 1024 +
      stats.lastInspectionsCount * 512 +
      pendingActionsCount * 10240 +
      photosCount * 512000
    ) / (1024 * 1024) * 100) / 100,
  };
};

// ===== Photo utilities =====

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to compress image'));
        },
        file.type.includes('png') ? 'image/png' : 'image/jpeg',
        quality
      );
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

export const processAndStorePhoto = async (
  file: File,
  inspectionId: string,
  ownerUserId?: string
): Promise<PendingPhoto> => {
  const compressedBlob = await compressImage(file);
  const compressedFile = new File([compressedBlob], file.name, { type: compressedBlob.type });
  const base64Data = await fileToBase64(compressedFile);

  const photo: PendingPhoto = {
    id: crypto.randomUUID(),
    inspectionId,
    fileName: file.name,
    mimeType: compressedFile.type,
    base64Data,
    createdAt: Date.now(),
    ownerUserId,
  };

  await addPendingPhoto(photo);
  return photo;
};

export const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

// Export store names for external use
export { STORES };
