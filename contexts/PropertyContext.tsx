import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { Property } from '../types/property';
import {
  getCachedProperties,
  cacheProperties,
  getPendingQueue,
  removeFromPendingQueue,
  updatePendingStatus,
  getLastSyncAt,
  setLastSyncAt,
  mergeServerProperties,
  MAX_RETRIES,
} from '../lib/cache';
import api from '../lib/api';
import { useAuth } from './AuthContext';

interface PropertyContextType {
  properties: Property[];
  loading: boolean;
  refreshing: boolean;
  syncing: boolean; // true while initial paginated sync is fetching more pages

  // State mutations — update local state + persist to cache automatically
  addPropertyToState: (property: Property) => void;
  updatePropertyInState: (id: string, updatedProperty: Property) => void;
  removePropertyFromState: (id: string) => void;
  replacePropertyInState: (tempId: string, realProperty: Property) => void;

  // Server sync
  refreshProperties: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

const PropertyContext = createContext<PropertyContextType>({
  properties: [],
  loading: true,
  refreshing: false,
  syncing: false,
  addPropertyToState: () => {},
  updatePropertyInState: () => {},
  removePropertyFromState: () => {},
  replacePropertyInState: () => {},
  refreshProperties: async () => {},
  onRefresh: async () => {},
});

export const useProperties = () => useContext(PropertyContext);

export const PropertyProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const initialLoadDone = useRef(false);
  const syncInProgress = useRef(false);

  // Load properties when user logs in, clear when they log out
  useEffect(() => {
    if (user) {
      loadInitial();
    } else {
      setProperties([]);
      setLoading(false);
      initialLoadDone.current = false;
    }
  }, [user]);

  // Persist to cache whenever properties change (after initial load)
  // Debounced to avoid serializing the entire array on every state update
  // Includes temp properties so they survive reloads while upload is in progress
  const cacheTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (initialLoadDone.current && properties.length > 0 && user) {
      if (cacheTimeoutRef.current) clearTimeout(cacheTimeoutRef.current);
      cacheTimeoutRef.current = setTimeout(() => {
        cacheProperties(user.id, properties);
      }, 1000);
    }
    return () => {
      if (cacheTimeoutRef.current) clearTimeout(cacheTimeoutRef.current);
    };
  }, [properties, user]);

  const loadInitial = async () => {
    if (!user) return;
    setLoading(true);

    // 1. Load from cache first for instant display
    const cached = await getCachedProperties(user.id);
    if (cached && cached.length > 0) {
      setProperties(cached);
      setLoading(false);
      initialLoadDone.current = true;

      // Background sync for changes since last sync
      syncFromServer(false);
    } else {
      // No cache — full initial sync (show loading)
      await syncFromServer(true);
    }

    // 2. Process any pending uploads from previous session
    await processPendingQueue();
  };

  // ── Sync engine ──────────────────────────────────────────────────────

  const syncFromServer = async (showLoading: boolean) => {
    if (!user || syncInProgress.current) return;
    syncInProgress.current = true;

    try {
      if (showLoading) setLoading(true);

      const lastSync = await getLastSyncAt(user.id);

      if (lastSync) {
        // Incremental sync: fetch changes + all current IDs for deletion detection
        const response = await api.get('/properties/sync', {
          params: { since: lastSync },
        });
        const { properties: serverDelta, serverTime, allIds } = response.data;

        setProperties(prev => {
          const tempProperties = prev.filter(p => p.id.startsWith('temp_'));
          let realProperties = prev.filter(p => !p.id.startsWith('temp_'));

          // 1. Merge changed/new properties
          if (serverDelta && serverDelta.length > 0) {
            realProperties = mergeServerProperties(realProperties, serverDelta);
          }

          // 2. Remove properties deleted on server (ID reconciliation)
          if (allIds) {
            const serverIdSet = new Set<string>(allIds);
            realProperties = realProperties.filter(p => serverIdSet.has(p.id));
          }

          return [...tempProperties, ...realProperties];
        });

        await setLastSyncAt(user.id, serverTime);
      } else {
        // Initial sync: paginated fetch for new device / first login
        // Render each page as it arrives so the user sees properties immediately
        let offset = 0;
        const limit = 50;
        let hasMore = true;
        setSyncing(true);

        while (hasMore) {
          const response = await api.get('/properties/sync', {
            params: { limit, offset },
          });
          const { properties: page, serverTime, hasMore: more } = response.data;
          const pageData = page || [];

          // Append this page to state immediately — user sees results as they arrive
          if (pageData.length > 0) {
            setProperties(prev => {
              const tempProperties = prev.filter(p => p.id.startsWith('temp_'));
              const realProperties = prev.filter(p => !p.id.startsWith('temp_'));
              return [...tempProperties, ...realProperties, ...pageData];
            });
          }

          hasMore = more;
          offset += limit;

          // Save serverTime from the first page (captured before any query)
          if (offset === limit) {
            await setLastSyncAt(user.id, serverTime);
          }
        }

        // Cache the final complete set (excluding temp properties)
        setProperties(prev => {
          const realProperties = prev.filter(p => !p.id.startsWith('temp_'));
          cacheProperties(user.id, realProperties);
          return prev;
        });

        setSyncing(false);
      }

      initialLoadDone.current = true;
    } catch (error) {
      console.error('Error syncing properties:', error);
    } finally {
      if (showLoading) setLoading(false);
      syncInProgress.current = false;
    }
  };

  // Process pending queue — retry property creation that was interrupted
  const processPendingQueue = async () => {
    if (!user) return;
    const queue = await getPendingQueue(user.id);
    if (queue.length === 0) return;

    for (const item of queue) {
      if (item.retryCount >= MAX_RETRIES) {
        await removeFromPendingQueue(user.id, item.id);
        Alert.alert(
          'Upload Failed',
          'A property could not be synced after multiple attempts. Please add it again.',
          [{ text: 'OK' }]
        );
        // Remove the orphaned temp property from state
        if (item.data._tempId) {
          setProperties(prev => prev.filter(p => p.id !== item.data._tempId));
        }
        continue;
      }

      try {
        await updatePendingStatus(user.id, item.id, 'syncing', item.retryCount + 1);

        // Send the data as-is — it already includes storage paths if uploads succeeded
        const response = await api.post('/properties', item.data);
        await removeFromPendingQueue(user.id, item.id);

        // Replace temp property with real one from server
        if (item.data._tempId) {
          const realProperty: Property = response.data;
          // Only replace if server version has images, or temp had none
          const tempProp = properties.find(p => p.id === item.data._tempId);
          const tempHasPhotos = tempProp?.propertyPhotos && tempProp.propertyPhotos.length > 0;
          const serverHasPhotos = realProperty.propertyPhotos && realProperty.propertyPhotos.length > 0;

          if (!tempHasPhotos || serverHasPhotos) {
            setProperties(prev => prev.map(p => p.id === item.data._tempId ? realProperty : p));
          } else {
            // Server version has no images but temp does — merge: use server ID + temp images
            setProperties(prev => prev.map(p =>
              p.id === item.data._tempId
                ? { ...realProperty, propertyPhotos: p.propertyPhotos, propertyVideos: p.propertyVideos }
                : p
            ));
          }
        }

        console.log(`Pending property ${item.id} synced successfully`);
      } catch (error) {
        console.error(`Failed to sync pending property ${item.id}:`, error);
        await updatePendingStatus(user.id, item.id, 'failed', item.retryCount + 1);
      }
    }
  };

  // --- State mutation methods ---

  const addPropertyToState = useCallback((property: Property) => {
    setProperties(prev => [property, ...prev]);
  }, []);

  const updatePropertyInState = useCallback((id: string, updatedProperty: Property) => {
    setProperties(prev => prev.map(p => p.id === id ? updatedProperty : p));
  }, []);

  const removePropertyFromState = useCallback((id: string) => {
    setProperties(prev => prev.filter(p => p.id !== id));
  }, []);

  const replacePropertyInState = useCallback((tempId: string, realProperty: Property) => {
    setProperties(prev => prev.map(p => p.id === tempId ? realProperty : p));
  }, []);

  // --- Server sync methods ---

  const refreshProperties = useCallback(async () => {
    await syncFromServer(false);
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await processPendingQueue();
      await syncFromServer(false);
    } catch (error) {
      console.error('Error refreshing properties:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  return (
    <PropertyContext.Provider value={{
      properties,
      loading,
      refreshing,
      syncing,
      addPropertyToState,
      updatePropertyInState,
      removePropertyFromState,
      replacePropertyInState,
      refreshProperties,
      onRefresh,
    }}>
      {children}
    </PropertyContext.Provider>
  );
};
