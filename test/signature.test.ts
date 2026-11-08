import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifySignature } from '../src/signature.js';

const sign = (secret: string, t: number, path: string, body: string) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.POST.${path}.${body}`).digest('hex')}`;

const NOW = 1_800_000_000;

test('accepts a request signed with the right secret', () => {
  assert.ok(verifySignature('s', sign('s', NOW, '/x', '{}'), 'POST', '/x', '{}', NOW));
});

test('rejects the wrong secret, a changed body, or no header', () => {
  assert.ok(!verifySignature('s', sign('other', NOW, '/x', '{}'), 'POST', '/x', '{}', NOW));
  assert.ok(!verifySignature('s', sign('s', NOW, '/x', '{}'), 'POST', '/x', '{"a":1}', NOW));
  assert.ok(!verifySignature('s', undefined, 'POST', '/x', '{}', NOW));
});

test('rejects a timestamp more than 300 seconds away', () => {
  assert.ok(!verifySignature('s', sign('s', NOW - 301, '/x', '{}'), 'POST', '/x', '{}', NOW));
});
