import AsyncStorage from '@react-native-async-storage/async-storage';
import { Property } from '../types/property';

// All cache keys are per-user to support multi-account on same device
const CACHE_KEYS = {
  PROPERTIES: (userId: string) => `properties_${userId}`,
  PROPERTIES_TIMESTAMP: (userId: string) => `properties_ts_${userId}`,
  PENDING_PROPERTIES: (userId: string) => `pending_${userId}`,
  PENDING_UPDATES: (userId: string) => `pending_updates_${userId}`,
  LAST_SYNC_AT: (userId: string) => `last_sync_at_${userId}`,
};

export const MAX_RETRIES = 5;

// ── Sync checkpoint ────────────────────────────────────────────────────

export const getLastSyncAt = async (userId: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC_AT(userId));
  } catch (error) {
    console.error('Error getting lastSyncAt:', error);
    return null;
  }
};

export const setLastSyncAt = async (userId: string, serverTime: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC_AT(userId), serverTime);
  } catch (error) {
    console.error('Error setting lastSyncAt:', error);
  }
};

// ── Atomic sync checkpoint (cache + lastSyncAt in one write) ──────────

export const persistSyncCheckpoint = async (
  userId: string,
  properties: Property[],
  serverTime: string,
): Promise<void> => {
  try {
    const confirmed = properties.filter(p => !p.id.startsWith('temp_'));
    await AsyncStorage.multiSet([
      [CACHE_KEYS.PROPERTIES(userId), JSON.stringify(confirmed)],
      [CACHE_KEYS.PROPERTIES_TIMESTAMP(userId), Date.now().toString()],
      [CACHE_KEYS.LAST_SYNC_AT(userId), serverTime],
    ]);
  } catch (error) {
    console.error('Error persisting sync checkpoint:', error);
  }
};

// ── Property cache (per-user) ──────────────────────────────────────────

export const cacheProperties = async (userId: string, properties: Property[]): Promise<void> => {
  try {
    // Never persist temp_ items — they belong only to the pending queue
    const confirmed = properties.filter(p => !p.id.startsWith('temp_'));
    await AsyncStorage.setItem(CACHE_KEYS.PROPERTIES(userId), JSON.stringify(confirmed));
    await AsyncStorage.setItem(CACHE_KEYS.PROPERTIES_TIMESTAMP(userId), Date.now().toString());
  } catch (error) {
    console.error('Error caching properties:', error);
  }
};

export const getCachedProperties = async (userId: string): Promise<Property[] | null> => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.PROPERTIES(userId));
    if (cached) {
      const parsed: Property[] = JSON.parse(cached);
      // Filter out any stale temp_ items that may have been cached before this fix
      return parsed.filter(p => !p.id.startsWith('temp_'));
    }
    return null;
  } catch (error) {
    console.error('Error getting cached properties:', error);
    return null;
  }
};

// ── Merge server delta into local state (server-wins with timestamp guard) ──

export const mergeServerProperties = (
  localProperties: Property[],
  serverDelta: Property[],
): Property[] => {
  if (serverDelta.length === 0) return localProperties;

  // Build a map of server properties by ID for O(1) lookup
  const serverMap = new Map<string, Property>();
  for (const prop of serverDelta) {
    serverMap.set(prop.id, prop);
  }

  // Update existing properties in-place
  const updatedIds = new Set<string>();
  const merged = localProperties.map(local => {
    const serverVersion = serverMap.get(local.id);
    if (serverVersion) {
      updatedIds.add(local.id);
      // Merge guard: keep local if it's newer than what the server returned
      // (guards against stale delta when updated_at trigger was missing)
      const serverTs = serverVersion.updatedAt ? new Date(serverVersion.updatedAt).getTime() : 0;
      const localTs = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      return serverTs >= localTs ? serverVersion : local;
    }
    return local;
  });

  // Add new properties (from server) that didn't exist locally
  for (const [id, prop] of serverMap) {
    if (!updatedIds.has(id)) {
      merged.unshift(prop); // New properties go to the top
    }
  }

  return merged;
};

// ── Pending properties queue (failed creates — per-user) ───────────────

export interface PendingProperty {
  id: string;
  data: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
}

export const addToPendingQueue = async (userId: string, property: any): Promise<string> => {
  try {
    const pendingId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pending: PendingProperty = {
      id: pendingId,
      data: property,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    const existingQueue = await getPendingQueue(userId);
    existingQueue.push(pending);
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_PROPERTIES(userId), JSON.stringify(existingQueue));

    return pendingId;
  } catch (error) {
    console.error('Error adding to pending queue:', error);
    throw error;
  }
};

export const getPendingQueue = async (userId: string): Promise<PendingProperty[]> => {
  try {
    const queue = await AsyncStorage.getItem(CACHE_KEYS.PENDING_PROPERTIES(userId));
    if (queue) {
      return JSON.parse(queue);
    }
    return [];
  } catch (error) {
    console.error('Error getting pending queue:', error);
    return [];
  }
};

export const updatePendingStatus = async (
  userId: string,
  pendingId: string,
  status: 'pending' | 'syncing' | 'failed',
  retryCount?: number
): Promise<void> => {
  try {
    const queue = await getPendingQueue(userId);
    const index = queue.findIndex(p => p.id === pendingId);
    if (index !== -1) {
      queue[index].status = status;
      if (retryCount !== undefined) {
        queue[index].retryCount = retryCount;
      }
      await AsyncStorage.setItem(CACHE_KEYS.PENDING_PROPERTIES(userId), JSON.stringify(queue));
    }
  } catch (error) {
    console.error('Error updating pending status:', error);
  }
};

export const updatePendingData = async (
  userId: string,
  pendingId: string,
  data: any,
): Promise<void> => {
  try {
    const queue = await getPendingQueue(userId);
    const index = queue.findIndex(p => p.id === pendingId);
    if (index !== -1) {
      queue[index].data = data;
      await AsyncStorage.setItem(CACHE_KEYS.PENDING_PROPERTIES(userId), JSON.stringify(queue));
    }
  } catch (error) {
    console.error('Error updating pending data:', error);
  }
};

export const removeFromPendingQueue = async (userId: string, pendingId: string): Promise<void> => {
  try {
    const queue = await getPendingQueue(userId);
    const filtered = queue.filter(p => p.id !== pendingId);
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_PROPERTIES(userId), JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from pending queue:', error);
  }
};

// ── Pending updates queue (failed PUTs — per-user) ─────────────────────

export interface PendingUpdate {
  id: string;           // pending_update_<timestamp>_<random>
  propertyId: string;   // real DB id (never temp_)
  data: any;            // full PUT payload (storage paths already uploaded)
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
}

export const addToPendingUpdates = async (userId: string, update: { propertyId: string; data: any }): Promise<string> => {
  try {
    const updateId = `pending_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pending: PendingUpdate = {
      id: updateId,
      propertyId: update.propertyId,
      data: update.data,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    const existingQueue = await getPendingUpdates(userId);
    // De-duplicate: if there's already a pending update for this property, replace it with the newer one
    const filtered = existingQueue.filter(u => u.propertyId !== update.propertyId);
    filtered.push(pending);
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_UPDATES(userId), JSON.stringify(filtered));

    return updateId;
  } catch (error) {
    console.error('Error adding to pending updates:', error);
    throw error;
  }
};

export const getPendingUpdates = async (userId: string): Promise<PendingUpdate[]> => {
  try {
    const queue = await AsyncStorage.getItem(CACHE_KEYS.PENDING_UPDATES(userId));
    if (queue) {
      return JSON.parse(queue);
    }
    return [];
  } catch (error) {
    console.error('Error getting pending updates:', error);
    return [];
  }
};

export const updatePendingUpdateStatus = async (
  userId: string,
  updateId: string,
  status: 'pending' | 'syncing' | 'failed',
  retryCount?: number
): Promise<void> => {
  try {
    const queue = await getPendingUpdates(userId);
    const index = queue.findIndex(u => u.id === updateId);
    if (index !== -1) {
      queue[index].status = status;
      if (retryCount !== undefined) {
        queue[index].retryCount = retryCount;
      }
      await AsyncStorage.setItem(CACHE_KEYS.PENDING_UPDATES(userId), JSON.stringify(queue));
    }
  } catch (error) {
    console.error('Error updating pending update status:', error);
  }
};

export const removeFromPendingUpdates = async (userId: string, updateId: string): Promise<void> => {
  try {
    const queue = await getPendingUpdates(userId);
    const filtered = queue.filter(u => u.id !== updateId);
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_UPDATES(userId), JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from pending updates:', error);
  }
};

// ── Optimistic property helpers ────────────────────────────────────────
// Note: addOptimisticProperty intentionally does NOT write temp_ items to cache.
// Temp properties live only in memory + pending queue during the current session.

export const updateOptimisticProperty = async (
  userId: string,
  tempId: string,
  realProperty: Property
): Promise<void> => {
  try {
    const cached = await getCachedProperties(userId);
    if (cached) {
      const index = cached.findIndex(p => p.id === tempId);
      if (index !== -1) {
        cached[index] = realProperty;
        await cacheProperties(userId, cached);
      }
    }
  } catch (error) {
    console.error('Error updating optimistic property:', error);
  }
};

export const removeOptimisticProperty = async (userId: string, tempId: string): Promise<void> => {
  try {
    const cached = await getCachedProperties(userId);
    if (cached) {
      const filtered = cached.filter(p => p.id !== tempId);
      await cacheProperties(userId, filtered);
    }
  } catch (error) {
    console.error('Error removing optimistic property:', error);
  }
};

// ── Clear cache ────────────────────────────────────────────────────────

export const clearUserCache = async (userId: string): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      CACHE_KEYS.PROPERTIES(userId),
      CACHE_KEYS.PROPERTIES_TIMESTAMP(userId),
      CACHE_KEYS.PENDING_PROPERTIES(userId),
      CACHE_KEYS.PENDING_UPDATES(userId),
      CACHE_KEYS.LAST_SYNC_AT(userId),
    ]);
  } catch (error) {
    console.error('Error clearing user cache:', error);
  }
};

export const clearAllCache = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key =>
      key.startsWith('properties_') ||
      key.startsWith('properties_ts_') ||
      key.startsWith('pending_') ||
      key.startsWith('pending_updates_') ||
      key.startsWith('last_sync_at_') ||
      key === 'add_property_draft'
    );
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};
