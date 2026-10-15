const API_PORT = 4000;

/**
 * Works out the API base URL.
 * 1. EXPO_PUBLIC_API_URL wins when it is set (staging/production builds always set it).
 * 2. In development we reuse the host Metro is served from (e.g. "192.168.1.5:8081"),
 *    so a simulator, an emulator and a real phone on the same Wi-Fi all reach the laptop.
 */
export function resolveApiUrl(input: {
  explicitUrl: string | undefined;
  hostUri: string | undefined;
  isDev: boolean;
}): string {
  if (input.explicitUrl) return input.explicitUrl.replace(/\/+$/, '');
  if (input.isDev && input.hostUri) {
    const host = input.hostUri.split(':')[0];
    return `http://${host}:${API_PORT}`;
  }
  throw new Error('EXPO_PUBLIC_API_URL is not set. Copy apps/mobile/.env.example to .env.local.');
}
