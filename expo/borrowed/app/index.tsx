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
  activeLoans,
  buildInventoryOpenHandoff,
  createLoan,
  deserializeLoans,
  markLoanReturned,
  parseInventoryLoanHandoff,
  type LoanDirection,
  type LoanRecord,
} from '../lib/loans';

const STORAGE_KEY = '@example-apps/borrowed/loans-v1';

function makeId(): string {
  return `loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function BorrowedApp() {
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [direction, setDirection] = useState<LoanDirection>('lent');
  const [itemName, setItemName] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null);
  const [personName, setPersonName] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        setLoans(deserializeLoans(stored));
        setHydrated(true);
      })
      .catch(() => {
        if (active) setMessage('Loan history could not be read. Changes will not be persisted until the app is reopened successfully.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loans));
    }, 150);
    return () => clearTimeout(timer);
  }, [hydrated, loans]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      const handoff = parseInventoryLoanHandoff(url);
      if (!handoff) return;
      setItemName(handoff.name);
      setInventoryItemId(handoff.itemId);
      setDirection('lent');
      setMessage('Item received from Household Inventory.');
    };
    void Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  const active = useMemo(() => activeLoans(loans), [loans]);
  const history = useMemo(
    () =>
      loans
        .filter((loan) => Boolean(loan.returnedAt))
        .sort((left, right) => (right.returnedAt ?? '').localeCompare(left.returnedAt ?? ''))
        .slice(0, 20),
    [loans],
  );

  const addLoan = () => {
    setMessage('');
    try {
      const loan = createLoan({ id: makeId(), direction, itemName, inventoryItemId, personName, dueOn, notes });
      setLoans((current) => [loan, ...current]);
      setItemName('');
      setInventoryItemId(null);
      setPersonName('');
      setDueOn('');
      setNotes('');
      setMessage(direction === 'lent' ? 'Loan recorded.' : 'Borrowed item recorded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not record item.');
    }
  };

  const openInventory = (loan: LoanRecord) => {
    const url = buildInventoryOpenHandoff(loan);
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
          <Text style={styles.eyebrow}>BORROWED & LENT</Text>
          <Text style={styles.heading}>Remember where shared things went.</Text>
          <Text style={styles.subheading}>Track loans without turning your contacts or possessions into a social network.</Text>

          <View style={styles.composer}>
            <Text style={styles.sectionTitle}>Record an item</Text>
            <View style={styles.choiceRow}>
              {(['lent', 'borrowed'] as const).map((candidate) => (
                <Pressable
                  key={candidate}
                  accessibilityState={{ selected: direction === candidate }}
                  onPress={() => setDirection(candidate)}
                  style={[styles.choice, direction === candidate && styles.choiceSelected]}>
                  <Text style={[styles.choiceText, direction === candidate && styles.choiceTextSelected]}>
                    {candidate === 'lent' ? 'I lent it' : 'I borrowed it'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              accessibilityLabel="Item name"
              onChangeText={(value) => {
                setItemName(value);
                if (!value.trim()) setInventoryItemId(null);
              }}
              placeholder="Drill, book, trailer…"
              placeholderTextColor="#7b817b"
              style={styles.input}
              value={itemName}
            />
            {inventoryItemId ? <Text style={styles.linkedText}>Linked to Household Inventory</Text> : null}

            <TextInput
              accessibilityLabel="Person name"
              onChangeText={setPersonName}
              placeholder={direction === 'lent' ? 'Who has it?' : 'Who owns it?'}
              placeholderTextColor="#7b817b"
              style={styles.input}
              value={personName}
            />
            <TextInput
              accessibilityLabel="Due date"
              autoCapitalize="none"
              onChangeText={setDueOn}
              placeholder="Return by · YYYY-MM-DD (optional)"
              placeholderTextColor="#7b817b"
              style={styles.input}
              value={dueOn}
            />
            <TextInput
              accessibilityLabel="Loan notes"
              onChangeText={setNotes}
              placeholder="Optional note"
              placeholderTextColor="#7b817b"
              style={styles.input}
              value={notes}
            />

            <Pressable
              disabled={!itemName.trim() || !personName.trim()}
              onPress={addLoan}
              style={({ pressed }) => [
                styles.primaryButton,
                (!itemName.trim() || !personName.trim()) && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.primaryButtonText}>Save record</Text>
            </Pressable>
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Text style={styles.sectionTitle}>Currently out</Text>
          <View style={styles.list}>
            {active.length === 0 ? (
              <Text style={styles.emptyText}>No active loans.</Text>
            ) : (
              active.map((loan) => (
                <View key={loan.id} style={styles.loanRow}>
                  <View style={styles.loanCopy}>
                    <Text style={styles.loanTitle}>{loan.itemName}</Text>
                    <Text style={styles.meta}>
                      {loan.direction === 'lent' ? `With ${loan.personName}` : `From ${loan.personName}`}
                      {loan.dueOn ? ` · return by ${loan.dueOn}` : ''}
                    </Text>
                    {loan.notes ? <Text style={styles.note}>{loan.notes}</Text> : null}
                  </View>
                  <View style={styles.actionRow}>
                    {loan.inventoryItemId ? (
                      <Pressable onPress={() => openInventory(loan)} style={styles.textButton}>
                        <Text style={styles.textButtonText}>Inventory</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() =>
                        setLoans((current) =>
                          current.map((candidate) => candidate.id === loan.id ? markLoanReturned(candidate) : candidate),
                        )
                      }
                      style={styles.textButton}>
                      <Text style={styles.textButtonText}>Mark returned</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          {history.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, styles.historyTitle]}>Returned</Text>
              <View style={styles.list}>
                {history.map((loan) => (
                  <View key={loan.id} style={styles.loanRow}>
                    <View style={styles.loanCopy}>
                      <Text style={styles.loanTitle}>{loan.itemName}</Text>
                      <Text style={styles.meta}>
                        {loan.direction === 'lent' ? `Lent to ${loan.personName}` : `Borrowed from ${loan.personName}`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.footer}>
            Borrowed & Lent owns loan history. A link from Inventory is a reference, not duplicated inventory truth.
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
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  choice: { borderColor: '#cfd3cc', borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  choiceSelected: { backgroundColor: '#243c2b', borderColor: '#243c2b' },
  choiceText: { color: '#687068', fontSize: 13, fontWeight: '700' },
  choiceTextSelected: { color: '#fff' },
  input: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 12 },
  linkedText: { color: '#526a58', fontSize: 12, fontWeight: '700', marginTop: 6 },
  primaryButton: { alignItems: 'center', backgroundColor: '#243c2b', borderRadius: 14, marginTop: 14, paddingVertical: 13 },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.68 },
  message: { color: '#4f6555', fontSize: 13, lineHeight: 19, marginVertical: 14 },
  list: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 10 },
  loanRow: { borderBottomColor: '#d9dbd5', borderBottomWidth: 1, paddingVertical: 15 },
  loanCopy: { minWidth: 0 },
  loanTitle: { color: '#273129', fontSize: 17, fontWeight: '800' },
  meta: { color: '#727a73', fontSize: 13, lineHeight: 19, marginTop: 4 },
  note: { color: '#666e67', fontSize: 13, lineHeight: 19, marginTop: 5 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 9 },
  textButton: { paddingVertical: 6 },
  textButtonText: { color: '#31513a', fontSize: 12, fontWeight: '800' },
  emptyText: { color: '#737a74', paddingVertical: 26, textAlign: 'center' },
  historyTitle: { marginTop: 24 },
  footer: { color: '#868b86', fontSize: 12, lineHeight: 18, marginTop: 26 },
});
