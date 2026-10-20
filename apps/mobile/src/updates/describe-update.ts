import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { formatDate, t } from '@/i18n';

/** "v0.1.0 · staging · update 1a2b3c4d": which app and which JavaScript is running. */
export function describeUpdate(): string {
  const version = `v${Constants.expoConfig?.version ?? '?'}`;
  if (__DEV__) return `${version} · ${t('update.development')}`;
  const channel = Updates.channel ?? t('update.noChannel');
  if (Updates.isEmbeddedLaunch) return `${version} · ${channel} · ${t('update.builtIn')}`;
  const when = Updates.createdAt ? ` (${formatDate(Updates.createdAt)})` : '';
  return `${version} · ${channel} · ${t('update.update', { id: Updates.updateId?.slice(0, 8) ?? '?' })}${when}`;
}
