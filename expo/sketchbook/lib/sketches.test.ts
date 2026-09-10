import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendStroke,
  clearSketch,
  createSketch,
  createStroke,
  deserializeSketchCollection,
  normalizePoint,
  removeLastStroke,
} from './sketches';

test('normalizes points to a responsive unit canvas', () => {
  assert.deepEqual(normalizePoint({ x: -1, y: 1.4 }), { x: 0, y: 1 });
});

test('adds strokes idempotently and supports explicit undo', () => {
  const sketch = createSketch({ id: 'sketch-1', title: ' Hands ' });
  const stroke = createStroke({
    id: 'stroke-1',
    color: '#222222',
    width: 5,
    points: [{ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.8 }],
  });
  const drawn = appendStroke(sketch, stroke, new Date('2026-09-10T08:00:00Z'));
  assert.equal(drawn.strokes.length, 1);
  assert.deepEqual(appendStroke(drawn, stroke), drawn);
  const undone = removeLastStroke(drawn, new Date('2026-09-10T08:01:00Z'));
  assert.equal(undone.removed?.id, 'stroke-1');
  assert.equal(undone.sketch.strokes.length, 0);
});

test('clear preserves identity and removes all drawing strokes', () => {
  const sketch = appendStroke(
    createSketch({ id: 'sketch-1', title: 'Values' }),
    createStroke({ id: 's', color: '#000', width: 2, points: [{ x: 0.5, y: 0.5 }] }),
  );
  const cleared = clearSketch(sketch);
  assert.equal(cleared.id, sketch.id);
  assert.deepEqual(cleared.strokes, []);
});

test('hydrates valid sketches and ignores invalid records', () => {
  const valid = createSketch({ id: 'good', title: 'Gesture' });
  const collection = deserializeSketchCollection(JSON.stringify({
    sketches: [valid, { id: 1 }],
    selectedSketchId: 'good',
  }));
  assert.equal(collection.sketches.length, 1);
  assert.equal(collection.selectedSketchId, 'good');
  assert.deepEqual(deserializeSketchCollection('{broken').sketches, []);
});
