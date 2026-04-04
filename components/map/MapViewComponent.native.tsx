import React, { forwardRef, useImperativeHandle, useRef, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../../types/property';
import Supercluster from 'supercluster';
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

interface PointProps {
  property: Property;
}

function regionToBBox(region: Region): GeoJSON.BBox {
  return [
    region.longitude - region.longitudeDelta / 2,
    region.latitude - region.latitudeDelta / 2,
    region.longitude + region.longitudeDelta / 2,
    region.latitude + region.latitudeDelta / 2,
  ];
}

function getZoomLevel(region: Region): number {
  const angle = region.longitudeDelta;
  return Math.max(0, Math.min(20, Math.round(Math.log(360 / angle) / Math.LN2)));
}

function PropertyMarker({
  property,
  coverPhoto,
  formatPrice,
  onPress,
}: {
  property: Property;
  coverPhoto: string | null;
  formatPrice: (p: Property) => string;
  onPress: () => void;
}) {
  // Image loading is handled by CachedImage internally

  return (
    <Marker
      coordinate={{
        latitude: property.latitude!,
        longitude: property.longitude!,
      }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={styles.markerWrapper}>
        <View style={styles.markerCard}>
          {coverPhoto ? (
            <CachedImage
              storagePath={coverPhoto.startsWith('http') ? undefined : coverPhoto}
              bucket={coverPhoto.startsWith('http') ? undefined : 'property-photos'}
              uri={coverPhoto.startsWith('http') ? coverPhoto : undefined}
              style={styles.markerImage}
            />
          ) : (
            <View style={styles.markerPlaceholder}>
              <Ionicons name="home" size={20} color="#666" />
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
}

function ClusterMarker({
  count,
  coordinate,
  onPress,
}: {
  count: number;
  coordinate: { latitude: number; longitude: number };
  onPress: () => void;
}) {
  const size = Math.min(40 + Math.log2(count) * 6, 56);

  return (
    <Marker
      coordinate={coordinate}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={styles.clusterWrapper}>
        <View style={[styles.clusterCircle, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={styles.clusterCount}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      </View>
    </Marker>
  );
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
  const initialRegion = getInitialRegion();
  const [region, setRegion] = useState<Region>(initialRegion);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region, duration = 800) => {
      mapRef.current?.animateToRegion(region, duration);
    },
  }));

  const clusterIndex = useMemo(() => {
    const index = new Supercluster<PointProps>({
      radius: 60,
      maxZoom: 14,
      minPoints: 2,
    });

    const points: Supercluster.PointFeature<PointProps>[] = filteredProperties
      .filter(p => p.latitude && p.longitude)
      .map(p => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.longitude!, p.latitude!],
        },
        properties: {
          property: p,
        },
      }));

    index.load(points);
    return index;
  }, [filteredProperties]);

  const clusters = useMemo(() => {
    const bbox = regionToBBox(region);
    const zoom = getZoomLevel(region);
    return clusterIndex.getClusters(bbox, zoom);
  }, [region, clusterIndex]);

  const handleRegionChange = useCallback((newRegion: Region) => {
    setRegion(newRegion);
  }, []);

  const handleClusterPress = useCallback((clusterId: number, latitude: number, longitude: number) => {
    const expansionZoom = clusterIndex.getClusterExpansionZoom(clusterId);
    const delta = 360 / Math.pow(2, expansionZoom + 1);
    mapRef.current?.animateToRegion(
      { latitude, longitude, latitudeDelta: delta, longitudeDelta: delta },
      500,
    );
  }, [clusterIndex]);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      initialRegion={initialRegion}
      showsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={false}
      mapType={mapType}
      customMapStyle={isDarkMode ? darkMapStyle : undefined}
      onRegionChangeComplete={handleRegionChange}
    >
      {clusters.map((feature) => {
        const [longitude, latitude] = feature.geometry.coordinates;

        if ('cluster' in feature.properties && feature.properties.cluster) {
          return (
            <ClusterMarker
              key={`cluster-${feature.id}`}
              count={feature.properties.point_count}
              coordinate={{ latitude, longitude }}
              onPress={() => handleClusterPress(feature.id as number, latitude, longitude)}
            />
          );
        }

        const { property } = feature.properties as PointProps;
        return (
          <PropertyMarker
            key={property.id}
            property={property}
            coverPhoto={getCoverPhoto(property)}
            formatPrice={formatPrice}
            onPress={() => setSelectedProperty(property)}
          />
        );
      })}
    </MapView>
  );
});

const MARKER_W = 62;
const MARKER_IMG_H = 50;

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
  clusterWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  clusterCircle: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2.5,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clusterCount: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
