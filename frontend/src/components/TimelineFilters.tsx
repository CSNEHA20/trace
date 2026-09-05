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
  2: '#84cc16',
  3: palette.warning,
  4: '#f97316',
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
  IMAGE: '#00F2FE',
  VIDEO: '#FF2A6D',
  AUDIO: '#4FACFE',
  DOCUMENT: '#10B981',
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
                      { backgroundColor: selectedActors.includes(actor.id) ? palette.primary : palette.surfaceVariant },
                    ]}
                  >
                    <Text
                      style={[
                        styles.actorAvatarText,
                        { color: selectedActors.includes(actor.id) ? '#041018' : palette.text },
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
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.text,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: palette.surfaceVariant,
    borderRadius: 8,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.primary,
  },
  searchInput: {
    backgroundColor: palette.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: palette.text,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 12,
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
    fontWeight: 'bold',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: palette.surface,
  },
  chipActive: {
    backgroundColor: palette.surfaceVariant,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
  },
  chipTextActive: {
    color: palette.primary,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actorAvatarText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});