export type Habit = {
  id: string;
  name: string;
  targetPerWeek: number;
  completions: string[];
  createdAt: string;
};

export function createHabit(
  name: string,
  id: string,
  targetPerWeek = 7,
  now = new Date(),
): Habit {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Habit name is required.');
  if (!Number.isInteger(targetPerWeek) || targetPerWeek < 1 || targetPerWeek > 7) {
    throw new Error('Weekly target must be between 1 and 7.');
  }

  return {
    id,
    name: trimmed,
    targetPerWeek,
    completions: [],
    createdAt: now.toISOString(),
  };
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toggleHabitDay(habit: Habit, day: string): Habit {
  const exists = habit.completions.includes(day);
  const completions = exists
    ? habit.completions.filter((candidate) => candidate !== day)
    : [...habit.completions, day].sort();
  return { ...habit, completions };
}

export function isHabitDone(habit: Habit, day: string): boolean {
  return habit.completions.includes(day);
}

export function countCompletedDays(habit: Habit, days: readonly string[]): number {
  const daySet = new Set(days);
  return habit.completions.filter((day) => daySet.has(day)).length;
}

export function previousDayKeys(days: number, now = new Date()): string[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - index - 1));
    return localDateKey(date);
  });
}

export function deserializeHabits(value: string | null): Habit[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((candidate): candidate is Habit => {
      if (!candidate || typeof candidate !== 'object') return false;
      const habit = candidate as Partial<Habit>;
      return (
        typeof habit.id === 'string' &&
        typeof habit.name === 'string' &&
        Number.isInteger(habit.targetPerWeek) &&
        Number(habit.targetPerWeek) >= 1 &&
        Number(habit.targetPerWeek) <= 7 &&
        Array.isArray(habit.completions) &&
        habit.completions.every((day) => typeof day === 'string') &&
        typeof habit.createdAt === 'string'
      );
    });
  } catch {
    return [];
  }
}
