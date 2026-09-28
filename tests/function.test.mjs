/* Prueba de la Netlify Function con un store en memoria que imita a @netlify/blobs
   (lecturas con etag y escrituras condicionales onlyIfMatch / onlyIfNew). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { handle } from '../netlify/functions/state.mjs';
const require = createRequire(import.meta.url);
const Seed = require('../public/assets/js/seed.js');

function memStore() {
  let entry = null, n = 0, conflicts = 0;
  return {
    get conflicts() { return conflicts; },
    async getWithMetadata() { return entry ? { data: JSON.parse(JSON.stringify(entry.data)), etag: entry.etag, metadata: {} } : null; },
    async setJSON(key, data, opts = {}) {
      if (opts.onlyIfNew && entry) { conflicts++; return { modified: false }; }
      if (opts.onlyIfMatch && (!entry || entry.etag !== opts.onlyIfMatch)) { conflicts++; return { modified: false }; }
      entry = { data: JSON.parse(JSON.stringify(data)), etag: '"e' + (++n) + '"' };
      return { modified: true, etag: entry.etag };
    }
  };
}
const post = ops => new Request('https://x/api/state', { method: 'POST', body: JSON.stringify({ ops }) });
const get = () => new Request('https://x/api/state');

test('GET vacío, init, asignaciones y caché purgado', async () => {
  const store = memStore();
  let purges = 0;
  const purge = async () => { purges++; };
  let r = await handle(get(), store, purge);
  let b = await r.json();
  assert.equal(r.status, 200);
  assert.equal(b.state, null);
  assert.match(r.headers.get('netlify-cdn-cache-control'), /durable/);
  assert.equal(r.headers.get('netlify-cache-tag'), 'dispatch-state');

  r = await handle(post([{ id: 'x1', type: 'asg', slot: '100M-001', c: 'OMMA' }]), store, purge);
  assert.equal(r.status, 409, 'sin init no se escribe');

  r = await handle(post([{ id: 'i', type: 'init', state: Seed.initialState() }]), store, purge);
  b = await r.json();
  assert.equal(b.v, 1);
  r = await handle(post([{ id: 'a1', type: 'asg', slot: '100M-001', c: 'OMMA', by: 'AR' }]), store, purge);
  b = await r.json();
  assert.equal(b.v, 2);
  assert.equal(b.state.asg['100M-001'].c, 'OMMA');
  assert.equal(purges, 2);
  // reintento de la misma operación: no sube versión ni purga
  r = await handle(post([{ id: 'a1', type: 'asg', slot: '100M-001', c: 'OMMA' }]), store, purge);
  b = await r.json();
  assert.equal(b.v, 2);
  assert.equal(purges, 2);
  r = await handle(get(), store, purge);
  assert.equal(r.headers.get('etag'), '"v2"');
});

test('escrituras concurrentes: ninguna se pierde', async () => {
  const store = memStore();
  const purge = async () => {};
  const init = Seed.initialState(); init.asg = {};
  await handle(post([{ id: 'i', type: 'init', state: init }]), store, purge);
  const ids = Array.from({ length: 12 }, (_, i) => '2040-' + String(i + 1).padStart(3, '0'));
  await Promise.all(ids.map((slot, i) => handle(post([{ id: 'c' + i, type: 'asg', slot, c: i % 2 ? 'C2' : 'OMMA' }]), store, purge)));
  const b = await (await handle(get(), store, purge)).json();
  assert.equal(Object.keys(b.state.asg).length, 12);
  assert.equal(b.v, 13);
});

test('errores de entrada', async () => {
  const store = memStore();
  const purge = async () => {};
  let r = await handle(new Request('https://x/api/state', { method: 'POST', body: '{bad' }), store, purge);
  assert.equal(r.status, 400);
  r = await handle(new Request('https://x/api/state', { method: 'DELETE' }), store, purge);
  assert.equal(r.status, 405);
});
