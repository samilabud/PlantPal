import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One codebase, three installable variants. Each has its own bundle id and URL scheme,
 * so a dev build, a preview build and the store build can sit side by side on one phone.
 * APP_VARIANT is set by the `start` script locally and by the build profile in eas.json.
 */
type Variant = 'development' | 'preview' | 'production';

const variant = (process.env.APP_VARIANT ?? 'production') as Variant;

const VARIANTS: Record<Variant, { name: string; id: string; scheme: string }> = {
  development: { name: 'PlantPal (Dev)', id: 'com.samilabud.plantpal.dev', scheme: 'plantpal-dev' },
  preview: {
    name: 'PlantPal (Preview)',
    id: 'com.samilabud.plantpal.preview',
    scheme: 'plantpal-preview',
  },
  production: { name: 'PlantPal', id: 'com.samilabud.plantpal', scheme: 'plantpal' },
};

const current = VARIANTS[variant];

/** "com.googleusercontent.apps.<id>": the reversed iOS client id from Google Cloud. Not secret. */
const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: current.name,
  slug: 'plantpal',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: current.scheme,
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: current.id,
    supportsTablet: false,
    usesAppleSignIn: true,
  },
  android: {
    package: current.id,
    adaptiveIcon: {
      backgroundColor: '#E8F5E9',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-apple-authentication',
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-image-picker',
      {
        photosPermission: 'PlantPal uses your photos so you can add a picture of your plant.',
        cameraPermission: 'PlantPal uses the camera so you can take a picture of your plant.',
        // We never record video, so don't even ask for the microphone.
        microphonePermission: false,
      },
    ],
    // Without Firebase this plugin only adds the iOS URL scheme, so it is added once the
    // iOS OAuth client exists. Android needs no plugin (the SHA-1 is registered in Google Cloud).
    ...(googleIosUrlScheme
      ? [
          ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }] as [
            string,
            object,
          ],
        ]
      : []),
    [
      'expo-splash-screen',
      {
        backgroundColor: '#2E7D32',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appVariant: variant,
  },
});
