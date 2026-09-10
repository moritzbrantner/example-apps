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
  balanceCents,
  createTransaction,
  deserializeTransactions,
  parseAmountToCents,
  totalsForMonth,
  type MoneyTransaction,
  type TransactionKind,
} from '../lib/money';

const STORAGE_KEY = '@expo-template/money/ledger-v1';
const CURRENCY = 'EUR';
const CATEGORIES = ['Food', 'Home', 'Transport', 'Family', 'Health', 'Income', 'Other'] as const;

function transactionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY }).format(cents / 100);
}

export default function MoneyApp() {
  const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Food');
  const [note, setNote] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active) setTransactions(deserializeTransactions(stored));
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
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    }, 150);
    return () => clearTimeout(timer);
  }, [hydrated, transactions]);

  const currentMonth = localDateKey().slice(0, 7);
  const totals = useMemo(() => totalsForMonth(transactions, currentMonth), [currentMonth, transactions]);
  const balance = useMemo(() => balanceCents(transactions), [transactions]);
  const parsedAmount = parseAmountToCents(amount);
  const visible = useMemo(
    () => [...transactions].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 30),
    [transactions],
  );

  const setTransactionKind = (next: TransactionKind) => {
    setKind(next);
    if (next === 'income' && category !== 'Income' && category !== 'Other') setCategory('Income');
    if (next === 'expense' && category === 'Income') setCategory('Food');
  };

  const addTransaction = () => {
    if (!parsedAmount) return;
    const next = createTransaction({
      id: transactionId(),
      kind,
      amountCents: parsedAmount,
      category,
      note,
      date: localDateKey(),
    });
    setTransactions((current) => [next, ...current]);
    setAmount('');
    setNote('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>MONEY</Text>
          <Text style={styles.heading}>Know where the money went.</Text>
          <Text style={styles.subheading}>A single-currency local ledger. No bank connection or account.</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Balance</Text>
              <Text style={styles.statValue}>{formatMoney(balance)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>This month in</Text>
              <Text style={styles.statValueSmall}>{formatMoney(totals.income)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>This month out</Text>
              <Text style={styles.statValueSmall}>{formatMoney(totals.expense)}</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.kindRow}>
              {(['expense', 'income'] as const).map((candidate) => (
                <Pressable
                  key={candidate}
                  onPress={() => setTransactionKind(candidate)}
                  style={({ pressed }) => [styles.kindButton, kind === candidate && styles.kindButtonSelected, pressed && styles.pressed]}>
                  <Text style={[styles.kindText, kind === candidate && styles.kindTextSelected]}>
                    {candidate === 'expense' ? 'Expense' : 'Income'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              accessibilityLabel="Amount"
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#7b827c"
              style={styles.amountInput}
              value={amount}
            />

            <Text style={styles.smallLabel}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.filter((candidate) => kind === 'income' ? candidate === 'Income' || candidate === 'Other' : candidate !== 'Income').map((candidate) => (
                <Pressable
                  key={candidate}
                  onPress={() => setCategory(candidate)}
                  style={({ pressed }) => [styles.categoryButton, category === candidate && styles.categoryButtonSelected, pressed && styles.pressed]}>
                  <Text style={[styles.categoryText, category === candidate && styles.categoryTextSelected]}>{candidate}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              accessibilityLabel="Note"
              onChangeText={setNote}
              placeholder="Optional note"
              placeholderTextColor="#7b827c"
              style={styles.noteInput}
              value={note}
            />

            <Pressable
              disabled={!parsedAmount}
              onPress={addTransaction}
              style={({ pressed }) => [styles.addButton, !parsedAmount && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.addButtonText}>Add {kind}</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Recent entries</Text>
          <View style={styles.list}>
            {visible.length === 0 ? (
              <Text style={styles.emptyText}>No entries yet.</Text>
            ) : (
              visible.map((transaction) => (
                <View key={transaction.id} style={styles.transactionRow}>
                  <View style={styles.transactionCopy}>
                    <Text style={styles.transactionCategory}>{transaction.category}</Text>
                    <Text style={styles.transactionNote}>{transaction.note || transaction.date}</Text>
                  </View>
                  <Text style={[styles.transactionAmount, transaction.kind === 'income' && styles.incomeAmount]}>
                    {transaction.kind === 'income' ? '+' : '−'}{formatMoney(transaction.amountCents)}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Delete ${transaction.category} transaction`}
                    onPress={() => setTransactions((current) => current.filter((candidate) => candidate.id !== transaction.id))}
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <Text style={styles.footer}>Amounts are stored as integer cents in EUR on this device. No financial account or bank data is required.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f3ed' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  eyebrow: { color: '#657067', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#1f2921', fontSize: 34, fontWeight: '800', lineHeight: 39, letterSpacing: -1, marginTop: 8 },
  subheading: { color: '#687068', fontSize: 14, lineHeight: 21, marginTop: 10 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 },
  statCard: { minWidth: 150, flexGrow: 1, backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 18, padding: 16 },
  statLabel: { color: '#737a74', fontSize: 12, fontWeight: '700' },
  statValue: { color: '#243027', fontSize: 24, fontWeight: '800', marginTop: 5 },
  statValueSmall: { color: '#243027', fontSize: 19, fontWeight: '800', marginTop: 5 },
  formCard: { backgroundColor: '#faf9f5', borderColor: '#dedfd8', borderWidth: 1, borderRadius: 20, padding: 18, marginTop: 18 },
  kindRow: { flexDirection: 'row', gap: 8 },
  kindButton: { borderColor: '#cfd3cc', borderWidth: 1, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9 },
  kindButtonSelected: { backgroundColor: '#243c2b', borderColor: '#243c2b' },
  kindText: { color: '#687068', fontSize: 13, fontWeight: '800' },
  kindTextSelected: { color: '#fff' },
  amountInput: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 32, fontWeight: '800', marginTop: 14, paddingHorizontal: 14, paddingVertical: 12 },
  smallLabel: { color: '#687068', fontSize: 12, fontWeight: '700', marginTop: 14 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  categoryButton: { borderColor: '#cfd3cc', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  categoryButtonSelected: { backgroundColor: '#e1e9df', borderColor: '#adc0ad' },
  categoryText: { color: '#687068', fontSize: 12, fontWeight: '700' },
  categoryTextSelected: { color: '#294331' },
  noteInput: { backgroundColor: '#fff', borderColor: '#d7d9d2', borderWidth: 1, borderRadius: 14, color: '#1f2921', fontSize: 15, marginTop: 14, paddingHorizontal: 14, paddingVertical: 11 },
  addButton: { alignItems: 'center', backgroundColor: '#243c2b', borderRadius: 14, marginTop: 14, paddingVertical: 13 },
  addButtonText: { color: '#fff', fontWeight: '800', textTransform: 'capitalize' },
  disabled: { opacity: 0.4 },
  sectionTitle: { color: '#273129', fontSize: 18, fontWeight: '800', marginTop: 24 },
  list: { borderTopColor: '#d9dbd5', borderTopWidth: 1, marginTop: 10 },
  transactionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomColor: '#d9dbd5', borderBottomWidth: 1, paddingVertical: 13 },
  transactionCopy: { flex: 1 },
  transactionCategory: { color: '#273129', fontSize: 15, fontWeight: '800' },
  transactionNote: { color: '#7a817b', fontSize: 12, marginTop: 3 },
  transactionAmount: { color: '#8c4a45', fontSize: 15, fontWeight: '800' },
  incomeAmount: { color: '#31513a' },
  deleteButton: { paddingVertical: 6, paddingLeft: 4 },
  deleteText: { color: '#8c4a45', fontSize: 11, fontWeight: '700' },
  emptyText: { color: '#737a74', paddingVertical: 24, textAlign: 'center' },
  footer: { color: '#868b86', fontSize: 12, lineHeight: 18, marginTop: 26 },
  pressed: { opacity: 0.68 },
});
