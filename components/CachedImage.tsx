import React, { useState, useEffect } from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';
import { getCachedImageUri, getCachedImageForPath, getCachedUriSync } from '../lib/imageCache';

interface CachedImageProps {
  /** Signed URL (legacy) — will be cached using extracted storage path */
  uri?: string;
  /** Raw storage path (local-first) — signed client-side if not cached */
  storagePath?: string;
  /** Storage bucket name (required when using storagePath) */
  bucket?: string;
  style?: StyleProp<ImageStyle>;
  fallback?: React.ReactNode;
  /** Called when the image has loaded successfully */
  onLoad?: () => void;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

/**
 * Drop-in replacement for <Image source={{ uri }}>
 * Supports two modes:
 * 1. `uri` (legacy): Accepts signed URL, caches to disk
 * 2. `storagePath` + `bucket` (local-first): Signs client-side, caches to disk
 *
 * Images are downloaded exactly once per device, then served from disk forever.
 */
export default function CachedImage({ uri, storagePath, bucket, style, fallback, onLoad, resizeMode }: CachedImageProps) {
  // Try sync memory cache on first render to avoid flash (critical for map markers)
  const [localUri, setLocalUri] = useState<string | null>(() => {
    const source = storagePath || uri;
    if (!source) return null;
    return getCachedUriSync(source);
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const source = storagePath || uri;
    if (!source) {
      setFailed(true);
      return;
    }

    // Check sync cache first (handles source changes after initial mount)
    const syncUri = getCachedUriSync(source);
    if (syncUri) {
      setLocalUri(syncUri);
      return;
    }

    // Not in memory cache — resolve asynchronously
    setLocalUri(null);
    let cancelled = false;

    const resolve = async () => {
      try {
        let cached: string;
        if (storagePath && bucket) {
          cached = await getCachedImageForPath(bucket, storagePath);
        } else if (uri) {
          cached = await getCachedImageUri(uri);
        } else {
          return;
        }
        if (!cancelled) setLocalUri(cached || uri || '');
      } catch {
        if (!cancelled) setLocalUri(uri || '');
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [uri, storagePath, bucket]);

  if (failed && fallback) return <>{fallback}</>;
  if (!localUri) return <View style={style} />;

  return (
    <Image
      source={{ uri: localUri }}
      style={style}
      resizeMode={resizeMode}
      onLoad={onLoad}
      onError={() => {
        if (localUri !== uri && uri) {
          setLocalUri(uri);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
