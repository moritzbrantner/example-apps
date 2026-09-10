import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deserializeSession,
  durationMs,
  emptySession,
  intervalMs,
  startContraction,
  stopContraction,
  summarizeRecent,
} from './contractions';

test('records a contraction from explicit start and stop timestamps', () => {
  const started = startContraction(emptySession(), 10_000);
  const stopped = stopContraction(started, 'c1', 55_000);
  assert.equal(stopped.activeStartedAt, null);
  assert.equal(durationMs(stopped.contractions[0]), 45_000);
});

test('derives intervals from contraction start times', () => {
  const first = { id: '1', startedAt: 10_000, endedAt: 40_000 };
  const second = { id: '2', startedAt: 310_000, endedAt: 350_000 };
  assert.equal(intervalMs(first, second), 300_000);
  assert.deepEqual(summarizeRecent([first, second], 0), {
    count: 2,
    averageDurationMs: 35_000,
    averageIntervalMs: 300_000,
  });
});

test('recovers safely from malformed local session data', () => {
  assert.deepEqual(deserializeSession('{broken'), emptySession());
});
