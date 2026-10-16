import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getPhotoViewUrl } from '@/api';
import { localFileExists } from '@/photos/capture';
import { useColors } from '@/ui';

type Props = { photoId: string | null; localUri?: string | null; size: number; label: string };

/**
 * Shows a photo from this device's file when it has one (works offline); otherwise asks the API
 * for a 1-hour signed URL. `cacheKey` is the photo id, so a new signed URL doesn't re-download
 * an image that is already in expo-image's disk cache.
 */
export function PlantPhoto({ photoId, localUri, size, label }: Props) {
  const colors = useColors();
  const hasLocal = localFileExists(localUri ?? null);
  const [failed, setFailed] = useState(false);
  const remote = useQuery({
    queryKey: ['photo-url', photoId],
    queryFn: () => getPhotoViewUrl(photoId!),
    enabled: Boolean(photoId) && !hasLocal,
    staleTime: 50 * 60_000,
  });

  const uri = hasLocal ? localUri! : remote.data?.url;
  const box = {
    width: size,
    height: size,
    borderRadius: size / 8,
    backgroundColor: colors.surface,
  };

  // No photo, URL not ready, or the image failed to load (offline, expired URL): placeholder.
  if (!photoId || !uri || failed) {
    return (
      <View style={[styles.placeholder, box]} accessibilityLabel={label} accessible>
        <Image
          source={require('../../assets/images/logo-mark.png')}
          style={{ width: size * 0.6, height: size * 0.6 }}
          contentFit="contain"
        />
      </View>
    );
  }
  return (
    <Image
      source={{ uri, cacheKey: photoId }}
      cachePolicy="disk"
      style={box}
      contentFit="cover"
      transition={150}
      accessibilityLabel={label}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
