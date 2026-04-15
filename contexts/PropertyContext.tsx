import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { Property } from '../types/property';
import {
  getCachedProperties,
  cacheProperties,
  getPendingQueue,
  removeFromPendingQueue,
  updatePendingStatus,
  getPendingUpdates,
  removeFromPendingUpdates,
  updatePendingUpdateStatus,
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
  // Flag set by updatePropertyInState to trigger an immediate cache flush
  const immediateFlushRef = useRef(false);

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

  // Persist to cache whenever properties change (after initial load).
  // If an immediate flush was requested (e.g. after updatePropertyInState), skip the debounce.
  const cacheTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!initialLoadDone.current || !user) return;

    if (immediateFlushRef.current) {
      immediateFlushRef.current = false;
      if (cacheTimeoutRef.current) clearTimeout(cacheTimeoutRef.current);
      // cacheProperties already strips temp_ items
      cacheProperties(user.id, properties);
    } else if (properties.length > 0) {
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

    // 1. Crash-recovery guard: lastSyncAt was written after page 1 of the initial
    //    paginated sync, but cacheProperties was not (app was killed between the two).
    //    Next boot has lastSyncAt = T1 but an empty cache, so syncFromServer would
    //    take the incremental path and merge only the 2-item delta into an empty state.
    //    Reset lastSyncAt to '' so syncFromServer does a full paginated re-sync instead.
    //    NOTE: fresh install → lastSync = null → condition is false → does NOT fire.
    const lastSync = await getLastSyncAt(user.id);
    const cached = await getCachedProperties(user.id);
    if (lastSync && (!cached || cached.length === 0)) {
      await setLastSyncAt(user.id, '');
    }

    // 2. Load from cache (temp_ items already filtered by getCachedProperties)
    if (cached && cached.length > 0) {
      setProperties(cached);
      setLoading(false);
      initialLoadDone.current = true;
    }

    // 3. Drain pending operations BEFORE syncing — ensures server already has the
    //    latest mutations before we fetch fresh state, so the sync reflects them.
    await processPendingQueue();
    await processPendingUpdates();

    // 4. Fetch fresh state from server (after queue is drained)
    if (cached && cached.length > 0) {
      // Cache was shown already — sync in background
      syncFromServer(false);
    } else {
      // Nothing shown yet — block until sync completes
      await syncFromServer(true);
    }
  };

  // ── Sync engine ──────────────────────────────────────────────────────

  const syncFromServer = async (showLoading: boolean) => {
    if (!user || syncInProgress.current) return;
    syncInProgress.current = true;

    try {
      if (showLoading) setLoading(true);

      const lastSync = await getLastSyncAt(user.id);

      // Treat '' the same as null — crash-recovery guard in loadInitial writes ''
      // to force a full paginated re-sync after a mid-sync crash.
      if (lastSync && lastSync.length > 0) {
        // Incremental sync: fetch changes + all current IDs for deletion detection
        const response = await api.get('/properties/sync', {
          params: { since: lastSync },
        });
        const { properties: serverDelta, serverTime, allIds } = response.data;

        setProperties(prev => {
          const tempProperties = prev.filter(p => p.id.startsWith('temp_'));
          let realProperties = prev.filter(p => !p.id.startsWith('temp_'));

          // 1. Merge changed/new properties (timestamp guard keeps local if it's newer)
          if (serverDelta && serverDelta.length > 0) {
            realProperties = mergeServerProperties(realProperties, serverDelta);
          }

          // 2. Remove properties deleted on server (ID reconciliation)
          if (allIds) {
            const serverIdSet = new Set<string>(allIds);
            realProperties = realProperties.filter(p => serverIdSet.has(p.id));
          }

          const next = [...tempProperties, ...realProperties];
          // Persist the merged result so the next boot loads the correct count,
          // not the stale pre-merge cache. Without this the delta is applied to
          // in-memory state only and the cache stays at the old number.
          cacheProperties(user.id, next);
          return next;
        });

        await setLastSyncAt(user.id, serverTime);
      } else {
        // Initial sync: paginated fetch for new device / first login
        // Render each page as it arrives so the user sees properties immediately
        let offset = 0;
        const limit = 50;
        let hasMore = true;
        setSyncing(true);
        // Capture serverTime from page 1 (reflects DB state before the query ran)
        // but do NOT write it to disk yet — only write after the full loop AND
        // cacheProperties both complete, so a crash between writes can't leave
        // lastSyncAt pointing to a time with no matching cache.
        let firstPageServerTime: string | undefined;

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

          // Capture serverTime from the first page only (before any data changes)
          if (offset === limit) {
            firstPageServerTime = serverTime;
          }
        }

        // Write cache first, then lastSyncAt — both must succeed before the app
        // is considered fully synced. If killed here, the next boot detects
        // lastSyncAt=null (or the crash-recovery guard resets it) and re-syncs fully.
        setProperties(prev => {
          cacheProperties(user.id, prev);
          return prev;
        });
        if (firstPageServerTime) {
          await setLastSyncAt(user.id, firstPageServerTime);
        }
      }

      initialLoadDone.current = true;
    } catch (error) {
      console.error('Error syncing properties:', error);
    } finally {
      if (showLoading) setLoading(false);
      setSyncing(false); // Always clear — guards against errors mid-paginated-sync
      syncInProgress.current = false;
    }
  };

  // Process pending queue — retry property creations that failed to reach the server
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

        // Replace temp property with real one from server.
        // After app restart temp_ items are filtered from cache/state, so we must
        // ADD the real property if the temp_ is no longer present in state.
        if (item.data._tempId) {
          const realProperty: Property = response.data;
          setProperties(prev => {
            const tempIndex = prev.findIndex(p => p.id === item.data._tempId);
            if (tempIndex === -1) {
              // Temp was filtered on startup — add the real property at the top
              return [realProperty, ...prev];
            }
            const tempProp = prev[tempIndex];
            const tempHasPhotos = tempProp?.propertyPhotos && tempProp.propertyPhotos.length > 0;
            const serverHasPhotos = realProperty.propertyPhotos && realProperty.propertyPhotos.length > 0;
            const replacement = (!tempHasPhotos || serverHasPhotos)
              ? realProperty
              // Server version has no images but temp does — keep temp's media
              : { ...realProperty, propertyPhotos: tempProp.propertyPhotos, propertyVideos: tempProp.propertyVideos };
            return prev.map(p => p.id === item.data._tempId ? replacement : p);
          });
        }

        console.log(`Pending property ${item.id} synced successfully`);
      } catch (error) {
        console.error(`Failed to sync pending property ${item.id}:`, error);
        await updatePendingStatus(user.id, item.id, 'failed', item.retryCount + 1);
      }
    }
  };

  // Process pending updates queue — retry PUTs that failed to reach the server
  const processPendingUpdates = async () => {
    if (!user) return;
    const queue = await getPendingUpdates(user.id);
    if (queue.length === 0) return;

    for (const item of queue) {
      if (item.retryCount >= MAX_RETRIES) {
        await removeFromPendingUpdates(user.id, item.id);
        // Revert local state to server version
        try {
          const response = await api.get(`/properties/${item.propertyId}`);
          if (response.data) {
            setProperties(prev => prev.map(p => p.id === item.propertyId ? response.data : p));
          }
        } catch (e) {
          // If we can't even fetch the server version, leave local state as-is
          console.error(`Could not revert property ${item.propertyId} from server:`, e);
        }
        Alert.alert(
          'Update Failed',
          'A property edit could not be synced after multiple attempts. The property has been restored to its last server version.',
          [{ text: 'OK' }]
        );
        continue;
      }

      try {
        await updatePendingUpdateStatus(user.id, item.id, 'syncing', item.retryCount + 1);
        const response = await api.put(`/properties/${item.propertyId}`, item.data);
        await removeFromPendingUpdates(user.id, item.id);
        if (response.data) {
          setProperties(prev => prev.map(p => p.id === item.propertyId ? response.data : p));
        }
        console.log(`Pending update ${item.id} synced successfully`);
      } catch (error) {
        console.error(`Failed to sync pending update ${item.id}:`, error);
        await updatePendingUpdateStatus(user.id, item.id, 'failed', item.retryCount + 1);
      }
    }
  };

  // --- State mutation methods ---

  const addPropertyToState = useCallback((property: Property) => {
    setProperties(prev => [property, ...prev]);
  }, []);

  const updatePropertyInState = useCallback((id: string, updatedProperty: Property) => {
    // Signal the cache effect to flush immediately (no 1s debounce)
    immediateFlushRef.current = true;
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
      await processPendingUpdates();
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
