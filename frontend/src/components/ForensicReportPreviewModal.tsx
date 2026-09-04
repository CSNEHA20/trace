import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
} from 'react-native';
import { palette } from '../theme';
import { ForensicReportManifest } from '../types';
import { formatHashShort, formatDate } from '../utils/cryptoUtils';

interface ForensicReportPreviewModalProps {
  visible: boolean;
  manifest: ForensicReportManifest | null;
  pdfUri?: string;
  onClose: () => void;
  onShare: () => void;
}

export const ForensicReportPreviewModal: React.FC<ForensicReportPreviewModalProps> = ({
  visible,
  manifest,
  pdfUri,
  onClose,
  onShare,
}) => {
  if (!manifest) return null;

  const isIntact = manifest.tamperedEvidenceCount === 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Forensic Report Preview</Text>
              <Text style={styles.subtitle}>Case #{manifest.caseNumber}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.scrollBody}>
            {/* Integrity Status Card */}
            <View style={[styles.statusCard, isIntact ? styles.statusCardSuccess : styles.statusCardWarning]}>
              <Text style={[styles.statusTitle, isIntact ? styles.textSuccess : styles.textWarning]}>
                {isIntact ? '✓ FORENSIC INTEGRITY VERIFIED' : '⚠️ TAMPERING DETECTED IN EVIDENCE'}
              </Text>
              <Text style={styles.statusDesc}>
                {isIntact
                  ? `All ${manifest.evidenceCount} evidence items match original SHA-256 hashes.`
                  : `${manifest.tamperedEvidenceCount} of ${manifest.evidenceCount} evidence items failed hash verification.`}
              </Text>
            </View>

            {/* Case Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Case Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Agency:</Text>
                <Text style={styles.val}>{manifest.agencyName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Investigator:</Text>
                <Text style={styles.val}>{manifest.investigatorName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Generated:</Text>
                <Text style={styles.val}>{formatDate(manifest.generatedAt)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Evidence Count:</Text>
                <Text style={styles.val}>{manifest.evidenceCount} items</Text>
              </View>
            </View>

            {/* Remarks */}
            {manifest.investigatorNotes ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Investigator Notes</Text>
                <Text style={styles.notesText}>{manifest.investigatorNotes}</Text>
              </View>
            ) : null}

            {/* Evidence Items List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Evidence Manifest ({manifest.evidenceItems.length})</Text>
              {manifest.evidenceItems.map((item, idx) => (
                <View key={item.id || idx} style={styles.evidenceRow}>
                  <View style={styles.evidenceMain}>
                    <Text style={styles.evidenceName}>{idx + 1}. {item.fileName}</Text>
                    <Text style={styles.evidenceType}>{item.mediaType}</Text>
                  </View>
                  <Text style={styles.hashText}>SHA-256: {formatHashShort(item.sha256Hash)}</Text>
                </View>
              ))}
            </View>

            {/* Cryptographic Seal */}
            <View style={styles.sealBox}>
              <Text style={styles.sealHeader}>🔒 CRYPTOGRAPHIC PROOF SEAL</Text>
              <Text style={styles.sealLabel}>Manifest Hash (SHA-256):</Text>
              <Text style={styles.sealValue}>{manifest.manifestHash}</Text>

              <Text style={[styles.sealLabel, { marginTop: 8 }]}>Digital Signature:</Text>
              <Text style={styles.sealValue}>{manifest.digitalSignature}</Text>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={onShare}>
              <Text style={styles.primaryButtonText}>Export / Share PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: palette.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    fontSize: 18,
    color: palette.textSecondary,
  },
  content: {
    padding: 16,
  },
  scrollBody: {
    paddingBottom: 16,
  },
  statusCard: {
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusCardSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    borderWidth: 1,
  },
  statusCardWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  statusTitle: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  statusDesc: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 4,
  },
  textSuccess: {
    color: '#10b981',
  },
  textWarning: {
    color: '#ef4444',
  },
  section: {
    marginBottom: 16,
    backgroundColor: palette.surface,
    padding: 12,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: palette.primary,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  label: {
    fontSize: 12,
    color: palette.textSecondary,
  },
  val: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  notesText: {
    fontSize: 12,
    color: palette.textPrimary,
    fontStyle: 'italic',
  },
  evidenceRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  evidenceMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  evidenceName: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  evidenceType: {
    fontSize: 10,
    fontWeight: 'bold',
    color: palette.primary,
  },
  hashText: {
    fontSize: 10,
    color: palette.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  sealBox: {
    backgroundColor: '#181825',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  sealHeader: {
    color: '#89b4fa',
    fontWeight: 'bold',
    fontSize: 11,
    marginBottom: 6,
  },
  sealLabel: {
    fontSize: 10,
    color: '#a6adc8',
  },
  sealValue: {
    fontSize: 10,
    color: '#cdd6f4',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: palette.primary,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
