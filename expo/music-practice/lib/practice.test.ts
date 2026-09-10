import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPracticeSession,
  deserializePracticeSessions,
  elapsedSeconds,
  formatDuration,
} from './practice';

test('creates a normalized practice session', () => {
  const session = createPracticeSession({
    id: 'session-1',
    instrument: '  Piano ',
    piece: ' Bach   Invention No. 1 ',
    focus: ' left hand ',
    durationSeconds: 615,
    now: new Date('2026-09-10T08:00:00Z'),
  });
  assert.equal(session.instrument, 'Piano');
  assert.equal(session.piece, 'Bach Invention No. 1');
  assert.equal(session.focus, 'left hand');
  assert.equal(session.practicedAt, '2026-09-10T08:00:00.000Z');
});

test('timer derives elapsed time from wall clock rather than tick count', () => {
  assert.equal(elapsedSeconds(1_000, 10, 6_500), 16);
  assert.equal(elapsedSeconds(null, 42, 99_000), 42);
});

test('formats short and long durations', () => {
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3_661), '1:01:01');
});

test('temporary browser recording references are discarded during hydration', () => {
  const session = createPracticeSession({
    id: 'session-1',
    instrument: 'Voice',
    piece: 'Scale',
    durationSeconds: 30,
    recordingUri: 'blob:https://example.test/take',
    recordingSeconds: 12,
    recordingPersistent: false,
  });
  const [hydrated] = deserializePracticeSessions(JSON.stringify([session]));
  assert.equal(hydrated?.recordingUri, null);
  assert.equal(hydrated?.recordingSeconds, 0);
});

test('drops malformed persisted records', () => {
  assert.deepEqual(deserializePracticeSessions('{broken'), []);
  assert.deepEqual(deserializePracticeSessions('[{"id":1}]'), []);
});
