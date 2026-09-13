import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  parseReaderHtml,
  type ReaderDocumentContent,
  type ReaderSource,
} from './reader-content';

const storagePrefix = 'church-documents:reader-cache:v1';

export async function loadCachedReaderDocument(
  source: ReaderSource,
): Promise<ReaderDocumentContent | null> {
  const raw = await AsyncStorage.getItem(storageKey(source));
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isReaderDocumentContent(parsed)) {
      return null;
    }
    if (
      parsed.documentSlug !== source.documentSlug ||
      parsed.language !== source.language ||
      parsed.sourcePageUrl !== source.sourcePageUrl
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function downloadReaderDocument(
  source: ReaderSource,
): Promise<ReaderDocumentContent> {
  const response = await fetch(source.contentEndpoint, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Reader source returned HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  const html = readHtml(payload);
  const revision = readRevision(payload);
  const content = parseReaderHtml(source, html, new Date().toISOString(), revision);
  await AsyncStorage.setItem(storageKey(source), JSON.stringify(content));
  return content;
}

function storageKey(source: ReaderSource) {
  return `${storagePrefix}:${source.documentSlug}:${source.language}`;
}

function readHtml(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Reader source returned an invalid payload');
  }

  const html = (payload as { html?: unknown }).html;
  if (typeof html !== 'string' || html.length === 0) {
    throw new Error('Reader source did not return HTML content');
  }
  return html;
}

function readRevision(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const latest = (payload as { latest?: unknown }).latest;
  if (!latest || typeof latest !== 'object') {
    return null;
  }
  const id = (latest as { id?: unknown }).id;
  if (typeof id === 'string' && id.length > 0) {
    return id;
  }
  if (typeof id === 'number' && Number.isFinite(id)) {
    return String(id);
  }
  return null;
}

function isReaderDocumentContent(value: unknown): value is ReaderDocumentContent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ReaderDocumentContent>;
  if (
    typeof candidate.documentSlug !== 'string' ||
    candidate.language !== 'en' ||
    typeof candidate.sourcePageUrl !== 'string' ||
    typeof candidate.fetchedAt !== 'string' ||
    !Array.isArray(candidate.sections) ||
    candidate.sections.length === 0
  ) {
    return false;
  }

  return candidate.sections.every(
    (section) =>
      section &&
      typeof section.id === 'string' &&
      typeof section.heading === 'string' &&
      Array.isArray(section.paragraphs) &&
      section.paragraphs.every(
        (paragraph) =>
          paragraph && typeof paragraph.id === 'string' && typeof paragraph.text === 'string',
      ),
  );
}
