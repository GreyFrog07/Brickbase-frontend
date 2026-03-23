import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import DeleteAccountModal from '../../components/DeleteAccountModal';
import VoiceFeedbackButton from '../../components/VoiceFeedbackButton';
import api from '../../lib/api';

const SUPPORT_PHONE = '919311730107';
const PRIVACY_POLICY_URL = 'https://brickbase.co.in/privacy-policy/';
const TERMS_URL = 'https://brickbase.co.in/terms-and-conditions/';

export default function ProfileScreen() {
  const { user, signOut, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  const handlePickProfilePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking profile photo:', error);
      Alert.alert('Error', 'Failed to pick photo');
    }
  };

  const uploadProfilePhoto = async (uri: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      } as any);

      const response = await api.post('/upload/profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { url } = response.data;
      await updateUser({ profilePhotoUrl: url });
      Alert.alert('Success', 'Profile photo updated');
    } catch (error: any) {
      console.error('Error uploading profile photo:', error);
      Alert.alert('Error', 'Failed to upload profile photo');
    } finally {
      setUploading(false);
    }
  };

  const handleHelpAndSupport = () => {
    Alert.alert(
      'Contact Us',
      'How can we help you?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Give Feedback',
          onPress: () => openWhatsApp("Hey I'm contacting regarding BrickBase and would like to provide feedback on "),
        },
        {
          text: 'Ask for Help',
          onPress: () => openWhatsApp("Hey I'm contacting regarding BrickBase and would like help on "),
        },
      ]
    );
  };

  const openWhatsApp = async (text: string) => {
    const url = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(text)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not available', 'Please contact us at support@brickbase.co.in');
    }
  };

  const handleOpenUrl = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Unable to open this link');
    }
  };

  const handleAbout = () => {
    Alert.alert(
      'BrickBase',
      'Version 1.0.0\n\nA property inventory management app for real estate professionals.\n\n© 2026 BrickBase. All rights reserved.',
      [{ text: 'OK' }]
    );
  };

  const formatPhoneNumber = () => {
    if (user?.phone) {
      const countryCode = user.countryCode || '+91';
      return `${countryCode} ${user.phone}`;
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 100 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header — horizontal layout */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handlePickProfilePhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : user?.profilePhotoUrl ? (
              <Image
                source={{ uri: user.profilePhotoUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons name="person" size={36} color="#666" />
            )}
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            {user?.name && (
              <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
            )}

            {formatPhoneNumber() && (
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={14} color="#666" />
                <Text style={styles.infoText}>{formatPhoneNumber()}</Text>
              </View>
            )}

            {user?.email && (
              <View style={styles.contactRow}>
                <Ionicons name="mail-outline" size={14} color="#666" />
                <Text style={styles.infoText} numberOfLines={1}>{user.email}</Text>
              </View>
            )}

            {(user?.firmName || user?.city) && (
              <View style={styles.contactRow}>
                {user?.firmName && (
                  <>
                    <Ionicons name="business-outline" size={14} color="#444" />
                    <Text style={styles.secondaryText}>{user.firmName}</Text>
                  </>
                )}
                {user?.firmName && user?.city && (
                  <Text style={styles.secondaryText}>·</Text>
                )}
                {user?.city && (
                  <>
                    <Ionicons name="location-outline" size={14} color="#444" />
                    <Text style={styles.secondaryText}>{user.city}</Text>
                  </>
                )}
              </View>
            )}

            <TouchableOpacity onPress={handlePickProfilePhoto} disabled={uploading}>
              <Text style={styles.changePhotoText}>
                {uploading ? 'Uploading...' : user?.profilePhotoUrl ? 'Change Photo' : 'Add Photo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Voice Feedback */}
        <VoiceFeedbackButton />

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={handleHelpAndSupport}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={24} color="#fff" />
              <Text style={styles.menuItemText}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleOpenUrl(PRIVACY_POLICY_URL)}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={24} color="#fff" />
              <Text style={styles.menuItemText}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleOpenUrl(TERMS_URL)}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="clipboard-outline" size={24} color="#fff" />
              <Text style={styles.menuItemText}>Terms & Conditions</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleAbout}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="information-circle-outline" size={24} color="#fff" />
              <Text style={styles.menuItemText}>About</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color="#ff4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Delete Account Button */}
        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={() => setShowDeleteModal(true)}
        >
          <Ionicons name="trash-outline" size={20} color="#666" />
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>

      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 84,
    height: 84,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 14,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
    maxHeight: 84,
    justifyContent: 'center',
  },
  userName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoText: {
    color: '#999',
    fontSize: 12,
  },
  secondaryText: {
    color: '#666',
    fontSize: 11,
  },
  changePhotoText: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  menuSection: {
    gap: 8,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuItemText: {
    color: '#fff',
    fontSize: 16,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  signOutText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 8,
  },
  deleteAccountText: {
    color: '#666',
    fontSize: 13,
  },
  version: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
});
