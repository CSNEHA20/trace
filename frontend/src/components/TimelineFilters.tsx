import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import { IncidentSeverity, MediaCategory, ActorRecord } from '../types';
import { palette } from '../theme';

interface TimelineFiltersProps {
  selectedSeverities: IncidentSeverity[];
  onSeverityToggle: (severity: IncidentSeverity) => void;
  selectedActors: string[];
  onActorToggle: (actorId: string) => void;
  availableActors: ActorRecord[];
  selectedMediaTypes: MediaCategory[];
  onMediaTypeToggle: (mediaType: MediaCategory) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
}

const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  1: 'Low (1)',
  2: 'Guarded (2)',
  3: 'Medium (3)',
  4: 'High (4)',
  5: 'Critical (5)',
};

const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  1: palette.success,
  2: '#65A30D',
  3: palette.warning,
  4: '#EA580C',
  5: palette.error,
};

const MEDIA_TYPE_LABELS: Record<MediaCategory, string> = {
  IMAGE: 'Images',
  VIDEO: 'Videos',
  AUDIO: 'Audio',
  DOCUMENT: 'Documents',
};

const MEDIA_TYPE_ICONS: Record<MediaCategory, string> = {
  IMAGE: '🖼️',
  VIDEO: '🎬',
  AUDIO: '🎙️',
  DOCUMENT: '📄',
};

const MEDIA_TYPE_COLORS: Record<MediaCategory, string> = {
  IMAGE: palette.brandYellow,
  VIDEO: palette.error,
  AUDIO: palette.deepBlack,
  DOCUMENT: palette.success,
};


export function TimelineFilters({
  selectedSeverities,
  onSeverityToggle,
  selectedActors,
  onActorToggle,
  availableActors,
  selectedMediaTypes,
  onMediaTypeToggle,
  searchQuery,
  onSearchChange,
  onClearAll,
  hasActiveFilters,
}: TimelineFiltersProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Filters</Text>
        {hasActiveFilters && (
          <TouchableOpacity style={styles.clearBtn} onPress={onClearAll}>
            <Text style={styles.clearBtnText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search events…"
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholderTextColor={palette.textSecondary}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupTitle}>Severity</Text>
          <View style={styles.chipRow}>
            {([1, 2, 3, 4, 5] as IncidentSeverity[]).map((severity) => (
              <TouchableOpacity
                key={severity}
                style={[
                  styles.chip,
                  selectedSeverities.includes(severity) && styles.chipActive,
                  { borderColor: SEVERITY_COLORS[severity] },
                ]}
                onPress={() => onSeverityToggle(severity)}
              >
                <View
                  style={[
                    styles.severityDot,
                    { backgroundColor: SEVERITY_COLORS[severity] },
                  ]}
                />
                <Text
                  style={[
                    styles.chipText,
                    selectedSeverities.includes(severity) && styles.chipTextActive,
                    { color: SEVERITY_COLORS[severity] },
                  ]}
                >
                  {SEVERITY_LABELS[severity]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupTitle}>Media Type</Text>
          <View style={styles.chipRow}>
            {(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'] as MediaCategory[]).map((mediaType) => (
              <TouchableOpacity
                key={mediaType}
                style={[
                  styles.chip,
                  selectedMediaTypes.includes(mediaType) && styles.chipActive,
                  { borderColor: MEDIA_TYPE_COLORS[mediaType] },
                ]}
                onPress={() => onMediaTypeToggle(mediaType)}
              >
                <Text style={styles.chipIcon}>{MEDIA_TYPE_ICONS[mediaType]}</Text>
                <Text
                  style={[
                    styles.chipText,
                    selectedMediaTypes.includes(mediaType) && styles.chipTextActive,
                    { color: MEDIA_TYPE_COLORS[mediaType] },
                  ]}
                >
                  {MEDIA_TYPE_LABELS[mediaType]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {availableActors.length > 0 && (
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>Actors</Text>
            <View style={styles.chipRow}>
              {availableActors.map((actor) => (
                <TouchableOpacity
                  key={actor.id}
                  style={[
                    styles.chip,
                    selectedActors.includes(actor.id) && styles.chipActive,
                    { borderColor: palette.primary },
                  ]}
                  onPress={() => onActorToggle(actor.id)}
                >
                  <View
                    style={[
                      styles.actorAvatar,
                      { backgroundColor: selectedActors.includes(actor.id) ? palette.deepBlack : palette.surfaceVariant },
                    ]}
                  >
                    <Text
                      style={[
                        styles.actorAvatarText,
                        { color: selectedActors.includes(actor.id) ? palette.white : palette.text },
                      ]}
                    >
                      {actor.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.chipText,
                      selectedActors.includes(actor.id) && styles.chipTextActive,
                    ]}
                  >
                    {actor.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d1d1f',
    letterSpacing: -0.3,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#f5f5f7',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0066cc',
  },
  searchInput: {
    backgroundColor: '#f5f5f7',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1d1d1f',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    marginBottom: 14,
  },
  filterScroll: {
    gap: 16,
    paddingBottom: 4,
  },
  filterGroup: {
    minWidth: '100%',
  },
  filterGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#86868b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#f5f5f7',
  },
  chipIcon: {
    fontSize: 13,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d1d1f',
  },
  chipTextActive: {
    color: '#0066cc',
  },
  severityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  actorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actorAvatarText: {
    fontSize: 10,
    fontWeight: '700',
  },
});