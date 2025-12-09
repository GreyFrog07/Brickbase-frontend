import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import api from '../lib/api';
import { clearAllCache } from '../lib/cache';

interface User {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  countryCode?: string;
  firmName?: string;
  city?: string;
  profilePhotoUrl?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (token: string, userData: User) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  updateUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const userStr = await AsyncStorage.getItem('user');
      
      if (token && userStr) {
        const userData = JSON.parse(userStr);
        setUser(userData);
        
        // Verify token is still valid
        try {
          const response = await api.get('/auth/me');
          setUser(response.data);
          await AsyncStorage.setItem('user', JSON.stringify(response.data));
        } catch (error) {
          // Token invalid, clear
          await clearAllCache();
          await AsyncStorage.removeItem('access_token');
          await AsyncStorage.removeItem('user');
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  // New signIn that accepts token and user directly (for OTP flow)
  const signIn = async (token: string, userData: User) => {
    try {
      await AsyncStorage.setItem('access_token', token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      setUser(userData);
      router.replace('/(tabs)/add');
    } catch (error: any) {
      throw new Error('Login failed');
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    await AsyncStorage.setItem('user', JSON.stringify(updated));
  };

  const signOut = async () => {
    // Clear all cached data when user logs out
    await clearAllCache();
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('user');
    setUser(null);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
