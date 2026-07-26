import React from 'react';
import { Image as ExpoImage } from 'expo-image';
import { StyleProp, ImageStyle } from 'react-native';

interface CachedImageProps {
  source: { uri?: string } | number;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onError?: () => void;
  onLoad?: () => void;
}

const blurhash = 'L6Pj0^jE.AjE_3j[aej[aej[aej[';

export default function CachedImage({ source, style, resizeMode = 'cover', onError, onLoad }: CachedImageProps) {
  const uri = typeof source === 'object' && 'uri' in source ? source.uri : undefined;

  if (!uri) return null;

  return (
    <ExpoImage
      source={{ uri }}
      style={style}
      contentFit={resizeMode as any}
      placeholder={blurhash}
      transition={200}
      cachePolicy="memory-disk"
      onError={onError}
      onLoad={onLoad}
    />
  );
}
