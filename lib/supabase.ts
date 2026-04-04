import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Sign a storage URL client-side using the user's JWT token.
 * This avoids the backend being a signing middleman (which caused egress issues).
 */
export async function signStorageUrl(bucket: string, path: string): Promise<string> {
  if (!path) return '';

  try {
    // Get the user's access token and set it on the Supabase client
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      await supabase.auth.setSession({
        access_token: token,
        refresh_token: (await AsyncStorage.getItem('refresh_token')) || '',
      });
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600); // 1 hour expiry

    if (error) {
      console.log('Error signing URL:', error.message);
      return '';
    }

    return data?.signedUrl || '';
  } catch (error) {
    console.log('Failed to sign storage URL:', error);
    return '';
  }
}

export default supabase;
