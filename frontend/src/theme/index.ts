import { MD3DarkTheme as PaperDarkTheme, adaptNavigationTheme } from 'react-native-paper';
import { DarkTheme as NavigationDarkTheme } from '@react-navigation/native';

export const palette = {
  background: '#090D16',
  surface: '#121826',
  surfaceVariant: '#1A2332',
  card: '#1E293B',
  primary: '#00F2FE',
  secondary: '#4FACFE',
  accent: '#FF2A6D',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: '#334155',
};

export const theme = {
  ...PaperDarkTheme,
  colors: {
    ...PaperDarkTheme.colors,
    primary: palette.primary,
    secondary: palette.secondary,
    background: palette.background,
    surface: palette.surface,
    surfaceVariant: palette.surfaceVariant,
    error: palette.error,
    onBackground: palette.text,
    onSurface: palette.text,
    outline: palette.border,
  },
};

const { DarkTheme } = adaptNavigationTheme({
  reactNavigationDark: NavigationDarkTheme,
  materialDark: PaperDarkTheme,
});

export const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: palette.background,
    card: palette.surface,
    text: palette.text,
    border: palette.border,
    primary: palette.primary,
  },
};
