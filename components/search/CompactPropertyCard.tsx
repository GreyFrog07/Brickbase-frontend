import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../../types/property';
import CachedImage from '../CachedImage';

interface CompactPropertyCardProps {
  property: Property;
  onPress: () => void;
  onShare?: () => void;
}

export default function CompactPropertyCard({ property, onPress, onShare }: CompactPropertyCardProps) {
  const formatPrice = (price?: number, unit?: string) => {
    if (!price) return null;
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
    const parts: string[] = [];
    if (property.address.block) parts.push(`Block ${property.address.block}`);
    if (property.address.sector) parts.push(`Sector ${property.address.sector}`);
    if (property.address.area) parts.push(property.address.area);
    if (property.address.city) parts.push(property.address.city);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const handleCall = () => {
    const phoneNumber = property.builders?.[0]?.phoneNumber || property.builderPhone;
    if (!phoneNumber) return;
    const countryCode = property.builders?.[0]?.countryCode || '+91';
    Linking.openURL(`tel:${countryCode}${phoneNumber}`).catch(() => {
      Alert.alert('Error', 'Could not open phone app');
    });
  };

  const handleWhatsApp = () => {
    const phoneNumber = property.builders?.[0]?.phoneNumber || property.builderPhone;
    if (!phoneNumber) return;
    const countryCode = property.builders?.[0]?.countryCode || '+91';
    Linking.openURL(
      `whatsapp://send?phone=${countryCode.replace('+', '')}${phoneNumber}`,
    ).catch(() => Alert.alert('Error', 'WhatsApp not installed'));
  };

  const isCorner = (property as any).cornerProperty;
  const coverPhotoPath = property.coverPhotoPath;
  const coverIndex = property.coverPhotoIndex ?? 0;
  const coverPhoto = property.propertyPhotos?.[coverIndex] || property.propertyPhotos?.[0];
  const bhkInfo = property.bhk ? `${property.bhk} BHK` : null;
  const sizeInfo = getSizeInfo();
  const locationInfo = getLocationInfo();
  const hasPhone = !!(property.builders?.[0]?.phoneNumber || property.builderPhone);
  const displayPrice = getDisplayPrice();

  // "x BHK | 3500 sq ft"
  const detailParts = [bhkInfo, sizeInfo].filter(Boolean);
  const detailLine = detailParts.length > 0 ? detailParts.join('  |  ') : null;

  // "Property Type | ₹Price"
  const propertyName = property.propertyType || 'Property';
  const titleLine = displayPrice ? `${propertyName}  |  ${displayPrice}` : propertyName;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Thumbnail */}
      {(coverPhotoPath || coverPhoto) ? (
        <CachedImage
          storagePath={coverPhotoPath}
          bucket={coverPhotoPath ? 'property-photos' : undefined}
          uri={!coverPhotoPath ? coverPhoto : undefined}
          style={styles.thumbnail}
        />
      ) : (
        <View style={[styles.thumbnail, styles.placeholderThumb]}>
          <Ionicons name="image-outline" size={28} color="#555" />
        </View>
      )}

      {/* Right content area */}
      <View style={styles.content}>
        {/* Top section: info */}
        <View style={styles.infoSection}>
          {/* Category + corner + share row */}
          <View style={styles.topRow}>
            <View style={styles.badgeRow}>
              {property.propertyCategory ? (
                <Text style={styles.category}>{property.propertyCategory.toUpperCase()}</Text>
              ) : null}
              {isCorner && (
                <View style={styles.cornerBadge}>
                  <Text style={styles.cornerBadgeText}>CORNER</Text>
                </View>
              )}
            </View>
            {onShare && (
              <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
                <Ionicons name="share-social-outline" size={16} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Property type | Price */}
          <Text style={styles.titleLine} numberOfLines={1}>{titleLine}</Text>

          {/* BHK | size */}
          {detailLine && (
            <Text style={styles.detailLine} numberOfLines={1}>{detailLine}</Text>
          )}

          {/* Location */}
          {locationInfo && (
            <Text style={styles.detailLine} numberOfLines={1}>{locationInfo}</Text>
          )}
        </View>

        {/* Bottom row: buttons pinned bottom-right */}
        {hasPhone && (
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
              <Ionicons name="call-outline" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    height: 150,
  },
  thumbnail: {
    width: 140,
    height: '100%',
    backgroundColor: '#333',
    resizeMode: 'cover',
  },
  placeholderThumb: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  infoSection: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  category: {
    color: '#999',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  cornerBadge: {
    backgroundColor: 'rgba(255,180,0,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cornerBadgeText: {
    color: '#ffb400',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  shareBtn: {
    padding: 2,
  },
  titleLine: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 3,
  },
  detailLine: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  callBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    padding: 8,
  },
  whatsappBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    padding: 8,
  },
});
