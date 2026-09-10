export type Contraction = {
  id: string;
  startedAt: number;
  endedAt: number;
};

export type ContractionSession = {
  activeStartedAt: number | null;
  contractions: Contraction[];
};

export function emptySession(): ContractionSession {
  return { activeStartedAt: null, contractions: [] };
}

export function startContraction(session: ContractionSession, now: number): ContractionSession {
  if (session.activeStartedAt !== null) return session;
  return { ...session, activeStartedAt: now };
}

export function stopContraction(
  session: ContractionSession,
  id: string,
  now: number,
): ContractionSession {
  if (session.activeStartedAt === null || now < session.activeStartedAt) return session;
  const contraction: Contraction = { id, startedAt: session.activeStartedAt, endedAt: now };
  return {
    activeStartedAt: null,
    contractions: [...session.contractions, contraction].sort((left, right) => left.startedAt - right.startedAt),
  };
}

export function durationMs(contraction: Contraction): number {
  return Math.max(0, contraction.endedAt - contraction.startedAt);
}

export function intervalMs(previous: Contraction | undefined, current: Contraction): number | null {
  if (!previous) return null;
  return Math.max(0, current.startedAt - previous.startedAt);
}

export function summarizeRecent(contractions: readonly Contraction[], since: number) {
  const recent = contractions.filter((contraction) => contraction.startedAt >= since);
  const durations = recent.map(durationMs);
  const intervals = recent
    .map((contraction, index) => intervalMs(recent[index - 1], contraction))
    .filter((value): value is number => value !== null);

  const average = (values: number[]) =>
    values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length;

  return {
    count: recent.length,
    averageDurationMs: average(durations),
    averageIntervalMs: average(intervals),
  };
}

export function deserializeSession(value: string | null): ContractionSession {
  if (!value) return emptySession();
  try {
    const parsed = JSON.parse(value) as Partial<ContractionSession>;
    const activeStartedAt =
      parsed.activeStartedAt === null || typeof parsed.activeStartedAt === 'number'
        ? parsed.activeStartedAt
        : null;
    const contractions = Array.isArray(parsed.contractions)
      ? parsed.contractions.filter((candidate): candidate is Contraction => {
          if (!candidate || typeof candidate !== 'object') return false;
          const contraction = candidate as Partial<Contraction>;
          return (
            typeof contraction.id === 'string' &&
            typeof contraction.startedAt === 'number' &&
            typeof contraction.endedAt === 'number' &&
            contraction.endedAt >= contraction.startedAt
          );
        })
      : [];
    return { activeStartedAt, contractions };
  } catch {
    return emptySession();
  }
}
