import { Platform } from 'react-native';
import { MD3LightTheme as PaperLightTheme, adaptNavigationTheme } from 'react-native-paper';
import { DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';

/**
 * TRACE Typographic & Visual Design System
 * 
 * Hierarchy:
 * 1. Important Titles / Key Headings: 'MangoGrotesque' (Condensed Ultra-Bold Grotesque)
 * 2. Subtop / Category / Sections: 'MaghfireaSerif' (High-contrast Modern Serif)
 * 3. Content / Body / Data / Metadata: 'MattoneSans' (Wide bold geometric sans)
 */

export const colors = {
  primary: '#0066cc',
  primaryFocus: '#0071e3',
  primaryOnDark: '#2997ff',
  primaryHover: '#0077ed',
  primarySubtle: 'rgba(0, 102, 204, 0.09)',
  primaryBorder: 'rgba(0, 102, 204, 0.3)',

  ink: '#0a0a0c',               // Pitch black for maximum contrast and sharpness
  body: '#16161a',              // Solid deep charcoal for rich legibility
  bodyOnDark: '#ffffff',
  bodyMuted: '#585862',         // High contrast secondary
  inkMuted80: '#222228',
  inkMuted48: '#585862',
  white: '#ffffff',

  canvas: '#ffffff',
  canvasParchment: '#f4f5f8',   // Crisp, clear off-white
  surfacePearl: '#fbfbfd',
  surfaceTile1: '#272729',
  surfaceTile2: '#2a2a2c',
  surfaceTile3: '#252527',
  surfaceBlack: '#000000',
  surfaceChipTranslucent: 'rgba(210, 210, 215, 0.64)',
  surfaceFrosted: 'rgba(245, 245, 247, 0.85)',
  surfaceFrostedDark: 'rgba(29, 29, 31, 0.85)',

  hairline: '#dcdce4',
  hairlineLight: 'rgba(0, 0, 0, 0.08)',
  dividerSoft: '#e8e8f0',
  borderDark: '#bfbfc8',

  success: '#059669',
  successBg: 'rgba(5, 150, 105, 0.14)',
  successBorder: 'rgba(5, 150, 105, 0.4)',

  warning: '#d97706',
  warningBg: 'rgba(217, 119, 6, 0.14)',
  warningBorder: 'rgba(217, 119, 6, 0.4)',

  error: '#dc2626',
  errorBg: 'rgba(220, 38, 38, 0.14)',
  errorBorder: 'rgba(220, 38, 38, 0.4)',

  info: '#4f46e5',
  infoBg: 'rgba(79, 70, 229, 0.14)',
  infoBorder: 'rgba(79, 70, 229, 0.4)',
};

export const Colors = {
  ...colors,
  text: colors.ink,
  textSecondary: colors.bodyMuted,
  textMuted: colors.inkMuted48,
  cardBg: colors.canvas,
  surface: colors.canvasParchment,
  border: colors.hairlineLight,
  emerald: colors.success,
  amber: colors.warning,
  crimson: colors.error,
};

export const palette = {
  ...colors,
  brandYellow: colors.primary,
  brandAmber: colors.warning,
  brandYellowBg: colors.primarySubtle,
  brandYellowBorder: colors.primaryBorder,
  deepBlack: colors.ink,
  pureBlack: colors.surfaceBlack,
  background: colors.canvasParchment,
  canvasGrey: colors.canvasParchment,
  surface: colors.canvas,
  surfaceVariant: colors.canvasParchment,
  card: colors.canvas,
  pillBg: colors.canvas,
  border: colors.hairline,
  text: colors.ink,
  textSecondary: colors.bodyMuted,
  textMuted: colors.inkMuted48,
  brandAmberDark: '#b45309',
  secondary: colors.primary,
  accent: colors.primary,
  highlight: colors.primary,
};

export const rounded = {
  none: 0,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 9999,
  full: 9999,
};

export const Radius = rounded;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  fontFamily: 'MattoneSans',
  fontFamilyText: 'MattoneSans',
  fontFamilyMono: Platform.select({ ios: 'SF Mono, Menlo', android: 'monospace', default: 'monospace' }),
  fontFamilyDisplay: 'MangoGrotesque',
  fontFamilySerif: 'MaghfireaSerif',

  // ── 1. IMPORTANT HEADINGS (Mango Grotesque) ──
  heroDisplay: {
    fontFamily: 'MangoGrotesque',
    fontSize: 30,
    fontWeight: 'normal' as const,
    lineHeight: 34,
    color: colors.ink,
  },
  displayLg: {
    fontFamily: 'MangoGrotesque',
    fontSize: 25,
    fontWeight: 'normal' as const,
    lineHeight: 29,
    color: colors.ink,
  },
  displayMd: {
    fontFamily: 'MangoGrotesque',
    fontSize: 21,
    fontWeight: 'normal' as const,
    lineHeight: 25,
    color: colors.ink,
  },
  headline: {
    fontFamily: 'MangoGrotesque',
    fontSize: 20,
    fontWeight: 'normal' as const,
    lineHeight: 24,
    color: colors.ink,
  },

  // ── 2. SUBTOP / SECTION LABELS (Maghfirea Serif) ──
  subtopHeading: {
    fontFamily: 'MaghfireaSerif',
    fontSize: 16,
    fontWeight: 'bold' as const,
    letterSpacing: 0.2,
    color: colors.ink,
  },
  subtopLabel: {
    fontFamily: 'MaghfireaSerif',
    fontSize: 12,
    fontWeight: 'bold' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: colors.bodyMuted,
  },
  tagline: {
    fontFamily: 'MaghfireaSerif',
    fontSize: 11,
    fontWeight: 'bold' as const,
    letterSpacing: 1.0,
    textTransform: 'uppercase' as const,
    color: colors.bodyMuted,
  },

  // ── 3. CONTENT / BODY / DATA (Mattone Sans) ──
  body: {
    fontFamily: 'MattoneSans',
    fontSize: 14,
    fontWeight: 'bold' as const,
    lineHeight: 21,
    color: colors.body,
  },
  bodyStrong: {
    fontFamily: 'MattoneSans',
    fontSize: 14,
    fontWeight: 'bold' as const,
    lineHeight: 21,
    color: colors.ink,
  },
  caption: {
    fontFamily: 'MattoneSans',
    fontSize: 12,
    fontWeight: 'bold' as const,
    color: colors.bodyMuted,
  },
  captionStrong: {
    fontFamily: 'MattoneSans',
    fontSize: 12,
    fontWeight: 'bold' as const,
    color: colors.ink,
  },
  finePrint: {
    fontFamily: 'MattoneSans',
    fontSize: 11,
    fontWeight: 'bold' as const,
    color: colors.inkMuted48,
  },
  mono: {
    fontFamily: Platform.select({ ios: 'SF Mono, Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    color: colors.ink,
  },
};

export const Typography = typography;

export const shadows = {
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  product: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 7,
  },
};

export const Shadows = shadows;

export const theme = {
  ...PaperLightTheme,
  colors: {
    ...PaperLightTheme.colors,
    primary: colors.primary,
    secondary: colors.primary,
    background: colors.canvasParchment,
    surface: colors.canvas,
    surfaceVariant: colors.canvasParchment,
    error: colors.error,
    onBackground: colors.ink,
    onSurface: colors.ink,
    outline: colors.hairline,
    outlineVariant: colors.dividerSoft,
    elevation: {
      ...PaperLightTheme.colors.elevation,
      level1: colors.canvas,
      level2: colors.surfacePearl,
    },
  },
};

const { LightTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  materialLight: PaperLightTheme,
});

export const navigationTheme = {
  ...LightTheme,
  colors: {
    ...LightTheme?.colors,
    background: colors.canvasParchment,
    card: colors.canvas,
    text: colors.ink,
    border: colors.hairline,
    primary: colors.primary,
  },
};