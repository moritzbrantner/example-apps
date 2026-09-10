import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addMember,
  buildBoardImportHandoff,
  completeChore,
  createChore,
  currentAssignee,
  emptyBoard,
  parseBoardImportHandoff,
  parseMaintenanceChoreHandoff,
} from './chores';

test('rotates responsibility and derives the next due date after completion', () => {
  let board = addMember(emptyBoard(), { id: 'a', name: 'Anna' });
  board = addMember(board, { id: 'b', name: 'Ben' });
  const chore = createChore({
    id: 'c1',
    title: 'Take out bins',
    intervalDays: 7,
    dueOn: '2026-09-10',
    memberIds: ['a', 'b'],
    now: new Date('2026-09-10T05:00:00Z'),
  });
  assert.equal(currentAssignee(chore, board)?.name, 'Anna');
  const completed = completeChore(chore, '2026-09-10', new Date('2026-09-10T06:00:00Z'));
  assert.equal(completed.dueOn, '2026-09-17');
  assert.equal(currentAssignee(completed, board)?.name, 'Ben');
});

test('same-day completion is idempotent', () => {
  const chore = createChore({ id: 'c1', title: 'Vacuum', intervalDays: 7, memberIds: ['a'] });
  const completed = completeChore(chore, '2026-09-10');
  assert.deepEqual(completeChore(completed, '2026-09-10'), completed);
});

test('parses maintenance handoffs without taking maintenance ownership', () => {
  assert.deepEqual(
    parseMaintenanceChoreHandoff(
      'chores://add?source=maintenance&sourceId=asset%201&title=Replace%20filter&dueOn=2026-12-09',
    ),
    {
      source: { app: 'maintenance', id: 'asset 1' },
      title: 'Replace filter',
      dueOn: '2026-12-09',
    },
  );
});

test('round-trips an explicit board snapshot and rejects malformed imports', () => {
  const board = addMember(emptyBoard(), { id: 'a', name: 'Anna' });
  const populated = {
    ...board,
    chores: [createChore({ id: 'c1', title: 'Water plants', intervalDays: 3, memberIds: ['a'] })],
  };
  assert.deepEqual(parseBoardImportHandoff(buildBoardImportHandoff(populated)), populated);
  assert.equal(parseBoardImportHandoff('chores://import?data=%7Bbroken'), null);
});
