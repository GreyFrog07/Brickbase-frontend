import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuth } from '../../contexts/AuthContext';
import {
  Property,
  PropertyCategory,
  PropertyType,
  RESIDENTIAL_PROPERTY_TYPES,
  COMMERCIAL_PROPERTY_TYPES,
} from '../../types/property';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import {
  getCachedProperties,
  cacheProperties,
  shouldRefreshCache,
  resetRefreshFlag,
} from '../../lib/cache';
// Platform-specific map component - Metro resolves to .web.tsx or .native.tsx
import NativeMapView from '../../components/map/MapViewComponent';

const { width, height } = Dimensions.get('window');

// Web fallback component
function WebMapFallback({ count }: { count: number }) {
  return (
    <View style={styles.webFallback}>
      <Ionicons name="map" size={64} color="#666" />
      <Text style={styles.webFallbackTitle}>Map View</Text>
      <Text style={styles.webFallbackText}>
        Please open this app on your mobile device using Expo Go to view the interactive map.
      </Text>
      <Text style={styles.webFallbackCount}>
        {count} properties with location data
      </Text>
    </View>
  );
}

export default function MapScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  
  // Map view type and dark mode
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyCategory, setPropertyCategory] = useState<PropertyCategory | ''>('');
  const [selectedType, setSelectedType] = useState<PropertyType | ''>();

  useFocusEffect(
    useCallback(() => {
      loadPropertiesWithCache();
    }, [])
  );

  useEffect(() => {
    if (Platform.OS !== 'web') {
      getCurrentLocation();
    }
  }, []);

  useEffect(() => {
    applyFilters();
  }, [properties, propertyCategory, selectedType, searchQuery]);

  const loadPropertiesWithCache = async () => {
    const cached = await getCachedProperties();
    if (cached && cached.length > 0) {
      const withLocation = cached.filter((p: Property) => p.latitude && p.longitude);
      setProperties(withLocation);
      setLoading(false);
      setInitialLoadDone(true);
      
      if (shouldRefreshCache()) {
        fetchPropertiesInBackground();
      }
    } else {
      await fetchProperties();
    }
  };

  const fetchPropertiesInBackground = async () => {
    try {
      const params = new URLSearchParams();
      const response = await api.get(`/properties?${params.toString()}`);
      
      const allProperties = response.data || [];
      const withLocation = allProperties.filter((p: Property) => p.latitude && p.longitude);
      
      await cacheProperties(allProperties);
      resetRefreshFlag();
      
      setProperties(withLocation);
    } catch (error) {
      console.error('Background fetch error:', error);
    }
  };

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const response = await api.get(`/properties?${params.toString()}`);
      
      const allProperties = response.data || [];
      const withLocation = allProperties.filter((p: Property) => p.latitude && p.longitude);
      
      await cacheProperties(allProperties);
      resetRefreshFlag();
      
      setProperties(withLocation);
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...properties];
    if (propertyCategory) {
      filtered = filtered.filter(p => p.propertyCategory === propertyCategory);
    }
    if (selectedType) {
      filtered = filtered.filter(p => p.propertyType === selectedType);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.propertyType?.toLowerCase().includes(query) ||
        p.propertyCategory?.toLowerCase().includes(query) ||
        p.address?.city?.toLowerCase().includes(query) ||
        p.address?.sector?.toLowerCase().includes(query)
      );
    }
    setFilteredProperties(filtered);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setPropertyCategory('');
    setSelectedType('');
  };

  const hasActiveFilters = !!(searchQuery || propertyCategory || selectedType);

  const formatPrice = (property: Property) => {
    if (property.floors && property.floors.length > 0) {
      const minPrice = Math.min(...property.floors.map(f => f.price));
      const maxPrice = Math.max(...property.floors.map(f => f.price));
      const unit = property.floors[0].priceUnit === 'cr' ? 'Cr' : 
                   property.floors[0].priceUnit === 'lakh_per_month' ? 'L/mo' : 'L';
      if (minPrice === maxPrice) {
        return `₹${minPrice.toFixed(1)}${unit}`;
      }
      return `₹${minPrice.toFixed(0)}-${maxPrice.toFixed(0)}${unit}`;
    }
    if (!property.price) return 'N/A';
    if (property.priceUnit === 'cr') {
      return `₹${property.price}Cr`;
    }
    if (property.priceUnit === 'lakh_per_month') {
      return `₹${property.price}L/mo`;
    }
    return `₹${property.price}L`;
  };

  const getCoverPhoto = (property: Property) => {
    if (property.propertyPhotos && property.propertyPhotos.length > 0) {
      const coverIndex = property.coverPhotoIndex || 0;
      return property.propertyPhotos[coverIndex] || property.propertyPhotos[0];
    }
    return null;
  };

  // Dark mode map style
  const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e3a1e' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#3c3c3c' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d2c4f' }] },
  ];

  const cycleMapType = () => {
    // Cycle: Light -> Dark -> Satellite -> Light
    if (mapType === 'standard' && !isDarkMode) {
      setIsDarkMode(true);
    } else if (mapType === 'standard' && isDarkMode) {
      setIsDarkMode(false);
      setMapType('satellite');
    } else {
      setMapType('standard');
      setIsDarkMode(false);
    }
  };

  const getMapTypeLabel = () => {
    if (mapType === 'satellite') return 'Satellite';
    return isDarkMode ? 'Dark' : 'Light';
  };

  const getMapTypeIcon = () => {
    if (mapType === 'satellite') return 'earth';
    return isDarkMode ? 'moon' : 'sunny';
  };

  const handlePropertyPress = (property: Property) => {
    router.push({
      pathname: '/property-details',
      params: { propertyId: property.id },
    });
  };

  const getPropertyTypes = (): PropertyType[] => {
    if (propertyCategory === 'Residential') {
      return RESIDENTIAL_PROPERTY_TYPES;
    } else if (propertyCategory === 'Commercial') {
      return COMMERCIAL_PROPERTY_TYPES;
    }
    return [...RESIDENTIAL_PROPERTY_TYPES, ...COMMERCIAL_PROPERTY_TYPES];
  };

  const getInitialRegion = () => {
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    if (filteredProperties.length > 0 && filteredProperties[0].latitude) {
      return {
        latitude: filteredProperties[0].latitude,
        longitude: filteredProperties[0].longitude!,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return {
      latitude: 28.6139,
      longitude: 77.209,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  };

  if (loading && !initialLoadDone) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  // Web fallback - show message instead of map
  if (Platform.OS === 'web') {
    return <WebMapFallback count={filteredProperties.length} />;
  }

  // Native - this code path only runs on native platforms
  // The MapViewComponent is imported at module level (see import at top)
  // Metro resolves to .native.tsx on native and .web.tsx on web automatically

  return (
    <View style={styles.container}>
      <NativeMapView
        filteredProperties={filteredProperties}
        mapType={mapType}
        isDarkMode={isDarkMode}
        darkMapStyle={darkMapStyle}
        getInitialRegion={getInitialRegion}
        setSelectedProperty={setSelectedProperty}
        getCoverPhoto={getCoverPhoto}
        formatPrice={formatPrice}
      />

      {/* Map Type Toggle Button - Top Right */}
      <TouchableOpacity 
        style={[styles.mapTypeButton, { top: insets.top + 8 }]}
        onPress={cycleMapType}
      >
        <Ionicons name={getMapTypeIcon() as any} size={20} color="#fff" />
        <Text style={styles.mapTypeText}>{getMapTypeLabel()}</Text>
      </TouchableOpacity>

      {/* Expanded Filters - Above bottom nav when open */}
      {showFilters && (
        <View style={[styles.filtersOverlayBottom, { bottom: 100 }]}>
          <View style={styles.filtersHeader}>
            <Text style={styles.filtersTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.filtersScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipContainer}>
                  <TouchableOpacity
                    style={[styles.chip, !propertyCategory && styles.chipSelected]}
                    onPress={() => { setPropertyCategory(''); setSelectedType(''); }}
                  >
                    <Text style={[styles.chipText, !propertyCategory && styles.chipTextSelected]}>All</Text>
                  </TouchableOpacity>
                  {(['Residential', 'Commercial'] as PropertyCategory[]).map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, propertyCategory === cat && styles.chipSelected]}
                      onPress={() => { setPropertyCategory(cat); setSelectedType(''); }}
                    >
                      <Text style={[styles.chipText, propertyCategory === cat && styles.chipTextSelected]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipContainer}>
                  <TouchableOpacity
                    style={[styles.chip, !selectedType && styles.chipSelected]}
                    onPress={() => setSelectedType('')}
                  >
                    <Text style={[styles.chipText, !selectedType && styles.chipTextSelected]}>All</Text>
                  </TouchableOpacity>
                  {getPropertyTypes().map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chip, selectedType === type && styles.chipSelected]}
                      onPress={() => setSelectedType(type)}
                    >
                      <Text style={[styles.chipText, selectedType === type && styles.chipTextSelected]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

          </ScrollView>
        </View>
      )}

      {/* Filter Button - Bottom positioned above tab bar */}
      <TouchableOpacity 
        style={[styles.filterButton, { bottom: 90 }]}
        onPress={() => setShowFilters(!showFilters)}
      >
        <Ionicons name="options" size={22} color="#fff" />
        <Text style={styles.filterButtonText}>Filters</Text>
        {hasActiveFilters && <View style={styles.filterBadge} />}
      </TouchableOpacity>

      {/* Property Count */}
      <View style={[styles.propertyCountBadge, { bottom: 90, left: 16 }]}>
        <Text style={styles.propertyCountText}>{filteredProperties.length} properties</Text>
      </View>

      {/* Selected Property Card */}
      {selectedProperty && (
        <TouchableOpacity 
          style={[styles.propertyCard, { bottom: 90 }]}
          onPress={() => handlePropertyPress(selectedProperty)}
          activeOpacity={0.9}
        >
          <TouchableOpacity style={styles.cardClose} onPress={() => setSelectedProperty(null)}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
          
          {selectedProperty.propertyPhotos?.[0] && (
            <Image source={{ uri: selectedProperty.propertyPhotos[0] }} style={styles.cardImage} />
          )}
          
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardType}>{selectedProperty.propertyType}</Text>
            </View>
            <Text style={styles.cardPrice}>{formatPrice(selectedProperty)}</Text>
            {selectedProperty.address?.sector && (
              <Text style={styles.cardAddress}>
                {selectedProperty.address.sector}
                {selectedProperty.address.city ? `, ${selectedProperty.address.city}` : ''}
              </Text>
            )}
            <View style={styles.cardFooter}>
              <Text style={styles.cardViewMore}>Tap to view details</Text>
              <Ionicons name="chevron-forward" size={16} color="#4CAF50" />
            </View>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0c0c0c' },
  loadingText: { color: '#fff', marginTop: 12, fontSize: 16 },
  webFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0c0c0c', padding: 32 },
  webFallbackTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 16 },
  webFallbackText: { color: '#999', fontSize: 16, textAlign: 'center', marginTop: 12, lineHeight: 24 },
  webFallbackCount: { color: '#4CAF50', fontSize: 14, marginTop: 24 },
  map: { flex: 1 },
  // Custom marker styles - rounded squarish (length slightly > breadth)
  customMarker: { 
    backgroundColor: '#1a1a1a', 
    borderRadius: 10, 
    borderWidth: 2, 
    borderColor: '#333', 
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    width: 60,
  },
  markerImage: { 
    width: 56, 
    height: 50, 
    backgroundColor: '#333' 
  },
  markerPlaceholder: { 
    width: 56, 
    height: 50, 
    backgroundColor: '#333', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  markerPriceContainer: { 
    backgroundColor: '#1a1a1a', 
    paddingHorizontal: 6, 
    paddingVertical: 3,
    alignItems: 'flex-end',
  },
  markerPriceText: { 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: 'bold' 
  },
  // Map type button
  mapTypeButton: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 2,
  },
  mapTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Filter button at bottom
  filterButton: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 2,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filterBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  // Filters overlay at bottom
  filtersOverlayBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(26, 26, 26, 0.98)',
    borderRadius: 16,
    padding: 16,
    maxHeight: 300,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filtersTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Old marker styles (keeping for compatibility)
  markerContainer: { backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 2, borderColor: '#4CAF50', elevation: 5 },
  markerSold: { backgroundColor: '#ff4444', borderColor: '#ff4444' },
  markerPrice: { color: '#000', fontSize: 12, fontWeight: 'bold' },
  markerPriceSold: { color: '#fff' },
  searchOverlay: { position: 'absolute', left: 16, right: 80, zIndex: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, gap: 10, borderWidth: 1, borderColor: '#333' },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', padding: 6, marginTop: 4, backgroundColor: 'rgba(26, 26, 26, 0.9)', borderRadius: 12 },
  clearButtonText: { color: '#ff4444', fontSize: 12 },
  filtersOverlay: { position: 'absolute', left: 16, right: 16, backgroundColor: 'rgba(26, 26, 26, 0.95)', borderRadius: 12, padding: 12, maxHeight: 200, zIndex: 1 },
  filtersScroll: { maxHeight: 220 },
  filterSection: { marginBottom: 12 },
  filterLabel: { color: '#999', fontSize: 11, marginBottom: 6, fontWeight: '600' },
  chipContainer: { flexDirection: 'row', gap: 6 },
  chip: { backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#444', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: '#fff', borderColor: '#fff' },
  chipText: { color: '#fff', fontSize: 12 },
  chipTextSelected: { color: '#000', fontWeight: '600' },
  soldToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  soldToggleText: { color: '#fff', fontSize: 12 },
  myLocationButton: { position: 'absolute', right: 16, backgroundColor: '#1a1a1a', width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333', elevation: 5 },
  propertyCountBadge: { position: 'absolute', backgroundColor: 'rgba(26, 26, 26, 0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#333' },
  propertyCountText: { color: '#fff', fontSize: 12 },
  propertyCard: { position: 'absolute', left: 16, right: 16, backgroundColor: '#1a1a1a', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#333', flexDirection: 'row', elevation: 10 },
  cardClose: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: 12, padding: 4, zIndex: 1 },
  cardImage: { width: 120, height: 110, backgroundColor: '#333' },
  cardContent: { flex: 1, padding: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardType: { color: '#999', fontSize: 12 },
  soldBadge: { backgroundColor: '#ff4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  soldBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cardPrice: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  cardAddress: { color: '#666', fontSize: 12, marginTop: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  cardViewMore: { color: '#4CAF50', fontSize: 12 },
});
