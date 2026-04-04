import AsyncStorage from '@react-native-async-storage/async-storage';
import { Property } from '../types/property';

// All cache keys are per-user to support multi-account on same device
const CACHE_KEYS = {
  PROPERTIES: (userId: string) => `properties_${userId}`,
  PROPERTIES_TIMESTAMP: (userId: string) => `properties_ts_${userId}`,
  PENDING_PROPERTIES: (userId: string) => `pending_${userId}`,
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

// ── Property cache (per-user) ──────────────────────────────────────────

export const cacheProperties = async (userId: string, properties: Property[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.PROPERTIES(userId), JSON.stringify(properties));
    await AsyncStorage.setItem(CACHE_KEYS.PROPERTIES_TIMESTAMP(userId), Date.now().toString());
  } catch (error) {
    console.error('Error caching properties:', error);
  }
};

export const getCachedProperties = async (userId: string): Promise<Property[] | null> => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.PROPERTIES(userId));
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('Error getting cached properties:', error);
    return null;
  }
};

// ── Merge server delta into local state (server-wins) ──────────────────

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

  // Update existing properties in-place (server wins)
  const updatedIds = new Set<string>();
  const merged = localProperties.map(local => {
    const serverVersion = serverMap.get(local.id);
    if (serverVersion) {
      updatedIds.add(local.id);
      return serverVersion;
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

// ── Pending properties queue (per-user) ────────────────────────────────

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

export const removeFromPendingQueue = async (userId: string, pendingId: string): Promise<void> => {
  try {
    const queue = await getPendingQueue(userId);
    const filtered = queue.filter(p => p.id !== pendingId);
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_PROPERTIES(userId), JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from pending queue:', error);
  }
};

// ── Optimistic property helpers ────────────────────────────────────────

export const addOptimisticProperty = async (userId: string, property: Property): Promise<void> => {
  try {
    const cached = await getCachedProperties(userId);
    if (cached) {
      cached.unshift(property);
      await cacheProperties(userId, cached);
    }
  } catch (error) {
    console.error('Error adding optimistic property:', error);
  }
};

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
      key.startsWith('last_sync_at_') ||
      key === 'add_property_draft'
    );
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};
