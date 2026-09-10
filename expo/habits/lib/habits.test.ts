import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countCompletedDays,
  createHabit,
  deserializeHabits,
  isHabitDone,
  toggleHabitDay,
} from './habits';

test('creates a habit with a bounded weekly target', () => {
  const habit = createHabit('  Walk after lunch  ', 'habit-1', 5, new Date('2026-09-03T10:00:00Z'));
  assert.equal(habit.name, 'Walk after lunch');
  assert.equal(habit.targetPerWeek, 5);
  assert.deepEqual(habit.completions, []);
});

test('toggles a completion without duplicating the day', () => {
  const habit = createHabit('Read', 'habit-1');
  const done = toggleHabitDay(habit, '2026-09-03');
  assert.equal(isHabitDone(done, '2026-09-03'), true);
  assert.equal(countCompletedDays(done, ['2026-09-02', '2026-09-03']), 1);
  assert.equal(isHabitDone(toggleHabitDay(done, '2026-09-03'), '2026-09-03'), false);
});

test('rejects malformed persisted values without blocking startup', () => {
  assert.deepEqual(deserializeHabits('{broken'), []);
  assert.deepEqual(deserializeHabits('[{"id":1}]'), []);
});
