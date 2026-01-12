/**
 * IndexedDB-based offline storage for large datasets
 * Supports 2000+ equipment per ship and photo storage
 * localStorage limit is ~5-10MB, IndexedDB supports up to gigabytes
 */

const DB_NAME = 'safeship_offline';
const DB_VERSION = 2; // Incremented to add maintenance_plans store

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

export interface PendingPhoto {
  id: string;
  inspectionId: string; // Local pending inspection ID
  fileName: string;
  mimeType: string;
  base64Data: string;
  createdAt: number;
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
  timestamp: number;
  photos?: string[]; // Array of photo IDs stored separately
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
  data: PendingInspection | PendingMaintenance | any;
  timestamp: number;
  retryCount?: number;
}

interface StorageMetadata {
  key: string;
  value: any;
}

// Open/create database
let dbInstance: IDBDatabase | null = null;
let isOpening = false;
let openPromise: Promise<IDBDatabase> | null = null;

// Reset database instance (useful when upgrading)
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

// Delete and recreate database (for critical errors)
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
      // Still resolve as the delete will happen when tabs close
      resolve();
    };
  });
};

export const openDatabase = (): Promise<IDBDatabase> => {
  // Return existing instance
  if (dbInstance && dbInstance.objectStoreNames.length > 0) {
    return Promise.resolve(dbInstance);
  }

  // Return existing promise if already opening
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
        
        // Handle connection closed unexpectedly
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

      // Equipment store with indexes for fast lookup
      if (!db.objectStoreNames.contains(STORES.EQUIPMENT)) {
        const equipmentStore = db.createObjectStore(STORES.EQUIPMENT, { keyPath: 'id' });
        equipmentStore.createIndex('ship_id', 'ship_id', { unique: false });
        equipmentStore.createIndex('category_id', 'category_id', { unique: false });
        equipmentStore.createIndex('internal_code', 'internal_code', { unique: false });
        equipmentStore.createIndex('name', 'name', { unique: false });
      }

      // Categories store
      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
      }

      // Ships store
      if (!db.objectStoreNames.contains(STORES.SHIPS)) {
        db.createObjectStore(STORES.SHIPS, { keyPath: 'id' });
      }

      // Templates store
      if (!db.objectStoreNames.contains(STORES.TEMPLATES)) {
        const templateStore = db.createObjectStore(STORES.TEMPLATES, { keyPath: 'id' });
        templateStore.createIndex('category_id', 'category_id', { unique: false });
      }

      // Pending actions store
      if (!db.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
        const pendingStore = db.createObjectStore(STORES.PENDING_ACTIONS, { keyPath: 'id' });
        pendingStore.createIndex('type', 'type', { unique: false });
        pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Photos store (for offline photo capture)
      if (!db.objectStoreNames.contains(STORES.PHOTOS)) {
        const photoStore = db.createObjectStore(STORES.PHOTOS, { keyPath: 'id' });
        photoStore.createIndex('inspectionId', 'inspectionId', { unique: false });
      }

      // Metadata store (for cache timestamps, etc.)
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
      }

      // Maintenance plans store (added in version 2)
      if (!db.objectStoreNames.contains(STORES.MAINTENANCE_PLANS)) {
        const maintenanceStore = db.createObjectStore(STORES.MAINTENANCE_PLANS, { keyPath: 'id' });
        maintenanceStore.createIndex('equipment_id', 'equipment_id', { unique: false });
        maintenanceStore.createIndex('ship_id', 'ship_id', { unique: false });
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

// Get all items from a store
export const getAllFromStore = async <T>(storeName: string): Promise<T[]> => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Get item by key
export const getFromStore = async <T>(storeName: string, key: string): Promise<T | undefined> => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Get items by index
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

// Put item (insert or update)
export const putInStore = async <T>(storeName: string, item: T): Promise<void> => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Put multiple items (batch insert/update)
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

// Delete item
export const deleteFromStore = async (storeName: string, key: string): Promise<void> => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Clear store
export const clearStore = async (storeName: string): Promise<void> => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Count items in store
export const countInStore = async (storeName: string): Promise<number> => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// ===== Equipment operations =====
export const cacheEquipment = async (equipment: CachedEquipment[]): Promise<void> => {
  await clearStore(STORES.EQUIPMENT);
  await putManyInStore(STORES.EQUIPMENT, equipment);
};

export const getEquipment = async (): Promise<CachedEquipment[]> => {
  return getAllFromStore<CachedEquipment>(STORES.EQUIPMENT);
};

export const getEquipmentByShip = async (shipId: string): Promise<CachedEquipment[]> => {
  return getByIndex<CachedEquipment>(STORES.EQUIPMENT, 'ship_id', shipId);
};

export const getEquipmentCount = async (): Promise<number> => {
  return countInStore(STORES.EQUIPMENT);
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

// ===== Pending actions operations =====
export const addPendingAction = async (action: PendingAction): Promise<void> => {
  await putInStore(STORES.PENDING_ACTIONS, action);
};

export const getPendingActions = async (): Promise<PendingAction[]> => {
  return getAllFromStore<PendingAction>(STORES.PENDING_ACTIONS);
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

export const getPendingActionsCount = async (): Promise<number> => {
  return countInStore(STORES.PENDING_ACTIONS);
};

// ===== Photo operations =====
export const addPendingPhoto = async (photo: PendingPhoto): Promise<void> => {
  await putInStore(STORES.PHOTOS, photo);
};

export const getPhotosByInspection = async (inspectionId: string): Promise<PendingPhoto[]> => {
  return getByIndex<PendingPhoto>(STORES.PHOTOS, 'inspectionId', inspectionId);
};

export const getPhoto = async (id: string): Promise<PendingPhoto | undefined> => {
  return getFromStore<PendingPhoto>(STORES.PHOTOS, id);
};

export const removePhoto = async (id: string): Promise<void> => {
  await deleteFromStore(STORES.PHOTOS, id);
};

export const removePhotosByInspection = async (inspectionId: string): Promise<void> => {
  const photos = await getPhotosByInspection(inspectionId);
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
export const setMetadata = async (key: string, value: any): Promise<void> => {
  await putInStore<StorageMetadata>(STORES.METADATA, { key, value });
};

export const getMetadata = async <T = any>(key: string): Promise<T | undefined> => {
  const result = await getFromStore<StorageMetadata>(STORES.METADATA, key);
  return result?.value;
};

// Cache timestamp management
export const setCacheTimestamp = async (): Promise<void> => {
  await setMetadata('cache_timestamp', Date.now());
};

export const getCacheTimestamp = async (): Promise<number | undefined> => {
  return getMetadata<number>('cache_timestamp');
};

export const isCacheValid = async (maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<boolean> => {
  const timestamp = await getCacheTimestamp();
  if (!timestamp) return false;
  return Date.now() - timestamp < maxAgeMs;
};

// ===== Storage statistics =====
export interface StorageStats {
  equipmentCount: number;
  categoriesCount: number;
  shipsCount: number;
  templatesCount: number;
  maintenancePlansCount: number;
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
    pendingActionsCount,
    photosCount,
    cacheTimestamp,
  ] = await Promise.all([
    countInStore(STORES.EQUIPMENT),
    countInStore(STORES.CATEGORIES),
    countInStore(STORES.SHIPS),
    countInStore(STORES.TEMPLATES),
    countInStore(STORES.MAINTENANCE_PLANS),
    countInStore(STORES.PENDING_ACTIONS),
    countInStore(STORES.PHOTOS),
    getCacheTimestamp(),
  ]);

  // Estimate size: ~1KB per equipment, ~10KB per pending action, ~500KB per photo average
  const estimatedSizeBytes =
    equipmentCount * 1024 +
    categoriesCount * 512 +
    shipsCount * 256 +
    templatesCount * 2048 +
    maintenancePlansCount * 1024 +
    pendingActionsCount * 10240 +
    photosCount * 512000;

  return {
    equipmentCount,
    categoriesCount,
    shipsCount,
    templatesCount,
    maintenancePlansCount,
    pendingActionsCount,
    photosCount,
    estimatedSizeMB: Math.round((estimatedSizeBytes / (1024 * 1024)) * 100) / 100,
    cacheTimestamp,
  };
};

// ===== Photo utilities =====

// Convert File to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to save space
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Compress image before storing
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

// Process and store photo for offline
export const processAndStorePhoto = async (
  file: File,
  inspectionId: string
): Promise<PendingPhoto> => {
  // Compress the image first
  const compressedBlob = await compressImage(file);
  const compressedFile = new File([compressedBlob], file.name, { type: compressedBlob.type });
  
  // Convert to base64
  const base64Data = await fileToBase64(compressedFile);

  const photo: PendingPhoto = {
    id: crypto.randomUUID(),
    inspectionId,
    fileName: file.name,
    mimeType: compressedFile.type,
    base64Data,
    createdAt: Date.now(),
  };

  await addPendingPhoto(photo);
  return photo;
};

// Convert base64 back to Blob for upload
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
