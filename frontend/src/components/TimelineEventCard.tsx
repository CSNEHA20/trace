import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ImageStyle, ViewStyle, TextStyle } from 'react-native';
import Svg, { Line, Circle, Rect } from 'react-native-svg';
import { EventRecord, EvidenceItem, MediaCategory, IncidentSeverity } from '../types';
import { palette } from '../theme';
import { formatDate, formatHashShort } from '../utils/crypto';
import { EvidenceVaultThumbnail } from './EvidenceVaultThumbnail';

interface TimelineEventCardProps {
  event: EventRecord;
  index: number;
  total: number;
  primaryEvidence?: EvidenceItem | null;
  onPress: () => void;
  isSelected: boolean;
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

const EVENT_TYPE_ICONS: Record<string, string> = {
  initial_contact: '📞',
  threat: '⚠️',
  demand: '💰',
  escalation: '📈',
  evidence_sharing: '📤',
  impersonation: '🎭',
  other: '📋',
};

const MEDIA_TYPE_COLORS: Record<MediaCategory, string> = {
  IMAGE: '#00F2FE',
  VIDEO: '#FF2A6D',
  AUDIO: '#4FACFE',
  DOCUMENT: '#10B981',
};

export function TimelineEventCard({
  event,
  index,
  total,
  primaryEvidence,
  onPress,
  isSelected,
}: TimelineEventCardProps) {
  const severityColor = SEVERITY_COLORS[event.severity] || palette.textSecondary;
  const eventIcon = EVENT_TYPE_ICONS[event.event_type] || '📋';
  const hasTimestamp = event.timestamp && event.timestamp > 0;
  const timestampText = hasTimestamp ? formatDate(event.timestamp) : 'Unresolved time';

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Event ${event.event_type}, severity ${SEVERITY_LABELS[event.severity]}, ${timestampText}`}
    >
      <View style={styles.timelineRow}>
        <Svg width={36} height="100%" style={styles.timelineSvg}>
          <Line
            x1={18}
            y1={0}
            x2={18}
            y2="100%"
            stroke={palette.border}
            strokeWidth={2}
            strokeDasharray="4,4"
          />
          <Circle
            cx={18}
            cy={24}
            r={isSelected ? 10 : 8}
            fill={severityColor}
            stroke={palette.background}
            strokeWidth={3}
          />
          {index < total - 1 && (
            <Line x1={18} y1={48} x2={18} y2="100%" stroke={palette.border} strokeWidth={2} strokeDasharray="4,4" />
          )}
        </Svg>

        <View style={[styles.cardContent, { flex: 1 }]}>
          <View style={styles.headerRow}>
            <View style={styles.typeBadgeContainer}>
              <Text style={styles.eventIcon}>{eventIcon}</Text>
              <Text style={styles.eventType}>{event.event_type.replace('_', ' ')}</Text>
            </View>

            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.severityBadge,
                  { backgroundColor: `${severityColor}20`, borderColor: severityColor },
                ]}
              >
                <Text
                  style={[
                    styles.severityBadgeText,
                    { color: severityColor },
                  ]}
                >
                  {SEVERITY_LABELS[event.severity]}
                </Text>
              </View>

              <View style={[styles.sourceBadge, { backgroundColor: palette.surfaceVariant }]}>
                <Text style={styles.sourceBadgeText}>{event.source || 'system'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.timestampRow}>
            <Text style={styles.timestampIcon}>🕐</Text>
            <Text style={[styles.timestampText, !hasTimestamp && styles.timestampUnresolved]}>
              {timestampText}
            </Text>
            {event.timestamp_hint && (
              <Text style={styles.timestampHint}>Hint: {event.timestamp_hint}</Text>
            )}
          </View>

          <Text style={styles.summary} numberOfLines={3}>
            {event.ai_summary || event.event_type}
          </Text>

          {event.timestamp_conflict && (
            <Text style={styles.warning}>⚠️ Contradictory timestamps flagged</Text>
          )}
          {event.timestamp_unresolved && (
            <Text style={styles.warning}>⚠️ Timestamp unresolved from evidence</Text>
          )}

          {primaryEvidence && (
            <View style={styles.evidencePreview}>
              <EvidenceVaultThumbnail
                mediaType={primaryEvidence.type}
                fileUri={primaryEvidence.fileUri}
                size={48}
              />
              <View style={styles.evidenceInfo}>
                <Text style={styles.evidenceName}>
                  {primaryEvidence.fileName || primaryEvidence.id.substring(0, 8)}
                </Text>
                <Text style={styles.evidenceMeta}>
                  {primaryEvidence.type} · {formatHashShort(primaryEvidence.sha256Hash, 8)}
                </Text>
              </View>
              {event.evidence_ids && event.evidence_ids.length > 1 && (
                <View style={styles.moreEvidenceBadge}>
                  <Text style={styles.moreEvidenceText}>
                    +{event.evidence_ids.length - 1} more
                  </Text>
                </View>
              )}
            </View>
          )}

          {event.user_annotation && (
            <View style={styles.annotation}>
              <Text style={styles.annotationLabel}>Investigator Note:</Text>
              <Text style={styles.annotationText}>{event.user_annotation}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: palette.primary,
    borderWidth: 2,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    padding: 16,
  },
  timelineSvg: {
    position: 'absolute',
    left: 16,
    top: 16,
    bottom: 16,
    zIndex: 1,
  },
  cardContent: {
    flex: 1,
    marginLeft: 36,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: palette.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  typeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventIcon: {
    fontSize: 20,
  },
  eventType: {
    fontSize: 13,
    fontWeight: 'bold',
    color: palette.text,
    textTransform: 'capitalize',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  severityBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.textSecondary,
    textTransform: 'capitalize',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  timestampIcon: {
    fontSize: 14,
  },
  timestampText: {
    fontSize: 13,
    color: palette.text,
    fontFamily: 'monospace',
  },
  timestampUnresolved: {
    color: palette.warning,
  },
  timestampHint: {
    fontSize: 11,
    color: palette.accent,
    fontStyle: 'italic',
  },
  summary: {
    fontSize: 14,
    color: palette.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  warning: {
    fontSize: 11,
    color: palette.warning,
    marginBottom: 4,
  },
  evidencePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  evidenceInfo: {
    flex: 1,
  },
  evidenceName: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 2,
  },
  evidenceMeta: {
    fontSize: 11,
    color: palette.textSecondary,
    fontFamily: 'monospace',
  },
  moreEvidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: palette.surfaceVariant,
    borderRadius: 8,
  },
  moreEvidenceText: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.primary,
  },
  annotation: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surfaceVariant,
    padding: 10,
    borderRadius: 8,
  },
  annotationLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: palette.accent,
    marginBottom: 4,
  },
  annotationText: {
    fontSize: 12,
    color: palette.text,
    lineHeight: 18,
  },
});