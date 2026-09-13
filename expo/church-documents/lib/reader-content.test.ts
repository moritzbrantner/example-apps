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
      id: section.id,
      heading: section.heading,
      paragraphs: section.paragraphs.map((paragraph) => [paragraph.id, paragraph.text]),
    })),
    [
      {
        id: 'section-1',
        heading: 'First section',
        paragraphs: [
          ['section-1-paragraph-1', 'Alpha & beta.'],
          ['section-1-paragraph-2', 'Second paragraph.'],
        ],
      },
      {
        id: 'section-2',
        heading: 'Next',
        paragraphs: [['section-2-paragraph-1', 'Gamma.']],
      },
    ],
  );
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
    results.map((result) => result.paragraph.id),
    ['section-1-paragraph-1', 'section-1-paragraph-2', 'section-2-paragraph-1'],
  );
  assert.equal(findSectionIndexForParagraph(content, 'section-2-paragraph-1'), 1);
  assert.equal(findSectionIndexForParagraph(content, 'missing'), undefined);
});

test('rejects HTML with no readable paragraphs', () => {
  assert.throws(
    () => parseReaderHtml(source, '<h2>Only a heading</h2>', '2026-09-13T00:00:00.000Z', null),
    /readable paragraphs/,
  );
});
