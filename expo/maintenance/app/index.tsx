import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
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
  buildInventoryOpenHandoff,
  createAsset,
  daysUntilDue,
  deserializeAssets,
  lastCompletedOn,
  markMaintenanceComplete,
  nextDueOn,
  parseInventoryMaintenanceHandoff,
  type MaintainedAsset,
} from '../lib/maintenance';

const STORAGE_KEY = '@example-apps/maintenance/assets-v1';

function makeId(): string {
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dueLabel(asset: MaintainedAsset, today: string): string {
  const due = nextDueOn(asset);
  if (!due) return 'No maintenance recorded yet';
  const days = daysUntilDue(asset, today);
  if (days === null) return `Next due ${due}`;
  if (days < 0) return `Overdue since ${due}`;
  if (days === 0) return 'Due today';
  return `Next due ${due} · ${days} day${days === 1 ? '' : 's'}`;
}

export default function MaintenanceApp() {
  const [assets, setAssets] = useState<MaintainedAsset[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [intervalDays, setIntervalDays] = useState('90');
  const [notes, setNotes] = useState('');
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const today = todayKey();

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        setAssets(deserializeAssets(stored));
        setHydrated(true);
      })
      .catch(() => {
        if (active) setMessage('Maintenance history could not be read. Changes will not be persisted until the app is reopened successfully.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    }, 150);
    return () => clearTimeout(timer);
  }, [assets, hydrated]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      const handoff = parseInventoryMaintenanceHandoff(url);
      if (!handoff) return;
      setName(handoff.name);
      setInventoryItemId(handoff.itemId);
      setLocation(handoff.location);
      setMessage('Asset received from Household Inventory.');
    };
    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  const orderedAssets = useMemo(
    () =>
      [...assets].sort((left, right) => {
        const leftRank = daysUntilDue(left, today) ?? Number.POSITIVE_INFINITY;
        const rightRank = daysUntilDue(right, today) ?? Number.POSITIVE_INFINITY;
        return leftRank - rightRank || left.name.localeCompare(right.name);
      }),
    [assets, today],
  );

  const addAsset = () => {
    setMessage('');
    try {
      const asset = createAsset({
        id: makeId(),
        name,
        inventoryItemId,
        location,
        intervalDays: Number(intervalDays),
        notes,
      });
      setAssets((current) => [asset, ...current]);
      setName('');
      setInventoryItemId(null);
      setLocation('');
      setIntervalDays('90');
      setNotes('');
      setMessage(`${asset.name} added.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add asset.');
    }
  };

  const complete = (asset: MaintainedAsset) => {
    setAssets((current) =>
      current.map((candidate) =>
        candidate.id === asset.id
          ? markMaintenanceComplete(candidate, today, completionNotes[asset.id] ?? '')
          : candidate,
      ),
    );
    setCompletionNotes((current) => ({ ...current, [asset.id]: '' }));
    setMessage(`Maintenance recorded for ${asset.name}.`);
  };

  const openInventory = (asset: MaintainedAsset) => {
    const url = buildInventoryOpenHandoff(asset);
    if (!url) return;
    void Linking.openURL(url).catch(() => {
      setMessage('Household Inventory is not installed or cannot open this handoff here.');
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>HOME MAINTENANCE</Text>
          <Text style={styles.heading}>Keep ordinary things working.</Text>
          <Text style={styles.subheading}>Record what was maintained and derive the next due date from real history.</Text>

          <View style={styles.composer}>
            <Text style={styles.sectionTitle}>Add maintained item</Text>
            <TextInput
              accessibilityLabel="Asset name"
              onChangeText={(value) => {
                setName(value);
                if (!value.trim()) setInventoryItemId(null);
              }}
              placeholder="Water filter, bicycle, smoke detector…"
              placeholderTextColor="#7b817b"
              style={styles.input}
              value={name}
            />
            {inventoryItemId ? <Text style={styles.linkedText}>Linked to Household Inventory</Text> : null}
            <TextInput accessibilityLabel="Asset location" onChangeText={setLocation} placeholder="Location" placeholderTextColor="#7b817b" style={styles.input} value={location} />
            <TextInput accessibilityLabel="Maintenance interval in days" keyboardType="number-pad" onChangeText={setIntervalDays} placeholder="Interval in days" placeholderTextColor="#7b817b" style={styles.input} value={intervalDays} />
            <TextInput accessibilityLabel="Asset notes" onChangeText={setNotes} placeholder="Model, filter size, part number, notes…" placeholderTextColor="#7b817b" style={styles.input} value={notes} />
            <Pressable
              disabled={!name.trim() || !intervalDays.trim()}
              onPress={addAsset}
              style={({ pressed }) => [
                styles.primaryButton,
                (!name.trim() || !intervalDays.trim()) && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.primaryButtonText}>Add maintained item</Text>
            </Pressable>
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.sectionTitle}>Maintenance</Text>
          <View style={styles.list}>
            {orderedAssets.length === 0 ? (
              <Text style={styles.emptyText}>No maintained items yet.</Text>
            ) : (
              orderedAssets.map((asset) => {
                const days = daysUntilDue(asset, today);
                const attention = days !== null && days <= 7;
                return (
                  <View key={asset.id} style={styles.assetRow}>
                    <View style={styles.assetCopy}>
                      <Text style={styles.assetName}>{asset.name}</Text>
                      <Text style={[styles.meta, attention && styles.attention]}>{dueLabel(asset, today)}</Text>
                      <Text style={styles.meta}>Every {asset.intervalDays} days{asset.location ? ` · ${asset.location}` : ''}</Text>
                      {asset.notes ? <Text style={styles.note}>{asset.notes}</Text> : null}
                      {lastCompletedOn(asset) ? <Text style={styles.historyText}>Last completed {lastCompletedOn(asset)}</Text> : null}
                    </View>

                    <TextInput
                      accessibilityLabel={`Maintenance note for ${asset.name}`}
                      onChangeText={(value) => setCompletionNotes((current) => ({ ...current, [asset.id]: value }))}
                      placeholder="What was done? (optional)"
                      placeholderTextColor="#7b817b"
                      style={styles.smallInput}
                      value={completionNotes[asset.id] ?? ''}
                    />

                    <View style={styles.actionRow}>
                      <Pressable onPress={() => complete(asset)} style={styles.textButton}>
                        <Text style={styles.textButtonText}>Done today</Text>
                      </Pressable>
                      {asset.inventoryItemId ? (
                        <Pressable onPress={() => openInventory(asset)} style={styles.textButton}>
                          <Text style={styles.textButtonText}>Inventory</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => setAssets((current) => current.filter((candidate) => candidate.id !== asset.id))}
                        style={styles.textButton}>
                        <Text style={styles.deleteText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <Text style={styles.footer}>
            Home Maintenance owns maintenance history. Inventory links are foreign references only; schedules are derived from explicit completion records.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 52 },
  eyebrow: { color: '#657067', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#1f2921', fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1, marginTop: 8 },
  subheading: { color: '#687068', fontSize: 15, lineHeight: 22, marginTop: 8 },
  composer: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 24, paddingTop: 20 },
  sectionTitle: { color: '#273129', fontSize: 18, fontWeight: '800' },
  input: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12 },
  linkedText: { color: '#526a58', fontSize: 12, fontWeight: '700', marginTop: 6 },
  primaryButton: { alignItems: 'center', backgroundColor: '#243c2b', borderRadius: 14, marginTop: 14, paddingVertical: 13 },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.68 },
  message: { color: '#4f6555', fontSize: 13, lineHeight: 19, marginVertical: 14 },
  list: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 10 },
  assetRow: { borderBottomColor: '#d9dbd5', borderBottomWidth: 1, paddingVertical: 15 },
  assetCopy: { minWidth: 0 },
  assetName: { color: '#273129', fontSize: 17, fontWeight: '800' },
  meta: { color: '#727a73', fontSize: 13, lineHeight: 19, marginTop: 4 },
  attention: { color: '#8a4b3b', fontWeight: '800' },
  note: { color: '#666e67', fontSize: 13, lineHeight: 19, marginTop: 5 },
  historyText: { color: '#858b85', fontSize: 12, marginTop: 5 },
  smallInput: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 12, color: '#1f2921', fontSize: 14, marginTop: 11, paddingHorizontal: 12, paddingVertical: 10 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 9 },
  textButton: { paddingVertical: 6 },
  textButtonText: { color: '#31513a', fontSize: 12, fontWeight: '800' },
  deleteText: { color: '#8c4a45', fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#737a74', paddingVertical: 26, textAlign: 'center' },
  footer: { color: '#868b86', fontSize: 12, lineHeight: 18, marginTop: 26 },
});
