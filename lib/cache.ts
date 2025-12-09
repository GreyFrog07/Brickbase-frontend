import AsyncStorage from '@react-native-async-storage/async-storage';
import { Property } from '../types/property';

const CACHE_KEYS = {
  PROPERTIES: 'cached_properties',
  PROPERTIES_TIMESTAMP: 'cached_properties_timestamp',
  PENDING_PROPERTIES: 'pending_properties',
  PROPERTY_IMAGES: 'cached_property_images_',
};

// Flag to track if new property was added (triggers refresh)
let newPropertyAdded = false;

export const setNewPropertyAdded = (value: boolean) => {
  newPropertyAdded = value;
};

export const shouldRefreshCache = () => {
  return newPropertyAdded;
};

export const resetRefreshFlag = () => {
  newPropertyAdded = false;
};

// Cache properties
export const cacheProperties = async (properties: Property[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.PROPERTIES, JSON.stringify(properties));
    await AsyncStorage.setItem(CACHE_KEYS.PROPERTIES_TIMESTAMP, Date.now().toString());
  } catch (error) {
    console.error('Error caching properties:', error);
  }
};

// Get cached properties
export const getCachedProperties = async (): Promise<Property[] | null> => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.PROPERTIES);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('Error getting cached properties:', error);
    return null;
  }
};

// Check if cache is valid (not stale and no new property added)
export const isCacheValid = async (): Promise<boolean> => {
  try {
    if (newPropertyAdded) {
      return false; // Force refresh if new property was added
    }
    
    const timestamp = await AsyncStorage.getItem(CACHE_KEYS.PROPERTIES_TIMESTAMP);
    if (!timestamp) return false;
    
    // Cache is valid indefinitely unless new property is added
    return true;
  } catch (error) {
    return false;
  }
};

// Pending properties queue for background sync
export interface PendingProperty {
  id: string;
  data: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
}

// Add property to pending queue
export const addToPendingQueue = async (property: any): Promise<string> => {
  try {
    const pendingId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pending: PendingProperty = {
      id: pendingId,
      data: property,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
    };
    
    const existingQueue = await getPendingQueue();
    existingQueue.push(pending);
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_PROPERTIES, JSON.stringify(existingQueue));
    
    return pendingId;
  } catch (error) {
    console.error('Error adding to pending queue:', error);
    throw error;
  }
};

// Get pending queue
export const getPendingQueue = async (): Promise<PendingProperty[]> => {
  try {
    const queue = await AsyncStorage.getItem(CACHE_KEYS.PENDING_PROPERTIES);
    if (queue) {
      return JSON.parse(queue);
    }
    return [];
  } catch (error) {
    console.error('Error getting pending queue:', error);
    return [];
  }
};

// Update pending item status
export const updatePendingStatus = async (
  pendingId: string, 
  status: 'pending' | 'syncing' | 'failed',
  retryCount?: number
): Promise<void> => {
  try {
    const queue = await getPendingQueue();
    const index = queue.findIndex(p => p.id === pendingId);
    if (index !== -1) {
      queue[index].status = status;
      if (retryCount !== undefined) {
        queue[index].retryCount = retryCount;
      }
      await AsyncStorage.setItem(CACHE_KEYS.PENDING_PROPERTIES, JSON.stringify(queue));
    }
  } catch (error) {
    console.error('Error updating pending status:', error);
  }
};

// Remove from pending queue (after successful sync)
export const removeFromPendingQueue = async (pendingId: string): Promise<void> => {
  try {
    const queue = await getPendingQueue();
    const filtered = queue.filter(p => p.id !== pendingId);
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_PROPERTIES, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from pending queue:', error);
  }
};

// Add optimistic property to cache
export const addOptimisticProperty = async (property: Property): Promise<void> => {
  try {
    const cached = await getCachedProperties();
    if (cached) {
      // Add to beginning of list
      cached.unshift(property);
      await cacheProperties(cached);
    }
  } catch (error) {
    console.error('Error adding optimistic property:', error);
  }
};

// Update optimistic property with real ID
export const updateOptimisticProperty = async (
  tempId: string, 
  realProperty: Property
): Promise<void> => {
  try {
    const cached = await getCachedProperties();
    if (cached) {
      const index = cached.findIndex(p => p.id === tempId);
      if (index !== -1) {
        cached[index] = realProperty;
        await cacheProperties(cached);
      }
    }
  } catch (error) {
    console.error('Error updating optimistic property:', error);
  }
};

// Remove failed optimistic property
export const removeOptimisticProperty = async (tempId: string): Promise<void> => {
  try {
    const cached = await getCachedProperties();
    if (cached) {
      const filtered = cached.filter(p => p.id !== tempId);
      await cacheProperties(filtered);
    }
  } catch (error) {
    console.error('Error removing optimistic property:', error);
  }
};

// Cache property image
export const cachePropertyImage = async (
  propertyId: string, 
  imageIndex: number, 
  base64Data: string
): Promise<void> => {
  try {
    const key = `${CACHE_KEYS.PROPERTY_IMAGES}${propertyId}_${imageIndex}`;
    await AsyncStorage.setItem(key, base64Data);
  } catch (error) {
    console.error('Error caching property image:', error);
  }
};

// Get cached property image
export const getCachedPropertyImage = async (
  propertyId: string, 
  imageIndex: number
): Promise<string | null> => {
  try {
    const key = `${CACHE_KEYS.PROPERTY_IMAGES}${propertyId}_${imageIndex}`;
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.error('Error getting cached property image:', error);
    return null;
  }
};

// Clear all cache
export const clearAllCache = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => 
      key.startsWith('cached_') || 
      key.startsWith('pending_') ||
      key === 'add_property_draft'
    );
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

// Get storage info (approximate)
export const getStorageInfo = async (): Promise<{ used: number; keys: number }> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    let totalSize = 0;
    
    for (const key of keys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        totalSize += value.length * 2; // Approximate bytes (UTF-16)
      }
    }
    
    return { used: totalSize, keys: keys.length };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return { used: 0, keys: 0 };
  }
};
