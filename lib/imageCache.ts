import { File, Directory, Paths } from 'expo-file-system';
import { signStorageUrl } from './supabase';

const CACHE_DIR = new Directory(Paths.document, 'image_cache');

// In-memory lookup: filename -> local file URI
const memoryCache: Record<string, string> = {};

/**
 * Ensure the cache directory exists (synchronous with new API).
 */
let dirReady = false;
function ensureCacheDir() {
  if (dirReady) return;
  if (!CACHE_DIR.exists) {
    CACHE_DIR.create({ intermediates: true });
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

  // Local file URIs (from camera/picker) — use directly, no caching needed
  if (signedUrl.startsWith('file://') || signedUrl.startsWith('/')) return signedUrl;

  const storagePath = extractStoragePath(signedUrl);
  const filename = pathToFilename(storagePath);

  // 1. Check in-memory cache (fastest)
  if (memoryCache[filename]) return memoryCache[filename];

  ensureCacheDir();
  const file = new File(CACHE_DIR, filename);

  // 2. Check if file exists on disk
  if (file.exists && file.size > 0) {
    memoryCache[filename] = file.uri;
    return file.uri;
  }

  // 3. Download from signed URL and save locally
  try {
    const downloaded = await File.downloadFileAsync(signedUrl, file, { idempotent: true });
    memoryCache[filename] = downloaded.uri;
    return downloaded.uri;
  } catch (error: any) {
    // Another CachedImage may have downloaded it concurrently — check again
    if (file.exists && file.size > 0) {
      memoryCache[filename] = file.uri;
      return file.uri;
    }
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
  ensureCacheDir();
  const destFile = new File(CACHE_DIR, filename);

  try {
    // Skip if already cached (e.g. concurrent call or retry)
    if (destFile.exists && destFile.size > 0) {
      memoryCache[filename] = destFile.uri;
      return;
    }
    const sourceFile = new File(localUri);
    sourceFile.copy(destFile);
    memoryCache[filename] = destFile.uri;
  } catch (error: any) {
    // Race condition: another call cached it first
    if (destFile.exists && destFile.size > 0) {
      memoryCache[filename] = destFile.uri;
      return;
    }
    console.log('Failed to cache local image:', error);
  }
}

/**
 * Synchronous check of in-memory cache only.
 * Returns a file:// URI if the image was previously resolved in this session, or null.
 * Use this for instant rendering without async delay (e.g. map markers).
 */
export function getCachedUriSync(identifier: string): string | null {
  if (!identifier) return null;
  if (identifier.startsWith('file://') || identifier.startsWith('/')) return identifier;
  const filename = pathToFilename(identifier);
  return memoryCache[filename] || null;
}

/**
 * Get cache size in bytes.
 */
export async function getImageCacheSize(): Promise<number> {
  ensureCacheDir();
  const entries = CACHE_DIR.list();
  let total = 0;
  for (const entry of entries) {
    if (entry instanceof File) {
      total += entry.size || 0;
    }
  }
  return total;
}

/**
 * Get a locally cached URI for an image using its raw storage path.
 * Signs the URL client-side if not cached, then downloads and caches it.
 * A photo is signed + downloaded exactly ONCE per device, then served from disk forever.
 *
 * @param bucket - Storage bucket name (e.g. 'property-photos')
 * @param storagePath - Raw storage path (e.g. 'user_folder/property_id/photo.jpg')
 * @returns Local file:// URI
 */
export async function getCachedImageForPath(bucket: string, storagePath: string): Promise<string> {
  if (!storagePath) return '';

  const filename = pathToFilename(storagePath);

  // 1. Check in-memory cache (fastest)
  if (memoryCache[filename]) return memoryCache[filename];

  ensureCacheDir();
  const file = new File(CACHE_DIR, filename);

  // 2. Check if file exists on disk
  if (file.exists && file.size > 0) {
    memoryCache[filename] = file.uri;
    return file.uri;
  }

  // 3. Sign URL client-side, download, and cache
  try {
    const signedUrl = await signStorageUrl(bucket, storagePath);
    if (!signedUrl) return '';

    const downloaded = await File.downloadFileAsync(signedUrl, file, { idempotent: true });
    memoryCache[filename] = downloaded.uri;
    return downloaded.uri;
  } catch (error: any) {
    // Another CachedImage may have downloaded it concurrently — check again
    if (file.exists && file.size > 0) {
      memoryCache[filename] = file.uri;
      return file.uri;
    }
    console.log('Image cache download from path failed:', error);
  }

  return '';
}

/**
 * Clear entire image cache.
 */
export async function clearImageCache(): Promise<void> {
  try {
    if (CACHE_DIR.exists) {
      CACHE_DIR.delete();
    }
    dirReady = false;
    Object.keys(memoryCache).forEach(k => delete memoryCache[k]);
  } catch (error) {
    console.log('Failed to clear image cache:', error);
  }
}
