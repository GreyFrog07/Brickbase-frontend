import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../../types/property';

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

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region, duration = 800) => {
      mapRef.current?.animateToRegion(region, duration);
    },
  }));

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      initialRegion={getInitialRegion()}
      showsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={false}
      mapType={mapType}
      customMapStyle={isDarkMode ? darkMapStyle : undefined}
    >
      {filteredProperties.map((property) => {
        const coverPhoto = getCoverPhoto(property);
        return (
          <Marker
            key={property.id}
            coordinate={{
              latitude: property.latitude!,
              longitude: property.longitude!,
            }}
            onPress={() => setSelectedProperty(property)}
            tracksViewChanges={Platform.OS === 'ios'}
          >
            <View style={styles.markerWrapper}>
              <View style={styles.markerCard}>
                {coverPhoto ? (
                  <Image
                    source={{ uri: coverPhoto }}
                    style={styles.markerImage}
                  />
                ) : (
                  <View style={styles.markerPlaceholder}>
                    <Ionicons name="home" size={22} color="#666" />
                  </View>
                )}
                <View style={styles.markerPriceBar}>
                  <Text style={styles.markerPriceText} numberOfLines={1}>
                    {formatPrice(property)}
                  </Text>
                </View>
              </View>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
});

const MARKER_W = 64;
const MARKER_IMG_H = 52;

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
  markerWrapper: {
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
