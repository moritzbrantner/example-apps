import assert from 'node:assert/strict';
import test from 'node:test';

import { convert, formatNumber, parseNumericInput } from './conversions';

const closeTo = (actual: number, expected: number, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test('converts exact standardized length and mass units', () => {
  closeTo(convert(1, 'length', 'mile', 'kilometer'), 1.609344);
  closeTo(convert(1, 'mass', 'pound', 'kilogram'), 0.45359237);
});

test('converts affine temperature units', () => {
  closeTo(convert(32, 'temperature', 'fahrenheit', 'celsius'), 0);
  closeTo(convert(100, 'temperature', 'celsius', 'fahrenheit'), 212);
  closeTo(convert(273.15, 'temperature', 'kelvin', 'celsius'), 0);
});

test('converts common US volume and speed units', () => {
  closeTo(convert(1, 'volume', 'gallon-us', 'liter'), 3.785411784);
  closeTo(convert(100, 'speed', 'kilometer-hour', 'mile-hour'), 62.13711922373339);
});

test('parses decimal comma input and formats readable results', () => {
  assert.equal(parseNumericInput(' 1,5 '), 1.5);
  assert.equal(parseNumericInput('not-a-number'), null);
  assert.equal(formatNumber(1.609344), '1.609344');
  assert.equal(formatNumber(0), '0');
});
