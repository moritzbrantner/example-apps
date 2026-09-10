import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activeLoans,
  buildInventoryOpenHandoff,
  createLoan,
  deserializeLoans,
  markLoanReturned,
  parseInventoryLoanHandoff,
} from './loans';

test('creates a normalized loan and marks it returned idempotently', () => {
  const loan = createLoan({
    id: 'loan-1',
    direction: 'lent',
    itemName: '  Cordless drill ',
    personName: ' Thomas ',
    dueOn: '2026-09-20',
    now: new Date('2026-09-10T05:00:00Z'),
  });
  const returned = markLoanReturned(loan, new Date('2026-09-11T05:00:00Z'));
  assert.equal(loan.itemName, 'Cordless drill');
  assert.equal(loan.personName, 'Thomas');
  assert.equal(returned.returnedAt, '2026-09-11T05:00:00.000Z');
  assert.deepEqual(markLoanReturned(returned), returned);
});

test('orders active loans by due date and excludes returned records', () => {
  const later = createLoan({ id: '2', direction: 'lent', itemName: 'Book', personName: 'A', dueOn: '2026-10-01' });
  const sooner = createLoan({ id: '1', direction: 'borrowed', itemName: 'Trailer', personName: 'B', dueOn: '2026-09-15' });
  assert.deepEqual(activeLoans([later, markLoanReturned(sooner)]).map((loan) => loan.id), ['2']);
});

test('accepts the inventory handoff and can link back to the source item', () => {
  const handoff = parseInventoryLoanHandoff('borrowed://add?itemId=item%201&name=Cordless%20drill');
  assert.deepEqual(handoff, { itemId: 'item 1', name: 'Cordless drill' });
  const loan = createLoan({
    id: 'loan-1',
    direction: 'lent',
    itemName: handoff!.name,
    inventoryItemId: handoff!.itemId,
    personName: 'Thomas',
  });
  assert.equal(buildInventoryOpenHandoff(loan), 'inventory://open?itemId=item%201');
});

test('drops malformed persisted data', () => {
  assert.deepEqual(deserializeLoans('{broken'), []);
  assert.deepEqual(deserializeLoans('[{"id":1}]'), []);
});
