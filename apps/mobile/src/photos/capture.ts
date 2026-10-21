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
  return savePickedAsset(result.assets[0]!);
}

/**
 * Android can close PlantPal's activity while the camera or the crop screen is open (it reclaims
 * memory; Xiaomi phones do it often). The photo is then lost to the call above, but the picker
 * keeps it: this returns it, saved like any other photo, or null when there is nothing pending.
 * Call it when a screen that takes photos opens and when the app comes back to the front.
 */
export async function recoverPendingPhoto(): Promise<CapturedPhoto | null> {
  const pending = await ImagePicker.getPendingResultAsync();
  if (!pending || !('canceled' in pending) || pending.canceled) return null;
  const asset = pending.assets?.[0];
  // If Android closed the app during the camera, the crop step never ran: square it here.
  return asset ? savePickedAsset(asset, { square: true }) : null;
}

async function savePickedAsset(
  asset: ImagePicker.ImagePickerAsset,
  { square = false }: { square?: boolean } = {},
): Promise<CapturedPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (square && asset.width && asset.height && asset.width !== asset.height) {
    const side = Math.min(asset.width, asset.height);
    context.crop({
      originX: Math.floor((asset.width - side) / 2),
      originY: Math.floor((asset.height - side) / 2),
      width: side,
      height: side,
    });
  }
  const width =
    square && asset.width && asset.height ? Math.min(asset.width, asset.height) : asset.width;
  if (!width || width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });

  const dir = photosDirectory();
  dir.create({ intermediates: true, idempotent: true });
  const photoId = newId();
  // Keep our own reference to the destination: don't rely on move() updating the source's uri.
  const destination = new File(dir, `${photoId}.jpg`);
  new File(saved.uri).move(destination);
  return { photoId, uri: destination.uri };
}

export const localFileSize = (uri: string) => {
  const file = new File(uri);
  return file.exists ? file.size : 0;
};

export const localFileExists = (uri: string | null) => (uri ? new File(uri).exists : false);
