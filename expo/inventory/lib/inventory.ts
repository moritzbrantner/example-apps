export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location: string;
  barcode: string;
  lowAt: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryItemInput = {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  location?: string;
  barcode?: string;
  lowAt?: number;
  notes?: string;
  now?: Date;
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeBarcode(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

export function createInventoryItem(input: InventoryItemInput): InventoryItem {
  const name = normalizeText(input.name);
  const quantity = input.quantity ?? 1;
  const lowAt = input.lowAt ?? 0;
  if (!input.id || !name) throw new Error('Item id and name are required.');
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Quantity must be zero or greater.');
  if (!Number.isFinite(lowAt) || lowAt < 0) throw new Error('Low-stock threshold must be zero or greater.');

  const timestamp = (input.now ?? new Date()).toISOString();
  return {
    id: input.id,
    name,
    quantity,
    unit: normalizeText(input.unit ?? 'pcs') || 'pcs',
    location: normalizeText(input.location ?? ''),
    barcode: normalizeBarcode(input.barcode ?? ''),
    lowAt,
    notes: normalizeText(input.notes ?? ''),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function adjustQuantity(
  item: InventoryItem,
  delta: number,
  now = new Date(),
): InventoryItem {
  if (!Number.isFinite(delta)) throw new Error('Quantity change must be finite.');
  const quantity = Math.max(0, item.quantity + delta);
  return { ...item, quantity, updatedAt: now.toISOString() };
}

export function isLowStock(item: InventoryItem): boolean {
  return item.lowAt > 0 && item.quantity <= item.lowAt;
}

export function findInventoryItemByCode(
  items: readonly InventoryItem[],
  rawCode: string,
): InventoryItem | null {
  const barcode = normalizeBarcode(rawCode);
  if (!barcode) return null;
  return items.find((item) => item.barcode === barcode) ?? null;
}

function encoded(value: string): string {
  return encodeURIComponent(value);
}

export function buildBorrowedHandoff(item: InventoryItem): string {
  return `borrowed://add?itemId=${encoded(item.id)}&name=${encoded(item.name)}`;
}

export function buildMaintenanceHandoff(item: InventoryItem): string {
  const location = item.location ? `&location=${encoded(item.location)}` : '';
  return `maintenance://add?itemId=${encoded(item.id)}&name=${encoded(item.name)}${location}`;
}

export function buildDocumentsHandoff(item: InventoryItem): string {
  return `documents://add?source=inventory&sourceId=${encoded(item.id)}&label=${encoded(item.name)}`;
}

export function parseInventoryOpenHandoff(rawUrl: string): string | null {
  if (!rawUrl.startsWith('inventory://open?')) return null;
  const query = rawUrl.slice(rawUrl.indexOf('?') + 1);
  const params = new URLSearchParams(query);
  const itemId = params.get('itemId')?.trim();
  return itemId || null;
}

export function deserializeInventoryItems(raw: string | null): InventoryItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((candidate): InventoryItem[] => {
      if (!candidate || typeof candidate !== 'object') return [];
      const item = candidate as Partial<InventoryItem>;
      if (
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        typeof item.quantity !== 'number' ||
        !Number.isFinite(item.quantity) ||
        item.quantity < 0 ||
        typeof item.unit !== 'string' ||
        typeof item.location !== 'string' ||
        typeof item.barcode !== 'string' ||
        typeof item.lowAt !== 'number' ||
        !Number.isFinite(item.lowAt) ||
        item.lowAt < 0 ||
        typeof item.notes !== 'string' ||
        typeof item.createdAt !== 'string' ||
        typeof item.updatedAt !== 'string'
      ) {
        return [];
      }
      const name = normalizeText(item.name);
      if (!name) return [];
      return [{
        id: item.id,
        name,
        quantity: item.quantity,
        unit: normalizeText(item.unit) || 'pcs',
        location: normalizeText(item.location),
        barcode: normalizeBarcode(item.barcode),
        lowAt: item.lowAt,
        notes: normalizeText(item.notes),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }];
    });
  } catch {
    return [];
  }
}
