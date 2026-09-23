export interface GabcNotationRenderer {
  render(source: string, width: number): Promise<string>;
}

const MIN_NOTATION_WIDTH = 280;
const MAX_NOTATION_WIDTH = 1200;

export function normalizeNotationWidth(width: number): number {
  if (!Number.isFinite(width)) return MIN_NOTATION_WIDTH;
  return Math.max(MIN_NOTATION_WIDTH, Math.min(MAX_NOTATION_WIDTH, Math.round(width)));
}
