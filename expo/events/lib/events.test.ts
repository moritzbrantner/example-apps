import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addBringItem,
  addGuest,
  addTask,
  buildEventImportHandoff,
  buildInventoryOpenHandoff,
  copyEvent,
  createEvent,
  deserializeCollection,
  parseEventImportHandoff,
  parseInventoryEventHandoff,
  removeGuest,
  setBringItemBrought,
  setGuestStatus,
  setTaskDone,
} from './events';

test('tracks invitees, bring commitments, and categorized work explicitly', () => {
  let event = createEvent({ id: 'e1', title: 'Parish lunch', date: '2026-10-04' });
  event = addGuest(event, { id: 'g1', name: 'Anna' });
  event = setGuestStatus(event, 'g1', 'confirmed');
  event = addBringItem(event, { id: 'b1', label: 'Dessert', quantity: '2 trays', guestId: 'g1' });
  event = addTask(event, { id: 't1', title: 'Clean kitchen', category: 'cleanup', guestId: 'g1' });
  assert.equal(event.guests[0].status, 'confirmed');
  assert.equal(event.bringItems[0].guestId, 'g1');
  assert.equal(event.tasks[0].category, 'cleanup');
});

test('completion writes are idempotent and removing a guest unassigns responsibilities', () => {
  let event = createEvent({ id: 'e1', title: 'Birthday' });
  event = addGuest(event, { id: 'g1', name: 'Thomas' });
  event = addBringItem(event, { id: 'b1', label: 'Drinks', guestId: 'g1' });
  event = addTask(event, { id: 't1', title: 'Set tables', category: 'setup', guestId: 'g1' });
  const brought = setBringItemBrought(event, 'b1', true, new Date('2026-09-10T06:00:00Z'));
  assert.deepEqual(setBringItemBrought(brought, 'b1', true), brought);
  const done = setTaskDone(brought, 't1', true, new Date('2026-09-10T06:01:00Z'));
  assert.deepEqual(setTaskDone(done, 't1', true), done);
  const removed = removeGuest(done, 'g1');
  assert.equal(removed.bringItems[0].guestId, null);
  assert.equal(removed.tasks[0].guestId, null);
});

test('accepts inventory handoffs and can return to the authoritative item', () => {
  const handoff = parseInventoryEventHandoff(
    'eventworkboard://add?source=inventory&sourceId=chair%201&label=Folding%20chairs',
  );
  assert.deepEqual(handoff, { inventoryItemId: 'chair 1', label: 'Folding chairs' });
  let event = createEvent({ id: 'e1', title: 'Community evening' });
  event = addBringItem(event, {
    id: 'b1',
    label: handoff!.label,
    inventoryItemId: handoff!.inventoryItemId,
  });
  assert.equal(buildInventoryOpenHandoff(event.bringItems[0]), 'inventory://open?itemId=chair%201');
});

test('round-trips a shared event and copies all internal ids while preserving foreign inventory ids', () => {
  let event = createEvent({ id: 'e1', title: 'Dinner' });
  event = addGuest(event, { id: 'g1', name: 'Maria' });
  event = addBringItem(event, { id: 'b1', label: 'Chairs', guestId: 'g1', inventoryItemId: 'inv-1' });
  event = addTask(event, { id: 't1', title: 'Wash dishes', category: 'cleanup', guestId: 'g1' });
  const parsed = parseEventImportHandoff(buildEventImportHandoff(event));
  assert.ok(parsed);
  let counter = 0;
  const copy = copyEvent(parsed!, (kind) => `${kind}-${++counter}`, new Date('2026-09-10T07:00:00Z'));
  assert.notEqual(copy.id, event.id);
  assert.notEqual(copy.guests[0].id, event.guests[0].id);
  assert.equal(copy.bringItems[0].guestId, copy.guests[0].id);
  assert.equal(copy.tasks[0].guestId, copy.guests[0].id);
  assert.equal(copy.bringItems[0].inventoryItemId, 'inv-1');
});

test('malformed persisted event collections fail closed', () => {
  assert.deepEqual(deserializeCollection('{broken'), { events: [], selectedEventId: null });
  assert.deepEqual(deserializeCollection('[{"id":1}]'), { events: [], selectedEventId: null });
});
