import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { pino } from 'pino';
import { createApp } from '../src/app.js';

const SECRET = 'verify-secret';
let server: Server;
let base = '';
const logged: Record<string, unknown>[] = [];

before(async () => {
  // verify_identity is signed; record_agreement has no secret, so it is not verified.
  server = createServer(
    createApp({ port: 0, secrets: { verify_identity: SECRET } }, pino({ level: 'debug' }, { write: (s: string) => logged.push(JSON.parse(s)) })),
  );
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

function call(path: string, body: object, secret?: string) {
  const raw = JSON.stringify(body);
  const t = Math.floor(Date.now() / 1000);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret)
    headers['X-Studio-Signature'] =
      `t=${t},v1=${createHmac('sha256', secret).update(`${t}.POST.${path}.${raw}`).digest('hex')}`;
  return fetch(base + path, { method: 'POST', headers, body: raw }).then(async (r) => ({
    status: r.status,
    body: (await r.json()) as Record<string, unknown>,
  }));
}

test('a verified caller starts negotiation', async () => {
  const r = await call('/verify_identity', { account_last4: '4321', zip: '02139' }, SECRET);
  assert.equal(r.status, 200);
  assert.equal(r.body.verified, true);
  assert.deepEqual(r.body.actions, { situation: 'negotiation' });
});

test('a wrong ZIP code starts nothing', async () => {
  const r = await call('/verify_identity', { account_last4: '4321', zip: '90210' }, SECRET);
  assert.equal(r.body.verified, false);
  assert.equal(r.body.actions, undefined);
});

test('an unsigned request to a signed tool is refused', async () => {
  const r = await call('/verify_identity', { account_last4: '4321', zip: '02139' });
  assert.equal(r.status, 401);
});

test('an agreement resolves negotiation; one below the minimum leaves it active', async () => {
  const ok = await call('/record_agreement', { plan: '3_payments', monthly_amount: 450 });
  assert.equal(ok.body.recorded, true);
  assert.deepEqual(ok.body.actions, { resolve_situation: 'negotiation' });
  const low = await call('/record_agreement', { plan: '6_payments', monthly_amount: 10 });
  assert.equal(low.body.recorded, false);
  assert.equal(low.body.actions, undefined);
});

test('an unknown path is a 404', async () => {
  assert.equal((await call('/nope', {})).status, 404);
  // Names inherited from Object.prototype are not tools.
  for (const p of ['/constructor', '/hasOwnProperty', '/__proto__']) assert.equal((await call(p, {})).status, 404);
});

test('at debug level each request and its response are logged in full', async () => {
  logged.length = 0;
  await call('/record_agreement', { plan: 'full' });
  const received = logged.find((l) => l.msg === 'received');
  const sent = logged.find((l) => l.msg === 'sent');
  assert.equal(received?.body, JSON.stringify({ plan: 'full' }));
  assert.equal(sent?.status, 200);
  assert.equal((sent?.body as Record<string, unknown>).recorded, true);
});
