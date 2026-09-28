/* OMMA · Velox dispatch — reductor de operaciones compartidas.
   El mismo código corre en el navegador (aplicación optimista) y en la Netlify Function
   (fuente de verdad). Cada operación lleva un id: repetirla no la aplica dos veces. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DispatchReducer = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_LOG = 300, MAX_OPIDS = 600, MAX_STAGE = 600, MAX_LOADS = 4000;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nowISO(t) { return new Date(t == null ? Date.now() : t).toISOString(); }
  function str(v, n) { return String(v == null ? '' : v).slice(0, n || 60); }
  const SLOT_RE = /^[A-Za-z0-9]{2,8}-\d{1,5}$/;

  function emptyState() {
    return { schema: 1, v: 0, config: null, asg: {}, stage: [], omma: { loads: [], meta: null }, log: [], opIds: [], updatedAt: null };
  }

  function pushLog(state, e) {
    state.log.push(e);
    if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
  }

  /* Validación mínima de configuración: evita que un cliente corrupto rompa a todos. */
  function validConfig(c) {
    if (!c || typeof c !== 'object') return false;
    if (!c.job || !(+c.job.totalStages > 0) || +c.job.totalStages > 2000) return false;
    if (!Array.isArray(c.sands) || !c.sands.length || c.sands.length > 12) return false;
    if (!Array.isArray(c.segments) || !c.segments.length || c.segments.length > 60) return false;
    if (!Array.isArray(c.carriers) || !c.carriers.length || c.carriers.length > 12) return false;
    if (!c.schedule || typeof c.schedule !== 'object') return false;
    return JSON.stringify(c).length < 60000;
  }

  function loadKey(l) { return l.k || (l.n + '|' + (l.tk || '') + '|' + (l.m || l.t || '')); }

  function apply(state, ops) {
    state = state ? clone(state) : emptyState();
    state.asg = state.asg || {};
    state.stage = state.stage || [];
    state.omma = state.omma || { loads: [], meta: null };
    state.log = state.log || [];
    state.opIds = state.opIds || [];
    const seen = new Set(state.opIds);
    const applied = [];
    (ops || []).forEach(op => {
      if (!op || typeof op !== 'object' || !op.type) return;
      if (op.id && seen.has(op.id)) return;
      const t = op.t || nowISO();
      const by = str(op.by, 24);
      let ok = true;
      switch (op.type) {
        case 'init':
          if (op.state && (!state.config || op.force)) {
            const keepLog = state.log;
            state = Object.assign(emptyState(), clone(op.state));
            state.log = keepLog.concat(state.log || []);
            state.opIds = Array.from(seen);
            pushLog(state, { t, type: 'init', by });
          } else ok = false;
          break;
        case 'asg':
          if (!SLOT_RE.test(op.slot || '')) { ok = false; break; }
          state.asg[op.slot] = { c: str(op.c, 20), t, by };
          pushLog(state, { t, type: 'asg', slot: op.slot, c: str(op.c, 20), by });
          break;
        case 'unasg':
          if (!state.asg[op.slot]) { ok = false; break; }
          pushLog(state, { t, type: 'unasg', slot: op.slot, c: state.asg[op.slot].c, by });
          delete state.asg[op.slot];
          break;
        case 'setc':
          if (!state.asg[op.slot]) { ok = false; break; }
          pushLog(state, { t, type: 'setc', slot: op.slot, c: str(op.c, 20), from: state.asg[op.slot].c, by });
          state.asg[op.slot].c = str(op.c, 20);
          break;
        case 'bulk':
          (op.items || []).slice(0, 500).forEach(it => {
            if (!SLOT_RE.test(it.slot || '')) return;
            state.asg[it.slot] = { c: str(it.c, 20), t: it.t || t, by };
          });
          pushLog(state, { t, type: 'bulk', n: (op.items || []).length, c: op.items && op.items[0] ? str(op.items[0].c, 20) : '', by, txt: str(op.txt, 120) });
          break;
        case 'stage': {
          const n = Math.round(+op.n);
          if (!(n >= 0 && n <= 2000)) { ok = false; break; }
          const rt = op.at || t;
          state.stage.push({ id: op.id || ('s' + Date.now()), n, t: rt, by });
          state.stage.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
          if (state.stage.length > MAX_STAGE) state.stage.splice(0, state.stage.length - MAX_STAGE);
          pushLog(state, { t, type: 'stage', n, at: rt, by });
          break;
        }
        case 'stageDel': {
          const i = state.stage.findIndex(r => r.id === op.rid);
          if (i < 0) { ok = false; break; }
          pushLog(state, { t, type: 'stageDel', n: state.stage[i].n, by });
          state.stage.splice(i, 1);
          break;
        }
        case 'cfg':
          if (!validConfig(op.config)) { ok = false; break; }
          state.config = clone(op.config);
          pushLog(state, { t, type: 'cfg', by, txt: str(op.txt, 140) });
          break;
        case 'omma': {
          const incoming = (op.loads || []).slice(0, MAX_LOADS).filter(l => l && typeof l === 'object');
          let loads;
          if (op.mode === 'replace') loads = incoming;
          else {
            const map = new Map();
            (state.omma.loads || []).forEach(l => map.set(loadKey(l), l));
            incoming.forEach(l => map.set(loadKey(l), l));
            loads = Array.from(map.values());
          }
          loads.sort((a, b) => (a.d || a.a || 0) - (b.d || b.a || 0));
          if (loads.length > MAX_LOADS) loads = loads.slice(loads.length - MAX_LOADS);
          state.omma = { loads, meta: Object.assign({}, op.meta || {}, { at: Date.parse(t) || Date.now(), by }) };
          pushLog(state, { t, type: 'omma', n: incoming.length, total: loads.length, by, txt: str(op.meta && op.meta.file, 90) });
          break;
        }
        case 'ommaClear':
          state.omma = { loads: [], meta: null };
          pushLog(state, { t, type: 'ommaClear', by });
          break;
        case 'resetAsg':
          pushLog(state, { t, type: 'resetAsg', n: Object.keys(state.asg).length, by });
          state.asg = {};
          break;
        case 'reseed': {
          /* punto de partida nuevo del pozo: diseño + palomitas base. Conserva loads OMMA y reportes. */
          if (!validConfig(op.config) || !op.asg || typeof op.asg !== 'object') { ok = false; break; }
          if ((+state.seedRev || 0) >= (+op.rev || 0)) { ok = false; break; }   // ya está en esa versión: dos clientes a la vez no lo aplican dos veces
          const asg = {};
          Object.keys(op.asg).slice(0, 5000).forEach(k => {
            const a = op.asg[k];
            if (SLOT_RE.test(k) && a && typeof a === 'object') asg[k] = { c: str(a.c, 20), t: a.t || t, by: str(a.by, 24) };
          });
          state.config = clone(op.config);
          state.asg = asg;
          state.seedRev = +op.rev || 0;
          pushLog(state, { t, type: 'reseed', n: Object.keys(asg).length, by, txt: str(op.txt, 140) });
          break;
        }
        default:
          ok = false;
      }
      if (op.id) { seen.add(op.id); state.opIds.push(op.id); }
      if (ok) applied.push(op.id || op.type);
    });
    if (state.opIds.length > MAX_OPIDS) state.opIds.splice(0, state.opIds.length - MAX_OPIDS);
    return { state, applied };
  }

  return { apply, emptyState, validConfig, clone, loadKey };
});
