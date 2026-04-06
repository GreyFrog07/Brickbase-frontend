import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import CachedImage from '../../components/CachedImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useProperties } from '../../contexts/PropertyContext';
import {
  Property,
  PropertyCategory,
  PropertyType,
  RESIDENTIAL_PROPERTY_TYPES,
  COMMERCIAL_PROPERTY_TYPES,
} from '../../types/property';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NativeMapView, { MapViewHandle } from '../../components/map/MapViewComponent.native';

const { width, height } = Dimensions.get('window');

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
  const insets = useSafeAreaInsets();
  const mapViewRef = useRef<MapViewHandle>(null);
  const { properties: allProperties, loading } = useProperties();

  // Filter to only properties with location data
  const propertiesWithLocation = useMemo(
    () => allProperties.filter(p => p.latitude && p.longitude),
    [allProperties]
  );

  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [propertyCategory, setPropertyCategory] = useState<PropertyCategory | ''>('');
  const [selectedType, setSelectedType] = useState<PropertyType | ''>();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      getCurrentLocation();
    }
  }, []);

  useEffect(() => {
    applyFilters();
  }, [propertiesWithLocation, propertyCategory, selectedType]);

  const applyFilters = () => {
    let filtered = [...propertiesWithLocation];
    if (propertyCategory) {
      filtered = filtered.filter(p => p.propertyCategory === propertyCategory);
    }
    if (selectedType) {
      filtered = filtered.filter(p => p.propertyType === selectedType);
    }
    setFilteredProperties(filtered);
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const hasActiveFilters = !!(propertyCategory || selectedType);

  const formatPrice = useCallback((property: Property) => {
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
    if (property.priceUnit === 'cr') return `₹${property.price}Cr`;
    if (property.priceUnit === 'lakh_per_month') return `₹${property.price}L/mo`;
    return `₹${property.price}L`;
  }, []);

  const getCoverPhoto = useCallback((property: Property) => {
    // Prefer raw storage path (local-first), fall back to signed URL
    if (property.coverPhotoPath) return property.coverPhotoPath;
    if (property.propertyPhotos && property.propertyPhotos.length > 0) {
      const coverIndex = property.coverPhotoIndex || 0;
      return property.propertyPhotos[coverIndex] || property.propertyPhotos[0];
    }
    return null;
  }, []);

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
    if (Platform.OS === 'ios') {
      // Apple Maps: toggle between standard and satellite (no dark mode style)
      setMapType(mapType === 'standard' ? 'satellite' : 'standard');
    } else {
      // Google Maps: cycle standard → dark → satellite
      if (mapType === 'standard' && !isDarkMode) {
        setIsDarkMode(true);
      } else if (mapType === 'standard' && isDarkMode) {
        setIsDarkMode(false);
        setMapType('satellite');
      } else {
        setMapType('standard');
        setIsDarkMode(false);
      }
    }
  };

  const getMapTypeIcon = () => {
    if (mapType === 'satellite') return 'earth';
    if (Platform.OS === 'ios') return 'map';
    return isDarkMode ? 'moon' : 'sunny';
  };

  const handlePropertyPress = (property: Property) => {
    router.push({
      pathname: '/property-details',
      params: { propertyId: property.id },
    });
  };

  const handleMyLocation = () => {
    if (userLocation) {
      mapViewRef.current?.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } else {
      getCurrentLocation();
    }
  };

  const getPropertyTypes = (): PropertyType[] => {
    if (propertyCategory === 'Residential') return RESIDENTIAL_PROPERTY_TYPES;
    if (propertyCategory === 'Commercial') return COMMERCIAL_PROPERTY_TYPES;
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
    return { latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  };

  if (loading && propertiesWithLocation.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return <WebMapFallback count={filteredProperties.length} />;
  }

  const controlsBottom = 100;

  return (
    <View style={styles.container}>
      <NativeMapView
        ref={mapViewRef}
        filteredProperties={filteredProperties}
        mapType={mapType}
        isDarkMode={isDarkMode}
        darkMapStyle={darkMapStyle}
        getInitialRegion={getInitialRegion}
        setSelectedProperty={setSelectedProperty}
        getCoverPhoto={getCoverPhoto}
        formatPrice={formatPrice}
      />

      {/* Top-right: map type toggle */}
      <TouchableOpacity
        style={[styles.controlButton, { position: 'absolute', top: insets.top + 12, right: 16 }]}
        onPress={cycleMapType}
      >
        <Ionicons name={getMapTypeIcon() as any} size={20} color="#fff" />
      </TouchableOpacity>

      {/* Bottom-left: property count */}
      <View style={[styles.countPill, { bottom: controlsBottom }]}>
        <Text style={styles.countText}>{filteredProperties.length} properties</Text>
      </View>

      {/* Bottom-right: stacked controls */}
      <View style={[styles.controlStack, { bottom: controlsBottom }]}>
        <TouchableOpacity style={styles.controlButton} onPress={handleMyLocation}>
          <Ionicons name="locate" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, hasActiveFilters && styles.controlButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filters panel */}
      {showFilters && (
        <View style={[styles.filtersPanel, { bottom: controlsBottom + 56 }]}>
          <View style={styles.filtersHeader}>
            <Text style={styles.filtersTitle}>Filters</Text>
            {hasActiveFilters && (
              <TouchableOpacity onPress={() => { setPropertyCategory(''); setSelectedType(''); }}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
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
              <View style={styles.chipRow}>
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
        </View>
      )}

      {/* Selected property card */}
      {selectedProperty && (
        <TouchableOpacity
          style={[styles.propertyCard, { bottom: controlsBottom }]}
          onPress={() => handlePropertyPress(selectedProperty)}
          activeOpacity={0.9}
        >
          <TouchableOpacity style={styles.cardClose} onPress={() => setSelectedProperty(null)}>
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>

          {(selectedProperty.coverPhotoPath || selectedProperty.propertyPhotos?.[0]) && (
            <CachedImage
              storagePath={selectedProperty.coverPhotoPath}
              bucket={selectedProperty.coverPhotoPath ? 'property-photos' : undefined}
              uri={!selectedProperty.coverPhotoPath ? selectedProperty.propertyPhotos?.[0] : undefined}
              style={styles.cardImage}
            />
          )}

          <View style={styles.cardContent}>
            <Text style={styles.cardType}>{selectedProperty.propertyType}</Text>
            <Text style={styles.cardPrice}>{formatPrice(selectedProperty)}</Text>
            {selectedProperty.address?.sector && (
              <Text style={styles.cardAddress} numberOfLines={1}>
                {selectedProperty.address.sector}
                {selectedProperty.address.city ? `, ${selectedProperty.address.city}` : ''}
              </Text>
            )}
            <View style={styles.cardFooter}>
              <Text style={styles.cardViewMore}>View details</Text>
              <Ionicons name="chevron-forward" size={14} color="#999" />
            </View>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const CONTROL_SIZE = 44;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0c0c0c' },
  loadingText: { color: '#fff', marginTop: 12, fontSize: 16 },
  webFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0c0c0c', padding: 32 },
  webFallbackTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 16 },
  webFallbackText: { color: '#999', fontSize: 16, textAlign: 'center', marginTop: 12, lineHeight: 24 },
  webFallbackCount: { color: '#4CAF50', fontSize: 14, marginTop: 24 },

  // Controls
  controlButton: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
    backgroundColor: 'rgba(26, 26, 26, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlButtonActive: {
    borderColor: '#fff',
  },
  controlStack: {
    position: 'absolute',
    right: 16,
    gap: 10,
    alignItems: 'center',
  },
  countPill: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(26, 26, 26, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  countText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Filters panel
  filtersPanel: {
    position: 'absolute',
    right: 16,
    width: 280,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filtersTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  clearText: {
    color: '#999',
    fontSize: 12,
  },
  filterSection: {
    marginBottom: 10,
  },
  filterLabel: {
    color: '#666',
    fontSize: 11,
    marginBottom: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: {
    backgroundColor: '#fff',
  },
  chipText: {
    color: '#999',
    fontSize: 12,
  },
  chipTextSelected: {
    color: '#000',
    fontWeight: '600',
  },

  // Property card
  propertyCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    elevation: 10,
  },
  cardClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 4,
    zIndex: 1,
  },
  cardImage: { width: 110, height: 100, backgroundColor: '#333' },
  cardContent: { flex: 1, padding: 12 },
  cardType: { color: '#666', fontSize: 11 },
  cardPrice: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 2 },
  cardAddress: { color: '#666', fontSize: 12, marginTop: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  cardViewMore: { color: '#999', fontSize: 12 },
});
