export const GIFT_DIRECTIONS = ['received', 'given', 'planned'] as const;

export type GiftDirection = (typeof GIFT_DIRECTIONS)[number];

export type GiftPerson = {
  id: string;
  name: string;
};

export type GiftRecord = {
  id: string;
  direction: GiftDirection;
  personId: string;
  title: string;
  date: string;
  occasion: string;
  notes: string;
  sourceGiftId: string | null;
  createdAt: number;
};

export type GiftState = {
  people: GiftPerson[];
  gifts: GiftRecord[];
};

export type GiftInput = Omit<GiftRecord, 'occasion' | 'notes' | 'sourceGiftId'> & {
  occasion?: string;
  notes?: string;
  sourceGiftId?: string | null;
};

export type GiftIntent = {
  direction: GiftDirection;
  personId: string;
  sourceGiftId?: string | null;
};

const DAY_MS = 86_400_000;

export function emptyGiftState(): GiftState {
  return { people: [], gifts: [] };
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function isDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function dateKeyToDay(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function addPerson(state: GiftState, person: GiftPerson): GiftState {
  const name = normalizeText(person.name);
  if (!person.id || !name) {
    throw new Error('Person id and name are required');
  }

  if (state.people.some((existing) => existing.id === person.id)) {
    throw new Error('Person id already exists');
  }

  if (
    state.people.some((existing) => existing.name.toLowerCase() === name.toLowerCase())
  ) {
    throw new Error('Person already exists');
  }

  return {
    ...state,
    people: [...state.people, { id: person.id, name }],
  };
}

export function addGift(state: GiftState, input: GiftInput): GiftState {
  if (!state.people.some((person) => person.id === input.personId)) {
    throw new Error('Gift person must exist');
  }

  const title = normalizeText(input.title);
  if (!input.id || !title || !isDateKey(input.date) || !Number.isFinite(input.createdAt)) {
    throw new Error('Gift id, title, date, and createdAt are required');
  }

  if (!GIFT_DIRECTIONS.includes(input.direction)) {
    throw new Error('Gift direction is invalid');
  }

  const sourceGiftId = input.sourceGiftId ?? null;
  if (sourceGiftId && input.direction !== 'planned') {
    throw new Error('Only planned gifts may reference a received gift');
  }

  if (sourceGiftId) {
    const sourceGift = state.gifts.find((gift) => gift.id === sourceGiftId);
    if (!sourceGift || sourceGift.direction !== 'received') {
      throw new Error('Planned gift source must be an existing received gift');
    }
  }

  const gift: GiftRecord = {
    id: input.id,
    direction: input.direction,
    personId: input.personId,
    title,
    date: input.date,
    occasion: normalizeText(input.occasion ?? ''),
    notes: normalizeText(input.notes ?? ''),
    sourceGiftId,
    createdAt: input.createdAt,
  };

  return {
    ...state,
    gifts: [...state.gifts, gift],
  };
}

export function personName(state: GiftState, personId: string): string {
  return state.people.find((person) => person.id === personId)?.name ?? 'Unknown person';
}

export function returnToGiverWarning(state: GiftState, intent: GiftIntent): string | null {
  if (intent.direction !== 'planned' || !intent.sourceGiftId) {
    return null;
  }

  const sourceGift = state.gifts.find((gift) => gift.id === intent.sourceGiftId);
  if (!sourceGift || sourceGift.direction !== 'received') {
    return null;
  }

  if (sourceGift.personId !== intent.personId) {
    return null;
  }

  const giver = personName(state, sourceGift.personId);
  return `This was received from ${giver}. Choose a different recipient before regifting it.`;
}

export function upcomingPlannedGifts(
  state: GiftState,
  today: string,
  windowDays = 90,
): GiftRecord[] {
  if (!isDateKey(today) || windowDays < 0) {
    return [];
  }

  const todayDay = dateKeyToDay(today);
  return state.gifts
    .filter((gift) => {
      if (gift.direction !== 'planned' || !isDateKey(gift.date)) {
        return false;
      }
      const offset = dateKeyToDay(gift.date) - todayDay;
      return offset >= 0 && offset <= windowDays;
    })
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id),
    );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isGiftDirection(value: unknown): value is GiftDirection {
  return typeof value === 'string' && GIFT_DIRECTIONS.includes(value as GiftDirection);
}

export function deserializeGiftState(raw: string | null): GiftState {
  if (!raw) {
    return emptyGiftState();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || !Array.isArray(parsed.people) || !Array.isArray(parsed.gifts)) {
      return emptyGiftState();
    }

    const people = parsed.people.flatMap((candidate): GiftPerson[] => {
      if (!isObject(candidate) || typeof candidate.id !== 'string' || typeof candidate.name !== 'string') {
        return [];
      }
      const name = normalizeText(candidate.name);
      return candidate.id && name ? [{ id: candidate.id, name }] : [];
    });

    const personIds = new Set(people.map((person) => person.id));
    const gifts = parsed.gifts.flatMap((candidate): GiftRecord[] => {
      if (
        !isObject(candidate) ||
        typeof candidate.id !== 'string' ||
        !isGiftDirection(candidate.direction) ||
        typeof candidate.personId !== 'string' ||
        typeof candidate.title !== 'string' ||
        typeof candidate.date !== 'string' ||
        typeof candidate.createdAt !== 'number' ||
        !Number.isFinite(candidate.createdAt) ||
        !personIds.has(candidate.personId) ||
        !isDateKey(candidate.date)
      ) {
        return [];
      }

      const title = normalizeText(candidate.title);
      if (!candidate.id || !title) {
        return [];
      }

      return [{
        id: candidate.id,
        direction: candidate.direction,
        personId: candidate.personId,
        title,
        date: candidate.date,
        occasion: typeof candidate.occasion === 'string' ? normalizeText(candidate.occasion) : '',
        notes: typeof candidate.notes === 'string' ? normalizeText(candidate.notes) : '',
        sourceGiftId: typeof candidate.sourceGiftId === 'string' ? candidate.sourceGiftId : null,
        createdAt: candidate.createdAt,
      }];
    });

    return { people, gifts };
  } catch {
    return emptyGiftState();
  }
}

export function serializeGiftState(state: GiftState): string {
  return JSON.stringify(state);
}
