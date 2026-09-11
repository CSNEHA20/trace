import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
} from 'react-native';
import { palette } from '../theme';
import { ForensicReportManifest } from '../types';
import { formatHashShort, formatDate } from '../utils/crypto';

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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d1d1f',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#86868b',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 15,
    color: '#6e6e73',
  },
  content: {
    padding: 16,
  },
  scrollBody: {
    paddingBottom: 16,
  },
  statusCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  statusCardSuccess: {
    backgroundColor: '#eefcf3',
    borderColor: 'rgba(21,128,61,0.15)',
    borderWidth: 1,
  },
  statusCardWarning: {
    backgroundColor: '#fff2f2',
    borderColor: 'rgba(220,38,38,0.15)',
    borderWidth: 1,
  },
  statusTitle: {
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  statusDesc: {
    fontSize: 12,
    color: '#6e6e73',
    marginTop: 4,
    lineHeight: 17,
  },
  textSuccess: {
    color: '#15803d',
  },
  textWarning: {
    color: '#dc2626',
  },
  section: {
    marginBottom: 16,
    backgroundColor: '#f5f5f7',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d1d1f',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  label: {
    fontSize: 12,
    color: '#86868b',
  },
  val: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d1d1f',
  },
  notesText: {
    fontSize: 13,
    color: '#1d1d1f',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  evidenceRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  evidenceMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  evidenceName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1d1d1f',
  },
  evidenceType: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0066cc',
    textTransform: 'uppercase',
  },
  hashText: {
    fontSize: 11,
    color: '#86868b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  sealBox: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  sealHeader: {
    color: '#0066cc',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  sealLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#86868b',
    textTransform: 'uppercase',
  },
  sealValue: {
    fontSize: 11,
    color: '#1d1d1f',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 9999,
    backgroundColor: '#f5f5f7',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1d1d1f',
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 9999,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    shadowColor: '#0066cc',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: -0.2,
  },
});
