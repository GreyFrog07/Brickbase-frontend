import React, { useState, useEffect } from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';
import { getCachedImageUri } from '../lib/imageCache';

interface CachedImageProps {
  uri: string;
  style?: StyleProp<ImageStyle>;
  fallback?: React.ReactNode;
}

/**
 * Drop-in replacement for <Image source={{ uri }}>
 * Automatically caches the image to local filesystem on first load.
 * Subsequent renders use the local file — no network, no signed URL needed.
 */
export default function CachedImage({ uri, style, fallback }: CachedImageProps) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uri) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    getCachedImageUri(uri).then(cached => {
      if (!cancelled) setLocalUri(cached);
    }).catch(() => {
      if (!cancelled) setLocalUri(uri); // fallback to original
    });
    return () => { cancelled = true; };
  }, [uri]);

  if (failed && fallback) return <>{fallback}</>;
  if (!localUri) return <View style={style} />;

  return (
    <Image
      source={{ uri: localUri }}
      style={style}
      onError={() => {
        // If local cache is corrupted, fall back to signed URL
        if (localUri !== uri) {
          setLocalUri(uri);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
