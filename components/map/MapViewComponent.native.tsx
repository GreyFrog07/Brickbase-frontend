import React, { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../../types/property';
import CachedImage from '../CachedImage';

export interface MapViewComponentProps {
  filteredProperties: Property[];
  mapType: 'standard' | 'satellite';
  isDarkMode: boolean;
  darkMapStyle: any[];
  getInitialRegion: () => Region;
  setSelectedProperty: (property: Property | null) => void;
  getCoverPhoto: (property: Property) => string | null;
  formatPrice: (property: Property) => string;
}

export interface MapViewHandle {
  animateToRegion: (region: Region, duration?: number) => void;
}

// Track images that have been loaded into marker bitmaps globally.
// Survives marker unmount/remount so tracksViewChanges stays false.
const loadedMarkerImages = new Set<string>();

const PropertyMarker = React.memo(function PropertyMarker({
  property,
  coverPhoto,
  formatPrice,
  onPress,
}: {
  property: Property;
  coverPhoto: string | null;
  formatPrice: (p: Property) => string;
  onPress: (property: Property) => void;
}) {
  const alreadyLoaded = !coverPhoto || loadedMarkerImages.has(coverPhoto);
  const [imageLoaded, setImageLoaded] = useState(alreadyLoaded);

  const handleImageLoad = useCallback(() => {
    if (coverPhoto) loadedMarkerImages.add(coverPhoto);
    setImageLoaded(true);
  }, [coverPhoto]);

  // Safety timeout: stop tracking after 3s even if image never loads
  useEffect(() => {
    if (imageLoaded) return;
    const timeout = setTimeout(() => setImageLoaded(true), 3000);
    return () => clearTimeout(timeout);
  }, [imageLoaded]);

  const isLocalOrHttp = coverPhoto && (coverPhoto.startsWith('file://') || coverPhoto.startsWith('http') || coverPhoto.startsWith('/'));

  return (
    <Marker
      coordinate={{
        latitude: property.latitude!,
        longitude: property.longitude!,
      }}
      onPress={() => onPress(property)}
      tracksViewChanges={!imageLoaded}
    >
      <View style={styles.markerWrapper}>
        <View style={styles.markerCard}>
          {coverPhoto ? (
            <CachedImage
              storagePath={!isLocalOrHttp ? coverPhoto : undefined}
              bucket={!isLocalOrHttp ? 'property-photos' : undefined}
              uri={isLocalOrHttp ? coverPhoto : undefined}
              style={styles.markerImage}
              onLoad={handleImageLoad}
            />
          ) : (
            <View style={styles.markerPlaceholder}>
              <Ionicons name="home" size={20} color="#666" />
            </View>
          )}
          {/* <View style={styles.markerPriceBar}>
            <Text style={styles.markerPriceText} numberOfLines={1}>
              {formatPrice(property)}
            </Text>
          </View> */}
        </View>
      </View>
    </Marker>
  );
});

export default forwardRef<MapViewHandle, MapViewComponentProps>(function MapViewComponent(
  {
    filteredProperties,
    mapType,
    isDarkMode,
    darkMapStyle,
    getInitialRegion,
    setSelectedProperty,
    getCoverPhoto,
    formatPrice,
  },
  ref
) {
  const mapRef = useRef<MapView>(null);
  const initialRegion = getInitialRegion();

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region, duration = 800) => {
      mapRef.current?.animateToRegion(region, duration);
    },
  }));

  // Render every property with location as an individual marker — no clustering.
  // Markers mount once and never re-render on zoom, pan, or rotation.
  const markers = useMemo(
    () => filteredProperties.filter(p => p.latitude && p.longitude),
    [filteredProperties],
  );

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={initialRegion}
      showsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={false}
      mapType={mapType}
      customMapStyle={isDarkMode ? darkMapStyle : undefined}
    >
      {markers.map((property) => (
        <PropertyMarker
          key={property.id}
          property={property}
          coverPhoto={getCoverPhoto(property)}
          formatPrice={formatPrice}
          onPress={setSelectedProperty}
        />
      ))}
    </MapView>
  );
});

const MARKER_W = 68;
const MARKER_IMG_H = 80;

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
  markerWrapper: {
    padding: Platform.OS === 'android' ? 8 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 8,
  },
  markerCard: {
    width: MARKER_W,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  markerImage: {
    width: MARKER_W - 4,
    height: MARKER_IMG_H,
    backgroundColor: '#333',
  },
  markerPlaceholder: {
    width: MARKER_W - 4,
    height: MARKER_IMG_H,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerPriceBar: {
    paddingHorizontal: 4,
    paddingVertical: 3,
    alignItems: 'center',
  },
  markerPriceText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
});
