import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../../types/property';

// Props interface matches native version for consistency
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

// Web fallback - react-native-maps doesn't work on web
export default function MapViewComponent({ filteredProperties }: MapViewComponentProps) {
  return (
    <View style={styles.webFallback}>
      <Ionicons name="map" size={64} color="#666" />
      <Text style={styles.webFallbackTitle}>Map View</Text>
      <Text style={styles.webFallbackText}>
        Maps are not available on web preview.{'\n\n'}
        Please open this app on your mobile device using Expo Go to view the interactive map with property locations.
      </Text>
      <Text style={styles.webFallbackCount}>
        {filteredProperties.length} properties with location data
      </Text>
      <View style={styles.instructionBox}>
        <Ionicons name="phone-portrait-outline" size={24} color="#4CAF50" />
        <Text style={styles.instructionText}>
          Scan the QR code in Expo Go app
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0c0c0c',
    padding: 32,
  },
  webFallbackTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  webFallbackText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  webFallbackCount: {
    color: '#4CAF50',
    fontSize: 14,
    marginTop: 16,
    fontWeight: '600',
  },
  instructionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  instructionText: {
    color: '#4CAF50',
    fontSize: 14,
  },
});
