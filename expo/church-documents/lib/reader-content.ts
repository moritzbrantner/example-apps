export type ReaderLanguage = 'en';

export type ReaderSource = {
  documentSlug: string;
  language: ReaderLanguage;
  languageLabel: string;
  provider: string;
  sourcePageUrl: string;
  contentEndpoint: string;
  provenanceNote: string;
};

export type ReaderParagraph = {
  id: string;
  text: string;
};

export type ReaderSection = {
  id: string;
  heading: string;
  paragraphs: readonly ReaderParagraph[];
};

export type ReaderDocumentContent = {
  documentSlug: string;
  language: ReaderLanguage;
  sourcePageUrl: string;
  sourceRevision: string | null;
  fetchedAt: string;
  sections: readonly ReaderSection[];
};

export type ReaderSearchResult = {
  sectionId: string;
  sectionHeading: string;
  paragraph: ReaderParagraph;
};

export const readerSources: readonly ReaderSource[] = [
  {
    documentSlug: 'rerum-novarum',
    language: 'en',
    languageLabel: 'English',
    provider: 'Wikisource',
    sourcePageUrl: 'https://en.wikisource.org/wiki/Rerum_Novarum',
    contentEndpoint: 'https://en.wikisource.org/w/rest.php/v1/page/Rerum_Novarum/with_html',
    provenanceNote:
      'Public-domain historical transcription hosted by Wikisource. The Vatican-hosted document remains the canonical reference.',
  },
];

export function findReaderSource(
  documentSlug: string,
  language: ReaderLanguage = 'en',
): ReaderSource | undefined {
  return readerSources.find(
    (source) => source.documentSlug === documentSlug && source.language === language,
  );
}

export function parseReaderHtml(
  source: ReaderSource,
  html: string,
  fetchedAt: string,
  sourceRevision: string | null,
): ReaderDocumentContent {
  const sections: { id: string; heading: string; paragraphs: ReaderParagraph[] }[] = [];
  const identityCounts = new Map<string, number>();
  let current: { id: string; heading: string; paragraphs: ReaderParagraph[] } | null = null;

  const blocks = html.matchAll(/<(h[2-4]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi);
  for (const block of blocks) {
    const tag = block[1].toLowerCase();
    const text = cleanHtmlFragment(block[2]);
    if (!text) {
      continue;
    }

    if (tag.startsWith('h')) {
      if (current && current.paragraphs.length > 0) {
        sections.push(current);
      }
      current = {
        id: stableContentId('section', text, identityCounts),
        heading: text,
        paragraphs: [],
      };
      continue;
    }

    if (!current) {
      current = {
        id: stableContentId('section', 'Document', identityCounts),
        heading: 'Document',
        paragraphs: [],
      };
    }

    current.paragraphs.push({
      id: stableContentId('paragraph', `${current.heading}\u0000${text}`, identityCounts),
      text,
    });
  }

  if (current && current.paragraphs.length > 0) {
    sections.push(current);
  }

  if (sections.length === 0) {
    throw new Error('Reader source did not contain readable paragraphs');
  }

  return {
    documentSlug: source.documentSlug,
    language: source.language,
    sourcePageUrl: source.sourcePageUrl,
    sourceRevision,
    fetchedAt,
    sections,
  };
}

export function searchReaderDocument(
  content: ReaderDocumentContent,
  query: string,
): readonly ReaderSearchResult[] {
  const needle = normalize(query);
  if (!needle) {
    return [];
  }

  const results: ReaderSearchResult[] = [];
  for (const section of content.sections) {
    for (const paragraph of section.paragraphs) {
      if (normalize(`${section.heading} ${paragraph.text}`).includes(needle)) {
        results.push({
          sectionId: section.id,
          sectionHeading: section.heading,
          paragraph,
        });
      }
    }
  }
  return results;
}

export function findSectionIndexForParagraph(
  content: ReaderDocumentContent,
  paragraphId: string | undefined,
): number | undefined {
  if (!paragraphId) {
    return undefined;
  }

  const index = content.sections.findIndex((section) =>
    section.paragraphs.some((paragraph) => paragraph.id === paragraphId),
  );
  return index >= 0 ? index : undefined;
}

function stableContentId(prefix: string, value: string, identityCounts: Map<string, number>) {
  const normalized = normalize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  const baseId = `${prefix}-${hash.toString(16).padStart(8, '0')}`;
  const occurrence = (identityCounts.get(baseId) ?? 0) + 1;
  identityCounts.set(baseId, occurrence);
  return occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
}

function cleanHtmlFragment(fragment: string) {
  const withoutNotes = fragment
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(withoutNotes).replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string) {
  const named: Readonly<Record<string, string>> = {
    amp: '&',
    apos: "'",
    gt: '>',
    hellip: '…',
    lt: '<',
    mdash: '—',
    nbsp: ' ',
    ndash: '–',
    quot: '"',
  };

  return value
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
    .replace(/&#(\d+);/g, (match, raw: string) => decodeCodePoint(match, Number(raw)))
    .replace(/&#x([0-9a-f]+);/gi, (match, raw: string) => decodeCodePoint(match, Number.parseInt(raw, 16)));
}

function decodeCodePoint(fallback: string, value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) {
    return fallback;
  }
  return String.fromCodePoint(value);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
