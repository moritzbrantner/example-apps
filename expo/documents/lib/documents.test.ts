import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDocumentRecord,
  deserializeDocuments,
  parseDocumentAddHandoff,
} from './documents';

test('creates a normalized managed document record', () => {
  const document = createDocumentRecord({
    id: 'doc-1',
    title: '  Washing machine warranty  ',
    category: ' Warranty ',
    originalName: 'warranty.pdf',
    storedUri: 'file:///documents/warranty.pdf',
    mimeType: 'application/pdf',
    size: 1234,
    managedFile: true,
    source: { app: 'inventory', id: 'item-1', label: ' Washing machine ' },
    notes: '  Bought in 2026  ',
    now: new Date('2026-09-10T06:00:00Z'),
  });

  assert.equal(document.title, 'Washing machine warranty');
  assert.equal(document.category, 'Warranty');
  assert.equal(document.source?.label, 'Washing machine');
  assert.equal(document.managedFile, true);
  assert.equal(document.addedAt, '2026-09-10T06:00:00.000Z');
});

test('parses explicit document handoffs from supported source apps', () => {
  assert.deepEqual(
    parseDocumentAddHandoff(
      'documents://add?source=inventory&sourceId=item%201&label=Cordless%20drill',
    ),
    { app: 'inventory', id: 'item 1', label: 'Cordless drill' },
  );
  assert.equal(
    parseDocumentAddHandoff('documents://add?source=unknown&sourceId=1&label=Thing'),
    null,
  );
});

test('drops malformed persisted records instead of blocking startup', () => {
  assert.deepEqual(deserializeDocuments('{broken'), []);
  assert.deepEqual(deserializeDocuments('[{"id":1}]'), []);
});
