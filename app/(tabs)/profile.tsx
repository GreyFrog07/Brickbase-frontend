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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import DeleteAccountModal from '../../components/DeleteAccountModal';
import api from '../../lib/api';

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

  // Format phone number for display
  const formatPhoneNumber = () => {
    if (user?.phone) {
      const countryCode = user.countryCode || '+91';
      return `${countryCode} ${user.phone}`;
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 100 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handlePickProfilePhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="large" color="#4CAF50" />
            ) : user?.profilePhotoUrl ? (
              <Image
                source={{ uri: user.profilePhotoUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons name="person" size={48} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickProfilePhoto} disabled={uploading}>
            <Text style={styles.changePhotoText}>
              {uploading ? 'Uploading...' : user?.profilePhotoUrl ? 'Change Photo' : 'Add Photo'}
            </Text>
          </TouchableOpacity>

          {/* User Name */}
          {user?.name && (
            <Text style={styles.userName}>{user.name}</Text>
          )}

          {/* Phone Number - Above Email */}
          {formatPhoneNumber() && (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={18} color="#4CAF50" />
              <Text style={styles.phoneText}>{formatPhoneNumber()}</Text>
            </View>
          )}

          {/* Email */}
          {user?.email && (
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={18} color="#4CAF50" />
              <Text style={styles.emailText}>{user.email}</Text>
            </View>
          )}

          {/* Firm Name */}
          {user?.firmName && (
            <View style={styles.contactRow}>
              <Ionicons name="business-outline" size={18} color="#666" />
              <Text style={styles.firmText}>{user.firmName}</Text>
            </View>
          )}

          {/* City */}
          {user?.city && (
            <View style={styles.contactRow}>
              <Ionicons name="location-outline" size={18} color="#666" />
              <Text style={styles.cityText}>{user.city}</Text>
            </View>
          )}

          <Text style={styles.label}>Account</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="settings-outline" size={24} color="#fff" />
              <Text style={styles.menuItemText}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={24} color="#fff" />
              <Text style={styles.menuItemText}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={24} color="#fff" />
              <Text style={styles.menuItemText}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="clipboard-outline" size={24} color="#fff" />
              <Text style={styles.menuItemText}>Terms & Conditions</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
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
    </SafeAreaView>
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
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#333',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  changePhotoText: {
    color: '#999',
    fontSize: 13,
    marginBottom: 16,
  },
  userName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  phoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emailText: {
    color: '#fff',
    fontSize: 16,
  },
  firmText: {
    color: '#999',
    fontSize: 14,
  },
  cityText: {
    color: '#999',
    fontSize: 14,
  },
  label: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
