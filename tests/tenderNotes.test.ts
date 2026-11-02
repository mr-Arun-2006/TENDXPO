import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyNotes, parseNotes, serializeNotes, buildFollowedCsv, MAX_NOTES_CHARS } from '../src/services/tenderNotes.ts';

test('notes round-trip through storage', () => {
  const n = { ...emptyNotes(), partner: 'Acme JV', bankGuaranteeAmount: '5 lakh', customFields: [{ label: 'Site visit', value: 'Yes' }], remarks: 'Check BG validity' };
  const back = parseNotes(serializeNotes(n));
  assert.deepEqual(back, n);
});

test('old plain-text notes are kept as remarks', () => {
  assert.equal(parseNotes('call the PWD office').remarks, 'call the PWD office');
});

test('corrupt or empty stored notes give empty notes', () => {
  assert.deepEqual(parseNotes(undefined), emptyNotes());
  assert.equal(parseNotes('{not json').remarks, '{not json');
});

test('custom fields are capped at four', () => {
  const n = { ...emptyNotes(), customFields: Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, value: 'v' })) };
  assert.equal(parseNotes(serializeNotes(n)).customFields.length, 4);
});

test('oversized notes are refused rather than silently truncated', () => {
  const n = { ...emptyNotes(), remarks: 'x'.repeat(600), customFields: [0, 1, 2, 3].map(() => ({ label: 'a'.repeat(60), value: 'b'.repeat(300) })) };
  assert.throws(() => serializeNotes(n), /too long to save/);
});

test('moderately long notes are saved in full', () => {
  const n = { ...emptyNotes(), remarks: 'x'.repeat(600) };
  assert.equal(parseNotes(serializeNotes(n)).remarks.length, 600);
});

test('CSV escapes quotes and keeps one row per tender', () => {
  const csv = buildFollowedCsv([
    { refNumber: 'R1', title: 'Road "A" repair', authority: 'PWD', portal: 'TED', budget: '100', currency: 'EUR', submissionDeadline: '2026-12-01', sourceUrl: 'https://x', notes: { ...emptyNotes(), remarks: 'line1, line2' } },
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 2);
  assert.match(lines[1], /"Road ""A"" repair"/);
  assert.match(lines[1], /"line1, line2"/);
});
