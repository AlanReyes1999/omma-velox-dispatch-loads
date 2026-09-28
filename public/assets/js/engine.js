/* OMMA · Velox dispatch — motor de cálculo.
   Puro y sin dependencias: corre igual en el navegador (window.Engine) y en Node (tests).

   Grano del modelo: UNA fila = UN load (slot) que hay que asignar para cubrir el diseño del pozo.
   El slot k de una arena es "el k-ésimo load de esa arena en el pozo". Su identidad no cambia
   aunque cambie el diseño: lo que se recalcula es para qué etapa sirve y a qué hora hay que asignarlo.

   Cadena de cálculo por slot:
     lbs acumuladas antes del slot  →  posición en el pozo donde esa arena empieza a consumirse (pos)
     pos − etapas de colchón        →  hora en que el load debe estar en locación (nb)
     nb − lead time de la arenera   →  hora límite para asignarlo (ab)
   El prefill es la excepción: esos loads se reparten en la ventana prefill → inicio de frac. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
  const LBS_PER_TON = 2000;

  /* ============================== zona horaria ============================== */
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
  function wallParts(epoch, tz) {
    const o = {};
    for (const p of dtfFor(tz).formatToParts(new Date(epoch))) o[p.type] = p.value;
    return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second, wd: o.weekday };
  }
  function tzOffset(epoch, tz) {
    const p = wallParts(epoch, tz);
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(epoch / 1000) * 1000;
  }
  function wallToEpoch(y, mo, d, h, mi, s, tz) {
    const guess = Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0);
    const off = tzOffset(guess, tz);
    let t = guess - off;
    const off2 = tzOffset(t, tz);
    if (off2 !== off) t = guess - off2;
    return t;
  }
  /* Acepta: epoch · Date · ISO con zona · 'YYYY-MM-DD HH:mm' · 'M/D/YYYY H:mm[:ss] [AM|PM]' · serial de Excel.
     Todo lo que no trae zona se lee como hora de pared en `tz`. */
  function parseWall(v, tz) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : v.getTime();
    if (typeof v === 'number') {
      if (v > 1e11) return v;                               // epoch ms
      if (v > 20000 && v < 80000) {                         // serial de Excel (días desde 1899-12-30)
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
  /* Turno operativo: Día = [inicio, inicio+12h) · Noche = [inicio+12h, inicio+24h).
     La madrugada pertenece a la noche del día operativo anterior. */
  function shiftOf(epoch, tz, startHour) {
    const sh = startHour == null ? 6 : startHour;
    const p = wallParts(epoch, tz);
    const minOfDay = p.h * 60 + p.mi;
    const startMin = sh * 60;
    let base = epoch;
    if (minOfDay < startMin) base = epoch - DAY;       // madrugada → día operativo anterior
    const bp = wallParts(base, tz);
    const opDay = bp.y + '-' + pad2(bp.mo) + '-' + pad2(bp.d);
    const rel = ((minOfDay - startMin) + 1440) % 1440;
    const shift = rel < 720 ? 'D' : 'N';
    const shiftStart = wallToEpoch(bp.y, bp.mo, bp.d, sh + (shift === 'N' ? 12 : 0), 0, 0, tz);
    return { key: opDay + '|' + shift, day: opDay, shift: shift, start: shiftStart };
  }

  /* ============================== normalización ============================== */
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

  /* ============================== estadística ============================== */
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

  /* Estadística por arenera y por arena a partir de los loads OMMA.
     · payload: todos los loads de la arenera/arena (el peso no depende del pozo)
     · tiempos: sólo los loads a ESTE pozo (el tránsito depende de la ruta); si no hay, todos
     · ciclo: entregas consecutivas del mismo truck en la misma arenera, con la siguiente
       aceptación ≤ 3 h después de entregar (trabajo continuo) */
  function computeStats(loads, cfg) {
    const out = { mines: {}, sands: {}, n: loads.length, range: null };
    const ts = loads.map(l => l.d || l.a).filter(Boolean);
    if (ts.length) out.range = { from: Math.min.apply(null, ts), to: Math.max.apply(null, ts) };
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
      out.mines[mine.id] = {
        n: L.length, nTimes: T.length, timesScope: J.length ? 'pozo' : 'todas',
        payload: summary(L.map(l => l.w > 0 ? l.w : null)),
        term: summary(T.map(l => l.tm)), transit: summary(T.map(l => l.tx)), dest: summary(T.map(l => l.td)),
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

  /* Parámetros efectivos por arena, con su fuente (manual · plan · dato · arenera · estimado). */
  function resolveParams(cfg, stats) {
    const P = {};
    const ov = cfg.overrides || {};
    for (const sd of cfg.sands) {
      const s = sd.id, mine = sd.mine, ms = stats.mines[mine] || {}, ss = stats.sands[s] || {};
      const mcfg = cfg.mines.find(m => m.id === mine) || {};
      let payload, pSrc;
      const po = ov.payload && +ov.payload[s];
      if (po > 0) { payload = po; pSrc = 'manual'; }
      else if (ss.payload && ss.payload.n) { payload = ss.payload.mean; pSrc = 'dato'; }
      else if (ms.payload && ms.payload.n) { payload = ms.payload.mean; pSrc = 'arenera'; }
      else { payload = 50000; pSrc = 'supuesto'; }
      let leadMin, lSrc;
      const lo = ov.leadMin && +ov.leadMin[mine];
      if (lo > 0) { leadMin = lo; lSrc = 'manual'; }
      else if (ms.lead && ms.lead.n) { leadMin = ms.lead.median; lSrc = 'dato'; }
      else { leadMin = Math.round(((mcfg.miles || 60) * 2 / 45) * 60 + 120); lSrc = 'estimado'; }
      let cycleMin, cSrc;
      if (ms.cycle && ms.cycle.n) { cycleMin = ms.cycle.median; cSrc = 'dato'; }
      else { cycleMin = leadMin; cSrc = 'estimado'; }
      let lptd, tSrc;
      const lp = cfg.loadsPerTruckDay && +cfg.loadsPerTruckDay[s];
      if (lp > 0) { lptd = lp; tSrc = 'plan'; }
      else { lptd = 1440 / cycleMin; tSrc = cSrc === 'dato' ? 'dato' : 'estimado'; }
      P[s] = {
        id: s, label: sd.label, mine: mine, mineName: mcfg.name || mine,
        payload, payloadSrc: pSrc, leadMin, leadMs: leadMin * MIN, leadSrc: lSrc,
        cycleMin, cycleSrc: cSrc, lptd, lptdSrc: tSrc
      };
    }
    return P;
  }

  /* ============================== diseño del pozo ============================== */
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
      if (!(a <= b)) { issues.push({ lvl: 'err', txt: 'Tramo ' + (i + 1) + ': rango de etapas inválido (' + sg.from + '–' + sg.to + ')' }); return; }
      for (let j = a; j <= b; j++) {
        if (segOf[j] >= 0) issues.push({ lvl: 'err', txt: 'Etapa ' + j + ' está en dos tramos (' + (segOf[j] + 1) + ' y ' + (i + 1) + ')' });
        segOf[j] = i;
        pace[j] = +sg.pace;
        ids.forEach(s => { d[s][j] = Math.max(0, +((sg.lbs || {})[s]) || 0); });
      }
    });
    let gaps = [];
    for (let j = 1; j <= N; j++) if (segOf[j] < 0) gaps.push(j);
    if (gaps.length) issues.push({ lvl: 'err', txt: 'Etapas sin diseño: ' + compactRanges(gaps) + ' (se cuentan en 0 lbs)' });
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
  /* Posición del pozo (en etapas, continua) donde el consumo acumulado de una arena SUPERA L.
     Con L = lbs ya entregadas, es hasta dónde alcanza esa arena. Etapas sin consumo de la arena
     se cruzan gratis: 40/70 con 0 lbs cubre hasta la 30 porque no se usa antes de la 31. */
  function posOf(prefix, N, L) {
    if (!(L < prefix[N] - 1e-6)) return N;
    let lo = 1, hi = N;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (prefix[mid] > L) hi = mid; else lo = mid + 1; }
    const k = lo - 1;
    const span = prefix[lo] - prefix[k];
    return k + (span > 0 ? Math.max(0, L - prefix[k]) / span : 0);
  }

  /* Calendario del pozo: fronteras de etapa B[k] (fin de la etapa k). Se ancla en el último
     reporte real de etapa; sin reportes, en el inicio de frac del plan. */
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

  /* ============================== modelo completo ============================== */
  function build(cfg, st, now) {
    now = now == null ? Date.now() : now;
    st = st || {};
    const tz = cfg.tz || 'America/Mexico_City';
    const tb = stageTable(cfg);
    const N = tb.N;
    const sc = schedule(tb, cfg, st, tz);
    const loads = (st.omma && st.omma.loads) || [];
    const stats = computeStats(loads, cfg);
    const fileTo = stats.range ? stats.range.to : null;    // corte del archivo de loads OMMA
    const P = resolveParams(cfg, stats);
    const PS = parseWall(cfg.schedule && cfg.schedule.prefillStart, tz);
    const PE = parseWall(cfg.schedule && cfg.schedule.prefillEnd, tz);   // fin del prefill (opcional)
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

    /* entregas OMMA a este pozo; cuentan como arena del diseño sólo las posteriores al corte */
    const wellLoads = loads.filter(l => l.s && tb.prefix[l.s] && isJobLoad(l, cfg));
    const jobLoads = wellLoads.filter(l => !countFrom || (l.d || l.a) >= countFrom);
    /* PO por arena: el capturado en el diseño manda; si no hay, el del load más reciente del export */
    const poCfg = cfg.po || {}, poDet = {};
    wellLoads.slice().sort((a, b) => (a.d || a.a || 0) - (b.d || b.a || 0)).forEach(l => { if (l.po) poDet[l.s] = String(l.po); });

    /* asignaciones por arena */
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
      /* las entregas OMMA se casan, en orden, con lo asignado a OMMA o sin carrier (despacho no
         siempre captura el carrier: un load sin carrier puede ser de OMMA) */
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
        warnings.push({ lvl: 'warn', txt: 'Prefill ' + sd.label + ': la ventana prefill → inicio de frac es menor al lead time (' + fmtDur(pr.leadMin) + '). Se asigna todo al abrir el prefill.' });
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
          /* OMMA sin entrega registrada aunque su llegada cayó antes del corte del archivo: sigue "en camino" */
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
      /* entregado estimado = entregas reales de OMMA + lo asignado cuya llegada estimada ya pasó.
         Un load OMMA sin entrega en el archivo sólo se estima entregado si su llegada cae después del
         corte del archivo (si cayó antes y no aparece, no llegó). */
      const estArr = assigned.filter(x => x.eta != null && x.eta <= now && !x.delivered &&
        (!tracked.includes(x.carrier) || fileTo == null || x.eta > fileTo));
      const estLbs = ommaLbs + estArr.reduce((p, x) => p + x.w, 0);
      const estN = del.length + estArr.length;
      /* sugerencia de conciliación: entregas OMMA sin palomear → primeros slots libres */
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
    slots.sort((a, b) => a.ab - b.ab || a.s.localeCompare(b.s) || a.k - b.k);
    Object.keys(asgBySand).forEach(s => asgBySand[s].forEach(a => { if (!a.used) invalid.push(a.id); }));
    /* orden de asignación: número consecutivo y arena acumulada en locación a lo largo de la cola */
    let seq = 0, cumAll = 0;
    slots.forEach(x => { if (!x.needed) return; seq++; cumAll += x.w; x.seq = seq; x.cumAll = cumAll; x.po = sands[x.s].po; });

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
    const covOf = basis => Math.min.apply(null, tb.ids.map(s => sands[s].cov[basis]));
    kpi.cov = { asg: covOf('asg'), est: covOf('est'), omma: covOf('omma') };
    kpi.ommaLoads = jobLoads.length;
    kpi.ommaLbs = jobLoads.reduce((p, l) => p + (l.w || 0), 0);

    /* ---------- estado del pozo ---------- */
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
      if (lastRep.t > first.t) pace = { v: (lastRep.n - first.n) / ((lastRep.t - first.t) / DAY), src: 'reportes', from: first.t };
    } else if (lastRep && FS != null && lastRep.t > FS) {
      pace = { v: lastRep.n / ((lastRep.t - FS) / DAY), src: 'desde inicio de frac', from: FS };
    }
    const curStage = Math.min(N, Math.max(0, Math.floor(Math.max(0, xNow) + 1e-9) + (phase === 'done' ? 0 : 1)));
    const segIdx = tb.segOf[Math.max(1, Math.min(N, curStage || 1))];
    const well = {
      N, xNow: Math.max(0, Math.min(N, xNow)), xRaw: xNow, curStage, lastRep, phase, pace,
      fracStart: FS, prefillStart: PS, end: sc.B[N], anchor: sc.anchor, reports: sc.reports,
      segIdx, designPace: tb.pace[Math.max(1, Math.min(N, curStage || 1))]
    };

    /* ---------- plan por tramo: loads/día, trucks, ritmo sostenible ----------
       Ritmo sostenible = el que aguantan los trucks planeados: trucks × loads/truck/día × payload ÷ lbs por etapa,
       y manda la arena más corta. Sin plan de trucks para una arena con consumo, no se inventa: queda null. */
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

    /* ---------- series por día (dispatch) ---------- */
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

  /* Serie acumulada requerido vs asignado, por hora, para el gap tracker. */
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

  return {
    MIN, HOUR, DAY, LBS_PER_TON,
    wallParts, tzOffset, wallToEpoch, parseWall, dayKey, toWallString, shiftOf,
    normText, normProduct, normMine, parseDuration,
    mean, median, summary, computeStats, resolveParams,
    stageTable, posOf, schedule, build, cumulativeSeries, fmtDur, compactRanges
  };
});
