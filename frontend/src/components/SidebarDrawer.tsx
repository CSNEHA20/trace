import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadows, Typography } from '../theme';
import { useCaseStore } from '../store/caseStore';
import { useEvidenceStore } from '../store/evidenceStore';

interface SidebarDrawerProps {
  visible: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number | string;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const pathname = usePathname();
  const activeCase = useCaseStore((state) => state.activeCase);
  const evidenceList = useEvidenceStore((state) => state.evidenceList);

  const navItems: NavItem[] = [
    { label: 'Forensic Workspace', route: '/(tabs)', icon: 'grid-outline' },
    { label: 'Evidence Vault', route: '/(tabs)/vault', icon: 'shield-checkmark-outline', badge: evidenceList.length },
    { label: 'Incident Timeline', route: '/(tabs)/timeline', icon: 'time-outline' },
    { label: 'Forensic Findings', route: '/(tabs)/analysis', icon: 'finger-print-outline' },
    { label: 'Integrity Ledger', route: '/(tabs)/ledger', icon: 'link-outline' },
    { label: 'Court Reports', route: '/(tabs)/reports', icon: 'document-text-outline' },
    { label: 'On-Device AI Engine', route: '/ai-status', icon: 'hardware-chip-outline' },
  ];

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 150);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={styles.drawer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image 
                source={require('../../assets/icon.png')} 
                style={styles.logoBadgeImg} 
                resizeMode="contain" 
              />
              <View>
                <Text style={styles.brandTitle}>TRACE FORENSICS</Text>
                <Text style={styles.brandSub}>Air-Gapped Mobile Suite</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeBtn}
              accessibilityLabel="Close Navigation Drawer"
            >
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Active Case Mini Card */}
          {activeCase && (
            <View style={styles.activeCaseBox}>
              <View style={styles.caseIndicator} />
              <View style={styles.caseInfo}>
                <Text style={styles.activeCaseLabel}>ACTIVE CASE</Text>
                <Text style={styles.activeCaseName} numberOfLines={1}>
                  {activeCase.title || activeCase.caseNumber}
                </Text>
                <Text style={styles.activeCaseId}>
                  {activeCase.caseNumber || activeCase.id} • {evidenceList.length} items
                </Text>
              </View>
            </View>
          )}

          {/* Navigation Items */}
          <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionHeader}>NAVIGATION</Text>
            {navItems.map((item) => {
              const isSelected = 
                item.route === '/(tabs)' 
                  ? (pathname === '/' || pathname === '/(tabs)' || pathname === '/index')
                  : pathname?.includes(item.route.replace('/(tabs)', ''));

              return (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.navItem, isSelected && styles.navItemActive]}
                  onPress={() => handleNavigate(item.route)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrapper, isSelected && styles.iconWrapperActive]}>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={isSelected ? Colors.primary : Colors.textMuted}
                    />
                  </View>
                  <Text style={[styles.navLabel, isSelected && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                  {item.badge !== undefined && Number(item.badge) > 0 && (
                    <View style={[styles.badge, isSelected && styles.badgeActive]}>
                      <Text style={[styles.badgeText, isSelected && styles.badgeTextActive]}>
                        {item.badge}
                      </Text>
                    </View>
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={isSelected ? Colors.primary : Colors.border}
                    style={styles.chevron}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer Security Badge */}
          <View style={styles.footer}>
            <View style={styles.securePill}>
              <Ionicons name="lock-closed" size={13} color={Colors.emerald} />
              <Text style={styles.secureText}>AIR-GAPPED SHA-256 VERIFIED</Text>
            </View>
            <Text style={styles.versionText}>Trace Forensic Engine v2.4.0</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawer: {
    width: '82%',
    maxWidth: 340,
    height: '100%',
    backgroundColor: Colors.cardBg,
    paddingTop: 54,
    paddingBottom: 24,
    paddingHorizontal: Spacing.md,
    ...Shadows.elevated,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoBadgeImg: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
  },
  brandTitle: {
    ...Typography.heroDisplay,
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 0.8,
  },
  brandSub: {
    ...Typography.subtopHeading,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  activeCaseBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    marginVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  caseIndicator: {
    width: 4,
    height: 34,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  caseInfo: {
    flex: 1,
  },
  activeCaseLabel: {
    ...Typography.subtopLabel,
    fontSize: 9,
    fontWeight: '900',
    color: Colors.primary,
  },
  activeCaseName: {
    ...Typography.displayMd,
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },
  activeCaseId: {
    ...Typography.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  navList: {
    flex: 1,
  },
  sectionHeader: {
    ...Typography.subtopLabel,
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    marginVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: Colors.primarySubtle,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  iconWrapperActive: {
    backgroundColor: Colors.primarySubtle,
  },
  navLabel: {
    ...Typography.body,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  navLabelActive: {
    ...Typography.bodyStrong,
    fontWeight: '800',
    color: Colors.primary,
  },
  badge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
  },
  badgeActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  badgeText: {
    ...Typography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  badgeTextActive: {
    color: '#ffffff',
  },
  chevron: {
    marginLeft: 2,
  },
  footer: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
    gap: 4,
  },
  securePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  secureText: {
    ...Typography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: Colors.emerald,
    letterSpacing: 0.5,
  },
  versionText: {
    ...Typography.body,
    fontSize: 10,
    color: Colors.textMuted,
  },
});