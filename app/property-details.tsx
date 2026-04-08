import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
  TouchableOpacity,
  Alert,
  Linking,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Property, FloorEntry, SIZE_UNITS } from '../types/property';
import * as VideoThumbnails from 'expo-video-thumbnails';
import api from '../lib/api';
import { useProperties } from '../contexts/PropertyContext';
import WhatsAppShareModal from '../components/property/WhatsAppShareModal';
import FullscreenMediaViewer from '../components/property/FullscreenMediaViewer';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import CachedImage from '../components/CachedImage';
import { getCachedImageForPath } from '../lib/imageCache';

const { width } = Dimensions.get('window');

export default function PropertyDetailsScreen() {
  const { propertyId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { properties: allProperties, removePropertyFromState } = useProperties();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [videoThumbs, setVideoThumbs] = useState<Record<number, string>>({});
  const [showMapModal, setShowMapModal] = useState(false);
  const [nearbyProperties, setNearbyProperties] = useState<Property[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  useEffect(() => {
    if (propertyId) {
      loadPropertyDetails();
    }
  }, [propertyId]);

  // Generate video thumbnails — resolve storage paths to local URIs first
  useEffect(() => {
    if (!property?.propertyVideos) return;
    property.propertyVideos.forEach((videoUrl, index) => {
      if (!videoUrl || videoThumbs[index]) return;
      const isStorage = !videoUrl.startsWith('file://') && !videoUrl.startsWith('http') && !videoUrl.startsWith('/');
      const resolveUri = isStorage
        ? getCachedImageForPath('property-videos', videoUrl)
        : Promise.resolve(videoUrl);
      resolveUri
        .then(localUri => {
          if (!localUri) return;
          return VideoThumbnails.getThumbnailAsync(localUri, { time: 1000 });
        })
        .then(result => {
          if (result?.uri) setVideoThumbs(prev => ({ ...prev, [index]: result.uri }));
        })
        .catch(() => {});
    });
  }, [property?.propertyVideos]);

  const loadPropertyDetails = async () => {
    // Try local state first (instant)
    const localProperty = allProperties.find(p => p.id === propertyId);
    if (localProperty) {
      setProperty(localProperty);
      setLoading(false);
      return;
    }

    // Fallback to API if not in local state (edge case)
    try {
      setLoading(true);
      const response = await api.get(`/properties/${propertyId}`);
      setProperty(response.data);
    } catch (error) {
      console.error('Error fetching property:', error);
      Alert.alert('Error', 'Failed to load property details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Property',
      'Are you sure you want to delete this property? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic: remove from local state immediately
            removePropertyFromState(propertyId as string);
            router.back();

            // Sync delete in background
            try {
              await api.delete(`/properties/${propertyId}`);
              console.log('Property deleted from server');
            } catch (error: any) {
              console.error('Failed to delete from server:', error);
              Alert.alert('Sync Issue', 'Property removed locally but failed to delete from server.');
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    router.push({
      pathname: '/(tabs)/add',
      params: { editPropertyId: propertyId as string },
    });
  };

  const handleCall = () => {
    const phoneNumber = property?.builders?.[0]?.phoneNumber || property?.builderPhone;
    if (phoneNumber) {
      const countryCode = property?.builders?.[0]?.countryCode || '+91';
      Linking.openURL(`tel:${countryCode}${phoneNumber}`);
    } else {
      Alert.alert('No Phone Number', 'Builder phone number not available');
    }
  };

  const handleWhatsApp = () => {
    const phoneNumber = property?.builders?.[0]?.phoneNumber || property?.builderPhone;
    if (phoneNumber) {
      const countryCode = (property?.builders?.[0]?.countryCode || '+91').replace('+', '');
      Linking.openURL(`https://wa.me/${countryCode}${phoneNumber}`);
    } else {
      Alert.alert('No Phone Number', 'Builder phone number not available');
    }
  };

  const formatPrice = (price?: number, unit?: string) => {
    if (!price) return 'Not specified';
    if (unit === 'cr') {
      return `₹${price.toFixed(2)} Cr`;
    }
    if (unit === 'lakh_per_month') {
      return `₹${price.toFixed(2)} Lakhs/month`;
    }
    return `₹${price.toFixed(2)} Lakhs`;
  };

  const formatFloorPrice = (floor: FloorEntry) => {
    return formatPrice(floor.price, floor.priceUnit);
  };

  const getSizeUnitLabel = (unit: string) => {
    const found = SIZE_UNITS.find(u => u.value === unit);
    return found?.label || unit;
  };

  const getSizeTypeLabel = (type: string) => {
    switch (type) {
      case 'carpet': return 'Carpet Area';
      case 'builtup': return 'Built-up Area';
      case 'superbuiltup': return 'Super Built-up Area';
      default: return type;
    }
  };

  const getInitials = (email?: string) => {
    if (!email) return '?';
    return email.charAt(0).toUpperCase();
  };

  const fetchNearbyProperties = () => {
    if (!property?.latitude || !property?.longitude) return;
    setLoadingNearby(true);
    try {
      // Use local state instead of API call
      const nearby = allProperties.filter(p => {
        if (!p.latitude || !p.longitude || p.id === property.id) return false;
        const dlat = p.latitude - property.latitude!;
        const dlng = p.longitude - property.longitude!;
        const dist = Math.sqrt(dlat * dlat + dlng * dlng);
        return dist < 0.05; // ~5km radius
      });
      setNearbyProperties(nearby);
    } catch (error) {
      console.log('Failed to compute nearby:', error);
    } finally {
      setLoadingNearby(false);
    }
  };

  const hasMultipleFloors = property?.floors && property.floors.length > 0 &&
    (property.propertyType === 'Builder Floor' || property.propertyType === 'Apartment Society');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Property not found</Text>
      </View>
    );
  }

  const features = [];
  if (property.clubProperty) features.push({ icon: 'fitness', text: 'Club' });
  if (property.poolProperty) features.push({ icon: 'water', text: 'Pool' });
  if (property.parkProperty) features.push({ icon: 'leaf', text: 'Park' });
  if (property.gatedProperty) features.push({ icon: 'lock-closed', text: 'Gated' });
  if ((property as any).cornerProperty) features.push({ icon: 'flag', text: 'Corner' });

  // Collect all builders for display
  const allBuilders: { name: string; phone: string | null }[] = [];
  if (property.builders && property.builders.length > 0) {
    property.builders.forEach(b => {
      if (b.name || b.phoneNumber) {
        allBuilders.push({ name: b.name || 'Unknown', phone: b.phoneNumber || null });
      }
    });
  } else if (property.builderName || property.builderPhone) {
    allBuilders.push({ name: property.builderName || 'Unknown', phone: property.builderPhone || null });
  }
  const hasBuilder = allBuilders.length > 0;

  // Combined media for fullscreen viewer
  const photos = property.propertyPhotos || [];
  const videos = property.propertyVideos || [];
  const isStoragePath = (p: string) => !p.startsWith('file://') && !p.startsWith('http') && !p.startsWith('/');
  const allMedia = [
    ...photos.map(photo => ({
      type: 'photo' as const,
      uri: photo,
      ...(isStoragePath(photo) ? { storagePath: photo, bucket: 'property-photos' } : {}),
    })),
    ...videos.map(video => ({
      type: 'video' as const,
      uri: video,
      ...(isStoragePath(video) ? { storagePath: video, bucket: 'property-videos' } : {}),
    })),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 100 }}
      >
        {/* Image Gallery — tap to fullscreen */}
        {photos.length > 0 && (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / width);
                setCurrentImageIndex(index);
              }}
              scrollEventThrottle={16}
            >
              {photos.map((photo, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.9}
                  onPress={() => setFullscreenIndex(index)}
                >
                  <CachedImage
                    storagePath={isStoragePath(photo) ? photo : undefined}
                    bucket={isStoragePath(photo) ? 'property-photos' : undefined}
                    uri={!isStoragePath(photo) ? photo : undefined}
                    style={styles.image}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            {photos.length > 1 && (
              <View style={styles.pagination}>
                {photos.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      currentImageIndex === index && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
            <TouchableOpacity
              style={styles.shareImageButton}
              onPress={() => setShowShareModal(true)}
            >
              <Ionicons name="share-social-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Videos — tap to fullscreen */}
        {videos.length > 0 && (
          <View style={styles.videoSection}>
            <Text style={styles.videoSectionTitle}>Videos ({videos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {videos.map((video, index) => (
                <TouchableOpacity
                  key={`video-${index}`}
                  style={styles.videoCard}
                  activeOpacity={0.8}
                  onPress={() => setFullscreenIndex(photos.length + index)}
                >
                  {videoThumbs[index] ? (
                    <CachedImage uri={videoThumbs[index]} style={styles.videoThumbImage} />
                  ) : (
                    <Ionicons name="videocam" size={24} color="#888" />
                  )}
                  <View style={styles.videoPlayIcon}>
                    <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={styles.videoLabel}>Video {index + 1}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Property Details */}
        <View style={styles.content}>
          {/* Header with Actions - NO DELETE ICON */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{property.propertyCategory || 'Property'}</Text>
              </View>
              <Text style={styles.propertyType}>{property.propertyType || 'Property'}</Text>
              
              {/* Show single price only if not multi-floor */}
              {!hasMultipleFloors && (
                <Text style={styles.price}>{formatPrice(property.price, property.priceUnit)}</Text>
              )}
              
              {/* Posted By */}
              {property.userEmail && (
                <View style={styles.postedBySection}>
                  <Text style={styles.postedByLabel}>Posted by</Text>
                  <View style={styles.userInfo}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(property.userEmail)}</Text>
                    </View>
                    <Text style={styles.userName}>{property.userEmail.split('@')[0]}</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => setShowShareModal(true)}>
                <Ionicons name="share-social" size={22} color="#4CAF50" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={handleEdit}>
                <Ionicons name="create-outline" size={22} color="#fff" />
              </TouchableOpacity>
              {/* DELETE ICON REMOVED FROM HERE */}
            </View>
          </View>

          {/* Floor Prices (for multi-floor properties) */}
          {hasMultipleFloors && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Floors & Pricing</Text>
              {property.floors!.map((floor, index) => (
                <View key={index} style={styles.floorItem}>
                  <View style={styles.floorInfo}>
                    <Text style={styles.floorNumber}>Floor {floor.floorNumber}</Text>
                    <Text style={styles.floorPrice}>{formatFloorPrice(floor)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Builder Section - all builders with inline buttons */}
          {hasBuilder && (
            <View style={styles.callBuilderSection}>
              <Text style={styles.builderLabel}>Builders</Text>
              {allBuilders.map((builder, idx) => (
                <View key={idx} style={styles.builderRow}>
                  <Text style={styles.builderName} numberOfLines={1}>{builder.name}</Text>
                  <View style={styles.builderActions}>
                    <TouchableOpacity
                      style={[styles.builderActionBtn, !builder.phone && styles.builderActionBtnDisabled]}
                      disabled={!builder.phone}
                      onPress={() => {
                        if (builder.phone) Linking.openURL(`tel:+91${builder.phone}`);
                      }}
                    >
                      <Ionicons name="call" size={16} color={builder.phone ? '#fff' : '#555'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.builderActionBtn, !builder.phone && styles.builderActionBtnDisabled]}
                      disabled={!builder.phone}
                      onPress={() => {
                        if (builder.phone) Linking.openURL(`https://wa.me/91${builder.phone}`);
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color={builder.phone ? '#fff' : '#555'} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Address */}
          {property.address && (property.address.unitNo || property.address.block || property.address.sector || property.address.area || property.address.city) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Address</Text>
              <View style={styles.addressCard}>
                {(property.address.unitNo || property.address.block) && (
                  <Text style={styles.addressLine}>
                    {property.address.unitNo && `${property.address.unitNo}`}
                    {property.address.unitNo && property.address.block && ', '}
                    {property.address.block && `Block ${property.address.block}`}
                  </Text>
                )}
                {property.address.sector && (
                  <Text style={styles.addressLine}>
                    Sector-{property.address.sector}
                  </Text>
                )}
                {(property.address.area || property.address.city) && (
                  <Text style={styles.addressLine}>
                    {property.address.area}
                    {property.address.area && property.address.city && ', '}
                    {property.address.city}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Size/Area */}
          {property.sizes && property.sizes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Size / Area</Text>
              <View style={styles.sizesGrid}>
                {property.sizes.map((size, index) => (
                  <View key={index} style={styles.sizeItem}>
                    <Text style={styles.sizeLabel}>{getSizeTypeLabel(size.type)}</Text>
                    <Text style={styles.sizeValue}>
                      {size.value} {getSizeUnitLabel(size.unit)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Features */}
          {features.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Features</Text>
              <View style={styles.featuresGrid}>
                {features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Ionicons name={feature.icon as any} size={24} color="#fff" />
                    <Text style={styles.featureText}>{feature.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Details Grid */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailsGrid}>
              {property.ageType && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Age Type</Text>
                  <Text style={styles.detailValue}>
                    {property.ageType === 'UnderConstruction' ? 'Under Construction' : property.ageType}
                  </Text>
                </View>
              )}
              {property.propertyAge != null && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Property Age</Text>
                  <Text style={styles.detailValue}>{property.propertyAge} years</Text>
                </View>
              )}
              {property.case && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Case Type</Text>
                  <Text style={styles.detailValue}>{property.case.replace(/_/g, ' ')}</Text>
                </View>
              )}
              {property.floor != null && !hasMultipleFloors && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Floor</Text>
                  <Text style={styles.detailValue}>{property.floor}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Payment Plan */}
          {property.paymentPlan && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Plan</Text>
              <View style={styles.paymentPlanCard}>
                <Text style={styles.paymentPlanText}>{property.paymentPlan}</Text>
              </View>
            </View>
          )}

          {/* Possession */}
          {(property.possessionMonth || property.possessionYear) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Possession</Text>
              <View style={styles.dateItem}>
                <Ionicons name="calendar-outline" size={20} color="#999" />
                <Text style={styles.dateValue}>
                  {property.possessionMonth && ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][property.possessionMonth - 1]}
                  {property.possessionMonth && property.possessionYear && ' '}
                  {property.possessionYear}
                </Text>
              </View>
            </View>
          )}

          {/* Important Files */}
          {property.importantFiles && property.importantFiles.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Important Files</Text>
              <View style={styles.filesList}>
                {property.importantFiles.map((file, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.fileItem}
                    onPress={() => {
                      const fileUrl = file.url;
                      if (fileUrl) {
                        Linking.openURL(fileUrl).catch(() => {
                          Alert.alert('Error', 'Could not open this file');
                        });
                      } else {
                        Alert.alert('Unavailable', 'File URL is not available');
                      }
                    }}
                  >
                    <Ionicons
                      name={file.mimeType?.includes('pdf') ? 'document-text' : 'image'}
                      size={20}
                      color="#4CAF50"
                    />
                    <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                    <Ionicons name="open-outline" size={18} color="#666" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Additional Notes */}
          {property.additionalNotes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Notes</Text>
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>{property.additionalNotes}</Text>
              </View>
            </View>
          )}

          {/* Location with Map Preview */}
          {property.latitude && property.longitude && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setShowMapModal(true)}
                style={styles.mapPreviewContainer}
              >
                {Platform.OS !== 'web' ? (
                  <MapView
                    style={styles.mapPreview}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={{
                      latitude: property.latitude,
                      longitude: property.longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    pointerEvents="none"
                  >
                    <Marker
                      coordinate={{
                        latitude: property.latitude,
                        longitude: property.longitude,
                      }}
                    />
                  </MapView>
                ) : (
                  <View style={[styles.mapPreview, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#222' }]}>
                    <Ionicons name="map" size={40} color="#666" />
                    <Text style={{ color: '#999', marginTop: 8, fontSize: 13 }}>Map preview (mobile only)</Text>
                  </View>
                )}
                <View style={styles.mapOverlayHint}>
                  <Ionicons name="expand" size={16} color="#fff" />
                  <Text style={styles.mapOverlayText}>Tap to expand</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.coordsText}>
                {property.latitude.toFixed(6)}, {property.longitude.toFixed(6)}
              </Text>
              <TouchableOpacity
                style={styles.getDirectionsBtn}
                onPress={() => {
                  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`);
                }}
              >
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.getDirectionsText}>Get Directions</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Action Buttons at Bottom */}
          <View style={styles.bottomActions}>
            <TouchableOpacity 
              style={styles.deleteActionButton}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.deleteActionText}>Delete Property</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Full Map Modal */}
      {property.latitude && property.longitude && (
        <Modal
          visible={showMapModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => { setShowMapModal(false); setNearbyProperties([]); }}
        >
          <View style={styles.mapModalContainer}>
            {Platform.OS !== 'web' ? (
              <MapView
                style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  latitude: property.latitude,
                  longitude: property.longitude,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: property.latitude,
                    longitude: property.longitude,
                  }}
                  pinColor="#ff4444"
                  title={property.propertyType || 'Property'}
                  description={formatPrice(property.price, property.priceUnit)}
                />
                {nearbyProperties.map(np => (
                  <Marker
                    key={np.id}
                    coordinate={{
                      latitude: np.latitude!,
                      longitude: np.longitude!,
                    }}
                    pinColor="#4CAF50"
                    title={np.propertyType || 'Property'}
                    description={formatPrice(np.price, np.priceUnit)}
                    onCalloutPress={() => {
                      setShowMapModal(false);
                      setNearbyProperties([]);
                      router.push({ pathname: '/property-details', params: { propertyId: np.id } });
                    }}
                  />
                ))}
              </MapView>
            ) : (
              <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' }]}>
                <Ionicons name="map" size={64} color="#666" />
                <Text style={{ color: '#999', marginTop: 12 }}>Map available on mobile</Text>
              </View>
            )}

            {/* Close button */}
            <TouchableOpacity
              style={styles.mapCloseBtn}
              onPress={() => { setShowMapModal(false); setNearbyProperties([]); }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>

            {/* Show Nearby Properties button */}
            <View style={styles.mapBottomBar}>
              {nearbyProperties.length > 0 ? (
                <Text style={styles.nearbyCountText}>
                  {nearbyProperties.length} nearby {nearbyProperties.length === 1 ? 'property' : 'properties'}
                </Text>
              ) : (
                <TouchableOpacity
                  style={styles.nearbyBtn}
                  onPress={fetchNearbyProperties}
                  disabled={loadingNearby}
                >
                  {loadingNearby ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="locate" size={18} color="#fff" />
                      <Text style={styles.nearbyBtnText}>Show Nearby Properties</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* WhatsApp Share Modal */}
      <WhatsAppShareModal
        visible={showShareModal}
        property={property}
        onClose={() => setShowShareModal(false)}
      />

      {/* Fullscreen Media Viewer */}
      <FullscreenMediaViewer
        visible={fullscreenIndex !== null}
        media={allMedia}
        initialIndex={fullscreenIndex ?? 0}
        onClose={() => setFullscreenIndex(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0c0c0c',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  image: {
    width: width,
    height: 300,
    backgroundColor: '#333',
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    backgroundColor: '#fff',
  },
  shareImageButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 10,
  },
  soldOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#ff4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  soldOverlayText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  videoSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
  },
  videoSectionTitle: {
    color: '#999',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  videoCard: {
    width: 120,
    height: 80,
    backgroundColor: '#222',
    borderRadius: 10,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoThumbImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  videoPlayIcon: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
  },
  videoLabel: {
    position: 'absolute',
    bottom: 6,
    color: '#aaa',
    fontSize: 11,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: '#333',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  propertyType: {
    color: '#999',
    fontSize: 16,
    marginBottom: 4,
  },
  price: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  postedBySection: {
    marginTop: 12,
  },
  postedByLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 6,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  userName: {
    color: '#fff',
    fontSize: 14,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  // Floor items
  floorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  floorInfo: {
    flex: 1,
  },
  floorNumber: {
    color: '#999',
    fontSize: 14,
    marginBottom: 4,
  },
  floorPrice: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  soldBadge: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  soldBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  markSoldButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  markSoldText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  // Builder section
  callBuilderSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  builderLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 10,
  },
  builderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
  },
  builderName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  builderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  builderActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  builderActionBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    opacity: 0.4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  // Address
  addressCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  addressLine: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  // Sizes
  sizesGrid: {
    gap: 12,
  },
  sizeItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sizeLabel: {
    color: '#999',
    fontSize: 14,
  },
  sizeValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  featureText: {
    color: '#fff',
    fontSize: 16,
  },
  detailsGrid: {
    gap: 12,
  },
  detailItem: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: '#999',
    fontSize: 14,
  },
  detailValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentPlanCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  paymentPlanText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  dateValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  filesList: {
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  fileName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  notesCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
  },
  notesText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
  },
  mapPreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  mapPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  mapOverlayHint: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  mapOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  coordsText: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 8,
  },
  getDirectionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 8,
  },
  getDirectionsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Full map modal
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  mapBottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  nearbyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(30,30,30,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
  },
  nearbyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  nearbyCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: 'rgba(30,30,30,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
  },
  // Bottom action buttons
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  soldActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
  },
  soldActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff4444',
    borderRadius: 12,
    padding: 16,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
