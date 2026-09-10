export type TransactionKind = 'expense' | 'income';

export type MoneyTransaction = {
  id: string;
  kind: TransactionKind;
  amountCents: number;
  category: string;
  note: string;
  date: string;
  createdAt: string;
};

export function parseAmountToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export function createTransaction({
  id,
  kind,
  amountCents,
  category,
  note = '',
  date,
  now = new Date(),
}: {
  id: string;
  kind: TransactionKind;
  amountCents: number;
  category: string;
  note?: string;
  date: string;
  now?: Date;
}): MoneyTransaction {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('Amount must be a positive integer number of cents.');
  }
  if (!category.trim()) throw new Error('Category is required.');

  return {
    id,
    kind,
    amountCents,
    category: category.trim(),
    note: note.trim(),
    date,
    createdAt: now.toISOString(),
  };
}

export function signedCents(transaction: MoneyTransaction): number {
  return transaction.kind === 'income' ? transaction.amountCents : -transaction.amountCents;
}

export function balanceCents(transactions: readonly MoneyTransaction[]): number {
  return transactions.reduce((total, transaction) => total + signedCents(transaction), 0);
}

export function totalsForMonth(transactions: readonly MoneyTransaction[], month: string) {
  return transactions.reduce(
    (totals, transaction) => {
      if (!transaction.date.startsWith(`${month}-`)) return totals;
      totals[transaction.kind] += transaction.amountCents;
      return totals;
    },
    { income: 0, expense: 0 },
  );
}

export function deserializeTransactions(value: string | null): MoneyTransaction[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((candidate): candidate is MoneyTransaction => {
      if (!candidate || typeof candidate !== 'object') return false;
      const transaction = candidate as Partial<MoneyTransaction>;
      return (
        typeof transaction.id === 'string' &&
        (transaction.kind === 'expense' || transaction.kind === 'income') &&
        Number.isInteger(transaction.amountCents) &&
        Number(transaction.amountCents) > 0 &&
        typeof transaction.category === 'string' &&
        typeof transaction.note === 'string' &&
        typeof transaction.date === 'string' &&
        typeof transaction.createdAt === 'string'
      );
    });
  } catch {
    return [];
  }
}
