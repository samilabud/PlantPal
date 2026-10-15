/** Design tokens. Kept tiny on purpose: the engineering is the point of this app. */
export const palette = {
  light: {
    text: '#1B1F1B',
    textMuted: '#5B635B',
    background: '#FFFFFF',
    surface: '#F2F5F1',
    primary: '#2E7D32',
    onPrimary: '#FFFFFF',
    danger: '#B3261E',
    border: '#D9DED8',
  },
  dark: {
    text: '#E8ECE7',
    textMuted: '#A3ABA2',
    background: '#0F120F',
    surface: '#1B201B',
    primary: '#81C784',
    onPrimary: '#0F120F',
    danger: '#F2B8B5',
    border: '#2E352E',
  },
} as const;

export type Colors = { [K in keyof typeof palette.light]: string };

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20 } as const;

/** Sizes in points. Text uses these with font scaling left on, for accessibility. */
export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;
