import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Modal,
  FlatList,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useVideoPlayer, VideoView } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import {
  PropertyCategory,
  PropertyType,
  CaseType,
  AgeType,
  PriceUnit,
  SizeUnit,
  BuilderInfo,
  FloorEntry,
  SizeEntry,
  AddressInfo,
  ImportantFile,
  Property,
  RESIDENTIAL_PROPERTY_TYPES,
  COMMERCIAL_PROPERTY_TYPES,
  CASE_TYPES,
  AGE_TYPES,
  SIZE_UNITS,
  MONTHS,
} from '../../types/property';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import api from '../../lib/api';
import { setNewPropertyAdded } from '../../lib/cache';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_CONTENT_WIDTH = 500;

const COUNTRY_CODES = ['+91', '+1', '+44', '+971'];

// Generate years from current year to 2075
const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y <= 2075; y++) {
    years.push(y);
  }
  return years;
};
const YEARS = generateYears();

interface PhotoData {
  uri: string;
  base64?: string;
  location?: Location.LocationObject;
}

interface VideoData {
  uri: string;
  base64?: string;
  thumbnail?: string;
}

// Separate component for fullscreen video player using expo-video
function FullscreenVideoItem({ uri, index, total, isActive }: { uri: string; index: number; total: number; isActive: boolean }) {
  const player = useVideoPlayer(uri, player => {
    player.loop = false;
    if (isActive) {
      player.play();
    }
  });
  
  React.useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);
  
  return (
    <View style={{ width: SCREEN_WIDTH, justifyContent: 'center', alignItems: 'center' }}>
      <VideoView
        player={player}
        style={{ width: SCREEN_WIDTH, height: '80%' }}
        allowsPictureInPicture
        nativeControls={true}
      />
      <View style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', gap: 16 }}>
        <Text style={{ color: '#fff', fontSize: 16 }}>
          {index + 1} / {total}
        </Text>
      </View>
    </View>
  );
}

export default function AddPropertyScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const editPropertyId = params.editPropertyId as string | undefined;
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Media Gallery Modal State
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [mediaGalleryTab, setMediaGalleryTab] = useState<'photos' | 'videos'>('photos');
  const [fullscreenMedia, setFullscreenMedia] = useState<{ type: 'photo' | 'video'; index: number } | null>(null);
  const [coverPhotoIndex, setCoverPhotoIndex] = useState<number>(0);
  
  // Form state - in order
  const [propertyCategory, setPropertyCategory] = useState<PropertyCategory | ''>('');
  const [propertyType, setPropertyType] = useState<PropertyType | ''>('');
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [photosWithoutLocation, setPhotosWithoutLocation] = useState<number>(0);
  const [builders, setBuilders] = useState<BuilderInfo[]>([{ name: '', phoneNumber: '', countryCode: '+91' }]);
  const [caseType, setCaseType] = useState<CaseType | ''>('');
  
  // Floor entries (for Builder Floor and Apartment Society)
  const [floors, setFloors] = useState<FloorEntry[]>([{ tower: '', floorNumber: 0, price: 0, priceUnit: 'cr' }]);
  
  // Only Apartment Society needs the tower field
  const showTowerField = propertyCategory === 'Residential' && propertyType === 'Apartment Society';
  
  // Single price for other property types
  const [price, setPrice] = useState('');
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('cr');
  
  // Address
  const [address, setAddress] = useState<AddressInfo>({
    unitNo: '',
    block: '',
    sector: '',
    city: '',
  });
  
  // Size/Area
  const [sizes, setSizes] = useState<SizeEntry[]>([]);
  
  // Age Type
  const [ageType, setAgeType] = useState<AgeType | ''>('');
  const [propertyAge, setPropertyAge] = useState('');
  
  // Possession Time
  const [possessionMonth, setPossessionMonth] = useState<number | null>(null);
  const [possessionYear, setPossessionYear] = useState<number | null>(null);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  
  // Important Files
  const [importantFiles, setImportantFiles] = useState<ImportantFile[]>([]);
  
  // Other fields
  const [paymentPlan, setPaymentPlan] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [clubProperty, setClubProperty] = useState(false);
  const [poolProperty, setPoolProperty] = useState(false);
  const [parkProperty, setParkProperty] = useState(false);
  const [gatedProperty, setGatedProperty] = useState(false);
  
  // Dropdowns
  const [showPriceDropdown, setShowPriceDropdown] = useState(false);
  const [activeFloorDropdown, setActiveFloorDropdown] = useState<number | null>(null);
  const [showSizeUnitDropdown, setShowSizeUnitDropdown] = useState<number | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form draft cache key
  const FORM_DRAFT_KEY = 'add_property_draft';

  // Get property types based on category
  const getPropertyTypes = (): PropertyType[] => {
    if (propertyCategory === 'Residential') {
      return RESIDENTIAL_PROPERTY_TYPES;
    } else if (propertyCategory === 'Commercial') {
      return COMMERCIAL_PROPERTY_TYPES;
    }
    return [];
  };

  // Check if property type needs multiple floors
  const needsMultipleFloors = (propertyCategory === 'Residential' && 
    (propertyType === 'Builder Floor' || propertyType === 'Apartment Society')) ||
    (propertyCategory === 'Commercial' && propertyType === 'SCO');

  // Get available price units based on case type
  const getAvailablePriceUnits = (): { label: string; value: PriceUnit }[] => {
    if (caseType === 'RENTAL') {
      return [{ label: 'Lakh/month', value: 'lakh_per_month' }];
    }
    // Only Cr for non-rental
    return [{ label: 'Cr', value: 'cr' }];
  };

  // Save form draft to cache
  const saveFormDraft = useCallback(async () => {
    if (isEditMode) return; // Don't save drafts in edit mode
    
    try {
      const draft = {
        propertyCategory,
        propertyType,
        photos: photos.map(p => ({ uri: p.uri, base64: p.base64 })), // Exclude location object
        videos: videos.map(v => ({ uri: v.uri, base64: v.base64 })),
        coverPhotoIndex,
        builders,
        caseType,
        floors,
        price,
        priceUnit,
        address,
        sizes,
        ageType,
        propertyAge,
        possessionMonth,
        possessionYear,
        importantFiles,
        paymentPlan,
        additionalNotes,
        clubProperty,
        poolProperty,
        parkProperty,
        gatedProperty,
      };
      await AsyncStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(draft));
    } catch (error) {
      console.log('Error saving form draft:', error);
    }
  }, [propertyCategory, propertyType, photos, videos, coverPhotoIndex, builders, caseType, floors, price, priceUnit, 
      address, sizes, ageType, propertyAge, possessionMonth, possessionYear, importantFiles, 
      paymentPlan, additionalNotes, clubProperty, poolProperty, parkProperty, gatedProperty, isEditMode]);

  // Load form draft from cache
  const loadFormDraft = useCallback(async () => {
    try {
      const draftStr = await AsyncStorage.getItem(FORM_DRAFT_KEY);
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (draft.propertyCategory) setPropertyCategory(draft.propertyCategory);
        if (draft.propertyType) setPropertyType(draft.propertyType);
        if (draft.photos?.length) setPhotos(draft.photos);
        if (draft.videos?.length) setVideos(draft.videos);
        if (draft.coverPhotoIndex !== undefined) setCoverPhotoIndex(draft.coverPhotoIndex);
        if (draft.builders?.length) setBuilders(draft.builders);
        if (draft.caseType) setCaseType(draft.caseType);
        if (draft.floors?.length) setFloors(draft.floors);
        if (draft.price) setPrice(draft.price);
        if (draft.priceUnit) setPriceUnit(draft.priceUnit);
        if (draft.address) setAddress(draft.address);
        if (draft.sizes?.length) setSizes(draft.sizes);
        if (draft.ageType) setAgeType(draft.ageType);
        if (draft.propertyAge) setPropertyAge(draft.propertyAge);
        if (draft.possessionMonth) setPossessionMonth(draft.possessionMonth);
        if (draft.possessionYear) setPossessionYear(draft.possessionYear);
        if (draft.importantFiles?.length) setImportantFiles(draft.importantFiles);
        if (draft.paymentPlan) setPaymentPlan(draft.paymentPlan);
        if (draft.additionalNotes) setAdditionalNotes(draft.additionalNotes);
        setClubProperty(draft.clubProperty || false);
        setPoolProperty(draft.poolProperty || false);
        setParkProperty(draft.parkProperty || false);
        setGatedProperty(draft.gatedProperty || false);
      }
    } catch (error) {
      console.log('Error loading form draft:', error);
    }
  }, []);

  // Clear form draft
  const clearFormDraft = async () => {
    try {
      await AsyncStorage.removeItem(FORM_DRAFT_KEY);
    } catch (error) {
      console.log('Error clearing form draft:', error);
    }
  };

  // Manual refresh - clears form and draft
  const handleRefresh = () => {
    Alert.alert(
      'Clear Form?',
      'This will clear all entered data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            await clearFormDraft();
            resetForm();
          }
        },
      ]
    );
  };

  // Load draft on mount (only if not editing)
  useEffect(() => {
    if (!editPropertyId) {
      loadFormDraft();
    }
  }, [editPropertyId, loadFormDraft]);

  // Auto-save draft when form changes
  useEffect(() => {
    const timer = setTimeout(() => {
      saveFormDraft();
    }, 1000); // Debounce 1 second
    
    return () => clearTimeout(timer);
  }, [saveFormDraft]);

  // Update price unit when case type changes
  useEffect(() => {
    if (caseType === 'RENTAL') {
      setPriceUnit('lakh_per_month');
      setFloors(prev => prev.map(f => ({ ...f, priceUnit: 'lakh_per_month' })));
    } else {
      setPriceUnit('cr');
      setFloors(prev => prev.map(f => ({ ...f, priceUnit: 'cr' })));
    }
  }, [caseType]);

  // Load property for editing
  useEffect(() => {
    if (editPropertyId) {
      loadPropertyForEdit(editPropertyId);
    }
  }, [editPropertyId]);

  const loadPropertyForEdit = async (id: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/properties/${id}`);
      const property: Property = response.data;
      
      setIsEditMode(true);
      setPropertyCategory(property.propertyCategory || '');
      setPropertyType(property.propertyType || '');
      setCaseType(property.case || '');
      setAgeType(property.ageType || '');
      
      if (property.floors && property.floors.length > 0) {
        setFloors(property.floors);
      } else if (property.floor) {
        setFloors([{ 
          floorNumber: property.floor, 
          price: property.price || 0, 
          priceUnit: property.priceUnit || 'cr' 
        }]);
      }
      
      setPrice(property.price?.toString() || '');
      setPriceUnit(property.priceUnit || 'cr');
      
      if (property.builders && property.builders.length > 0) {
        setBuilders(property.builders);
      } else if (property.builderName) {
        setBuilders([{
          name: property.builderName,
          phoneNumber: property.builderPhone || '',
          countryCode: '+91'
        }]);
      }
      
      setAddress(property.address || { unitNo: '', block: '', sector: '', city: '' });
      setSizes(property.sizes || []);
      setPossessionMonth(property.possessionMonth || null);
      setPossessionYear(property.possessionYear || null);
      setImportantFiles(property.importantFiles || []);
      setPaymentPlan(property.paymentPlan || '');
      setAdditionalNotes(property.additionalNotes || '');
      setClubProperty(property.clubProperty);
      setPoolProperty(property.poolProperty);
      setParkProperty(property.parkProperty);
      setGatedProperty(property.gatedProperty);
      setPropertyAge(property.propertyAge?.toString() || '');
      
      // Load cover photo index
      setCoverPhotoIndex(property.coverPhotoIndex ?? 0);

      // Load photos
      if (property.propertyPhotos && property.propertyPhotos.length > 0) {
        const loadedPhotos: PhotoData[] = property.propertyPhotos.map(photo => ({
          uri: photo,
          base64: undefined,
          location: property.latitude && property.longitude ? {
            coords: {
              latitude: property.latitude,
              longitude: property.longitude,
              altitude: null,
              accuracy: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as Location.LocationObject : undefined,
        }));
        setPhotos(loadedPhotos);
      }

      // Load videos
      if (property.propertyVideos && property.propertyVideos.length > 0) {
        const loadedVideos: VideoData[] = property.propertyVideos.map(video => ({
          uri: video,
          base64: undefined,
          thumbnail: undefined,
        }));
        setVideos(loadedVideos);
      }
    } catch (error) {
      console.error('Error loading property:', error);
      Alert.alert('Error', 'Failed to load property for editing');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPropertyCategory('');
    setPropertyType('');
    setCaseType('');
    setAgeType('');
    setPhotos([]);
    setVideos([]);
    setCoverPhotoIndex(0);
    setPhotosWithoutLocation(0);
    setFloors([{ tower: '', floorNumber: 0, price: 0, priceUnit: 'cr' }]);
    setPrice('');
    setPriceUnit('cr');
    setBuilders([{ name: '', phoneNumber: '', countryCode: '+91' }]);
    setAddress({ unitNo: '', block: '', sector: '', city: '' });
    setSizes([]);
    setPossessionMonth(null);
    setPossessionYear(null);
    setImportantFiles([]);
    setPaymentPlan('');
    setAdditionalNotes('');
    setClubProperty(false);
    setPoolProperty(false);
    setParkProperty(false);
    setGatedProperty(false);
    setPropertyAge('');
    setIsEditMode(false);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!propertyCategory) {
      newErrors.propertyCategory = 'Property category is required';
    }

    if (!propertyType) {
      newErrors.propertyType = 'Property type is required';
    }

    if (photos.length === 0) {
      newErrors.photos = 'At least one property photo is required';
    }

    // Validate builder phone numbers
    builders.forEach((builder, index) => {
      if (builder.phoneNumber && builder.phoneNumber.length > 0 && builder.phoneNumber.length < 10) {
        newErrors[`builderPhone_${index}`] = 'Phone number should be at least 10 digits';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
    
    return { cameraStatus, mediaStatus, locationStatus };
  };

  const takePicture = async () => {
    const permissions = await requestPermissions();
    
    if (permissions.cameraStatus !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to take photos');
      return;
    }

    if (permissions.locationStatus !== 'granted') {
      Alert.alert('Location Permission', 'Location permission is required to tag photos with GPS coordinates for map display');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      allowsEditing: false,  // No forced cropping
      quality: 0.8,
      base64: true,
      exif: true,  // Get EXIF data including GPS
    });

    if (!result.canceled && result.assets[0]) {
      let location = undefined;
      try {
        location = await Location.getCurrentPositionAsync({});
      } catch (error) {
        console.log('Could not get location');
      }

      const newPhoto: PhotoData = {
        uri: result.assets[0].uri,
        // base64: result.assets[0].base64,
        location,
      };

      setPhotos(prev => [...prev, newPhoto]);
      
      // Clear validation error when photo is added
      if (errors.photos) {
        setErrors(prev => ({ ...prev, photos: '' }));
      }
      
      if (!location) {
        setPhotosWithoutLocation(prev => prev + 1);
      }
    }
  };

  const extractGPSFromExif = (exif: any): { latitude: number; longitude: number } | null => {
    if (!exif) return null;
    
    if (typeof exif.GPSLatitude === 'number' && typeof exif.GPSLongitude === 'number') {
      let lat = exif.GPSLatitude;
      let lng = exif.GPSLongitude;
      
      if (exif.GPSLatitudeRef === 'S') lat = -lat;
      if (exif.GPSLongitudeRef === 'W') lng = -lng;
      
      if (lat !== 0 || lng !== 0) {
        return { latitude: lat, longitude: lng };
      }
    }
    
    if (Array.isArray(exif.GPSLatitude) && Array.isArray(exif.GPSLongitude)) {
      const convertDMSToDecimal = (dms: number[], ref: string): number => {
        let decimal = dms[0] + (dms[1] / 60) + (dms[2] / 3600);
        if (ref === 'S' || ref === 'W') decimal = -decimal;
        return decimal;
      };
      
      const lat = convertDMSToDecimal(exif.GPSLatitude, exif.GPSLatitudeRef || 'N');
      const lng = convertDMSToDecimal(exif.GPSLongitude, exif.GPSLongitudeRef || 'E');
      
      if (lat !== 0 || lng !== 0) {
        return { latitude: lat, longitude: lng };
      }
    }
    
    return null;
  };

  const pickImage = async () => {
    const permissions = await requestPermissions();
    
    if (permissions.mediaStatus !== 'granted') {
      Alert.alert('Permission Required', 'Gallery permission is required to select photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.7,
      base64: true,
      exif: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      let withoutLocationCount = 0;
      
      const newPhotos: PhotoData[] = result.assets.map(asset => {
        const gpsData = extractGPSFromExif(asset.exif);
        
        let location: Location.LocationObject | undefined = undefined;
        
        if (gpsData) {
          location = {
            coords: {
              latitude: gpsData.latitude,
              longitude: gpsData.longitude,
              altitude: null,
              accuracy: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as Location.LocationObject;
        } else {
          withoutLocationCount++;
        }

        return {
          uri: asset.uri,
          // base64: asset.base64,
          location,
        };
      });

      setPhotos(prev => [...prev, ...newPhotos]);
      
      // Clear validation error when photos are added
      if (errors.photos) {
        setErrors(prev => ({ ...prev, photos: '' }));
      }
      
      if (withoutLocationCount > 0) {
        setPhotosWithoutLocation(prev => prev + withoutLocationCount);
        
        if (withoutLocationCount === result.assets.length && photos.length === 0) {
          Alert.alert(
            'No Location Data',
            'None of the selected photos have location data. They will not be visible on the map.',
            [{ text: 'OK' }]
          );
        }
      }
    }
  };

  const removePhoto = (index: number) => {
    const photoToRemove = photos[index];
    if (!photoToRemove.location) {
      setPhotosWithoutLocation(prev => Math.max(0, prev - 1));
    }
    setPhotos(photos.filter((_, i) => i !== index));
    // Adjust cover photo index if needed
    if (coverPhotoIndex >= index && coverPhotoIndex > 0) {
      setCoverPhotoIndex(prev => prev - 1);
    }
    if (photos.length === 1) {
      setCoverPhotoIndex(0);
    }
  };

  // Combined camera function for photo OR video
  const openCamera = async () => {
    const permissions = await requestPermissions();
    
    if (permissions.cameraStatus !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required');
      return;
    }

    // Show action sheet to let user choose
    Alert.alert(
      'Camera',
      'What would you like to capture?',
      [
        { text: 'Photo', onPress: () => takePicture() },
        { text: 'Video', onPress: () => recordVideo() },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Video functions
  const recordVideo = async () => {
    const permissions = await requestPermissions();
    
    if (permissions.cameraStatus !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to record videos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'videos',
      allowsEditing: false,
      quality: 0.7,
      videoMaxDuration: 60, // 60 seconds max
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const thumb = await generateVideoThumbnail(uri);
      setVideos(prev => [...prev, { uri, thumbnail: thumb }]);
    }
  };

  const pickVideo = async () => {
    const permissions = await requestPermissions();

    if (permissions.mediaStatus !== 'granted') {
      Alert.alert('Permission Required', 'Gallery permission is required to select videos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'videos',
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newVideos: VideoData[] = await Promise.all(
        result.assets.map(async (asset) => {
          const thumb = await generateVideoThumbnail(asset.uri);
          return { uri: asset.uri, thumbnail: thumb };
        })
      );
      setVideos(prev => [...prev, ...newVideos]);
    }
  };

  const generateVideoThumbnail = async (uri: string): Promise<string | undefined> => {
    try {
      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, {
        time: 1000, // 1 second into the video
      });
      return thumbUri;
    } catch (e) {
      console.warn('Could not generate video thumbnail:', e);
      return undefined;
    }
  };

  const removeVideo = (index: number) => {
    setVideos(videos.filter((_, i) => i !== index));
  };

  const setCoverPhoto = (index: number) => {
    setCoverPhotoIndex(index);
  };

  // Upload photos to Supabase Storage via multipart FormData (no base64 overhead)
  // In edit mode, existing photos are signed URLs (http) — skip re-uploading them.
  const uploadPhotosToStorage = async (): Promise<string[]> => {
    if (photos.length === 0) return [];

    // Separate new local files from existing server URLs
    const newPhotos: { idx: number; photo: PhotoData }[] = [];
    photos.forEach((photo, idx) => {
      if (!photo.uri.startsWith('http')) {
        newPhotos.push({ idx, photo });
      }
    });

    // Upload only new photos
    let newPaths: string[] = [];
    if (newPhotos.length > 0) {
      const formData = new FormData();
      newPhotos.forEach(({ photo }, i) => {
        formData.append('files', {
          uri: photo.uri,
          type: 'image/jpeg',
          name: `photo_${i}.jpg`,
        } as any);
      });

      const response = await api.post('/upload/batch/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { urls, failed } = response.data;
      if (failed.length > 0) {
        console.warn(`${failed.length} photos failed to upload to storage`);
      }
      newPaths = urls;
    }

    // Rebuild list in original order: existing URLs as-is, new uploads by position
    let newIdx = 0;
    return photos
      .map((photo) => {
        if (photo.uri.startsWith('http')) return photo.uri;
        return newPaths[newIdx++] || '';
      })
      .filter(url => url && url.length > 0);
  };

  // Upload videos to Supabase Storage via multipart FormData (no base64 overhead)
  // In edit mode, existing videos are signed URLs (http) — skip re-uploading them.
  const uploadVideosToStorage = async (): Promise<string[]> => {
    if (videos.length === 0) return [];

    // Separate new local files from existing server URLs
    const newVideos: { idx: number; video: VideoData }[] = [];
    videos.forEach((video, idx) => {
      if (!video.uri.startsWith('http')) {
        newVideos.push({ idx, video });
      }
    });

    // Upload only new videos
    let newPaths: string[] = [];
    if (newVideos.length > 0) {
      const formData = new FormData();
      newVideos.forEach(({ video }, i) => {
        formData.append('files', {
          uri: video.uri,
          type: 'video/mp4',
          name: `video_${i}.mp4`,
        } as any);
      });

      const response = await api.post('/upload/batch/videos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { urls, failed } = response.data;
      if (failed.length > 0) {
        console.warn(`${failed.length} videos failed to upload to storage`);
      }
      newPaths = urls;
    }

    // Rebuild list in original order: existing URLs as-is, new uploads by position
    let newIdx = 0;
    return videos
      .map((video) => {
        if (video.uri.startsWith('http')) return video.uri;
        return newPaths[newIdx++] || '';
      })
      .filter(url => url && url.length > 0);
  };

  // Upload important files to Supabase Storage via multipart FormData
  // In edit mode, existing files have url/path from server — skip re-uploading them.
  const uploadFilesToStorage = async (): Promise<{ name: string; path: string; mimeType?: string }[]> => {
    if (importantFiles.length === 0) return [];

    // Separate existing server files from new local files
    const existingFiles: { idx: number; file: ImportantFile }[] = [];
    const newFiles: { idx: number; file: ImportantFile }[] = [];
    importantFiles.forEach((file, idx) => {
      if (file.url || file.path) {
        existingFiles.push({ idx, file });
      } else {
        newFiles.push({ idx, file });
      }
    });

    // Upload only new files
    let newPaths: string[] = [];
    if (newFiles.length > 0) {
      const formData = new FormData();
      newFiles.forEach(({ file }, i) => {
        formData.append('files', {
          uri: file.uri,
          type: file.mimeType || 'application/octet-stream',
          name: file.name || `file_${i}`,
        } as any);
      });

      const response = await api.post('/upload/batch/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { urls: paths, failed } = response.data;
      if (failed.length > 0) {
        console.warn(`${failed.length} files failed to upload to storage`);
      }
      newPaths = paths;
    }

    // Rebuild list in original order
    let newIdx = 0;
    return importantFiles
      .map((file) => {
        if (file.url || file.path) {
          // Existing file — preserve its server path/url
          return { name: file.name, path: file.path || file.url || '', mimeType: file.mimeType };
        }
        return { name: file.name, path: newPaths[newIdx++] || '', mimeType: file.mimeType };
      })
      .filter(f => f.path.length > 0);
  };

  // Builder management
  const addBuilder = () => {
    setBuilders([...builders, { name: '', phoneNumber: '', countryCode: '+91' }]);
  };

  const removeBuilder = (index: number) => {
    if (builders.length > 1) {
      setBuilders(builders.filter((_, i) => i !== index));
    }
  };

  const updateBuilder = (index: number, field: keyof BuilderInfo, value: string) => {
    const updated = [...builders];
    updated[index] = { ...updated[index], [field]: value };
    setBuilders(updated);
  };

  // Floor management
  const addFloor = () => {
    const lastFloor = floors[floors.length - 1];
    setFloors([...floors, { 
      tower: lastFloor?.tower || '',
      floorNumber: (lastFloor?.floorNumber || 0) + 1, 
      price: 0, 
      priceUnit: caseType === 'RENTAL' ? 'lakh_per_month' : 'cr' 
    }]);
  };

  const removeFloor = (index: number) => {
    if (floors.length > 1) {
      setFloors(floors.filter((_, i) => i !== index));
    }
  };

  const updateFloor = (index: number, field: keyof FloorEntry, value: any) => {
    const updated = [...floors];
    // For tower field, convert to uppercase
    if (field === 'tower' && typeof value === 'string') {
      value = value.toUpperCase();
    }
    updated[index] = { ...updated[index], [field]: value };
    setFloors(updated);
  };

  // Size management
  const addSize = (type: 'carpet' | 'builtup' | 'superbuiltup') => {
    if (!sizes.find(s => s.type === type)) {
      setSizes([...sizes, { type, value: 0, unit: 'sq_ft' }]);
    }
  };

  const removeSize = (index: number) => {
    setSizes(sizes.filter((_, i) => i !== index));
  };

  const updateSize = (index: number, field: keyof SizeEntry, value: any) => {
    const updated = [...sizes];
    updated[index] = { ...updated[index], [field]: value };
    setSizes(updated);
  };

  // File picker
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const newFiles: ImportantFile[] = result.assets.map(asset => ({
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType,
        }));
        setImportantFiles(prev => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const removeFile = (index: number) => {
    setImportantFiles(importantFiles.filter((_, i) => i !== index));
  };

  // Open file for preview
  const openFile = async (file: { uri: string; name: string; mimeType?: string }) => {
    try {
      const isShareable = await Sharing.isAvailableAsync();
      if (isShareable) {
        await Sharing.shareAsync(file.uri, {
          mimeType: file.mimeType || 'application/octet-stream',
          dialogTitle: file.name,
        });
      } else {
        Alert.alert('Unable to Preview', 'File preview is not available on this device.');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert('Error', 'Could not open this file. Try a different file viewer app.');
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before submitting');
      return;
    }

    // Show uploading state
    setLoading(true);
    
    try {
      // Upload photos, videos, and files to Supabase Storage first
      const [photoUrls, videoUrls, uploadedFiles] = await Promise.all([
        uploadPhotosToStorage(),
        uploadVideosToStorage(),
        uploadFilesToStorage(),
      ]);
      
      setLoading(false);
      
      // OPTIMISTIC UI: Show success immediately, sync in background
      const photoWithLocation = photos.find(p => p.location);
      const validBuilders = builders.filter(b => b.name || b.phoneNumber);
      
      // Parse price - handle decimals properly
      let actualPrice = price ? parseFloat(price.replace(',', '.')) : null;
      
      // Prepare floors data for multi-floor properties
      const floorsData = needsMultipleFloors ? floors.map(f => ({
        tower: f.tower || null,
        floorNumber: f.floorNumber,
        price: typeof f.price === 'string' ? parseFloat(String(f.price).replace(',', '.')) : f.price,
        priceUnit: f.priceUnit,
      })) : [];
      
      const propertyData = {
        propertyCategory,
        propertyType,
        propertyPhotos: photoUrls,
        propertyVideos: videoUrls,
        coverPhotoIndex: coverPhotoIndex,
        floor: needsMultipleFloors ? null : (floors[0]?.floorNumber || null),
        floors: floorsData,
        price: needsMultipleFloors ? null : actualPrice,
        priceUnit: needsMultipleFloors ? null : priceUnit,
        builders: validBuilders,
        builderName: validBuilders[0]?.name || null,
        builderPhone: validBuilders[0]?.phoneNumber || null,
        address: address,
        sizes: sizes,
        possessionMonth: possessionMonth,
        possessionYear: possessionYear,
        importantFiles: uploadedFiles,
        paymentPlan: paymentPlan || null,
        additionalNotes: additionalNotes || null,
        clubProperty,
        poolProperty,
        parkProperty,
        gatedProperty,
        propertyAge: propertyAge ? parseInt(propertyAge) : null,
        ageType: ageType || null,
        case: caseType || null,
        latitude: photoWithLocation?.location?.coords.latitude || null,
        longitude: photoWithLocation?.location?.coords.longitude || null,
      };

      if (isEditMode && editPropertyId) {
        // OPTIMISTIC: Show success immediately for edit too
        setNewPropertyAdded(true);
        Alert.alert('Success', 'Property updated! Syncing...', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        
        // Sync in background without blocking UI
        syncPropertyUpdateInBackground(editPropertyId, propertyData);
      } else {
        // OPTIMISTIC: Show success immediately
        Alert.alert('Success', 'Property added! Syncing...', [
          { text: 'OK', onPress: async () => {
            await clearFormDraft();
            resetForm();
          }},
        ]);
        
        // Mark cache as needing refresh so search/map will update
        setNewPropertyAdded(true);
        
        // Sync in background without blocking UI
        syncPropertyInBackground(propertyData);
      }
    } catch (error: any) {
      setLoading(false);
      console.error('Error uploading media:', error?.response?.data || error?.message || error);
      const detail = error?.response?.data?.detail || error?.message || 'Unknown error';
      Alert.alert('Upload Error', `Failed to upload media: ${detail}`);
    }
  };

  // Background sync function for new properties
  const syncPropertyInBackground = async (propertyData: any) => {
    try {
      await api.post('/properties', propertyData);
      console.log('Property synced successfully');
    } catch (error: any) {
      console.error('Background sync failed:', error);
      Alert.alert(
        'Sync Issue',
        'Property was saved locally but failed to sync. It will retry automatically.',
        [{ text: 'OK' }]
      );
    }
  };

  // Background sync function for property updates
  const syncPropertyUpdateInBackground = async (propertyId: string, propertyData: any) => {
    try {
      await api.put(`/properties/${propertyId}`, propertyData);
      console.log('Property update synced successfully');
    } catch (error: any) {
      console.error('Background update sync failed:', error);
      Alert.alert(
        'Sync Issue',
        'Property update was initiated but failed to sync. It will retry automatically.',
        [{ text: 'OK' }]
      );
    }
  };

  const getSizeLabel = (type: string) => {
    switch (type) {
      case 'carpet': return 'Carpet Area';
      case 'builtup': return 'Built-up Area (incl. balconies/stairs)';
      case 'superbuiltup': return 'Super Built-up Area (full plot)';
      default: return type;
    }
  };

  const getSizeUnitLabel = (unit: SizeUnit) => {
    const found = SIZE_UNITS.find(u => u.value === unit);
    return found?.label || unit;
  };

  const getPriceUnitLabel = (unit: PriceUnit) => {
    switch (unit) {
      case 'cr': return 'Cr';
      case 'lakh': return 'Lakh';
      case 'lakh_per_month': return 'Lakh/mo';
      default: return unit;
    }
  };

  if (loading && isEditMode) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading property...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 32) + 80 }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.formContainer}>
            {/* Header with Refresh button */}
            <View style={styles.formHeader}>
              <Text style={styles.formHeaderTitle}>
                {isEditMode ? 'Edit Property' : 'Add Property'}
              </Text>
              {!isEditMode && (
                <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
                  <Ionicons name="refresh" size={22} color="#fff" />
                </TouchableOpacity>
              )}
              {isEditMode && (
                <TouchableOpacity onPress={() => { resetForm(); router.back(); }} style={styles.refreshButton}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            {/* 1. Property Category */}
            <View style={styles.section}>
              <Text style={styles.label}>Property Category *</Text>
              <View style={styles.chipContainer}>
                {(['Residential', 'Commercial'] as PropertyCategory[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.chip,
                      propertyCategory === cat && styles.chipSelected,
                    ]}
                    onPress={() => {
                      setPropertyCategory(cat);
                      setPropertyType('');
                      // Clear validation error when category is selected
                      if (errors.propertyCategory) {
                        setErrors(prev => ({ ...prev, propertyCategory: '' }));
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        propertyCategory === cat && styles.chipTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.propertyCategory && (
                <Text style={styles.errorText}>{errors.propertyCategory}</Text>
              )}
            </View>

            {/* 2. Property Type */}
            {propertyCategory && (
              <View style={styles.section}>
                <Text style={styles.label}>Property Type *</Text>
                <View style={styles.chipContainer}>
                  {getPropertyTypes().map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.chip,
                        propertyType === type && styles.chipSelected,
                      ]}
                      onPress={() => {
                        setPropertyType(type);
                        // Clear validation error when type is selected
                        if (errors.propertyType) {
                          setErrors(prev => ({ ...prev, propertyType: '' }));
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          propertyType === type && styles.chipTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.propertyType && (
                  <Text style={styles.errorText}>{errors.propertyType}</Text>
                )}
              </View>
            )}

            {/* 3. Property Photos & Videos */}
            <View style={styles.section}>
              <Text style={styles.label}>Property Media *</Text>
              <Text style={styles.subLabel}>Add photos and videos of the property</Text>
              
              {/* Media Buttons - 3 icon buttons */}
              <View style={styles.mediaButtons}>
                <TouchableOpacity style={styles.mediaButton} onPress={openCamera}>
                  <View style={styles.mediaButtonIcon}>
                    <Ionicons name="camera" size={28} color="#fff" />
                  </View>
                  <Text style={styles.mediaButtonLabel}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
                  <View style={styles.mediaButtonIcon}>
                    <Ionicons name="image" size={28} color="#fff" />
                  </View>
                  <Text style={styles.mediaButtonLabel}>Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mediaButton} onPress={pickVideo}>
                  <View style={styles.mediaButtonIcon}>
                    <Ionicons name="videocam" size={28} color="#fff" />
                  </View>
                  <Text style={styles.mediaButtonLabel}>Videos</Text>
                </TouchableOpacity>
              </View>

              {/* Media Count & View Gallery Button */}
              {(photos.length > 0 || videos.length > 0) && (
                <TouchableOpacity 
                  style={styles.viewGalleryButton}
                  onPress={() => setShowMediaGallery(true)}
                >
                  <View style={styles.mediaCountContainer}>
                    <View style={styles.mediaCountItem}>
                      <Ionicons name="image" size={18} color="#fff" />
                      <Text style={styles.mediaCountText}>{photos.length} Photos</Text>
                    </View>
                    <View style={styles.mediaCountItem}>
                      <Ionicons name="videocam" size={18} color="#fff" />
                      <Text style={styles.mediaCountText}>{videos.length} Videos</Text>
                    </View>
                  </View>
                  <View style={styles.viewGalleryRight}>
                    <Text style={styles.viewGalleryText}>View Gallery</Text>
                    <Ionicons name="chevron-forward" size={18} color="#fff" />
                  </View>
                </TouchableOpacity>
              )}

              {/* Quick Preview - Photos */}
              {photos.length > 0 && (
                <ScrollView horizontal style={styles.photoPreviewContainer} showsHorizontalScrollIndicator={false}>
                  {photos.slice(0, 4).map((photo, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.photoPreview}
                      onPress={() => setFullscreenMedia({ type: 'photo', index })}
                    >
                      <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                      {coverPhotoIndex === index && (
                        <View style={styles.coverBadge}>
                          <Ionicons name="star" size={12} color="#FFD700" />
                        </View>
                      )}
                      {!photo.location && (
                        <View style={styles.noLocationBadge}>
                          <Ionicons name="location-outline" size={12} color="#ff4444" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                  {photos.length > 4 && (
                    <TouchableOpacity 
                      style={styles.morePhotosButton}
                      onPress={() => setShowMediaGallery(true)}
                    >
                      <Text style={styles.morePhotosText}>+{photos.length - 4}</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}

              {/* Quick Preview - Videos */}
              {videos.length > 0 && (
                <ScrollView horizontal style={styles.photoPreviewContainer} showsHorizontalScrollIndicator={false}>
                  {videos.slice(0, 4).map((video, index) => (
                    <TouchableOpacity 
                      key={`video-preview-${index}`} 
                      style={styles.photoPreview}
                      onPress={() => setFullscreenMedia({ type: 'video', index })}
                    >
                      <View style={styles.videoPreviewThumbnail}>
                        {video.thumbnail ? (
                          <Image source={{ uri: video.thumbnail }} style={styles.videoThumbnailPreview} />
                        ) : (
                          <Ionicons name="videocam" size={24} color="#666" />
                        )}
                        <View style={styles.videoPlayIconOverlay}>
                          <Ionicons name="play-circle" size={32} color="#fff" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {videos.length > 4 && (
                    <TouchableOpacity 
                      style={styles.morePhotosButton}
                      onPress={() => {
                        setMediaGalleryTab('videos');
                        setShowMediaGallery(true);
                      }}
                    >
                      <Text style={styles.morePhotosText}>+{videos.length - 4}</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}

              {photosWithoutLocation > 0 && photos.length > 0 && (
                <Text style={styles.locationWarning}>
                  {photosWithoutLocation} out of {photos.length} photo(s) do not have location data
                </Text>
              )}
              {errors.photos && <Text style={styles.errorText}>{errors.photos}</Text>}
            </View>

            {/* 4. Builder Details */}
            <View style={styles.section}>
              <Text style={styles.label}>Builder Details</Text>
              {builders.map((builder, index) => (
                <View key={index} style={styles.builderContainer}>
                  <View style={styles.builderRow}>
                    <TextInput
                      style={[styles.input, styles.builderNameInput]}
                      placeholder="Builder name"
                      placeholderTextColor="#666"
                      value={builder.name}
                      onChangeText={(text) => updateBuilder(index, 'name', text)}
                    />
                    <View style={styles.phoneContainer}>
                      <TouchableOpacity 
                        style={styles.countryCodeDropdown}
                        onPress={() => {
                          const currentIndex = COUNTRY_CODES.indexOf(builder.countryCode || '+91');
                          const nextIndex = (currentIndex + 1) % COUNTRY_CODES.length;
                          updateBuilder(index, 'countryCode', COUNTRY_CODES[nextIndex]);
                        }}
                      >
                        <Text style={styles.countryCodeText}>{builder.countryCode || '+91'}</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.input, styles.builderPhoneInput]}
                        placeholder="Phone"
                        placeholderTextColor="#666"
                        value={builder.phoneNumber}
                        onChangeText={(text) => updateBuilder(index, 'phoneNumber', text)}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                  {builders.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeBuilderButton}
                      onPress={() => removeBuilder(index)}
                    >
                      <Ionicons name="close-circle" size={20} color="#ff4444" />
                    </TouchableOpacity>
                  )}
                  {errors[`builderPhone_${index}`] && (
                    <Text style={styles.errorText}>{errors[`builderPhone_${index}`]}</Text>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addBuilderButton} onPress={addBuilder}>
                <Ionicons name="add-circle-outline" size={20} color="#4CAF50" />
                <Text style={styles.addBuilderText}>Add Builder</Text>
              </TouchableOpacity>
            </View>

            {/* 5. Case Type */}
            <View style={styles.section}>
              <Text style={styles.label}>Case Type</Text>
              <View style={styles.chipContainer}>
                {CASE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      caseType === type && styles.chipSelected,
                    ]}
                    onPress={() => setCaseType(type)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        caseType === type && styles.chipTextSelected,
                      ]}
                    >
                      {type.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 6. Price */}
            {needsMultipleFloors ? (
              <View style={styles.section}>
                <Text style={styles.label}>{showTowerField ? 'Tower, Floor & Price' : 'Floor & Price'}</Text>
                {floors.map((floor, index) => (
                  <View key={index} style={styles.floorEntry}>
                    <View style={styles.floorRow}>
                      {/* Tower field for Apartment Society */}
                      {showTowerField && (
                        <View style={styles.towerContainer}>
                          <Text style={styles.floorLabel}>Tower</Text>
                          <TextInput
                            style={[styles.input, styles.towerInput]}
                            placeholder="A"
                            placeholderTextColor="#666"
                            value={floor.tower || ''}
                            onChangeText={(text) => updateFloor(index, 'tower', text)}
                            autoCapitalize="characters"
                            maxLength={5}
                          />
                        </View>
                      )}
                      <View style={styles.floorNumberContainer}>
                        <Text style={styles.floorLabel}>Floor</Text>
                        <TextInput
                          style={[styles.input, styles.floorInput]}
                          placeholder="0"
                          placeholderTextColor="#666"
                          value={floor.floorNumber > 0 ? floor.floorNumber.toString() : ''}
                          onChangeText={(text) => updateFloor(index, 'floorNumber', parseInt(text) || 0)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.priceContainer}>
                        <Text style={styles.floorLabel}>Price ({getPriceUnitLabel(floor.priceUnit)})</Text>
                        <TextInput
                          style={[styles.input, styles.floorPriceInput]}
                          placeholder="0.00"
                          placeholderTextColor="#666"
                          value={floor.price > 0 ? String(floor.price) : ''}
                          onChangeText={(text) => {
                            // Allow digits and decimal point, preserve while typing
                            const cleaned = text.replace(/[^0-9.]/g, '');
                            const parts = cleaned.split('.');
                            const sanitized = parts.length > 2 
                              ? parts[0] + '.' + parts.slice(1).join('') 
                              : cleaned;
                            // Store as string-compatible number, keep trailing dot
                            updateFloor(index, 'price', sanitized === '' ? 0 : sanitized as any);
                          }}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      {floors.length > 1 && (
                        <TouchableOpacity onPress={() => removeFloor(index)} style={styles.removeFloorButton}>
                          <Ionicons name="close-circle" size={22} color="#ff4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={styles.addFloorButton} onPress={addFloor}>
                  <Ionicons name="add-circle-outline" size={20} color="#4CAF50" />
                  <Text style={styles.addFloorText}>Add {showTowerField ? 'Unit' : 'Floor'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.label}>Price ({getPriceUnitLabel(priceUnit)})</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#666"
                  value={price}
                  onChangeText={(text) => {
                    // Allow digits and decimal point only
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    // Ensure only one decimal point
                    const parts = cleaned.split('.');
                    if (parts.length > 2) {
                      setPrice(parts[0] + '.' + parts.slice(1).join(''));
                    } else {
                      setPrice(cleaned);
                    }
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
            )}

            {/* 7. Address */}
            <View style={styles.section}>
              <Text style={styles.label}>Address</Text>
              <View style={styles.addressRow}>
                <TextInput
                  style={[styles.input, showTowerField ? styles.addressInputLarge : styles.addressInputSmall]}
                  placeholder={showTowerField ? "Society Name" : "Unit No"}
                  placeholderTextColor="#666"
                  value={address.unitNo}
                  onChangeText={(text) => setAddress({ ...address, unitNo: text })}
                />
                <TextInput
                  style={[styles.input, showTowerField ? styles.addressInputXSmall : styles.addressInputSmall]}
                  placeholder="Block"
                  placeholderTextColor="#666"
                  value={address.block}
                  onChangeText={(text) => setAddress({ ...address, block: text })}
                />
              </View>
              <View style={styles.addressRow}>
                <TextInput
                  style={[styles.input, styles.addressInputSmall]}
                  placeholder="Sector/Area"
                  placeholderTextColor="#666"
                  value={address.sector}
                  onChangeText={(text) => setAddress({ ...address, sector: text })}
                />
                <TextInput
                  style={[styles.input, styles.addressInputSmall]}
                  placeholder="City"
                  placeholderTextColor="#666"
                  value={address.city}
                  onChangeText={(text) => setAddress({ ...address, city: text })}
                />
              </View>
            </View>

            {/* 8. Size/Area */}
            <View style={styles.section}>
              <Text style={styles.label}>Size / Area</Text>
              <Text style={styles.subLabel}>Add property dimensions</Text>
              
              {sizes.map((size, index) => (
                <View key={index} style={styles.sizeEntry}>
                  <Text style={styles.sizeTypeLabel}>{getSizeLabel(size.type)}</Text>
                  <View style={styles.sizeRow}>
                    <TextInput
                      style={[styles.input, styles.sizeInput]}
                      placeholder="0"
                      placeholderTextColor="#666"
                      value={size.value > 0 ? size.value.toString() : ''}
                      onChangeText={(text) => updateSize(index, 'value', parseFloat(text) || 0)}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity 
                      style={styles.unitDropdown}
                      onPress={() => setShowSizeUnitDropdown(showSizeUnitDropdown === index ? null : index)}
                    >
                      <Text style={styles.unitText}>{getSizeUnitLabel(size.unit)}</Text>
                      <Ionicons name="chevron-down" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeSize(index)} style={styles.removeButton}>
                      <Ionicons name="close-circle" size={24} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                  {showSizeUnitDropdown === index && (
                    <View style={styles.dropdownList}>
                      {SIZE_UNITS.map((unit) => (
                        <TouchableOpacity
                          key={unit.value}
                          style={[
                            styles.dropdownItem,
                            size.unit === unit.value && styles.dropdownItemSelected,
                          ]}
                          onPress={() => {
                            updateSize(index, 'unit', unit.value);
                            setShowSizeUnitDropdown(null);
                          }}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            size.unit === unit.value && styles.dropdownItemTextSelected,
                          ]}>
                            {unit.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
              
              <View style={styles.addSizeButtons}>
                {!sizes.find(s => s.type === 'carpet') && (
                  <TouchableOpacity 
                    style={styles.addSizeButton} 
                    onPress={() => addSize('carpet')}
                  >
                    <Ionicons name="add" size={16} color="#4CAF50" />
                    <Text style={styles.addSizeButtonText}>Carpet</Text>
                  </TouchableOpacity>
                )}
                {!sizes.find(s => s.type === 'builtup') && (
                  <TouchableOpacity 
                    style={styles.addSizeButton} 
                    onPress={() => addSize('builtup')}
                  >
                    <Ionicons name="add" size={16} color="#4CAF50" />
                    <Text style={styles.addSizeButtonText}>Built-up</Text>
                  </TouchableOpacity>
                )}
                {!sizes.find(s => s.type === 'superbuiltup') && (
                  <TouchableOpacity 
                    style={styles.addSizeButton} 
                    onPress={() => addSize('superbuiltup')}
                  >
                    <Ionicons name="add" size={16} color="#4CAF50" />
                    <Text style={styles.addSizeButtonText}>Super Built-up</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 9. Age Type */}
            <View style={styles.section}>
              <Text style={styles.label}>Age Type</Text>
              <View style={styles.chipContainer}>
                {AGE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      ageType === type && styles.chipSelected,
                    ]}
                    onPress={() => setAgeType(type)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        ageType === type && styles.chipTextSelected,
                      ]}
                    >
                      {type === 'UnderConstruction' ? 'Under Construction' : type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Property Age (only shown when Resale is selected) */}
              {ageType === 'Resale' && (
                <View style={styles.subSection}>
                  <Text style={styles.subLabel}>Property Age (years)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter property age"
                    placeholderTextColor="#666"
                    value={propertyAge}
                    onChangeText={setPropertyAge}
                    keyboardType="numeric"
                  />
                </View>
              )}
            </View>

            {/* 10. Possession Time - Hidden when Resale is selected */}
            {ageType !== 'Resale' && (
            <View style={styles.section}>
              <Text style={styles.label}>Possession Time</Text>
              <View style={styles.rowContainer}>
                <View style={styles.dropdownFieldContainer}>
                  <TouchableOpacity 
                    style={styles.dropdownField}
                    onPress={() => {
                      setShowMonthDropdown(!showMonthDropdown);
                      setShowYearDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownFieldText}>
                      {possessionMonth !== null ? MONTHS[possessionMonth - 1] : 'Select Month'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#fff" />
                  </TouchableOpacity>
                  {showMonthDropdown && (
                    <View style={styles.inlineDropdown}>
                      <ScrollView style={styles.inlineDropdownScroll} nestedScrollEnabled>
                        {MONTHS.map((month, index) => (
                          <TouchableOpacity
                            key={month}
                            style={[
                              styles.dropdownItem,
                              possessionMonth === index + 1 && styles.dropdownItemSelected,
                            ]}
                            onPress={() => {
                              setPossessionMonth(index + 1);
                              setShowMonthDropdown(false);
                            }}
                          >
                            <Text style={[
                              styles.dropdownItemText,
                              possessionMonth === index + 1 && styles.dropdownItemTextSelected,
                            ]}>
                              {month}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                <View style={styles.dropdownFieldContainer}>
                  <TouchableOpacity 
                    style={styles.dropdownField}
                    onPress={() => {
                      setShowYearDropdown(!showYearDropdown);
                      setShowMonthDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownFieldText}>
                      {possessionYear !== null ? possessionYear.toString() : 'Year'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#fff" />
                  </TouchableOpacity>
                  {showYearDropdown && (
                    <View style={styles.inlineDropdown}>
                      <ScrollView style={styles.inlineDropdownScroll} nestedScrollEnabled>
                        {YEARS.map((year) => (
                          <TouchableOpacity
                            key={year}
                            style={[
                              styles.dropdownItem,
                              possessionYear === year && styles.dropdownItemSelected,
                            ]}
                            onPress={() => {
                              setPossessionYear(year);
                              setShowYearDropdown(false);
                            }}
                          >
                            <Text style={[
                              styles.dropdownItemText,
                              possessionYear === year && styles.dropdownItemTextSelected,
                            ]}>
                              {year}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            </View>
            )}

            {/* Payment Plan */}
            <View style={styles.section}>
              <Text style={styles.label}>Payment Plan</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Enter payment plan details..."
                placeholderTextColor="#666"
                value={paymentPlan}
                onChangeText={setPaymentPlan}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Important Files */}
            <View style={styles.section}>
              <Text style={styles.label}>IMPORTANT FILES</Text>
              <Text style={styles.subLabel}>Attach PDFs or images</Text>
              <TouchableOpacity style={styles.attachButton} onPress={pickFile}>
                <Ionicons name="attach" size={24} color="#fff" />
                <Text style={styles.attachButtonText}>Attach Files</Text>
              </TouchableOpacity>
              {importantFiles.length > 0 && (
                <View style={styles.filesList}>
                  {importantFiles.map((file, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.fileItem}
                      onPress={() => openFile(file)}
                    >
                      <Ionicons 
                        name={file.mimeType?.includes('pdf') ? 'document-text' : 'image'} 
                        size={20} 
                        color="#4CAF50" 
                      />
                      <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                      <TouchableOpacity 
                        onPress={() => removeFile(index)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#ff4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Property Features */}
            <View style={styles.section}>
              <Text style={styles.label}>Property Features</Text>
              <View style={styles.featureContainer}>
                <TouchableOpacity
                  style={styles.featureItem}
                  onPress={() => setClubProperty(!clubProperty)}
                >
                  <Ionicons
                    name={clubProperty ? 'checkbox' : 'square-outline'}
                    size={24}
                    color="#fff"
                  />
                  <Text style={styles.featureText}>Club</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.featureItem}
                  onPress={() => setPoolProperty(!poolProperty)}
                >
                  <Ionicons
                    name={poolProperty ? 'checkbox' : 'square-outline'}
                    size={24}
                    color="#fff"
                  />
                  <Text style={styles.featureText}>Pool</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.featureItem}
                  onPress={() => setParkProperty(!parkProperty)}
                >
                  <Ionicons
                    name={parkProperty ? 'checkbox' : 'square-outline'}
                    size={24}
                    color="#fff"
                  />
                  <Text style={styles.featureText}>Park</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.featureItem}
                  onPress={() => setGatedProperty(!gatedProperty)}
                >
                  <Ionicons
                    name={gatedProperty ? 'checkbox' : 'square-outline'}
                    size={24}
                    color="#fff"
                  />
                  <Text style={styles.featureText}>Gated</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Additional Notes */}
            <View style={styles.section}>
              <Text style={styles.label}>Additional Features / Notes</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Enter any additional features or notes..."
                placeholderTextColor="#666"
                value={additionalNotes}
                onChangeText={setAdditionalNotes}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isEditMode ? 'Update Property' : 'Add Property'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Media Gallery Modal - with swipe down to close */}
      <Modal
        visible={showMediaGallery}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMediaGallery(false)}
      >
        <View style={styles.galleryModal}>
          {/* Swipe indicator at top */}
          <View style={styles.swipeIndicatorContainer}>
            <TouchableOpacity 
              style={styles.swipeIndicator}
              onPress={() => setShowMediaGallery(false)}
            />
          </View>
          
          {/* Gallery Header */}
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>Media Gallery</Text>
            <TouchableOpacity 
              style={styles.galleryCloseButton}
              onPress={() => setShowMediaGallery(false)}
            >
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <View style={styles.galleryTabs}>
            <TouchableOpacity 
              style={[styles.galleryTab, mediaGalleryTab === 'photos' && styles.galleryTabActive]}
              onPress={() => setMediaGalleryTab('photos')}
            >
              <Ionicons name="image" size={20} color={mediaGalleryTab === 'photos' ? '#000' : '#fff'} />
              <Text style={[styles.galleryTabText, mediaGalleryTab === 'photos' && styles.galleryTabTextActive]}>
                Photos ({photos.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.galleryTab, mediaGalleryTab === 'videos' && styles.galleryTabActive]}
              onPress={() => setMediaGalleryTab('videos')}
            >
              <Ionicons name="videocam" size={20} color={mediaGalleryTab === 'videos' ? '#000' : '#fff'} />
              <Text style={[styles.galleryTabText, mediaGalleryTab === 'videos' && styles.galleryTabTextActive]}>
                Videos ({videos.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Gallery Content */}
          {mediaGalleryTab === 'photos' ? (
            <FlatList
              data={photos}
              numColumns={2}
              keyExtractor={(_, index) => `photo-${index}`}
              contentContainerStyle={styles.galleryGrid}
              renderItem={({ item, index }) => (
                <TouchableOpacity 
                  style={styles.galleryItem}
                  onPress={() => {
                    setShowMediaGallery(false);
                    setTimeout(() => setFullscreenMedia({ type: 'photo', index }), 300);
                  }}
                >
                  <Image source={{ uri: item.uri }} style={styles.galleryImage} />
                  {/* Star for Cover Photo */}
                  <TouchableOpacity 
                    style={styles.starButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      setCoverPhoto(index);
                    }}
                  >
                    <Ionicons 
                      name={coverPhotoIndex === index ? 'star' : 'star-outline'} 
                      size={24} 
                      color={coverPhotoIndex === index ? '#FFD700' : '#fff'} 
                    />
                  </TouchableOpacity>
                  {/* Delete Button */}
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      removePhoto(index);
                    }}
                  >
                    <Ionicons name="trash" size={20} color="#ff4444" />
                  </TouchableOpacity>
                  {coverPhotoIndex === index && (
                    <View style={styles.coverLabel}>
                      <Text style={styles.coverLabelText}>Cover</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyGallery}>
                  <Ionicons name="image-outline" size={48} color="#666" />
                  <Text style={styles.emptyGalleryText}>No photos added yet</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={videos}
              numColumns={2}
              keyExtractor={(_, index) => `video-${index}`}
              contentContainerStyle={styles.galleryGrid}
              renderItem={({ item, index }) => (
                <TouchableOpacity 
                  style={styles.galleryItem}
                  onPress={() => {
                    setShowMediaGallery(false);
                    setTimeout(() => setFullscreenMedia({ type: 'video', index }), 300);
                  }}
                >
                  {/* Video thumbnail from first frame */}
                  <View style={styles.videoThumbnail}>
                    {item.thumbnail ? (
                      <Image source={{ uri: item.thumbnail }} style={styles.videoThumbnailPreview} />
                    ) : (
                      <Ionicons name="videocam" size={32} color="#666" />
                    )}
                    <View style={styles.videoPlayOverlay}>
                      <Ionicons name="play-circle" size={48} color="#fff" />
                    </View>
                  </View>
                  {/* Delete Button */}
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      removeVideo(index);
                    }}
                  >
                    <Ionicons name="trash" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyGallery}>
                  <Ionicons name="videocam-outline" size={48} color="#666" />
                  <Text style={styles.emptyGalleryText}>No videos added yet</Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>

      {/* Fullscreen Media Viewer */}
      <Modal
        visible={fullscreenMedia !== null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setFullscreenMedia(null)}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity 
            style={styles.fullscreenClose}
            onPress={() => setFullscreenMedia(null)}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          
          {fullscreenMedia?.type === 'photo' && photos.length > 0 ? (
            <FlatList
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={Math.min(fullscreenMedia.index, photos.length - 1)}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              keyExtractor={(_, index) => `fullscreen-photo-${index}`}
              renderItem={({ item, index }) => (
                <View style={styles.fullscreenSlide}>
                  <Image 
                    source={{ uri: item.uri }} 
                    style={styles.fullscreenImage}
                    resizeMode="contain"
                  />
                  <View style={styles.fullscreenFooter}>
                    <Text style={styles.fullscreenCounter}>
                      {index + 1} / {photos.length}
                    </Text>
                    <TouchableOpacity 
                      style={styles.fullscreenStarButton}
                      onPress={() => setCoverPhoto(index)}
                    >
                      <Ionicons 
                        name={coverPhotoIndex === index ? 'star' : 'star-outline'} 
                        size={28} 
                        color={coverPhotoIndex === index ? '#FFD700' : '#fff'} 
                      />
                      <Text style={styles.fullscreenStarText}>
                        {coverPhotoIndex === index ? 'Cover Photo' : 'Set as Cover'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          ) : fullscreenMedia?.type === 'video' && videos.length > 0 ? (
            <FlatList
              data={videos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={Math.min(fullscreenMedia.index, videos.length - 1)}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              keyExtractor={(_, index) => `fullscreen-video-${index}`}
              renderItem={({ item, index }) => (
                <FullscreenVideoItem 
                  uri={item.uri} 
                  index={index} 
                  total={videos.length}
                  isActive={fullscreenMedia.index === index}
                />
              )}
            />
          ) : null}
        </View>
      </Modal>
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
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  formContainer: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  editHeaderText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingRight: 4,
  },
  formHeaderTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
  },
  section: {
    marginBottom: 24,
  },
  subSection: {
    marginTop: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#fff',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  chipText: {
    color: '#fff',
    fontSize: 14,
  },
  chipTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  photoPreviewContainer: {
    marginTop: 12,
  },
  photoPreview: {
    width: 100,
    height: 100,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  videoPreviewThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  noLocationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
  },
  locationWarning: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 8,
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dropdownFieldContainer: {
    flex: 1,
    position: 'relative',
  },
  dropdownField: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownFieldText: {
    color: '#fff',
    fontSize: 16,
  },
  inlineDropdown: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 200,
    overflow: 'hidden',
  },
  inlineDropdownScroll: {
    maxHeight: 200,
  },
  unitDropdown: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 90,
  },
  unitText: {
    color: '#fff',
    fontSize: 14,
  },
  dropdownList: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dropdownItemSelected: {
    backgroundColor: '#333',
  },
  dropdownItemText: {
    color: '#fff',
    fontSize: 16,
  },
  dropdownItemTextSelected: {
    fontWeight: '600',
  },
  // Floor entry styles
  floorEntry: {
    marginBottom: 12,
  },
  floorRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  floorNumberContainer: {
    width: 70,
  },
  floorLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  floorInput: {
    width: '100%',
    textAlign: 'center',
  },
  priceContainer: {
    flex: 1,
  },
  floorPriceInput: {
    width: '100%',
  },
  removeFloorButton: {
    padding: 4,
    marginBottom: 8,
  },
  addFloorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    padding: 8,
    marginTop: 4,
  },
  addFloorText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  // Size entry styles
  sizeEntry: {
    marginBottom: 12,
  },
  sizeTypeLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sizeInput: {
    flex: 1,
  },
  addSizeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  addSizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addSizeButtonText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    padding: 4,
  },
  // Builder styles
  builderContainer: {
    marginBottom: 12,
    position: 'relative',
  },
  builderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  builderNameInput: {
    width: '35%',
  },
  phoneContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  countryCodeDropdown: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  countryCodeText: {
    color: '#fff',
    fontSize: 14,
  },
  builderPhoneInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftWidth: 0,
  },
  removeBuilderButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#0c0c0c',
    borderRadius: 12,
  },
  addBuilderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-end',
    padding: 8,
  },
  addBuilderText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  // Address styles
  addressRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  addressInputSmall: {
    flex: 1,
  },
  addressInputLarge: {
    flex: 2,
  },
  addressInputXSmall: {
    flex: 0.6,
  },
  towerContainer: {
    width: 70,
  },
  towerInput: {
    width: '100%',
    textAlign: 'center',
  },
  // Important files
  attachButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  attachButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filesList: {
    marginTop: 12,
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
  // Features
  featureContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    color: '#fff',
    fontSize: 16,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Media Gallery Styles
  viewGalleryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  mediaCountContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  mediaCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mediaCountText: {
    color: '#fff',
    fontSize: 14,
  },
  viewGalleryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewGalleryText: {
    color: '#fff',
    fontSize: 14,
  },
  morePhotosButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  morePhotosText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  coverBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
  },
  // Media Button Styles (3 icon buttons)
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  mediaButton: {
    alignItems: 'center',
    gap: 6,
  },
  mediaButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaButtonLabel: {
    color: '#999',
    fontSize: 12,
  },
  // Gallery Modal Styles
  galleryModal: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    paddingTop: 10,
  },
  swipeIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  swipeIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#666',
    borderRadius: 3,
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  galleryCloseButton: {
    padding: 4,
  },
  galleryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  galleryTabs: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  galleryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  galleryTabActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  galleryTabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  galleryTabTextActive: {
    color: '#000',
  },
  galleryGrid: {
    padding: 8,
  },
  galleryItem: {
    flex: 1,
    margin: 4,
    aspectRatio: 1,
    maxWidth: '50%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoThumbnailPreview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#222',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 6,
  },
  deleteButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 6,
  },
  coverLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#FFD700',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coverLabelText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyGallery: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyGalleryText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  // Fullscreen Viewer Styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
  },
  fullscreenSlide: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
  fullscreenVideo: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
  fullscreenFooter: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 16,
  },
  fullscreenCounter: {
    color: '#fff',
    fontSize: 16,
  },
  fullscreenStarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  fullscreenStarText: {
    color: '#fff',
    fontSize: 14,
  },
});
