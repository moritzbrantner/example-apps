export type LoanDirection = 'lent' | 'borrowed';

export type LoanRecord = {
  id: string;
  direction: LoanDirection;
  itemName: string;
  inventoryItemId: string | null;
  personName: string;
  dueOn: string;
  returnedAt: string | null;
  notes: string;
  createdAt: string;
};

export type InventoryLoanHandoff = { itemId: string; name: string };

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function isDateKey(value: string): boolean {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function createLoan(input: {
  id: string;
  direction: LoanDirection;
  itemName: string;
  inventoryItemId?: string | null;
  personName: string;
  dueOn?: string;
  notes?: string;
  now?: Date;
}): LoanRecord {
  const itemName = normalizeText(input.itemName);
  const personName = normalizeText(input.personName);
  const dueOn = input.dueOn?.trim() ?? '';
  if (!input.id || !itemName || !personName) throw new Error('Item and person are required.');
  if (!isDateKey(dueOn)) throw new Error('Due date must use YYYY-MM-DD.');
  return {
    id: input.id,
    direction: input.direction,
    itemName,
    inventoryItemId: input.inventoryItemId?.trim() || null,
    personName,
    dueOn,
    returnedAt: null,
    notes: normalizeText(input.notes ?? ''),
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}

export function markLoanReturned(loan: LoanRecord, now = new Date()): LoanRecord {
  if (loan.returnedAt) return loan;
  return { ...loan, returnedAt: now.toISOString() };
}

export function activeLoans(loans: readonly LoanRecord[]): LoanRecord[] {
  return loans
    .filter((loan) => !loan.returnedAt)
    .sort(
      (left, right) =>
        (left.dueOn || '9999-99-99').localeCompare(right.dueOn || '9999-99-99') ||
        left.createdAt.localeCompare(right.createdAt),
    );
}

export function parseInventoryLoanHandoff(rawUrl: string): InventoryLoanHandoff | null {
  if (!rawUrl.startsWith('borrowed://add?')) return null;
  const params = new URLSearchParams(rawUrl.slice(rawUrl.indexOf('?') + 1));
  const itemId = params.get('itemId')?.trim() ?? '';
  const name = normalizeText(params.get('name') ?? '');
  if (!itemId || !name) return null;
  return { itemId, name };
}

export function buildInventoryOpenHandoff(loan: LoanRecord): string | null {
  if (!loan.inventoryItemId) return null;
  return `inventory://open?itemId=${encodeURIComponent(loan.inventoryItemId)}`;
}

export function deserializeLoans(raw: string | null): LoanRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((candidate): LoanRecord[] => {
      if (!candidate || typeof candidate !== 'object') return [];
      const loan = candidate as Partial<LoanRecord>;
      if (
        typeof loan.id !== 'string' ||
        (loan.direction !== 'lent' && loan.direction !== 'borrowed') ||
        typeof loan.itemName !== 'string' ||
        !(typeof loan.inventoryItemId === 'string' || loan.inventoryItemId === null) ||
        typeof loan.personName !== 'string' ||
        typeof loan.dueOn !== 'string' ||
        !isDateKey(loan.dueOn) ||
        !(typeof loan.returnedAt === 'string' || loan.returnedAt === null) ||
        typeof loan.notes !== 'string' ||
        typeof loan.createdAt !== 'string'
      ) return [];
      const itemName = normalizeText(loan.itemName);
      const personName = normalizeText(loan.personName);
      if (!itemName || !personName) return [];
      return [{
        id: loan.id,
        direction: loan.direction,
        itemName,
        inventoryItemId: loan.inventoryItemId?.trim() || null,
        personName,
        dueOn: loan.dueOn,
        returnedAt: loan.returnedAt,
        notes: normalizeText(loan.notes),
        createdAt: loan.createdAt,
      }];
    });
  } catch {
    return [];
  }
}
