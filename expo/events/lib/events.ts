export const RSVP_STATUSES = ['invited', 'confirmed', 'declined'] as const;
export const TASK_CATEGORIES = ['general', 'setup', 'cleanup'] as const;

export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export type EventGuest = {
  id: string;
  name: string;
  status: RsvpStatus;
  notes: string;
};

export type BringItem = {
  id: string;
  label: string;
  quantity: string;
  guestId: string | null;
  inventoryItemId: string | null;
  brought: boolean;
  notes: string;
};

export type EventTask = {
  id: string;
  title: string;
  category: TaskCategory;
  guestId: string | null;
  done: boolean;
  notes: string;
};

export type EventPlan = {
  id: string;
  title: string;
  date: string;
  location: string;
  notes: string;
  guests: EventGuest[];
  bringItems: BringItem[];
  tasks: EventTask[];
  createdAt: string;
  updatedAt: string;
};

export type EventCollection = {
  events: EventPlan[];
  selectedEventId: string | null;
};

export type InventoryEventHandoff = {
  inventoryItemId: string;
  label: string;
};

type CopyIdKind = 'event' | 'guest' | 'bring' | 'task';

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function emptyCollection(): EventCollection {
  return { events: [], selectedEventId: null };
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

export function createEvent(input: {
  id: string;
  title: string;
  date?: string;
  location?: string;
  notes?: string;
  now?: Date;
}): EventPlan {
  const title = normalizeText(input.title);
  const date = input.date?.trim() ?? '';
  if (!input.id || !title) throw new Error('Event id and title are required.');
  if (!isDateKey(date)) throw new Error('Event date must use YYYY-MM-DD.');
  const timestamp = (input.now ?? new Date()).toISOString();
  return {
    id: input.id,
    title,
    date,
    location: normalizeText(input.location ?? ''),
    notes: normalizeText(input.notes ?? ''),
    guests: [],
    bringItems: [],
    tasks: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function addGuest(
  event: EventPlan,
  input: { id: string; name: string; notes?: string },
  now = new Date(),
): EventPlan {
  const name = normalizeText(input.name);
  if (!input.id || !name) throw new Error('Guest id and name are required.');
  if (event.guests.some((guest) => guest.id === input.id)) throw new Error('Guest id already exists.');
  if (event.guests.some((guest) => guest.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Guest already exists.');
  }
  return {
    ...event,
    guests: [...event.guests, { id: input.id, name, status: 'invited', notes: normalizeText(input.notes ?? '') }],
    updatedAt: now.toISOString(),
  };
}

export function setGuestStatus(
  event: EventPlan,
  guestId: string,
  status: RsvpStatus,
  now = new Date(),
): EventPlan {
  if (!RSVP_STATUSES.includes(status)) throw new Error('RSVP status is invalid.');
  if (!event.guests.some((guest) => guest.id === guestId)) return event;
  return {
    ...event,
    guests: event.guests.map((guest) => guest.id === guestId ? { ...guest, status } : guest),
    updatedAt: now.toISOString(),
  };
}

export function removeGuest(event: EventPlan, guestId: string, now = new Date()): EventPlan {
  if (!event.guests.some((guest) => guest.id === guestId)) return event;
  return {
    ...event,
    guests: event.guests.filter((guest) => guest.id !== guestId),
    bringItems: event.bringItems.map((item) => item.guestId === guestId ? { ...item, guestId: null } : item),
    tasks: event.tasks.map((task) => task.guestId === guestId ? { ...task, guestId: null } : task),
    updatedAt: now.toISOString(),
  };
}

function validateGuestReference(event: EventPlan, guestId: string | null | undefined): string | null {
  const normalized = guestId?.trim() || null;
  if (normalized && !event.guests.some((guest) => guest.id === normalized)) {
    throw new Error('Assigned guest must exist in the event.');
  }
  return normalized;
}

export function addBringItem(
  event: EventPlan,
  input: {
    id: string;
    label: string;
    quantity?: string;
    guestId?: string | null;
    inventoryItemId?: string | null;
    notes?: string;
  },
  now = new Date(),
): EventPlan {
  const label = normalizeText(input.label);
  if (!input.id || !label) throw new Error('Bring item id and label are required.');
  const item: BringItem = {
    id: input.id,
    label,
    quantity: normalizeText(input.quantity ?? ''),
    guestId: validateGuestReference(event, input.guestId),
    inventoryItemId: input.inventoryItemId?.trim() || null,
    brought: false,
    notes: normalizeText(input.notes ?? ''),
  };
  return { ...event, bringItems: [...event.bringItems, item], updatedAt: now.toISOString() };
}

export function setBringItemBrought(
  event: EventPlan,
  itemId: string,
  brought: boolean,
  now = new Date(),
): EventPlan {
  const item = event.bringItems.find((candidate) => candidate.id === itemId);
  if (!item || item.brought === brought) return event;
  return {
    ...event,
    bringItems: event.bringItems.map((candidate) => candidate.id === itemId ? { ...candidate, brought } : candidate),
    updatedAt: now.toISOString(),
  };
}

export function addTask(
  event: EventPlan,
  input: {
    id: string;
    title: string;
    category: TaskCategory;
    guestId?: string | null;
    notes?: string;
  },
  now = new Date(),
): EventPlan {
  const title = normalizeText(input.title);
  if (!input.id || !title) throw new Error('Task id and title are required.');
  if (!TASK_CATEGORIES.includes(input.category)) throw new Error('Task category is invalid.');
  const task: EventTask = {
    id: input.id,
    title,
    category: input.category,
    guestId: validateGuestReference(event, input.guestId),
    done: false,
    notes: normalizeText(input.notes ?? ''),
  };
  return { ...event, tasks: [...event.tasks, task], updatedAt: now.toISOString() };
}

export function setTaskDone(
  event: EventPlan,
  taskId: string,
  done: boolean,
  now = new Date(),
): EventPlan {
  const task = event.tasks.find((candidate) => candidate.id === taskId);
  if (!task || task.done === done) return event;
  return {
    ...event,
    tasks: event.tasks.map((candidate) => candidate.id === taskId ? { ...candidate, done } : candidate),
    updatedAt: now.toISOString(),
  };
}

export function parseInventoryEventHandoff(rawUrl: string): InventoryEventHandoff | null {
  if (!rawUrl.startsWith('eventworkboard://add?')) return null;
  const params = new URLSearchParams(rawUrl.slice(rawUrl.indexOf('?') + 1));
  if (params.get('source') !== 'inventory') return null;
  const inventoryItemId = params.get('sourceId')?.trim() ?? '';
  const label = normalizeText(params.get('label') ?? '');
  if (!inventoryItemId || !label) return null;
  return { inventoryItemId, label };
}

export function buildInventoryOpenHandoff(item: BringItem): string | null {
  if (!item.inventoryItemId) return null;
  return `inventory://open?itemId=${encodeURIComponent(item.inventoryItemId)}`;
}

export function buildEventImportHandoff(event: EventPlan): string {
  return `eventworkboard://import?data=${encodeURIComponent(JSON.stringify(event))}`;
}

function parseEventSnapshot(raw: string): EventPlan | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeEvent(parsed);
  } catch {
    return null;
  }
}

export function parseEventImportHandoff(rawUrl: string): EventPlan | null {
  if (!rawUrl.startsWith('eventworkboard://import?') || rawUrl.length > 80_000) return null;
  const data = new URLSearchParams(rawUrl.slice(rawUrl.indexOf('?') + 1)).get('data');
  if (!data || data.length > 60_000) return null;
  return parseEventSnapshot(data);
}

export function copyEvent(
  event: EventPlan,
  makeId: (kind: CopyIdKind) => string,
  now = new Date(),
): EventPlan {
  const guestIds = new Map(event.guests.map((guest) => [guest.id, makeId('guest')]));
  const timestamp = now.toISOString();
  return {
    ...event,
    id: makeId('event'),
    title: `${event.title} (copy)`,
    guests: event.guests.map((guest) => ({ ...guest, id: guestIds.get(guest.id)! })),
    bringItems: event.bringItems.map((item) => ({
      ...item,
      id: makeId('bring'),
      guestId: item.guestId ? guestIds.get(item.guestId) ?? null : null,
    })),
    tasks: event.tasks.map((task) => ({
      ...task,
      id: makeId('task'),
      guestId: task.guestId ? guestIds.get(task.guestId) ?? null : null,
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function sanitizeGuest(value: unknown, ids: Set<string>, names: Set<string>): EventGuest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const guest = value as Partial<EventGuest>;
  if (typeof guest.id !== 'string' || typeof guest.name !== 'string' || !RSVP_STATUSES.includes(guest.status as RsvpStatus) || typeof guest.notes !== 'string') return null;
  const id = guest.id.trim();
  const name = normalizeText(guest.name);
  const normalizedName = name.toLowerCase();
  if (!id || !name || ids.has(id) || names.has(normalizedName)) return null;
  ids.add(id);
  names.add(normalizedName);
  return { id, name, status: guest.status as RsvpStatus, notes: normalizeText(guest.notes) };
}

function sanitizeEvent(value: unknown): EventPlan | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const event = value as Partial<EventPlan>;
  if (
    typeof event.id !== 'string' ||
    typeof event.title !== 'string' ||
    typeof event.date !== 'string' ||
    !isDateKey(event.date) ||
    typeof event.location !== 'string' ||
    typeof event.notes !== 'string' ||
    !Array.isArray(event.guests) ||
    !Array.isArray(event.bringItems) ||
    !Array.isArray(event.tasks) ||
    typeof event.createdAt !== 'string' ||
    typeof event.updatedAt !== 'string'
  ) return null;

  const id = event.id.trim();
  const title = normalizeText(event.title);
  if (!id || !title) return null;

  const guestIds = new Set<string>();
  const guestNames = new Set<string>();
  const guests = event.guests.flatMap((candidate): EventGuest[] => {
    const guest = sanitizeGuest(candidate, guestIds, guestNames);
    return guest ? [guest] : [];
  });

  const bringIds = new Set<string>();
  const bringItems = event.bringItems.flatMap((candidate): BringItem[] => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const item = candidate as Partial<BringItem>;
    if (
      typeof item.id !== 'string' ||
      typeof item.label !== 'string' ||
      typeof item.quantity !== 'string' ||
      !(item.guestId === null || (typeof item.guestId === 'string' && guestIds.has(item.guestId))) ||
      !(item.inventoryItemId === null || typeof item.inventoryItemId === 'string') ||
      typeof item.brought !== 'boolean' ||
      typeof item.notes !== 'string'
    ) return [];
    const itemId = item.id.trim();
    const label = normalizeText(item.label);
    if (!itemId || !label || bringIds.has(itemId)) return [];
    bringIds.add(itemId);
    return [{
      id: itemId,
      label,
      quantity: normalizeText(item.quantity),
      guestId: item.guestId,
      inventoryItemId: item.inventoryItemId?.trim() || null,
      brought: item.brought,
      notes: normalizeText(item.notes),
    }];
  });

  const taskIds = new Set<string>();
  const tasks = event.tasks.flatMap((candidate): EventTask[] => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const task = candidate as Partial<EventTask>;
    if (
      typeof task.id !== 'string' ||
      typeof task.title !== 'string' ||
      !TASK_CATEGORIES.includes(task.category as TaskCategory) ||
      !(task.guestId === null || (typeof task.guestId === 'string' && guestIds.has(task.guestId))) ||
      typeof task.done !== 'boolean' ||
      typeof task.notes !== 'string'
    ) return [];
    const taskId = task.id.trim();
    const taskTitle = normalizeText(task.title);
    if (!taskId || !taskTitle || taskIds.has(taskId)) return [];
    taskIds.add(taskId);
    return [{
      id: taskId,
      title: taskTitle,
      category: task.category as TaskCategory,
      guestId: task.guestId,
      done: task.done,
      notes: normalizeText(task.notes),
    }];
  });

  return {
    id,
    title,
    date: event.date,
    location: normalizeText(event.location),
    notes: normalizeText(event.notes),
    guests,
    bringItems,
    tasks,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

export function deserializeCollection(raw: string | null): EventCollection {
  if (!raw) return emptyCollection();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyCollection();
    const candidate = parsed as Partial<EventCollection>;
    if (!Array.isArray(candidate.events)) return emptyCollection();

    const eventIds = new Set<string>();
    const events = candidate.events.flatMap((value): EventPlan[] => {
      const event = sanitizeEvent(value);
      if (!event || eventIds.has(event.id)) return [];
      eventIds.add(event.id);
      return [event];
    });
    const selectedEventId = typeof candidate.selectedEventId === 'string' && eventIds.has(candidate.selectedEventId)
      ? candidate.selectedEventId
      : events[0]?.id ?? null;
    return { events, selectedEventId };
  } catch {
    return emptyCollection();
  }
}
