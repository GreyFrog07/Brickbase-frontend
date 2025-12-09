import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { Property } from '../types/property';
import {
  getCachedProperties,
  cacheProperties,
  getPendingQueue,
  removeFromPendingQueue,
  updatePendingStatus,
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
    if (initialLoadDone.current && properties.length > 0) {
      // Don't persist temp-only lists — wait for real data
      const hasRealProperties = properties.some(p => !p.id.startsWith('temp_'));
      if (hasRealProperties) {
        cacheProperties(properties.filter(p => !p.id.startsWith('temp_')));
      }
    }
  }, [properties]);

  const loadInitial = async () => {
    setLoading(true);

    // 1. Load from cache first for instant display
    const cached = await getCachedProperties();
    if (cached && cached.length > 0) {
      setProperties(cached);
      setLoading(false);
      initialLoadDone.current = true;
    }

    // 2. Process any pending uploads from previous session
    //    (these were saved to queue but POST never completed)
    await processPendingQueue();

    // 3. Fetch fresh data from server (reconciles everything)
    await fetchFromServer(!cached || cached.length === 0);
  };

  const fetchFromServer = async (showLoading: boolean) => {
    try {
      if (showLoading) setLoading(true);
      const response = await api.get('/properties');
      const serverProperties: Property[] = response.data || [];
      // Preserve any temp (syncing) properties so they don't get wiped
      // by a refresh while background upload is still in progress
      setProperties(prev => {
        const tempProperties = prev.filter(p => p.id.startsWith('temp_'));
        return [...tempProperties, ...serverProperties];
      });
      await cacheProperties(serverProperties);
      initialLoadDone.current = true;
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Process pending queue — retry uploads that were interrupted
  const processPendingQueue = async () => {
    const queue = await getPendingQueue();
    if (queue.length === 0) return;

    let anySucceeded = false;

    for (const item of queue) {
      if (item.retryCount >= MAX_RETRIES) {
        // Give up after max retries — remove from queue and notify user
        await removeFromPendingQueue(item.id);
        Alert.alert(
          'Upload Failed',
          'A property could not be synced after multiple attempts. Please add it again.',
          [{ text: 'OK' }]
        );
        continue;
      }

      try {
        await updatePendingStatus(item.id, 'syncing', item.retryCount + 1);
        await api.post('/properties', item.data);
        await removeFromPendingQueue(item.id);
        anySucceeded = true;
        console.log(`Pending property ${item.id} synced successfully`);
      } catch (error) {
        console.error(`Failed to sync pending property ${item.id}:`, error);
        await updatePendingStatus(item.id, 'failed', item.retryCount + 1);
      }
    }

    // If any succeeded, the subsequent fetchFromServer will pick them up
    if (anySucceeded) {
      console.log('Pending queue processed — server fetch will include new properties');
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
    await fetchFromServer(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Also retry pending queue on pull-to-refresh
      await processPendingQueue();
      const response = await api.get('/properties');
      const serverProperties: Property[] = response.data || [];
      // Preserve temp properties during refresh
      setProperties(prev => {
        const tempProperties = prev.filter(p => p.id.startsWith('temp_'));
        return [...tempProperties, ...serverProperties];
      });
      await cacheProperties(serverProperties);
    } catch (error) {
      console.error('Error refreshing properties:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

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
