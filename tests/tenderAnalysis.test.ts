import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeInput, buildAnalysisPrompt, parseAnalysis } from '../src/services/tenderAnalysis.ts';

const base = sanitizeInput({ title: 'Road repair', authority: 'PWD', currency: 'INR', budget: 5_000_000, submissionDeadline: '2026-12-01', description: 'Repair 2 km', scopeOfWork: 'Asphalt 800 t' });

test('sanitizeInput treats a missing or zero budget as not stated', () => {
  assert.equal(sanitizeInput({ title: 'x' }).budget, 0);
  assert.equal(sanitizeInput({ title: 'x', budget: 0 }).budget, 0);
  assert.equal(sanitizeInput({ title: 'x', budget: 'abc' }).budget, 0);
});

test('prompt tells the model not to invent values and states the budget source', () => {
  const p = buildAnalysisPrompt(base);
  assert.match(p, /Use ONLY the notice text/);
  assert.match(p, /5000000 INR/);
  const none = buildAnalysisPrompt(sanitizeInput({ title: 'x' }));
  assert.match(none, /NOT STATED/);
});

test('parses a fenced JSON reply and keeps the stated estimate from the notice', () => {
  const reply = '```json\n{"summary":"Road repair.","budget":{"lineItems":[{"item":"Asphalt","basis":"800 t","estimatedAmount":3000000,"assumption":"Rate per tonne"},{"item":"Labour","basis":"crew","estimatedAmount":null,"assumption":"no crew data"}],"contingencyPct":5,"notes":""},"dataGaps":["No crew size"]}\n```';
  const a = parseAnalysis(reply, base);
  assert.equal(a.summary, 'Road repair.');
  assert.equal(a.budget.statedEstimate, 5_000_000);
  assert.equal(a.budget.modelEstimateTotal, 3_000_000);
  assert.equal(a.budget.lineItems.length, 2);
  assert.equal(a.budget.lineItems[1].estimatedAmount, null);
  assert.deepEqual(a.dataGaps, ['No crew size']);
});

test('the model cannot overwrite the stated estimate', () => {
  const reply = '{"budget":{"lineItems":[],"contingencyPct":5},"summary":"x"}';
  const a = parseAnalysis(reply, sanitizeInput({ title: 'x' }));
  assert.equal(a.budget.statedEstimate, null);
  assert.equal(a.budget.modelEstimateTotal, null);
});

test('rejects replies with no JSON object', () => {
  assert.throws(() => parseAnalysis('Sorry, I cannot help.', base), /no JSON/);
});

test('out-of-range contingency falls back to 5%', () => {
  const a = parseAnalysis('{"budget":{"lineItems":[],"contingencyPct":90}}', base);
  assert.equal(a.budget.contingencyPct, 5);
});
