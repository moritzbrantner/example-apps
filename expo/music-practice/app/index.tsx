import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createPracticeSession,
  deserializePracticeSessions,
  elapsedSeconds,
  formatDuration,
  type PracticeSession,
} from '../lib/practice';

const STORAGE_KEY = '@example-apps/music-practice/sessions-v1';
const recorderOptions = { ...RecordingPresets.HIGH_QUALITY, directory: 'document' as const };

type PendingRecording = {
  uri: string;
  seconds: number;
  persistent: boolean;
};

function makeId(): string {
  return `practice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function removeManagedRecording(recording: PendingRecording | PracticeSession) {
  const uri = 'recordingUri' in recording ? recording.recordingUri : recording.uri;
  const persistent = 'recordingPersistent' in recording ? recording.recordingPersistent : recording.persistent;
  if (!uri || !persistent || Platform.OS === 'web') return;
  try {
    new File(uri).delete();
  } catch {
    // The session can still be removed if the file has already disappeared.
  }
}

function RecordingPlayback({ uri, seconds }: { uri: string; seconds: number }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.duration > 0 && status.currentTime >= status.duration - 0.05) {
      void player.seekTo(0).then(() => player.play());
      return;
    }
    player.play();
  };

  return (
    <Pressable onPress={toggle} style={styles.playButton}>
      <Text style={styles.playButtonText}>
        {status.playing ? 'Pause take' : `Play take · ${formatDuration(seconds)}`}
      </Text>
    </Pressable>
  );
}

export default function MusicPracticeApp() {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [instrument, setInstrument] = useState('');
  const [piece, setPiece] = useState('');
  const [focus, setFocus] = useState('');
  const [notes, setNotes] = useState('');
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [stoppedSeconds, setStoppedSeconds] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [pendingRecording, setPendingRecording] = useState<PendingRecording | null>(null);
  const [message, setMessage] = useState('');

  const recorder = useAudioRecorder(recorderOptions);
  const recorderState = useAudioRecorderState(recorder, 200);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        setSessions(deserializePracticeSessions(stored));
        setHydrated(true);
      })
      .catch(() => {
        if (active) {
          setMessage('Practice history could not be read. Changes will not be persisted until the app is reopened successfully.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }, 150);
    return () => clearTimeout(timer);
  }, [hydrated, sessions]);

  useEffect(() => {
    if (startedAtMs === null) return;
    const timer = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(timer);
  }, [startedAtMs]);

  const currentSeconds = elapsedSeconds(startedAtMs, stoppedSeconds, nowMs);
  const orderedSessions = useMemo(
    () => [...sessions].sort((left, right) => right.practicedAt.localeCompare(left.practicedAt)),
    [sessions],
  );

  const startTimer = () => {
    if (startedAtMs !== null) return;
    const now = Date.now();
    setNowMs(now);
    setStartedAtMs(now);
  };

  const pauseTimer = () => {
    if (startedAtMs === null) return;
    const now = Date.now();
    setStoppedSeconds(elapsedSeconds(startedAtMs, stoppedSeconds, now));
    setNowMs(now);
    setStartedAtMs(null);
  };

  const resetTimer = () => {
    setStartedAtMs(null);
    setStoppedSeconds(0);
    setNowMs(Date.now());
  };

  const discardPendingRecording = () => {
    if (pendingRecording) removeManagedRecording(pendingRecording);
    setPendingRecording(null);
  };

  const startRecording = async () => {
    setMessage('');
    try {
      if (pendingRecording) {
        removeManagedRecording(pendingRecording);
        setPendingRecording(null);
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setMessage('Microphone permission is required to record a practice take.');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    const seconds = Math.max(1, Math.round(recorderState.durationMillis / 1000));
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setMessage('The recorder stopped without producing a playable file.');
        return;
      }
      setPendingRecording({
        uri,
        seconds,
        persistent: Platform.OS !== 'web',
      });
      setMessage(Platform.OS === 'web'
        ? 'Take recorded for this browser session. Browser recording URLs are not restored after reload.'
        : 'Take recorded in persistent app storage.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not stop recording.');
    }
  };

  const saveSession = () => {
    const duration = Math.max(currentSeconds, pendingRecording?.seconds ?? 0);
    if (!instrument.trim() || !piece.trim()) {
      setMessage('Add an instrument and piece or exercise first.');
      return;
    }
    if (duration < 1) {
      setMessage('Run the timer or record a take before saving the session.');
      return;
    }

    const session = createPracticeSession({
      id: makeId(),
      instrument,
      piece,
      focus,
      notes,
      durationSeconds: duration,
      recordingUri: pendingRecording?.uri ?? null,
      recordingSeconds: pendingRecording?.seconds ?? 0,
      recordingPersistent: pendingRecording?.persistent ?? false,
    });
    setSessions((current) => [session, ...current]);
    setPiece('');
    setFocus('');
    setNotes('');
    setPendingRecording(null);
    resetTimer();
    setMessage('Practice session saved.');
  };

  const removeSession = (session: PracticeSession) => {
    removeManagedRecording(session);
    setSessions((current) => current.filter((candidate) => candidate.id !== session.id));
    setMessage('Practice session removed.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>MUSIC PRACTICE</Text>
          <Text style={styles.heading}>Practice, listen, adjust.</Text>
          <Text style={styles.subheading}>
            A small practice notebook with a real timer and optional microphone takes. No streaks and no scoring.
          </Text>

          <View style={styles.timerPanel}>
            <Text style={styles.timer}>{formatDuration(currentSeconds)}</Text>
            <View style={styles.actionRow}>
              <Pressable onPress={startedAtMs === null ? startTimer : pauseTimer} style={styles.primarySmallButton}>
                <Text style={styles.primarySmallButtonText}>{startedAtMs === null ? 'Start practice' : 'Pause'}</Text>
              </Pressable>
              <Pressable disabled={recorderState.isRecording} onPress={resetTimer} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Reset</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.composer}>
            <Text style={styles.sectionTitle}>Current session</Text>
            <TextInput
              accessibilityLabel="Instrument"
              onChangeText={setInstrument}
              placeholder="Piano, guitar, voice…"
              placeholderTextColor="#77776f"
              style={styles.input}
              value={instrument}
            />
            <TextInput
              accessibilityLabel="Piece or exercise"
              onChangeText={setPiece}
              placeholder="Piece or exercise"
              placeholderTextColor="#77776f"
              style={styles.input}
              value={piece}
            />
            <TextInput
              accessibilityLabel="Practice focus"
              onChangeText={setFocus}
              placeholder="Focus: phrasing, left hand, intonation…"
              placeholderTextColor="#77776f"
              style={styles.input}
              value={focus}
            />
            <TextInput
              accessibilityLabel="Practice notes"
              multiline
              onChangeText={setNotes}
              placeholder="What changed? What should I try next?"
              placeholderTextColor="#77776f"
              style={[styles.input, styles.notesInput]}
              value={notes}
            />

            <View style={styles.recordPanel}>
              <View style={styles.recordCopy}>
                <Text style={styles.recordTitle}>Practice take</Text>
                <Text style={styles.recordMeta}>
                  {recorderState.isRecording
                    ? `Recording · ${formatDuration(Math.round(recorderState.durationMillis / 1000))}`
                    : pendingRecording
                      ? `Ready · ${formatDuration(pendingRecording.seconds)}`
                      : 'Optional'}
                </Text>
              </View>
              <Pressable
                onPress={() => void (recorderState.isRecording ? stopRecording() : startRecording())}
                style={[styles.recordButton, recorderState.isRecording && styles.recordingButton]}>
                <Text style={styles.recordButtonText}>{recorderState.isRecording ? 'Stop' : 'Record'}</Text>
              </Pressable>
            </View>

            {pendingRecording ? (
              <View style={styles.pendingRow}>
                <RecordingPlayback uri={pendingRecording.uri} seconds={pendingRecording.seconds} />
                <Pressable onPress={discardPendingRecording} style={styles.textButton}>
                  <Text style={styles.deleteText}>Discard take</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              disabled={recorderState.isRecording}
              onPress={saveSession}
              style={({ pressed }) => [styles.primaryButton, recorderState.isRecording && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Save practice session</Text>
            </Pressable>
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.sectionTitle}>Practice history</Text>
          <View style={styles.list}>
            {orderedSessions.length === 0 ? (
              <Text style={styles.emptyText}>No practice sessions yet.</Text>
            ) : (
              orderedSessions.map((session) => (
                <View key={session.id} style={styles.sessionRow}>
                  <Text style={styles.sessionTitle}>{session.piece}</Text>
                  <Text style={styles.meta}>{session.instrument} · {formatDuration(session.durationSeconds)}</Text>
                  {session.focus ? <Text style={styles.focusText}>Focus · {session.focus}</Text> : null}
                  {session.notes ? <Text style={styles.note}>{session.notes}</Text> : null}
                  <Text style={styles.dateText}>{new Date(session.practicedAt).toLocaleString()}</Text>
                  <View style={styles.actionRow}>
                    {session.recordingUri ? (
                      <RecordingPlayback uri={session.recordingUri} seconds={session.recordingSeconds} />
                    ) : null}
                    <Pressable onPress={() => removeSession(session)} style={styles.textButton}>
                      <Text style={styles.deleteText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.footer}>
            Native takes are kept in app document storage. This MVP makes no background-timer, tuning, pitch-analysis, or pedagogical-assessment guarantee.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f1e8' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 52 },
  eyebrow: { color: '#756d61', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#28231f', fontSize: 36, fontWeight: '800', lineHeight: 41, letterSpacing: -1.2, marginTop: 8 },
  subheading: { color: '#716a62', fontSize: 15, lineHeight: 22, marginTop: 8 },
  timerPanel: { alignItems: 'center', borderBottomColor: '#d8d0c4', borderBottomWidth: 1, borderTopColor: '#d8d0c4', borderTopWidth: 1, marginTop: 24, paddingVertical: 22 },
  timer: { color: '#2d2823', fontSize: 50, fontVariant: ['tabular-nums'], fontWeight: '700', letterSpacing: -2 },
  composer: { marginTop: 24 },
  sectionTitle: { color: '#332e28', fontSize: 18, fontWeight: '800' },
  input: { backgroundColor: '#fffdf9', borderColor: '#d9d1c5', borderWidth: 1, borderRadius: 14, color: '#28231f', fontSize: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12 },
  notesInput: { minHeight: 86, textAlignVertical: 'top' },
  recordPanel: { alignItems: 'center', borderColor: '#d9d1c5', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 12, padding: 13 },
  recordCopy: { flex: 1 },
  recordTitle: { color: '#332e28', fontSize: 14, fontWeight: '800' },
  recordMeta: { color: '#777066', fontSize: 12, marginTop: 3 },
  recordButton: { backgroundColor: '#594941', borderRadius: 999, paddingHorizontal: 17, paddingVertical: 10 },
  recordingButton: { backgroundColor: '#8b3d36' },
  recordButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  pendingRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  primaryButton: { alignItems: 'center', backgroundColor: '#3d342e', borderRadius: 14, marginTop: 14, paddingVertical: 13 },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  primarySmallButton: { backgroundColor: '#3d342e', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  primarySmallButtonText: { color: '#fff', fontWeight: '800' },
  secondaryButton: { borderColor: '#bbb1a5', borderRadius: 999, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 10 },
  secondaryButtonText: { color: '#554d45', fontWeight: '800' },
  playButton: { borderColor: '#bdb3a8', borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 },
  playButtonText: { color: '#51463e', fontSize: 12, fontWeight: '800' },
  textButton: { paddingVertical: 7 },
  deleteText: { color: '#8b493f', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.68 },
  message: { color: '#675b50', fontSize: 13, lineHeight: 19, marginVertical: 14 },
  list: { borderTopColor: '#d8d0c4', borderTopWidth: 1, marginTop: 10 },
  sessionRow: { borderBottomColor: '#d8d0c4', borderBottomWidth: 1, paddingVertical: 15 },
  sessionTitle: { color: '#332e28', fontSize: 17, fontWeight: '800' },
  meta: { color: '#777066', fontSize: 13, lineHeight: 19, marginTop: 4 },
  focusText: { color: '#66584e', fontSize: 13, lineHeight: 19, marginTop: 5 },
  note: { color: '#665f57', fontSize: 13, lineHeight: 19, marginTop: 5 },
  dateText: { color: '#928a81', fontSize: 11, marginTop: 7 },
  actionRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  emptyText: { color: '#777066', paddingVertical: 26, textAlign: 'center' },
  footer: { color: '#8b847c', fontSize: 12, lineHeight: 18, marginTop: 26 },
});
