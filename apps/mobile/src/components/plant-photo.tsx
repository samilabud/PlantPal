import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { getPhotoViewUrl } from '@/api';
import { localFileExists } from '@/photos/capture';
import { Text, useColors } from '@/ui';

type Props = { photoId: string | null; localUri?: string | null; size: number; label: string };

/**
 * Shows a photo from this device's file when it has one (works offline); otherwise asks the API
 * for a 1-hour signed URL. `cacheKey` is the photo id, so a new signed URL doesn't re-download
 * an image that is already in expo-image's disk cache.
 */
export function PlantPhoto({ photoId, localUri, size, label }: Props) {
  const colors = useColors();
  const hasLocal = localFileExists(localUri ?? null);
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

  if (!photoId || !uri) {
    return (
      <View style={[styles.placeholder, box]} accessibilityLabel={label} accessible>
        <Text style={{ fontSize: size / 2.5 }}>🪴</Text>
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
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
