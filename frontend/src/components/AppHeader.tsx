import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function AppHeader({ title, subtitle, showBack, onBack, rightAction }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  // Ensure we safely clear the mobile status bar / notch / punch hole
  const safeTop = Math.max(insets.top + 10, 22);

  return (
    <View style={[styles.header, { paddingTop: safeTop }]}>
      <View style={styles.contentRow}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={palette.deepBlack} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {rightAction ? <View style={styles.rightActionContainer}>{rightAction}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: palette.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: palette.border,
    borderLeftWidth: 4,
    borderLeftColor: palette.brandYellow,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
    borderRadius: 6,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: palette.deepBlack,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textSecondary,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  rightActionContainer: {
    marginLeft: 8,
  },
});
