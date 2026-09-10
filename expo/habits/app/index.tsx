import AsyncStorage from '@react-native-async-storage/async-storage';
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
  countCompletedDays,
  createHabit,
  deserializeHabits,
  isHabitDone,
  localDateKey,
  previousDayKeys,
  toggleHabitDay,
  type Habit,
} from '../lib/habits';

const STORAGE_KEY = '@expo-template/habits/list-v1';
const TARGETS = [3, 5, 7] as const;

function habitId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function shortDay(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(date);
}

function HabitRow({
  habit,
  today,
  days,
  onToggleToday,
  onDelete,
}: {
  habit: Habit;
  today: string;
  days: string[];
  onToggleToday: () => void;
  onDelete: () => void;
}) {
  const doneToday = isHabitDone(habit, today);
  const weekCount = countCompletedDays(habit, days);

  return (
    <View style={styles.habitCard}>
      <View style={styles.habitHeader}>
        <View style={styles.habitCopy}>
          <Text style={styles.habitName}>{habit.name}</Text>
          <Text style={styles.habitMeta}>
            {weekCount} of {habit.targetPerWeek} target days in the last 7 days
          </Text>
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: doneToday }}
          accessibilityLabel={`${doneToday ? 'Undo' : 'Mark'} ${habit.name} today`}
          onPress={onToggleToday}
          style={({ pressed }) => [
            styles.todayButton,
            doneToday && styles.todayButtonDone,
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.todayButtonText, doneToday && styles.todayButtonTextDone]}>
            {doneToday ? 'Done' : 'Today'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {days.map((day) => {
          const completed = isHabitDone(habit, day);
          return (
            <View key={day} style={styles.dayCell}>
              <Text style={styles.dayLabel}>{shortDay(day)}</Text>
              <View style={[styles.dayDot, completed && styles.dayDotDone]} />
            </View>
          );
        })}
      </View>

      <Pressable onPress={onDelete} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
        <Text style={styles.deleteText}>Remove habit</Text>
      </Pressable>
    </View>
  );
}

export default function HabitsApp() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [draft, setDraft] = useState('');
  const [target, setTarget] = useState<(typeof TARGETS)[number]>(5);
  const [hydrated, setHydrated] = useState(false);
  const today = localDateKey();
  const days = useMemo(() => previousDayKeys(7), [today]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active) setHabits(deserializeHabits(stored));
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
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    }, 150);
    return () => clearTimeout(timer);
  }, [habits, hydrated]);

  const doneToday = habits.filter((habit) => isHabitDone(habit, today)).length;

  const addHabit = () => {
    if (!draft.trim()) return;
    setHabits((current) => [...current, createHabit(draft, habitId(), target)]);
    setDraft('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>HABITS</Text>
          <Text style={styles.heading}>Track what you want to practice.</Text>
          <Text style={styles.summary}>
            {doneToday} of {habits.length} checked in today
          </Text>

          <View style={styles.composerCard}>
            <Text style={styles.sectionTitle}>Add a habit</Text>
            <TextInput
              accessibilityLabel="Habit name"
              onChangeText={setDraft}
              onSubmitEditing={addHabit}
              placeholder="Read, walk, stretch, pray…"
              placeholderTextColor="#7b827c"
              returnKeyType="done"
              style={styles.input}
              value={draft}
            />
            <Text style={styles.smallLabel}>Weekly target</Text>
            <View style={styles.targetRow}>
              {TARGETS.map((candidate) => (
                <Pressable
                  key={candidate}
                  onPress={() => setTarget(candidate)}
                  style={({ pressed }) => [
                    styles.targetButton,
                    target === candidate && styles.targetButtonSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.targetText, target === candidate && styles.targetTextSelected]}>
                    {candidate} days
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              disabled={!draft.trim()}
              onPress={addHabit}
              style={({ pressed }) => [styles.addButton, !draft.trim() && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.addButtonText}>Add habit</Text>
            </Pressable>
          </View>

          <View style={styles.list}>
            {habits.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No habits yet.</Text>
                <Text style={styles.emptyText}>Start with one practice you actually want to repeat.</Text>
              </View>
            ) : (
              habits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  today={today}
                  days={days}
                  onToggleToday={() =>
                    setHabits((current) =>
                      current.map((candidate) =>
                        candidate.id === habit.id ? toggleHabitDay(candidate, today) : candidate,
                      ),
                    )
                  }
                  onDelete={() => setHabits((current) => current.filter((candidate) => candidate.id !== habit.id))}
                />
              ))
            )}
          </View>

          <Text style={styles.footer}>
            No streak pressure, badges, feed, or account. The record belongs to this device.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  eyebrow: { color: '#657067', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#1f2921', fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1, marginTop: 8 },
  summary: { color: '#687068', fontSize: 14, fontWeight: '600', marginTop: 10 },
  composerCard: { backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 20, padding: 18, marginTop: 24 },
  sectionTitle: { color: '#273129', fontSize: 18, fontWeight: '800' },
  input: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 16, marginTop: 14, paddingHorizontal: 14, paddingVertical: 12 },
  smallLabel: { color: '#687068', fontSize: 12, fontWeight: '700', marginTop: 14 },
  targetRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  targetButton: { borderColor: '#cfd3cc', borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  targetButtonSelected: { backgroundColor: '#e1e9df', borderColor: '#adc0ad' },
  targetText: { color: '#687068', fontSize: 13, fontWeight: '700' },
  targetTextSelected: { color: '#294331' },
  addButton: { alignItems: 'center', backgroundColor: '#243c2b', borderRadius: 14, marginTop: 16, paddingVertical: 13 },
  addButtonText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.4 },
  list: { gap: 12, marginTop: 20 },
  habitCard: { backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 20, padding: 16 },
  habitHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitCopy: { flex: 1 },
  habitName: { color: '#243027', fontSize: 18, fontWeight: '800' },
  habitMeta: { color: '#737a74', fontSize: 12, marginTop: 4 },
  todayButton: { borderColor: '#9eaaa0', borderWidth: 1, borderRadius: 999, minWidth: 68, alignItems: 'center', paddingHorizontal: 13, paddingVertical: 9 },
  todayButtonDone: { backgroundColor: '#31513a', borderColor: '#31513a' },
  todayButtonText: { color: '#31513a', fontSize: 13, fontWeight: '800' },
  todayButtonTextDone: { color: '#fff' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  dayCell: { alignItems: 'center', gap: 7 },
  dayLabel: { color: '#787f79', fontSize: 11, fontWeight: '700' },
  dayDot: { width: 18, height: 18, borderRadius: 9, borderColor: '#b6bdb7', borderWidth: 1, backgroundColor: '#fff' },
  dayDotDone: { backgroundColor: '#5b7e63', borderColor: '#5b7e63' },
  deleteButton: { alignSelf: 'flex-start', marginTop: 14, paddingVertical: 4 },
  deleteText: { color: '#8c4a45', fontSize: 12, fontWeight: '700' },
  emptyCard: { backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 20, padding: 22 },
  emptyTitle: { color: '#243027', fontSize: 18, fontWeight: '800' },
  emptyText: { color: '#737a74', fontSize: 14, lineHeight: 21, marginTop: 6 },
  footer: { color: '#868b86', fontSize: 12, lineHeight: 18, marginTop: 26 },
  pressed: { opacity: 0.68 },
});
