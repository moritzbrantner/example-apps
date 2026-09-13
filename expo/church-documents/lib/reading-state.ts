import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ReaderLanguage } from './reader-content';

export type ReadingStatus = 'unread' | 'reading' | 'finished';

export type ReadingState = {
  bookmarks: readonly string[];
  statuses: Readonly<Record<string, ReadingStatus>>;
  paragraphBookmarks: readonly string[];
  resumeLocations: Readonly<Record<string, string>>;
};

const storageKey = 'church-documents:reading-state:v1';

export const emptyReadingState: ReadingState = {
  bookmarks: [],
  statuses: {},
  paragraphBookmarks: [],
  resumeLocations: {},
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
      paragraphBookmarks?: unknown;
      resumeLocations?: unknown;
    };

    const bookmarks = stringArray(candidate.bookmarks);
    const paragraphBookmarks = stringArray(candidate.paragraphBookmarks);

    const statuses: Record<string, ReadingStatus> = {};
    if (candidate.statuses && typeof candidate.statuses === 'object') {
      for (const [slug, status] of Object.entries(candidate.statuses)) {
        if (isReadingStatus(status)) {
          statuses[slug] = status;
        }
      }
    }

    const resumeLocations: Record<string, string> = {};
    if (candidate.resumeLocations && typeof candidate.resumeLocations === 'object') {
      for (const [key, paragraphId] of Object.entries(candidate.resumeLocations)) {
        if (typeof paragraphId === 'string' && paragraphId.length > 0) {
          resumeLocations[key] = paragraphId;
        }
      }
    }

    return {
      bookmarks,
      statuses,
      paragraphBookmarks,
      resumeLocations,
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
  return {
    ...state,
    bookmarks: toggleSorted(state.bookmarks, slug),
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

export function readerStateKey(slug: string, language: ReaderLanguage) {
  return `${slug}:${language}`;
}

export function paragraphBookmarkKey(
  slug: string,
  language: ReaderLanguage,
  paragraphId: string,
) {
  return `${readerStateKey(slug, language)}:${paragraphId}`;
}

export function withParagraphBookmarkToggled(
  state: ReadingState,
  slug: string,
  language: ReaderLanguage,
  paragraphId: string,
): ReadingState {
  return {
    ...state,
    paragraphBookmarks: toggleSorted(
      state.paragraphBookmarks,
      paragraphBookmarkKey(slug, language, paragraphId),
    ),
  };
}

export function withResumeLocation(
  state: ReadingState,
  slug: string,
  language: ReaderLanguage,
  paragraphId: string,
): ReadingState {
  return {
    ...state,
    resumeLocations: {
      ...state.resumeLocations,
      [readerStateKey(slug, language)]: paragraphId,
    },
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))].sort()
    : [];
}

function toggleSorted(values: readonly string[], value: string) {
  const next = new Set(values);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return [...next].sort();
}
