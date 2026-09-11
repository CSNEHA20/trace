import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { onDeviceInferenceService } from '../../../ai/inference/inferenceService';
import { useAiStore } from '../store/aiStore';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';
import { useRouter } from 'expo-router';

export function AiCapabilityScreen() {
  const router = useRouter();
  const { capability, progress, setCapability } = useAiStore();
  const refresh = useCallback(async () => setCapability(await onDeviceInferenceService.capability()), [setCapability]);
  useEffect(() => { refresh(); }, [refresh]);
  const available = capability?.availability === 'AVAILABLE';

  return (
    <View style={styles.container}>
      <AppHeader
        title="On Device AI Status"
        subtitle="Gemma is never sent evidence over the network"
        showBack
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {!capability ? (
          <ActivityIndicator color={Colors.primary} size="large" />
        ) : (
          <>
            <View style={[styles.card, available ? styles.available : styles.unavailable]}>
              <Text style={styles.label}>MODEL STATUS</Text>
              <Text style={styles.status}>{capability.availability.replace('_', ' ')}</Text>
              <Text style={styles.detail}>{capability.detail}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>RUNTIME ENVIRONMENT</Text>
              <Text style={styles.detail}>Lifecycle: {capability.lifecycle}</Text>
              <Text style={styles.detail}>Backend: {capability.accelerator ?? 'CPU / NPU Native'}</Text>
              <Text style={styles.detail}>Model: Gemma 2B INT4, local MediaPipe .task file</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>INFERENCE PROGRESS</Text>
              <Text style={styles.detail}>{progress.message}</Text>
              <Text style={styles.detail}>{progress.completedChunks}/{progress.totalChunks} segments processed</Text>
            </View>
            {!available && (
              <Text style={styles.warning}>
                AI analysis is disabled until a custom Android build contains the TRACE MediaPipe module and the licensed Gemma model is installed locally.
              </Text>
            )}
            <TouchableOpacity style={styles.button} onPress={refresh} activeOpacity={0.85}>
              <Text style={styles.buttonText}>Refresh Local Capability</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.canvasParchment },
  content: { padding: Spacing.md, gap: 14, paddingBottom: 40 },
  card: {
    borderRadius: Radius.lg,
    padding: 18,
    backgroundColor: Colors.cardBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.elevated,
  },
  available: { borderLeftWidth: 3.5, borderLeftColor: Colors.emerald },
  unavailable: { borderLeftWidth: 3.5, borderLeftColor: Colors.amber },
  label: {
    ...Typography.subtopLabel,
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  status: {
    ...Typography.heroDisplay,
    fontSize: 22,
    color: Colors.ink,
    marginBottom: 6,
  },
  detail: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 3,
  },
  warning: {
    ...Typography.body,
    color: Colors.amber,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    ...Shadows.subtle,
  },
  buttonText: {
    ...Typography.bodyStrong,
    color: '#ffffff',
    fontSize: 14,
  },
});
