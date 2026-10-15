import { useColorScheme } from 'react-native';

import { palette, type Colors } from './theme';

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}
