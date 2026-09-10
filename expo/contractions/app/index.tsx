import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deserializeSession,
  durationMs,
  emptySession,
  intervalMs,
  startContraction,
  stopContraction,
  summarizeRecent,
  type ContractionSession,
} from '../lib/contractions';

// Keep the legacy storage namespace so moving repository ownership does not strand existing local sessions.
const STORAGE_KEY = '@expo-template/contractions/session-v1';

function contractionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatDuration(ms: number | null) {
  if (ms === null) return '—';
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

function formatClock(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(timestamp));
}

export default function ContractionsApp() {
  const [session, setSession] = useState<ContractionSession>(emptySession);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active) setSession(deserializeSession(stored));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }, 100);
    return () => clearTimeout(timer);
  }, [hydrated, session]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const recent = useMemo(
    () => summarizeRecent(session.contractions, now - 60 * 60 * 1000),
    [now, session.contractions],
  );
  const reversed = useMemo(() => [...session.contractions].reverse(), [session.contractions]);
  const activeElapsed = session.activeStartedAt === null ? null : now - session.activeStartedAt;

  const handleMainAction = () => {
    const timestamp = Date.now();
    setNow(timestamp);
    setSession((current) =>
      current.activeStartedAt === null
        ? startContraction(current, timestamp)
        : stopContraction(current, contractionId(), timestamp),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>CONTRACTIONS</Text>
        <Text style={styles.heading}>One large button. Accurate timing.</Text>
        <Text style={styles.subheading}>Start when a contraction begins. Stop when it ends.</Text>

        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>{session.activeStartedAt === null ? 'READY' : 'CONTRACTION IN PROGRESS'}</Text>
          <Text style={styles.timerValue}>{formatDuration(activeElapsed)}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleMainAction}
            style={({ pressed }) => [
              styles.mainButton,
              session.activeStartedAt !== null && styles.stopButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.mainButtonText}>{session.activeStartedAt === null ? 'Start contraction' : 'End contraction'}</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{recent.count}</Text>
            <Text style={styles.statLabel}>last hour</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValueSmall}>{formatDuration(recent.averageDurationMs)}</Text>
            <Text style={styles.statLabel}>average duration</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValueSmall}>{formatDuration(recent.averageIntervalMs)}</Text>
            <Text style={styles.statLabel}>average start-to-start interval</Text>
          </View>
        </View>

        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>Timing only</Text>
          <Text style={styles.safetyText}>
            This app cannot tell whether labor has started or when you should travel for care. Follow the plan from your midwife, doctor, or maternity unit. If you are worried about you or your baby, contact them or emergency services.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recorded contractions</Text>
          {session.contractions.length > 0 ? (
            <Pressable onPress={() => setSession((current) => ({ ...current, contractions: [] }))} style={({ pressed }) => pressed && styles.pressed}>
              <Text style={styles.clearText}>Clear session</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.list}>
          {reversed.length === 0 ? (
            <Text style={styles.emptyText}>No completed contractions yet.</Text>
          ) : (
            reversed.map((contraction) => {
              const chronologicalIndex = session.contractions.findIndex((candidate) => candidate.id === contraction.id);
              const previous = chronologicalIndex > 0 ? session.contractions[chronologicalIndex - 1] : undefined;
              return (
                <View key={contraction.id} style={styles.contractionRow}>
                  <View style={styles.contractionCopy}>
                    <Text style={styles.contractionTime}>{formatClock(contraction.startedAt)}</Text>
                    <Text style={styles.contractionMeta}>
                      Duration {formatDuration(durationMs(contraction))} · Interval {formatDuration(intervalMs(previous, contraction))}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Delete contraction"
                    onPress={() => setSession((current) => ({ ...current, contractions: current.contractions.filter((candidate) => candidate.id !== contraction.id) }))}
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.footer}>The active start time and completed timings are stored locally so an in-progress timer survives a reload.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  eyebrow: { color: '#657067', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#1f2921', fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1, marginTop: 8 },
  subheading: { color: '#687068', fontSize: 14, lineHeight: 21, marginTop: 10 },
  timerCard: { alignItems: 'center', backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 24, marginTop: 24, padding: 24 },
  timerLabel: { color: '#707871', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  timerValue: { color: '#243027', fontSize: 48, fontWeight: '300', fontVariant: ['tabular-nums'], marginTop: 14 },
  mainButton: { width: '100%', alignItems: 'center', backgroundColor: '#31513a', borderRadius: 18, marginTop: 22, paddingVertical: 18 },
  stopButton: { backgroundColor: '#8d4742' },
  mainButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  statCard: { minWidth: 140, flexGrow: 1, backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 18, padding: 15 },
  statValue: { color: '#243027', fontSize: 25, fontWeight: '800' },
  statValueSmall: { color: '#243027', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#737a74', fontSize: 11, lineHeight: 16, marginTop: 4 },
  safetyCard: { backgroundColor: '#fff8e9', borderColor: '#e6d7ae', borderWidth: 1, borderRadius: 18, marginTop: 18, padding: 16 },
  safetyTitle: { color: '#5e4b24', fontSize: 15, fontWeight: '800' },
  safetyText: { color: '#6f6142', fontSize: 13, lineHeight: 20, marginTop: 5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 24 },
  sectionTitle: { color: '#273129', fontSize: 18, fontWeight: '800' },
  clearText: { color: '#8c4a45', fontSize: 12, fontWeight: '700' },
  list: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 10 },
  contractionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomColor: '#d9dbd5', borderBottomWidth: 1, paddingVertical: 13 },
  contractionCopy: { flex: 1 },
  contractionTime: { color: '#273129', fontSize: 16, fontWeight: '800' },
  contractionMeta: { color: '#777e78', fontSize: 12, lineHeight: 18, marginTop: 3 },
  deleteButton: { paddingVertical: 7, paddingLeft: 6 },
  deleteText: { color: '#8c4a45', fontSize: 11, fontWeight: '700' },
  emptyText: { color: '#737a74', paddingVertical: 26, textAlign: 'center' },
  footer: { color: '#868b86', fontSize: 12, lineHeight: 18, marginTop: 26 },
  pressed: { opacity: 0.68 },
});
