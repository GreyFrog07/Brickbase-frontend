import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const CACHE_DIR = `${FileSystem.documentDirectory}image_cache/`;

// In-memory lookup: storage_path -> local file URI
const memoryCache: Record<string, string> = {};

/**
 * Ensure the cache directory exists.
 */
let dirReady = false;
async function ensureCacheDir() {
  if (dirReady) return;
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
  dirReady = true;
}

/**
 * Convert a storage path (or signed URL) into a safe filename.
 * The storage path is the stable key — it never changes even when the signed URL rotates.
 */
function pathToFilename(storagePath: string): string {
  // Strip query params (signed token) to get the stable path
  const clean = storagePath.split('?')[0];
  // Replace slashes and special chars with underscores
  return clean.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Extract the storage path from a signed URL.
 * Signed URLs look like: https://xxx.supabase.co/storage/v1/object/sign/bucket/path/file.jpg?token=...
 * We want: path/file.jpg
 */
function extractStoragePath(signedUrl: string): string {
  if (!signedUrl.startsWith('http')) return signedUrl;
  try {
    const url = new URL(signedUrl);
    const parts = url.pathname.split('/');
    // Find "sign" or "public", skip bucket name, take the rest
    for (let i = 0; i < parts.length; i++) {
      if ((parts[i] === 'sign' || parts[i] === 'public') && i + 2 < parts.length) {
        return parts.slice(i + 2).join('/');
      }
    }
  } catch {}
  return signedUrl;
}

/**
 * Get a locally cached URI for an image, or download it from the signed URL.
 *
 * @param signedUrl - The signed Supabase URL (expires in ~1hr)
 * @returns Local file:// URI that never expires
 */
export async function getCachedImageUri(signedUrl: string): Promise<string> {
  if (!signedUrl) return '';

  const storagePath = extractStoragePath(signedUrl);
  const filename = pathToFilename(storagePath);

  // 1. Check in-memory cache (fastest)
  if (memoryCache[filename]) return memoryCache[filename];

  await ensureCacheDir();
  const localUri = CACHE_DIR + filename;

  // 2. Check if file exists on disk
  const info = await FileSystem.getInfoAsync(localUri);
  if (info.exists && info.size && info.size > 0) {
    memoryCache[filename] = localUri;
    return localUri;
  }

  // 3. Download from signed URL and save locally
  try {
    const result = await FileSystem.downloadAsync(signedUrl, localUri);
    if (result.status === 200) {
      memoryCache[filename] = localUri;
      return localUri;
    }
  } catch (error) {
    console.log('Image cache download failed, using signed URL:', error);
  }

  // Fallback to signed URL if download fails
  return signedUrl;
}

/**
 * Cache a local image (e.g. from camera/picker) using its storage path as key.
 * Call this right after upload so we never need to download it back.
 */
export async function cacheLocalImage(storagePath: string, localUri: string): Promise<void> {
  if (!storagePath || !localUri) return;
  const filename = pathToFilename(storagePath);
  await ensureCacheDir();
  const destUri = CACHE_DIR + filename;

  try {
    // Copy the local file into our cache directory
    await FileSystem.copyAsync({ from: localUri, to: destUri });
    memoryCache[filename] = destUri;
  } catch (error) {
    console.log('Failed to cache local image:', error);
  }
}

/**
 * Get cache size in bytes.
 */
export async function getImageCacheSize(): Promise<number> {
  await ensureCacheDir();
  const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
  let total = 0;
  for (const file of files) {
    const info = await FileSystem.getInfoAsync(CACHE_DIR + file);
    if (info.exists && info.size) total += info.size;
  }
  return total;
}

/**
 * Clear entire image cache.
 */
export async function clearImageCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    dirReady = false;
    Object.keys(memoryCache).forEach(k => delete memoryCache[k]);
  } catch (error) {
    console.log('Failed to clear image cache:', error);
  }
}
