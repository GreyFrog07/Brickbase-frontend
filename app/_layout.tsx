import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
      
      if (!user) {
        router.replace('/login');
      } else {
        router.replace('/(tabs)/add');
      }
    }
  }, [user, loading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="property-details" options={{ 
        presentation: 'modal',
        headerShown: true,
        headerTitle: 'Property Details',
        headerStyle: { backgroundColor: '#1a1a1a' },
        headerTintColor: '#fff'
      }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
