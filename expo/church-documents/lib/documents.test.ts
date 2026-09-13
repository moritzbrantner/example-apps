import { describe, expect, test } from 'bun:test';
import { filterDocuments, findDocument } from './documents';

describe('church document catalog', () => {
  test('search is case-insensitive and trims the query', () => {
    const results = filterDocuments('  SCRIPTURE  ', 'All');

    expect(results.map((document) => document.slug)).toEqual(['dei-verbum']);
  });

  test('family filtering is independent of search', () => {
    const results = filterDocuments('', 'Encyclical');

    expect(results.map((document) => document.slug)).toEqual([
      'humanae-vitae',
      'rerum-novarum',
    ]);
  });

  test('search preserves canonical catalog order', () => {
    const results = filterDocuments('Church', 'All');

    expect(results.map((document) => document.slug)).toEqual([
      'lumen-gentium',
      'dei-verbum',
    ]);
  });

  test('slug lookup fails closed for unknown documents', () => {
    expect(findDocument('not-a-document')).toBeUndefined();
  });
});
