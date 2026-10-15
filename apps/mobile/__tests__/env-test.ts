import { resolveApiUrl } from '@/config/resolve-api-url';

describe('resolveApiUrl', () => {
  it('prefers the explicit URL and strips trailing slashes', () => {
    expect(
      resolveApiUrl({
        explicitUrl: 'https://api.example.com/',
        hostUri: '10.0.0.2:8081',
        isDev: true,
      }),
    ).toBe('https://api.example.com');
  });

  it('derives the URL from the Metro host in development', () => {
    expect(
      resolveApiUrl({ explicitUrl: undefined, hostUri: '192.168.1.5:8081', isDev: true }),
    ).toBe('http://192.168.1.5:4000');
  });

  it('throws in a release build without an explicit URL', () => {
    expect(() => resolveApiUrl({ explicitUrl: '', hostUri: undefined, isDev: false })).toThrow(
      /EXPO_PUBLIC_API_URL/,
    );
  });
});
