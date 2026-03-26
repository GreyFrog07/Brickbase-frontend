import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

type Step = 'phone' | 'otp' | 'signup';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  
  const [step, setStep] = useState<Step>('phone');
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  
  // Phone step
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  // Temp tokens for new user signup flow
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [tempRefreshToken, setTempRefreshToken] = useState<string | null>(null);
  
  // OTP step - single string for autofill support
  const [otpValue, setOtpValue] = useState('');
  const otpInputRef = useRef<TextInput>(null);
  const [resendTimer, setResendTimer] = useState(0);
  
  // Signup step
  const [name, setName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  
  // Request location permission and get city
  useEffect(() => {
    requestLocationPermission();
  }, []);
  
  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);
  
  const requestLocationPermission = async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        if (address?.city) {
          setCity(address.city);
        } else if (address?.subregion) {
          setCity(address.subregion);
        } else if (address?.region) {
          setCity(address.region);
        }
      }
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setLocationLoading(false);
    }
  };
  
  const handleSendOTP = async () => {
    if (phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }
    
    try {
      setLoading(true);
      Keyboard.dismiss();
      
      await api.post('/auth/send-otp', {
        phone: phone,
        countryCode: countryCode,
      });
      
      setStep('otp');
      setResendTimer(30);
      
      // Focus OTP input
      setTimeout(() => otpInputRef.current?.focus(), 100);
      
    } catch (error: any) {
      console.error('Send OTP error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };
  
  const handleOtpChange = (value: string) => {
    // Only allow digits, max 6
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 6);
    setOtpValue(cleaned);
    
    // Auto-verify when 6 digits entered
    if (cleaned.length === 6) {
      // Small delay to let state update visually
      setTimeout(() => handleVerifyOTPWithCode(cleaned), 300);
    }
  };
  
  const handleVerifyOTPWithCode = async (code: string) => {
    if (code.length < 6) {
      Alert.alert('Error', 'Please enter the complete OTP');
      return;
    }
    
    try {
      setLoading(true);
      Keyboard.dismiss();
      
      const response = await api.post('/auth/verify-otp', {
        phone: phone,
        countryCode: countryCode,
        code: code,
      });
      
      if (response.data.userExists) {
        // Existing user - log them in
        const { token } = response.data;
        await signIn(token.access_token, token.refresh_token, token.user);
      } else {
        // New user - save temp tokens for complete-signup, go to signup form
        if (response.data.accessToken) {
          setTempToken(response.data.accessToken);
          setTempRefreshToken(response.data.refreshToken);
          await AsyncStorage.setItem('access_token', response.data.accessToken);
        }
        setStep('signup');
      }
      
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Invalid OTP');
      setOtpValue('');
      otpInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };
  
  const handleVerifyOTP = () => handleVerifyOTPWithCode(otpValue);
  
  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    
    try {
      setLoading(true);
      await api.post('/auth/send-otp', {
        phone: phone,
        countryCode: countryCode,
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
  
  const handleCompleteSignup = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Error', 'City is required. Please allow location access.');
      return;
    }
    
    try {
      setLoading(true);
      Keyboard.dismiss();
      
      const response = await api.post('/auth/complete-signup', {
        phone: phone,
        countryCode: countryCode,
        name: name.trim(),
        firmName: firmName.trim() || null,
        city: city.trim(),
        email: email.trim() || null,
        refreshToken: tempRefreshToken,
      });

      await signIn(response.data.access_token, response.data.refresh_token, response.data.user);
      
    } catch (error: any) {
      console.error('Signup error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };
  
  // Get OTP digits for visual display
  const otpDigits = otpValue.split('');
  
  const renderPhoneStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>Enter your phone number to continue</Text>
      
      <View style={styles.phoneInputContainer}>
        <View style={styles.countryCodeBox}>
          <Text style={styles.countryCodeText}>{countryCode}</Text>
        </View>
        <TextInput
          style={styles.phoneInput}
          placeholder="Phone Number"
          placeholderTextColor="#666"
          keyboardType="phone-pad"
          maxLength={10}
          value={phone}
          onChangeText={setPhone}
          autoFocus
        />
      </View>
      
      <TouchableOpacity
        style={[styles.primaryButton, (!phone || phone.length < 10) && styles.buttonDisabled]}
        onPress={handleSendOTP}
        disabled={loading || phone.length < 10}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.primaryButtonText}>Send OTP</Text>
        )}
      </TouchableOpacity>
    </View>
  );
  
  const renderOtpStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backButton} onPress={() => { setStep('phone'); setOtpValue(''); }}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to {countryCode} {phone}
      </Text>
      
      {/* Visual OTP boxes - tapping anywhere focuses the hidden input */}
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
            <Text style={styles.otpDigitText}>
              {otpDigits[index] || ''}
            </Text>
          </View>
        ))}
      </TouchableOpacity>
      
      {/* Hidden input that handles all OTP input including autofill */}
      <TextInput
        ref={otpInputRef}
        style={styles.hiddenOtpInput}
        value={otpValue}
        onChangeText={handleOtpChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        caretHidden={true}
      />
      
      <TouchableOpacity
        style={[styles.primaryButton, otpValue.length < 6 && styles.buttonDisabled]}
        onPress={handleVerifyOTP}
        disabled={loading || otpValue.length < 6}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.primaryButtonText}>Verify</Text>
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
  
  const renderSignupStep = () => (
    <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.stepContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep('otp')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.title}>Complete Profile</Text>
        <Text style={styles.subtitle}>Just a few more details to get started</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Name *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your full name"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Firm Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your firm/company name"
            placeholderTextColor="#666"
            value={firmName}
            onChangeText={setFirmName}
            autoCapitalize="words"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>City of Operations *</Text>
          <View style={styles.cityInputContainer}>
            <TextInput
              style={[styles.textInput, styles.cityInput]}
              placeholder="City"
              placeholderTextColor="#666"
              value={city}
              editable={false}
            />
            {locationLoading ? (
              <ActivityIndicator size="small" color="#999" style={styles.locationIcon} />
            ) : (
              <TouchableOpacity onPress={requestLocationPermission} style={styles.locationIcon}>
                <Ionicons name="location" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.inputHint}>Auto-detected from your location</Text>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        
        <TouchableOpacity
          style={[styles.primaryButton, (!name.trim() || !email.trim()) && styles.buttonDisabled]}
          onPress={handleCompleteSignup}
          disabled={loading || !name.trim() || !email.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.primaryButtonText}>Complete Signup</Text>
          )}
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
        {step === 'phone' && renderPhoneStep()}
        {step === 'otp' && renderOtpStep()}
        {step === 'signup' && renderSignupStep()}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContainer: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginLeft: -8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
    marginBottom: 32,
    lineHeight: 24,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  countryCodeBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  countryCodeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    letterSpacing: 2,
  },
  // OTP visual boxes
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
    borderColor: '#fff',
    backgroundColor: '#1a1a1a',
  },
  otpBoxActive: {
    borderColor: '#666',
  },
  otpDigitText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Hidden input that captures all OTP input including autofill
  hiddenOtpInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  primaryButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#333',
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
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
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  cityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cityInput: {
    flex: 1,
    backgroundColor: '#252525',
  },
  locationIcon: {
    position: 'absolute',
    right: 16,
  },
  inputHint: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
});
