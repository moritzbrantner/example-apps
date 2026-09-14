export type GregorianMode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type ChantUsage =
  | "antiphon"
  | "gradual"
  | "hymn"
  | "kyriale"
  | "offertory"
  | "responsory"
  | "sequence"
  | "tract"
  | "other";

export interface ChantSource {
  label: string;
  year?: number;
  page?: string;
  url?: string;
}

export interface ChantNotation {
  format: "gabc";
  source: string;
  provenance: ChantSource;
}

export interface ChantPhrase {
  id: string;
  latin: string;
  startMs?: number;
  endMs?: number;
}

export interface Chant {
  id: string;
  title: string;
  incipit: string;
  latinText: string;
  mode?: GregorianMode;
  usage: ChantUsage;
  tags: readonly string[];
  notation?: ChantNotation;
  sources: readonly ChantSource[];
  phrases: readonly ChantPhrase[];
}

export interface PracticeLoop {
  phraseId: string;
  startMs: number;
  endMs: number;
  playbackRate: number;
}

/**
 * Product-owned playback contract. Implementations may use the reusable
 * media-player transport on web/Tauri, native AVAudioEngine/Media3 clients,
 * or a future shared native bridge. Chant semantics never depend on a specific
 * transport.
 */
export interface ChantPlaybackAdapter {
  load(source: { uri: string }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;
  setLoop(loop: PracticeLoop | null): Promise<void>;
}

/** Heavy signal analysis remains delegated to audio-analysis. */
export interface ChantAnalysisAdapter {
  inspect(source: { uri: string }): Promise<{
    durationMs: number;
    pitchAvailable: boolean;
    clippingDetected: boolean;
  }>;
}

export function createPracticeLoop(
  chant: Chant,
  phraseId: string,
  playbackRate: number,
): PracticeLoop | null {
  const phrase = chant.phrases.find((candidate) => candidate.id === phraseId);
  if (
    !phrase ||
    phrase.startMs === undefined ||
    phrase.endMs === undefined ||
    phrase.endMs <= phrase.startMs
  ) {
    return null;
  }

  return {
    phraseId,
    startMs: phrase.startMs,
    endMs: phrase.endMs,
    playbackRate: Math.max(0.5, Math.min(1.25, playbackRate)),
  };
}

export function searchChants(chants: readonly Chant[], query: string): Chant[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...chants];

  return chants.filter((chant) =>
    [chant.title, chant.incipit, chant.latinText, ...chant.tags]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized),
  );
}
