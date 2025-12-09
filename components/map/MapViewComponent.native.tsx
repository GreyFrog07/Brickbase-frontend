import React, { useRef } from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../../types/property';

export interface MapViewComponentProps {
  filteredProperties: Property[];
  mapType: 'standard' | 'satellite';
  isDarkMode: boolean;
  darkMapStyle: any[];
  getInitialRegion: () => { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  setSelectedProperty: (property: Property | null) => void;
  getCoverPhoto: (property: Property) => string | null;
  formatPrice: (property: Property) => string;
}

export default function MapViewComponent({
  filteredProperties,
  mapType,
  isDarkMode,
  darkMapStyle,
  getInitialRegion,
  setSelectedProperty,
  getCoverPhoto,
  formatPrice,
}: MapViewComponentProps) {
  const mapRef = useRef<MapView>(null);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      initialRegion={getInitialRegion()}
      showsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={true}
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
            <View style={styles.customMarker}>
              {coverPhoto ? (
                <Image 
                  source={{ uri: coverPhoto }} 
                  style={styles.markerImage}
                />
              ) : (
                <View style={styles.markerPlaceholder}>
                  <Ionicons name="home" size={24} color="#666" />
                </View>
              )}
              <View style={styles.markerPriceContainer}>
                <Text style={styles.markerPriceText}>
                  {formatPrice(property)}
                </Text>
              </View>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
  customMarker: {
    alignItems: 'center',
  },
  markerImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  markerPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1a1a',
    borderWidth: 3,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerPriceContainer: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  markerPriceText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
