import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../../types/property';

interface CompactPropertyCardProps {
  property: Property;
  onPress: () => void;
  onShare?: () => void;
}

export default function CompactPropertyCard({ property, onPress, onShare }: CompactPropertyCardProps) {
  const formatPrice = (price?: number, unit?: string) => {
    if (!price) return 'Price N/A';
    if (unit === 'cr') return `₹${price.toFixed(2)} Cr`;
    if (unit === 'lakh_per_month') return `₹${price.toFixed(1)} L/mo`;
    return `₹${price.toFixed(2)} L`;
  };

  const getDisplayPrice = () => {
    if (property.floors && property.floors.length > 0) {
      const prices = property.floors.map(f => f.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const unit = property.floors[0].priceUnit;
      if (minPrice === maxPrice) return formatPrice(minPrice, unit);
      const unitLabel = unit === 'cr' ? 'Cr' : unit === 'lakh_per_month' ? 'L/mo' : 'L';
      return `₹${minPrice.toFixed(0)}-${maxPrice.toFixed(0)} ${unitLabel}`;
    }
    return formatPrice(property.price, property.priceUnit);
  };

  const getSizeInfo = () => {
    if (!property.sizes || property.sizes.length === 0) return null;
    const size = property.sizes[0];
    const unitLabel = size.unit === 'sq_ft' ? 'sq ft' : size.unit === 'sq_yards' ? 'sq yd' : 'sq m';
    return `${size.value.toLocaleString()} ${unitLabel}`;
  };

  const getLocationInfo = () => {
    if (!property.address) return null;
    const parts = [property.address.sector, property.address.city].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const handleCall = () => {
    const phoneNumber = property.builders?.[0]?.phoneNumber || property.builderPhone;
    if (phoneNumber) {
      const countryCode = property.builders?.[0]?.countryCode || '+91';
      Linking.openURL(`tel:${countryCode}${phoneNumber}`).catch(() => {
        Alert.alert('Error', 'Could not open phone app');
      });
    }
  };

  const coverIndex = property.coverPhotoIndex ?? 0;
  const coverPhoto = property.propertyPhotos?.[coverIndex] || property.propertyPhotos?.[0];
  const sizeInfo = getSizeInfo();
  const locationInfo = getLocationInfo();
  const hasPhone = !!(property.builders?.[0]?.phoneNumber || property.builderPhone);

  const detailParts = [sizeInfo, locationInfo].filter(Boolean);
  const detailLine = detailParts.join('  |  ');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Thumbnail */}
      {coverPhoto ? (
        <Image source={{ uri: coverPhoto }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.placeholderThumb]}>
          <Ionicons name="image-outline" size={24} color="#555" />
        </View>
      )}

      {/* Details */}
      <View style={styles.details}>
        {property.propertyCategory && (
          <Text style={styles.category}>{property.propertyCategory}</Text>
        )}
        <Text style={styles.propertyType} numberOfLines={1}>
          {property.propertyType || 'Property'}
        </Text>
        <Text style={styles.price}>{getDisplayPrice()}</Text>
        {detailLine ? (
          <Text style={styles.detailLine} numberOfLines={1}>{detailLine}</Text>
        ) : null}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {hasPhone && (
          <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
            <Ionicons name="call" size={18} color="#fff" />
          </TouchableOpacity>
        )}
        {onShare && (
          <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
            <Ionicons name="share-social-outline" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    height: 100,
  },
  thumbnail: {
    width: 100,
    height: '100%',
    backgroundColor: '#333',
    resizeMode: 'cover',
  },
  placeholderThumb: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  details: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 1,
  },
  category: {
    color: '#999',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  propertyType: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 1,
  },
  price: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 1,
  },
  detailLine: {
    color: '#777',
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    paddingRight: 12,
    alignItems: 'center',
    gap: 8,
  },
  callBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 18,
    padding: 9,
  },
  shareBtn: {
    padding: 4,
  },
});
