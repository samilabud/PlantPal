import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { newId } from '@/data/ids';
import { photosDirectory } from '@/db/database';

const MAX_WIDTH = 1280;

export type CapturedPhoto = { photoId: string; uri: string };

/**
 * Camera or library -> square crop -> resize to max 1280 px wide -> JPEG at 70% -> saved in
 * the app's documents folder (the OS won't clear it, unlike the cache). A 4 MB camera photo
 * usually ends up around 150-300 KB, which matters on mobile data and for storage costs.
 * Returns null if the user cancels or denies permission.
 */
export async function capturePhoto(source: 'camera' | 'library'): Promise<CapturedPhoto | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera permission is needed to take a photo');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;

  const asset = result.assets[0]!;
  const context = ImageManipulator.manipulate(asset.uri);
  if (!asset.width || asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });

  const dir = photosDirectory();
  dir.create({ intermediates: true, idempotent: true });
  const photoId = newId();
  const file = new File(saved.uri);
  file.move(new File(dir, `${photoId}.jpg`));
  return { photoId, uri: file.uri };
}

export const localFileSize = (uri: string) => {
  const file = new File(uri);
  return file.exists ? file.size : 0;
};

export const localFileExists = (uri: string | null) => (uri ? new File(uri).exists : false);
