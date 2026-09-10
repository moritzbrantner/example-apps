export type PracticeSession = {
  id: string;
  instrument: string;
  piece: string;
  focus: string;
  notes: string;
  durationSeconds: number;
  recordingUri: string | null;
  recordingSeconds: number;
  recordingPersistent: boolean;
  practicedAt: string;
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function createPracticeSession(input: {
  id: string;
  instrument: string;
  piece: string;
  focus?: string;
  notes?: string;
  durationSeconds: number;
  recordingUri?: string | null;
  recordingSeconds?: number;
  recordingPersistent?: boolean;
  now?: Date;
}): PracticeSession {
  const instrument = normalizeText(input.instrument);
  const piece = normalizeText(input.piece);
  const durationSeconds = Math.round(input.durationSeconds);
  const recordingSeconds = Math.max(0, Math.round(input.recordingSeconds ?? 0));
  if (!input.id || !instrument || !piece) throw new Error('Instrument and piece are required.');
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1) {
    throw new Error('Practice duration must be at least one second.');
  }

  const recordingUri = input.recordingUri?.trim() || null;
  return {
    id: input.id,
    instrument,
    piece,
    focus: normalizeText(input.focus ?? ''),
    notes: normalizeText(input.notes ?? ''),
    durationSeconds,
    recordingUri,
    recordingSeconds: recordingUri ? recordingSeconds : 0,
    recordingPersistent: Boolean(recordingUri && input.recordingPersistent),
    practicedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes < 60) return `${minutes}:${String(seconds).padStart(2, '0')}`;
  const hours = Math.floor(minutes / 60);
  return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function elapsedSeconds(startedAtMs: number | null, stoppedSeconds: number, nowMs: number): number {
  if (startedAtMs === null) return Math.max(0, Math.round(stoppedSeconds));
  return Math.max(0, Math.round(stoppedSeconds + (nowMs - startedAtMs) / 1000));
}

export function deserializePracticeSessions(raw: string | null): PracticeSession[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((candidate): PracticeSession[] => {
      if (!candidate || typeof candidate !== 'object') return [];
      const session = candidate as Partial<PracticeSession>;
      if (
        typeof session.id !== 'string' ||
        typeof session.instrument !== 'string' ||
        typeof session.piece !== 'string' ||
        typeof session.focus !== 'string' ||
        typeof session.notes !== 'string' ||
        typeof session.durationSeconds !== 'number' ||
        !Number.isFinite(session.durationSeconds) ||
        session.durationSeconds < 1 ||
        !(session.recordingUri === null || typeof session.recordingUri === 'string') ||
        typeof session.recordingSeconds !== 'number' ||
        !Number.isFinite(session.recordingSeconds) ||
        session.recordingSeconds < 0 ||
        typeof session.recordingPersistent !== 'boolean' ||
        typeof session.practicedAt !== 'string'
      ) return [];

      const instrument = normalizeText(session.instrument);
      const piece = normalizeText(session.piece);
      if (!session.id.trim() || !instrument || !piece) return [];

      const persistentUri = session.recordingPersistent ? session.recordingUri?.trim() || null : null;
      return [{
        id: session.id.trim(),
        instrument,
        piece,
        focus: normalizeText(session.focus),
        notes: normalizeText(session.notes),
        durationSeconds: Math.round(session.durationSeconds),
        recordingUri: persistentUri,
        recordingSeconds: persistentUri ? Math.max(0, Math.round(session.recordingSeconds)) : 0,
        recordingPersistent: Boolean(persistentUri),
        practicedAt: session.practicedAt,
      }];
    });
  } catch {
    return [];
  }
}
