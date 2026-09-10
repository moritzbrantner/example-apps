import assert from 'node:assert/strict';
import test from 'node:test';

import {
  balanceCents,
  createTransaction,
  deserializeTransactions,
  parseAmountToCents,
  totalsForMonth,
} from './money';

test('parses decimal amounts into integer cents', () => {
  assert.equal(parseAmountToCents('12.34'), 1234);
  assert.equal(parseAmountToCents('12,34'), 1234);
  assert.equal(parseAmountToCents('0'), null);
  assert.equal(parseAmountToCents('12.345'), null);
});

test('calculates balance and monthly totals without floating point money', () => {
  const income = createTransaction({ id: '1', kind: 'income', amountCents: 200000, category: 'Income', date: '2026-09-01' });
  const expense = createTransaction({ id: '2', kind: 'expense', amountCents: 3499, category: 'Food', date: '2026-09-03' });
  assert.equal(balanceCents([income, expense]), 196501);
  assert.deepEqual(totalsForMonth([income, expense], '2026-09'), { income: 200000, expense: 3499 });
});

test('ignores malformed persisted transactions', () => {
  assert.deepEqual(deserializeTransactions('nope'), []);
  assert.deepEqual(deserializeTransactions('[{"id":"1","amountCents":-2}]'), []);
});
