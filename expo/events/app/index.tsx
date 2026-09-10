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
  RSVP_STATUSES,
  TASK_CATEGORIES,
  addBringItem,
  addGuest,
  addTask,
  buildEventImportHandoff,
  buildInventoryOpenHandoff,
  copyEvent,
  createEvent,
  deserializeCollection,
  emptyCollection,
  parseEventImportHandoff,
  parseInventoryEventHandoff,
  removeGuest,
  setBringItemBrought,
  setGuestStatus,
  setTaskDone,
  type EventCollection,
  type EventPlan,
  type RsvpStatus,
  type TaskCategory,
} from '../lib/events';

const STORAGE_KEY = '@example-apps/events/collection-v1';

function makeId(kind: 'event' | 'guest' | 'bring' | 'task'): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function statusLabel(status: RsvpStatus): string {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'declined') return 'Declined';
  return 'Invited';
}

function categoryLabel(category: TaskCategory): string {
  if (category === 'setup') return 'Setup';
  if (category === 'cleanup') return 'Cleanup';
  return 'General';
}

function guestName(event: EventPlan, guestId: string | null): string {
  if (!guestId) return 'Unassigned';
  return event.guests.find((guest) => guest.id === guestId)?.name ?? 'Unassigned';
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function EventWorkboardApp() {
  const [collection, setCollection] = useState<EventCollection>(emptyCollection());
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingImport, setPendingImport] = useState<EventPlan | null>(null);

  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventNotes, setEventNotes] = useState('');

  const [guestDraft, setGuestDraft] = useState('');

  const [bringLabel, setBringLabel] = useState('');
  const [bringQuantity, setBringQuantity] = useState('');
  const [bringGuestId, setBringGuestId] = useState<string | null>(null);
  const [bringInventoryItemId, setBringInventoryItemId] = useState<string | null>(null);
  const [bringNotes, setBringNotes] = useState('');

  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState<TaskCategory>('general');
  const [taskGuestId, setTaskGuestId] = useState<string | null>(null);
  const [taskNotes, setTaskNotes] = useState('');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        setCollection(deserializeCollection(stored));
        setHydrated(true);
      })
      .catch(() => {
        if (active) {
          setMessage('Saved events could not be read. Changes will not be persisted until the app is reopened successfully.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
    }, 150);
    return () => clearTimeout(timer);
  }, [collection, hydrated]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      const inventory = parseInventoryEventHandoff(url);
      if (inventory) {
        setBringLabel(inventory.label);
        setBringInventoryItemId(inventory.inventoryItemId);
        setMessage(collection.selectedEventId
          ? 'Inventory item staged in the Bring section.'
          : 'Inventory item staged. Create or select an event, then add it in the Bring section.');
        return;
      }
      const imported = parseEventImportHandoff(url);
      if (imported) {
        setPendingImport(imported);
        setMessage('Shared event received. Review it before adding a local copy.');
      }
    };

    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [collection.selectedEventId]);

  const selectedEvent = collection.events.find((event) => event.id === collection.selectedEventId) ?? null;
  const orderedEvents = useMemo(
    () => [...collection.events].sort((left, right) => (left.date || '9999-99-99').localeCompare(right.date || '9999-99-99') || left.title.localeCompare(right.title)),
    [collection.events],
  );

  const updateSelected = (update: (event: EventPlan) => EventPlan) => {
    if (!collection.selectedEventId) return;
    setCollection((current) => ({
      ...current,
      events: current.events.map((event) => event.id === current.selectedEventId ? update(event) : event),
    }));
  };

  const createNewEvent = () => {
    setMessage('');
    try {
      const event = createEvent({ id: makeId('event'), title: eventTitle, date: eventDate, location: eventLocation, notes: eventNotes });
      setCollection((current) => ({ events: [...current.events, event], selectedEventId: event.id }));
      setEventTitle('');
      setEventDate('');
      setEventLocation('');
      setEventNotes('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create event.');
    }
  };

  const addInvitee = () => {
    if (!selectedEvent || !guestDraft.trim()) return;
    setMessage('');
    try {
      updateSelected((event) => addGuest(event, { id: makeId('guest'), name: guestDraft }));
      setGuestDraft('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add invitee.');
    }
  };

  const addBring = () => {
    if (!selectedEvent || !bringLabel.trim()) return;
    setMessage('');
    try {
      updateSelected((event) => addBringItem(event, {
        id: makeId('bring'),
        label: bringLabel,
        quantity: bringQuantity,
        guestId: bringGuestId,
        inventoryItemId: bringInventoryItemId,
        notes: bringNotes,
      }));
      setBringLabel('');
      setBringQuantity('');
      setBringGuestId(null);
      setBringInventoryItemId(null);
      setBringNotes('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add bring item.');
    }
  };

  const addWork = () => {
    if (!selectedEvent || !taskTitle.trim()) return;
    setMessage('');
    try {
      updateSelected((event) => addTask(event, {
        id: makeId('task'),
        title: taskTitle,
        category: taskCategory,
        guestId: taskGuestId,
        notes: taskNotes,
      }));
      setTaskTitle('');
      setTaskCategory('general');
      setTaskGuestId(null);
      setTaskNotes('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add work item.');
    }
  };

  const shareSelected = () => {
    if (!selectedEvent) return;
    void Share.share({
      title: selectedEvent.title,
      message: buildEventImportHandoff(selectedEvent),
    }).catch(() => setMessage('This device could not open a share target.'));
  };

  const acceptImport = () => {
    if (!pendingImport) return;
    const copy = copyEvent(pendingImport, makeId);
    setCollection((current) => ({ events: [...current.events, copy], selectedEventId: copy.id }));
    setPendingImport(null);
    setMessage('Shared event added as a local copy.');
  };

  const removeSelectedEvent = () => {
    if (!selectedEvent) return;
    setCollection((current) => {
      const events = current.events.filter((event) => event.id !== selectedEvent.id);
      return { events, selectedEventId: events[0]?.id ?? null };
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>EVENT WORKBOARD</Text>
          <Text style={styles.heading}>Organize the people and the work around an event.</Text>
          <Text style={styles.subheading}>Invitations, things to bring, setup, general work, and cleanup stay visible in one local board.</Text>

          <View style={styles.composer}>
            <Text style={styles.sectionTitle}>New event</Text>
            <TextInput accessibilityLabel="Event title" onChangeText={setEventTitle} placeholder="Parish lunch, birthday, family visit…" placeholderTextColor="#7b817b" style={styles.input} value={eventTitle} />
            <View style={styles.row}>
              <TextInput accessibilityLabel="Event date" onChangeText={setEventDate} placeholder="YYYY-MM-DD" placeholderTextColor="#7b817b" style={[styles.input, styles.rowInput]} value={eventDate} />
              <TextInput accessibilityLabel="Event location" onChangeText={setEventLocation} placeholder="Location" placeholderTextColor="#7b817b" style={[styles.input, styles.rowInput]} value={eventLocation} />
            </View>
            <TextInput accessibilityLabel="Event notes" onChangeText={setEventNotes} placeholder="Optional notes" placeholderTextColor="#7b817b" style={styles.input} value={eventNotes} />
            <Pressable disabled={!eventTitle.trim()} onPress={createNewEvent} style={({ pressed }) => [styles.primaryButton, !eventTitle.trim() && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Create event</Text>
            </Pressable>
          </View>

          {orderedEvents.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventTabs}>
              {orderedEvents.map((event) => (
                <Choice key={event.id} label={`${event.title}${event.date ? ` · ${event.date}` : ''}`} selected={event.id === collection.selectedEventId} onPress={() => setCollection((current) => ({ ...current, selectedEventId: event.id }))} />
              ))}
            </ScrollView>
          ) : null}

          {pendingImport ? (
            <View style={styles.importBox}>
              <Text style={styles.importTitle}>Shared event: {pendingImport.title}</Text>
              <Text style={styles.meta}>{pendingImport.date || 'No date'}{pendingImport.location ? ` · ${pendingImport.location}` : ''}</Text>
              <Text style={styles.importText}>This will add a copied event. It will not merge into or overwrite an existing local event.</Text>
              <View style={styles.actionRow}>
                <Pressable onPress={acceptImport} style={styles.textButton}><Text style={styles.textButtonText}>Add local copy</Text></Pressable>
                <Pressable onPress={() => setPendingImport(null)} style={styles.textButton}><Text style={styles.deleteText}>Discard</Text></Pressable>
              </View>
            </View>
          ) : null}

          {message ? <Text style={styles.message}>{message}</Text> : null}

          {selectedEvent ? (
            <>
              <View style={styles.eventHeader}>
                <Text style={styles.eventTitle}>{selectedEvent.title}</Text>
                <Text style={styles.meta}>{selectedEvent.date || 'Date not set'}{selectedEvent.location ? ` · ${selectedEvent.location}` : ''}</Text>
                {selectedEvent.notes ? <Text style={styles.note}>{selectedEvent.notes}</Text> : null}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Guests</Text>
                <View style={styles.row}>
                  <TextInput accessibilityLabel="Invitee name" onChangeText={setGuestDraft} onSubmitEditing={addInvitee} placeholder="Invite someone" placeholderTextColor="#7b817b" style={[styles.input, styles.rowInput]} value={guestDraft} />
                  <Pressable disabled={!guestDraft.trim()} onPress={addInvitee} style={[styles.smallButton, !guestDraft.trim() && styles.disabled]}><Text style={styles.smallButtonText}>Invite</Text></Pressable>
                </View>
                <View style={styles.list}>
                  {selectedEvent.guests.length === 0 ? <Text style={styles.emptyText}>No invitees yet.</Text> : selectedEvent.guests.map((guest) => (
                    <View key={guest.id} style={styles.itemRow}>
                      <Text style={styles.itemTitle}>{guest.name}</Text>
                      <View style={styles.choiceRow}>
                        {RSVP_STATUSES.map((status) => <Choice key={status} label={statusLabel(status)} selected={guest.status === status} onPress={() => updateSelected((event) => setGuestStatus(event, guest.id, status))} />)}
                      </View>
                      <Pressable onPress={() => {
                        updateSelected((event) => removeGuest(event, guest.id));
                        if (bringGuestId === guest.id) setBringGuestId(null);
                        if (taskGuestId === guest.id) setTaskGuestId(null);
                      }} style={styles.textButton}><Text style={styles.deleteText}>Remove invitee</Text></Pressable>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bring</Text>
                {bringInventoryItemId ? <Text style={styles.linkedText}>Staged from Household Inventory</Text> : null}
                <TextInput accessibilityLabel="Thing to bring" onChangeText={(value) => {
                  setBringLabel(value);
                  if (!value.trim()) setBringInventoryItemId(null);
                }} placeholder="Dessert, folding chairs, drinks…" placeholderTextColor="#7b817b" style={styles.input} value={bringLabel} />
                <TextInput accessibilityLabel="Bring quantity" onChangeText={setBringQuantity} placeholder="Quantity or amount (optional)" placeholderTextColor="#7b817b" style={styles.input} value={bringQuantity} />
                <Text style={styles.fieldLabel}>Responsible person</Text>
                <View style={styles.choiceRow}>
                  <Choice label="Unassigned" selected={bringGuestId === null} onPress={() => setBringGuestId(null)} />
                  {selectedEvent.guests.map((guest) => <Choice key={guest.id} label={guest.name} selected={bringGuestId === guest.id} onPress={() => setBringGuestId(guest.id)} />)}
                </View>
                <TextInput accessibilityLabel="Bring notes" onChangeText={setBringNotes} placeholder="Optional note" placeholderTextColor="#7b817b" style={styles.input} value={bringNotes} />
                <Pressable disabled={!bringLabel.trim()} onPress={addBring} style={({ pressed }) => [styles.primaryButton, !bringLabel.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Add bring item</Text></Pressable>

                <View style={styles.list}>
                  {selectedEvent.bringItems.length === 0 ? <Text style={styles.emptyText}>Nothing assigned to bring yet.</Text> : [...selectedEvent.bringItems].sort((a, b) => Number(a.brought) - Number(b.brought) || a.label.localeCompare(b.label)).map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <Text style={[styles.itemTitle, item.brought && styles.doneText]}>{item.label}{item.quantity ? ` · ${item.quantity}` : ''}</Text>
                      <Text style={styles.meta}>{guestName(selectedEvent, item.guestId)}</Text>
                      {item.notes ? <Text style={styles.note}>{item.notes}</Text> : null}
                      <View style={styles.actionRow}>
                        <Pressable onPress={() => updateSelected((event) => setBringItemBrought(event, item.id, !item.brought))} style={styles.textButton}><Text style={styles.textButtonText}>{item.brought ? 'Mark not brought' : 'Mark brought'}</Text></Pressable>
                        {item.inventoryItemId ? <Pressable onPress={() => {
                          const url = buildInventoryOpenHandoff(item);
                          if (url) void Linking.openURL(url).catch(() => setMessage('Household Inventory could not be opened.'));
                        }} style={styles.textButton}><Text style={styles.textButtonText}>Inventory</Text></Pressable> : null}
                        <Pressable onPress={() => updateSelected((event) => ({ ...event, bringItems: event.bringItems.filter((candidate) => candidate.id !== item.id), updatedAt: new Date().toISOString() }))} style={styles.textButton}><Text style={styles.deleteText}>Remove</Text></Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Work</Text>
                <TextInput accessibilityLabel="Work item" onChangeText={setTaskTitle} placeholder="Set tables, welcome guests, clean kitchen…" placeholderTextColor="#7b817b" style={styles.input} value={taskTitle} />
                <Text style={styles.fieldLabel}>Category</Text>
                <View style={styles.choiceRow}>{TASK_CATEGORIES.map((category) => <Choice key={category} label={categoryLabel(category)} selected={taskCategory === category} onPress={() => setTaskCategory(category)} />)}</View>
                <Text style={styles.fieldLabel}>Responsible person</Text>
                <View style={styles.choiceRow}>
                  <Choice label="Unassigned" selected={taskGuestId === null} onPress={() => setTaskGuestId(null)} />
                  {selectedEvent.guests.map((guest) => <Choice key={guest.id} label={guest.name} selected={taskGuestId === guest.id} onPress={() => setTaskGuestId(guest.id)} />)}
                </View>
                <TextInput accessibilityLabel="Work notes" onChangeText={setTaskNotes} placeholder="Optional note" placeholderTextColor="#7b817b" style={styles.input} value={taskNotes} />
                <Pressable disabled={!taskTitle.trim()} onPress={addWork} style={({ pressed }) => [styles.primaryButton, !taskTitle.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Add work item</Text></Pressable>

                {TASK_CATEGORIES.map((category) => {
                  const tasks = selectedEvent.tasks.filter((task) => task.category === category).sort((a, b) => Number(a.done) - Number(b.done) || a.title.localeCompare(b.title));
                  if (tasks.length === 0) return null;
                  return (
                    <View key={category} style={styles.workGroup}>
                      <Text style={styles.groupTitle}>{categoryLabel(category)}</Text>
                      {tasks.map((task) => (
                        <View key={task.id} style={styles.itemRow}>
                          <Text style={[styles.itemTitle, task.done && styles.doneText]}>{task.title}</Text>
                          <Text style={styles.meta}>{guestName(selectedEvent, task.guestId)}</Text>
                          {task.notes ? <Text style={styles.note}>{task.notes}</Text> : null}
                          <View style={styles.actionRow}>
                            <Pressable onPress={() => updateSelected((event) => setTaskDone(event, task.id, !task.done))} style={styles.textButton}><Text style={styles.textButtonText}>{task.done ? 'Undo' : 'Done'}</Text></Pressable>
                            <Pressable onPress={() => updateSelected((event) => ({ ...event, tasks: event.tasks.filter((candidate) => candidate.id !== task.id), updatedAt: new Date().toISOString() }))} style={styles.textButton}><Text style={styles.deleteText}>Remove</Text></Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>

              <View style={styles.bottomActions}>
                <Pressable onPress={shareSelected} style={styles.textButton}><Text style={styles.textButtonText}>Share event snapshot</Text></Pressable>
                <Pressable onPress={removeSelectedEvent} style={styles.textButton}><Text style={styles.deleteText}>Remove event</Text></Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>Create an event to start organizing invitations and responsibilities.</Text>
          )}

          <Text style={styles.footer}>Shared snapshots create deliberate local copies; they are not live synchronization. Inventory links remain references to the source item.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 56 },
  eyebrow: { color: '#657067', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#1f2921', fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1, marginTop: 8 },
  subheading: { color: '#687068', fontSize: 15, lineHeight: 22, marginTop: 8 },
  composer: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 24, paddingTop: 20 },
  section: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 28, paddingTop: 20 },
  sectionTitle: { color: '#273129', fontSize: 19, fontWeight: '800' },
  input: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12 },
  row: { flexDirection: 'row', gap: 10 },
  rowInput: { flex: 1, minWidth: 0 },
  primaryButton: { alignItems: 'center', backgroundColor: '#243c2b', borderRadius: 14, marginTop: 14, paddingVertical: 13 },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  smallButton: { alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', backgroundColor: '#e3e8e1', borderRadius: 14, marginTop: 10, paddingHorizontal: 16 },
  smallButtonText: { color: '#31513a', fontWeight: '800' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.68 },
  eventTabs: { gap: 8, paddingTop: 18, paddingBottom: 4 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choice: { borderColor: '#cfd3cc', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  choiceSelected: { backgroundColor: '#243c2b', borderColor: '#243c2b' },
  choiceText: { color: '#687068', fontSize: 12, fontWeight: '700' },
  choiceTextSelected: { color: '#fff' },
  message: { color: '#4f6555', fontSize: 13, lineHeight: 19, marginTop: 14 },
  importBox: { backgroundColor: '#faf9f5', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 18, marginTop: 20, padding: 16 },
  importTitle: { color: '#273129', fontSize: 16, fontWeight: '800' },
  importText: { color: '#676f68', fontSize: 13, lineHeight: 19, marginTop: 6 },
  eventHeader: { marginTop: 24 },
  eventTitle: { color: '#273129', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  list: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 12 },
  itemRow: { borderBottomColor: '#d9dbd5', borderBottomWidth: 1, paddingVertical: 13 },
  itemTitle: { color: '#273129', fontSize: 16, fontWeight: '800' },
  doneText: { color: '#7b827c', textDecorationLine: 'line-through' },
  meta: { color: '#737a74', fontSize: 12, lineHeight: 18, marginTop: 4 },
  note: { color: '#666e67', fontSize: 13, lineHeight: 19, marginTop: 5 },
  fieldLabel: { color: '#626a63', fontSize: 12, fontWeight: '800', marginTop: 13 },
  linkedText: { color: '#526a58', fontSize: 12, fontWeight: '700', marginTop: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  textButton: { paddingVertical: 6 },
  textButtonText: { color: '#31513a', fontSize: 12, fontWeight: '800' },
  deleteText: { color: '#8c4a45', fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#737a74', paddingVertical: 22 },
  workGroup: { marginTop: 18 },
  groupTitle: { color: '#536158', fontSize: 13, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  bottomActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 26 },
  footer: { color: '#868b86', fontSize: 12, lineHeight: 18, marginTop: 28 },
});
