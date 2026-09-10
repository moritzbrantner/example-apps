export type ReadingStatus = 'read' | 'reading' | 'want-to-read';

export type LibraryBook = {
  id: string;
  isbn: string;
  title: string;
  authors: string[];
  coverUrl?: string;
  firstPublishedYear?: number;
  publisher?: string;
  openLibraryKey?: string;
  status: ReadingStatus;
  finishedOn: string;
  notes: string;
  review: string;
  keyIdeas: string;
  meaning: string;
  addedAt: string;
  updatedAt: string;
};

export type BookMetadata = Pick<
  LibraryBook,
  | 'title'
  | 'authors'
  | 'coverUrl'
  | 'firstPublishedYear'
  | 'publisher'
  | 'openLibraryKey'
>;

type OpenLibraryDoc = {
  key?: unknown;
  title?: unknown;
  author_name?: unknown;
  cover_i?: unknown;
  first_publish_year?: unknown;
  publisher?: unknown;
};

type OpenLibrarySearchResponse = {
  docs?: unknown;
};

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

export async function lookupBookMetadata(
  isbn: string,
  signal?: AbortSignal,
): Promise<BookMetadata | null> {
  const params = new URLSearchParams({
    q: `isbn:${isbn}`,
    fields: 'key,title,author_name,cover_i,first_publish_year,publisher',
    limit: '1',
  });
  const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Open Library lookup failed (${response.status})`);
  }

  const body = (await response.json()) as OpenLibrarySearchResponse;
  if (!Array.isArray(body.docs) || body.docs.length === 0) {
    return null;
  }

  const doc = body.docs[0] as OpenLibraryDoc;
  if (typeof doc.title !== 'string' || doc.title.trim().length === 0) {
    return null;
  }

  const authors = stringArray(doc.author_name);
  const publishers = stringArray(doc.publisher);
  const coverId = typeof doc.cover_i === 'number' ? doc.cover_i : undefined;

  return {
    title: doc.title.trim(),
    authors,
    ...(coverId
      ? { coverUrl: `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` }
      : {}),
    ...(typeof doc.first_publish_year === 'number'
      ? { firstPublishedYear: doc.first_publish_year }
      : {}),
    ...(publishers[0] ? { publisher: publishers[0] } : {}),
    ...(typeof doc.key === 'string' ? { openLibraryKey: doc.key } : {}),
  };
}

export function createLibraryBook(
  isbn: string,
  metadata: BookMetadata | null,
  now = new Date(),
): LibraryBook {
  const timestamp = now.toISOString();

  return {
    id: isbn,
    isbn,
    title: metadata?.title ?? 'Unknown book',
    authors: metadata?.authors ?? [],
    ...(metadata?.coverUrl ? { coverUrl: metadata.coverUrl } : {}),
    ...(metadata?.firstPublishedYear
      ? { firstPublishedYear: metadata.firstPublishedYear }
      : {}),
    ...(metadata?.publisher ? { publisher: metadata.publisher } : {}),
    ...(metadata?.openLibraryKey
      ? { openLibraryKey: metadata.openLibraryKey }
      : {}),
    status: 'read',
    finishedOn: '',
    notes: '',
    review: '',
    keyIdeas: '',
    meaning: '',
    addedAt: timestamp,
    updatedAt: timestamp,
  };
}
