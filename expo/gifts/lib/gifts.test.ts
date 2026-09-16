import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addGift,
  addPerson,
  deserializeGiftState,
  emptyGiftState,
  returnToGiverWarning,
  upcomingPlannedGifts,
} from './gifts';

function withPeople() {
  return addPerson(
    addPerson(emptyGiftState(), { id: 'alice', name: '  Alice   Example ' }),
    { id: 'bob', name: 'Bob Example' },
  );
}

test('normalizes people and rejects duplicate identities', () => {
  const state = withPeople();
  assert.equal(state.people[0]?.name, 'Alice Example');
  assert.throws(() => addPerson(state, { id: 'alice', name: 'Other' }), /id already exists/);
  assert.throws(() => addPerson(state, { id: 'carol', name: ' alice example ' }), /already exists/);
});

test('preserves explicit regift provenance and warns against returning to the giver', () => {
  let state = withPeople();
  state = addGift(state, {
    id: 'received-1',
    direction: 'received',
    personId: 'alice',
    title: '  Brass   candlestick ',
    date: '2026-09-01',
    createdAt: 1,
  });
  state = addGift(state, {
    id: 'planned-1',
    direction: 'planned',
    personId: 'bob',
    title: 'Candlestick',
    date: '2026-10-01',
    sourceGiftId: 'received-1',
    createdAt: 2,
  });

  assert.equal(state.gifts[0]?.title, 'Brass candlestick');
  assert.equal(state.gifts[1]?.sourceGiftId, 'received-1');
  assert.equal(
    returnToGiverWarning(state, {
      direction: 'planned',
      personId: 'alice',
      sourceGiftId: 'received-1',
    }),
    'This was received from Alice Example. Choose a different recipient before regifting it.',
  );
  assert.equal(
    returnToGiverWarning(state, {
      direction: 'planned',
      personId: 'bob',
      sourceGiftId: 'received-1',
    }),
    null,
  );
});

test('fails closed on invalid regift sources', () => {
  let state = withPeople();
  state = addGift(state, {
    id: 'given-1',
    direction: 'given',
    personId: 'alice',
    title: 'Book',
    date: '2026-09-01',
    createdAt: 1,
  });

  assert.throws(
    () =>
      addGift(state, {
        id: 'planned-1',
        direction: 'planned',
        personId: 'bob',
        title: 'Book',
        date: '2026-09-10',
        sourceGiftId: 'given-1',
        createdAt: 2,
      }),
    /existing received gift/,
  );
});

test('orders only upcoming planned gifts within the requested window', () => {
  let state = withPeople();
  for (const gift of [
    { id: 'later', date: '2026-10-10', title: 'Later' },
    { id: 'soon-b', date: '2026-09-20', title: 'Beta' },
    { id: 'soon-a', date: '2026-09-20', title: 'Alpha' },
    { id: 'past', date: '2026-09-01', title: 'Past' },
  ]) {
    state = addGift(state, {
      ...gift,
      direction: 'planned',
      personId: 'bob',
      createdAt: state.gifts.length + 1,
    });
  }

  assert.deepEqual(
    upcomingPlannedGifts(state, '2026-09-15', 30).map((gift) => gift.id),
    ['soon-a', 'soon-b', 'later'],
  );
  assert.deepEqual(upcomingPlannedGifts(state, 'not-a-date'), []);
});

test('drops malformed persisted records instead of inventing relationships', () => {
  const state = deserializeGiftState(
    JSON.stringify({
      people: [
        { id: 'alice', name: ' Alice ' },
        { id: '', name: 'Nobody' },
      ],
      gifts: [
        {
          id: 'valid',
          direction: 'received',
          personId: 'alice',
          title: ' Book ',
          date: '2026-09-01',
          createdAt: 1,
        },
        {
          id: 'orphan',
          direction: 'planned',
          personId: 'missing',
          title: 'Orphan',
          date: '2026-09-02',
          createdAt: 2,
        },
      ],
    }),
  );

  assert.deepEqual(state.people, [{ id: 'alice', name: 'Alice' }]);
  assert.equal(state.gifts.length, 1);
  assert.equal(state.gifts[0]?.title, 'Book');
});
