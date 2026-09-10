import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adjustQuantity,
  buildBorrowedHandoff,
  buildDocumentsHandoff,
  buildMaintenanceHandoff,
  createInventoryItem,
  deserializeInventoryItems,
  findInventoryItemByCode,
  isLowStock,
  parseInventoryOpenHandoff,
} from './inventory';

test('creates and adjusts a normalized inventory item without going negative', () => {
  const item = createInventoryItem({
    id: 'item-1',
    name: '  Laundry detergent  ',
    quantity: 2,
    unit: ' bottles ',
    lowAt: 1,
    now: new Date('2026-09-10T05:00:00Z'),
  });
  assert.equal(item.name, 'Laundry detergent');
  assert.equal(adjustQuantity(item, -5, new Date('2026-09-10T06:00:00Z')).quantity, 0);
  assert.equal(isLowStock(item), false);
  assert.equal(isLowStock({ ...item, quantity: 1 }), true);
});

test('uses normalized codes to find physical items', () => {
  const item = createInventoryItem({ id: '1', name: 'Milk', barcode: ' 400 123 ' });
  assert.equal(findInventoryItemByCode([item], '400123')?.id, '1');
});

test('builds explicit handoffs and parses inventory callbacks', () => {
  const item = createInventoryItem({ id: 'a b', name: 'Cordless drill', location: 'Garage shelf' });
  assert.equal(
    buildBorrowedHandoff(item),
    'borrowed://add?itemId=a%20b&name=Cordless%20drill',
  );
  assert.equal(
    buildMaintenanceHandoff(item),
    'maintenance://add?itemId=a%20b&name=Cordless%20drill&location=Garage%20shelf',
  );
  assert.equal(
    buildDocumentsHandoff(item),
    'documents://add?source=inventory&sourceId=a%20b&label=Cordless%20drill',
  );
  assert.equal(parseInventoryOpenHandoff('inventory://open?itemId=a%20b'), 'a b');
});

test('drops malformed persisted records instead of blocking startup', () => {
  assert.deepEqual(deserializeInventoryItems('{broken'), []);
  assert.deepEqual(deserializeInventoryItems('[{"id":1}]'), []);
});
