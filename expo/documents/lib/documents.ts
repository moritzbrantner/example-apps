export type DocumentSourceApp = 'inventory' | 'maintenance';

export type DocumentSource = {
  app: DocumentSourceApp;
  id: string;
  label: string;
};

export type HouseholdDocument = {
  id: string;
  title: string;
  category: string;
  originalName: string;
  storedUri: string;
  mimeType: string;
  size: number | null;
  managedFile: boolean;
  source: DocumentSource | null;
  notes: string;
  addedAt: string;
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function createDocumentRecord(input: {
  id: string;
  title: string;
  category?: string;
  originalName: string;
  storedUri: string;
  mimeType?: string;
  size?: number | null;
  managedFile: boolean;
  source?: DocumentSource | null;
  notes?: string;
  now?: Date;
}): HouseholdDocument {
  const title = normalizeText(input.title);
  const originalName = normalizeText(input.originalName);
  const storedUri = input.storedUri.trim();
  if (!input.id || !title || !originalName || !storedUri) {
    throw new Error('Document id, title, file name, and stored URI are required.');
  }
  if (input.size !== null && input.size !== undefined && (!Number.isFinite(input.size) || input.size < 0)) {
    throw new Error('Document size must be zero or greater.');
  }

  const source = input.source
    ? {
        app: input.source.app,
        id: input.source.id.trim(),
        label: normalizeText(input.source.label),
      }
    : null;
  if (source && (!source.id || !source.label)) {
    throw new Error('Linked document source requires id and label.');
  }

  return {
    id: input.id,
    title,
    category: normalizeText(input.category ?? 'Other') || 'Other',
    originalName,
    storedUri,
    mimeType: input.mimeType?.trim() ?? '',
    size: input.size ?? null,
    managedFile: input.managedFile,
    source,
    notes: normalizeText(input.notes ?? ''),
    addedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function parseDocumentAddHandoff(rawUrl: string): DocumentSource | null {
  if (!rawUrl.startsWith('documents://add?')) return null;
  const params = new URLSearchParams(rawUrl.slice(rawUrl.indexOf('?') + 1));
  const app = params.get('source');
  const id = params.get('sourceId')?.trim() ?? '';
  const label = normalizeText(params.get('label') ?? '');
  if ((app !== 'inventory' && app !== 'maintenance') || !id || !label) return null;
  return { app, id, label };
}

export function deserializeDocuments(raw: string | null): HouseholdDocument[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((candidate): HouseholdDocument[] => {
      if (!candidate || typeof candidate !== 'object') return [];
      const value = candidate as Partial<HouseholdDocument>;
      if (
        typeof value.id !== 'string' ||
        typeof value.title !== 'string' ||
        typeof value.category !== 'string' ||
        typeof value.originalName !== 'string' ||
        typeof value.storedUri !== 'string' ||
        typeof value.mimeType !== 'string' ||
        !(typeof value.size === 'number' || value.size === null) ||
        (typeof value.size === 'number' && (!Number.isFinite(value.size) || value.size < 0)) ||
        typeof value.managedFile !== 'boolean' ||
        !(value.source === null || (value.source && typeof value.source === 'object')) ||
        typeof value.notes !== 'string' ||
        typeof value.addedAt !== 'string'
      ) return [];

      let source: DocumentSource | null = null;
      if (value.source) {
        const candidateSource = value.source as Partial<DocumentSource>;
        if (
          (candidateSource.app !== 'inventory' && candidateSource.app !== 'maintenance') ||
          typeof candidateSource.id !== 'string' ||
          !candidateSource.id.trim() ||
          typeof candidateSource.label !== 'string' ||
          !normalizeText(candidateSource.label)
        ) return [];
        source = { app: candidateSource.app, id: candidateSource.id.trim(), label: normalizeText(candidateSource.label) };
      }

      const title = normalizeText(value.title);
      const originalName = normalizeText(value.originalName);
      if (!value.id || !title || !originalName || !value.storedUri.trim()) return [];
      return [{
        id: value.id,
        title,
        category: normalizeText(value.category) || 'Other',
        originalName,
        storedUri: value.storedUri.trim(),
        mimeType: value.mimeType.trim(),
        size: value.size,
        managedFile: value.managedFile,
        source,
        notes: normalizeText(value.notes),
        addedAt: value.addedAt,
      }];
    });
  } catch {
    return [];
  }
}
