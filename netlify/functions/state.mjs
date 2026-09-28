/* OMMA · Velox dispatch — estado compartido de despacho.
   GET  /api/state  → estado completo (cacheado en el CDN de Netlify, se purga en cada escritura)
   POST /api/state  → {ops:[…]} aplica operaciones con escritura condicional por etag.

   Por qué el caché: 6–8 dispatchers consultando cada 15 s durante un frac 24/7 serían cientos
   de miles de invocaciones al mes. Con el CDN, las consultas sin cambios no invocan la función;
   cada escritura purga el tag y la siguiente consulta trae el estado nuevo. */
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

/* Núcleo testeable: recibe el store y la función de purga inyectados. */
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
    if (raw.length > MAX_BODY) return json({ ok: false, error: 'La carga es demasiado grande' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ ok: false, error: 'JSON inválido' }, 400); }
    const ops = Array.isArray(body && body.ops) ? body.ops.slice(0, 300) : [];
    if (!ops.length) return json({ ok: false, error: 'Sin operaciones' }, 400);

    for (let attempt = 0; attempt < 7; attempt++) {
      const cur = await store.getWithMetadata(KEY, { type: 'json' });
      const base = cur ? cur.data : null;
      const { state, applied } = Reducer.apply(base, ops);
      if (!state.config) {
        return json({ ok: false, error: 'El estado compartido no está inicializado' }, 409);
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
        try { await purge(); } catch (e) { console.warn('[state] purga de caché falló:', e && e.message); }
        return json({ ok: true, v: state.v, state, applied });
      }
      await sleep(40 + Math.random() * 160 * (attempt + 1));   // otro dispatcher escribió primero
    }
    return json({ ok: false, error: 'Conflicto de escritura, reintenta' }, 409);
  }

  return json({ ok: false, error: 'Método no permitido' }, 405, { allow: 'GET, POST' });
}

export default async (req) => {
  const store = getStore({ name: STORE, consistency: 'strong' });
  return handle(req, store, () => purgeCache({ tags: [TAG] }));
};

export const config = { path: '/api/state' };
