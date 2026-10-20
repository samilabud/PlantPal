import type { AppLanguage } from '@plantpal/shared';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Alert, Linking } from 'react-native';

import { hasSeen, markSeen } from '@/data/first-run';
import { getDb } from '@/db/database';
import { PRIVACY_URL } from '@/config/site';

/** Long edge sent to the AI: ⌈1024/28⌉² = 1,369 image tokens for a square photo. */
const AI_MAX_SIZE = 1024;
const AI_NOTICE_KEY = 'seenAiNotice';

/**
 * The saved photo (1280 px) resized to 1024 px for the AI call, as base64 JPEG. The resized copy
 * lands in the cache folder; it's deleted right away because only the base64 is needed.
 */
export async function prepareForAi(uri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri)
    .resize({ width: AI_MAX_SIZE, height: null })
    .renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  try {
    new File(saved.uri).delete();
  } catch {
    // The OS clears the cache folder anyway.
  }
  if (!saved.base64) throw new Error('Could not read the photo');
  return saved.base64;
}

/** The language Claude answers in. M9.3 makes this the app's active language. */
export const aiLanguage = (): AppLanguage => 'en';

/**
 * The first time someone uses the feature, say in one sentence where the photo goes, with a
 * link to the privacy policy. Only "Continue" counts as seen, so closing the dialog any other way
 * shows it again next time. Stored per account, like the first-run guide.
 */
export async function confirmAiNotice(): Promise<boolean> {
  const db = await getDb();
  if (await hasSeen(db, AI_NOTICE_KEY)) return true;
  const accepted = await new Promise<boolean>((resolve) =>
    Alert.alert(
      'Identify with AI',
      "PlantPal sends this photo to Anthropic's AI service to identify the plant. We don't keep the photo.",
      [
        {
          text: 'Privacy policy',
          onPress: () => {
            Linking.openURL(PRIVACY_URL);
            resolve(false);
          },
        },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
  if (accepted) await markSeen(db, AI_NOTICE_KEY);
  return accepted;
}
