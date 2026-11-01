import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTenderValue } from '../src/utils/formatters.ts';

test('formatTenderValue reports missing or zero values honestly', () => {
  assert.equal(formatTenderValue(0), 'Value not stated');
  assert.equal(formatTenderValue(Number.NaN), 'Value not stated');
});

test('formatTenderValue uses Indian units for INR', () => {
  assert.equal(formatTenderValue(12_500_000, 'INR'), '₹1.25 Cr');
  assert.equal(formatTenderValue(250_000, 'INR'), '₹2.50 Lakh');
});

test('formatTenderValue keeps the source currency for non-INR values', () => {
  assert.match(formatTenderValue(1000, 'EUR'), /€/);
});
