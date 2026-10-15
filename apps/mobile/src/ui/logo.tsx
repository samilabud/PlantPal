import { Image } from 'expo-image';
import { useColorScheme } from 'react-native';

const SOURCES = {
  horizontal: {
    light: require('../../assets/images/logo-horizontal.png'),
    dark: require('../../assets/images/logo-horizontal-dark.png'),
    ratio: 491 / 120,
  },
  stacked: {
    light: require('../../assets/images/logo-stacked.png'),
    dark: require('../../assets/images/logo-stacked-dark.png'),
    ratio: 520 / 600,
  },
} as const;

type Props = { variant: keyof typeof SOURCES; height: number };

/**
 * The PlantPal logo. The dark variant swaps the wordmark's dark green for a light tone so it
 * stays readable on dark backgrounds. Images come from docs/brand/make_logos.py.
 */
export function Logo({ variant, height }: Props) {
  const scheme = useColorScheme();
  const source = SOURCES[variant];
  return (
    <Image
      source={scheme === 'dark' ? source.dark : source.light}
      style={{ height, width: height * source.ratio }}
      contentFit="contain"
      accessibilityRole="image"
      accessibilityLabel="PlantPal"
    />
  );
}
