import React, { useState, useEffect } from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';
import { getCachedImageUri, getCachedImageForPath } from '../lib/imageCache';

interface CachedImageProps {
  /** Signed URL (legacy) — will be cached using extracted storage path */
  uri?: string;
  /** Raw storage path (local-first) — signed client-side if not cached */
  storagePath?: string;
  /** Storage bucket name (required when using storagePath) */
  bucket?: string;
  style?: StyleProp<ImageStyle>;
  fallback?: React.ReactNode;
}

/**
 * Drop-in replacement for <Image source={{ uri }}>
 * Supports two modes:
 * 1. `uri` (legacy): Accepts signed URL, caches to disk
 * 2. `storagePath` + `bucket` (local-first): Signs client-side, caches to disk
 *
 * Images are downloaded exactly once per device, then served from disk forever.
 */
export default function CachedImage({ uri, storagePath, bucket, style, fallback }: CachedImageProps) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const source = storagePath || uri;
    if (!source) {
      setFailed(true);
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      try {
        let cached: string;
        if (storagePath && bucket) {
          // Local-first: sign client-side and cache
          cached = await getCachedImageForPath(bucket, storagePath);
        } else if (uri) {
          // Legacy: use signed URL directly
          cached = await getCachedImageUri(uri);
        } else {
          return;
        }
        if (!cancelled) setLocalUri(cached || uri || '');
      } catch {
        if (!cancelled) setLocalUri(uri || ''); // fallback
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
