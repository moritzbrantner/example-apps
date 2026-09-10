import assert from 'node:assert/strict';
import test from 'node:test';

import { isValidIsbn10, isValidIsbn13, normalizeIsbn } from './isbn';

test('validates ISBN-13 checksums and book prefixes', () => {
  assert.equal(isValidIsbn13('9780306406157'), true);
  assert.equal(isValidIsbn13('9791090636071'), true);
  assert.equal(isValidIsbn13('9780306406158'), false);
  assert.equal(isValidIsbn13('1234567890128'), false);
});

test('validates ISBN-10 including X check digits', () => {
  assert.equal(isValidIsbn10('0306406152'), true);
  assert.equal(isValidIsbn10('080442957X'), true);
  assert.equal(isValidIsbn10('0804429570'), false);
});

test('normalizes formatted ISBN-10 and ISBN-13 into canonical ISBN-13', () => {
  assert.equal(normalizeIsbn('0-306-40615-2'), '9780306406157');
  assert.equal(normalizeIsbn('978-0-306-40615-7'), '9780306406157');
  assert.equal(normalizeIsbn('not an isbn'), null);
});
