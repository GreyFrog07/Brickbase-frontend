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
  // Skip caching if all we have are temp properties (nothing real to cache)
  useEffect(() => {
    if (initialLoadDone.current && properties.length > 0 && user) {
      const hasRealProperties = properties.some(p => !p.id.startsWith('temp_'));
      if (hasRealProperties) {
        cacheProperties(user.id, properties.filter(p => !p.id.startsWith('temp_')));
      }
    }
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
        // Incremental sync: only fetch changes since lastSyncAt
        const response = await api.get('/properties/sync', {
          params: { since: lastSync },
        });
        const { properties: serverDelta, serverTime } = response.data;

        if (serverDelta && serverDelta.length > 0) {
          setProperties(prev => {
            const tempProperties = prev.filter(p => p.id.startsWith('temp_'));
            const realProperties = prev.filter(p => !p.id.startsWith('temp_'));
            const merged = mergeServerProperties(realProperties, serverDelta);
            return [...tempProperties, ...merged];
          });
        }

        await setLastSyncAt(user.id, serverTime);
      } else {
        // Initial sync: paginated fetch for new device / first login
        let allProperties: Property[] = [];
        let offset = 0;
        const limit = 50;
        let hasMore = true;

        while (hasMore) {
          const response = await api.get('/properties/sync', {
            params: { limit, offset },
          });
          const { properties: page, serverTime, hasMore: more } = response.data;

          allProperties = [...allProperties, ...(page || [])];
          hasMore = more;
          offset += limit;

          // Save serverTime from the first page (captured before any query)
          if (offset === limit) {
            await setLastSyncAt(user.id, serverTime);
          }
        }

        setProperties(prev => {
          const tempProperties = prev.filter(p => p.id.startsWith('temp_'));
          return [...tempProperties, ...allProperties];
        });

        await cacheProperties(user.id, allProperties);
      }

      initialLoadDone.current = true;
    } catch (error) {
      console.error('Error syncing properties:', error);
    } finally {
      if (showLoading) setLoading(false);
      syncInProgress.current = false;
    }
  };

  // Process pending queue — retry uploads that were interrupted
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
        continue;
      }

      try {
        await updatePendingStatus(user.id, item.id, 'syncing', item.retryCount + 1);
        const response = await api.post('/properties', item.data);
        await removeFromPendingQueue(user.id, item.id);

        // Replace temp property with real one from server
        if (item.data._tempId) {
          const realProperty: Property = response.data;
          setProperties(prev => prev.map(p => p.id === item.data._tempId ? realProperty : p));
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
