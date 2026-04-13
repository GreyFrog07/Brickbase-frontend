import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  Linking,
  Modal,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import DeleteAccountModal from '../../components/profile/DeleteAccountModal';
import VoiceFeedbackButton from '../../components/profile/VoiceFeedbackButton';
import api from '../../lib/api';

const SUPPORT_PHONE = '919311730107';
const PRIVACY_POLICY_URL = 'https://brickbase.co.in/privacy-policy/';
const TERMS_URL = 'https://brickbase.co.in/terms-and-conditions/';

export default function ProfileScreen() {
  const { user, signOut, updateUser } = useAuth();
  const {
    organizations, loadingOrgs, currentOrg,
    createOrganization, joinOrganization, leaveOrganization,
    removeMember, regenerateInviteCode, deleteOrganization,
  } = useOrganization();
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgModalMode, setOrgModalMode] = useState<'create' | 'join'>('create');
  const [orgInput, setOrgInput] = useState('');

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

  const handleOrgSubmit = async () => {
    const trimmed = orgInput.trim();
    if (!trimmed) return;
    if (orgModalMode === 'create') {
      const org = await createOrganization(trimmed);
      if (org) {
        setShowOrgModal(false);
        setOrgInput('');
        Alert.alert('Organization Created', `"${org.name}" created!\n\nInvite code: ${org.inviteCode}`);
      }
    } else {
      const org = await joinOrganization(trimmed);
      if (org) {
        setShowOrgModal(false);
        setOrgInput('');
        Alert.alert('Joined!', `You've joined "${org.name}"`);
      }
    }
  };

  const handleLeaveOrg = (orgId: string, orgName: string) => {
    Alert.alert('Leave Organization', `Leave "${orgName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => leaveOrganization(orgId),
      },
    ]);
  };

  const handleDeleteOrg = (orgId: string, orgName: string) => {
    Alert.alert(
      'Delete Organization',
      `Delete "${orgName}" permanently? All members will lose access to shared properties.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteOrganization(orgId),
        },
      ]
    );
  };

  const handleRegenInvite = async (orgId: string) => {
    const newCode = await regenerateInviteCode(orgId);
    if (newCode) {
      Alert.alert('New Invite Code', newCode);
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

        {/* Organization Section */}
        <View style={styles.orgSection}>
          <Text style={styles.sectionTitle}>Organization</Text>

          {loadingOrgs ? (
            <ActivityIndicator size="small" color="#666" style={{ marginVertical: 12 }} />
          ) : organizations.length === 0 ? (
            <View style={styles.orgEmpty}>
              <Text style={styles.orgEmptyText}>
                Create or join an organization to share your property inventory with your team.
              </Text>
              <View style={styles.orgButtonRow}>
                <TouchableOpacity
                  style={styles.orgActionBtn}
                  onPress={() => { setOrgModalMode('create'); setOrgInput(''); setShowOrgModal(true); }}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text style={styles.orgActionBtnText}>Create</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.orgActionBtn, styles.orgActionBtnSecondary]}
                  onPress={() => { setOrgModalMode('join'); setOrgInput(''); setShowOrgModal(true); }}
                >
                  <Ionicons name="people-outline" size={18} color="#aaa" />
                  <Text style={[styles.orgActionBtnText, { color: '#aaa' }]}>Join with Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            organizations.map(org => {
              const isAdmin = org.members.some(m => m.userId === user?.id && m.role === 'admin');
              return (
                <View key={org.id} style={styles.orgCard}>
                  <View style={styles.orgCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orgName}>{org.name}</Text>
                      <Text style={styles.orgMeta}>
                        {org.members.length} {org.members.length === 1 ? 'member' : 'members'} · {isAdmin ? 'Admin' : 'Member'}
                      </Text>
                    </View>
                    <View style={styles.orgCardActions}>
                      {isAdmin && (
                        <TouchableOpacity
                          onPress={() => handleDeleteOrg(org.id, org.name)}
                          style={styles.orgIconBtn}
                        >
                          <Ionicons name="trash-outline" size={18} color="#ff4444" />
                        </TouchableOpacity>
                      )}
                      {!isAdmin && (
                        <TouchableOpacity
                          onPress={() => handleLeaveOrg(org.id, org.name)}
                          style={styles.orgIconBtn}
                        >
                          <Ionicons name="exit-outline" size={18} color="#ff4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {isAdmin && org.inviteCode && (
                    <View style={styles.inviteRow}>
                      <Ionicons name="link-outline" size={14} color="#666" />
                      <Text style={styles.inviteCodeLabel}>Invite Code:</Text>
                      <Text style={styles.inviteCode}>{org.inviteCode}</Text>
                      <TouchableOpacity onPress={() => handleRegenInvite(org.id)}>
                        <Ionicons name="refresh-outline" size={14} color="#666" />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.memberList}>
                    {org.members.map(member => (
                      <View key={member.id} style={styles.memberRow}>
                        <View style={styles.memberAvatar}>
                          {member.profilePhotoUrl ? (
                            <Image source={{ uri: member.profilePhotoUrl }} style={styles.memberAvatarImg} />
                          ) : (
                            <Ionicons name="person" size={14} color="#666" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>{member.name || member.email || 'Member'}</Text>
                          {member.phone && <Text style={styles.memberPhone}>{member.phone}</Text>}
                        </View>
                        <Text style={[styles.memberRole, member.role === 'admin' && styles.adminRole]}>
                          {member.role}
                        </Text>
                        {isAdmin && member.userId !== user?.id && (
                          <TouchableOpacity
                            style={{ marginLeft: 8 }}
                            onPress={() => removeMember(org.id, member.userId)}
                          >
                            <Ionicons name="close-circle-outline" size={18} color="#666" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}

          {organizations.length > 0 && (
            <TouchableOpacity
              style={styles.orgJoinBtn}
              onPress={() => { setOrgModalMode('join'); setOrgInput(''); setShowOrgModal(true); }}
            >
              <Ionicons name="people-outline" size={16} color="#666" />
              <Text style={styles.orgJoinBtnText}>Join Another Organization</Text>
            </TouchableOpacity>
          )}
        </View>

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

      {/* Create / Join Org Modal */}
      <Modal
        visible={showOrgModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOrgModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {orgModalMode === 'create' ? 'Create Organization' : 'Join Organization'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {orgModalMode === 'create'
                ? 'Give your team a name to share your inventory'
                : 'Enter the invite code from your team admin'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={orgModalMode === 'create' ? 'Organization name' : 'Invite code (e.g. a3f9c2d1)'}
              placeholderTextColor="#666"
              value={orgInput}
              onChangeText={setOrgInput}
              autoFocus
              autoCapitalize={orgModalMode === 'create' ? 'words' : 'none'}
              returnKeyType="done"
              onSubmitEditing={handleOrgSubmit}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowOrgModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !orgInput.trim() && { opacity: 0.4 }]}
                onPress={handleOrgSubmit}
                disabled={!orgInput.trim()}
              >
                <Text style={styles.modalConfirmText}>
                  {orgModalMode === 'create' ? 'Create' : 'Join'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

  // ── Organization ───────────────────────────────────────────
  sectionTitle: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  orgSection: {
    marginBottom: 24,
  },
  orgEmpty: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  orgEmptyText: {
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
  },
  orgButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  orgActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 12,
  },
  orgActionBtnSecondary: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  orgActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  orgCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 10,
  },
  orgCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orgName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  orgMeta: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  orgCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  orgIconBtn: {
    padding: 4,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 10,
  },
  inviteCodeLabel: {
    color: '#666',
    fontSize: 12,
  },
  inviteCode: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    flex: 1,
  },
  memberList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  memberAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  memberName: {
    color: '#fff',
    fontSize: 13,
  },
  memberPhone: {
    color: '#666',
    fontSize: 11,
  },
  memberRole: {
    color: '#666',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  adminRole: {
    color: '#f59e0b',
  },
  orgJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderStyle: 'dashed',
  },
  orgJoinBtnText: {
    color: '#666',
    fontSize: 13,
  },

  // ── Org Modal ──────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 4,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#666',
    fontSize: 15,
  },
  modalConfirmBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
});
