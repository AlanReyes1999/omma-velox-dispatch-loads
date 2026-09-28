/* OMMA · Velox dispatch — reducer for shared operations.
   The same code runs in the browser (optimistic apply) and in the Netlify Function
   (source of truth). Every operation carries an id: replaying it never applies it twice. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DispatchReducer = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_LOG = 300, MAX_OPIDS = 600, MAX_STAGE = 600, MAX_LOADS = 4000;
  /* operations that count as someone's work (used to decide whether a starting point may replace state) */
  const USER_OPS = ['asg', 'unasg', 'setc', 'bulk', 'unbulk', 'stage', 'stageDel', 'cfg', 'omma', 'ommaClear', 'resetAsg', 'fc', 'fcClear'];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nowISO(t) { return new Date(t == null ? Date.now() : t).toISOString(); }
  function str(v, n) { return String(v == null ? '' : v).slice(0, n || 60); }
  /* a client time is accepted only as a short, parseable date string; anything else becomes "now" */
  function when(v, fallback) { if (typeof v === 'string' && v.length <= 40) { const t = Date.parse(v); if (isFinite(t)) return new Date(t).toISOString(); } return fallback; }
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const SLOT_RE = /^[A-Za-z0-9]{2,8}-\d{1,5}$/;
  const PATCH_RE = /^(config|omma\.meta)(\.[A-Za-z0-9_]{1,40}){1,4}$/;
  const BAD_KEY = /^(__proto__|constructor|prototype)$/;

  function emptyState() {
    return { schema: 1, v: 0, config: null, asg: {}, ord: 0, stage: [], fc: null, omma: { loads: [], meta: null }, log: [], opIds: [], updatedAt: null };
  }
  /* has anyone worked since the last full starting point was loaded? A patch keeps everyone's work,
     so it does not start the count again: work from before a patch still counts. */
  function workedSinceReseed(log) {
    let since = 0;
    (log || []).forEach((e, i) => { if (e && e.type === 'reseed' && e.patch == null) since = i + 1; });
    return (log || []).slice(since).some(e => e && USER_OPS.includes(e.type));
  }

  function pushLog(state, e) {
    state.log.push(e);
    if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
  }

  /* Config validation: one broken client (or a hand-made request) must not break everyone. */
  const ID_RE = /^[A-Za-z0-9_]{1,16}$/;
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const isNum = v => typeof v === 'number' && isFinite(v);
  const okStr = (v, n) => v == null || (typeof v === 'string' && v.length <= (n || 80));
  function validTz(z) {
    if (typeof z !== 'string' || !z || z.length > 64) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch (e) { return false; }
  }
  function validConfig(c) {
    if (!isObj(c)) return false;
    if (JSON.stringify(c).length >= 60000) return false;
    if (!isObj(c.job) || !(+c.job.totalStages >= 1) || +c.job.totalStages > 2000 || !okStr(c.job.well) || !okStr(c.job.client)) return false;
    if (c.tz != null && !validTz(c.tz)) return false;
    if (!Array.isArray(c.mines) || !c.mines.length || c.mines.length > 12) return false;
    if (!c.mines.every(m => isObj(m) && typeof m.id === 'string' && ID_RE.test(m.id) && okStr(m.name) && okStr(m.place) && (m.match == null || (Array.isArray(m.match) && m.match.length <= 12 && m.match.every(x => okStr(x, 60)))))) return false;
    const mineIds = new Set(c.mines.map(m => m.id));
    if (!Array.isArray(c.sands) || !c.sands.length || c.sands.length > 12) return false;
    if (!c.sands.every(s => isObj(s) && typeof s.id === 'string' && ID_RE.test(s.id) && typeof s.label === 'string' && s.label.length <= 40 && mineIds.has(s.mine))) return false;
    if (!Array.isArray(c.segments) || !c.segments.length || c.segments.length > 60) return false;
    if (!c.segments.every(g => isObj(g) && isNum(+g.from) && isNum(+g.to) && +g.pace > 0 && +g.pace <= 200 && (g.lbs == null || isObj(g.lbs)) && (g.trucks == null || isObj(g.trucks)) &&
      (g.drivers == null || (isNum(+g.drivers) && +g.drivers >= 0 && +g.drivers <= 5000)))) return false;
    if (!Array.isArray(c.carriers) || !c.carriers.length || c.carriers.length > 12) return false;
    if (!c.carriers.every(x => isObj(x) && typeof x.id === 'string' && ID_RE.test(x.id) && typeof x.name === 'string' && x.name.length <= 40)) return false;
    if (!isObj(c.schedule) || !okStr(c.schedule.prefillStart, 20) || !okStr(c.schedule.prefillEnd, 20) || !okStr(c.schedule.fracStart, 20)) return false;
    if (c.po != null && (!isObj(c.po) || !Object.keys(c.po).every(k => okStr(c.po[k], 40)))) return false;
    if (c.finalCountsPct != null && !(+c.finalCountsPct >= 1 && +c.finalCountsPct <= 100)) return false;
    if (c.drivers != null && (!isObj(c.drivers) || ['shiftH', 'maxH'].some(k => c.drivers[k] != null && !(+c.drivers[k] >= 4 && +c.drivers[k] <= 16)))) return false;
    return true;
  }

  function loadKey(l) { return l.k || (l.n + '|' + (l.tk || '') + '|' + (l.m || l.t || '')); }
  /* OMMA loads keep only the fields the calculation and the queue use — never a driver's name,
     whatever a client sends */
  const LOAD_STR = { k: 80, n: 20, p: 60, s: 8, m: 16, t: 80, tr: 20, wl: 80, c: 40, po: 40, tk: 40 };
  const LOAD_NUM = ['mi', 'w', 'tm', 'tx', 'td', 'a', 'd'];
  function cleanLoad(l) {
    if (!l || typeof l !== 'object' || Array.isArray(l)) return null;
    const o = {};
    Object.keys(LOAD_STR).forEach(k => { if (l[k] != null) o[k] = str(l[k], LOAD_STR[k]); });
    LOAD_NUM.forEach(k => { if (l[k] != null) o[k] = isFinite(+l[k]) ? +l[k] : null; });
    return o.s ? o : null;
  }

  /* One field of a seed patch: it only changes when it still holds the old value (`from`),
     so whatever dispatch already edited is left alone. */
  function valueAt(roots, path) {
    if (typeof path !== 'string' || !PATCH_RE.test(path)) return undefined;
    const ks = path.split('.');
    if (ks.some(k => BAD_KEY.test(k))) return undefined;
    let o, i;
    if (ks[0] === 'config') { o = roots.config; i = 1; } else { o = roots.meta; i = 2; }
    for (; i < ks.length; i++) {
      if (!o || typeof o !== 'object' || !Object.prototype.hasOwnProperty.call(o, ks[i])) return undefined;
      o = o[ks[i]];
    }
    return o;
  }
  /* p.when: [{path, eq}] — the field only changes if those fields still hold those values */
  function applyPatch(roots, p) {
    if (!p || typeof p.path !== 'string' || !PATCH_RE.test(p.path)) return false;
    if (p.when != null && (!Array.isArray(p.when) || !p.when.slice(0, 6).every(w => w && String(valueAt(roots, w.path)) === String(w.eq)))) return false;
    const ks = p.path.split('.');
    if (ks.some(k => BAD_KEY.test(k))) return false;
    let o, i;
    if (ks[0] === 'config') { o = roots.config; i = 1; } else { o = roots.meta; i = 2; }
    for (; i < ks.length - 1; i++) {
      if (!o || typeof o !== 'object' || !Object.prototype.hasOwnProperty.call(o, ks[i])) return false;
      o = o[ks[i]];
    }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    const last = ks[ks.length - 1];
    if (BAD_KEY.test(last)) return false;
    const cur = Object.prototype.hasOwnProperty.call(o, last) ? o[last] : undefined;
    const match = cur === p.from || (p.from === '' && (cur == null || cur === ''));
    if (!match) return false;
    o[last] = (typeof p.to === 'number' && isFinite(p.to)) ? p.to : str(p.to, 200);
    return true;
  }

  function apply(state, ops) {
    state = state ? clone(state) : emptyState();
    state.asg = state.asg || {};
    state.stage = state.stage || [];
    state.omma = state.omma || { loads: [], meta: null };
    state.log = state.log || [];
    state.opIds = state.opIds || [];
    if (state.fc === undefined) state.fc = null;
    state.ord = +state.ord || 0;
    const seen = new Set(state.opIds);
    const applied = [];
    (ops || []).forEach(op => {
      if (!op || typeof op !== 'object' || typeof op.type !== 'string') return;
      if (op.id != null && (typeof op.id !== 'string' || op.id.length > 80)) return;
      if (op.id && seen.has(op.id)) return;
      const t = when(op.t, nowISO());
      const by = str(op.by, 24);
      let ok = true;
      switch (op.type) {
        case 'init':
          /* seeds an empty store only; never replaces live state */
          if (op.state && typeof op.state === 'object' && !state.config && validConfig(op.state.config)) {
            const keepLog = state.log;
            state = Object.assign(emptyState(), clone(op.state));
            state.log = keepLog.concat(state.log || []);
            state.opIds = Array.from(seen);
            pushLog(state, { t, type: 'init', by });
          } else ok = false;
          break;
        case 'asg': {
          if (typeof op.slot !== 'string' || !SLOT_RE.test(op.slot)) { ok = false; break; }
          /* o = order in which the shared state received the assignment: the load number follows it, so a
             dispatcher's clock or an offline queue can never renumber loads everyone already saw.
             An undo may put a load back at its old place (o not beyond the counter). */
          const back = +op.o > 0 && +op.o <= state.ord && Number.isInteger(+op.o) ? +op.o : 0;
          state.asg[op.slot] = { c: str(op.c, 20), t, by, o: back || ++state.ord };
          pushLog(state, { t, type: 'asg', slot: op.slot, c: str(op.c, 20), by });
          break;
        }
        case 'unasg':
          if (typeof op.slot !== 'string' || !SLOT_RE.test(op.slot) || !own(state.asg, op.slot)) { ok = false; break; }
          pushLog(state, { t, type: 'unasg', slot: op.slot, c: state.asg[op.slot].c, by });
          delete state.asg[op.slot];
          break;
        case 'setc':
          if (typeof op.slot !== 'string' || !SLOT_RE.test(op.slot) || !own(state.asg, op.slot)) { ok = false; break; }
          pushLog(state, { t, type: 'setc', slot: op.slot, c: str(op.c, 20), from: state.asg[op.slot].c, by });
          state.asg[op.slot].c = str(op.c, 20);
          break;
        case 'bulk': {
          let n = 0;
          (Array.isArray(op.items) ? op.items : []).slice(0, 500).forEach(it => {
            if (!it || typeof it.slot !== 'string' || !SLOT_RE.test(it.slot)) return;
            state.asg[it.slot] = { c: str(it.c, 20), t: when(it.t, t), by, o: ++state.ord };
            n++;
          });
          if (!n) { ok = false; break; }
          pushLog(state, { t, type: 'bulk', n, c: op.items && op.items[0] ? str(op.items[0].c, 20) : '', by, txt: str(op.txt, 120) });
          break;
        }
        case 'unbulk': {
          /* undo of a range assignment: removes those slots in one step */
          let n = 0;
          (Array.isArray(op.slots) ? op.slots : []).slice(0, 500).forEach(s => { if (typeof s === 'string' && SLOT_RE.test(s) && own(state.asg, s)) { delete state.asg[s]; n++; } });
          if (!n) { ok = false; break; }
          pushLog(state, { t, type: 'unbulk', n, by, txt: str(op.txt, 120) });
          break;
        }
        case 'stage': {
          const n = Math.round(+op.n);
          if (!(n >= 0 && n <= 2000)) { ok = false; break; }
          const rt = when(op.at, t);
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
        case 'fc': {
          /* final counts: someone confirmed the remaining loads with the frac crew */
          const n = Math.max(0, Math.round(+op.n || 0));
          state.fc = { t, by, n, note: str(op.note, 120) };
          pushLog(state, { t, type: 'fc', n, by, txt: str(op.note, 120) });
          break;
        }
        case 'fcClear':
          if (!state.fc) { ok = false; break; }
          state.fc = null;
          pushLog(state, { t, type: 'fcClear', by });
          break;
        case 'cfg':
          if (!validConfig(op.config)) { ok = false; break; }
          /* keeps the queue usable: a config that the engine cannot read is refused */
          state.config = clone(op.config);
          pushLog(state, { t, type: 'cfg', by, txt: str(op.txt, 140) });
          break;
        case 'omma': {
          const incoming = (Array.isArray(op.loads) ? op.loads : []).slice(0, MAX_LOADS).map(cleanLoad).filter(Boolean);
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
          const m = op.meta && typeof op.meta === 'object' ? op.meta : {};
          state.omma = { loads, meta: { file: str(m.file, 200), rows: isFinite(+m.rows) ? +m.rows : null, format: str(m.format, 60), at: Date.parse(t) || Date.now(), by } };
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
          state.fc = null;
          break;
        case 'reseed': {
          /* new well starting point. Once per revision: two clients at once never apply it twice.
             An automatic op (auto) is decided HERE, against the live state, not by the client that sent it:
             · nobody has worked since the last starting point → full starting point
             · someone has and the state is on the patch's revision (from) → non-destructive patch
             · otherwise → refused (the app asks a person to confirm, and only then sends a full op) */
          if ((+state.seedRev || 0) >= (+op.rev || 0)) { ok = false; break; }
          let usePatch = Array.isArray(op.patch) && !op.config;
          if (op.auto) {
            const worked = workedSinceReseed(state.log);
            if (!worked && op.config) usePatch = false;
            else if (worked && Array.isArray(op.patch) && (+state.seedRev || 0) === (+op.from || 0)) usePatch = true;
            else { ok = false; break; }
          }
          if (usePatch) {
            /* non-destructive: only fields that still hold the old seed value change; check marks stay */
            if (!state.config) { ok = false; break; }
            const cfg = clone(state.config);
            const meta = state.omma && state.omma.meta ? clone(state.omma.meta) : null;
            let n = 0;
            op.patch.slice(0, 40).forEach(p => { if (applyPatch({ config: cfg, meta }, p)) n++; });
            if (!validConfig(cfg)) { ok = false; break; }
            state.config = cfg;
            if (meta) state.omma.meta = meta;
            state.seedRev = +op.rev || 0;
            pushLog(state, { t, type: 'reseed', n: 0, patch: n, by, txt: str(op.patchTxt || op.txt, 140) });
            break;
          }
          /* full: design + baseline check marks. Keeps OMMA loads and stage reports. */
          if (!validConfig(op.config) || !op.asg || typeof op.asg !== 'object') { ok = false; break; }
          const asg = {};
          Object.keys(op.asg).slice(0, 5000).forEach(k => {
            const a = op.asg[k];
            if (SLOT_RE.test(k) && a && typeof a === 'object') asg[k] = { c: str(a.c, 20), t: when(a.t, t), by: str(a.by, 24) };
          });
          state.config = clone(op.config);
          state.asg = op.mode === 'merge' ? Object.assign(asg, state.asg) : asg;
          state.seedRev = +op.rev || 0;
          if (op.meta && typeof op.meta === 'object' && state.omma && state.omma.meta && typeof op.meta.file === 'string' && state.omma.meta.file === op.meta.from) state.omma.meta.file = str(op.meta.file, 200);
          pushLog(state, { t, type: 'reseed', n: Object.keys(state.asg).length, by, txt: str(op.txt, 140) });
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

  return { apply, emptyState, validConfig, clone, loadKey, applyPatch, workedSinceReseed, USER_OPS };
});
