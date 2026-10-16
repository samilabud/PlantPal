import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/** "v0.1.0 · staging · update 1a2b3c4d": which app and which JavaScript is running. */
export function describeUpdate(): string {
  const version = `v${Constants.expoConfig?.version ?? '?'}`;
  if (__DEV__) return `${version} · development (code from Metro)`;
  const channel = Updates.channel ?? 'no channel';
  if (Updates.isEmbeddedLaunch) return `${version} · ${channel} · built-in bundle`;
  const when = Updates.createdAt ? ` (${Updates.createdAt.toLocaleDateString()})` : '';
  return `${version} · ${channel} · update ${Updates.updateId?.slice(0, 8) ?? '?'}${when}`;
}
