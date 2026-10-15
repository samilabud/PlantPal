import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { typography } from './theme';
import { useColors } from './use-theme';

type TextProps = RNTextProps & {
  variant?: keyof typeof typography;
  muted?: boolean;
};

export function Text({ variant = 'body', muted = false, style, ...rest }: TextProps) {
  const colors = useColors();
  return (
    <RNText
      style={[typography[variant], { color: muted ? colors.textMuted : colors.text }, style]}
      {...rest}
    />
  );
}
