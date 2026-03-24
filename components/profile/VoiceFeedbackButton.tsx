import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Alert,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';

const MIN_DURATION_MS = 1000;
const MIC_SIZE = 56;

export default function VoiceFeedbackButton() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const startTimeRef = useRef<number>(0);
  const isRecordingRef = useRef(false);

  const dotOpacity = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const labelOffset = useRef(new Animated.Value(0)).current;
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(dotOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();

      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      return () => {
        pulse.stop();
        dotOpacity.setValue(1);
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    if (isSending || sent || isRecordingRef.current) return;

    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission needed', 'Please allow microphone access to send voice feedback.');
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();

      startTimeRef.current = Date.now();
      isRecordingRef.current = true;
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Could not start recording');
    }
  }, [isSending, sent, recorder]);

  const stopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.parallel([
      Animated.sequence([
        Animated.spring(buttonScale, { toValue: 1.5, useNativeDriver: true, speed: 50 }),
        Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }),
      ]),
      Animated.spring(labelOffset, { toValue: 0, useNativeDriver: true }),
    ]).start();

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const durationMs = Date.now() - startTimeRef.current;
      if (durationMs < MIN_DURATION_MS) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      const uri = recorder.uri;
      if (!uri) {
        Alert.alert('Error', 'Recording failed');
        return;
      }

      setIsSending(true);
      const durationSec = durationMs / 1000;

      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'audio/m4a',
        name: 'feedback.m4a',
      } as any);
      formData.append('duration', durationSec.toFixed(1));

      await api.post('/upload/voice-feedback', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setIsSending(false);
      setSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setSent(false), 2500);
    } catch (error) {
      console.error('Failed to send voice feedback:', error);
      setIsSending(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to send feedback. Please try again.');
    }
  }, [recorder]);

  // Refs so PanResponder always calls latest function versions
  const startRef = useRef(startRecording);
  startRef.current = startRecording;
  const stopRef = useRef(stopRecording);
  stopRef.current = stopRecording;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Animated.parallel([
          Animated.spring(buttonScale, { toValue: 1.45, useNativeDriver: true }),
          Animated.spring(labelOffset, { toValue: 14, useNativeDriver: true }),
        ]).start();
        startRef.current();
      },
      onPanResponderRelease: () => {
        stopRef.current();
      },
      onPanResponderTerminate: () => {
        stopRef.current();
      },
    })
  ).current;

  return (
    <View style={styles.wrapper}>
      <View style={styles.hitArea} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.micButton,
            isRecording && styles.micButtonRecording,
            isSending && styles.micButtonSending,
            sent && styles.micButtonSent,
            { transform: [{ scale: buttonScale }] },
          ]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#999" />
          ) : sent ? (
            <Ionicons name="checkmark" size={24} color="#fff" />
          ) : (
            <Ionicons
              name={isRecording ? 'mic' : 'mic-outline'}
              size={24}
              color="#fff"
            />
          )}
        </Animated.View>
      </View>

      <Animated.View style={[styles.labelContainer, { transform: [{ translateY: labelOffset }] }]}>
        {isRecording ? (
          <>
            <View style={styles.recordingRow}>
              <Animated.View style={[styles.redDot, { opacity: dotOpacity }]} />
              <Text style={styles.recordingText}>{formatDuration(recordingDuration)}</Text>
            </View>
            <Text style={styles.hint}>Release to send</Text>
          </>
        ) : sent ? (
          <Text style={styles.sentText}>Sent</Text>
        ) : isSending ? (
          <Text style={styles.sendingText}>Sending...</Text>
        ) : (
          <>
            <Text style={styles.title}>Voice Feedback</Text>
            <Text style={styles.hint}>Hold to record</Text>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  hitArea: {
    width: 200,
    height: MIC_SIZE + 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButton: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  micButtonRecording: {
    borderColor: '#fff',
    borderWidth: 2,
    backgroundColor: '#1a1a1a',
  },
  micButtonSending: {
    backgroundColor: '#1a1a1a',
    borderColor: '#333',
  },
  micButtonSent: {
    backgroundColor: '#1a1a1a',
    borderColor: '#333',
  },
  labelContainer: {
    alignItems: 'center',
    minHeight: 32,
  },
  title: {
    color: '#999',
    fontSize: 13,
  },
  hint: {
    color: '#444',
    fontSize: 11,
    marginTop: 2,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff4444',
  },
  recordingText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
  },
  sentText: {
    color: '#999',
    fontSize: 13,
  },
  sendingText: {
    color: '#666',
    fontSize: 13,
  },
});
