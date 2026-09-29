/* OMMA · Velox dispatch — reader for the frac crew's stage stats PDF (the "STATISTICS" sheet).
   Keeps only what the calculation uses: stage number, start and end time, and the lbs pumped of each
   sand, from the note on the "Used Pounds" cell ("110,000 lbs - 20/40"). Sandpile and drivers at
   location are not kept.
   · parse(items, cfg, E, now): positioned text → stages + warnings. Pure: it runs in Node for the tests.
   · readPdf(file): the PDF's positioned text. pdf.js loads only when a file is chosen. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StageStats = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const MIN = 60e3, DAY = 86400e3;
  const fmtN = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  /* positioned items {p, s, x, y, w} → lines on the same page and baseline (±2.5 pt), left to right.
     Pieces that touch (under 3.5 pt apart) are one cell: "120,000" + "[1]" never splits a value. */
  function toLines(items) {
    const its = (items || []).filter(it => it && typeof it.s === 'string' && it.s.trim() !== '')
      .map(it => ({ p: +it.p || 1, s: String(it.s).replace(/\s+/g, ' ').trim(), x: +it.x || 0, y: +it.y || 0, w: Math.max(0, +it.w || 0) }))
      .sort((a, b) => a.p - b.p || a.y - b.y || a.x - b.x);
    const L = [];
    its.forEach(it => {
      let ln = L[L.length - 1];
      if (!ln || ln.p !== it.p || Math.abs(ln.y - it.y) > 2.5) { ln = { p: it.p, y: it.y, raw: [] }; L.push(ln); }
      ln.raw.push(it);
    });
    L.forEach(ln => {
      ln.raw.sort((a, b) => a.x - b.x);
      const cells = [];
      ln.raw.forEach(it => {
        const c = cells[cells.length - 1];
        if (c && it.x - (c.x + c.w) < 3.5) { c.s += ' ' + it.s; c.w = Math.max(c.w, it.x + it.w - c.x); }
        else cells.push({ s: it.s, x: it.x, w: it.w });
      });
      cells.forEach(c => { c.cx = c.x + c.w / 2; });
      ln.cells = cells;
      ln.text = cells.map(c => c.s).join(' ');
      delete ln.raw;
    });
    return L;
  }

  /* table header: which column each title is */
  const HEAD = [
    ['pile', /sand\s*pile/], ['drv', /driver/], ['start', /start/], ['end', /\bend\b|finish/],
    ['lbs', /pounds|\blbs?\b|sand\s*(used|pumped)/], ['n', /^(total\s+)?stages?(\s*(#|no\.?|number))?$/], ['day', /^(day|date)$/]
  ];
  function headKey(s) {
    const t = String(s).toLowerCase().replace(/\s+/g, ' ').trim();
    for (const [k, re] of HEAD) if (re.test(t)) return k;
    return null;
  }
  function headerOf(ln) {
    const cols = {};
    ln.cells.forEach(c => { const k = headKey(c.s); if (k && cols[k] == null) cols[k] = c.cx; });
    return cols.n != null && cols.lbs != null && (cols.start != null || cols.end != null) ? cols : null;
  }
  /* each cell goes to the column whose title sits closest over it */
  function byColumn(ln, cols) {
    const keys = Object.keys(cols);
    const xs = keys.map(k => cols[k]);
    const lo = Math.min.apply(null, xs) - 90, hi = Math.max.apply(null, xs) + 90;
    const out = {};
    ln.cells.forEach(c => {
      if (c.cx < lo || c.cx > hi) return;
      let best = null, bd = Infinity;
      keys.forEach(k => { const d = Math.abs(c.cx - cols[k]); if (d < bd) { bd = d; best = k; } });
      out[best] = out[best] ? out[best] + ' ' + c.s : c.s;
    });
    return out;
  }

  function numOf(s) {
    const m = String(s == null ? '' : s).replace(/,(?=\d{3}\b)/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? +m[0] : null;
  }
  /* "10:53 AM" · "22:26" · "9/28/2026 10:53 AM" → minutes after midnight */
  function clockOf(s) {
    const m = String(s == null ? '' : s).match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?\s*m?\.?/i);
    if (!m) return null;
    let h = +m[1];
    const mi = +m[2], ap = (m[3] || '').toLowerCase();
    if (ap && (h < 1 || h > 12)) return null;
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }
  function dateOf(s) {
    const m = String(s == null ? '' : s).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return null;
    let y = +m[3]; if (y < 100) y += 2000;
    const mo = +m[1], d = +m[2];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { y, mo, d };
  }
  const addDays = (dt, k) => { const u = new Date(Date.UTC(dt.y, dt.mo - 1, dt.d + k)); return { y: u.getUTCFullYear(), mo: u.getUTCMonth() + 1, d: u.getUTCDate() }; };

  /* "[1] 110,000 lbs - 20/40 11,000 lbs - 100 mesh" → [['20/40', 110000], ['100 mesh', 11000]].
     A note is read both ways, number first (how the crew writes it) and sand first ("20/40: 110,000");
     the reading that pairs more of it wins, so a number never goes with the sand of the next line.
     Stage labels go first ("Stage 12 100 mesh …" must not read as 12 lb). Sands: 20/40, 20-40, 2040,
     40/70, 100 mesh, 100M. */
  const SAND = '(\\d{2}\\s*[\\/\\-\u2013]\\s*\\d{2,3}|\\b(?:1630|2040|3050|4070|4080)\\b|100\\s*(?:mesh|m)\\b)';
  const NUM = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
  const NF = new RegExp(NUM + '\\s*(?:lbs?\\.?|pounds|#)?\\s*[-\u2013\u2014:=]?\\s*' + SAND + '(?![\\d/])', 'gi');
  const SF = new RegExp(SAND + '(?![\\d/])\\s*(?:sand)?\\s*[-\u2013\u2014:=]?\\s*' + NUM + '\\s*(?:lbs?\\b|pounds|#)?', 'gi');
  const STAGE_LABEL = /\b(?:stages?|stg|etapas?)\s*#?\s*\d{1,4}(?![\d,.])(?:\s*(?:[-\u2013&,]|and|y)\s*\d{1,4}(?![\d,.]))?/gi;
  /* a sand as written → its id: 20/40, 20-40 and 2040 are 2040; 100 mesh and 100M are 100M */
  function sandId(txt) {
    const t = String(txt).toLowerCase().replace(/\s+/g, '');
    if (/^100(mesh|m)$/.test(t)) return '100M';
    const m = /^(\d{2})[\/\-\u2013]?(\d{2,3})$/.exec(t);
    if (!m) return null;
    const a = +m[1], b = +m[2];
    return a >= 8 && b > a && b <= 200 ? String(a) + String(b) : null;
  }
  function pairsOf(text) {
    const tx = String(text || '').replace(STAGE_LABEL, ' ');
    const nf = [], sf = [];
    let m;
    NF.lastIndex = 0;
    while ((m = NF.exec(tx))) nf.push([m[2], +m[1].replace(/,/g, '')]);
    SF.lastIndex = 0;
    while ((m = SF.exec(tx))) sf.push([m[1], +m[2].replace(/,/g, '')]);
    return sf.length > nf.length ? sf : nf;
  }

  /* lbs of a stage with a total but no breakdown: split like the design of its segment */
  function designSplit(cfg, n, tot) {
    const sg = (cfg.segments || []).find(g => n >= +g.from && n <= +g.to);
    if (!sg || !(tot >= 0)) return null;
    const ids = (cfg.sands || []).map(s => s.id);
    const D = ids.map(s => Math.max(0, +((sg.lbs || {})[s]) || 0));
    const sum = D.reduce((a, b) => a + b, 0);
    if (!(sum > 0)) return null;
    const lbs = {};
    ids.forEach((s, i) => { if (D[i] > 0) lbs[s] = Math.round(tot * D[i] / sum); });
    return lbs;
  }

  /* the design of stage n: lbs per sand and total */
  function designOf(cfg, n) {
    const sg = (cfg.segments || []).find(g => n >= +g.from && n <= +g.to);
    const o = {};
    let tot = 0;
    (cfg.sands || []).forEach(s => { const v = sg ? Math.max(0, +((sg.lbs || {})[s.id]) || 0) : 0; o[s.id] = v; tot += v; });
    return { lbs: o, tot };
  }

  /* Start and end on the calendar. The "Day" column is the day the row was logged: a stage that
     crosses midnight (11:33 PM → 12:25 AM) carries the day it ended. Each stage starts at or after the
     previous one ends, so the reading that keeps that order wins. */
  function place(dt, sMin, eMin, prevEnd, tz, E) {
    const at = (d, m) => E.wallToEpoch(d.y, d.mo, d.d, Math.floor(m / 60), m % 60, 0, tz);
    if (!dt && prevEnd != null) { const p = E.wallParts(prevEnd, tz); dt = { y: p.y, mo: p.mo, d: p.d }; }
    if (!dt) return { start: null, end: null, noDate: true };
    if (sMin != null && eMin != null) {
      const dur = ((eMin - sMin) % 1440 + 1440) % 1440;
      const cands = [at(dt, sMin)];
      if (eMin < sMin) cands.push(at(addDays(dt, -1), sMin));
      let start;
      if (prevEnd != null) {
        const ok = cands.filter(t => t >= prevEnd - 10 * MIN).sort((a, b) => a - b);
        start = ok.length ? ok[0] : cands[0];
      } else start = eMin < sMin ? cands[1] : cands[0];
      return { start, end: start + dur * MIN, overlap: prevEnd != null && start < prevEnd - 10 * MIN };
    }
    if (eMin != null) {
      let end = at(dt, eMin);
      if (prevEnd != null && end < prevEnd) end += DAY;
      return { start: null, end };
    }
    if (sMin != null) {
      let start = at(dt, sMin);
      if (prevEnd != null && start < prevEnd - 10 * MIN) start += DAY;
      return { start, end: null };
    }
    return { start: null, end: null };
  }

  /* items → {title, well, stages[{n, s, e, lbs, tot, src}], warnings[{n, lvl, txt}]}
     s, e: epoch ms (null when the PDF does not say). lbs: {sandId: lb} — null when unknown.
     src: 'notes' (breakdown from the cell note) · 'fill' (a note short of the total, the rest like the
     design) · 'single' (one sand in the design) · 'split' (total split like the design) · 'none'. */
  function parse(items, cfg, E, now) {
    now = now == null ? Date.now() : now;
    const tz = cfg.tz || 'America/Mexico_City';
    const N = Math.max(1, Math.round(+(cfg.job && cfg.job.totalStages) || 0));
    const sandIds = new Set((cfg.sands || []).map(s => s.id));
    const label = id => { const s = (cfg.sands || []).find(x => x.id === id); return s ? s.label : id; };
    const lines = toLines(items);
    const warnings = [];
    const warn = (n, txt, lvl) => warnings.push({ n: n == null ? null : n, lvl: lvl || 'warn', txt });

    /* table rows */
    let cols = null, header = false;
    const rows = [];
    lines.forEach(ln => {
      const h = headerOf(ln);
      if (h) { cols = h; header = true; ln.used = true; return; }
      if (!cols) return;
      const c = byColumn(ln, cols);
      const nTxt = String(c.n || '').trim();
      if (!/^\d{1,4}$/.test(nTxt)) return;
      const hasData = c.lbs != null || c.start != null || c.end != null;
      if (!hasData) return;
      ln.used = true;
      rows.push({ n: +nTxt, c });
    });
    if (!header) throw new Error('No stage table in this PDF: it needs the "Total Stage", "Used Pounds" and "Stage Start/End Time" columns.');

    /* cell notes: "[1] …" and the lines under it, until the next note */
    const notes = {};
    let cur = null;
    lines.forEach(ln => {
      if (ln.used) { cur = null; return; }
      const m = /^\[(\d{1,4})\]\s*(.*)$/.exec(ln.text);
      if (m) { cur = m[1]; notes[cur] = (notes[cur] ? notes[cur] + ' ' : '') + m[2]; return; }
      if (cur) notes[cur] += ' ' + ln.text;
    });

    const byN = new Map();
    let prevEnd = null;
    rows.forEach(r => {
      const n = r.n, c = r.c;
      if (n < 1 || n > N) { warn(n, 'Stage ' + n + ' is outside this well (' + N + ' stages) · left out'); return; }
      const lbsCell = String(c.lbs || '');
      const tot = numOf(lbsCell.replace(/\[\d+\]/g, ''));
      const ref = (lbsCell.match(/\[(\d{1,4})\]/) || [])[1];
      let lbs = null, src = 'none', noted = false;
      const dsg = designOf(cfg, n);
      const lbTxt = o => Object.keys(o).map(k => label(k) + ' ' + fmtN(o[k])).join(' · ');
      if (ref && notes[ref] != null) {
        const pairs = pairsOf(notes[ref]);
        if (pairs.length) {
          noted = true;
          lbs = {};
          pairs.forEach(([sand, v]) => {
            const id = sandId(sand);
            if (!id || !sandIds.has(id)) { warn(n, 'Stage ' + n + ': ' + sand.trim() + ' is not a sand in this design · left out'); return; }
            lbs[id] = (lbs[id] || 0) + v;
          });
          const sum = Object.keys(lbs).reduce((p, k) => p + lbs[k], 0);
          if (!Object.keys(lbs).length) lbs = null;       // only sands outside the design: nothing is guessed
          else {
            src = 'notes';
            /* a note that falls well short of the total is missing a sand (or was misread): the lbs
               missing go to the design sands the note does not name, like the design */
            const miss = Object.keys(dsg.lbs).filter(k => dsg.lbs[k] > 0 && !(k in lbs));
            if (tot != null && tot > 0 && sum < 0.8 * tot) {
              const dm = miss.reduce((p, k) => p + dsg.lbs[k], 0);
              if (dm > 0) {
                const noteTxt = lbTxt(lbs);
                miss.forEach(k => { lbs[k] = Math.round((tot - sum) * dsg.lbs[k] / dm); });
                src = 'fill';
                warn(n, 'Stage ' + n + ': its note reads ' + noteTxt + ' and the total is ' + fmtN(tot) + ' lb · the ' + fmtN(tot - sum) + ' lb missing go to ' + miss.map(label).join(' and ') + ' · check the note', 'err');
              } else warn(n, 'Stage ' + n + ': its note adds up to ' + fmtN(sum) + ' lb and the total is ' + fmtN(tot) + ' lb · the note is used · check it', 'err');
            } else if (tot != null && tot > 0 && sum > 1.2 * tot) {
              warn(n, 'Stage ' + n + ': its note adds up to ' + fmtN(sum) + ' lb and the total is ' + fmtN(tot) + ' lb · the note is used · check it', 'err');
            } else if (tot != null && Math.abs(sum - tot) > 1) {
              warn(n, 'Stage ' + n + ': the total says ' + fmtN(tot) + ' lb and its sands add up to ' + fmtN(sum) + ' lb · the sands are used', 'info');
            }
          }
        }
      }
      if (!lbs && !noted && tot != null) {
        const sp = designSplit(cfg, n, tot);
        if (sp) {
          lbs = sp;
          src = Object.keys(sp).length === 1 ? 'single' : 'split';
          if (src === 'split') warn(n, 'Stage ' + n + ': no breakdown by sand · ' + fmtN(tot) + ' lb split like the design (' + lbTxt(sp) + ')');
        }
      }
      /* a stage far from its design is worth a look: a heavy stage or a screen-out */
      if (lbs && dsg.tot > 0) {
        const st = Object.keys(lbs).reduce((p, k) => p + lbs[k], 0);
        if (st > 1.6 * dsg.tot) warn(n, 'Stage ' + n + ': ' + fmtN(st) + ' lb, ' + Math.round((st / dsg.tot - 1) * 100) + '% over its design (' + fmtN(dsg.tot) + ' lb) · confirm it with the frac crew');
        else if (st < 0.5 * dsg.tot) warn(n, 'Stage ' + n + ': ' + fmtN(st) + ' lb, ' + Math.round((1 - st / dsg.tot) * 100) + '% under its design (' + fmtN(dsg.tot) + ' lb) · a screen-out? confirm it with the frac crew');
      }
      const dt = dateOf(c.day) || dateOf(c.start) || dateOf(c.end);
      const pl = place(dt, clockOf(c.start), clockOf(c.end), prevEnd, tz, E);
      let s = pl.start, e = pl.end;
      if (pl.noDate && (c.start || c.end)) warn(n, 'Stage ' + n + ': no day for its times · the calendar leaves them out');
      if ((e != null && e > now + 30 * MIN) || (s != null && s > now + 30 * MIN)) {
        warn(n, 'Stage ' + n + ' ends after now — check the day or AM/PM · its times are left out');
        s = null; e = null;
      }
      if (pl.overlap) warn(n, 'Stage ' + n + ' starts before stage ' + (n - 1) + ' ends · check its times');
      if (e == null && lbs) warn(n, 'Stage ' + n + ': no end time · its sand counts, the calendar uses the other stages', 'info');
      if (byN.has(n)) warn(n, 'Stage ' + n + ' appears twice · the last row is used');
      byN.set(n, { n, s: s == null ? null : s, e: e == null ? null : e, lbs, tot: tot == null ? null : tot, src });
      if (e != null) prevEnd = e;
    });
    const stages = Array.from(byN.values()).sort((a, b) => a.n - b.n);
    /* the well in the title: "1. Riley Horned Frog 5 Well Pad" */
    const first = lines.find(l => l.p === 1);
    const title = first && first.cells.length ? first.cells[0].s : '';
    const well = cfg.job && cfg.job.well ? String(cfg.job.well) : '';
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const wellMatch = !well || !title ? null : norm(title).includes(norm(well));
    if (wellMatch === false) warn(null, 'The PDF title says "' + title + '" and this well is ' + well + ' · check it is the right well');
    if (!stages.length) warn(null, 'The table has no stages yet', 'err');
    return { title, wellMatch, stages, warnings, notes: Object.keys(notes).length };
  }

  /* ============================== browser: read the PDF ==============================
     pdf.js (Mozilla, Apache-2.0) legacy build, vendored. It loads the first time a PDF is chosen and
     the service worker keeps it for later. Nothing is rendered: only the text and where it sits. */
  let _lib = null;
  function loadPdfJs() {
    if (_lib) return _lib;
    const base = new URL('assets/js/vendor/', document.baseURI).href;
    _lib = import(base + 'pdf.min.js').then(m => { m.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js'; return m; })
      .catch(() => { _lib = null; throw new Error('Could not load the PDF reader · check the connection and try again'); });
    return _lib;
  }
  async function readPdf(file) {
    const lib = await loadPdfJs();
    const data = new Uint8Array(await file.arrayBuffer());
    let doc;
    try { doc = await lib.getDocument({ data, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise; }
    catch (e) { throw new Error(e && e.name === 'PasswordException' ? 'The PDF has a password' : 'This file is not a readable PDF'); }
    try {
      const items = [];
      const pages = Math.min(doc.numPages, 60);
      for (let p = 1; p <= pages; p++) {
        const page = await doc.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        tc.items.forEach(it => {
          if (!it || typeof it.str !== 'string') return;
          const pt = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
          items.push({ p, s: it.str, x: pt[0], y: pt[1], w: it.width || 0 });
        });
        page.cleanup();
      }
      return { items, pages: doc.numPages };
    } finally { try { doc.destroy(); } catch (e) {} }
  }

  return { toLines, parse, pairsOf, sandId, clockOf, dateOf, readPdf };
});
