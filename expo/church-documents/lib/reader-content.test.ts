import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findReaderSource,
  findSectionIndexForParagraph,
  parseReaderHtml,
  searchReaderDocument,
} from './reader-content';

const source = findReaderSource('rerum-novarum');
if (!source) {
  throw new Error('Expected Rerum Novarum reader source');
}

test('parses reader HTML into stable ordered sections and paragraphs', () => {
  const content = parseReaderHtml(
    source,
    '<h2>First section</h2><p>Alpha &amp; beta.<sup>1</sup></p><p>Second paragraph.</p><h2>Next</h2><p>Gamma.</p>',
    '2026-09-13T00:00:00.000Z',
    '42',
  );

  assert.equal(content.sourceRevision, '42');
  assert.deepEqual(
    content.sections.map((section) => ({
      heading: section.heading,
      paragraphs: section.paragraphs.map((paragraph) => paragraph.text),
    })),
    [
      {
        heading: 'First section',
        paragraphs: ['Alpha & beta.', 'Second paragraph.'],
      },
      {
        heading: 'Next',
        paragraphs: ['Gamma.'],
      },
    ],
  );
  assert.match(content.sections[0].id, /^section-[0-9a-f]{8}$/);
  assert.match(content.sections[0].paragraphs[0].id, /^paragraph-[0-9a-f]{8}$/);
});

test('keeps paragraph IDs stable when unrelated source blocks are inserted or reordered', () => {
  const original = parseReaderHtml(
    source,
    '<h2>Work</h2><p>Dignity of work.</p><p>Justice in society.</p><h2>Property</h2><p>Property and work.</p>',
    '2026-09-13T00:00:00.000Z',
    '42',
  );
  const updated = parseReaderHtml(
    source,
    '<h2>Preface</h2><p>New introduction.</p><h2>Property</h2><p>Property and work.</p><h2>Work</h2><p>New opening.</p><p>Dignity of work.</p><p>Justice in society.</p>',
    '2026-09-14T00:00:00.000Z',
    '43',
  );

  const originalDignity = original.sections
    .flatMap((section) => section.paragraphs)
    .find((paragraph) => paragraph.text === 'Dignity of work.');
  const updatedDignity = updated.sections
    .flatMap((section) => section.paragraphs)
    .find((paragraph) => paragraph.text === 'Dignity of work.');
  const originalProperty = original.sections
    .flatMap((section) => section.paragraphs)
    .find((paragraph) => paragraph.text === 'Property and work.');
  const updatedProperty = updated.sections
    .flatMap((section) => section.paragraphs)
    .find((paragraph) => paragraph.text === 'Property and work.');

  assert.equal(updatedDignity?.id, originalDignity?.id);
  assert.equal(updatedProperty?.id, originalProperty?.id);
});

test('search preserves document order and returns paragraph locations', () => {
  const content = parseReaderHtml(
    source,
    '<h2>Work</h2><p>Dignity of work.</p><p>Justice in society.</p><h2>Property</h2><p>Property and work.</p>',
    '2026-09-13T00:00:00.000Z',
    null,
  );

  const results = searchReaderDocument(content, ' work ');
  assert.deepEqual(
    results.map((result) => result.paragraph.text),
    ['Dignity of work.', 'Justice in society.', 'Property and work.'],
  );
  assert.equal(findSectionIndexForParagraph(content, content.sections[1].paragraphs[0].id), 1);
  assert.equal(findSectionIndexForParagraph(content, 'missing'), undefined);
});

test('rejects HTML with no readable paragraphs', () => {
  assert.throws(
    () => parseReaderHtml(source, '<h2>Only a heading</h2>', '2026-09-13T00:00:00.000Z', null),
    /readable paragraphs/,
  );
});
