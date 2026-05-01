const fontFamily = {
  display: 'ArchivoBlack',
  bodyRegular: 'SpaceGrotesk-Regular',
  bodyMedium: 'SpaceGrotesk-Medium',
  bodyBold: 'SpaceGrotesk-Bold',
} as const;

export const typography = {
  fontFamily,
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    hero: 40,
  },
  lineHeight: {
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 38,
    hero: 46,
  },
} as const;
