import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addMember,
  buildBoardImportHandoff,
  completeChore,
  createChore,
  currentAssignee,
  deserializeBoard,
  emptyBoard,
  parseBoardImportHandoff,
  parseMaintenanceChoreHandoff,
  type ChoreBoard,
  type ChoreSource,
} from '../lib/chores';

const STORAGE_KEY = '@example-apps/chores/board-v1';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ChoresApp() {
  const [board, setBoard] = useState<ChoreBoard>(emptyBoard());
  const [hydrated, setHydrated] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [title, setTitle] = useState('');
  const [intervalDays, setIntervalDays] = useState('7');
  const [dueOn, setDueOn] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [source, setSource] = useState<ChoreSource | null>(null);
  const [notes, setNotes] = useState('');
  const [incomingBoard, setIncomingBoard] = useState<ChoreBoard | null>(null);
  const [message, setMessage] = useState('');
  const today = todayKey();

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        const next = deserializeBoard(stored);
        setBoard(next);
        setSelectedMemberIds(next.members.map((member) => member.id));
        setHydrated(true);
      })
      .catch(() => {
        if (active) {
          setMessage(
            'Chore board could not be read. Changes will not be persisted until the app is reopened successfully.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(board));
    }, 150);
    return () => clearTimeout(timer);
  }, [board, hydrated]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      const maintenance = parseMaintenanceChoreHandoff(url);
      if (maintenance) {
        setSource(maintenance.source);
        setTitle(maintenance.title);
        setDueOn(maintenance.dueOn);
        setMessage('Chore received from Home Maintenance.');
        return;
      }

      const imported = parseBoardImportHandoff(url);
      if (imported) {
        setIncomingBoard(imported);
        setMessage('Shared chore board received. Review it before replacing local state.');
      }
    };

    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  const orderedChores = useMemo(
    () =>
      [...board.chores].sort(
        (left, right) =>
          (left.dueOn || '9999-99-99').localeCompare(right.dueOn || '9999-99-99') ||
          left.title.localeCompare(right.title),
      ),
    [board.chores],
  );

  const addHouseholdMember = () => {
    setMessage('');
    try {
      const id = makeId('member');
      const next = addMember(board, { id, name: newMemberName });
      setBoard(next);
      setSelectedMemberIds((current) => [...current, id]);
      setNewMemberName('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add household member.');
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((candidate) => candidate !== memberId)
        : [...current, memberId],
    );
  };

  const addChore = () => {
    setMessage('');
    try {
      const chore = createChore({
        id: makeId('chore'),
        title,
        intervalDays: Number(intervalDays),
        dueOn,
        memberIds: selectedMemberIds,
        source,
        notes,
      });
      setBoard((current) => ({ ...current, chores: [...current.chores, chore] }));
      setTitle('');
      setIntervalDays('7');
      setDueOn('');
      setSource(null);
      setNotes('');
      setMessage('Chore added.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add chore.');
    }
  };

  const markDone = (choreId: string) => {
    setBoard((current) => ({
      ...current,
      chores: current.chores.map((chore) =>
        chore.id === choreId ? completeChore(chore, today) : chore,
      ),
    }));
  };

  const shareBoard = async () => {
    setMessage('');
    if (board.members.length === 0 && board.chores.length === 0) {
      setMessage('Add something to the board before sharing it.');
      return;
    }
    try {
      await Share.share({
        title: 'Shared Chores board snapshot',
        message: buildBoardImportHandoff(board),
      });
    } catch {
      setMessage('The board snapshot could not be shared on this device.');
    }
  };

  const acceptIncomingBoard = () => {
    if (!incomingBoard) return;
    setBoard(incomingBoard);
    setSelectedMemberIds(incomingBoard.members.map((member) => member.id));
    setIncomingBoard(null);
    setMessage('Shared snapshot imported. It replaced the local board only after your confirmation.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>SHARED CHORES</Text>
              <Text style={styles.heading}>Make responsibility clear.</Text>
              <Text style={styles.subheading}>
                Recurring household work with simple rotation, without points, streaks, or a social feed.
              </Text>
            </View>
            <Pressable onPress={() => void shareBoard()} style={styles.shareButton}>
              <Text style={styles.shareButtonText}>Share snapshot</Text>
            </Pressable>
          </View>

          {incomingBoard ? (
            <View style={styles.importBox}>
              <Text style={styles.importTitle}>Incoming shared board</Text>
              <Text style={styles.importText}>
                {incomingBoard.members.length} member{incomingBoard.members.length === 1 ? '' : 's'} · {incomingBoard.chores.length} chore{incomingBoard.chores.length === 1 ? '' : 's'}
              </Text>
              <Text style={styles.importText}>
                Importing replaces this device's current board. Nothing changes until you accept it.
              </Text>
              <View style={styles.actionRow}>
                <Pressable onPress={acceptIncomingBoard} style={styles.textButton}>
                  <Text style={styles.textButtonText}>Import snapshot</Text>
                </Pressable>
                <Pressable onPress={() => setIncomingBoard(null)} style={styles.textButton}>
                  <Text style={styles.deleteText}>Ignore</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Household members</Text>
            <View style={styles.memberCreator}>
              <TextInput
                accessibilityLabel="New household member"
                onChangeText={setNewMemberName}
                onSubmitEditing={addHouseholdMember}
                placeholder="Name"
                placeholderTextColor="#7b817b"
                style={[styles.input, styles.memberInput]}
                value={newMemberName}
              />
              <Pressable
                disabled={!newMemberName.trim()}
                onPress={addHouseholdMember}
                style={[styles.smallButton, !newMemberName.trim() && styles.disabled]}>
                <Text style={styles.smallButtonText}>Add</Text>
              </Pressable>
            </View>
            {board.members.length > 0 ? (
              <View style={styles.memberList}>
                {board.members.map((member) => (
                  <Text key={member.id} style={styles.memberName}>{member.name}</Text>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>Add at least one person before creating a chore.</Text>
            )}
          </View>

          <View style={styles.composer}>
            <Text style={styles.sectionTitle}>Add recurring chore</Text>
            {source ? (
              <View style={styles.sourceRow}>
                <View style={styles.sourceCopy}>
                  <Text style={styles.sourceLabel}>Linked from Home Maintenance</Text>
                  <Text style={styles.sourceName}>{title || source.id}</Text>
                </View>
                <Pressable onPress={() => setSource(null)} style={styles.textButton}>
                  <Text style={styles.deleteText}>Unlink</Text>
                </Pressable>
              </View>
            ) : null}

            <TextInput accessibilityLabel="Chore title" onChangeText={setTitle} placeholder="Bins, vacuum, water plants…" placeholderTextColor="#7b817b" style={styles.input} value={title} />
            <View style={styles.twoColumn}>
              <TextInput accessibilityLabel="Repeat interval in days" keyboardType="number-pad" onChangeText={setIntervalDays} placeholder="Every N days" placeholderTextColor="#7b817b" style={[styles.input, styles.columnInput]} value={intervalDays} />
              <TextInput accessibilityLabel="Next due date" autoCapitalize="none" onChangeText={setDueOn} placeholder="Due YYYY-MM-DD" placeholderTextColor="#7b817b" style={[styles.input, styles.columnInput]} value={dueOn} />
            </View>

            <Text style={styles.smallLabel}>Who participates in the rotation?</Text>
            <View style={styles.choiceRow}>
              {board.members.map((member) => {
                const selected = selectedMemberIds.includes(member.id);
                return (
                  <Pressable key={member.id} accessibilityState={{ selected }} onPress={() => toggleMember(member.id)} style={[styles.choice, selected && styles.choiceSelected]}>
                    <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{member.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput accessibilityLabel="Chore notes" onChangeText={setNotes} placeholder="Optional instructions or context" placeholderTextColor="#7b817b" style={styles.input} value={notes} />
            <Pressable
              disabled={!title.trim() || selectedMemberIds.length === 0}
              onPress={addChore}
              style={({ pressed }) => [styles.primaryButton, (!title.trim() || selectedMemberIds.length === 0) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Add chore</Text>
            </Pressable>
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.sectionTitle}>Responsibilities</Text>
          <View style={styles.list}>
            {orderedChores.length === 0 ? (
              <Text style={styles.emptyText}>No chores yet.</Text>
            ) : (
              orderedChores.map((chore) => {
                const assignee = currentAssignee(chore, board);
                return (
                  <View key={chore.id} style={styles.choreRow}>
                    <View style={styles.choreCopy}>
                      <Text style={styles.choreTitle}>{chore.title}</Text>
                      <Text style={styles.assignment}>{assignee ? assignee.name : 'No valid assignee'}</Text>
                      <Text style={styles.meta}>
                        Every {chore.intervalDays} days{chore.dueOn ? ` · due ${chore.dueOn}` : ''}
                      </Text>
                      {chore.lastCompletedOn ? <Text style={styles.meta}>Last completed {chore.lastCompletedOn}</Text> : null}
                      {chore.source ? <Text style={styles.sourceMeta}>Linked to Home Maintenance</Text> : null}
                      {chore.notes ? <Text style={styles.note}>{chore.notes}</Text> : null}
                    </View>
                    <View style={styles.actionRow}>
                      <Pressable onPress={() => markDone(chore.id)} style={styles.textButton}>
                        <Text style={styles.textButtonText}>Done today</Text>
                      </Pressable>
                      <Pressable onPress={() => setBoard((current) => ({ ...current, chores: current.chores.filter((candidate) => candidate.id !== chore.id) }))} style={styles.textButton}>
                        <Text style={styles.deleteText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <Text style={styles.footer}>
            Board sharing is an explicit snapshot in this MVP, not live synchronization. The receiving device chooses whether to replace its local board.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 52 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#657067', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#1f2921', fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1, marginTop: 8 },
  subheading: { color: '#687068', fontSize: 15, lineHeight: 22, marginTop: 8 },
  shareButton: { borderColor: '#aeb9af', borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  shareButtonText: { color: '#31513a', fontSize: 12, fontWeight: '800' },
  importBox: { borderColor: '#bac8ba', borderWidth: 1, borderRadius: 17, marginTop: 20, padding: 15 },
  importTitle: { color: '#273129', fontSize: 15, fontWeight: '800' },
  importText: { color: '#69716a', fontSize: 13, lineHeight: 19, marginTop: 4 },
  section: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 24, paddingTop: 20 },
  composer: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 24, paddingTop: 20 },
  sectionTitle: { color: '#273129', fontSize: 18, fontWeight: '800' },
  memberCreator: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  memberInput: { flex: 1, minWidth: 0 },
  smallButton: { minHeight: 46, justifyContent: 'center', borderRadius: 12, backgroundColor: '#e4e8e2', paddingHorizontal: 16, marginTop: 10 },
  smallButtonText: { color: '#31513a', fontSize: 14, fontWeight: '800' },
  memberList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  memberName: { color: '#4d5750', fontSize: 13, fontWeight: '700' },
  muted: { color: '#737a74', fontSize: 13, marginTop: 10 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  sourceCopy: { flex: 1, minWidth: 0 },
  sourceLabel: { color: '#737a74', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  sourceName: { color: '#273129', fontSize: 14, fontWeight: '800', marginTop: 2 },
  input: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12 },
  twoColumn: { flexDirection: 'row', gap: 10 },
  columnInput: { flex: 1, minWidth: 0 },
  smallLabel: { color: '#687068', fontSize: 12, fontWeight: '700', marginTop: 13 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choice: { borderColor: '#cfd3cc', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  choiceSelected: { backgroundColor: '#243c2b', borderColor: '#243c2b' },
  choiceText: { color: '#687068', fontSize: 12, fontWeight: '700' },
  choiceTextSelected: { color: '#fff' },
  primaryButton: { alignItems: 'center', backgroundColor: '#243c2b', borderRadius: 14, marginTop: 14, paddingVertical: 13 },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.68 },
  message: { color: '#4f6555', fontSize: 13, lineHeight: 19, marginVertical: 14 },
  list: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 10 },
  choreRow: { borderBottomColor: '#d9dbd5', borderBottomWidth: 1, paddingVertical: 15 },
  choreCopy: { minWidth: 0 },
  choreTitle: { color: '#273129', fontSize: 17, fontWeight: '800' },
  assignment: { color: '#31513a', fontSize: 14, fontWeight: '800', marginTop: 4 },
  meta: { color: '#727a73', fontSize: 12, lineHeight: 18, marginTop: 3 },
  sourceMeta: { color: '#526a58', fontSize: 12, fontWeight: '700', marginTop: 4 },
  note: { color: '#666e67', fontSize: 13, lineHeight: 19, marginTop: 5 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  textButton: { paddingVertical: 6 },
  textButtonText: { color: '#31513a', fontSize: 12, fontWeight: '800' },
  deleteText: { color: '#8c4a45', fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#737a74', paddingVertical: 26, textAlign: 'center' },
  footer: { color: '#868b86', fontSize: 12, lineHeight: 18, marginTop: 26 },
});
