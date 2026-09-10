export type ChoreMember = {
  id: string;
  name: string;
};

export type ChoreSource = {
  app: 'maintenance';
  id: string;
};

export type Chore = {
  id: string;
  title: string;
  intervalDays: number;
  dueOn: string;
  memberIds: string[];
  assigneeIndex: number;
  lastCompletedOn: string | null;
  source: ChoreSource | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ChoreBoard = {
  members: ChoreMember[];
  chores: Chore[];
};

export type MaintenanceChoreHandoff = {
  source: ChoreSource;
  title: string;
  dueOn: string;
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function emptyBoard(): ChoreBoard {
  return { members: [], chores: [] };
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

function addDays(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMember(board: ChoreBoard, member: ChoreMember): ChoreBoard {
  const name = normalizeText(member.name);
  if (!member.id || !name) throw new Error('Member id and name are required.');
  if (board.members.some((candidate) => candidate.id === member.id)) {
    throw new Error('Member id already exists.');
  }
  if (board.members.some((candidate) => candidate.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Member already exists.');
  }
  return { ...board, members: [...board.members, { id: member.id, name }] };
}

export function createChore(input: {
  id: string;
  title: string;
  intervalDays: number;
  dueOn?: string;
  memberIds: string[];
  source?: ChoreSource | null;
  notes?: string;
  now?: Date;
}): Chore {
  const title = normalizeText(input.title);
  const dueOn = input.dueOn?.trim() ?? '';
  const memberIds = [...new Set(input.memberIds.map((id) => id.trim()).filter(Boolean))];
  if (!input.id || !title) throw new Error('Chore id and title are required.');
  if (!Number.isInteger(input.intervalDays) || input.intervalDays < 1 || input.intervalDays > 3650) {
    throw new Error('Chore interval must be between 1 and 3650 days.');
  }
  if (dueOn && !isDateKey(dueOn)) throw new Error('Due date must use YYYY-MM-DD.');
  if (memberIds.length === 0) throw new Error('Choose at least one participating member.');

  const source = input.source
    ? { app: 'maintenance' as const, id: input.source.id.trim() }
    : null;
  if (source && !source.id) throw new Error('Linked maintenance source requires an id.');

  const timestamp = (input.now ?? new Date()).toISOString();
  return {
    id: input.id,
    title,
    intervalDays: input.intervalDays,
    dueOn,
    memberIds,
    assigneeIndex: 0,
    lastCompletedOn: null,
    source,
    notes: normalizeText(input.notes ?? ''),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function currentAssignee(chore: Chore, board: ChoreBoard): ChoreMember | null {
  const id = chore.memberIds[chore.assigneeIndex];
  if (!id) return null;
  return board.members.find((member) => member.id === id) ?? null;
}

export function completeChore(chore: Chore, completedOn: string, now = new Date()): Chore {
  if (!isDateKey(completedOn)) throw new Error('Completion date must use YYYY-MM-DD.');
  if (chore.lastCompletedOn === completedOn) return chore;
  return {
    ...chore,
    dueOn: addDays(completedOn, chore.intervalDays),
    assigneeIndex: (chore.assigneeIndex + 1) % chore.memberIds.length,
    lastCompletedOn: completedOn,
    updatedAt: now.toISOString(),
  };
}

export function parseMaintenanceChoreHandoff(rawUrl: string): MaintenanceChoreHandoff | null {
  if (!rawUrl.startsWith('chores://add?')) return null;
  const params = new URLSearchParams(rawUrl.slice(rawUrl.indexOf('?') + 1));
  if (params.get('source') !== 'maintenance') return null;
  const id = params.get('sourceId')?.trim() ?? '';
  const title = normalizeText(params.get('title') ?? '');
  const dueOn = params.get('dueOn')?.trim() ?? '';
  if (!id || !title || (dueOn && !isDateKey(dueOn))) return null;
  return { source: { app: 'maintenance', id }, title, dueOn };
}

export function buildBoardImportHandoff(board: ChoreBoard): string {
  return `chores://import?data=${encodeURIComponent(JSON.stringify(board))}`;
}

export function parseBoardImportHandoff(rawUrl: string): ChoreBoard | null {
  if (!rawUrl.startsWith('chores://import?') || rawUrl.length > 50_000) return null;
  const data = new URLSearchParams(rawUrl.slice(rawUrl.indexOf('?') + 1)).get('data');
  if (!data || data.length > 40_000) return null;
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const candidate = parsed as Partial<ChoreBoard>;
    if (!Array.isArray(candidate.members) || !Array.isArray(candidate.chores)) return null;
    return deserializeBoard(data);
  } catch {
    return null;
  }
}

export function deserializeBoard(raw: string | null): ChoreBoard {
  if (!raw) return emptyBoard();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyBoard();
    const candidate = parsed as Partial<ChoreBoard>;
    if (!Array.isArray(candidate.members) || !Array.isArray(candidate.chores)) return emptyBoard();

    const memberIds = new Set<string>();
    const memberNames = new Set<string>();
    const members = candidate.members.flatMap((value): ChoreMember[] => {
      if (!value || typeof value !== 'object') return [];
      const member = value as Partial<ChoreMember>;
      if (typeof member.id !== 'string' || typeof member.name !== 'string') return [];
      const id = member.id.trim();
      const name = normalizeText(member.name);
      const normalizedName = name.toLowerCase();
      if (!id || !name || memberIds.has(id) || memberNames.has(normalizedName)) return [];
      memberIds.add(id);
      memberNames.add(normalizedName);
      return [{ id, name }];
    });

    const choreIds = new Set<string>();
    const chores = candidate.chores.flatMap((value): Chore[] => {
      if (!value || typeof value !== 'object') return [];
      const chore = value as Partial<Chore>;
      if (
        typeof chore.id !== 'string' ||
        typeof chore.title !== 'string' ||
        !Number.isInteger(chore.intervalDays) ||
        Number(chore.intervalDays) < 1 ||
        Number(chore.intervalDays) > 3650 ||
        typeof chore.dueOn !== 'string' ||
        (chore.dueOn !== '' && !isDateKey(chore.dueOn)) ||
        !Array.isArray(chore.memberIds) ||
        chore.memberIds.length === 0 ||
        !chore.memberIds.every((id) => typeof id === 'string' && memberIds.has(id)) ||
        !Number.isInteger(chore.assigneeIndex) ||
        Number(chore.assigneeIndex) < 0 ||
        Number(chore.assigneeIndex) >= chore.memberIds.length ||
        !(chore.lastCompletedOn === null || (typeof chore.lastCompletedOn === 'string' && isDateKey(chore.lastCompletedOn))) ||
        typeof chore.notes !== 'string' ||
        typeof chore.createdAt !== 'string' ||
        typeof chore.updatedAt !== 'string'
      ) return [];

      const id = chore.id.trim();
      const title = normalizeText(chore.title);
      if (!id || !title || choreIds.has(id)) return [];

      let source: ChoreSource | null = null;
      if (chore.source !== null) {
        if (!chore.source || typeof chore.source !== 'object') return [];
        const candidateSource = chore.source as Partial<ChoreSource>;
        if (candidateSource.app !== 'maintenance' || typeof candidateSource.id !== 'string' || !candidateSource.id.trim()) return [];
        source = { app: 'maintenance', id: candidateSource.id.trim() };
      }

      choreIds.add(id);
      return [{
        id,
        title,
        intervalDays: Number(chore.intervalDays),
        dueOn: chore.dueOn,
        memberIds: chore.memberIds,
        assigneeIndex: Number(chore.assigneeIndex),
        lastCompletedOn: chore.lastCompletedOn,
        source,
        notes: normalizeText(chore.notes),
        createdAt: chore.createdAt,
        updatedAt: chore.updatedAt,
      }];
    });

    return { members, chores };
  } catch {
    return emptyBoard();
  }
}
