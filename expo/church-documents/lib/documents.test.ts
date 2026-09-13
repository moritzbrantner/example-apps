import assert from 'node:assert/strict';
import test from 'node:test';

import { filterDocuments, findDocument } from './documents';

test('search is case-insensitive and trims the query', () => {
  const results = filterDocuments('  SCRIPTURE  ', 'All');

  assert.deepEqual(results.map((document) => document.slug), ['dei-verbum']);
});

test('family filtering is independent of search', () => {
  const results = filterDocuments('', 'Encyclical');

  assert.deepEqual(results.map((document) => document.slug), [
    'humanae-vitae',
    'rerum-novarum',
  ]);
});

test('search preserves canonical catalog order', () => {
  const results = filterDocuments('Church', 'All');

  assert.deepEqual(results.map((document) => document.slug), [
    'sacrosanctum-concilium',
    'lumen-gentium',
    'dei-verbum',
  ]);
});

test('slug lookup fails closed for unknown documents', () => {
  assert.equal(findDocument('not-a-document'), undefined);
});
