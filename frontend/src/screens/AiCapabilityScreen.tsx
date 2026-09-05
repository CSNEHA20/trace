import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { onDeviceInferenceService } from '../../../ai/inference/inferenceService';
import { useAiStore } from '../store/aiStore';
import { palette } from '../theme';

export function AiCapabilityScreen() {
  const { capability, progress, setCapability } = useAiStore();
  const refresh = useCallback(async () => setCapability(await onDeviceInferenceService.capability()), [setCapability]);
  useEffect(() => { refresh(); }, [refresh]);
  const available = capability?.availability === 'AVAILABLE';
  return <View style={styles.container}><AppHeader title="On Device AI Status" subtitle="Gemma is never sent evidence over the network" />
    <ScrollView contentContainerStyle={styles.content}>
      {!capability ? <ActivityIndicator color={palette.primary} /> : <>
        <View style={[styles.card, available ? styles.available : styles.unavailable]}><Text style={styles.label}>MODEL STATUS</Text><Text style={styles.status}>{capability.availability.replace('_', ' ')}</Text><Text style={styles.detail}>{capability.detail}</Text></View>
        <View style={styles.card}><Text style={styles.label}>RUNTIME</Text><Text style={styles.detail}>Lifecycle: {capability.lifecycle}</Text><Text style={styles.detail}>Backend: {capability.accelerator ?? 'Not detected'}</Text><Text style={styles.detail}>Model: Gemma 2B INT4, local MediaPipe .task file</Text></View>
        <View style={styles.card}><Text style={styles.label}>INFERENCE PROGRESS</Text><Text style={styles.detail}>{progress.message}</Text><Text style={styles.detail}>{progress.completedChunks}/{progress.totalChunks} segments</Text></View>
        {!available && <Text style={styles.warning}>AI analysis is disabled until a custom Android build contains the TRACE MediaPipe module and the licensed Gemma model is installed locally. Expo Go cannot run this native runtime.</Text>}
        <TouchableOpacity style={styles.button} onPress={refresh}><Text style={styles.buttonText}>Refresh local capability</Text></TouchableOpacity>
      </>}
    </ScrollView></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: palette.background }, content: { padding: 16, gap: 14 }, card: { borderRadius: 12, padding: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, available: { borderLeftWidth: 4, borderLeftColor: '#2EAD67' }, unavailable: { borderLeftWidth: 4, borderLeftColor: '#D68620' }, label: { fontSize: 12, fontWeight: 'bold', color: palette.textSecondary, marginBottom: 8 }, status: { fontSize: 20, fontWeight: 'bold', color: palette.text, marginBottom: 8 }, detail: { fontSize: 14, color: palette.textSecondary, lineHeight: 21 }, warning: { color: '#D68620', lineHeight: 21 }, button: { backgroundColor: palette.primary, padding: 14, borderRadius: 10, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: 'bold' } });
