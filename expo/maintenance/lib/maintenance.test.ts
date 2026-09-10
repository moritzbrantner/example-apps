import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChoreHandoff,
  buildInventoryOpenHandoff,
  createAsset,
  daysUntilDue,
  deserializeAssets,
  markMaintenanceComplete,
  nextDueOn,
  parseInventoryMaintenanceHandoff,
} from './maintenance';

test('derives the next maintenance date from explicit completion history', () => {
  const asset = createAsset({
    id: 'asset-1',
    name: 'Water filter',
    intervalDays: 90,
    now: new Date('2026-09-10T05:00:00Z'),
  });
  const completed = markMaintenanceComplete(
    asset,
    '2026-09-10',
    'Changed cartridge',
    new Date('2026-09-10T06:00:00Z'),
  );
  assert.equal(nextDueOn(completed), '2026-12-09');
  assert.equal(daysUntilDue(completed, '2026-12-01'), 8);
  assert.equal(
    buildChoreHandoff(completed),
    'chores://add?source=maintenance&sourceId=asset-1&title=Maintain%20Water%20filter&dueOn=2026-12-09',
  );
});

test('same-day completion is idempotent', () => {
  const asset = createAsset({ id: '1', name: 'Bike chain', intervalDays: 30 });
  const completed = markMaintenanceComplete(asset, '2026-09-10');
  assert.deepEqual(markMaintenanceComplete(completed, '2026-09-10'), completed);
});

test('accepts inventory handoffs and retains only a foreign reference', () => {
  const handoff = parseInventoryMaintenanceHandoff(
    'maintenance://add?itemId=filter%201&name=Water%20filter&location=Kitchen',
  );
  assert.deepEqual(handoff, { itemId: 'filter 1', name: 'Water filter', location: 'Kitchen' });
  const asset = createAsset({
    id: 'asset-1',
    name: handoff!.name,
    inventoryItemId: handoff!.itemId,
    location: handoff!.location,
    intervalDays: 90,
  });
  assert.equal(buildInventoryOpenHandoff(asset), 'inventory://open?itemId=filter%201');
});

test('drops malformed persisted records', () => {
  assert.deepEqual(deserializeAssets('{broken'), []);
  assert.deepEqual(deserializeAssets('[{"id":1}]'), []);
});
