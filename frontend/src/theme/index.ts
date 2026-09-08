import { MD3LightTheme as PaperLightTheme, adaptNavigationTheme } from 'react-native-paper';
import { DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';

export const palette = {
  // Primary Brand & Accent Colors
  brandYellow: '#F5A623',       // iQOO Brand Yellow / Amber primary
  brandAmber: '#FFBF00',        // Amber highlight / decorative geometric lines
  brandYellowBg: 'rgba(245, 166, 35, 0.12)', // Subtle highlight background
  brandYellowBorder: 'rgba(245, 166, 35, 0.4)',
  deepBlack: '#111111',         // Deep Ink Black for primary CTAs & heavy typography
  pureBlack: '#000000',         // High-contrast pitch black

  // Base & Neutral Tones
  background: '#F4F4F5',        // Light Canvas Grey: primary background across body sections
  canvasGrey: '#EFEFEF',        // Secondary canvas grey
  surface: '#FFFFFF',           // Pure White: foreground cards, pills, nav bar background
  surfaceVariant: '#EFEFEF',    // Light Canvas Grey container / chip fill
  card: '#FFFFFF',              // Pure White for foreground cards
  pillBg: '#FFFFFF',            // Pure White for pill containers
  border: '#E5E7EB',            // Border & Grid Grey: wireframe outlines, card borders
  borderDark: '#D1D5DB',        // Border & Grid Grey: fine geometric technical markings

  // Typography
  text: '#111111',              // Deep Ink Black for primary typography
  textSecondary: '#4B5563',     // Muted Text Charcoal: secondary copy, dates, metadata
  textMuted: '#6B7280',         // Secondary metadata
  brandAmberDark: '#B45309',    // High-contrast readable Amber for text on light backgrounds
  white: '#FFFFFF',             // Pure White text for dark CTAs

  // Functional Aliases
  primary: '#111111',           // Deep Ink Black for primary call-to-action buttons & heavy typography
  secondary: '#F5A623',         // iQOO Brand Yellow / Amber for accent borders, subheadings, details
  accent: '#F5A623',            // iQOO Brand Yellow / Amber for highlights & geometric lines
  highlight: '#FFBF00',         // Amber highlight

  // Status / Build Phase Accents
  success: '#16A34A',           // Build Green: "Green Light" sprint indicators & verified labels
  successBg: 'rgba(22, 163, 74, 0.12)',
  warning: '#D97706',           // High-contrast Amber / Warning status
  warningBg: 'rgba(217, 119, 6, 0.12)',
  error: '#DC2626',             // Restriction Red: "Red Light" phone-only sprint indicators & evaluation tags
  errorBg: 'rgba(220, 38, 38, 0.12)',
};

export const theme = {
  ...PaperLightTheme,
  colors: {
    ...PaperLightTheme.colors,
    primary: palette.primary,
    secondary: palette.secondary,
    background: palette.background,
    surface: palette.surface,
    surfaceVariant: palette.surfaceVariant,
    error: palette.error,
    onBackground: palette.text,
    onSurface: palette.text,
    outline: palette.border,
    outlineVariant: palette.borderDark,
    elevation: {
      ...PaperLightTheme.colors.elevation,
      level1: palette.surface,
      level2: palette.surface,
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
    background: palette.background,
    card: palette.surface,
    text: palette.text,
    border: palette.border,
    primary: palette.primary,
  },
};

