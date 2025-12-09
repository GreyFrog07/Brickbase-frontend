import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  Share,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../types/property';
import { File, Paths } from 'expo-file-system/next';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as Sharing from 'expo-sharing';

// Try to import react-native-share for multi-file sharing (requires dev build)
let RNShare: any = null;
try {
  RNShare = require('react-native-share').default;
} catch (e) {
  // Not available in Expo Go, will use fallback
}

const { width, height } = Dimensions.get('window');
const PHOTO_HEIGHT = height * 0.28;

interface WhatsAppShareModalProps {
  visible: boolean;
  property: Property;
  onClose: () => void;
}

interface FieldOption {
  key: string;
  label: string;
  value: string;
  selected: boolean;
}

export default function WhatsAppShareModal({ visible, property, onClose }: WhatsAppShareModalProps) {
  const [selectedPhotos, setSelectedPhotos] = useState<boolean[]>(
    property.propertyPhotos?.map(() => true) || []
  );
  const [selectedVideos, setSelectedVideos] = useState<boolean[]>(
    property.propertyVideos?.map(() => true) || []
  );
  const [videoThumbs, setVideoThumbs] = useState<Record<number, string>>({});
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  // Build field options from property data
  const buildFieldOptions = useCallback((): FieldOption[] => {
    const fields: FieldOption[] = [];

    if (property.propertyType) {
      fields.push({ key: 'propertyType', label: 'Property Type', value: property.propertyType, selected: true });
    }

    if (property.price) {
      const priceStr = property.priceUnit === 'cr'
        ? `₹${property.price.toFixed(2)} Cr`
        : `₹${property.price.toFixed(2)} Lakhs`;
      fields.push({ key: 'price', label: 'Price', value: priceStr, selected: true });
    }

    if (property.floor) {
      fields.push({ key: 'floor', label: 'Floor', value: String(property.floor), selected: true });
    }

    if (property.propertyAge) {
      fields.push({ key: 'propertyAge', label: 'Property Age', value: `${property.propertyAge} years`, selected: true });
    }

    if (property.case) {
      fields.push({ key: 'case', label: 'Case Type', value: property.case.replace('_', ' '), selected: true });
    }

    if (property.paymentPlan) {
      fields.push({ key: 'paymentPlan', label: 'Payment Plan', value: property.paymentPlan, selected: true });
    }

    if (property.possessionDate) {
      fields.push({ key: 'possessionDate', label: 'Possession Date', value: property.possessionDate, selected: true });
    }

    if (property.handoverDate) {
      fields.push({ key: 'handoverDate', label: 'Handover Date', value: property.handoverDate, selected: true });
    }

    const features: string[] = [];
    if (property.clubProperty) features.push('Club');
    if (property.poolProperty) features.push('Pool');
    if (property.parkProperty) features.push('Park');
    if (property.gatedProperty) features.push('Gated Community');

    if (features.length > 0) {
      fields.push({ key: 'features', label: 'Features', value: features.join(', '), selected: true });
    }

    if (property.additionalNotes) {
      fields.push({ key: 'additionalNotes', label: 'Additional Notes', value: property.additionalNotes, selected: true });
    }

    return fields;
  }, [property]);

  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>(buildFieldOptions());

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedPhotos(property.propertyPhotos?.map(() => true) || []);
      setSelectedVideos(property.propertyVideos?.map(() => true) || []);
      setFieldOptions(buildFieldOptions());
      setVideoThumbs({});
    }
  }, [visible, property, buildFieldOptions]);

  // Generate video thumbnails
  useEffect(() => {
    if (!visible || !property.propertyVideos) return;
    property.propertyVideos.forEach((videoUrl, index) => {
      if (!videoUrl || videoThumbs[index]) return;
      VideoThumbnails.getThumbnailAsync(videoUrl, { time: 1000 })
        .then(({ uri }) => setVideoThumbs(prev => ({ ...prev, [index]: uri })))
        .catch(() => {});
    });
  }, [visible, property.propertyVideos]);

  const togglePhoto = (index: number) => {
    const newSelected = [...selectedPhotos];
    newSelected[index] = !newSelected[index];
    setSelectedPhotos(newSelected);
  };

  const toggleVideo = (index: number) => {
    const newSelected = [...selectedVideos];
    newSelected[index] = !newSelected[index];
    setSelectedVideos(newSelected);
  };

  const toggleField = (key: string) => {
    setFieldOptions(prev =>
      prev.map(field =>
        field.key === key ? { ...field, selected: !field.selected } : field
      )
    );
  };

  const generateShareText = () => {
    const selectedFields = fieldOptions.filter(f => f.selected);
    let text = '🏠 *Property Details*\n\n';

    selectedFields.forEach(field => {
      text += `*${field.label}:* ${field.value}\n`;
    });

    return text;
  };

  // Download a media URL to a local cache file for sharing
  const downloadMediaToCache = async (
    url: string, index: number, type: 'photo' | 'video'
  ): Promise<string> => {
    try {
      const ext = type === 'video' ? 'mp4' : 'jpg';
      const filename = `property_${type}_${Date.now()}_${index}.${ext}`;
      const cacheFile = new File(Paths.cache, filename);

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      await cacheFile.write(bytes);
      return cacheFile.uri;
    } catch (error) {
      console.error(`Error downloading ${type} for share:`, error);
      throw error;
    }
  };

  // Clean up temporary files
  const cleanupFiles = async (fileUris: string[]) => {
    for (const fileUri of fileUris) {
      try {
        const filename = fileUri.split('/').pop();
        if (filename) {
          const file = new File(Paths.cache, filename);
          await file.delete();
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    let fileUris: string[] = [];

    try {
      const shareText = generateShareText();
      const chosenPhotos = property.propertyPhotos?.filter((_, i) => selectedPhotos[i]) || [];
      const chosenVideos = property.propertyVideos?.filter((_, i) => selectedVideos[i]) || [];
      const hasMedia = chosenPhotos.length > 0 || chosenVideos.length > 0;
      const hasText = fieldOptions.some(f => f.selected);

      if (Platform.OS === 'web') {
        await Share.share({ message: shareText });
        onClose();
        return;
      }

      if (hasMedia) {
        // Download all selected media to cache
        const photoFiles = await Promise.all(
          chosenPhotos.map((url, i) => downloadMediaToCache(url, i, 'photo'))
        );
        const videoFiles = await Promise.all(
          chosenVideos.map((url, i) => downloadMediaToCache(url, i, 'video'))
        );
        fileUris = [...photoFiles, ...videoFiles];
      }

      if (RNShare) {
        // ── Native build: single share popup ──
        // Media + text as caption in one go, or text-only if no media
        try {
          if (fileUris.length > 0) {
            await RNShare.open({
              urls: fileUris,
              message: hasText ? shareText : undefined,
            });
          } else if (hasText) {
            await Share.share({ message: shareText });
          }
        } catch (err: any) {
          if (err.message !== 'User did not share') throw err;
        }
      } else {
        // ── Expo Go fallback: max 2 popups ──
        if (hasText) {
          await Share.share({ message: shareText });
        }
        if (fileUris.length > 0) {
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            const firstFile = fileUris[0];
            const isVideo = firstFile.includes('_video_');
            await Sharing.shareAsync(firstFile, {
              mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
            });
            if (fileUris.length > 1) {
              Alert.alert(
                'Expo Go Limitation',
                `Only the first file was shared. Use a native dev build to share all ${fileUris.length} files at once.`
              );
            }
          }
        }
      }

      onClose();
    } catch (error: any) {
      console.error('Error sharing:', error);
      if (error.message !== 'User did not share' && !error.message?.includes('cancel')) {
        Alert.alert('Error', 'Failed to share. Please try again.');
      }
    } finally {
      setIsSharing(false);

      if (fileUris.length > 0) {
        setTimeout(() => cleanupFiles(fileUris), 5000);
      }
    }
  };

  const photos = property.propertyPhotos || [];
  const videos = property.propertyVideos || [];
  const selectedPhotosCount = selectedPhotos.filter(Boolean).length;
  const selectedVideosCount = selectedVideos.filter(Boolean).length;
  const selectedFieldsCount = fieldOptions.filter(f => f.selected).length;

  // Build summary parts
  const summaryParts: string[] = [];
  if (photos.length > 0) summaryParts.push(`${selectedPhotosCount} photo(s)`);
  if (videos.length > 0) summaryParts.push(`${selectedVideosCount} video(s)`);
  summaryParts.push(`${selectedFieldsCount} field(s)`);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share to WhatsApp</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Selection Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {summaryParts.join(' \u2022 ')} selected
          </Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Photos Section */}
          {photos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Photos (tap to select/deselect)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photoScroll}
              >
                {photos.map((photo, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.photoContainer,
                      selectedPhotos[index] && styles.mediaSelected,
                    ]}
                    onPress={() => togglePhoto(index)}
                    onLongPress={() => setPreviewPhoto(photo)}
                    delayLongPress={500}
                  >
                    <Image source={{ uri: photo }} style={styles.photo} />
                    {selectedPhotos[index] && (
                      <View style={styles.checkmark}>
                        <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                      </View>
                    )}
                    {!selectedPhotos[index] && (
                      <View style={styles.mediaOverlay} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.photoHint}>Long press to preview</Text>
            </View>
          )}

          {/* Videos Section */}
          {videos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Videos (tap to select/deselect)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photoScroll}
              >
                {videos.map((video, index) => (
                  <TouchableOpacity
                    key={`video-${index}`}
                    style={[
                      styles.videoContainer,
                      selectedVideos[index] && styles.mediaSelected,
                    ]}
                    onPress={() => toggleVideo(index)}
                  >
                    {videoThumbs[index] ? (
                      <Image source={{ uri: videoThumbs[index] }} style={styles.photo} />
                    ) : (
                      <View style={styles.videoPlaceholder}>
                        <Ionicons name="videocam" size={28} color="#888" />
                      </View>
                    )}
                    <View style={styles.videoIconBadge}>
                      <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.9)" />
                    </View>
                    <Text style={styles.videoIndexLabel}>Video {index + 1}</Text>
                    {selectedVideos[index] && (
                      <View style={styles.checkmark}>
                        <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                      </View>
                    )}
                    {!selectedVideos[index] && (
                      <View style={styles.mediaOverlay} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Fields Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Property Details</Text>
            {fieldOptions.map((field) => (
              <TouchableOpacity
                key={field.key}
                style={[
                  styles.fieldItem,
                  field.selected && styles.fieldItemSelected,
                ]}
                onPress={() => toggleField(field.key)}
              >
                <View style={styles.fieldInfo}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldValue} numberOfLines={2}>{field.value}</Text>
                </View>
                <Ionicons
                  name={field.selected ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={field.selected ? '#4CAF50' : '#666'}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Bottom Padding */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Share Button */}
        <TouchableOpacity
          style={[styles.shareButton, isSharing && styles.shareButtonDisabled]}
          onPress={handleShare}
          disabled={isSharing}
        >
          {isSharing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="arrow-forward" size={24} color="#fff" />
          )}
        </TouchableOpacity>

        {/* Photo Preview Modal */}
        <Modal
          visible={!!previewPhoto}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewPhoto(null)}
        >
          <TouchableOpacity
            style={styles.previewOverlay}
            activeOpacity={1}
            onPress={() => setPreviewPhoto(null)}
          >
            {previewPhoto && (
              <Image
                source={{ uri: previewPhoto }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={styles.previewClose}
              onPress={() => setPreviewPhoto(null)}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  summary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
  },
  summaryText: {
    color: '#999',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  photoScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  photoContainer: {
    width: width * 0.6,
    height: PHOTO_HEIGHT,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  videoContainer: {
    width: width * 0.4,
    height: PHOTO_HEIGHT * 0.7,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaSelected: {
    borderColor: '#4CAF50',
  },
  photo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  videoIconBadge: {
    position: 'absolute',
    alignSelf: 'center',
  },
  videoIndexLabel: {
    position: 'absolute',
    bottom: 6,
    color: '#ccc',
    fontSize: 11,
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  photoHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  fieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  fieldItemSelected: {
    borderColor: '#4CAF50',
  },
  fieldInfo: {
    flex: 1,
    marginRight: 12,
  },
  fieldLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  fieldValue: {
    color: '#fff',
    fontSize: 14,
  },
  shareButton: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  shareButtonDisabled: {
    opacity: 0.7,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: width * 0.9,
    height: height * 0.7,
  },
  previewClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 8,
  },
});
