import AsyncStorage from '@react-native-async-storage/async-storage';

export type ReadingStatus = 'unread' | 'reading' | 'finished';

export type ReadingState = {
  bookmarks: readonly string[];
  statuses: Readonly<Record<string, ReadingStatus>>;
};

const storageKey = 'church-documents:reading-state:v1';

export const emptyReadingState: ReadingState = {
  bookmarks: [],
  statuses: {},
};

function isReadingStatus(value: unknown): value is ReadingStatus {
  return value === 'unread' || value === 'reading' || value === 'finished';
}

function parseReadingState(value: string | null): ReadingState {
  if (!value) {
    return emptyReadingState;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') {
      return emptyReadingState;
    }

    const candidate = parsed as {
      bookmarks?: unknown;
      statuses?: unknown;
    };

    const bookmarks = Array.isArray(candidate.bookmarks)
      ? candidate.bookmarks.filter((item): item is string => typeof item === 'string')
      : [];

    const statuses: Record<string, ReadingStatus> = {};
    if (candidate.statuses && typeof candidate.statuses === 'object') {
      for (const [slug, status] of Object.entries(candidate.statuses)) {
        if (isReadingStatus(status)) {
          statuses[slug] = status;
        }
      }
    }

    return {
      bookmarks: [...new Set(bookmarks)].sort(),
      statuses,
    };
  } catch {
    return emptyReadingState;
  }
}

export async function loadReadingState(): Promise<ReadingState> {
  return parseReadingState(await AsyncStorage.getItem(storageKey));
}

export async function saveReadingState(state: ReadingState): Promise<void> {
  await AsyncStorage.setItem(storageKey, JSON.stringify(state));
}

export function withBookmarkToggled(state: ReadingState, slug: string): ReadingState {
  const bookmarks = new Set(state.bookmarks);
  if (bookmarks.has(slug)) {
    bookmarks.delete(slug);
  } else {
    bookmarks.add(slug);
  }

  return {
    ...state,
    bookmarks: [...bookmarks].sort(),
  };
}

export function withReadingStatus(
  state: ReadingState,
  slug: string,
  status: ReadingStatus,
): ReadingState {
  return {
    ...state,
    statuses: {
      ...state.statuses,
      [slug]: status,
    },
  };
}
