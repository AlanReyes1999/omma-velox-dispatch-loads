/* OMMA · Velox dispatch — calculation engine.
   Pure and dependency-free: runs the same in the browser (window.Engine) and in Node (tests).

   Model grain: ONE row = ONE load (slot) that has to be assigned to cover the well design.
   Slot k of a sand is "the k-th load of that sand on this well". Its identity never changes
   when the design changes: what gets recalculated is which stage it serves and when to assign it.

   Per-slot chain:
     lbs accumulated before the slot  →  well position where that sand starts being pumped (pos)
     pos − buffer stages              →  time the load has to be on location (nb)
     nb − mine lead time              →  assign-by time (ab)
   The prefill is the exception: those loads are spread across the prefill → frac start window. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
  const LBS_PER_TON = 2000;

  /* ============================== time zone ============================== */
  const _dtf = {};
  function dtfFor(tz) {
    if (!_dtf[tz]) {
      _dtf[tz] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short'
      });
    }
    return _dtf[tz];
  }
  function slowParts(epoch, tz) {
    const o = {};
    for (const p of dtfFor(tz).formatToParts(new Date(epoch))) o[p.type] = p.value;
    return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second };
  }
  /* The UTC offset only changes at a zone transition, and those fall on a quarter hour. So the offset
     is asked from Intl once per 15-minute bucket and cached; wall parts then come from plain UTC math.
     Intl.formatToParts on every slot was most of the model's build time. */
  const Q15 = 15 * 60e3, _off = new Map();
  function tzOffset(epoch, tz) {
    const qb = Math.floor(epoch / Q15);
    const key = tz + '|' + qb;
    let o = _off.get(key);
    if (o === undefined) {
      const t = qb * Q15, p = slowParts(t, tz);
      o = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - t;
      if (_off.size > 50000) _off.clear();
      _off.set(key, o);
    }
    return o;
  }
  const WDS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function wallParts(epoch, tz) {
    const d = new Date(epoch + tzOffset(epoch, tz));
    return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), wd: WDS[d.getUTCDay()] };
  }
  function wallToEpoch(y, mo, d, h, mi, s, tz) {
    const guess = Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0);
    const off = tzOffset(guess, tz);
    let t = guess - off;
    const off2 = tzOffset(t, tz);
    if (off2 !== off) t = guess - off2;
    return t;
  }
  /* Accepts: epoch · Date · ISO with zone · 'YYYY-MM-DD HH:mm' · 'M/D/YYYY H:mm[:ss] [AM|PM]' · Excel serial.
     Anything without a zone is read as wall time in `tz`. */
  function parseWall(v, tz) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : v.getTime();
    if (typeof v === 'number') {
      if (v > 1e11) return v;                               // epoch ms
      if (v > 20000 && v < 80000) {                         // Excel serial (days since 1899-12-30)
        const ms = Math.round((v - 25569) * DAY);
        const u = new Date(ms);
        return wallToEpoch(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds(), tz);
      }
      return null;
    }
    const s = String(v).trim();
    if (!s) return null;
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) && /\d{4}-\d{2}-\d{2}T/.test(s)) {
      const t = Date.parse(s);
      return isNaN(t) ? null : t;
    }
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) return wallToEpoch(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0), tz);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?)?$/i);
    if (m) {
      let y = +m[3]; if (y < 100) y += 2000;
      let h = +(m[4] || 0);
      const ap = (m[7] || '').toLowerCase().replace(/\./g, '');
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      return wallToEpoch(y, +m[1], +m[2], h, +(m[5] || 0), +(m[6] || 0), tz);
    }
    const t = Date.parse(s);
    return isNaN(t) ? null : t;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(epoch, tz) { const p = wallParts(epoch, tz); return p.y + '-' + pad2(p.mo) + '-' + pad2(p.d); }
  function toWallString(epoch, tz) {
    const p = wallParts(epoch, tz);
    return p.y + '-' + pad2(p.mo) + '-' + pad2(p.d) + 'T' + pad2(p.h) + ':' + pad2(p.mi);
  }
  /* Operating shift: Day = [start, start+12h) · Night = [start+12h, start+24h).
     Early morning belongs to the night of the previous operating day. */
  function shiftOf(epoch, tz, startHour) {
    const sh = startHour == null ? 6 : startHour;
    const p = wallParts(epoch, tz);
    const minOfDay = p.h * 60 + p.mi;
    const startMin = sh * 60;
    let base = epoch;
    if (minOfDay < startMin) base = epoch - DAY;       // early morning → previous operating day
    const bp = wallParts(base, tz);
    const opDay = bp.y + '-' + pad2(bp.mo) + '-' + pad2(bp.d);
    const rel = ((minOfDay - startMin) + 1440) % 1440;
    const shift = rel < 720 ? 'D' : 'N';
    const shiftStart = wallToEpoch(bp.y, bp.mo, bp.d, sh + (shift === 'N' ? 12 : 0), 0, 0, tz);
    return { key: opDay + '|' + shift, day: opDay, shift: shift, start: shiftStart };
  }

  /* ============================== normalization ============================== */
  function normText(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
  function normProduct(v) {
    const t = normText(v);
    if (!t) return null;
    const c = t.replace(/[^0-9a-z]/g, '');
    if (c.includes('4070')) return '4070';
    if (c.includes('2040')) return '2040';
    if (c.includes('3050')) return '3050';
    if (c.includes('4080')) return '4080';
    if (/(^|[^0-9])100([^0-9]|$)/.test(t) || c.startsWith('100m') || c.includes('100mesh')) return '100M';
    return null;
  }
  function normMine(v, mines) {
    const t = normText(v);
    if (!t) return null;
    for (const m of (mines || [])) {
      const keys = (m.match && m.match.length ? m.match : [m.name]).map(normText);
      if (keys.some(k => k && t.includes(k))) return m.id;
    }
    return null;
  }
  function parseDuration(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).toLowerCase().trim();
    if (!s || s === '-' || s === '—') return null;
    let tot = 0, hit = false, m;
    const re = /(\d+(?:\.\d+)?)\s*(d|h|m|s)/g;
    while ((m = re.exec(s))) {
      hit = true;
      const x = parseFloat(m[1]);
      tot += m[2] === 'd' ? x * 1440 : m[2] === 'h' ? x * 60 : m[2] === 'm' ? x : x / 60;
    }
    if (hit) return tot;
    const hm = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (hm) return (+hm[1]) * 60 + (+hm[2]) + (hm[3] ? (+hm[3]) / 60 : 0);
    return null;
  }

  /* ============================== statistics ============================== */
  function nums(a) { return a.filter(x => x != null && isFinite(x)); }
  function mean(a) { const v = nums(a); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; }
  function median(a) {
    const v = nums(a).slice().sort((x, y) => x - y);
    if (!v.length) return null;
    const h = Math.floor(v.length / 2);
    return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2;
  }
  function summary(a) { const v = nums(a); return { n: v.length, mean: mean(v), median: median(v), min: v.length ? Math.min.apply(null, v) : null, max: v.length ? Math.max.apply(null, v) : null }; }

  function isJobLoad(l, cfg) {
    const w = normText(cfg.job && cfg.job.well);
    return !w || normText(l.wl) === w;
  }

  /* Loading time ("At mine") base per mine, in minutes. It holds while the loads behind the statistic
     carry LOAD_BASE_MAX_N or fewer loading times; with more, the data median takes over.
     A numeric `loadMin` on the mine's config wins over this table. */
  const LOAD_BASE_MIN = { IRONOAK: 20 };
  const LOAD_BASE_MAX_N = 10;
  function loadBaseMin(mine) {
    const v = mine.loadMin;
    if ((typeof v === 'number' || typeof v === 'string') && +v > 0 && isFinite(+v)) return +v;
    return LOAD_BASE_MIN[mine.id] > 0 ? LOAD_BASE_MIN[mine.id] : null;
  }

  /* Statistics per mine and per sand from the OMMA loads.
     · payload: every load from that mine/sand (weight does not depend on the well)
     · times: only loads to THIS well (transit depends on the route); if none, all of them
     · at mine: the mine's loading-time base while the data is thin (LOAD_BASE_MIN)
     · on location: one general average for every mine, from the loads of all mines to this well
       (if none, all loads)
     · cycle: consecutive deliveries by the same truck from the same mine, with the next
       acceptance ≤ 3 h after delivering (continuous work)
     Each time (term, transit, dest) carries `value`: the minutes to show and chart for it. */
  function computeStats(loads, cfg) {
    const out = { mines: {}, sands: {}, n: loads.length, range: null };
    const ts = loads.map(l => l.d || l.a).filter(Boolean);
    if (ts.length) out.range = { from: Math.min.apply(null, ts), to: Math.max.apply(null, ts) };
    const W = loads.filter(l => isJobLoad(l, cfg));
    const dest = summary((W.length ? W : loads).map(l => l.td));
    dest.value = dest.mean;
    for (const mine of cfg.mines) {
      const L = loads.filter(l => l.m === mine.id);
      const J = L.filter(l => isJobLoad(l, cfg));
      const T = J.length ? J : L;
      const lead = T.map(l => (l.a && l.d && l.d > l.a && (l.d - l.a) < 2 * DAY) ? (l.d - l.a) / MIN : null);
      const cyc = [], idle = [];
      const byTruck = {};
      L.filter(l => l.tr && l.a && l.d).forEach(l => { (byTruck[l.tr] = byTruck[l.tr] || []).push(l); });
      Object.keys(byTruck).forEach(tr => {
        const a = byTruck[tr].sort((x, y) => x.a - y.a);
        for (let i = 0; i + 1 < a.length; i++) {
          const gap = a[i + 1].d - a[i].d, id = a[i + 1].a - a[i].d;
          if (gap > 0 && gap < DAY && id >= -30 * MIN && id <= 3 * HOUR) { cyc.push(gap / MIN); idle.push(Math.max(0, id) / MIN); }
        }
      });
      const term = summary(T.map(l => l.tm)), transit = summary(T.map(l => l.tx));
      const base = loadBaseMin(mine);
      term.base = base != null && term.n <= LOAD_BASE_MAX_N;
      term.value = term.base ? base : term.median;
      transit.value = transit.median;
      out.mines[mine.id] = {
        n: L.length, nTimes: T.length, timesScope: J.length ? 'well' : 'all',
        payload: summary(L.map(l => l.w > 0 ? l.w : null)),
        term, transit, dest: Object.assign({}, dest),
        lead: summary(lead), cycle: summary(cyc), idle: summary(idle),
        miles: median(L.map(l => l.mi))
      };
    }
    for (const sd of cfg.sands) {
      const L = loads.filter(l => l.s === sd.id);
      out.sands[sd.id] = { n: L.length, payload: summary(L.map(l => l.w > 0 ? l.w : null)) };
    }
    return out;
  }

  /* Effective parameters per sand, with their source (manual · plan · data · mine · estimated · assumed). */
  function resolveParams(cfg, stats) {
    const P = {};
    const ov = cfg.overrides || {};
    for (const sd of cfg.sands) {
      const s = sd.id, mine = sd.mine, ms = stats.mines[mine] || {}, ss = stats.sands[s] || {};
      const mcfg = cfg.mines.find(m => m.id === mine) || {};
      let payload, pSrc;
      const po = ov.payload && +ov.payload[s];
      if (po > 0) { payload = po; pSrc = 'manual'; }
      else if (ss.payload && ss.payload.n) { payload = ss.payload.mean; pSrc = 'data'; }
      else if (ms.payload && ms.payload.n) { payload = ms.payload.mean; pSrc = 'mine'; }
      else { payload = 50000; pSrc = 'assumed'; }
      let leadMin, lSrc;
      const lo = ov.leadMin && +ov.leadMin[mine];
      if (lo > 0) { leadMin = lo; lSrc = 'manual'; }
      else if (ms.lead && ms.lead.n) { leadMin = ms.lead.median; lSrc = 'data'; }
      else { leadMin = Math.round(((mcfg.miles || 60) * 2 / 45) * 60 + 120); lSrc = 'estimated'; }
      let cycleMin, cSrc;
      if (ms.cycle && ms.cycle.n) { cycleMin = ms.cycle.median; cSrc = 'data'; }
      else { cycleMin = leadMin; cSrc = 'estimated'; }
      let lptd, tSrc;
      const lp = cfg.loadsPerTruckDay && +cfg.loadsPerTruckDay[s];
      if (lp > 0) { lptd = lp; tSrc = 'plan'; }
      else { lptd = 1440 / cycleMin; tSrc = cSrc === 'data' ? 'data' : 'estimated'; }
      P[s] = {
        id: s, label: sd.label, mine: mine, mineName: mcfg.name || mine,
        payload, payloadSrc: pSrc, leadMin, leadMs: leadMin * MIN, leadSrc: lSrc,
        cycleMin, cycleSrc: cSrc, lptd, lptdSrc: tSrc
      };
    }
    return P;
  }

  /* ============================== well design ============================== */
  function stageTable(cfg) {
    const N = Math.max(1, Math.round(+(cfg.job && cfg.job.totalStages) || 0));
    const ids = cfg.sands.map(s => s.id);
    const d = {}, prefix = {}, R = {};
    ids.forEach(s => { d[s] = new Float64Array(N + 1); });
    const pace = new Float64Array(N + 1);
    const segOf = new Int16Array(N + 1).fill(-1);
    const issues = [];
    (cfg.segments || []).forEach((sg, i) => {
      const a = Math.max(1, Math.round(+sg.from)), b = Math.min(N, Math.round(+sg.to));
      if (!(a <= b)) { issues.push({ lvl: 'err', txt: 'Segment ' + (i + 1) + ': invalid stage range (' + sg.from + '–' + sg.to + ')' }); return; }
      for (let j = a; j <= b; j++) {
        if (segOf[j] >= 0) issues.push({ lvl: 'err', txt: 'Stage ' + j + ' is in two segments (' + (segOf[j] + 1) + ' and ' + (i + 1) + ')' });
        segOf[j] = i;
        pace[j] = +sg.pace;
        ids.forEach(s => { d[s][j] = Math.max(0, +((sg.lbs || {})[s]) || 0); });
      }
    });
    let gaps = [];
    for (let j = 1; j <= N; j++) if (segOf[j] < 0) gaps.push(j);
    if (gaps.length) issues.push({ lvl: 'err', txt: 'Stages with no design: ' + compactRanges(gaps) + ' (counted as 0 lb)' });
    let last = 0;
    for (let j = 1; j <= N; j++) { if (pace[j] > 0) { last = pace[j]; break; } }
    for (let j = 1; j <= N; j++) {
      if (!(pace[j] > 0)) { pace[j] = last || 19; } else last = pace[j];
    }
    ids.forEach(s => {
      const P = new Float64Array(N + 1);
      for (let j = 1; j <= N; j++) P[j] = P[j - 1] + d[s][j];
      prefix[s] = P; R[s] = P[N];
    });
    return { N, ids, d, pace, prefix, R, segOf, issues };
  }
  function compactRanges(a) {
    const out = [];
    for (let i = 0; i < a.length; i++) {
      let j = i;
      while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
      out.push(i === j ? String(a[i]) : a[i] + '–' + a[j]);
      i = j;
    }
    return out.join(', ');
  }
  /* Well position (in stages, continuous) where a sand's cumulative consumption EXCEEDS L.
     With L = lbs already on hand, it is how far that sand covers. Stages that do not use the sand
     are crossed for free: 40/70 with 0 lb covers through stage 30 because it is not used before 31. */
  function posOf(prefix, N, L) {
    if (!(L < prefix[N] - 1e-6)) return N;
    let lo = 1, hi = N;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (prefix[mid] > L) hi = mid; else lo = mid + 1; }
    const k = lo - 1;
    const span = prefix[lo] - prefix[k];
    return k + (span > 0 ? Math.max(0, L - prefix[k]) / span : 0);
  }

  /* Well calendar: stage boundaries B[k] (end of stage k). Anchored on the latest actual stage
     report; with no reports, on the planned frac start. */
  function schedule(tb, cfg, st, tz) {
    const N = tb.N;
    const dur = new Float64Array(N + 1);
    for (let j = 1; j <= N; j++) dur[j] = DAY / tb.pace[j];
    const fracStart = parseWall(cfg.schedule && cfg.schedule.fracStart, tz);
    const reports = (st.stage || [])
      .map(r => ({ id: r.id, n: Math.round(+r.n), t: typeof r.t === 'number' ? r.t : Date.parse(r.t), by: r.by || '' }))
      .filter(r => r.n >= 0 && r.n <= N && isFinite(r.t))
      .sort((a, b) => a.t - b.t || a.n - b.n);
    const last = reports[reports.length - 1];
    const anchor = last ? { k: last.n, t: last.t, src: 'real' } : { k: 0, t: fracStart, src: 'plan' };
    const B = new Float64Array(N + 1);
    B[anchor.k] = anchor.t;
    for (let k = anchor.k + 1; k <= N; k++) B[k] = B[k - 1] + dur[k];
    for (let k = anchor.k - 1; k >= 0; k--) B[k] = B[k + 1] - dur[k + 1];
    function T(x) {
      if (!(x > 0)) return B[0] + Math.min(0, x || 0) * dur[1];
      if (x >= N) return B[N];
      const k = Math.floor(x);
      return B[k] + (x - k) * dur[k + 1];
    }
    function X(t) {
      if (t <= B[0]) return (t - B[0]) / dur[1];
      if (t >= B[N]) return N;
      let lo = 0, hi = N;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (B[mid] <= t) lo = mid; else hi = mid; }
      return lo + (t - B[lo]) / dur[lo + 1];
    }
    return { B, dur, T, X, fracStart, anchor, reports };
  }

  /* ============================== full model ============================== */
  function build(cfg, st, now) {
    now = now == null ? Date.now() : now;
    st = st || {};
    const tz = cfg.tz || 'America/Mexico_City';
    const tb = stageTable(cfg);
    const N = tb.N;
    const sc = schedule(tb, cfg, st, tz);
    const loads = (st.omma && st.omma.loads) || [];
    const stats = computeStats(loads, cfg);
    const fileTo = stats.range ? stats.range.to : null;    // cut-off of the OMMA loads file
    const P = resolveParams(cfg, stats);
    const PS = parseWall(cfg.schedule && cfg.schedule.prefillStart, tz);
    const PE = parseWall(cfg.schedule && cfg.schedule.prefillEnd, tz);   // prefill end (optional)
    const FS = sc.fracStart;
    const buffer = Math.max(0, +cfg.bufferStages || 0);
    const alertMs = Math.max(0, +cfg.alertHours || 0) * HOUR;
    const countFrom = cfg.countFrom ? parseWall(cfg.countFrom, tz) : null;
    const shiftHour = cfg.shiftStartHour == null ? 6 : +cfg.shiftStartHour;
    const carriers = cfg.carriers || [];
    const carrierById = {}; carriers.forEach(c => { carrierById[c.id] = c; });
    const tracked = carriers.filter(c => c.tracked).map(c => c.id);
    const trackedId = tracked[0] || 'OMMA';
    const warnings = tb.issues.slice();

    /* OMMA deliveries to this well; only those after the cut-off count as design sand */
    const wellLoads = loads.filter(l => l.s && tb.prefix[l.s] && isJobLoad(l, cfg));
    const jobLoads = wellLoads.filter(l => !countFrom || (l.d || l.a) >= countFrom);
    /* PO per sand: the one set in the design wins; otherwise the latest load in the export */
    const poCfg = cfg.po || {}, poDet = {};
    wellLoads.slice().sort((a, b) => (a.d || a.a || 0) - (b.d || b.a || 0)).forEach(l => { if (l.po) poDet[l.s] = String(l.po); });

    /* assignments per sand */
    const asgBySand = {};
    const invalid = [];
    Object.keys(st.asg || {}).forEach(id => {
      const m = /^(.+)-(\d+)$/.exec(id);
      const rec = st.asg[id];
      if (!m || !tb.prefix[m[1]] || !rec) { invalid.push(id); return; }
      const t = typeof rec.t === 'number' ? rec.t : Date.parse(rec.t);
      (asgBySand[m[1]] = asgBySand[m[1]] || []).push({ k: +m[2], id, rec, t: isFinite(t) ? t : now });
    });

    const sands = {};
    const slots = [];
    for (const sd of cfg.sands) {
      const s = sd.id, pr = P[s], R = tb.R[s], prefix = tb.prefix[s];
      const asgList = (asgBySand[s] || []).sort((a, b) => a.k - b.k);
      const asgMap = new Map(asgList.map(a => [a.k, a]));
      const maxK = asgList.length ? asgList[asgList.length - 1].k : 0;
      /* OMMA deliveries are matched, in order, to loads assigned to OMMA or with no carrier (dispatch
         does not always enter the carrier: a load without a carrier can be an OMMA load) */
      const trackedK = asgList.filter(a => tracked.includes(a.rec.c) || !a.rec.c).map(a => a.k);
      const ommaK = asgList.filter(a => tracked.includes(a.rec.c)).length;
      const del = jobLoads.filter(l => l.s === s).sort((a, b) => (a.d || a.a) - (b.d || b.a));
      const match = new Map();
      const nm = Math.min(trackedK.length, del.length);
      for (let i = 0; i < nm; i++) match.set(trackedK[i], del[i]);
      const unmatched = del.slice(nm);
      const prefillN = Math.max(0, Math.round(+((cfg.prefill || {})[s]) || 0));
      const pfEnd = PE != null ? PE : FS - pr.leadMs;
      const pfWin = (PS != null && FS != null) ? pfEnd - PS : 0;
      if (prefillN > 0 && R > 0 && !(pfWin > 0)) {
        warnings.push({ lvl: 'warn', txt: 'Prefill ' + sd.label + ': the prefill → frac start window is shorter than the lead time (' + fmtDur(pr.leadMin) + '). Everything is assigned when the prefill opens.' });
      }
      const list = [];
      let cum = 0;
      for (let k = 1; k <= 20000; k++) {
        const needed = cum < R - 0.5;
        if (!needed && k > maxK) break;
        const dl = match.get(k) || null;
        const w = dl ? dl.w : pr.payload;
        const before = cum;
        cum += w;
        const a = asgMap.get(k) || null;
        const pos = needed ? posOf(prefix, N, before) : N;
        const isPre = needed && k <= prefillN;
        let nb, ab, hard, from = null;
        if (isPre) {
          nb = FS;
          ab = pfWin > 0 ? PS + (k - 1) / prefillN * pfWin : PS;
          hard = pfWin > 0 ? pfEnd : PS;
          from = PS;
        } else {
          nb = sc.T(Math.max(0, pos - buffer));
          ab = nb - pr.leadMs;
          hard = ab;
        }
        const stage = Math.min(N, Math.floor(pos + 1e-9) + 1);
        let status;
        if (!needed) status = 'extra';
        else if (a) {
          /* OMMA with no recorded delivery although its arrival fell before the file cut-off: still "en route" */
          const eta = a.t + pr.leadMs;
          const noRecord = tracked.includes(a.rec.c) && fileTo != null && eta <= fileTo;
          status = dl ? 'del' : (eta > now || noRecord ? 'eta' : 'arr');
        }
        else if (now > hard) status = 'late';
        else if (now >= ab - alertMs) status = 'now';
        else status = 'next';
        const sh = shiftOf(ab, tz, shiftHour);
        const slot = {
          id: s + '-' + String(k).padStart(3, '0'), s, k, label: sd.label, mine: sd.mine,
          needed, prefill: isPre, pos, stage, w, cumBefore: before, cumAfter: cum,
          covAfter: needed ? posOf(prefix, N, cum) : N, seq: null, cumAll: null,
          nb, ab, hard, from, eta: a ? a.t + pr.leadMs : null,
          asg: a ? a.rec : null, asgT: a ? a.t : null, carrier: a ? a.rec.c : null,
          delivered: dl, status, day: sh.day, shift: sh.shift, shiftKey: sh.key, shiftStart: sh.start
        };
        if (a) a.used = true;
        list.push(slot);
        slots.push(slot);
      }
      const neededSlots = list.filter(x => x.needed);
      const assigned = list.filter(x => x.asg);
      const asgLbs = assigned.reduce((p, x) => p + x.w, 0);
      const ommaLbs = del.reduce((p, l) => p + (l.w || 0), 0);
      /* estimated delivered = actual OMMA deliveries + assigned loads whose estimated arrival has passed.
         An OMMA load with no delivery in the file only counts as delivered if its arrival falls after the
         file cut-off (if it fell before and is missing, it did not arrive). */
      const estArr = assigned.filter(x => x.eta != null && x.eta <= now && !x.delivered &&
        (!tracked.includes(x.carrier) || fileTo == null || x.eta > fileTo));
      const estLbs = ommaLbs + estArr.reduce((p, x) => p + x.w, 0);
      const estN = del.length + estArr.length;
      /* reconciliation suggestion: OMMA deliveries not checked off → first free slots */
      const freeK = neededSlots.filter(x => !x.asg).map(x => x.id);
      const reconcile = unmatched.map((l, i) => freeK[i] ? { slot: freeK[i], c: trackedId, t: l.a || l.d, load: l } : null).filter(Boolean);
      sands[s] = {
        id: s, label: sd.label, mine: sd.mine, params: pr, R, prefillN,
        nNeeded: neededSlots.length, nAssigned: assigned.length,
        nAssignedNeeded: neededSlots.filter(x => x.asg).length,
        nExtra: list.filter(x => !x.needed).length,
        asgLbs, ommaLbs, estLbs, estN,
        cov: { asg: posOf(prefix, N, asgLbs), est: posOf(prefix, N, estLbs), omma: posOf(prefix, N, ommaLbs) },
        omma: { assigned: ommaK, pool: trackedK.length, delivered: del.length, matched: nm, pending: trackedK.length - nm, unmatched, reconcile },
        po: poCfg[s] ? String(poCfg[s]) : (poDet[s] || ''), poSrc: poCfg[s] ? 'manual' : (poDet[s] ? 'export' : null),
        slots: list
      };
    }
    /* Queue order = load number. Assigned loads come first, in the order the shared state received them
       (the Nth load sent is #N, so 37 assigned means #38 is next); pending loads follow in the order the
       design needs them (assign-by time). Loads beyond the design (surplus) go last, without a number.
       The received order (o) is stamped by the reducer, so a slow clock or an offline queue can never
       renumber what everyone already saw; records from before that counter sort first, by their time. */
    const byNeed = (a, b) => a.ab - b.ab || a.s.localeCompare(b.s) || a.k - b.k;
    const ordOf = x => { const o = x.asg && +x.asg.o; return o > 0 && isFinite(o) ? o : null; };
    const byAssigned = (a, b) => {
      const oa = ordOf(a), ob = ordOf(b);
      if (oa == null && ob == null) return a.asgT - b.asgT || byNeed(a, b);
      if (oa == null) return -1;
      if (ob == null) return 1;
      return oa - ob || byNeed(a, b);
    };
    const qAsg = slots.filter(x => x.needed && x.asg).sort(byAssigned);
    const qPen = slots.filter(x => x.needed && !x.asg).sort(byNeed);
    const qExtra = slots.filter(x => !x.needed).sort(byNeed);
    slots.length = 0;
    Array.prototype.push.apply(slots, qAsg.concat(qPen, qExtra));
    Object.keys(asgBySand).forEach(s => asgBySand[s].forEach(a => { if (!a.used) invalid.push(a.id); }));
    /* load number and cumulative sand on location along the queue */
    let seq = 0, cumAll = 0;
    slots.forEach(x => { x.po = sands[x.s].po; if (!x.needed) return; seq++; cumAll += x.w; x.seq = seq; x.cumAll = cumAll; });

    /* ---------- KPIs ---------- */
    const needed = slots.filter(x => x.needed);
    const due = needed.filter(x => x.ab <= now);
    const pending = needed.filter(x => !x.asg);
    const next = pending.slice().sort((a, b) => a.ab - b.ab)[0] || null;
    const kpi = {
      reqLoads: needed.length,
      reqLbs: tb.ids.reduce((p, s) => p + tb.R[s], 0),
      asgLoads: slots.filter(x => x.asg).length,
      asgNeeded: needed.filter(x => x.asg).length,
      asgLbs: slots.filter(x => x.asg).reduce((p, x) => p + x.w, 0),
      dueNow: due.length,
      dueLbs: due.reduce((p, x) => p + x.w, 0),
      overdue: pending.filter(x => x.status === 'late').length,
      nowWindow: pending.filter(x => x.status === 'now').length,
      next24: pending.filter(x => x.ab <= now + DAY).length,
      next,
      extra: slots.filter(x => !x.needed).length,
      invalid
    };
    kpi.gap = kpi.asgNeeded - kpi.dueNow;
    kpi.gapLbs = needed.filter(x => x.asg).reduce((p, x) => p + x.w, 0) - kpi.dueLbs;
    kpi.remaining = kpi.reqLoads - kpi.asgNeeded;
    kpi.pct = kpi.reqLoads ? kpi.asgNeeded / kpi.reqLoads : 0;
    /* final counts: from this share of loads assigned, dispatch confirms the remaining loads with the
       frac crew. fcAt = the load number that reaches the threshold. */
    const fcPct = Math.min(100, Math.max(1, +cfg.finalCountsPct || 80)) / 100;
    kpi.fcPct = fcPct;
    kpi.fcAt = kpi.reqLoads ? Math.max(1, Math.ceil(fcPct * kpi.reqLoads - 1e-9)) : 0;
    kpi.fcOn = kpi.reqLoads > 0 && kpi.asgNeeded >= kpi.fcAt;
    kpi.fcLeft = Math.max(0, kpi.fcAt - kpi.asgNeeded);
    const covOf = basis => Math.min.apply(null, tb.ids.map(s => sands[s].cov[basis]));
    kpi.cov = { asg: covOf('asg'), est: covOf('est'), omma: covOf('omma') };
    kpi.ommaLoads = jobLoads.length;
    kpi.ommaLbs = jobLoads.reduce((p, l) => p + (l.w || 0), 0);

    /* ---------- well status ---------- */
    const xNow = sc.X(now);
    const lastRep = sc.reports[sc.reports.length - 1] || null;
    let phase;
    if ((lastRep && lastRep.n >= N) || xNow >= N) phase = 'done';
    else if (lastRep || (FS != null && now >= FS)) phase = 'frac';
    else if (PS != null && now >= PS) phase = 'prefill';
    else phase = 'pre';
    let pace = null;
    if (sc.reports.length >= 2) {
      const win = sc.reports.filter(r => r.t >= lastRep.t - DAY);
      const first = win.length >= 2 ? win[0] : sc.reports[sc.reports.length - 2];
      if (lastRep.t > first.t) pace = { v: (lastRep.n - first.n) / ((lastRep.t - first.t) / DAY), src: 'reports', from: first.t };
    } else if (lastRep && FS != null && lastRep.t > FS) {
      pace = { v: lastRep.n / ((lastRep.t - FS) / DAY), src: 'since frac start', from: FS };
    }
    const curStage = Math.min(N, Math.max(0, Math.floor(Math.max(0, xNow) + 1e-9) + (phase === 'done' ? 0 : 1)));
    const segIdx = tb.segOf[Math.max(1, Math.min(N, curStage || 1))];
    const well = {
      N, xNow: Math.max(0, Math.min(N, xNow)), xRaw: xNow, curStage, lastRep, phase, pace,
      fracStart: FS, prefillStart: PS, prefillEnd: PE, end: sc.B[N], anchor: sc.anchor, reports: sc.reports,
      segIdx, designPace: tb.pace[Math.max(1, Math.min(N, curStage || 1))]
    };

    /* ---------- plan per segment: loads/day, trucks, sustainable pace ----------
       Sustainable pace = what the planned trucks can hold: trucks × loads/truck/day × payload ÷ lbs per stage,
       and the shortest sand rules. With no truck plan for a sand that is used, nothing is invented: null. */
    const segPlans = (cfg.segments || []).map((sg, i) => {
      const per = {};
      let sustain = Infinity, limiting = null, complete = true;
      const tk = sg.trucks || {};
      tb.ids.forEach(s => {
        const lbs = Math.max(0, +((sg.lbs || {})[s]) || 0), pr = P[s];
        const lpd = sg.pace * lbs / pr.payload;
        const trucksNeeded = lpd / pr.lptd;
        const planned = (tk[s] != null && tk[s] !== '' && isFinite(+tk[s])) ? Math.max(0, +tk[s]) : null;
        const cap = planned != null ? planned * pr.lptd : null;
        let sus = Infinity;
        if (lbs > 0) {
          if (planned == null) complete = false;
          else sus = cap * pr.payload / lbs;
        }
        if (sus < sustain) { sustain = sus; limiting = s; }
        per[s] = { lbs, loadsPerDay: lpd, trucksNeeded, trucksPlanned: planned, capLoadsDay: cap,
          sustainPace: isFinite(sus) ? sus : null, everyMin: lpd > 0 ? 1440 / lpd : null,
          lbsTotal: lbs * (sg.to - sg.from + 1), gapTrucks: planned != null ? planned - trucksNeeded : null };
      });
      return { i, from: sg.from, to: sg.to, pace: sg.pace, stages: sg.to - sg.from + 1, per,
        sustainPace: complete && isFinite(sustain) ? sustain : null, partialSustain: isFinite(sustain) ? sustain : null,
        limiting, complete, days: (sg.to - sg.from + 1) / sg.pace };
    });

    /* ---------- daily series (dispatch) ---------- */
    const byDay = {};
    needed.forEach(x => {
      const dk = dayKey(x.ab, tz);
      const o = byDay[dk] = byDay[dk] || { day: dk, loads: {}, lbs: {}, total: 0, lbsTotal: 0, asg: 0 };
      o.loads[x.s] = (o.loads[x.s] || 0) + 1; o.lbs[x.s] = (o.lbs[x.s] || 0) + x.w;
      o.total++; o.lbsTotal += x.w; if (x.asg) o.asg++;
    });
    const days = Object.keys(byDay).sort().map(k => byDay[k]);

    /* ---------- carriers ---------- */
    const byCarrier = carriers.map(c => {
      const a = slots.filter(x => x.carrier === c.id);
      return { id: c.id, name: c.name, tracked: !!c.tracked, loads: a.length, lbs: a.reduce((p, x) => p + x.w, 0),
        last: a.length ? Math.max.apply(null, a.map(x => x.asgT || 0)) : null };
    });

    return {
      cfg, now, tz, N, tb, sc, stats, params: P, sands, slots, kpi, well, segPlans, days, byCarrier,
      jobLoads, wellLoads, countFrom, warnings, carrierById, trackedId
    };
  }

  /* Cumulative required vs assigned series, hourly, for the gap tracker. */
  function cumulativeSeries(model, opts) {
    opts = opts || {};
    const unit = opts.unit || 'loads';
    const filt = opts.filter || (() => true);
    const S = model.slots.filter(x => x.needed && filt(x));
    const val = x => unit === 'loads' ? 1 : unit === 'tons' ? x.w / LBS_PER_TON : x.w;
    if (!S.length) return { t: [], req: [], asg: [], total: 0 };
    const t0 = opts.from != null ? opts.from : Math.floor(Math.min.apply(null, S.map(x => Math.min(x.ab, x.asgT || x.ab))) / HOUR) * HOUR;
    const t1 = opts.to != null ? opts.to : Math.ceil(Math.max.apply(null, S.map(x => x.ab)) / HOUR) * HOUR;
    const step = opts.step || HOUR;
    const reqE = S.map(x => [x.ab, val(x)]).sort((a, b) => a[0] - b[0]);
    const asgE = S.filter(x => x.asg).map(x => [x.asgT, val(x)]).sort((a, b) => a[0] - b[0]);
    const total = S.reduce((p, x) => p + val(x), 0);
    const T = [], req = [], asg = [];
    let i = 0, j = 0, cr = 0, ca = 0;
    const base = opts.from != null ? S.filter(x => x.ab < t0).reduce((p, x) => p + val(x), 0) : 0;
    const baseA = opts.from != null ? S.filter(x => x.asg && x.asgT < t0).reduce((p, x) => p + val(x), 0) : 0;
    while (i < reqE.length && reqE[i][0] < t0) i++;
    while (j < asgE.length && asgE[j][0] < t0) j++;
    cr = base; ca = baseA;
    for (let t = t0; t <= t1 + 1; t += step) {
      while (i < reqE.length && reqE[i][0] <= t) { cr += reqE[i][1]; i++; }
      while (j < asgE.length && asgE[j][0] <= t) { ca += asgE[j][1]; j++; }
      T.push(t); req.push(cr); asg.push(t <= model.now + step ? ca : null);
    }
    return { t: T, req, asg, total };
  }

  function fmtDur(min) {
    if (min == null || !isFinite(min)) return '—';
    const m = Math.round(Math.abs(min));
    const h = Math.floor(m / 60), r = m % 60;
    const s = min < 0 ? '−' : '';
    if (h >= 24) { const d = Math.floor(h / 24); return s + d + 'd ' + (h % 24) + 'h'; }
    return s + (h ? h + 'h ' + String(r).padStart(2, '0') + 'm' : r + 'm');
  }

  /* ============================== drivers and turn rate ==============================
     A driver works one shift a day: 12 h that can stretch to 14 h (drivers.shiftH / drivers.maxH).
     A load keeps a driver for its full load time: assigned → delivered at its mine (the same time the
     queue uses, from the OMMA export or set by hand in Mines). Any driver can take any trip, so a shift
     needs its loads' driver-hours ÷ the hours a driver can work, rounded up once for the whole shift.
     A load counts in the shift where its trip is half done. Turn rate = loads per driver per day. */
  function driverHours(cfg) {
    const d = (cfg && cfg.drivers) || {};
    const shift = +d.shiftH >= 4 && +d.shiftH <= 16 ? +d.shiftH : 12;
    let max = +d.maxH >= 4 && +d.maxH <= 16 ? +d.maxH : 14;
    if (max < shift) max = shift;
    return { shift, max };
  }
  function segDriversPlan(sg) {
    const v = sg && sg.drivers;
    return v != null && v !== '' && isFinite(+v) && +v >= 0 ? +v : null;
  }
  /* opts.sands: the sands to count (the board's sand filter); all of them by default */
  function driverPlan(model, opts) {
    opts = opts || {};
    const cfg = model.cfg, tz = model.tz, P = model.params;
    const hrs = driverHours(cfg), H = hrs.max;
    const sh0 = cfg.shiftStartHour == null ? 6 : +cfg.shiftStartHour;
    const want = opts.sands ? new Set(opts.sands) : null;
    const sands = cfg.sands.filter(s => P[s.id] && (!want || want.has(s.id)));
    const mineOfS = {}, loadH = {}, loadSrc = {};
    sands.forEach(s => {
      mineOfS[s.id] = s.mine;
      if (loadH[s.mine] == null) { loadH[s.mine] = Math.max(0.25, (+P[s.id].leadMin || 60) / 60); loadSrc[s.mine] = P[s.id].leadSrc; }
    });
    const tr = {};
    Object.keys(loadH).forEach(m => { tr[m] = H / loadH[m]; });
    const loads = model.slots.filter(x => x.needed && mineOfS[x.s] != null);
    const segs0 = cfg.segments || [];
    const segAt = t => {
      if (!model.sc || !model.tb) return -1;
      const pos = Math.max(0, Math.min(model.N - 1e-6, model.sc.X(t)));
      const i = model.tb.segOf[Math.floor(pos) + 1];
      return i == null ? -1 : i;
    };

    /* shifts: day and night, with the loads whose trip is half done in each */
    const SH = {};
    loads.forEach(x => {
      const m = mineOfS[x.s], tau = loadH[m];
      const sh = shiftOf(x.ab + tau * HOUR / 2, tz, sh0);
      const o = SH[sh.key] || (SH[sh.key] = { key: sh.key, day: sh.day, shift: sh.shift, start: sh.start, end: sh.start + 12 * HOUR, loads: {}, total: 0, hours: 0 });
      o.loads[x.s] = (o.loads[x.s] || 0) + 1;
      o.total++; o.hours += tau;
    });
    const shifts = Object.keys(SH).map(k => SH[k]).sort((a, b) => a.start - b.start);
    shifts.forEach(o => {
      o.need = o.hours / H;
      o.drivers = Math.ceil(o.need - 1e-9);
      o.tr = o.drivers ? o.total / o.drivers : null;
      const si = segAt(o.start + 6 * HOUR);
      o.plan = si >= 0 ? segDriversPlan(segs0[si]) : null;
    });
    /* operating days: day shift + night shift */
    const DD = {};
    shifts.forEach(o => {
      const d = DD[o.day] || (DD[o.day] = { day: o.day, D: null, N: null, drivers: 0, need: 0, total: 0, hours: 0, loads: {}, plan: null });
      d[o.shift] = o; d.drivers += o.drivers; d.need += o.need; d.total += o.total; d.hours += o.hours;
      Object.keys(o.loads).forEach(s => { d.loads[s] = (d.loads[s] || 0) + o.loads[s]; });
    });
    const days = Object.keys(DD).sort().map(k => DD[k]);
    days.forEach(d => {
      d.tr = d.drivers ? d.total / d.drivers : null;
      const pl = ['D', 'N'].map(k => d[k] ? d[k].plan : null).filter(v => v != null);
      d.plan = pl.length ? pl.reduce((a, b) => a + b, 0) : null;
    });

    /* hour by hour: drivers on a trip (time-weighted) and the loads that leave */
    const hourly = { t: [], busy: [], shiftDrivers: [], starts: [] };
    if (loads.length) {
      const t0 = Math.floor(Math.min.apply(null, loads.map(x => x.ab)) / HOUR) * HOUR;
      const t1 = Math.ceil(Math.max.apply(null, loads.map(x => x.ab + loadH[mineOfS[x.s]] * HOUR)) / HOUR) * HOUR;
      const n = Math.max(1, Math.round((t1 - t0) / HOUR));
      const busy = new Float64Array(n), starts = [];
      for (let i = 0; i < n; i++) starts.push({});
      loads.forEach(x => {
        const a = x.ab, b = x.ab + loadH[mineOfS[x.s]] * HOUR;
        const i0 = Math.max(0, Math.floor((a - t0) / HOUR)), i1 = Math.min(n - 1, Math.floor((b - t0 - 1) / HOUR));
        for (let i = i0; i <= i1; i++) {
          const hs = t0 + i * HOUR;
          busy[i] += Math.max(0, Math.min(b, hs + HOUR) - Math.max(a, hs)) / HOUR;
        }
        const k = Math.floor((a - t0) / HOUR);
        if (k >= 0 && k < n) starts[k][x.s] = (starts[k][x.s] || 0) + 1;
      });
      for (let i = 0; i < n; i++) {
        const t = t0 + i * HOUR, sh = shiftOf(t + 30 * MIN, tz, sh0);
        hourly.t.push(t); hourly.busy.push(busy[i]); hourly.shiftDrivers.push(SH[sh.key] ? SH[sh.key].drivers : 0); hourly.starts.push(starts[i]);
      }
    }

    /* per design segment, at its pace: what each stage takes, the drivers that hold that pace
       and, when the design has a driver plan, the pace that plan holds */
    const segs = (model.segPlans || []).map((sp, i) => {
      const perStage = {};
      let lps = 0, dh = 0;
      sands.forEach(s => {
        const q = sp.per[s.id];
        if (!q || !(q.lbs > 0) || !(P[s.id].payload > 0)) return;
        const L = q.lbs / P[s.id].payload;
        perStage[s.id] = L; lps += L; dh += L * loadH[s.mine];
      });
      const need = dh * sp.pace / 2 / H;                  // drivers on each 12 h shift at the design pace
      const onShift = Math.ceil(need - 1e-9), perDay = 2 * onShift, loadsDay = lps * sp.pace;
      const plan = segDriversPlan(segs0[i]);
      return { from: sp.from, to: sp.to, pace: sp.pace, stageMin: sp.pace > 0 ? 1440 / sp.pace : null, perStage,
        loadsPerStage: lps, driverHoursPerStage: dh, loadsPerDay: loadsDay, loadsPerHour: loadsDay / 24,
        driving: dh * sp.pace / 24, need, onShift, perDay, tr: perDay ? loadsDay / perDay : null,
        plan, gap: plan != null ? plan - onShift : null, planHolds: plan != null && dh > 0 ? plan * 2 * H / dh : null };
    });

    const tot = shifts.reduce((q, o) => { q.loads += o.total; q.drivers += o.drivers; return q; }, { loads: 0, drivers: 0 });
    const todayKey = shiftOf(model.now, tz, sh0).day;
    return {
      H, shiftH: hrs.shift, loadH, loadSrc, tr, mineOf: mineOfS, shifts, days, hourly, segs,
      total: { loads: tot.loads, driverDays: tot.drivers, tr: tot.drivers ? tot.loads / tot.drivers : null },
      todayKey, today: days.find(d => d.day === todayKey) || null,
      peak: days.reduce((b, d) => (!b || d.drivers > b.drivers ? d : b), null)
    };
  }

  return {
    MIN, HOUR, DAY, LBS_PER_TON,
    wallParts, tzOffset, wallToEpoch, parseWall, dayKey, toWallString, shiftOf,
    normText, normProduct, normMine, parseDuration,
    mean, median, summary, computeStats, resolveParams,
    stageTable, posOf, schedule, build, cumulativeSeries, fmtDur, compactRanges,
    driverHours, driverPlan
  };
});
