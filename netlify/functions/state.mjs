/* OMMA · Velox dispatch — shared dispatch state.
   GET  /api/state  → full state (cached on the Netlify CDN, purged on every write)
   POST /api/state  → {ops:[…]} applies operations with an etag-conditional write.

   Why the cache: 6–8 dispatchers polling every 15 s through a 24/7 frac would be hundreds of
   thousands of invocations a month. With the CDN, unchanged polls never invoke the function;
   every write purges the tag and the next poll brings the new state. */
import { getStore } from '@netlify/blobs';
import { purgeCache } from '@netlify/functions';
import Reducer from '../../public/assets/js/reducer.js';

const STORE = 'omma-velox-dispatch';
const KEY = 'state';
const TAG = 'dispatch-state';
const MAX_BODY = 1_500_000;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Testable core: the store and the purge function are injected. */
export async function handle(req, store, purge) {
  if (req.method === 'GET') {
    const cur = await store.getWithMetadata(KEY, { type: 'json' });
    const state = cur ? cur.data : null;
    const v = state && state.v ? state.v : 0;
    return json({ ok: true, v, state }, 200, {
      'cache-control': 'public, max-age=0, must-revalidate',
      'netlify-cdn-cache-control': 'public, durable, s-maxage=60',
      'netlify-cache-tag': TAG,
      etag: `"v${v}"`
    });
  }

  if (req.method === 'POST') {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({ ok: false, error: 'Payload too large' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
    const ops = Array.isArray(body && body.ops) ? body.ops.slice(0, 300) : [];
    if (!ops.length) return json({ ok: false, error: 'No operations' }, 400);

    for (let attempt = 0; attempt < 7; attempt++) {
      const cur = await store.getWithMetadata(KEY, { type: 'json' });
      const base = cur ? cur.data : null;
      const { state, applied } = Reducer.apply(base, ops);
      if (!state.config) {
        return json({ ok: false, error: 'Shared state is not initialized' }, 409);
      }
      if (!applied.length && base) {
        return json({ ok: true, v: base.v || 0, state: base, applied });
      }
      state.v = ((base && base.v) || 0) + 1;
      state.updatedAt = new Date().toISOString();
      const res = cur
        ? await store.setJSON(KEY, state, { onlyIfMatch: cur.etag })
        : await store.setJSON(KEY, state, { onlyIfNew: true });
      if (res && res.modified) {
        try { await purge(); } catch (e) { console.warn('[state] cache purge failed:', e && e.message); }
        return json({ ok: true, v: state.v, state, applied });
      }
      await sleep(40 + Math.random() * 160 * (attempt + 1));   // another dispatcher wrote first
    }
    return json({ ok: false, error: 'Write conflict, retry' }, 409);
  }

  return json({ ok: false, error: 'Method not allowed' }, 405, { allow: 'GET, POST' });
}

export default async (req) => {
  const store = getStore({ name: STORE, consistency: 'strong' });
  return handle(req, store, () => purgeCache({ tags: [TAG] }));
};

export const config = { path: '/api/state' };
