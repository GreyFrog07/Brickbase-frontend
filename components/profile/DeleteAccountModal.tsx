import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

type Step = 'confirm' | 'otp' | 'deleting';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function DeleteAccountModal({ visible, onClose }: Props) {
  const { user, signOut } = useAuth();
  const [step, setStep] = useState<Step>('confirm');
  const [loading, setLoading] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const otpInputRef = useRef<TextInput>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setStep('confirm');
      setOtpValue('');
      setLoading(false);
      setResendTimer(0);
    }
  }, [visible]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOTP = async () => {
    if (!user?.phone || !user?.countryCode) {
      Alert.alert('Error', 'Phone number not found on your account');
      return;
    }
    try {
      setLoading(true);
      await api.post('/auth/send-otp', {
        phone: user.phone,
        countryCode: user.countryCode,
      });
      setStep('otp');
      setResendTimer(30);
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 6);
    setOtpValue(cleaned);
    if (cleaned.length === 6) {
      setTimeout(() => handleDeleteAccount(cleaned), 300);
    }
  };

  const handleDeleteAccount = async (code: string) => {
    if (code.length < 6) {
      Alert.alert('Error', 'Please enter the complete OTP');
      return;
    }
    try {
      setLoading(true);
      setStep('deleting');
      Keyboard.dismiss();

      await api.post('/auth/delete-account', {
        phone: user?.phone,
        countryCode: user?.countryCode,
        code,
      });

      Alert.alert(
        'Account Deleted',
        'Your account and all data have been permanently deleted.',
        [{ text: 'OK', onPress: () => signOut() }],
      );
    } catch (error: any) {
      setStep('otp');
      setOtpValue('');
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to delete account. Please try again.',
      );
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    try {
      setLoading(true);
      await api.post('/auth/send-otp', {
        phone: user?.phone,
        countryCode: user?.countryCode,
      });
      setResendTimer(30);
      setOtpValue('');
      Alert.alert('Success', 'OTP sent again!');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const otpDigits = otpValue.split('');

  const renderConfirmStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.warningIcon}>
        <Ionicons name="warning" size={48} color="#ff4444" />
      </View>
      <Text style={styles.title}>Delete Account</Text>
      <Text style={styles.warningText}>
        This will permanently delete your account and all your data including:
      </Text>
      <View style={styles.bulletList}>
        <Text style={styles.bulletItem}>  All your saved properties</Text>
        <Text style={styles.bulletItem}>  All photos, videos, and files</Text>
        <Text style={styles.bulletItem}>  Your profile information</Text>
      </View>
      <Text style={styles.warningTextBold}>This action cannot be undone.</Text>
      <Text style={styles.otpNote}>
        An OTP will be sent to {user?.countryCode} {user?.phone} for verification.
      </Text>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleSendOTP}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.deleteButtonText}>Continue & Send OTP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderOtpStep = () => (
    <View style={styles.stepContent}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => { setStep('confirm'); setOtpValue(''); }}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>Verify Identity</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to {user?.countryCode} {user?.phone}
      </Text>

      <TouchableOpacity
        style={styles.otpContainer}
        activeOpacity={1}
        onPress={() => otpInputRef.current?.focus()}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[
              styles.otpBox,
              otpDigits[index] ? styles.otpBoxFilled : {},
              index === otpDigits.length ? styles.otpBoxActive : {},
            ]}
          >
            <Text style={styles.otpDigitText}>{otpDigits[index] || ''}</Text>
          </View>
        ))}
      </TouchableOpacity>

      <TextInput
        ref={otpInputRef}
        style={styles.hiddenOtpInput}
        value={otpValue}
        onChangeText={handleOtpChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        caretHidden
      />

      <TouchableOpacity
        style={[styles.deleteButton, otpValue.length < 6 && styles.buttonDisabled]}
        onPress={() => handleDeleteAccount(otpValue)}
        disabled={loading || otpValue.length < 6}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.deleteButtonText}>Delete My Account</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.resendButton}
        onPress={handleResendOTP}
        disabled={resendTimer > 0}
      >
        <Text style={[styles.resendText, resendTimer > 0 && styles.resendTextDisabled]}>
          {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderDeletingStep = () => (
    <View style={[styles.stepContent, styles.centerContent]}>
      <ActivityIndicator size="large" color="#ff4444" />
      <Text style={styles.deletingText}>Deleting your account...</Text>
      <Text style={styles.deletingSubtext}>
        Please wait while we remove all your data.
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={step !== 'deleting' ? onClose : undefined}
    >
      <View style={styles.container}>
        {step !== 'deleting' && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#999" />
          </TouchableOpacity>
        )}
        {step === 'confirm' && renderConfirmStep()}
        {step === 'otp' && renderOtpStep()}
        {step === 'deleting' && renderDeletingStep()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  stepContent: {
    flex: 1,
    paddingTop: 20,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginLeft: -8,
  },
  warningIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 32,
    lineHeight: 24,
  },
  warningText: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 12,
  },
  warningTextBold: {
    fontSize: 15,
    color: '#ff4444',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 16,
  },
  bulletList: {
    gap: 6,
    marginLeft: 4,
  },
  bulletItem: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  otpNote: {
    fontSize: 13,
    color: '#666',
    marginBottom: 24,
  },
  deleteButton: {
    backgroundColor: '#ff4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#441111',
    opacity: 0.7,
  },
  cancelButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 16,
  },
  // OTP styles (matching login screen)
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 8,
  },
  otpBox: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 52,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  otpBoxFilled: {
    borderColor: '#ff4444',
  },
  otpBoxActive: {
    borderColor: '#666',
  },
  otpDigitText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  hiddenOtpInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  resendButton: {
    alignItems: 'center',
    padding: 12,
  },
  resendText: {
    color: '#fff',
    fontSize: 14,
  },
  resendTextDisabled: {
    color: '#666',
  },
  deletingText: {
    color: '#ff4444',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
  },
  deletingSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
});
