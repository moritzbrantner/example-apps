export type SketchPoint = {
  x: number;
  y: number;
};

export type SketchStroke = {
  id: string;
  color: string;
  width: number;
  points: SketchPoint[];
};

export type Sketch = {
  id: string;
  title: string;
  strokes: SketchStroke[];
  createdAt: string;
  updatedAt: string;
};

export type SketchCollection = {
  sketches: Sketch[];
  selectedSketchId: string | null;
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function finiteUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function emptySketchCollection(): SketchCollection {
  return { sketches: [], selectedSketchId: null };
}

export function normalizePoint(point: SketchPoint): SketchPoint {
  return { x: finiteUnit(point.x), y: finiteUnit(point.y) };
}

export function createSketch(input: { id: string; title: string; now?: Date }): Sketch {
  const title = normalizeText(input.title);
  if (!input.id || !title) throw new Error('Sketch id and title are required.');
  const timestamp = (input.now ?? new Date()).toISOString();
  return { id: input.id, title, strokes: [], createdAt: timestamp, updatedAt: timestamp };
}

export function createStroke(input: {
  id: string;
  color: string;
  width: number;
  points: SketchPoint[];
}): SketchStroke {
  const color = input.color.trim();
  if (!input.id || !color) throw new Error('Stroke id and color are required.');
  if (!Number.isFinite(input.width) || input.width < 1 || input.width > 64) {
    throw new Error('Stroke width must be between 1 and 64.');
  }
  const points = input.points.map(normalizePoint);
  if (points.length === 0) throw new Error('Stroke requires at least one point.');
  return { id: input.id, color, width: input.width, points };
}

export function appendStroke(sketch: Sketch, stroke: SketchStroke, now = new Date()): Sketch {
  if (sketch.strokes.some((candidate) => candidate.id === stroke.id)) return sketch;
  return { ...sketch, strokes: [...sketch.strokes, stroke], updatedAt: now.toISOString() };
}

export function removeLastStroke(sketch: Sketch, now = new Date()): { sketch: Sketch; removed: SketchStroke | null } {
  const removed = sketch.strokes.at(-1) ?? null;
  if (!removed) return { sketch, removed: null };
  return {
    sketch: { ...sketch, strokes: sketch.strokes.slice(0, -1), updatedAt: now.toISOString() },
    removed,
  };
}

export function clearSketch(sketch: Sketch, now = new Date()): Sketch {
  if (sketch.strokes.length === 0) return sketch;
  return { ...sketch, strokes: [], updatedAt: now.toISOString() };
}

export function deserializeSketchCollection(raw: string | null): SketchCollection {
  if (!raw) return emptySketchCollection();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptySketchCollection();
    const candidate = parsed as Partial<SketchCollection>;
    if (!Array.isArray(candidate.sketches)) return emptySketchCollection();

    const sketchIds = new Set<string>();
    const sketches = candidate.sketches.flatMap((value): Sketch[] => {
      if (!value || typeof value !== 'object') return [];
      const sketch = value as Partial<Sketch>;
      if (
        typeof sketch.id !== 'string' ||
        typeof sketch.title !== 'string' ||
        !Array.isArray(sketch.strokes) ||
        typeof sketch.createdAt !== 'string' ||
        typeof sketch.updatedAt !== 'string'
      ) return [];
      const id = sketch.id.trim();
      const title = normalizeText(sketch.title);
      if (!id || !title || sketchIds.has(id)) return [];

      const strokeIds = new Set<string>();
      const strokes = sketch.strokes.flatMap((strokeValue): SketchStroke[] => {
        if (!strokeValue || typeof strokeValue !== 'object') return [];
        const stroke = strokeValue as Partial<SketchStroke>;
        if (
          typeof stroke.id !== 'string' ||
          typeof stroke.color !== 'string' ||
          typeof stroke.width !== 'number' ||
          !Number.isFinite(stroke.width) ||
          stroke.width < 1 ||
          stroke.width > 64 ||
          !Array.isArray(stroke.points) ||
          stroke.points.length === 0
        ) return [];
        const strokeId = stroke.id.trim();
        const color = stroke.color.trim();
        if (!strokeId || !color || strokeIds.has(strokeId)) return [];
        const points = stroke.points.flatMap((pointValue): SketchPoint[] => {
          if (!pointValue || typeof pointValue !== 'object') return [];
          const point = pointValue as Partial<SketchPoint>;
          if (typeof point.x !== 'number' || typeof point.y !== 'number' || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return [];
          return [normalizePoint({ x: point.x, y: point.y })];
        });
        if (points.length !== stroke.points.length) return [];
        strokeIds.add(strokeId);
        return [{ id: strokeId, color, width: stroke.width, points }];
      });

      sketchIds.add(id);
      return [{ id, title, strokes, createdAt: sketch.createdAt, updatedAt: sketch.updatedAt }];
    });

    const selectedSketchId =
      typeof candidate.selectedSketchId === 'string' && sketchIds.has(candidate.selectedSketchId)
        ? candidate.selectedSketchId
        : sketches[0]?.id ?? null;
    return { sketches, selectedSketchId };
  } catch {
    return emptySketchCollection();
  }
}
