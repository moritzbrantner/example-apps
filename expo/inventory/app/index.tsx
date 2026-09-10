import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CameraView,
  type BarcodeScanningResult,
  useCameraPermissions,
} from 'expo-camera';
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
  adjustQuantity,
  buildBorrowedHandoff,
  buildDocumentsHandoff,
  buildEventWorkboardHandoff,
  buildMaintenanceHandoff,
  createInventoryItem,
  deserializeInventoryItems,
  findInventoryItemByCode,
  isLowStock,
  normalizeBarcode,
  parseInventoryOpenHandoff,
  type InventoryItem,
} from '../lib/inventory';

const STORAGE_KEY = '@example-apps/inventory/items-v1';

function makeId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseNonNegative(value: string, fallback: number): number {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

export default function InventoryApp() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [location, setLocation] = useState('');
  const [barcode, setBarcode] = useState('');
  const [lowAt, setLowAt] = useState('0');
  const [notes, setNotes] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        setItems(deserializeInventoryItems(stored));
        setHydrated(true);
      })
      .catch(() => {
        if (active) setMessage('Local inventory could not be read. Changes will not be persisted until the app is reopened successfully.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, 150);
    return () => clearTimeout(timer);
  }, [hydrated, items]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      const itemId = parseInventoryOpenHandoff(url);
      if (itemId) {
        setSelectedItemId(itemId);
        setMessage('Opened the linked inventory item.');
      }
    };
    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  const visibleItems = useMemo(
    () =>
      [...items].sort(
        (left, right) =>
          Number(isLowStock(right)) - Number(isLowStock(left)) ||
          left.name.localeCompare(right.name),
      ),
    [items],
  );

  const addItem = () => {
    if (!name.trim()) return;
    const next = createInventoryItem({
      id: makeId(),
      name,
      quantity: parseNonNegative(quantity, 1),
      unit,
      location,
      barcode,
      lowAt: parseNonNegative(lowAt, 0),
      notes,
    });
    setItems((current) => [next, ...current]);
    setName('');
    setQuantity('1');
    setUnit('pcs');
    setLocation('');
    setBarcode('');
    setLowAt('0');
    setNotes('');
    setMessage(`${next.name} added.`);
  };

  const updateQuantity = (item: InventoryItem, delta: number) => {
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? adjustQuantity(candidate, delta) : candidate,
      ),
    );
  };

  const openHandoff = (url: string, label: string) => {
    setMessage('');
    void Linking.openURL(url).catch(() => {
      setMessage(`${label} is not installed or cannot open this handoff here.`);
    });
  };

  const openScanner = () => {
    setScanLocked(false);
    setMessage('');
    if (permission?.granted) {
      setScanOpen(true);
      return;
    }
    void requestPermission().then((result) => {
      if (result.granted) setScanOpen(true);
    });
  };

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (scanLocked) return;
    setScanLocked(true);
    const code = normalizeBarcode(result.data);
    const existing = findInventoryItemByCode(items, code);
    if (existing) {
      setSelectedItemId(existing.id);
      setMessage(`Found ${existing.name}.`);
    } else {
      setBarcode(code);
      setMessage('Code captured. Add a name to create this item.');
    }
    setScanOpen(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>HOUSEHOLD INVENTORY</Text>
          <Text style={styles.heading}>Know what you have and where it is.</Text>
          <Text style={styles.subheading}>
            Local-first inventory with physical-code scanning and direct handoffs to other everyday apps.
          </Text>

          {scanOpen ? (
            <View style={styles.scannerCard}>
              <CameraView
                active
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'qr'] }}
                onBarcodeScanned={handleBarcode}
                style={styles.camera}
              />
              <Pressable onPress={() => setScanOpen(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancel scan</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.composer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Add item</Text>
              <Pressable onPress={openScanner} style={styles.scanButton}>
                <Text style={styles.scanButtonText}>Scan code</Text>
              </Pressable>
            </View>

            <TextInput
              accessibilityLabel="Item name"
              onChangeText={setName}
              placeholder="Detergent, drill, diapers…"
              placeholderTextColor="#7b817b"
              style={styles.input}
              value={name}
            />

            <View style={styles.row}>
              <TextInput
                accessibilityLabel="Quantity"
                keyboardType="decimal-pad"
                onChangeText={setQuantity}
                placeholder="1"
                style={[styles.input, styles.rowInput]}
                value={quantity}
              />
              <TextInput
                accessibilityLabel="Unit"
                onChangeText={setUnit}
                placeholder="pcs"
                style={[styles.input, styles.rowInput]}
                value={unit}
              />
            </View>

            <TextInput
              accessibilityLabel="Storage location"
              onChangeText={setLocation}
              placeholder="Kitchen · lower cupboard"
              placeholderTextColor="#7b817b"
              style={styles.input}
              value={location}
            />

            <View style={styles.row}>
              <TextInput
                accessibilityLabel="Barcode or QR value"
                onChangeText={setBarcode}
                placeholder="Barcode / QR"
                placeholderTextColor="#7b817b"
                style={[styles.input, styles.rowInput]}
                value={barcode}
              />
              <TextInput
                accessibilityLabel="Low stock threshold"
                keyboardType="decimal-pad"
                onChangeText={setLowAt}
                placeholder="Low at"
                placeholderTextColor="#7b817b"
                style={[styles.input, styles.rowInput]}
                value={lowAt}
              />
            </View>

            <TextInput
              accessibilityLabel="Inventory notes"
              onChangeText={setNotes}
              placeholder="Optional note"
              placeholderTextColor="#7b817b"
              style={styles.input}
              value={notes}
            />

            <Pressable
              disabled={!name.trim()}
              onPress={addItem}
              style={({ pressed }) => [
                styles.primaryButton,
                !name.trim() && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.primaryButtonText}>Add to inventory</Text>
            </Pressable>
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.list}>
            {visibleItems.length === 0 ? (
              <Text style={styles.emptyText}>Nothing recorded yet.</Text>
            ) : (
              visibleItems.map((item) => {
                const low = isLowStock(item);
                const selected = selectedItemId === item.id;
                return (
                  <View key={item.id} style={[styles.itemRow, selected && styles.itemRowSelected]}>
                    <View style={styles.itemCopy}>
                      <View style={styles.itemTitleRow}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {low ? <Text style={styles.lowLabel}>LOW</Text> : null}
                      </View>
                      <Text style={styles.meta}>
                        {formatQuantity(item.quantity)} {item.unit}
                        {item.location ? ` · ${item.location}` : ''}
                      </Text>
                      {item.barcode ? <Text style={styles.codeText}>{item.barcode}</Text> : null}
                    </View>

                    <View style={styles.quantityActions}>
                      <Pressable
                        accessibilityLabel={`Decrease ${item.name}`}
                        onPress={() => updateQuantity(item, -1)}
                        style={styles.circleButton}>
                        <Text style={styles.circleButtonText}>−</Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Increase ${item.name}`}
                        onPress={() => updateQuantity(item, 1)}
                        style={styles.circleButton}>
                        <Text style={styles.circleButtonText}>+</Text>
                      </Pressable>
                    </View>

                    <View style={styles.handoffRow}>
                      <Pressable
                        onPress={() => openHandoff(buildBorrowedHandoff(item), 'Borrowed & Lent')}
                        style={styles.textButton}>
                        <Text style={styles.textButtonText}>Lend / borrow</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => openHandoff(buildMaintenanceHandoff(item), 'Home Maintenance')}
                        style={styles.textButton}>
                        <Text style={styles.textButtonText}>Maintenance</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => openHandoff(buildDocumentsHandoff(item), 'Household Documents')}
                        style={styles.textButton}>
                        <Text style={styles.textButtonText}>Document</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => openHandoff(buildEventWorkboardHandoff(item), 'Event Workboard')}
                        style={styles.textButton}>
                        <Text style={styles.textButtonText}>Event</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setItems((current) => current.filter((candidate) => candidate.id !== item.id))
                        }
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
            Inventory data stays on this device. Inter-app links carry only the item id, name, and location needed for the receiving action.
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
  eyebrow: { color: '#657067', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#1f2921', fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1, marginTop: 8 },
  subheading: { color: '#687068', fontSize: 15, lineHeight: 22, marginTop: 8 },
  composer: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 24, paddingTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: '#273129', fontSize: 18, fontWeight: '800' },
  scanButton: { borderColor: '#aeb9af', borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  scanButtonText: { color: '#31513a', fontSize: 13, fontWeight: '800' },
  input: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12 },
  row: { flexDirection: 'row', gap: 10 },
  rowInput: { flex: 1, minWidth: 0 },
  primaryButton: { alignItems: 'center', backgroundColor: '#243c2b', borderRadius: 14, marginTop: 14, paddingVertical: 13 },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  secondaryButton: { alignSelf: 'center', marginTop: 10, paddingVertical: 10, paddingHorizontal: 16 },
  secondaryButtonText: { color: '#31513a', fontWeight: '800' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.68 },
  scannerCard: { overflow: 'hidden', borderRadius: 20, borderColor: '#d7d9d2', borderWidth: 1, backgroundColor: '#faf9f5', marginTop: 20, paddingBottom: 4 },
  camera: { width: '100%', height: 260 },
  message: { color: '#4f6555', fontSize: 13, lineHeight: 19, marginVertical: 14 },
  list: { marginTop: 10, borderTopColor: '#d9dbd5', borderTopWidth: 1 },
  itemRow: { borderBottomColor: '#d9dbd5', borderBottomWidth: 1, paddingVertical: 15 },
  itemRowSelected: { borderLeftColor: '#5d7963', borderLeftWidth: 3, paddingLeft: 10 },
  itemCopy: { minWidth: 0 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  itemName: { color: '#273129', fontSize: 17, fontWeight: '800' },
  lowLabel: { color: '#8a4b3b', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  meta: { color: '#727a73', fontSize: 13, marginTop: 4 },
  codeText: { color: '#8a8f8a', fontSize: 11, marginTop: 3 },
  quantityActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  circleButton: { alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#bfc7bf' },
  circleButtonText: { color: '#31513a', fontSize: 22, fontWeight: '700' },
  handoffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  textButton: { paddingVertical: 6 },
  textButtonText: { color: '#31513a', fontSize: 12, fontWeight: '800' },
  deleteText: { color: '#8c4a45', fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#737a74', paddingVertical: 26, textAlign: 'center' },
  footer: { color: '#868b86', fontSize: 12, lineHeight: 18, marginTop: 26 },
});
