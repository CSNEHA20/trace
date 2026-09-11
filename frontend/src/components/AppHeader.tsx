import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { SidebarDrawer } from './SidebarDrawer';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showMenu?: boolean;
  rightAction?: React.ReactNode;
}

export function AppHeader({ 
  title, 
  subtitle, 
  showBack, 
  onBack, 
  showMenu = true,
  rightAction 
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top + 8, 20);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <View style={[styles.header, { paddingTop: safeTop }]}>
        <View style={styles.contentRow}>
          {showBack ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
            </TouchableOpacity>
          ) : showMenu ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setDrawerOpen(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Open Navigation Menu"
            >
              <Ionicons name="menu-outline" size={22} color={Colors.text} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>

          {rightAction ? (
            <View style={styles.rightActionContainer}>{rightAction}</View>
          ) : (
            <View style={styles.rightPlaceholder} />
          )}
        </View>
      </View>

      <SidebarDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 12,
    backgroundColor: Colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    ...Typography.headline,
    fontSize: 21,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    ...Typography.subtopHeading,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 1,
  },
  rightActionContainer: {
    marginLeft: 8,
  },
  rightPlaceholder: {
    width: 4,
  },
});