import assert from 'node:assert/strict';
import test from 'node:test';

import { createLibraryBook } from './books';

test('keeps personal writing separate from fetched metadata', () => {
  const book = createLibraryBook(
    '9780141182803',
    {
      title: 'The Brothers Karamazov',
      authors: ['Fyodor Dostoevsky'],
      publisher: 'Penguin Classics',
    },
    new Date('2026-09-06T12:00:00.000Z'),
  );

  assert.equal(book.notes, '');
  assert.equal(book.review, '');
  assert.equal(book.keyIdeas, '');
  assert.equal(book.meaning, '');
  assert.equal(book.title, 'The Brothers Karamazov');
  assert.deepEqual(book.authors, ['Fyodor Dostoevsky']);
});
