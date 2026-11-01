import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Import the Express app without opening a port (the same path Vercel uses).
process.env.VERCEL = '1';

let server: Server;
let base = '';

before(async () => {
  const { default: app } = await import('../server.js');
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

test('sources endpoint describes provenance honestly', async () => {
  const res = await fetch(`${base}/api/sources`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'success');
  assert.ok(body.sources.some((s: { id: string }) => s.id === 'ted'));
  assert.match(body.sampleDataNotice, /illustrative demo data/);
});

test('every tender is labelled live-ted or sample', async () => {
  const res = await fetch(`${base}/api/tenders`);
  assert.equal(res.status, 200);
  const body = await res.json();
  for (const t of body.tenders) {
    assert.ok(['live-ted', 'sample'].includes(t.dataSource), `unlabelled tender ${t.id}`);
  }
});

test('security headers are set on API responses', async () => {
  const res = await fetch(`${base}/api/sources`);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('write endpoints reject requests without a session', async () => {
  for (const path of ['/api/scrape-portal', '/api/cloud-functions/scraper-trigger']) {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 401, path);
  }
});
