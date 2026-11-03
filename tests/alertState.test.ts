import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatChatAlert, readSentAlerts } from '../src/services/alertState.ts';

test('chat alert text is plain and tells the user to verify the notice', () => {
  const text = formatChatAlert('Followed tender closes soon', 'Road repair closes 1 Dec');
  assert.match(text, /^Deadline reminder: Followed tender closes soon/);
  assert.match(text, /Verify on the source notice before bidding/);
  assert.doesNotMatch(text, /<[a-z]/i);
});

test('sent-alert state is empty when no browser storage exists', () => {
  assert.deepEqual(readSentAlerts(), []);
});
