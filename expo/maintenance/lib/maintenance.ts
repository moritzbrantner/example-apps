export type MaintenanceRecord = {
  completedOn: string;
  note: string;
};

export type MaintainedAsset = {
  id: string;
  name: string;
  inventoryItemId: string | null;
  location: string;
  intervalDays: number;
  notes: string;
  history: MaintenanceRecord[];
  createdAt: string;
  updatedAt: string;
};

export type InventoryMaintenanceHandoff = {
  itemId: string;
  name: string;
  location: string;
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function encoded(value: string): string {
  return encodeURIComponent(value);
}

export function isDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateKeyToUtc(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcToDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createAsset(input: {
  id: string;
  name: string;
  inventoryItemId?: string | null;
  location?: string;
  intervalDays: number;
  notes?: string;
  now?: Date;
}): MaintainedAsset {
  const name = normalizeText(input.name);
  if (!input.id || !name) throw new Error('Asset id and name are required.');
  if (!Number.isInteger(input.intervalDays) || input.intervalDays < 1 || input.intervalDays > 3650) {
    throw new Error('Maintenance interval must be between 1 and 3650 days.');
  }
  const timestamp = (input.now ?? new Date()).toISOString();
  return {
    id: input.id,
    name,
    inventoryItemId: input.inventoryItemId?.trim() || null,
    location: normalizeText(input.location ?? ''),
    intervalDays: input.intervalDays,
    notes: normalizeText(input.notes ?? ''),
    history: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function markMaintenanceComplete(
  asset: MaintainedAsset,
  completedOn: string,
  note = '',
  now = new Date(),
): MaintainedAsset {
  if (!isDateKey(completedOn)) throw new Error('Completion date must use YYYY-MM-DD.');
  if (asset.history.some((record) => record.completedOn === completedOn)) return asset;
  const record: MaintenanceRecord = { completedOn, note: normalizeText(note) };
  return {
    ...asset,
    history: [...asset.history, record].sort((left, right) => left.completedOn.localeCompare(right.completedOn)),
    updatedAt: now.toISOString(),
  };
}

export function lastCompletedOn(asset: MaintainedAsset): string | null {
  return asset.history.at(-1)?.completedOn ?? null;
}

export function nextDueOn(asset: MaintainedAsset): string | null {
  const last = lastCompletedOn(asset);
  if (!last) return null;
  const due = dateKeyToUtc(last);
  due.setUTCDate(due.getUTCDate() + asset.intervalDays);
  return utcToDateKey(due);
}

export function daysUntilDue(asset: MaintainedAsset, today: string): number | null {
  if (!isDateKey(today)) return null;
  const due = nextDueOn(asset);
  if (!due) return null;
  return Math.round((dateKeyToUtc(due).getTime() - dateKeyToUtc(today).getTime()) / 86_400_000);
}

export function parseInventoryMaintenanceHandoff(rawUrl: string): InventoryMaintenanceHandoff | null {
  if (!rawUrl.startsWith('maintenance://add?')) return null;
  const params = new URLSearchParams(rawUrl.slice(rawUrl.indexOf('?') + 1));
  const itemId = params.get('itemId')?.trim() ?? '';
  const name = normalizeText(params.get('name') ?? '');
  const location = normalizeText(params.get('location') ?? '');
  if (!itemId || !name) return null;
  return { itemId, name, location };
}

export function buildInventoryOpenHandoff(asset: MaintainedAsset): string | null {
  if (!asset.inventoryItemId) return null;
  return `inventory://open?itemId=${encoded(asset.inventoryItemId)}`;
}

export function buildChoreHandoff(asset: MaintainedAsset): string {
  const due = nextDueOn(asset);
  const dueQuery = due ? `&dueOn=${encoded(due)}` : '';
  return `chores://add?source=maintenance&sourceId=${encoded(asset.id)}&title=${encoded(`Maintain ${asset.name}`)}${dueQuery}`;
}

export function deserializeAssets(raw: string | null): MaintainedAsset[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((candidate): MaintainedAsset[] => {
      if (!candidate || typeof candidate !== 'object') return [];
      const asset = candidate as Partial<MaintainedAsset>;
      if (
        typeof asset.id !== 'string' ||
        typeof asset.name !== 'string' ||
        !(typeof asset.inventoryItemId === 'string' || asset.inventoryItemId === null) ||
        typeof asset.location !== 'string' ||
        !Number.isInteger(asset.intervalDays) ||
        Number(asset.intervalDays) < 1 ||
        Number(asset.intervalDays) > 3650 ||
        typeof asset.notes !== 'string' ||
        !Array.isArray(asset.history) ||
        typeof asset.createdAt !== 'string' ||
        typeof asset.updatedAt !== 'string'
      ) return [];
      const history = asset.history.flatMap((record): MaintenanceRecord[] => {
        if (!record || typeof record !== 'object') return [];
        const value = record as Partial<MaintenanceRecord>;
        if (typeof value.completedOn !== 'string' || !isDateKey(value.completedOn) || typeof value.note !== 'string') return [];
        return [{ completedOn: value.completedOn, note: normalizeText(value.note) }];
      });
      const name = normalizeText(asset.name);
      if (!name) return [];
      return [{
        id: asset.id,
        name,
        inventoryItemId: asset.inventoryItemId?.trim() || null,
        location: normalizeText(asset.location),
        intervalDays: Number(asset.intervalDays),
        notes: normalizeText(asset.notes),
        history: history.sort((left, right) => left.completedOn.localeCompare(right.completedOn)),
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      }];
    });
  } catch {
    return [];
  }
}
