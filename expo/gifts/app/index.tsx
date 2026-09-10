import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import {
  addGift,
  addPerson,
  emptyGiftState,
  GIFT_DIRECTIONS,
  personName,
  returnToGiverWarning,
  upcomingPlannedGifts,
} from '../lib/gifts';
import type { GiftDirection, GiftRecord, GiftState } from '../lib/gifts';
import { loadGiftState, saveGiftState } from '../lib/storage';

type HistoryFilter = 'all' | GiftDirection;

function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function directionLabel(direction: GiftDirection): string {
  if (direction === 'received') {
    return 'Received';
  }
  if (direction === 'given') {
    return 'Given';
  }
  return 'Planned';
}

function relationLabel(gift: GiftRecord, state: GiftState): string {
  const name = personName(state, gift.personId);
  return gift.direction === 'received' ? `From ${name}` : `To ${name}`;
}

export default function GiftsApp() {
  const [state, setState] = useState<GiftState>(emptyGiftState());
  const [loaded, setLoaded] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [direction, setDirection] = useState<GiftDirection>('received');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [occasion, setOccasion] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceGiftId, setSourceGiftId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [error, setError] = useState('');

  useEffect(() => {
    void loadGiftState().then((next) => {
      setState(next);
      setSelectedPersonId(next.people[0]?.id ?? '');
      setLoaded(true);
    });
  }, []);

  const commit = (next: GiftState) => {
    setState(next);
    void saveGiftState(next);
  };

  const receivedGifts = useMemo(
    () => state.gifts.filter((gift) => gift.direction === 'received'),
    [state.gifts],
  );

  const upcoming = useMemo(
    () => upcomingPlannedGifts(state, todayKey(), 90),
    [state],
  );

  const history = useMemo(
    () =>
      [...state.gifts]
        .filter((gift) => historyFilter === 'all' || gift.direction === historyFilter)
        .sort(
          (left, right) =>
            right.date.localeCompare(left.date) ||
            right.createdAt - left.createdAt ||
            left.id.localeCompare(right.id),
        ),
    [historyFilter, state.gifts],
  );

  const warning = returnToGiverWarning(state, {
    direction,
    personId: selectedPersonId,
    sourceGiftId,
  });

  const handleAddPerson = () => {
    setError('');
    try {
      const id = makeId('person');
      const next = addPerson(state, { id, name: newPersonName });
      commit(next);
      setSelectedPersonId(id);
      setNewPersonName('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not add person');
    }
  };

  const handleSaveGift = () => {
    setError('');
    try {
      const next = addGift(state, {
        id: makeId('gift'),
        direction,
        personId: selectedPersonId,
        title,
        date,
        occasion,
        notes,
        sourceGiftId: direction === 'planned' ? sourceGiftId : null,
        createdAt: Date.now(),
      });
      commit(next);
      setTitle('');
      setOccasion('');
      setNotes('');
      setSourceGiftId(null);
      setDate(todayKey());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save gift');
    }
  };

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <Text style={styles.muted}>Loading gifts…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Gift Tracker</Text>
          <Text style={styles.subtitle}>
            Remember what came from whom, what you gave, and what you plan to give next.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          {upcoming.length === 0 ? (
            <Text style={styles.muted}>No planned gifts in the next 90 days.</Text>
          ) : (
            upcoming.map((gift) => (
              <GiftRow key={gift.id} gift={gift} state={state} />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>
          <View style={styles.filterRow}>
            {(['all', ...GIFT_DIRECTIONS] as const).map((filter) => (
              <ChoiceButton
                key={filter}
                label={filter === 'all' ? 'All' : directionLabel(filter)}
                selected={historyFilter === filter}
                onPress={() => setHistoryFilter(filter)}
              />
            ))}
          </View>
          {history.length === 0 ? (
            <Text style={styles.muted}>No gifts recorded in this view.</Text>
          ) : (
            history.map((gift) => (
              <GiftRow key={gift.id} gift={gift} state={state} />
            ))
          )}
        </View>

        <View style={[styles.section, styles.composer]}>
          <Text style={styles.sectionTitle}>Add record</Text>

          <Text style={styles.label}>Person</Text>
          <View style={styles.personCreator}>
            <TextInput
              accessibilityLabel="New person name"
              onChangeText={setNewPersonName}
              placeholder="Add a person"
              style={[styles.input, styles.personInput]}
              value={newPersonName}
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleAddPerson}
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonText}>Add</Text>
            </Pressable>
          </View>

          {state.people.length > 0 ? (
            <View style={styles.choiceWrap}>
              {state.people.map((person) => (
                <ChoiceButton
                  key={person.id}
                  label={person.name}
                  selected={selectedPersonId === person.id}
                  onPress={() => setSelectedPersonId(person.id)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>Add a person before recording a gift.</Text>
          )}

          <Text style={styles.label}>Record type</Text>
          <View style={styles.directionRow}>
            {GIFT_DIRECTIONS.map((value) => (
              <ChoiceButton
                key={value}
                label={directionLabel(value)}
                selected={direction === value}
                onPress={() => {
                  setDirection(value);
                  if (value !== 'planned') {
                    setSourceGiftId(null);
                  }
                }}
              />
            ))}
          </View>

          <Text style={styles.label}>Gift</Text>
          <TextInput
            accessibilityLabel="Gift title"
            onChangeText={setTitle}
            placeholder="What was it?"
            style={styles.input}
            value={title}
          />

          <Text style={styles.label}>Date</Text>
          <TextInput
            accessibilityLabel="Gift date"
            autoCapitalize="none"
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            style={styles.input}
            value={date}
          />

          <Text style={styles.label}>Occasion</Text>
          <TextInput
            accessibilityLabel="Gift occasion"
            onChangeText={setOccasion}
            placeholder="Birthday, Christmas, visit…"
            style={styles.input}
            value={occasion}
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            accessibilityLabel="Gift notes"
            multiline
            onChangeText={setNotes}
            placeholder="Optional details"
            style={[styles.input, styles.notesInput]}
            value={notes}
          />

          {direction === 'planned' && receivedGifts.length > 0 ? (
            <>
              <Text style={styles.label}>Regifting something you received?</Text>
              <View style={styles.choiceWrap}>
                <ChoiceButton
                  label="No linked gift"
                  selected={sourceGiftId === null}
                  onPress={() => setSourceGiftId(null)}
                />
                {receivedGifts.map((gift) => (
                  <ChoiceButton
                    key={gift.id}
                    label={`${gift.title} · ${personName(state, gift.personId)}`}
                    selected={sourceGiftId === gift.id}
                    onPress={() => setSourceGiftId(gift.id)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {warning ? <Text style={styles.warning}>{warning}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={state.people.length === 0}
            onPress={handleSaveGift}
            style={({ pressed }) => [
              styles.primaryButton,
              state.people.length === 0 && styles.disabledButton,
              pressed && state.people.length > 0 && styles.pressedButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>Save gift</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GiftRow({ gift, state }: { gift: GiftRecord; state: GiftState }) {
  return (
    <View style={styles.giftRow}>
      <View style={styles.giftText}>
        <Text style={styles.giftTitle}>{gift.title}</Text>
        <Text style={styles.giftMeta}>
          {directionLabel(gift.direction)} · {relationLabel(gift, state)}
        </Text>
        {gift.occasion ? <Text style={styles.giftMeta}>{gift.occasion}</Text> : null}
      </View>
      <Text style={styles.giftDate}>{gift.date}</Text>
    </View>
  );
}

function ChoiceButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f5f0',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 30,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#201f1b',
    letterSpacing: -1,
  },
  subtitle: {
    maxWidth: 560,
    fontSize: 16,
    lineHeight: 24,
    color: '#666158',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    color: '#201f1b',
  },
  muted: {
    fontSize: 15,
    lineHeight: 22,
    color: '#7a746a',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  directionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choice: {
    borderWidth: 1,
    borderColor: '#d4cec3',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: '#ffffff',
  },
  choiceSelected: {
    borderColor: '#2c2a26',
    backgroundColor: '#2c2a26',
  },
  choiceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a463f',
  },
  choiceTextSelected: {
    color: '#ffffff',
  },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d9d3c8',
    paddingVertical: 13,
  },
  giftText: {
    flex: 1,
    gap: 3,
  },
  giftTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    color: '#25231f',
  },
  giftMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: '#746e65',
  },
  giftDate: {
    fontSize: 13,
    lineHeight: 18,
    color: '#746e65',
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d4cec3',
    paddingTop: 26,
  },
  label: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#514d46',
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#d4cec3',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: '#ffffff',
    fontSize: 16,
    color: '#201f1b',
  },
  notesInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  personCreator: {
    flexDirection: 'row',
    gap: 8,
  },
  personInput: {
    flex: 1,
  },
  smallButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e8e2d8',
  },
  smallButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#302d28',
  },
  warning: {
    borderLeftWidth: 3,
    borderLeftColor: '#8a641b',
    paddingLeft: 10,
    fontSize: 14,
    lineHeight: 21,
    color: '#735719',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: '#a33131',
  },
  primaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2c2a26',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  disabledButton: {
    opacity: 0.38,
  },
  pressedButton: {
    opacity: 0.82,
  },
});
