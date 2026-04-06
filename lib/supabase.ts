import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Sign a storage URL client-side using the user's JWT token.
 * This avoids the backend being a signing middleman (which caused egress issues).
 */
/**
 * Ensure the Supabase client has a valid session set.
 * Call this before any storage operation.
 */
async function ensureSession(): Promise<void> {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: (await AsyncStorage.getItem('refresh_token')) || '',
    });
  }
}

export async function signStorageUrl(bucket: string, path: string): Promise<string> {
  if (!path) return '';

  try {
    await ensureSession();

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

// ── User folder name (cached per session) ─────────────────────────────

let cachedUserFolder: string | null = null;

export async function getUserFolder(): Promise<string> {
  if (cachedUserFolder) return cachedUserFolder;

  try {
    await ensureSession();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user');

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, name, country_code')
      .eq('id', user.id)
      .single();

    if (profile?.phone && profile?.name) {
      const rawPhone = ((profile.country_code || '+91') + profile.phone).replace(/\+| /g, '');
      const safeName = profile.name.trim().replace(/ /g, '-').replace(/[^\w-]/g, '').slice(0, 50) || 'unknown';
      cachedUserFolder = `${rawPhone}_${safeName}_${user.id}`;
    } else {
      cachedUserFolder = user.id;
    }

    return cachedUserFolder;
  } catch (error) {
    console.log('Failed to get user folder:', error);
    // Fallback: use user ID from stored token
    const { data: { user } } = await supabase.auth.getUser();
    cachedUserFolder = user?.id || 'unknown';
    return cachedUserFolder;
  }
}

export function clearUserFolderCache() {
  cachedUserFolder = null;
}

// ── Direct upload to Supabase Storage ─────────────────────────────────

const MAX_UPLOAD_RETRIES = 3;

/**
 * Upload a file directly to Supabase Storage using the REST API + FormData.
 * FormData streams from disk — never loads the entire file into RAM.
 * Retries up to 3 times with exponential backoff.
 *
 * Returns the storage path (not a URL).
 */
export async function uploadToStorage(
  bucket: string,
  storagePath: string,
  fileUri: string,
  contentType: string,
): Promise<string> {
  await ensureSession();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No auth session for upload');

  const filename = storagePath.split('/').pop() || 'file';

  for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
    try {
      const formData = new FormData();
      formData.append('', {
        uri: fileUri,
        type: contentType,
        name: filename,
      } as any);

      const response = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${bucket}/${storagePath}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: formData,
        }
      );

      if (response.ok) return storagePath;

      const errorText = await response.text();

      // Duplicate file = already uploaded (race or retry) — treat as success
      if (response.status === 409) return storagePath;

      throw new Error(`HTTP ${response.status}: ${errorText}`);
    } catch (error: any) {
      console.warn(`Upload attempt ${attempt}/${MAX_UPLOAD_RETRIES} failed:`, error.message);
      if (attempt === MAX_UPLOAD_RETRIES) {
        throw new Error(`Upload failed after ${MAX_UPLOAD_RETRIES} attempts: ${error.message}`);
      }
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  return storagePath;
}

export default supabase;
