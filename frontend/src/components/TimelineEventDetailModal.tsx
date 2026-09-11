import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ImageStyle,
  ViewStyle,
  TextStyle,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { PinchGestureHandler, PinchGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { EventRecord, EvidenceItem, ActorRecord, MediaCategory, IncidentSeverity } from '../types';
import { palette } from '../theme';
import { formatDate, formatHashShort, formatFileSize } from '../utils/crypto';
import { EvidenceVaultThumbnail } from './EvidenceVaultThumbnail';
import { databaseService } from '../services/databaseService';
import { exportService } from '../services/exportService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TimelineEventDetailModalProps {
  event: EventRecord | null;
  visible: boolean;
  onClose: () => void;
  caseId: string;
}

const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  1: palette.success,
  2: '#84cc16',
  3: palette.warning,
  4: '#f97316',
  5: palette.error,
};

const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  1: 'LOW',
  2: 'GUARDED',
  3: 'MEDIUM',
  4: 'HIGH',
  5: 'CRITICAL',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  initial_contact: 'Initial Contact',
  threat: 'Threat',
  demand: 'Demand',
  escalation: 'Escalation',
  evidence_sharing: 'Evidence Sharing',
  impersonation: 'Impersonation',
  other: 'Other',
};

const MEDIA_TYPE_LABELS: Record<MediaCategory, string> = {
  IMAGE: 'Image',
  VIDEO: 'Video',
  AUDIO: 'Audio',
  DOCUMENT: 'Document',
};

const MEDIA_TYPE_ICONS: Record<MediaCategory, string> = {
  IMAGE: '🖼️',
  VIDEO: '🎬',
  AUDIO: '🎙️',
  DOCUMENT: '📄',
};

export function TimelineEventDetailModal({
  event,
  visible,
  onClose,
  caseId,
}: TimelineEventDetailModalProps) {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [actors, setActors] = useState<ActorRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'evidence' | 'metadata' | 'actors' | 'export'>('evidence');
  const [selectedEvidenceIndex, setSelectedEvidenceIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imageScale = useSharedValue(1);
  const imageTranslateX = useSharedValue(0);
  const imageTranslateY = useSharedValue(0);

  const resetImageTransform = () => {
    imageScale.value = withSpring(1);
    imageTranslateX.value = withSpring(0);
    imageTranslateY.value = withSpring(0);
  };

  const pinchEvent = (event: PinchGestureHandlerGestureEvent) => {
    const { scale, state } = event.nativeEvent;
    
    if (state === 1) { // BEGAN
      imageScale.value = 1;
      imageTranslateX.value = 0;
      imageTranslateY.value = 0;
    } else if (state === 2) { // ACTIVE
      imageScale.value = Math.min(Math.max(scale, 1), 5);
    } else if (state === 4) { // END
      if (imageScale.value < 1.5) {
        imageScale.value = withSpring(1);
        imageTranslateX.value = withSpring(0);
        imageTranslateY.value = withSpring(0);
      }
    }
  };

  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: imageScale.value },
        { translateX: imageTranslateX.value },
        { translateY: imageTranslateY.value },
      ],
    };
  });

  const loadData = useCallback(async () => {
    if (!event) return;
    setIsLoading(true);
    setError(null);
    try {
      const [evs, acts] = await Promise.all([
        Promise.all((event.evidence_ids || []).map((id) => databaseService.getEvidenceById(id))),
        databaseService.getActorsForCase(caseId),
      ]);
      setEvidenceList(evs.filter((e): e is EvidenceItem => e !== null));
      setActors(acts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event details');
    } finally {
      setIsLoading(false);
    }
  }, [event, caseId]);

  useEffect(() => {
    if (visible && event) {
      loadData();
    }
  }, [visible, event, loadData]);

  const handleExportTimeline = async () => {
    if (!event) return;
    try {
      const activeCase = (await databaseService.getCaseById(caseId))!;
      const allEvents = await databaseService.getEventRecordsForCase(caseId);
      const allEvidence = await databaseService.getEvidenceForCase(caseId);

      const timelineData = {
        case: activeCase,
        eventCount: allEvents.length,
        evidenceCount: allEvidence.length,
        events: allEvents.map((ev) => ({
          id: ev.id,
          event_type: ev.event_type,
          severity: ev.severity,
          timestamp: ev.timestamp,
          timestamp_hint: ev.timestamp_hint,
          ai_summary: ev.ai_summary,
          user_annotation: ev.user_annotation,
          source: ev.source,
          evidence_ids: ev.evidence_ids,
          actor_ids: ev.actor_ids,
          timestamp_conflict: ev.timestamp_conflict,
          timestamp_unresolved: ev.timestamp_unresolved,
        })),
        exportedAt: Date.now(),
      };

      const jsonString = JSON.stringify(timelineData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = url;
        a.download = `TRACE_Timeline_${activeCase.caseNumber}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert(
          'Export Ready',
          `Timeline JSON exported. In a native build, this would open the share sheet.`,
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      Alert.alert('Export Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  if (!visible || !event) return null;

  const hasTimestamp = event.timestamp && event.timestamp > 0;
  const timestampText = hasTimestamp ? formatDate(event.timestamp) : 'Unresolved time';
  const severityColor = SEVERITY_COLORS[event.severity] || palette.textSecondary;
  const severityLabel = SEVERITY_LABELS[event.severity];
  const eventTypeLabel = EVENT_TYPE_LABELS[event.event_type] || event.event_type;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
              <View style={styles.headerInfo}>
                <View style={styles.eventTypeRow}>
                  <Text style={styles.eventIconLarge}>📋</Text>
                  <Text style={styles.eventTypeLarge}>{eventTypeLabel}</Text>
                </View>
                <Text style={styles.eventId}>Event ID: {event.id.substring(0, 12)}…</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <View
                style={[
                  styles.severityBadgeLarge,
                  { backgroundColor: `${severityColor}20`, borderColor: severityColor },
                ]}
              >
                <Text style={[styles.severityBadgeTextLarge, { color: severityColor }]}>
                  {severityLabel}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.tabBar}>
            {(['evidence', 'metadata', 'actors', 'export'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabButton,
                  activeTab === tab && styles.tabButtonActive,
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading event details…</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {activeTab === 'evidence' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Linked Evidence ({evidenceList.length})</Text>
                  {evidenceList.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>No evidence linked to this event</Text>
                    </View>
                  ) : (
                    evidenceList.map((ev, index) => (
                      <TouchableOpacity
                        key={ev.id}
                        style={[
                          styles.evidenceCard,
                          selectedEvidenceIndex === index && styles.evidenceCardSelected,
                        ]}
                        onPress={() => {
                          setSelectedEvidenceIndex(selectedEvidenceIndex === index ? null : index);
                          resetImageTransform();
                        }}
                      >
                        <View style={styles.evidenceCardHeader}>
                          <EvidenceVaultThumbnail
                            mediaType={ev.type}
                            fileUri={ev.fileUri}
                            size={56}
                          />
                          <View style={[styles.evidenceCardInfo, { flex: 1 }]}>
                            <View style={styles.evidenceCardTitleRow}>
                              <Text style={styles.evidenceCardName}>
                                {ev.fileName || ev.id.substring(0, 8)}
                              </Text>
                              <View
                                style={[
                                  styles.mediaTypeBadge,
                                  { backgroundColor: `${MEDIA_TYPE_COLORS[ev.type]}20` },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.mediaTypeBadgeText,
                                    { color: MEDIA_TYPE_COLORS[ev.type] },
                                  ]}
                                >
                                  {MEDIA_TYPE_ICONS[ev.type]} {MEDIA_TYPE_LABELS[ev.type]}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.evidenceCardMeta}>
                              {formatFileSize(ev.fileSize)} · {formatHashShort(ev.sha256Hash, 12)}
                            </Text>
                            <Text style={styles.evidenceCardMeta}>
                              Imported: {formatDate(ev.timestamp)}
                            </Text>
                          </View>
                          <Text style={styles.chevron}>{selectedEvidenceIndex === index ? '▲' : '▼'}</Text>
                        </View>

                        {selectedEvidenceIndex === index && (
                          <View style={styles.evidenceDetail}>
                            {ev.type === 'IMAGE' && ev.fileUri && (
                              <View style={styles.imagePreviewContainer}>
                                <PinchGestureHandler onGestureEvent={pinchEvent}>
                                  <Animated.View style={[styles.imagePreview, animatedImageStyle]}>
                                    <Image
                                      source={{ uri: ev.fileUri }}
                                      style={styles.imagePreview}
                                      resizeMode="contain"
                                    />
                                  </Animated.View>
                                </PinchGestureHandler>
                              </View>
                            )}

                            {ev.aiAnalysis?.detectedText && ev.aiAnalysis.detectedText.length > 0 && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailSectionTitle}>OCR Text</Text>
                                <Text style={styles.detailSectionText} selectable>
                                  {ev.aiAnalysis.detectedText.join('\n')}
                                </Text>
                              </View>
                            )}

                            {ev.aiAnalysis?.transcription && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailSectionTitle}>Transcription</Text>
                                <Text style={styles.detailSectionText} selectable>
                                  {ev.aiAnalysis.transcription}
                                </Text>
                              </View>
                            )}

                            <View style={styles.detailSection}>
                              <Text style={styles.detailSectionTitle}>Metadata</Text>
                              <View style={styles.metadataGrid}>
                                <View style={styles.metadataItem}>
                                  <Text style={styles.metadataLabel}>File ID</Text>
                                  <Text style={styles.metadataValue} selectable>{ev.id}</Text>
                                </View>
                                <View style={styles.metadataItem}>
                                  <Text style={styles.metadataLabel}>SHA-256 (Import)</Text>
                                  <Text style={styles.metadataValue} selectable>{ev.sha256Hash}</Text>
                                </View>
                                <View style={styles.metadataItem}>
                                  <Text style={styles.metadataLabel}>SHA-256 (Processed)</Text>
                                  <Text style={styles.metadataValue} selectable>
                                    {ev.sha256Hash || 'N/A'}
                                  </Text>
                                </View>
                                <View style={styles.metadataItem}>
                                  <Text style={styles.metadataLabel}>Media Type</Text>
                                  <Text style={styles.metadataValue}>{ev.type}</Text>
                                </View>
                                <View style={styles.metadataItem}>
                                  <Text style={styles.metadataLabel}>Import Timestamp</Text>
                                  <Text style={styles.metadataValue}>{formatDate(ev.timestamp)}</Text>
                                </View>
                                <View style={styles.metadataItem}>
                                  <Text style={styles.metadataLabel}>EXIF Timestamp</Text>
                                  <Text style={styles.metadataValue}>
                                    {ev.exifData?.dateTimeOriginal || 'N/A'}
                                  </Text>
                                </View>
                                <View style={styles.metadataItem}>
                                  <Text style={styles.metadataLabel}>File Size</Text>
                                  <Text style={styles.metadataValue}>{formatFileSize(ev.fileSize)}</Text>
                                </View>
                                <View style={styles.metadataItem}>
                                  <Text style={styles.metadataLabel}>File Name</Text>
                                  <Text style={styles.metadataValue}>{ev.fileName}</Text>
                                </View>
                                <View style={styles.metadataItem}>
                                  <Text style={styles.metadataLabel}>MIME Type</Text>
                                  <Text style={styles.metadataValue}>{ev.mimeType}</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              {activeTab === 'metadata' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Event Metadata</Text>
                  <View style={styles.metadataGrid}>
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>Event ID</Text>
                      <Text style={styles.metadataValue} selectable>{event.id}</Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>Case ID</Text>
                      <Text style={styles.metadataValue} selectable>{event.case_id}</Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>Event Type</Text>
                      <Text style={styles.metadataValue}>{eventTypeLabel}</Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>Severity</Text>
                      <Text style={[styles.metadataValue, { color: severityColor, fontWeight: 'bold' }]}>
                        {severityLabel} ({event.severity})
                      </Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>Timestamp</Text>
                      <Text style={styles.metadataValue}>
                        {hasTimestamp ? `${timestampText} (${event.timestamp})` : 'Unresolved'}
                      </Text>
                    </View>
                    {event.timestamp_hint && (
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Timestamp Hint</Text>
                        <Text style={styles.metadataValue}>{event.timestamp_hint}</Text>
                      </View>
                    )}
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>Source</Text>
                      <Text style={styles.metadataValue}>{event.source || 'system'}</Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>Timestamp Conflict</Text>
                      <Text style={styles.metadataValue}>{event.timestamp_conflict ? 'Yes ⚠️' : 'No'}</Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>Timestamp Unresolved</Text>
                      <Text style={styles.metadataValue}>{event.timestamp_unresolved ? 'Yes ⚠️' : 'No'}</Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>User Edited</Text>
                      <Text style={styles.metadataValue}>{event.user_edited ? 'Yes' : 'No'}</Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>Evidence Count</Text>
                      <Text style={styles.metadataValue}>{event.evidence_ids?.length || 0}</Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>Actor Count</Text>
                      <Text style={styles.metadataValue}>{event.actor_ids?.length || 0}</Text>
                    </View>
                  </View>

                  {event.ai_summary && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>AI Summary</Text>
                      <Text style={styles.detailSectionText} selectable>
                        {event.ai_summary}
                      </Text>
                    </View>
                  )}

                  {event.user_annotation && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Investigator Annotation</Text>
                      <Text style={styles.detailSectionText} selectable>
                        {event.user_annotation}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'actors' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Actors ({actors.length})</Text>
                  {actors.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>No actors linked to this case</Text>
                    </View>
                  ) : (
                    actors
                      .filter((actor) => event.actor_ids?.includes(actor.id))
                      .map((actor) => (
                        <View key={actor.id} style={styles.actorCard}>
                          <View style={styles.actorAvatar}>
                            <Text style={styles.actorAvatarText}>{actor.name.charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={styles.actorInfo}>
                            <Text style={styles.actorName}>{actor.name}</Text>
                            <Text style={styles.actorRole}>{actor.role}</Text>
                            {actor.contact_info && (
                              <Text style={styles.actorContact}>{actor.contact_info}</Text>
                            )}
                          </View>
                        </View>
                      ))
                  )}
                  {event.actor_ids && event.actor_ids.length > 0 && actors.length === 0 && (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>Actor records not found for linked actor IDs</Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'export' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Export Timeline</Text>
                  <Text style={styles.exportDescription}>
                    Export the complete incident timeline as JSON for external analysis or archival.
                  </Text>
                  <TouchableOpacity style={styles.exportBtn} onPress={handleExportTimeline}>
                    <Text style={styles.exportBtnText}>Export Timeline JSON</Text>
                  </TouchableOpacity>
                  <View style={styles.exportPreview}>
                    <Text style={styles.exportPreviewLabel}>Preview (current event):</Text>
                    <Text style={styles.exportPreviewText}>
                      {JSON.stringify(
                        {
                          id: event.id,
                          event_type: event.event_type,
                          severity: event.severity,
                          timestamp: event.timestamp,
                          ai_summary: event.ai_summary,
                          evidence_ids: event.evidence_ids,
                          actor_ids: event.actor_ids,
                        },
                        null,
                        2
                      )}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const MEDIA_TYPE_COLORS: Record<MediaCategory, string> = {
  IMAGE: palette.brandYellow,
  VIDEO: palette.error,
  AUDIO: palette.deepBlack,
  DOCUMENT: palette.success,
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    flex: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    color: '#6e6e73',
  },
  headerInfo: {
    flex: 1,
  },
  eventTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  eventIconLarge: {
    fontSize: 20,
  },
  eventTypeLarge: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d1d1f',
    letterSpacing: -0.3,
  },
  eventId: {
    fontSize: 11,
    color: '#86868b',
    fontFamily: 'monospace',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  severityBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  severityBadgeTextLarge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f7',
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6e6e73',
  },
  tabButtonTextActive: {
    color: '#1d1d1f',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#86868b',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#0066cc',
    borderRadius: 9999,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d1d1f',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
    borderRadius: 16,
  },
  emptyText: {
    color: '#86868b',
    fontSize: 13,
    textAlign: 'center',
  },
  evidenceCard: {
    backgroundColor: '#f5f5f7',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  evidenceCardSelected: {
    borderColor: '#0066cc',
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
  },
  evidenceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  evidenceCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  evidenceCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  evidenceCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d1d1f',
    flex: 1,
    marginRight: 8,
  },
  mediaTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    flexShrink: 0,
  },
  mediaTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  evidenceCardMeta: {
    fontSize: 11,
    color: '#86868b',
    fontFamily: 'monospace',
    marginBottom: 1,
  },
  chevron: {
    fontSize: 12,
    color: '#86868b',
  },
  evidenceDetail: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  imagePreviewContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1d1d1f',
    marginBottom: 14,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  detailSection: {
    marginBottom: 14,
  },
  detailSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#86868b',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailSectionText: {
    fontSize: 13,
    color: '#1d1d1f',
    lineHeight: 19,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  metadataGrid: {
    gap: 8,
  },
  metadataItem: {
    backgroundColor: '#f5f5f7',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  metadataLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#86868b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  metadataValue: {
    fontSize: 12,
    color: '#1d1d1f',
    fontFamily: 'monospace',
  },
  actorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f5f5f7',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  actorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e8f0fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actorAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0066cc',
  },
  actorInfo: {
    flex: 1,
  },
  actorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d1d1f',
    marginBottom: 2,
  },
  actorRole: {
    fontSize: 12,
    color: '#6e6e73',
    fontWeight: '500',
    marginBottom: 2,
  },
  actorContact: {
    fontSize: 11,
    color: '#86868b',
  },
  exportDescription: {
    color: '#6e6e73',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  exportBtn: {
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 9999,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0066cc',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  exportBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  exportPreview: {
    backgroundColor: '#f5f5f7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  exportPreviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#86868b',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  exportPreviewText: {
    fontSize: 11,
    color: '#1d1d1f',
    fontFamily: 'monospace',
    lineHeight: 17,
  },
});