import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Linking, Alert, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Property, FloorEntry } from '../types/property';
import FullscreenMediaViewer from './FullscreenMediaViewer';

const { width: CARD_WIDTH } = Dimensions.get('window');
const MEDIA_HEIGHT = 200;

interface PropertyCardProps {
  property: Property;
  onPress: () => void;
  onShare?: () => void;
}

export default function PropertyCard({ property, onPress, onShare }: PropertyCardProps) {
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [cardWidth, setCardWidth] = useState(CARD_WIDTH - 34); // default with 16px padding + 2px border

  const formatPrice = (price?: number, unit?: string) => {
    if (!price) return 'Price not set';
    if (unit === 'cr') {
      return `₹${price.toFixed(2)} Cr`;
    }
    if (unit === 'lakh_per_month') {
      return `₹${price.toFixed(1)} L/mo`;
    }
    return `₹${price.toFixed(2)} L`;
  };

  const getDisplayPrice = () => {
    if (property.floors && property.floors.length > 0) {
      const prices = property.floors.map(f => f.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const unit = property.floors[0].priceUnit;

      if (minPrice === maxPrice) {
        return formatPrice(minPrice, unit);
      }

      const unitLabel = unit === 'cr' ? 'Cr' : unit === 'lakh_per_month' ? 'L/mo' : 'L';
      return `₹${minPrice.toFixed(0)}-${maxPrice.toFixed(0)} ${unitLabel}`;
    }

    return formatPrice(property.price, property.priceUnit);
  };

  const handleCall = () => {
    const phoneNumber = property.builders?.[0]?.phoneNumber || property.builderPhone;
    if (phoneNumber) {
      const countryCode = property.builders?.[0]?.countryCode || '+91';
      const fullNumber = `${countryCode}${phoneNumber}`;
      Linking.openURL(`tel:${fullNumber}`).catch(() => {
        Alert.alert('Error', 'Could not open phone app');
      });
    } else {
      Alert.alert('No Phone Number', 'Builder phone number not available');
    }
  };

  const handleWhatsApp = () => {
    const phoneNumber = property.builders?.[0]?.phoneNumber || property.builderPhone;
    if (phoneNumber) {
      const countryCode = (property.builders?.[0]?.countryCode || '+91').replace('+', '');
      Linking.openURL(`https://wa.me/${countryCode}${phoneNumber}`).catch(() => {
        Alert.alert('Error', 'Could not open WhatsApp');
      });
    } else {
      Alert.alert('No Phone Number', 'Builder phone number not available');
    }
  };

  // Build combined media list for fullscreen viewer
  const photos = property.propertyPhotos || [];
  const videos = property.propertyVideos || [];
  const allMedia = [
    ...photos.map(uri => ({ type: 'photo' as const, uri })),
    ...videos.map(uri => ({ type: 'video' as const, uri })),
  ];
  const hasMedia = allMedia.length > 0;

  // Generate thumbnails for videos
  const [videoThumbs, setVideoThumbs] = useState<Record<number, string>>({});
  useEffect(() => {
    videos.forEach((videoUrl, index) => {
      if (!videoUrl || videoThumbs[index]) return;
      VideoThumbnails.getThumbnailAsync(videoUrl, { time: 1000 })
        .then(({ uri }) => setVideoThumbs(prev => ({ ...prev, [index]: uri })))
        .catch(() => {}); // silently fail — will show fallback icon
    });
  }, [videos]);

  const features = [];
  if (property.clubProperty) features.push('Club');
  if (property.poolProperty) features.push('Pool');
  if (property.parkProperty) features.push('Park');
  if (property.gatedProperty) features.push('Gated');

  const builderName = property.builders?.[0]?.name || property.builderName;
  const hasBuilder = builderName || property.builders?.[0]?.phoneNumber || property.builderPhone;

  const getInitials = (email?: string) => {
    if (!email) return '?';
    return email.charAt(0).toUpperCase();
  };

  const getFloorInfo = () => {
    if (property.floors && property.floors.length > 0) {
      return `${property.floors.length} floors`;
    }
    if (property.floor != null) {
      return `Floor ${property.floor}`;
    }
    return null;
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
      onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
    >
      {/* Media Carousel */}
      {hasMedia && (
        <View style={styles.mediaContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            style={styles.mediaScroll}
          >
            {/* Photos */}
            {photos.map((photo, index) => (
              <TouchableOpacity
                key={`photo-${index}`}
                activeOpacity={0.9}
                onPress={() => setFullscreenIndex(index)}
              >
                <Image source={{ uri: photo }} style={[styles.mediaItem, { width: cardWidth }]} />
              </TouchableOpacity>
            ))}
            {/* Videos */}
            {videos.map((video, index) => (
              <TouchableOpacity
                key={`video-${index}`}
                activeOpacity={0.9}
                style={[styles.videoThumb, { width: cardWidth }]}
                onPress={() => setFullscreenIndex(photos.length + index)}
              >
                {videoThumbs[index] ? (
                  <Image source={{ uri: videoThumbs[index] }} style={styles.videoThumbImage} />
                ) : (
                  <Ionicons name="videocam" size={28} color="#888" />
                )}
                <View style={styles.playOverlay}>
                  <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Media count badge */}
          {allMedia.length > 1 && (
            <View style={styles.mediaBadge}>
              <Ionicons name="images" size={12} color="#fff" />
              <Text style={styles.mediaBadgeText}>{allMedia.length}</Text>
            </View>
          )}

          {/* Share button */}
          {onShare && (
            <TouchableOpacity style={styles.shareButton} onPress={onShare}>
              <Ionicons name="share-social-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          {/* Category badge */}
          {property.propertyCategory && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{property.propertyCategory}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.type}>{property.propertyType || 'Property'}</Text>
            {getFloorInfo() && (
              <Text style={styles.floor}>{getFloorInfo()}</Text>
            )}
          </View>
          {property.userEmail && (
            <View style={styles.postedBy}>
              <Text style={styles.postedByLabel}>Posted by</Text>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(property.userEmail)}</Text>
                </View>
                <Text style={styles.userName} numberOfLines={1}>
                  {property.userEmail.split('@')[0]}
                </Text>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.price}>{getDisplayPrice()}</Text>

        {property.address && (property.address.sector || property.address.city) && (
          <Text style={styles.address} numberOfLines={1}>
            {property.address.sector}
            {property.address.sector && property.address.city && ', '}
            {property.address.city}
          </Text>
        )}

        {features.length > 0 && (
          <View style={styles.features}>
            {features.map((feature, index) => (
              <View key={index} style={styles.feature}>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomRow}>
          {property.latitude && property.longitude && (
            <View style={styles.locationBadge}>
              <Ionicons name="location" size={12} color="#4CAF50" />
              <Text style={styles.locationText}>Has location</Text>
            </View>
          )}

          {hasBuilder && (
            <View style={styles.callSection}>
              <Text style={styles.callLabel}>Call Builder</Text>
              <View style={styles.callButtons}>
                <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                  <Ionicons name="call" size={18} color="#4CAF50" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.callButton, styles.whatsappButton]} onPress={handleWhatsApp}>
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Fullscreen Media Viewer */}
      <FullscreenMediaViewer
        visible={fullscreenIndex !== null}
        media={allMedia}
        initialIndex={fullscreenIndex ?? 0}
        onClose={() => setFullscreenIndex(null)}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  mediaContainer: {
    position: 'relative',
  },
  mediaScroll: {
    height: MEDIA_HEIGHT,
  },
  mediaItem: {
    height: MEDIA_HEIGHT,
    backgroundColor: '#333',
  },
  videoThumb: {
    height: MEDIA_HEIGHT,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoThumbImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  mediaBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mediaBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  shareButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 11,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  type: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  floor: {
    color: '#999',
    fontSize: 14,
    marginTop: 2,
  },
  postedBy: {
    alignItems: 'flex-end',
  },
  postedByLabel: {
    color: '#666',
    fontSize: 10,
    marginBottom: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  userName: {
    color: '#999',
    fontSize: 12,
    maxWidth: 80,
  },
  price: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  address: {
    color: '#666',
    fontSize: 13,
    marginBottom: 12,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  feature: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featureText: {
    color: '#fff',
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: '#4CAF50',
    fontSize: 12,
  },
  callSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callLabel: {
    color: '#999',
    fontSize: 12,
  },
  callButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  callButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 8,
  },
  whatsappButton: {
    backgroundColor: 'rgba(37, 211, 102, 0.1)',
  },
});
