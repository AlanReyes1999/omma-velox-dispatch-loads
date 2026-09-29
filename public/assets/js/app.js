/* OMMA · Velox dispatch — application.
   Single cycle: Store (shared state) → Engine.build (model) → render of the active view.
   Semantic model for chartkit: one row = one load (slot). Dimensions: sand and carrier.
   Chart ids carry a view prefix (ce_, as_, av_, pl_, ar_) so each tab destroys its own. */
(function () {
  'use strict';
  const E = window.Engine, Seed = window.Seed, Store = window.Store, Viz = window.Viz, LP = window.LoadParser;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = Viz.esc;
  const HOUR = E.HOUR, DAY = E.DAY, MIN = E.MIN;
  const reducedMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ============================== icons (SVG, no emojis) ============================== */
  const sv = (p, w) => '<svg viewBox="0 0 24 24" width="' + (w || 18) + '" height="' + (w || 18) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const IC = {
    grid: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="m8 12.2 2.8 2.8L16.5 9"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    factory: '<path d="M2 20h20"/><path d="M4 20V10l5 3v-3l5 3V6l6 3v11"/><path d="M8 16.5h1.5M13 16.5h1.5M18 16.5h.01"/>',
    truck: '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    gauge: '<path d="M12 14l3.5-3.5"/><path d="M20.3 17.7A9 9 0 1 0 3.7 17.7"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    tick: '<polyline points="5 12.5 10 17 19 7.5"/>',
    flag: '<path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.5"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'
  };
  const VIEWS = [
    { key: 'command', label: 'Command', icon: IC.grid, prefix: 'ce' },
    { key: 'assign', label: 'Assign', icon: IC.check, prefix: 'as' },
    { key: 'progress', label: 'Progress', icon: IC.layers, prefix: 'av' },
    { key: 'plan', label: 'Plan', icon: IC.sliders, prefix: 'pl' },
    { key: 'mines', label: 'Mines', icon: IC.factory, prefix: 'ar' }
  ];
  /* links and installed apps from the Spanish version keep working */
  const VIEW_ALIAS = { centro: 'command', asignar: 'assign', avance: 'progress', areneras: 'mines' };
  function viewKey(h) { h = String(h || '').replace('#', ''); h = VIEW_ALIAS[h] || h; return VIEWS.find(v => v.key === h) ? h : null; }

  /* ============================== colors ============================== */
  const SAND_COLOR = { '100M': '#7DCFB6', '4070': '#9D8FCB', '2040': '#F4B860' };
  const SAND_DARK = { '100M': '#2F8A6C', '4070': '#6A5CA3', '2040': '#9A6420' };
  const SAND_ACC = { '100M': 'a-mint', '4070': 'a-lav', '2040': 'a-amber' };
  const CARRIER_PALETTE = ['#1E6B7A', '#6BAED6', '#F08080', '#15384A', '#C99A17', '#8C63AC'];
  const FIXED_CARRIER = { MAXCARGO: '#1E6B7A', JE: '#F4B860', MASIV: '#9D8FCB', MEDRANOS: '#F08080', RENTROL: '#7DCFB6' };
  const MINE_COLOR = { IRONOAK: '#6A5CA3', IRONHORSE: '#C88B3D' };
  const GHOST = '#E3E8EF';

  /* ============================== UI state ============================== */
  const LS_UI = 'ovd.ui.v2';
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS_UI) || '{}'); } catch (e) { return {}; } })();
  /* carrier '' = no carrier: dispatch checks loads off without entering it; it can be set later on the row */
  const ui = {
    view: 'command', unit: saved.unit || 'loads', carrier: '', basis: saved.basis || 'asg',
    asStatus: 'all', asQuery: '', gapRange: saved.gapRange || '48', sbMode: saved.sbMode === 'sand' || saved.sbMode === 'arena' ? 'sand' : 'general',
    segPick: null, draft: null, dirty: false, lastLogKey: null, pendingList: false, upload: null, stats: null,
    flash: null, bump: null, fold: true, foldIds: null, lastNext: undefined, fcWas: null
  };
  function saveUI() { try { localStorage.setItem(LS_UI, JSON.stringify({ unit: ui.unit, basis: ui.basis, gapRange: ui.gapRange, sbMode: ui.sbMode })); } catch (e) {} }

  let S = null;   // shared state
  let M = null;   // computed model

  /* ============================== formatting (en-US, 12-hour clock) ============================== */
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const tz = () => (S && S.config && S.config.tz) || 'America/Mexico_City';
  const pad = n => String(n).padStart(2, '0');
  const pad3 = k => String(k).padStart(3, '0');
  function wp(t) { return E.wallParts(t, tz()); }
  function wdIdx(p) { return new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay(); }
  const ap = p => (p.h < 12 ? 'AM' : 'PM');
  const h12 = p => (p.h % 12) || 12;
  function fTime(t) { if (t == null) return '—'; const p = wp(t); return h12(p) + ':' + pad(p.mi) + ' ' + ap(p); }
  /* compact time for chart axes: "6 AM" · "6:30 AM" */
  function fHour(t) { const p = wp(t); return h12(p) + (p.mi ? ':' + pad(p.mi) : '') + ' ' + ap(p); }
  function fDay(t) { if (t == null) return '—'; const p = wp(t); return WD[wdIdx(p)] + ' ' + MO[p.mo - 1] + ' ' + p.d; }
  function fDayShort(t) { const p = wp(t); return MO[p.mo - 1] + ' ' + p.d; }
  function fDT(t) { if (t == null) return '—'; return fDay(t) + ' · ' + fTime(t); }
  /* time only when it is today; otherwise weekday + time (buttons and short chips) */
  function fWhen(t) { if (t == null) return '—'; const a = wp(t), b = wp(Date.now()); return (a.y === b.y && a.mo === b.mo && a.d === b.d) ? fTime(t) : WD[wdIdx(a)] + ' ' + fTime(t); }
  function fDayKey(k) { const [y, m, d] = k.split('-').map(Number); return WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] + ' ' + MO[m - 1] + ' ' + d; }
  function fRel(t, now) {
    if (t == null) return '—';
    now = now || Date.now();
    const d = t - now, a = Math.abs(d);
    if (a < 60e3) return 'now';
    const m = Math.round(a / MIN);
    let s;
    if (m < 60) s = m + 'm';
    else if (m < 1440) s = Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm';
    else s = Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h';
    return d > 0 ? 'in ' + s : s + ' ago';
  }
  function cd(t, cls) {
    const now = Date.now();
    const c = t < now ? 'late' : (t - now < 2 * HOUR ? 'soon' : '');
    return '<span class="cd ' + (cls || c) + '" data-cd="' + t + '">' + fRel(t, now) + '</span>';
  }
  const nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const stg = n => 'Stg ' + n;
  /* "PO-1236" already says PO; "SPA00021226" gets the label */
  const poTxt = po => !po ? 'PO —' : (/^po[\s#:-]/i.test(po) ? po : 'PO ' + po);
  function uLbl() { return ui.unit === 'loads' ? 'loads' : ui.unit === 'lbs' ? 'lb' : 'tons'; }
  function uVal(loads, lbs) { return ui.unit === 'loads' ? loads : ui.unit === 'lbs' ? lbs : lbs / E.LBS_PER_TON; }
  function uFmt(v) { return ui.unit === 'tons' ? nf1.format(v) : fmt.int(Math.round(v)); }
  function uTxt(loads, lbs) { return uFmt(uVal(loads, lbs)); }
  /* value + unit, singular for one load: "1 load", "3 loads", "51,350 lb" */
  function uN(v) { return uFmt(v) + ' ' + (ui.unit === 'loads' && Math.round(v) === 1 ? 'load' : uLbl()); }
  function uTN(loads, lbs) { return uFmt(uVal(loads, lbs)) + ' ' + (ui.unit === 'loads' && loads === 1 ? 'load' : uLbl()); }
  function uAxis(v) { return ui.unit === 'loads' ? fmt.int(v) : fmt.numK(v); }
  function lbsTxt(v) { return fmt.int(Math.round(v)) + ' lb'; }
  function tonsTxt(v) { return nf1.format(v / E.LBS_PER_TON) + ' tons'; }
  function sandLabel(s) { const x = S.config.sands.find(q => q.id === s); return x ? x.label : s; }
  function mineOf(id) { return S.config.mines.find(m => m.id === id) || { name: id, place: '' }; }
  function carriers() { return S.config.carriers || []; }
  function carrierName(id) { const c = carriers().find(x => x.id === id); return c ? c.name : (id || '—'); }
  function carrierColor(id) {
    const cs = carriers();
    const i = cs.findIndex(x => x.id === id);
    const c = cs[i];
    if (c && FIXED_CARRIER[String(c.name).toUpperCase()]) return FIXED_CARRIER[String(c.name).toUpperCase()];
    return CARRIER_PALETTE[i >= 0 ? i % CARRIER_PALETTE.length : 5];
  }
  function slotChip(x) { return '<span class="sl s-' + x.s + '"><i></i>' + esc(sandLabel(x.s)) + ' · ' + pad3(x.k) + '</span>'; }
  const STATUS_TX = { late: 'Overdue', now: 'Assign now', next: 'Scheduled', eta: 'En route', arr: 'Arrived (est.)', del: 'Delivered', extra: 'Surplus' };
  function stPill(st) { return '<span class="st ' + st + '">' + STATUS_TX[st] + '</span>'; }
  const nL = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const SRC_TX = { data: 'data', manual: 'manual', plan: 'plan', mine: 'mine', estimated: 'estimated', assumed: 'assumed', export: 'export' };
  function srcTag(src) { return '<span class="src ' + esc(src) + '">' + esc(SRC_TX[src] || src) + '</span>'; }
  function haptic(ms) { try { if (navigator.vibrate && window.matchMedia && matchMedia('(pointer: coarse)').matches) navigator.vibrate(ms); } catch (e) {} }

  /* ============================== model + filters ============================== */
  function rebuild() {
    M = E.build(S.config, S, Date.now());
    defineModel({
      rows: M.slots,
      dims: {
        sand: Object.assign(r => sandLabel(r.s), { label: 'Sand' }),
        carrier: Object.assign(r => r.asg ? (r.carrier ? carrierName(r.carrier) : 'No carrier') : 'Unassigned', { label: 'Carrier' })
      },
      measures: { loads: rs => rs.length, lbs: rs => rs.reduce((p, r) => p + r.w, 0) }
    });
  }
  const sandOn = s => inSel(state.sand, sandLabel(s));
  const carrierOn = c => inSel(state.carrier, c ? carrierName(c) : 'No carrier');
  const carrierFilterActive = () => state.carrier !== 'all' && state.carrier && state.carrier.size;
  function selSands() { return S.config.sands.map(s => s.id).filter(sandOn); }

  /* ============================== chart upsert ============================== */
  const HIDDEN = {};   // layers switched off from the legend: chartId → Set(series label)
  function chart(id, cfg, after) {
    const el = document.getElementById(id);
    if (!el || el.offsetParent === null) return null;
    const hid = HIDDEN[id];
    if (hid && cfg.data && cfg.data.datasets) cfg.data.datasets.forEach(d => { if (hid.has(d.label)) d.hidden = true; });
    const ex = CHZ[id];
    let ch;
    if (ex && ex.canvas === el && ex.config.type === cfg.type) {
      const t = cfg.type, o = cfg.options = cfg.options || {};
      if (t === 'doughnut' || t === 'pie') o.interaction = Object.assign({ mode: 'nearest', intersect: true }, o.interaction || {});
      else if (t === 'scatter' || t === 'bubble') o.interaction = Object.assign({ mode: 'nearest', intersect: false }, o.interaction || {});
      else if (o.indexAxis === 'y') o.interaction = Object.assign({ mode: 'index', intersect: false, axis: 'y' }, o.interaction || {});
      const uh = o.onHover;
      o.onHover = function (e, els, c) { try { c.canvas.style.cursor = (els && els.length) ? 'pointer' : 'default'; } catch (_) {} if (uh) uh(e, els, c); };
      ex.data = cfg.data; ex.options = o;
      try { ex.update('none'); } catch (e) { console.warn('[chart] update', id, e); ch = mkChart(id, cfg); }
      ch = ch || ex;
    } else {
      ch = mkChart(id, cfg);
    }
    if (ch && after) after(ch);
    return ch;
  }
  /* HTML legend under the chart: each series is a layer that toggles on and off (click or Enter)
     items: {label, color|swatch, line, ds (series label if different), toggle:false = read only} */
  const SW = {
    dash: c => 'repeating-linear-gradient(90deg,' + c + ' 0 4px,transparent 4px 7px)',
    dots: c => 'repeating-linear-gradient(90deg,' + c + ' 0 2px,transparent 2px 5px)',
    sands: dark => 'linear-gradient(90deg,' + (dark ? '#2F8A6C 0 33%,#6A5CA3 33% 66%,#9A6420 66%' : '#7DCFB6 0 33%,#9D8FCB 33% 66%,#F4B860 66%') + ')'
  };
  function legend(id, items) {
    const cv = document.getElementById(id);
    if (!cv || !cv.parentElement) return;
    const host = cv.parentElement;
    let el = host.nextElementSibling;
    if (!el || !el.classList.contains('lgd')) { el = document.createElement('div'); el.className = 'legend lgd'; host.after(el); }
    const hid = HIDDEN[id] || new Set();
    el.innerHTML = items.map(it => {
      const key = it.ds || it.label;
      const tog = it.toggle !== false;
      return '<span class="legend-item' + (it.line ? ' ln' : '') + (tog && hid.has(key) ? ' off' : '') + (tog ? '' : ' fixed') + '"' +
        (tog ? ' data-lg="' + id + '" data-ds="' + esc(key) + '" role="button" tabindex="0" aria-pressed="' + !hid.has(key) + '"' : '') + '>' +
        '<i class="legend-dot" style="background:' + (it.swatch || it.color) + '"></i>' + esc(it.label) + '</span>';
    }).join('');
  }
  function toggleLayer(el) {
    const id = el.dataset.lg, key = el.dataset.ds;
    const set = HIDDEN[id] = HIDDEN[id] || new Set();
    if (set.has(key)) set.delete(key); else set.add(key);
    const ch = CHZ[id];
    if (ch) { ch.data.datasets.forEach((d, i) => { if (d.label === key) ch.setDatasetVisibility(i, !set.has(key)); }); ch.update(); }
    el.classList.toggle('off', set.has(key));
    el.setAttribute('aria-pressed', String(!set.has(key)));
  }
  /* count Y axis: integers for loads and lbs, and a minimum top when everything is 0 (avoids "0 0 0 0") */
  function yCount(max, extra) {
    const y = gYf(uAxis);
    y.ticks = Object.assign({}, y.ticks, ui.unit === 'tons' ? {} : { precision: 0 });
    if (!(max > 0)) y.suggestedMax = ui.unit === 'loads' ? 5 : ui.unit === 'lbs' ? 250000 : 125;
    return Object.assign(y, extra || {});
  }

  /* vertical "now" line (category or linear axis) */
  Chart.register({
    id: 'nowLine',
    afterDatasetsDraw(c, a, o) {
      if (!o || o.x == null) return;
      const xs = c.scales.x, ar = c.chartArea;
      if (!xs || !ar) return;
      const px = xs.getPixelForValue(o.x);
      if (!isFinite(px) || px < ar.left || px > ar.right) return;
      const ctx = c.ctx;
      ctx.save();
      ctx.strokeStyle = 'rgba(230,162,60,.9)'; ctx.lineWidth = 1.4; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(px, ar.top); ctx.lineTo(px, ar.bottom); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "800 9.5px 'JetBrains Mono', ui-monospace, monospace";
      const tx = o.label || 'NOW', w = ctx.measureText(tx).width + 10;
      ctx.fillStyle = '#E6A23C'; ctx.beginPath();
      rrect(ctx, Math.min(px - w / 2, ar.right - w), ar.top - 1, w, 15, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(tx, Math.min(px - w / 2, ar.right - w) + 5, ar.top + 6.5);
      ctx.restore();
    }
  });

  /* ============================== sliding thumb for segmented controls ==============================
     FLIP: the thumb takes its final width and position, starts from the old box as a transform and
     slides back to identity — transform only, so it never triggers layout while it moves. */
  function syncSegs(root) {
    (root ? [root] : $$('.seg')).forEach(seg => {
      if (!seg || seg.offsetParent === null) return;
      seg.querySelectorAll(':scope > button').forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('on'))));
      const on = seg.querySelector(':scope > button.on');
      let th = seg.querySelector(':scope > .seg-thumb');
      if (!on) { if (th) th.style.opacity = '0'; return; }
      let first = false;
      if (!th) { th = document.createElement('span'); th.className = 'seg-thumb'; th.setAttribute('aria-hidden', 'true'); seg.prepend(th); seg.classList.add('thumbed'); first = true; }
      const x = on.offsetLeft, w = on.offsetWidth, y = on.offsetTop, h = on.offsetHeight;
      const px = +th.dataset.x, pw = +th.dataset.w;
      if (px === x && pw === w && th.style.opacity === '1') return;
      th.style.width = w + 'px'; th.style.height = h + 'px'; th.style.top = y + 'px';
      th.style.opacity = '1';
      if (!first && pw && !reducedMotion()) {
        th.style.transition = 'none';
        th.style.transform = 'translateX(' + px + 'px) scaleX(' + (pw / w).toFixed(4) + ')';
        void th.offsetWidth;
        th.style.transition = '';
      }
      th.style.transform = 'translateX(' + x + 'px)';
      th.dataset.x = x; th.dataset.w = w;
    });
  }

  /* ============================== actions ============================== */
  function toast(html, action, ms) {
    const box = $('#toasts');
    const el = document.createElement('div');
    const life = ms || (action ? 6500 : 3200);
    el.className = 'toast';
    el.innerHTML = '<span>' + html + '</span>' + (action ? '<button type="button">' + action.label + '</button><i class="tt-bar" style="animation-duration:' + life + 'ms"></i>' : '');
    if (action) el.querySelector('button').addEventListener('click', () => { action.fn(); close(); });
    box.appendChild(el);
    let t = setTimeout(close, life);
    function close() { clearTimeout(t); el.classList.add('out'); setTimeout(() => el.remove(), 200); }
    while (box.children.length > 3) box.firstElementChild.remove();
  }
  function modal(title, bodyHTML, actions) {
    const m = $('#modal');
    /* focus goes back where it was (or to the same load's check box if the row was redrawn) */
    const prevFocus = document.activeElement;
    const prevTick = prevFocus && prevFocus.dataset ? prevFocus.dataset.tick : null;
    $('#modalT').textContent = title;
    $('#modalB').innerHTML = bodyHTML;
    const A = $('#modalA');
    A.innerHTML = '';
    actions.forEach(a => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn ' + (a.cls || ''); b.textContent = a.label;
      b.addEventListener('click', () => { const r = a.fn ? a.fn() : true; if (r !== false) close(); });
      A.appendChild(b);
    });
    m.hidden = false;
    const inp = m.querySelector('input');
    const prim = A.querySelector('.primary');
    setTimeout(() => { if (inp) inp.focus(); else if (prim) prim.focus(); }, 60);
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Enter' && inp && document.activeElement === inp) { const p = A.querySelector('.primary'); if (p) p.click(); return; }
      if (e.key === 'Tab') {                                   // keep Tab inside the dialog
        const f = Array.from(m.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(x => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    }
    function onBg(e) { if (e.target === m) close(); }
    document.addEventListener('keydown', onKey); m.addEventListener('click', onBg);
    function close() {
      m.hidden = true; document.removeEventListener('keydown', onKey); m.removeEventListener('click', onBg);
      setTimeout(() => {
        const back = prevFocus && document.contains(prevFocus) ? prevFocus : (prevTick ? $('#asList [data-tick="' + prevTick + '"]') : null);
        if (back && back.focus) back.focus({ preventScroll: true });
      }, 80);
    }
    return close;
  }
  /* one click and done: initials are optional (set from the sync indicator) */
  function withMe(cb) { return cb(); }
  function slotById(id) { return M.slots.find(x => x.id === id) || null; }
  function loadName(x, num) { return '#' + (num || x.seq) + ' · ' + esc(sandLabel(x.s)) + ' · ' + pad3(x.k); }

  /* undo: the last actions of this session, newest first (toast button or Ctrl/Cmd+Z) */
  const UNDO = [];
  function pushUndo(label, fn) {
    const entry = { label, fn, done: false };
    entry.run = () => { if (entry.done) return; entry.done = true; const i = UNDO.indexOf(entry); if (i >= 0) UNDO.splice(i, 1); fn(); };
    UNDO.push(entry);
    if (UNDO.length > 30) UNDO.shift();
    return entry.run;
  }
  function undoLast() {
    const e = UNDO[UNDO.length - 1];
    if (!e) { toast('Nothing to undo'); return; }
    e.run();
    toast('Undone: ' + e.label);
  }

  /* ---------- final counts: at 80% of loads assigned, confirm with the frac crew ---------- */
  const fcPctTxt = () => Math.round((M.kpi.fcPct || 0.8) * 100) + '%';
  /* the gate opens when an action takes the well into final counts: the first time, and again if assigned
     loads fell back below the line after a confirmation (Undo restores without asking) */
  function fcNeedsGate(nAdd) {
    const k = M.kpi;
    return k.reqLoads > 0 && (k.asgNeeded + nAdd) >= k.fcAt && (!S.fc || k.asgNeeded < k.fcAt);
  }
  function remainingHTML(nAddBySand) {
    return S.config.sands.map(sd => {
      const x = M.sands[sd.id];
      const left = Math.max(0, x.nNeeded - x.nAssignedNeeded - ((nAddBySand && nAddBySand[sd.id]) || 0));
      return '<span class="fc-chip"><i style="background:' + SAND_COLOR[sd.id] + '"></i>' + esc(sd.label) + ' <b>' + left + '</b></span>';
    }).join('');
  }
  function fcGateHTML(nAdd, addBySand) {
    const k = M.kpi, after = k.asgNeeded + nAdd;
    return '<div class="fc-gate"><p>' + (k.fcOn
      ? 'The well is in <b>final counts</b> (' + nf1.format(k.pct * 100) + '% of loads assigned) and nobody has logged a frac crew confirmation yet.'
      : 'This takes the well to <b>' + nf1.format(after / k.reqLoads * 100) + '%</b> of its loads (<b>' + after + '</b> of ' + k.reqLoads + '). From load <b>#' + k.fcAt + '</b> on we are in <b>final counts</b>.') +
      '</p><p><b>Confirm load assignments with the frac crew</b> before assigning more.</p><div class="fc-rem"><span class="fc-rl">Loads left per the design</span>' + remainingHTML(addBySand) + '</div></div>';
  }
  /* who confirmed matters: when this device has no initials yet, the confirmation asks for them once */
  const meField = () => Store.me() ? '' : '<label class="fld fc-me"><span>Your initials <em>required · dispatch sees who confirmed</em></span><input type="text" id="fcMe" maxlength="12" autocomplete="off" placeholder="e.g. AR" aria-required="true"></label>';
  /* true when this device knows who is confirming; otherwise flags the field and keeps the dialog open */
  function takeMe() {
    if (Store.me()) return true;
    const i = $('#fcMe'); const v = i ? (i.value || '').trim().toUpperCase() : '';
    if (v) { Store.setMe(v); return true; }
    if (i) {
      i.classList.add('err'); i.setAttribute('aria-invalid', 'true'); i.focus();
      if (!i.parentElement.querySelector('.fc-err')) {
        i.insertAdjacentHTML('afterend', '<span class="fc-err" id="fcMeErr" role="alert">Type your initials to log the confirmation.</span>');
        i.setAttribute('aria-describedby', 'fcMeErr');
        /* the warning goes away as soon as there is something typed */
        i.addEventListener('input', function clear() {
          if (!i.value.trim()) return;
          i.classList.remove('err'); i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby');
          const e = i.parentElement && i.parentElement.querySelector('.fc-err'); if (e) e.remove();
          i.removeEventListener('input', clear);
        });
      }
    }
    return false;
  }
  function logFc(n) {
    if (!takeMe()) return false;
    Store.dispatch({ type: 'fc', n: n == null ? M.kpi.asgNeeded : n });
    const run = pushUndo('frac crew confirmation', () => Store.dispatch({ type: 'fcClear' }));
    toast('Final counts confirmed with the frac crew', { label: 'Undo', fn: run });
  }
  function confirmFc() {
    modal('Final counts · ' + fcPctTxt(), fcGateHTML(0) + '<p class="mut" style="margin-top:10px">Log it once the frac crew confirmed the loads they still need. Everyone in dispatch will see who confirmed and when.</p>' + meField(),
      [{ label: 'Cancel', cls: 'ghost' }, { label: 'Confirmed with frac crew', cls: 'primary', fn: () => logFc() !== false }]);
  }

  function assign(slot, c, fromEl) {
    const x = slotById(slot);
    if (!x || S.asg[slot]) return;
    if (x.needed && fcNeedsGate(1)) {
      modal('Final counts · ' + fcPctTxt(), fcGateHTML(1, { [x.s]: 1 }) + meField(), [
        { label: 'Cancel', cls: 'ghost' },
        { label: 'Confirmed with frac crew · assign', cls: 'primary', fn: () => { if (!takeMe()) return false; Store.dispatch({ type: 'fc', n: M.kpi.asgNeeded + 1 }); doAssign(x, c, fromEl); } }
      ]);
      return;
    }
    doAssign(x, c, fromEl);
  }
  function doAssign(x, c, fromEl) {
    c = c != null ? c : ui.carrier;
    const num = x.needed ? M.kpi.asgNeeded + 1 : null;     // its load number once assigned
    const sx = M.sands[x.s];
    const completes = x.needed && sx.nAssignedNeeded + 1 >= sx.nNeeded;
    if (fromEl) flyGrain(fromEl, x.s);
    ui.flash = x.id; ui.bump = { s: x.s, n: 1, lbs: x.w };
    haptic(12);
    Store.dispatch({ type: 'asg', slot: x.id, c });
    const run = pushUndo('assign ' + (num ? '#' + num : x.id), () => { ui.flash = x.id; ui.bump = { s: x.s, n: -1, lbs: -x.w }; Store.dispatch({ type: 'unasg', slot: x.id }); });
    toast('Assigned <b>' + (num ? loadName(x, num) : esc(x.id)) + '</b> · +' + lbsTxt(x.w) + ' on location', { label: 'Undo', fn: run });
    if (completes) setTimeout(() => toast('All <b>' + sx.nNeeded + '</b> loads of <b>' + esc(sandLabel(x.s)) + '</b> are assigned'), 700);
  }
  function unassign(slot) {
    const prev = S.asg[slot];
    if (!prev) return;
    const x = slotById(slot);
    ui.flash = slot;
    ui.bump = x ? { s: x.s, n: -1, lbs: -x.w } : null;
    haptic(8);
    Store.dispatch({ type: 'unasg', slot });
    const run = pushUndo('remove ' + (x ? '#' + x.seq : slot), () => { ui.flash = slot; ui.bump = x ? { s: x.s, n: 1, lbs: x.w } : null; Store.dispatch({ type: 'asg', slot, c: prev.c, t: prev.t, o: prev.o }); });
    toast('Removed <b>' + (x ? loadName(x) : esc(slot)) + '</b>', { label: 'Undo', fn: run });
  }
  /* range: every pending load from the next one up to the chosen one, in queue order */
  function rangeRows(toId) {
    const target = slotById(toId);
    if (!target || target.asg || !target.needed) return [];
    return qRows().filter(r => !r.asg && r.seq <= target.seq);
  }
  function rangeAssign(toId, fromEl) {
    const rows = rangeRows(toId);
    if (!rows.length) return;
    if (rows.length === 1) { assign(rows[0].id, null, fromEl); return; }
    const n = rows.length, first = M.kpi.asgNeeded + 1, last = M.kpi.asgNeeded + n;
    const bySand = {};
    rows.forEach(r => { bySand[r.s] = (bySand[r.s] || 0) + 1; });
    const mix = S.config.sands.filter(s => bySand[s.id]).map(s => '<span class="fc-chip"><i style="background:' + SAND_COLOR[s.id] + '"></i>' + esc(s.label) + ' <b>' + bySand[s.id] + '</b></span>').join('');
    const gate = fcNeedsGate(n);
    const doIt = () => {
      if (gate) { if (!takeMe()) return false; Store.dispatch({ type: 'fc', n: last }); }
      const ids = rows.map(r => r.id);
      if (fromEl) flyGrain(fromEl, rows[rows.length - 1].s);
      ui.flash = rows[rows.length - 1].id;
      ui.bump = { s: rows[rows.length - 1].s, n, lbs: rows.reduce((p, r) => p + r.w, 0) };
      haptic(18);
      Store.dispatch({ type: 'bulk', items: ids.map(slot => ({ slot, c: ui.carrier || '' })), txt: 'range #' + first + '–#' + last });
      const run = pushUndo('range #' + first + '–#' + last, () => Store.dispatch({ type: 'unbulk', slots: ids, txt: 'range #' + first + '–#' + last }));
      toast('Assigned <b>#' + first + '–#' + last + '</b> · ' + n + ' loads', { label: 'Undo', fn: run });
    };
    modal('Assign ' + n + ' loads', '<p>Assign loads <b>#' + first + '–#' + last + '</b> in queue order.</p><div class="fc-rem">' + mix + '</div>' + (gate ? fcGateHTML(n, bySand) + meField() : ''),
      [{ label: 'Cancel', cls: 'ghost' }, { label: gate ? 'Confirmed with frac crew · assign ' + n : 'Assign ' + n + ' loads', cls: 'primary', fn: doIt }]);
  }
  function setCarrier(slot, c) {
    const prev = S.asg[slot];
    if (!prev || prev.c === c) return;
    withMe(() => {
      Store.dispatch({ type: 'setc', slot, c });
      const run = pushUndo('carrier change', () => Store.dispatch({ type: 'setc', slot, c: prev.c }));
      const x = slotById(slot);
      toast('<b>' + (x ? loadName(x) : esc(slot)) + '</b>: ' + esc(carrierName(prev.c)) + ' → ' + esc(carrierName(c)), { label: 'Undo', fn: run });
    });
  }

  /* ============================== shell ============================== */
  function renderNav() {
    const badge = () => {
      const k = M ? M.kpi : null;
      if (!k) return '';
      if (k.overdue) return '<span class="bdg">' + k.overdue + '</span>';
      if (k.nowWindow) return '<span class="bdg warn">' + k.nowWindow + '</span>';
      return '';
    };
    const html = VIEWS.map(v => '<button type="button" class="nvb' + (ui.view === v.key ? ' on' : '') + '" data-view="' + v.key + '" aria-label="' + v.label + '"' + (ui.view === v.key ? ' aria-current="page"' : '') + '>' +
      sv(v.icon, 20) + '<span>' + v.label + '</span>' + (v.key === 'assign' ? badge() : '') + '</button>').join('');
    /* rebuilt only when it changes: keeps keyboard focus and does not replay the active marker */
    if ($('#railItems').dataset.sig === html) return;
    $('#railItems').dataset.sig = html;
    $('#railItems').innerHTML = html;
    $('#tabbar').innerHTML = html;
  }
  function renderSync() {
    const b = $('#sync');
    const pend = Store.pending.length;
    b.className = 'sync ' + Store.mode + (pend && Store.mode === 'remote' ? ' pending' : '');
    const tx = Store.mode === 'remote' ? (pend ? 'Sending ' + pend : 'Live')
      : Store.mode === 'offline' ? 'Offline' + (pend ? ' · ' + pend : '')
        : Store.mode === 'local' ? 'Local mode' : 'Connecting…';
    b.querySelector('.stx').textContent = tx;
    b.title = Store.mode === 'local' ? 'Check marks are saved on this device only (no Netlify function)' :
      Store.mode === 'offline' ? 'Offline: changes are sent when the network is back' : 'Synced with all dispatch';
  }
  function phaseText() {
    const w = M.well, now = Date.now();
    if (w.phase === 'pre') return { cls: 'pre', html: 'PREFILL <b>' + fRel(w.prefillStart, now).toUpperCase() + '</b> · FRAC ' + fDT(w.fracStart).toUpperCase() };
    if (w.phase === 'prefill') return { cls: 'prefill', html: (w.prefillEnd != null && now >= w.prefillEnd ? 'PREFILL COMPLETE' : 'PREFILL IN PROGRESS') + ' · FRAC <b>' + fRel(w.fracStart, now).toUpperCase() + '</b>' };
    if (w.phase === 'frac') return { cls: 'frac', html: 'FRAC · STAGE <b>' + w.curStage + '/' + w.N + '</b> · EST. END ' + fDT(w.end).toUpperCase() };
    return { cls: 'done', html: 'WELL COMPLETE · <b>' + w.N + '/' + w.N + '</b>' };
  }
  function renderShell() {
    const c = S.config;
    $('#brandSub').textContent = c.job.well + ' · ' + c.job.client + ' · ' + c.job.totalStages + ' stages';
    document.title = 'Dispatch · ' + c.job.well;
    const ph = phaseText();
    const pe = $('#phase');
    pe.className = 'phase ' + ph.cls;
    pe.innerHTML = '<span class="dot ' + (ph.cls === 'frac' ? 'live' : 'neutral') + '"></span><span class="ph-t">' + ph.html + '</span>';
    renderSync();
    renderNav();
    $$('#unitSeg button').forEach(b => b.classList.toggle('on', b.dataset.u === ui.unit));
    renderChips();
    renderFilterBar();
    renderTicker();
    renderWarnings();
    $('#railFoot').textContent = 'v' + (S.v || 0) + ' · ' + (Store.mode === 'remote' ? 'sync' : Store.mode);
    const up = S.updatedAt ? Date.parse(S.updatedAt) : null;
    $('#foot').innerHTML = '<span>MEDS Logistics © 2026 — FILIALES/OMMA · ' + esc(c.job.well) + ' · ' + fDay(Date.now()) + '</span>' +
      '<span class="asm">' + (up ? 'shared state ' + fDT(up) + ' · ' : '') + 'v' + (S.v || 0) + ' · assumptions editable in Plan</span>';
  }
  function renderChips() {
    const sands = S.config.sands;
    const cntS = {};
    rowsF('sand').filter(r => r.needed).forEach(r => { cntS[r.s] = (cntS[r.s] || 0) + 1; });
    const sc = $('#chipsSand');
    sc.setAttribute('data-chips', 'sand');
    sc.innerHTML = '<button type="button" class="chip all' + (state.sand === 'all' ? ' active' : '') + '" data-v="all" aria-pressed="' + (state.sand === 'all') + '">All</button>' +
      sands.map(s => { const on = state.sand !== 'all' && setHas(state.sand, s.label); return '<button type="button" class="chip' + (on ? ' active' : '') + '" data-v="' + esc(s.label) + '" aria-pressed="' + on + '"><span class="cdot" style="background:' + SAND_COLOR[s.id] + '"></span>' + esc(s.label) + ' <span class="n">' + (cntS[s.id] || 0) + '</span></button>'; }).join('');
    const cc = $('#chipsCarrier');
    cc.setAttribute('data-chips', 'carrier');
    const cntC = {};
    let cntNone = 0;
    rowsF('carrier').forEach(r => { if (!r.asg || !r.needed) return; if (r.carrier) cntC[r.carrier] = (cntC[r.carrier] || 0) + 1; else cntNone++; });
    const cchip = (name, color, n) => { const on = state.carrier !== 'all' && setHas(state.carrier, name); return '<button type="button" class="chip' + (on ? ' active' : '') + '" data-v="' + esc(name) + '" aria-pressed="' + on + '"><span class="cdot" style="background:' + color + '"></span>' + esc(name) + ' <span class="n">' + n + '</span></button>'; };
    cc.innerHTML = '<button type="button" class="chip all' + (state.carrier === 'all' ? ' active' : '') + '" data-v="all" aria-pressed="' + (state.carrier === 'all') + '">All</button>' +
      cchip('No carrier', '#C8D0DA', cntNone) + carriers().map(c => cchip(c.name, carrierColor(c.id), cntC[c.id] || 0)).join('');
    $('#fnote').textContent = carrierFilterActive() ? 'With a carrier filter only its assigned loads show' : '';
  }
  function chipClick(dim) {
    return e => {
      const b = e.target.closest('.chip'); if (!b) return;
      const v = b.dataset.v;
      if (v === 'all') { state[dim] = 'all'; syncChips(dim); renderFilterBar(); renderSoon(); }
      else crossFilter(dim, v);
    };
  }
  function renderTicker() {
    const k = M.kpi, it = [];
    const P = M.params;
    S.config.mines.forEach(mi => {
      const s = S.config.sands.find(x => x.mine === mi.id);
      if (!s) return;
      const p = P[s.id];
      it.push('<span class="tk-it"><i style="background:' + MINE_COLOR[mi.id] + '"></i>' + esc(mi.name) + ' · <b>' + (mi.miles || '—') + '</b> MI · PAYLOAD <b>' + fmt.int(p.payload) + '</b> LB · LEAD <b class="t">' + E.fmtDur(p.leadMin) + '</b></span>');
    });
    const seg = M.segPlans[Math.max(0, M.well.segIdx)] || M.segPlans[M.segPlans.length - 1];
    if (seg) {
      S.config.sands.forEach(s => {
        const q = seg.per[s.id];
        if (!q || !q.loadsPerDay) return;
        it.push('<span class="tk-it"><i style="background:' + SAND_COLOR[s.id] + '"></i>' + esc(s.label) + ' <b>' + nf1.format(q.loadsPerDay) + '</b> LOADS/DAY · 1 EVERY <b>' + E.fmtDur(q.everyMin) + '</b></span>');
      });
      it.push('<span class="tk-it">' + (seg.fc ? 'PACE <b>' + nf1.format(seg.pace) + '</b> STG/DAY · DESIGN <b>' + nf1.format(seg.designPace) + '</b>' : 'DESIGN PACE <b>' + nf1.format(seg.pace) + '</b> STG/DAY') + (seg.sustainPace ? ' · SUSTAINABLE WITH PLANNED TRUCKS <b class="' + (seg.sustainPace < seg.pace ? 'r' : 'g') + '">' + nf1.format(seg.sustainPace) + '</b>' : '') + '</span>');
    }
    if (k.next) it.push('<span class="tk-it">NEXT <b>#' + k.next.seq + ' · ' + esc(sandLabel(k.next.s)) + ' ' + pad3(k.next.k) + '</b> · ASSIGN BY <b class="a">' + fDT(k.next.ab).toUpperCase() + '</b></span>');
    it.push('<span class="tk-it">OVERDUE <b class="' + (k.overdue ? 'r' : 'g') + '">' + k.overdue + '</b> · IN WINDOW <b class="a">' + k.nowWindow + '</b> · NEXT 24 H <b>' + k.next24 + '</b></span>');
    it.push('<span class="tk-it">ASSIGNED <b class="t">' + fmt.int(k.asgNeeded) + '</b> / ' + fmt.int(k.reqLoads) + ' LOADS · ' + nf1.format(k.pct * 100) + '%</span>');
    if (k.reqLoads) it.push(k.fcOn
      ? '<span class="tk-it">FINAL COUNTS · <b class="a">' + (S.fc ? 'CONFIRMED' + (S.fc.by ? ' BY ' + esc(String(S.fc.by).toUpperCase()) : '') : 'CONFIRM WITH THE FRAC CREW') + '</b></span>'
      : '<span class="tk-it">FINAL COUNTS AT <b>' + fcPctTxt() + '</b> · LOAD <b>#' + k.fcAt + '</b> · <b class="t">' + k.fcLeft + '</b> TO GO</span>');
    it.push('<span class="tk-it">OMMA DELIVERED <b>' + k.ommaLoads + '</b> LOADS · <b>' + fmt.int(k.ommaLbs) + '</b> LB</span>');
    it.push('<span class="tk-it">WELL TOTAL <b>' + fmt.int(k.reqLbs) + '</b> LB · <b>' + nf1.format(k.reqLbs / 2000) + '</b> TONS</span>');
    const html = it.join('');
    const tr = $('#tkTrack');
    if (tr.dataset.sig !== html) {
      tr.dataset.sig = html;
      tr.innerHTML = html + html;
      requestAnimationFrame(() => { const w = tr.scrollWidth / 2; tr.style.setProperty('--tk-dur', Math.max(30, Math.round(w / 45)) + 's'); });
    }
  }
  function renderWarnings() {
    const w = M.warnings.slice();
    if (M.kpi.invalid.length) w.push({ lvl: 'warn', txt: M.kpi.invalid.length + ' assignment(s) do not match the current design (' + M.kpi.invalid.slice(0, 4).join(', ') + (M.kpi.invalid.length > 4 ? '…' : '') + ')' });
    /* loads assigned beyond what the design now needs drop out of the queue: say so */
    const sur = M.slots.filter(x => !x.needed && x.asg);
    if (sur.length) {
      const by = {};
      sur.forEach(x => { by[x.s] = (by[x.s] || 0) + 1; });
      w.push({ lvl: 'warn', txt: nL(sur.length, 'assigned load is', 'assigned loads are') + ' beyond the current design (surplus: ' + Object.keys(by).map(s => sandLabel(s) + ' × ' + by[s]).join(', ') + '). They no longer count toward the well; check the design in Plan.' });
    }
    const bar = $('#warnbar');
    if (!w.length) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.className = 'warnbar' + (w.some(x => x.lvl === 'err') ? ' err' : '');
    bar.innerHTML = sv(IC.alert, 16) + '<ul>' + w.map(x => '<li>' + esc(x.txt) + '</li>').join('') + '</ul>';
  }

  /* ============================== COMMAND ============================== */
  let spiral = null;
  function renderCommand() {
    const k = M.kpi, now = Date.now();
    const req = rowsF('carrier').filter(r => r.needed);                     // required: follows the sand filter
    const reqLbs = selSands().reduce((p, s) => p + M.tb.R[s], 0);
    const asg = rowsF().filter(r => r.needed && r.asg);                   // assigned: follows the carrier filter
    const asgLbs = asg.reduce((p, r) => p + r.w, 0);
    const due = req.filter(r => r.ab <= now);
    const pend = req.filter(r => !r.asg);
    /* the cadence belongs to the well, not to a carrier: the gap always compares everything assigned (with the sand filter) */
    const gap = req.filter(r => r.asg).length - due.length;
    const gapLbs = req.filter(r => r.asg).reduce((p, r) => p + r.w, 0) - due.reduce((p, r) => p + r.w, 0);
    const overdue = pend.filter(r => r.status === 'late').length;
    const inWin = pend.filter(r => r.status === 'now').length;
    const next = pend.slice().sort((a, b) => a.seq - b.seq)[0] || null;
    const ga = S.config.gapAlert || { warn: 2, alert: 5 };
    const perDay = M.days.map(d => selSands().reduce((p, s) => p + (d.loads[s] || 0), 0));
    const cov = covFor(ui.basis);
    const basisTx = { asg: 'with assigned sand', est: 'with delivered sand (est.)', omma: 'with OMMA deliveries' }[ui.basis];
    const gapSig = sigClass(gap, { alert: -ga.alert, warn: -ga.warn, better: 'high' });
    const reqU = uTxt(req.length, reqLbs);
    const asgN = carrierFilterActive() ? asg.length : req.filter(r => r.asg).length;
    const asgW = carrierFilterActive() ? asgLbs : req.filter(r => r.asg).reduce((p, r) => p + r.w, 0);
    const pctA = ui.unit === 'loads' ? (req.length ? asgN / req.length : 0) : (reqLbs ? asgW / reqLbs : 0);   // same basis as the unit on screen
    const cards = [
      kpiCard({ label: 'Well requirement', value: reqU, unit: uLbl(), icon: sv(IC.layers, 16), accent: 'a-teal', i: 0, id: 'req',
        badge: '<span class="gr neu">' + M.N + ' stages</span>', series: perDay, sparkStyle: 'bars',
        foot: '<span>' + (ui.unit === 'loads' ? lbsTxt(reqLbs) : req.length + ' loads') + '</span><b>' + tonsTxt(reqLbs) + '</b>' }),
      kpiCard({ label: carrierFilterActive() ? 'Assigned · filtered' : 'Assigned', value: uTxt(asgN, asgW), unit: uLbl(),
        icon: sv(IC.check, 16), accent: 'a-sky', i: 1, id: 'asg', badge: '<span class="gr neu">' + nf1.format(pctA * 100) + '%</span>',
        foot: '<span>To go <b>' + fmt.int(pend.length) + '</b></span><span>final counts <b>#' + k.fcAt + '</b></span>' }),
      kpiCard({ label: 'Gap vs cadence', value: (gap > 0 ? '+' : gap < 0 ? '−' : '') + uFmt(Math.abs(uVal(gap, gapLbs))), unit: uLbl(), icon: sv(IC.activity, 16),
        accent: gap < -ga.warn ? 'a-danger' : gap < 0 ? 'a-warn' : 'a-success', i: 2, id: 'gap',
        badge: '<span class="gr ' + (gap < 0 ? 'bad' : gap > 0 ? 'good' : 'neu') + (gapSig ? ' ' + gapSig : '') + '"><span class="arw">' + (gap < 0 ? '↓' : gap > 0 ? '↑' : '→') + '</span>' + (gap < 0 ? 'behind' : gap > 0 ? 'ahead' : 'on plan') + '</span>',
        foot: '<span>Overdue <b>' + overdue + '</b></span><span>in window <b>' + inWin + '</b></span>' + (carrierFilterActive() ? '<span>all carriers</span>' : '') }),
      kpiCard({ label: 'Stages covered', value: fmt.int(Math.floor(cov.pos + 1e-9)), unit: '/ ' + M.N, icon: sv(IC.target, 16), accent: 'a-mint', i: 3, id: 'cov',
        badge: '<span class="gr neu">' + (ui.basis === 'asg' ? 'assigned' : ui.basis === 'est' ? 'delivered est.' : 'OMMA actual') + '</span>',
        foot: '<span>sand for <b>' + nf2.format(cov.pos) + '</b> stg</span><span><b>' + esc(cov.lim ? sandLabel(cov.lim) : '—') + '</b> limits</span>' }),
      next ? kpiCard({ label: 'Next to assign', value: '#' + next.seq, unit: esc(sandLabel(next.s)) + ' · ' + pad3(next.k), icon: sv(IC.clock, 16), accent: next.status === 'late' ? 'a-danger' : 'a-amber', i: 4, id: 'next',
        badge: '<span class="st q' + qStatus(next) + '">' + QST[qStatus(next)] + '</span>', foot: '<span>' + esc(mineOf(next.mine).name) + ' · ' + stg(next.stage) + '</span><span><b>' + esc(poTxt(next.po)) + '</b></span>' })
        : kpiCard({ label: 'Next to assign', value: 'All set', icon: sv(IC.clock, 16), accent: 'a-success', i: 4, foot: '<span>No pending loads with the current filter</span>' })
    ];
    paintKpis('#ceKpis', cards);
    $('#ceMeta').innerHTML = '<span class="pill">' + esc(basisTx) + '</span><span class="pill">as of ' + fTime(now) + '</span>';

    renderSpiral(cov);      /* 01 · spiral */
    renderNextList(pend, overdue, inWin);   /* 02 · next */
    renderRouteLanes();     /* 03 · route */
    renderGapChart();       /* 04 · gap tracker */
    renderSandDonut();      /* 05 · assigned sand by type */
    renderSandCards();      /* 06 · sand ledger */
    renderStream();         /* 07 · activity log */
  }

  /* how far does the sand cover? (by basis and sand filter) */
  function covFor(basis) {
    const ss = selSands();
    let pos = M.N, lim = null;
    ss.forEach(s => { const p = M.sands[s].cov[basis]; if (p < pos) { pos = p; lim = s; } });
    return { pos, lim };
  }
  function paintKpis(sel, cards) {
    const box = $(sel);
    const sig = cards.join('');
    if (box.dataset.sig === sig) return;
    const first = !box.children.length;
    const prevVals = Array.from(box.querySelectorAll('.k-val>span')).map(x => x.textContent);
    box.innerHTML = sig;
    box.dataset.sig = sig;
    if (!first) box.querySelectorAll('.k-val').forEach((el, i) => { if (prevVals[i] !== el.firstElementChild.textContent) flipValue(el); });
    else box.classList.add('rise');
    attachCardGlow(box);
  }

  function renderSpiral(cov) {
    const cv = $('#spiral');
    if (!cv) return;
    if (!spiral) {
      spiral = new Viz.Spiral(cv, {
        onHover: (st, e) => { if (st && e) showScFloat(cv, e, stageHTML(st)); else hideScFloat(cv); },
        onPick: (st, e) => { if (st) showDetail(e, 'Stage ' + st.n + ' · ' + st.segTx, stageRows(st)); }
      });
      new ResizeObserver(() => { spiral.resize(); spiral.draw(); }).observe(cv.parentElement);
    }
    const w = M.well, ss = selSands();
    const posOf = b => { let p = M.N; ss.forEach(s => { p = Math.min(p, M.sands[s].cov[b]); }); return p; };
    const cA = posOf('asg'), cE = posOf('est');
    const done = w.lastRep ? w.lastRep.n : 0;
    const segBounds = [];
    const stages = [];
    for (let i = 1; i <= M.N; i++) {
      const si = M.tb.segOf[i];
      if (i > 1 && si !== M.tb.segOf[i - 1]) segBounds.push(i - 1);
      let dom = null, mx = -1;
      S.config.sands.forEach(s => { const v = M.tb.d[s.id][i]; if (v > mx) { mx = v; dom = s.id; } });
      const isDone = i <= done;
      const coveredE = cE >= i - 1e-9, coveredA = cA >= i - 1e-9;
      const partial = !coveredA && cA > i - 1;
      const cur = w.phase === 'frac' && i === w.curStage;
      let fill, stroke, status;
      if (isDone) { fill = '#1B2538'; stroke = '#fff'; status = 'Completed (actual report)'; }
      else if (coveredE) { fill = '#1E6B7A'; stroke = '#fff'; status = 'Covered · delivered (est.)'; }
      else if (coveredA) { fill = '#6BAED6'; stroke = '#fff'; status = 'Covered · assigned'; }
      else if (partial) { fill = '#D0E5F2'; stroke = '#6BAED6'; status = 'Partly covered · assigned'; }
      else { fill = '#FFFFFF'; stroke = '#C8D0DA'; status = 'No sand assigned'; }
      stages.push({ n: i, fill, stroke, status, cur, color: SAND_COLOR[dom] || '#9AA6B6', seg: si,
        segTx: si >= 0 ? 'segment ' + S.config.segments[si].from + '–' + S.config.segments[si].to : 'no segment',
        start: M.sc.B[i - 1], end: M.sc.B[i], lbs: S.config.sands.map(s => [s.id, M.tb.d[s.id][i]]) });
    }
    const pace = w.pace ? w.pace.v : w.designPace;
    const speed = w.phase === 'frac' ? 0.32 * Math.max(0.3, Math.min(2, pace / 19)) : 0;
    spiral.set(stages, speed, { bounds: segBounds });
    const badge = $('#wellBadge');
    badge.textContent = w.phase === 'prefill' && w.prefillEnd != null && Date.now() >= w.prefillEnd ? 'prefill complete' : { pre: 'before prefill', prefill: 'prefill', frac: 'pumping', done: 'complete' }[w.phase];
    badge.className = 'pbadge' + (w.phase === 'frac' ? ' ok' : w.phase === 'prefill' ? ' warn' : '');
    $('#coLeft').innerHTML = '<div class="k">Pace</div><div class="v">' + nf1.format(w.pace ? w.pace.v : w.designPace) + '<small>stg/day</small></div><div class="s">' + (w.pace ? 'actual · design ' + nf1.format(w.designPace) : 'from design') + '</div>';
    $('#coRight').innerHTML = '<div class="k">Coverage</div><div class="v">' + nf2.format(cov.pos) + '<small>stages</small></div><div class="s">' + ({ asg: 'assigned', est: 'delivered est.', omma: 'OMMA actual' }[ui.basis]) + (cov.lim ? ' · ' + esc(sandLabel(cov.lim)) + ' limits' : '') + '</div>';
    $('#spLegend').innerHTML = [['#1B2538', '#1B2538', 'Completed'], ['#1E6B7A', '#1E6B7A', 'Delivered (est.)'], ['#6BAED6', '#6BAED6', 'Assigned'], ['#fff', '#C8D0DA', 'No sand'], ['#fff', '#E6A23C', 'Current stage']]
      .map(x => '<span><i style="background:' + x[0] + ';border-color:' + x[1] + '"></i>' + x[2] + '</span>').join('');
    const enRoute = M.slots.filter(x => x.status === 'eta' && sandOn(x.s) && carrierOn(x.carrier)).length;
    $('#wellStats').innerHTML =
      '<div><div class="k">Current stage</div><div class="v t">' + (w.phase === 'pre' || w.phase === 'prefill' ? '—' : w.curStage + '<small class="mut"> / ' + w.N + '</small>') + '</div></div>' +
      '<div><div class="k">Frac start</div><div class="v">' + fDT(w.fracStart) + '</div></div>' +
      '<div><div class="k">Est. end</div><div class="v">' + fDT(w.end) + '</div></div>' +
      '<div><div class="k">En route</div><div class="v a">' + enRoute + ' <small class="mut">loads</small></div></div>';
  }
  function stageRows(st) {
    const rows = [['Segment', st.segTx], ['Start (plan)', fDT(st.start)], ['End (plan)', fDT(st.end)]];
    st.lbs.forEach(([s, v]) => { if (v > 0) rows.push([sandLabel(s), lbsTxt(v)]); });
    rows.push(['Status', st.status]);
    return rows;
  }
  function stageHTML(st) {
    return '<div class="schead">Stage ' + st.n + ' · ' + esc(st.segTx) + '</div>' + stageRows(st).slice(1).map(r => scRow(r[0], esc(r[1]))).join('');
  }

  function renderNextList(pend, overdue, inWin) {
    const list = pend.slice().sort((a, b) => a.seq - b.seq).slice(0, 6);
    const b = $('#nextBadge');
    b.textContent = overdue ? nL(overdue, 'overdue', 'overdue') : list.length ? 'next #' + list[0].seq : 'complete';
    b.className = 'pbadge ' + (overdue ? 'bad' : list.length ? '' : 'ok');
    $('#nextList').innerHTML = list.length ? list.map((x, i) =>
      '<div class="nx' + (i === 0 ? ' first' : '') + (x.status === 'late' ? ' late' : '') + '"><div class="nx-seq">#' + x.seq + '</div><div class="who"><div class="t1">' + slotChip(x) + (i === 0 ? '<span class="nxtag">Next</span>' : '') + '</div>' +
      '<div class="t2">' + esc(mineOf(x.mine).name) + ' · ' + esc(poTxt(x.po)) + ' · ' + stg(x.stage) + (x.prefill ? ' · prefill' : '') + '</div></div>' +
      '<button type="button" class="go" data-assign="' + x.id + '">Assign</button></div>').join('')
      : '<div class="empty">Every load in the design is assigned.</div>';
  }
  function renderRouteLanes() {
    const now = Date.now();
    const lanes = S.config.mines.map(mi => {
      const sands = S.config.sands.filter(s => s.mine === mi.id).map(s => s.id);
      const p = M.params[sands[0]];
      const loads = M.slots.filter(x => x.status === 'eta' && sands.includes(x.s) && sandOn(x.s) && carrierOn(x.carrier)).map(x => ({
        p: (now - x.asgT) / M.params[x.s].leadMs, color: carrierColor(x.carrier),
        title: '#' + x.seq + ' · ' + x.id + ' · ' + carrierName(x.carrier) + ' · assigned ' + fTime(x.asgT) + ' · arrives ~' + fTime(x.eta)
      }));
      return { id: mi.id, name: mi.name, place: mi.place, miles: mi.miles || '—', leadTxt: p ? E.fmtDur(p.leadMin) : '—', color: MINE_COLOR[mi.id] || '#1E6B7A', loads };
    });
    const tot = lanes.reduce((p, l) => p + l.loads.length, 0);
    $('#routeBadge').textContent = tot + ' en route';
    Viz.renderRoute($('#route'), { lanes, wellShort: (S.config.job.well || '').split(' ').slice(0, 2).join(' ') });
    const eta = M.slots.filter(x => x.status === 'eta' && sandOn(x.s) && carrierOn(x.carrier)).sort((a, b) => a.eta - b.eta);
    const nh = $('#pRoute .subnote');
    if (nh) nh.outerHTML = subNote({ kind: 'read', read: eta.length
      ? '<b>' + eta.length + '</b> en route; the next one arrives ~<b>' + fTime(eta[0].eta) + '</b> (' + loadName(eta[0]) + (eta[0].carrier ? ' · ' + esc(carrierName(eta[0].carrier)) : '') + '). Each dot sits by its assignment time and the mine lead time.'
      : 'No loads en route. Each assigned load shows up here by its assignment time and the mine lead time.' });
  }

  function renderGapChart() {
    const now = Date.now();
    const all = ui.gapRange === 'all';
    /* 48 h around now; before the prefill the window looks ahead (6 h back, 42 h ahead) */
    const back = M.well.phase === 'pre' ? 6 : 24;
    const from = all ? null : Math.floor((now - back * HOUR) / HOUR) * HOUR;
    const to = all ? null : from + 48 * HOUR;
    const filt = x => sandOn(x.s);
    const base = E.cumulativeSeries(M, { unit: ui.unit, filter: filt, from, to, step: all ? 2 * HOUR : HOUR });
    const cf = carrierFilterActive() ? E.cumulativeSeries(M, { unit: ui.unit, filter: x => filt(x) && (!x.asg || carrierOn(x.carrier)), from, to, step: all ? 2 * HOUR : HOUR }) : null;
    const labels = base.t.map(t => all ? fDayShort(t) + ' ' + fHour(t) : (wp(t).h === 0 ? fDayShort(t) : fHour(t)));
    const nowIdx = base.t.findIndex(t => t >= now);
    $('#gapRange').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.r === ui.gapRange));
    /* with a carrier filter the total stays as context (gray) and the selected carrier gets the color */
    const baseCol = carrierFilterActive() ? '#8A97A8' : '#1E6B7A';
    const ds = [
      { type: 'line', label: 'Assigned', data: base.asg, borderColor: baseCol, backgroundColor: c => c.chart.chartArea ? oGrad(c.chart.ctx, c.chart.chartArea, baseCol, .16, 0) : oA(baseCol, .1),
        fill: true, pointRadius: 0, pointHoverRadius: 6, borderWidth: 2.4, tension: .25, spanGaps: false, order: 2 },
      { type: 'line', label: 'Required (cadence)', data: base.req, borderColor: '#1B2538', borderDash: [6, 4], borderWidth: 1.8, pointRadius: 0, tension: .1, order: 1, endLabel: false }
    ];
    let cfColor = null;
    if (cf) {
      const nm = Array.from(state.carrier).join(' + ');
      const c0 = carriers().find(c => setHas(state.carrier, c.name));
      cfColor = c0 ? carrierColor(c0.id) : '#6BAED6';
      ds.push({ type: 'line', label: 'Assigned to ' + nm, data: cf.asg, borderColor: cfColor, borderWidth: 2, pointRadius: 0, order: 0 });
    }
    const ymax = Math.max(0, ...base.req, ...base.asg.filter(v => v != null));
    chart('ce_gap', {
      type: 'line', data: { labels, datasets: ds },
      options: {
        layout: { padding: { right: 46, top: 16 } },
        scales: { x: Object.assign({}, gX, { ticks: Object.assign({}, gX.ticks, { maxTicksLimit: 9 }) }), y: yCount(ymax) },
        plugins: {
          endLabel: { enabled: true, fmt: v => uFmt(v) },
          nowLine: { x: nowIdx >= 0 ? nowIdx : null },
          tooltip: tt3({
            title: it => fDT(base.t[it[0].dataIndex]),
            label: c => ' ' + c.dataset.label + ': ' + (c.parsed.y == null ? '—' : uN(c.parsed.y)),
            rows: i => {
              const r = base.req[i], a = base.asg[i];
              const out = [];
              if (a != null) {
                const g = a - r;
                out.push('Cumulative gap: ' + (g >= 0 ? '+' : '−') + uN(Math.abs(g)) + (r ? ' (' + (g >= 0 ? '+' : '−') + nf1.format(Math.abs(g / r * 100)) + '%)' : ''));
              }
              out.push('Left to assign: ' + uN(Math.max(0, base.total - (a == null ? base.asg.filter(v => v != null).slice(-1)[0] || 0 : a))) + ' of ' + uFmt(base.total));
              const t0 = base.t[i], t1 = t0 + (all ? 2 : 1) * HOUR;
              const dueH = M.slots.filter(x => x.needed && filt(x) && x.ab >= t0 && x.ab < t1).length;
              out.push('Due in this window: ' + nL(dueH, 'load', 'loads'));
              out.push('click opens the queue →');
              return out;
            }
          })
        },
        onClick: (e, els) => {
          const i = els && els.length ? els[0].index : null;
          if (i == null) return;
          setTimeout(() => { ui.asStatus = 'all'; go('assign'); }, 0);   // leaving the view destroys this chart: not inside its own event
        }
      }
    }, ch => attachLivePoint(ch, { datasetIndex: 0, color: baseCol }));
    legend('ce_gap', [{ label: 'Assigned', color: baseCol }, { label: 'Required (cadence)', swatch: SW.dash('#1B2538'), line: true }]
      .concat(cf ? [{ label: ds[2].label, color: cfColor, line: true }] : []).concat([{ label: 'Now', swatch: SW.dots('#E6A23C'), line: true, toggle: false }]));
    chartNote('ce_gap', { read: gapRead(base, nowIdx), kind: 'detail', act: 'click opens the queue →' });
  }
  function gapRead(base, nowIdx) {
    if (nowIdx < 0) return 'Outside the window: switch to <b>Whole well</b> to see the full cumulative.';
    const i = Math.max(0, nowIdx - 1);
    const a = base.asg[i] || 0, r = base.req[i] || 0, g = a - r;
    if (!r && !a) return 'No loads are due yet in this window; the cadence starts with the prefill.';
    return g < 0 ? '<b>' + uN(-g) + ' behind</b> the cadence: assign overdue loads before scheduled ones.'
      : 'Assignment is <b>' + (g > 0 ? uN(g) + ' ahead' : 'right on cadence') + '</b>.';
  }

  /* 05 · assigned sand by type: doughnut with center = total assigned; click filters the sand */
  function renderSandDonut() {
    const rows = rowsF('sand').filter(r => r.needed && r.asg);
    const agg = S.config.sands.map(sd => {
      const rs = rows.filter(r => r.s === sd.id);
      return { s: sd.id, name: sd.label, n: rs.length, lbs: rs.reduce((p, r) => p + r.w, 0), req: M.sands[sd.id].nNeeded, reqLbs: M.sands[sd.id].R };
    });
    const vals = agg.map(a => uVal(a.n, a.lbs));
    const tot = vals.reduce((p, v) => p + v, 0);
    const cols = agg.map(a => sandOn(a.s) ? SAND_COLOR[a.s] : oA(SAND_COLOR[a.s], .28));
    const empty = tot === 0;
    $('#carBadge').textContent = nL(rows.length, 'load', 'loads');
    chart('ce_sand', {
      type: 'doughnut',
      data: { labels: empty ? ['No assignments'] : agg.map(a => a.name), datasets: [{ data: empty ? [1] : vals, backgroundColor: empty ? ['#E5E9F0'] : cols, hoverOffset: empty ? 0 : 8 }] },
      options: {
        cutout: '66%',
        plugins: {
          crosshair: false,
          doughnutCenter: { value: uFmt(tot), text: uLbl() + ' assigned' },
          tooltip: empty ? { enabled: true, callbacks: { label: () => ' No assignments yet', afterBody: () => [SEP, 'Check off loads in Assign'] } } : tt3({
            title: it => it[0].label + ' · ' + mineOf(S.config.sands[it[0].dataIndex].mine).name,
            label: c => ' ' + uN(c.parsed) + ' · ' + (tot ? nf1.format(c.parsed / tot * 100) : 0) + '% of assigned',
            rows: i => {
              const a = agg[i], x = M.sands[a.s];
              return ['Assigned: ' + a.n + ' of ' + a.req + ' loads (' + nf1.format(a.req ? a.n / a.req * 100 : 0) + '%)',
                'Covers through stage ' + nf1.format(x.cov.asg) + ' · ' + (a.req - a.n) + ' loads to go', 'PO: ' + (x.po || '—'), 'click filters the board →'];
            }
          })
        },
        onClick: empty ? () => setTimeout(() => go('assign'), 0) : onMarkClick('sand')
      }
    }, ch => attachHoverDim(ch));
    $('#carList').innerHTML = agg.map((a, i) => '<div class="dnrow' + (sandOn(a.s) ? '' : ' dim') + (state.sand !== 'all' && sandOn(a.s) ? ' act' : '') + '" data-ci="' + i + '" data-sname="' + esc(a.name) + '">' +
      '<span class="sq" style="background:' + SAND_COLOR[a.s] + '"></span><span class="nm">' + esc(a.name) + ' <small class="mut">' + a.n + '/' + a.req + '</small></span><b>' + uFmt(vals[i]) + ' <span class="pc">' + (a.req ? nf1.format(a.n / a.req * 100) : '0.0') + '%</span></b></div>').join('');
    const lead = agg.slice().sort((a, b) => (b.req ? b.n / b.req : 0) - (a.req ? a.n / a.req : 0))[0];
    const lag = agg.filter(a => a.req).slice().sort((a, b) => a.n / a.req - b.n / b.req)[0];
    chartNote('ce_sand', { read: empty ? 'No loads assigned yet; the split by sand appears with the first check mark.'
      : 'Furthest ahead: <b>' + esc(lead.name) + '</b> (' + nf1.format(lead.n / lead.req * 100) + '% of its design); furthest behind: <b>' + esc(lag.name) + '</b> (' + nf1.format(lag.n / lag.req * 100) + '%).', kind: 'filter' });
  }
  function renderSandCards() {
    const now = Date.now();
    const seg = M.segPlans[Math.max(0, M.well.segIdx)] || M.segPlans[0];
    const html = S.config.sands.map((s, i) => {
      const x = M.sands[s.id];
      const rows = x.slots.filter(r => r.needed);
      const asg = rows.filter(r => r.asg && carrierOn(r.carrier));
      const pend = rows.filter(r => !r.asg);
      const lbsA = asg.reduce((p, r) => p + r.w, 0);
      const q = seg && seg.per[s.id];
      const pct = rows.length ? asg.length / rows.length : 0;
      const nx = pend.slice().sort((a, b) => a.seq - b.seq)[0];
      const series = M.days.map(d => d.loads[s.id] || 0);
      const on = sandOn(s.id);
      return '<article class="gcard sand ' + SAND_ACC[s.id] + (on ? '' : ' dimcard') + '" data-sand="' + esc(s.label) + '" style="--i:' + i + (on ? '' : ';opacity:.5') + '">' +
        '<div class="top"><div class="nm"><i style="background:' + SAND_COLOR[s.id] + '"></i>' + esc(s.label) + '</div><div class="mn">' + esc(mineOf(s.mine).name) + '</div></div>' +
        '<div class="big">' + uTxt(asg.length, lbsA) + '<small>/ ' + uTN(rows.length, x.R) + '</small></div>' +
        '<div class="trk" title="Assignment progress for this sand"><i style="--s:' + pct.toFixed(4) + '"></i></div>' +
        '<div class="rows">' +
        '<span>Assigned · to go</span><b>' + asg.length + ' · ' + pend.length + '</b>' +
        '<span>Covers through</span><b class="' + (M.well.phase === 'frac' && x.cov.asg - M.well.xNow < (S.config.bufferStages || 2) ? 'r' : 'g') + '">' + stg(nf1.format(x.cov.asg)) + '</b>' +
        '<span>PO</span><b class="mono">' + esc(x.po || '—') + '</b>' +
        '<span>Loads/day</span><b>' + (q ? nf1.format(q.loadsPerDay) : '—') + '</b>' +
        '<span>Trucks req. · plan</span><b class="' + (q && q.trucksPlanned != null && q.trucksPlanned < q.trucksNeeded - 0.05 ? 'r' : '') + '">' + (q ? nf1.format(q.trucksNeeded) : '—') + ' · ' + (q && q.trucksPlanned != null ? q.trucksPlanned : 'no plan') + '</b>' +
        '<span>Payload · lead</span><b>' + fmt.int(x.params.payload) + ' lb · ' + E.fmtDur(x.params.leadMin) + '</b>' +
        '</div>' +
        '<div class="k-spark">' + sparkbars(series, { highlight: M.days.findIndex(d => d.day === E.dayKey(now, tz())) }) + '</div>' +
        '<div class="act"><button type="button" class="btn sm primary" data-assign-next="' + s.id + '"' + (nx ? '' : ' disabled') + '>Assign next' + (nx ? ' · #' + nx.seq : '') + '</button></div>' +
        subNote({ read: nx ? 'Next <b>#' + nx.seq + '</b> · ' + esc(s.label) + ' ' + pad3(nx.k) + ' · ' + stg(nx.stage) : 'Sand complete', kind: 'filter', act: 'click filters →' }) +
        '</article>';
    }).join('');
    const box = $('#sandCards');
    box.innerHTML = html;
    attachCardGlow(box);
  }
  /* log texts written by the Spanish version stay readable */
  const LEGACY_TX = [[/prefill 23–28 sep · frac 28 sep 06:00/g, 'prefill Sep 23–28 · frac Sep 28 6:00 AM'], [/conciliación/g, 'reconciliation'], [/corte de entregas/g, 'delivery cut-off'],
    [/fin prefill/g, 'prefill end'], [/\btramos\b/g, 'segments'], [/\betapas\b/g, 'stages'], [/parámetros/g, 'parameters'], [/valores manuales/g, 'manual values'], [/\btodas\b/g, 'all']];
  function legacy(t) { let s = String(t || ''); LEGACY_TX.forEach(([re, to]) => { s = s.replace(re, to); }); return s; }
  function logText(e) {
    const slot = e.slot ? '<b>' + esc(e.slot) + '</b>' : '';
    const tx = e.txt ? ' · ' + esc(legacy(e.txt)) : '';
    switch (e.type) {
      case 'asg': return 'Assigned ' + slot + ' → ' + esc(carrierName(e.c));
      case 'unasg': return 'Removed ' + slot + ' (' + esc(carrierName(e.c)) + ')';
      case 'setc': return 'Changed ' + slot + ': ' + esc(carrierName(e.from)) + ' → ' + esc(carrierName(e.c));
      case 'bulk': return 'Checked off <b>' + e.n + '</b> loads' + (e.c ? ' ' + esc(carrierName(e.c)) : '') + tx;
      case 'unbulk': return 'Undid <b>' + e.n + '</b> loads' + tx;
      case 'stage': return 'Reported stage <b>' + e.n + '</b> (' + fDT(Date.parse(e.at)) + ')';
      case 'stageDel': return 'Deleted stage report <b>' + e.n + '</b>';
      case 'cfg': return 'Saved the design' + (e.txt ? ': ' + esc(legacy(e.txt)) : '');
      case 'omma': return 'Uploaded OMMA loads: <b>' + e.n + '</b> (total ' + e.total + ')' + tx;
      case 'ommaClear': return 'Cleared the OMMA loads';
      case 'actual': return e.undo ? 'Undid a stage stats upload (' + e.total + ' stages kept)' : 'Uploaded stage stats: <b>' + e.n + '</b> stages (total ' + e.total + ')' + tx;
      case 'actualClear': return 'Cleared the stage stats (' + e.n + ' stages)';
      case 'resetAsg': return 'Reset assignments (' + e.n + ')';
      case 'init': return 'Started the shared state';
      case 'fc': return 'Confirmed final counts with the frac crew (<b>' + e.n + '</b> loads assigned)';
      case 'fcClear': return 'Cleared the final counts confirmation';
      case 'reseed': return e.patch != null ? 'Updated the well setup' + tx : 'Loaded the well starting point: <b>' + e.n + '</b> loads already assigned' + tx;
      default: return esc(e.type);
    }
  }
  function renderStream() {
    const L = (S.log || []).slice().reverse().filter(e => !e.c || carrierOn(e.c)).slice(0, 40);
    const key = L.length ? L[0].t + L[0].type + (L[0].slot || '') : '';
    const prevKey = ui.lastLogKey;
    $('#logBadge').textContent = nL((S.log || []).length, 'event', 'events');
    let seenPrev = false;
    $('#stream').innerHTML = L.length ? L.map(e => {
      const k = e.t + e.type + (e.slot || '');
      const isNew = prevKey && !seenPrev && k !== prevKey;
      if (k === prevKey) seenPrev = true;
      const t = Date.parse(e.t);
      return '<div class="ev' + (isNew ? ' new' : '') + (e.type === 'fc' ? ' fc' : '') + '"><span class="tm">' + fTime(t) + '</span><span class="tx" title="' + esc(fDT(t)) + '">' + logText(e) + '</span><span class="by">' + esc(e.by || '—') + '</span></div>';
    }).join('') : '<div class="empty">Every assignment, stage report and file upload shows up here.</div>';
    ui.lastLogKey = key;
  }

  /* ============================== ASSIGN ==============================
     The queue is a single numbered sequence in the order loads have to be assigned (no days or hours).
     Load number = order of assignment: the 37 already assigned are #1–#37 and #38 is next.
     Checking a load off counts it as sand on location; the bar on top adds it up, overall or by sand,
     and animates every load that goes in. The list is patched row by row, never redrawn whole. */
  const QST = { asg: 'Assigned', next: 'Scheduled', late: 'Overdue' };
  function qStatus(r) { return r.asg ? 'asg' : r.status === 'late' ? 'late' : 'next'; }
  function qRows() { return M.slots.filter(x => x.needed && sandOn(x.s) && (!carrierFilterActive() || (x.asg && carrierOn(x.carrier)))); }
  function qNext() { return M.slots.find(x => x.needed && !x.asg && sandOn(x.s)) || null; }
  function sandStats() {
    return S.config.sands.filter(s => sandOn(s.id)).map(sd => {
      const x = M.sands[sd.id];
      const a = x.slots.filter(r => r.needed && r.asg);
      return { s: sd.id, label: sd.label, mine: mineOf(sd.mine).name, po: x.po, n: a.length, lbs: a.reduce((p, r) => p + r.w, 0), req: x.nNeeded, reqLbs: x.R, cov: x.cov.asg, payload: x.params.payload };
    });
  }
  const byLoads = () => ui.unit === 'loads';
  function totals(st) { return { tot: st.reduce((p, x) => p + x.lbs, 0), totN: st.reduce((p, x) => p + x.n, 0), req: st.reduce((p, x) => p + x.reqLbs, 0), reqN: st.reduce((p, x) => p + x.req, 0) }; }
  /* share of the bar for one sand, in the unit on screen (loads by count, lbs and tons by weight) */
  function fracOf(x, T) { return byLoads() ? (T.reqN ? x.n / T.reqN : 0) : (T.req ? x.lbs / T.req : 0); }
  function sandFrac(x) { return byLoads() ? (x.req ? x.n / x.req : 0) : (x.reqLbs ? x.lbs / x.reqLbs : 0); }
  /* where the final counts line sits on the overall bar: 80% of loads, or the lbs on location at that load */
  function fcFrac(T) {
    const k = M.kpi;
    if (byLoads()) return k.fcPct;
    const x = M.slots.find(s => s.needed && s.seq === k.fcAt);
    return x && T.req ? Math.min(1, x.cumAll / T.req) : k.fcPct;
  }
  /* sand already pumped up to the well's current position (for the consumption mark) */
  function consumedLbs(s) {
    const pos = Math.max(0, Math.min(M.N, M.well.xNow || 0));
    if (M.well.phase === 'pre' || M.well.phase === 'prefill' || pos <= 0) return 0;
    const pre = M.tb.prefix[s], k = Math.floor(pos);
    return k >= M.N ? pre[M.N] : pre[k] + (pre[k + 1] - pre[k]) * (pos - k);
  }
  function consumedFrac(x) { const c = consumedLbs(x.s); return byLoads() ? (x.payload ? c / x.payload : 0) : c; }
  function countTo(el, to, fmtFn) {
    const from = el.dataset.v != null ? +el.dataset.v : to;
    el.dataset.v = to;
    if (reducedMotion() || from === to) { el.textContent = fmtFn(to); return; }
    const t0 = performance.now(), dur = 650;
    cancelAnimationFrame(el._raf);
    /* the text is only touched when the shown number changes: no layout on frames that look the same */
    const step = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); const s = fmtFn(from + (to - from) * e); if (el.textContent !== s) el.textContent = s; if (p < 1) el._raf = requestAnimationFrame(step); };
    el._raf = requestAnimationFrame(step);
  }

  function renderAssign() {
    const k = M.kpi;
    $('#asMeta').innerHTML = '<span class="pill">' + fmt.int(k.asgNeeded) + ' assigned</span><span class="pill">' + fmt.int(k.reqLoads - k.asgNeeded) + ' to go</span><span class="pill">' + M.N + ' stages</span>';
    renderSandBar();
    renderFinalCounts();
    renderQueue();
    watchSandBar();
  }

  /* ---------- sand on location bar ---------- */
  function renderSandBar() {
    const st = sandStats();
    const T = totals(st);
    const pct = byLoads() ? (T.reqN ? T.totN / T.reqN : 0) : (T.req ? T.tot / T.req : 0);
    const allSands = st.length === S.config.sands.length;          // final counts is a well-level rule
    $('#sbUnit').textContent = uLbl();
    countTo($('#sbTotal'), uVal(T.totN, T.tot), v => uFmt(v));
    $('#sbOf').innerHTML = 'of <b>' + uTxt(T.reqN, T.req) + '</b> ' + uLbl() + ' · <b>' + nf1.format(pct * 100) + '%</b>' + (byLoads() ? ' · ' + lbsTxt(T.tot) : ' · ' + nL(T.totN, 'load', 'loads'));
    $$('#sbMode button').forEach(b => b.classList.toggle('on', b.dataset.m === ui.sbMode));
    const body = $('#sbBody');
    const mode = ui.sbMode === 'sand' ? 'sand' : 'general';
    const key = mode + '|' + st.map(x => x.s).join(',') + '|' + allSands;
    if (body.dataset.key !== key) {
      body.dataset.key = key;
      body.innerHTML = mode === 'general'
        ? '<div class="sbg"><div class="sbg-rail"><div class="sbg-track">' + st.map(x => '<i class="sbg-seg" data-s="' + x.s + '" data-sfilter="' + esc(x.label) + '" style="--c:' + SAND_COLOR[x.s] + '"></i>').join('') + '<em class="sb-mark" title="Sand already pumped"></em></div>' +
          (allSands ? '<em class="fc-mark"><span class="fc-lbl"></span></em>' : '') + '</div>' +
          '<div class="sbg-leg">' + st.map(x => '<button type="button" class="sbl" data-s="' + x.s + '" data-sfilter="' + esc(x.label) + '"><i style="background:' + SAND_COLOR[x.s] + '"></i><b>' + esc(x.label) + '</b><span class="v"></span></button>').join('') + '</div></div>'
        : st.map(x => '<div class="sbr" data-s="' + x.s + '" data-sfilter="' + esc(x.label) + '" role="button" tabindex="0" aria-label="Filter the queue by ' + esc(x.label) + '"><div class="sbr-l"><span class="sl s-' + x.s + '"><i></i>' + esc(x.label) + '</span><small>' + esc(x.mine) + ' · <b class="mono">' + esc(poTxt(x.po)) + '</b></small></div>' +
          '<div class="sbr-track"><i class="sbr-fill" style="--c:' + SAND_COLOR[x.s] + '"></i><em class="sb-mark" title="Sand already pumped"></em></div><div class="sbr-v"></div></div>').join('');
    }
    let off = 0;
    st.forEach(x => {
      if (mode === 'general') {
        const seg = body.querySelector('.sbg-seg[data-s="' + x.s + '"]');
        const w = fracOf(x, T);
        if (seg) seg.style.transform = 'translateX(' + (off * 100).toFixed(3) + '%) scaleX(' + w.toFixed(5) + ')';
        off += w;
        const v = body.querySelector('.sbl[data-s="' + x.s + '"] .v');
        if (v) v.innerHTML = uTxt(x.n, x.lbs) + ' / ' + uTxt(x.req, x.reqLbs) + ' · <b>' + stg(nf1.format(x.cov)) + '</b>';
      } else {
        const row = body.querySelector('.sbr[data-s="' + x.s + '"]');
        if (!row) return;
        const f = Math.min(1, sandFrac(x));
        row.querySelector('.sbr-fill').style.transform = 'scaleX(' + f.toFixed(5) + ')';
        const cons = consumedFrac(x), full = byLoads() ? x.req : x.reqLbs;
        const mk = row.querySelector('.sb-mark');
        mk.style.transform = 'translateX(' + ((full ? Math.min(1, cons / full) : 0) * 100).toFixed(3) + '%)';
        mk.hidden = !cons;
        row.classList.toggle('full', x.req > 0 && x.n >= x.req);
        row.querySelector('.sbr-v').innerHTML = '<b>' + uTxt(x.n, x.lbs) + '</b> / ' + uTN(x.req, x.reqLbs) + ' · ' + nf1.format(f * 100) + '% · covers <b>' + stg(nf1.format(x.cov)) + '</b>';
      }
    });
    if (mode === 'general') {
      const cons = st.reduce((p, x) => p + consumedFrac(x), 0), full = byLoads() ? T.reqN : T.req;
      const mk = body.querySelector('.sbg .sb-mark');
      if (mk) { mk.hidden = !cons; mk.style.transform = 'translateX(' + ((full ? Math.min(1, cons / full) : 0) * 100).toFixed(3) + '%)'; }
      const fm = body.querySelector('.fc-mark');
      if (fm) {
        const on = M.kpi.fcOn;
        fm.style.transform = 'translateX(' + (fcFrac(T) * 100).toFixed(3) + '%)';
        fm.classList.toggle('on', on);
        fm.classList.toggle('ok', on && !!S.fc);
        fm.title = 'Final counts at ' + fcPctTxt() + ' of loads assigned (load #' + M.kpi.fcAt + ')';
        fm.querySelector('.fc-lbl').textContent = on ? 'Final counts' : fcPctTxt() + ' · final counts';
      }
    }
    /* footer: how far the sand covers and the buffer against the well stage */
    const lim = st.reduce((m, x) => (m == null || x.cov < m.cov ? x : m), null);
    const w = M.well;
    const wellPos = w.phase === 'frac' || w.phase === 'done' ? Math.max(0, Math.min(M.N, w.xNow)) : 0;
    const where = w.phase === 'pre' ? 'prefill starts ' + fDT(w.prefillStart) : w.phase === 'prefill' ? 'frac starts ' + fDT(w.fracStart) : w.phase === 'done' ? 'well complete' : 'the well is at <b>stage ' + nf1.format(wellPos) + '</b>' + (w.lastRep ? ' (report ' + fTime(w.lastRep.t) + ')' : ' (plan)');
    $('#sbFoot').innerHTML = lim ? 'Assigned sand covers through <b>stage ' + nf1.format(lim.cov) + '</b>' + (st.length > 1 ? ' · <b>' + esc(lim.label) + '</b> limits' : '') + ' · ' + where +
      (w.phase === 'frac' ? ' · buffer <b class="' + (lim.cov - wellPos < (S.config.bufferStages || 2) ? 'r' : 'g') + '">' + nf1.format(lim.cov - wellPos) + ' stg</b>' : '') : '';
    /* next load */
    const nx = qNext();
    const nid = nx ? nx.id : '';
    const swap = ui.lastNext !== undefined && ui.lastNext !== nid;
    ui.lastNext = nid;
    const cur = $('#sbNext .sbn');
    if (!cur || cur.dataset.id !== nid || cur.dataset.seq !== String(nx ? nx.seq : '') || cur.dataset.po !== String(nx ? nx.po : '')) {
      $('#sbNext').innerHTML = nx
        ? '<div class="sbn' + (swap ? ' swap' : '') + '" data-id="' + nx.id + '" data-seq="' + nx.seq + '" data-po="' + esc(nx.po || '') + '"><span class="sbn-k">Next up</span><span class="sbn-seq">#' + nx.seq + '</span>' + slotChip(nx) +
          '<span class="sbn-m">' + esc(mineOf(nx.mine).name) + ' · <b class="mono">' + esc(poTxt(nx.po)) + '</b> · ' + stg(nx.stage) + '</span>' +
          '<button type="button" class="btn primary sm" data-assign-q="' + nx.id + '">Assign</button></div>'
        : '<div class="sbn done" data-id="">Every load in the design is assigned.</div>';
    }
    renderSandMini(st, T, nx);
    /* "+1 load" bubble where the bar grew (only after this client's own check mark) */
    if (ui.bump) { const b = ui.bump; ui.bump = null; showBump(b, st, T); }
  }
  function renderFinalCounts() {
    const k = M.kpi, el = $('#sbFc');
    if (!el) return;
    if (!k.reqLoads) { el.hidden = true; return; }
    el.hidden = false;
    const pct = fcPctTxt();
    if (!k.fcOn) {
      el.className = 'sb-fc';
      el.innerHTML = '<span class="fc-ic">' + sv(IC.flag, 15) + '</span><div class="fc-tx"><b>Final counts at ' + pct + '</b> of loads assigned (load <b>#' + k.fcAt + '</b>): confirm load assignments with the frac crew.</div>' +
        '<div class="fc-go"><b>' + fmt.int(k.fcLeft) + '</b><span>' + (k.fcLeft === 1 ? 'load to go' : 'loads to go') + '</span></div>';
      return;
    }
    const conf = S.fc;
    el.className = 'sb-fc on' + (conf ? ' ok' : ' live');
    el.innerHTML = '<span class="fc-ic">' + sv(conf ? IC.tick : IC.phone, 15) + '</span><div class="fc-tx"><b>Final counts · ' + nf1.format(k.pct * 100) + '% of loads assigned.</b> Confirm load assignments with the frac crew.' +
      '<div class="fc-rem"><span class="fc-rl">Loads left</span>' + remainingHTML() + '</div></div>' +
      (conf ? '<div class="fc-ok"><span>Confirmed' + (conf.by ? ' · <b>' + esc(conf.by) + '</b>' : '') + ' · ' + fWhen(Date.parse(conf.t)) + '</span><button type="button" class="btn sm ghost" data-fc="again">Confirm again</button></div>'
        : '<button type="button" class="btn sm primary" data-fc="log">Log frac crew confirmation</button>');
  }
  function showBump(b, st, T) {
    const mini = $('#sbMini').classList.contains('show');
    const body = $('#sbBody');
    if (!mini && (!body || !body.offsetParent)) return;          // the Assign tab is not on screen
    let host, x;
    if (mini) {
      const bar = $('#sbmBar'); host = $('#sbMini .sbm-in');
      let off = 0; for (const q of st) { off += fracOf(q, T); if (q.s === b.s) break; }
      x = bar.offsetLeft + off * bar.offsetWidth;
    } else if (ui.sbMode === 'sand') {
      const row = body.querySelector('.sbr[data-s="' + b.s + '"]'), tr = row && row.querySelector('.sbr-track');
      const q = st.find(z => z.s === b.s);
      if (!tr || !q) return;
      host = row; x = tr.offsetLeft + Math.min(1, sandFrac(q)) * tr.offsetWidth;
    } else {
      const tr = body.querySelector('.sbg-track'); host = body.querySelector('.sbg');
      if (!tr || !host) return;
      let off = 0; for (const q of st) { off += fracOf(q, T); if (q.s === b.s) break; }
      x = tr.offsetLeft + off * tr.offsetWidth;
    }
    const el = document.createElement('span');
    /* on the big bar the bubble sits inside the rail, next to where it grew (to the left when it no longer fits) */
    const trk = mini ? null : (host.querySelector('.sbg-track,.sbr-track') || host);
    const trackW = trk ? trk.offsetWidth : 0;
    const flip = !mini && trackW && (x - trk.offsetLeft) > trackW * 0.72;
    el.className = 'sb-bump ' + (b.n > 0 ? 'up' : 'dn') + (mini ? ' mini' : ' in') + (flip ? ' flip' : '');
    el.style.setProperty('--c', SAND_DARK[b.s] || '#1E6B7A');
    el.style.left = Math.round(x) + 'px';
    if (trk) el.style.top = Math.round(trk.offsetTop + trk.offsetHeight / 2) + 'px';
    const n = Math.abs(b.n);
    el.textContent = (b.n > 0 ? '+' : '−') + nL(n, 'load', 'loads') + ' · ' + (b.n > 0 ? '+' : '−') + fmt.int(Math.abs(b.lbs)) + ' lb';
    host.appendChild(el);
    setTimeout(() => el.remove(), 1500);
    const hit = mini ? $('#sbmBar [data-s="' + b.s + '"]') : body.querySelector('[data-s="' + b.s + '"]');
    if (hit) { hit.classList.remove('glow'); void hit.offsetWidth; hit.classList.add('glow'); }
    const lg = body && body.querySelector('.sbl[data-s="' + b.s + '"]');
    if (lg) { lg.classList.remove('glow'); void lg.offsetWidth; lg.classList.add('glow'); }
  }
  function renderSandMini(st, T, nx) {
    const bar = $('#sbmBar');
    const allSands = st.length === S.config.sands.length;
    const key = st.map(x => x.s).join(',') + '|' + allSands;
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = st.map(x => '<i class="sbm-seg" data-s="' + x.s + '" style="--c:' + SAND_COLOR[x.s] + '"></i>').join('') + (allSands ? '<em class="sbm-fc"></em>' : '');
    }
    let off = 0;
    st.forEach(x => { const seg = bar.querySelector('[data-s="' + x.s + '"]'); const w = fracOf(x, T); if (seg) seg.style.transform = 'translateX(' + (off * 100).toFixed(3) + '%) scaleX(' + w.toFixed(5) + ')'; off += w; });
    const fm = bar.querySelector('.sbm-fc');
    if (fm) { fm.style.transform = 'translateX(' + (fcFrac(T) * 100).toFixed(3) + '%)'; fm.classList.toggle('on', M.kpi.fcOn); }
    const pct = byLoads() ? (T.reqN ? T.totN / T.reqN : 0) : (T.req ? T.tot / T.req : 0);
    $('#sbmTotal').textContent = uTN(T.totN, T.tot) + ' · ' + nf1.format(pct * 100) + '%';
    $('#sbmNext').innerHTML = nx ? 'Next <b>#' + nx.seq + '</b> ' + esc(sandLabel(nx.s)) + ' · ' + pad3(nx.k) : 'Complete';
  }
  /* the mini bar shows up fixed under the top bar when the big card leaves the screen */
  let sbObs = null;
  function watchSandBar() {
    if (sbObs || !window.IntersectionObserver) return;
    sbObs = new IntersectionObserver(es => { es.forEach(en => { const on = !en.isIntersecting && ui.view === 'assign'; $('#sbMini').classList.toggle('show', on); document.body.classList.toggle('minion', on); }); }, { rootMargin: '-' + (topH() + 4) + 'px 0px 0px 0px', threshold: 0 });
    sbObs.observe($('#sandBar'));
  }
  function topH() { const t = $('#topbar'); return t ? t.getBoundingClientRect().height : 58; }

  /* sand grains that fly from the check box to their segment of the bar */
  function flyGrain(fromEl, s) {
    if (!fromEl || !fromEl.getBoundingClientRect || reducedMotion()) return;
    const mini = $('#sbMini').classList.contains('show');
    const target = mini ? $('#sbmBar') : ($('#sbBody .sbg-track') || $('#sbBody .sbr[data-s="' + s + '"] .sbr-track'));
    if (!target || ui.view !== 'assign' && !mini) return;
    const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (!b.width) return;
    const st = sandStats(), T = totals(st);
    let end = 0.5, off = 0;
    if (mini || ui.sbMode !== 'sand') { for (const x of st) { off += fracOf(x, T); if (x.s === s) { end = off; break; } } }
    else { const x = st.find(q => q.s === s); if (x) end = sandFrac(x); }
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
    const x1 = b.left + b.width * Math.max(0.02, Math.min(0.98, end)), y1 = b.top + b.height / 2;
    for (let i = 0; i < 6; i++) {
      const g = document.createElement('i');
      g.className = 'grain';
      g.style.background = SAND_COLOR[s] || '#1E6B7A';
      document.body.appendChild(g);
      const jx = (Math.random() - .5) * 18, jy = (Math.random() - .5) * 10, lift = 60 + Math.random() * 50;
      const mx = (x0 + x1) / 2 + jx, my = Math.min(y0, y1) - lift;
      const an = g.animate([
        { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(.6)', opacity: 0 },
        { transform: 'translate(' + (x0 + jx * .4) + 'px,' + (y0 - 10) + 'px) scale(1)', opacity: 1, offset: .12 },
        { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1.1)', opacity: 1, offset: .55 },
        { transform: 'translate(' + (x1 + jx) + 'px,' + (y1 + jy * .3) + 'px) scale(.55)', opacity: .15 }
      ], { duration: 620 + i * 55, delay: i * 35, easing: 'cubic-bezier(.3,.6,.2,1)', fill: 'forwards' });
      an.onfinish = () => g.remove();
    }
  }
  /* rich tooltip over the bar: one sand, every number that matters */
  function sandTip(s) {
    const x = sandStats().find(q => q.s === s);
    if (!x) return '';
    const left = x.req - x.n;
    return '<div class="schead">' + esc(x.label) + ' · ' + esc(x.mine) + '</div>' +
      scRow('Assigned', x.n + ' of ' + x.req + ' loads (' + nf1.format(x.req ? x.n / x.req * 100 : 0) + '%)') +
      scRow('On location', lbsTxt(x.lbs) + ' · ' + tonsTxt(x.lbs)) +
      scRow('Covers through', 'stage ' + nf1.format(x.cov)) +
      scRow('PO', '<b class="mono">' + esc(x.po || '—') + '</b>') +
      scRow('To go', nL(left, 'load', 'loads')) +
      '<div class="sc-act">click filters the queue →</div>';
  }

  /* ---------- the queue ---------- */
  function qRowHTML(r, nextId) {
    const st = qStatus(r), on = !!r.asg, isNext = r.id === nextId;
    const reqLbs = M.kpi.reqLbs || 1, reqN = M.kpi.reqLoads || 1;
    const opts = '<option value="">—</option>' + carriers().map(x => '<option value="' + esc(x.id) + '"' + (x.id === r.carrier ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
    const sumV = uVal(r.seq, r.cumAll);
    const sumMain = uFmt(sumV) + ' <small>' + (ui.unit === 'loads' && sumV === 1 ? 'load' : uLbl()) + '</small>';
    const sumSub = esc(sandLabel(r.s)) + ' ' + (ui.unit === 'loads' ? r.k + '/' + M.sands[r.s].nNeeded : uFmt(uVal(r.k, r.cumAfter)));
    return '<div class="qrow' + (on ? ' on' : '') + (isNext ? ' nx' : '') + (st === 'late' ? ' late' : '') + (r.prefill ? ' pre' : '') + '" data-slot="' + r.id + '" role="listitem" style="--sc:' + SAND_COLOR[r.s] + '">' +
      '<div class="q-tick"><button type="button" class="tick' + (on ? ' on' : '') + '" data-tick="' + r.id + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Remove assignment of #' + r.seq : 'Assign #' + r.seq) + '">' + sv(IC.tick, 14) + '</button></div>' +
      '<div class="q-seq">' + r.seq + '</div>' +
      '<div class="q-load">' + slotChip(r) + '</div>' +
      '<div class="q-mine">' + esc(mineOf(r.mine).name) + '</div>' +
      '<div class="q-po">' + (r.po ? esc(r.po) : '<span class="mut">—</span>') + '</div>' +
      '<div class="q-stg">' + stg(r.stage) + (r.prefill ? '<small>PREFILL</small>' : '') + '</div>' +
      '<div class="q-sum"><div><b>' + sumMain + '</b><span>' + sumSub + '</span></div><i style="--p:' + Math.min(1, ui.unit === 'loads' ? r.seq / reqN : r.cumAll / reqLbs).toFixed(4) + '"></i></div>' +
      '<div class="q-st"><span class="st q' + st + '">' + QST[st] + '</span>' + (isNext ? '<span class="nxtag">Next</span>' : '') + '</div>' +
      '<div class="q-car">' + (on ? '<select class="csel" data-csel="' + r.id + '" aria-label="Carrier for #' + r.seq + '">' + opts + '</select>' : '<span class="mut">—</span>') + '</div>' +
      '</div>';
  }
  function qKey(r, nextId) { return qStatus(r) + '|' + (r.carrier || '') + '|' + (r.id === nextId ? 1 : 0) + '|' + (r.po || ''); }
  /* every load assigned right now, whatever the filters: the snapshot the fold hides */
  function assignedIds() { return new Set(M.slots.filter(x => x.needed && x.asg).map(x => x.id)); }
  function foldHTML() { return '<div class="qfold" data-kind="fold" role="listitem"><span class="qf-ic">' + sv(IC.check, 15) + '</span><span class="qf-t"></span><button type="button" class="btn sm ghost qf-btn" data-fold="1"></button></div>'; }
  function fcDivHTML() { return '<div class="qfc" data-kind="fc" role="separator"><span class="qfc-l"></span><span class="qfc-t"></span></div>'; }
  function renderQueue() {
    const list = $('#asList');
    const rows = qRows();
    const nx = qNext();
    const nextId = nx ? nx.id : null;
    const k = M.kpi;
    const sig = rows.map(r => r.id + ':' + r.w).join(',') + '|' + ui.unit + '|' + k.fcAt + '|' + carriers().map(c => c.id + '=' + c.name).join(',');
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#asList select')) { ui.pendingList = true; return; }
    ui.pendingList = false;
    if (ui.foldIds == null && Store.mode !== 'init') ui.foldIds = assignedIds();
    if (list.dataset.sig !== sig) {
      /* FLIP: rows that change position (a load assigned out of order, a removal) slide to their new place */
      const before = {};
      const vh = window.innerHeight || 800;
      if (list.dataset.sig && !reducedMotion()) list.querySelectorAll('.qrow').forEach(el => { if (el.hidden) return; const b = el.getBoundingClientRect(); if (b.bottom > -80 && b.top < vh + 80) before[el.dataset.slot] = b.top; });
      list.dataset.sig = sig;
      let html = foldHTML(), fcPlaced = false;
      rows.forEach(r => {
        if (!fcPlaced && k.reqLoads && r.seq >= k.fcAt) { html += fcDivHTML(); fcPlaced = true; }
        html += qRowHTML(r, nextId);
      });
      list.innerHTML = html + '<div class="empty qempty" hidden></div>';
      const rmap = {};
      rows.forEach(r => { rmap[r.id] = r; });
      Array.from(list.children).forEach(el => { const r = el.dataset.slot && rmap[el.dataset.slot]; if (r) el.dataset.k = qKey(r, nextId); });
      ui.flash = null;
      applyQueueFilter(rows);
      if (Object.keys(before).length) list.querySelectorAll('.qrow').forEach(el => {
        const t0 = before[el.dataset.slot];
        if (t0 == null || el.hidden) return;
        const dy = t0 - el.getBoundingClientRect().top;
        if (Math.abs(dy) > 2 && Math.abs(dy) < vh) el.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
      return;
    }
    const byId = {};
    Array.from(list.children).forEach(el => { if (el.dataset.slot) byId[el.dataset.slot] = el; });
    rows.forEach(r => {
      const el = byId[r.id], key = qKey(r, nextId);
      if (!el || el.dataset.k === key) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = qRowHTML(r, nextId);
      const nel = tmp.firstElementChild;
      nel.dataset.k = key;
      if (ui.flash === r.id) nel.classList.add(r.asg ? 'flash' : 'unflash');
      nel.hidden = el.hidden;
      const hadFocus = el.contains(document.activeElement);
      el.replaceWith(nel);
      if (hadFocus) { const t = nel.querySelector('.tick'); if (t) t.focus({ preventScroll: true }); }
    });
    ui.flash = null;
    applyQueueFilter(rows);
  }
  function applyQueueFilter(rows) {
    rows = rows || qRows();
    const raw = ui.asQuery.trim().toLowerCase();
    const exact = /^#\d+$/.test(raw) ? +raw.slice(1) : null;       // "#120" = load number 120
    const q = exact != null ? '' : raw.replace(/^#/, '');
    const cnt = { all: rows.length, pend: 0, asg: 0, late: 0 };
    rows.forEach(r => { const st = qStatus(r); if (st === 'asg') cnt.asg++; else cnt.pend++; if (st === 'late') cnt.late++; });
    const chips = [['all', 'All'], ['pend', 'Pending'], ['asg', 'Assigned'], ['late', 'Overdue']];
    $('#asStatus').innerHTML = chips.map(c => '<button type="button" class="chip' + (ui.asStatus === c[0] ? ' active' : '') + '" data-st="' + c[0] + '" aria-pressed="' + (ui.asStatus === c[0]) + '">' + c[1] + ' <span class="n">' + cnt[c[0]] + '</span></button>').join('');
    const foldable = ui.asStatus === 'all' && !raw && !carrierFilterActive() && ui.foldIds != null;
    const byId = {};
    rows.forEach(r => { byId[r.id] = r; });
    let shown = 0, folded = [], asgShown = 0;
    const kids = Array.from($('#asList').children);
    kids.forEach(el => {
      const r = byId[el.dataset.slot];
      if (!r) return;
      const st = qStatus(r);
      let ok = ui.asStatus === 'all' || (ui.asStatus === 'pend' && st !== 'asg') || (ui.asStatus === 'asg' && st === 'asg') || (ui.asStatus === 'late' && st === 'late');
      if (ok && exact != null) ok = r.seq === exact;
      if (ok && q) {
        const hay = [String(r.seq), r.id, sandLabel(r.s) + ' ' + r.k, pad3(r.k), r.po || '', mineOf(r.mine).name, 'stg' + r.stage, 'stage ' + r.stage, r.prefill ? 'prefill' : '', r.carrier ? carrierName(r.carrier) : ''].join(' | ').toLowerCase();
        ok = q.split(/\s+/).every(t => hay.includes(t));
      }
      if (ok && foldable && ui.fold && r.asg && ui.foldIds.has(r.id)) { ok = false; folded.push(r.seq); }
      else if (ok && r.asg) asgShown++;
      el.hidden = !ok;
      if (ok) shown++;
    });
    /* fold row: the loads already assigned stay out of the way until someone asks for them */
    const fold = $('#asList .qfold');
    if (fold) {
      const nAsg = ui.fold ? folded.length : asgShown;
      fold.hidden = !foldable || !nAsg;
      if (!fold.hidden) {
        const lo = folded.length ? Math.min.apply(null, folded) : 0, hi = folded.length ? Math.max.apply(null, folded) : 0;
        fold.querySelector('.qf-t').innerHTML = ui.fold ? '<b>' + nL(nAsg, 'assigned load', 'assigned loads') + '</b> hidden · ' + (lo === hi ? '#' + lo : '#' + lo + '–#' + hi) : '<b>' + nL(nAsg, 'assigned load', 'assigned loads') + '</b> shown';
        const b = fold.querySelector('.qf-btn');
        b.innerHTML = sv(ui.fold ? IC.eye : IC.eyeOff, 13) + (ui.fold ? 'Show' : 'Hide assigned');
        b.dataset.fold = ui.fold ? 'show' : 'hide';
        fold.classList.toggle('open', !ui.fold);
      }
    }
    /* final counts divider: visible when the load right after it is */
    const div = $('#asList .qfc');
    if (div) {
      let nxt = div.nextElementSibling;
      while (nxt && nxt.hidden && nxt.dataset.slot) nxt = nxt.nextElementSibling;
      const k = M.kpi;
      div.hidden = !(nxt && nxt.dataset.slot && !nxt.hidden) || ui.asStatus === 'asg' || !!raw;
      div.classList.toggle('on', k.fcOn);
      div.querySelector('.qfc-l').textContent = fcPctTxt() + ' · #' + k.fcAt;
      div.querySelector('.qfc-t').textContent = k.fcOn ? (S.fc ? 'Final counts · confirmed with the frac crew' + (S.fc.by ? ' by ' + S.fc.by : '') : 'Final counts · confirm load assignments with the frac crew')
        : 'Final counts start here · confirm load assignments with the frac crew';
    }
    const empty = $('#asList .qempty');
    if (empty) { empty.hidden = shown > 0; empty.textContent = carrierFilterActive() ? 'A carrier filter is on: only its assigned loads show.' : 'Nothing matches these filters.'; }
    $('#asCount').textContent = shown + ' of ' + rows.length + ' loads';
  }
  function scrollToNext(focus) {
    const nx = qNext();
    if (!nx) return;
    if (ui.asStatus === 'asg') { ui.asStatus = 'all'; applyQueueFilter(); }
    const el = $('#asList [data-slot="' + nx.id + '"]');
    if (!el) return;
    el.hidden = false;
    const y = el.getBoundingClientRect().top + window.scrollY - topH() - 110;
    window.scrollTo({ top: Math.max(0, y), behavior: reducedMotion() ? 'auto' : 'smooth' });
    el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping');
    if (focus) { const t = el.querySelector('.tick'); if (t) t.focus({ preventScroll: true }); }
  }
  /* detail card for a row: everything about the load plus its actions */
  function rowDetail(e, id) {
    const r = slotById(id);
    if (!r) return;
    const nx = qNext();
    const rows = [['Mine', esc(mineOf(r.mine).name)], ['PO', '<span class="mono">' + esc(r.po || '—') + '</span>'], ['Stage', stg(r.stage) + (r.prefill ? ' · prefill' : '')],
      ['Running total', uTN(r.seq, r.cumAll) + (ui.unit === 'loads' ? ' · ' + lbsTxt(r.cumAll) : '')], ['Covers through', 'stage ' + nf1.format(r.covAfter) + ' (' + esc(sandLabel(r.s)) + ')'],
      ['Status', QST[qStatus(r)]]];
    if (r.asg) {
      rows.push(['Assigned', fWhen(r.asgT) + (r.asg.by ? ' · ' + esc(r.asg.by) : '')]);
      const opts = '<option value="">—</option>' + carriers().map(x => '<option value="' + esc(x.id) + '"' + (x.id === r.carrier ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
      rows.push(['Carrier', '<select class="csel" data-csel="' + r.id + '" aria-label="Carrier for #' + r.seq + '">' + opts + '</select>']);
    }
    let foot = '';
    if (r.asg) foot = '<button type="button" class="btn sm danger" data-dc-unasg="' + r.id + '">Remove assignment</button>';
    else {
      foot = '<button type="button" class="btn sm primary" data-dc-asg="' + r.id + '">Assign #' + (M.kpi.asgNeeded + 1) + '</button>';
      const n = rangeRows(r.id).length;
      if (nx && nx.id !== r.id && n > 1) foot += '<button type="button" class="btn sm" data-dc-range="' + r.id + '">Assign ' + n + ' up to here</button>';
    }
    showDetail(e, '#' + r.seq + ' · ' + sandLabel(r.s) + ' · ' + pad3(r.k), rows, foot);
  }
  function moveFocus(from, dir) {
    const ticks = Array.from($$('#asList .qrow:not([hidden]) .tick'));
    const i = ticks.indexOf(from);
    const t = ticks[i + dir];
    if (t) { t.focus(); t.scrollIntoView({ block: 'nearest', behavior: 'auto' }); }
  }
  function shortcuts() {
    const k = (x) => '<kbd>' + x + '</kbd>';
    modal('Keyboard shortcuts', '<div class="kbd-list">' +
      '<div>' + k('N') + '<span>Jump to the next load</span></div>' +
      '<div>' + k('Space') + ' ' + k('Enter') + '<span>Check or uncheck the focused load</span></div>' +
      '<div>' + k('↑') + ' ' + k('↓') + '<span>Move between loads</span></div>' +
      '<div>' + k('I') + '<span>Detail of the focused load</span></div>' +
      '<div>' + k('Shift') + ' + click<span>Assign every load from the next one up to that load</span></div>' +
      '<div>' + k('Ctrl') + ' / ' + k('⌘') + ' + ' + k('Z') + '<span>Undo the last action</span></div>' +
      '<div>' + k('/') + '<span>Search the queue</span></div>' +
      '<div>' + k('?') + '<span>This list</span></div></div>', [{ label: 'Got it', cls: 'primary' }]);
  }

  /* ============================== PROGRESS ============================== */
  function renderProgress() {
    const w = M.well, now = Date.now();
    $$('#basisSeg button').forEach(b => b.classList.toggle('on', b.dataset.b === ui.basis));
    const cov = covFor(ui.basis);
    const ss = selSands();
    const totLbs = ss.reduce((p, s) => p + M.tb.R[s], 0);
    const lbsB = ss.reduce((p, s) => p + (ui.basis === 'asg' ? M.sands[s].asgLbs : ui.basis === 'est' ? M.sands[s].estLbs : M.sands[s].ommaLbs), 0);
    const nB = ss.reduce((p, s) => p + (ui.basis === 'asg' ? M.sands[s].nAssigned : ui.basis === 'est' ? M.sands[s].estN : M.sands[s].omma.delivered), 0);
    const nTot = M.slots.filter(x => x.needed && sandOn(x.s)).length;
    const pct = ui.unit === 'loads' ? (nTot ? Math.min(1, nB / nTot) : 0) : (totLbs ? Math.min(1, lbsB / totLbs) : 0);   // same basis as the unit on screen
    const om = M.jobLoads.filter(l => sandOn(l.s));
    const omLbs = om.reduce((p, l) => p + l.w, 0);
    const bTx = { asg: 'assigned', est: 'delivered est.', omma: 'OMMA actual' }[ui.basis];
    const planPos = Math.max(0, Math.min(M.N, planX(now)));
    const realN = w.lastRep ? w.lastRep.n : null;
    paintKpis('#avKpis', [
      kpiCard({ label: 'Well stage', value: realN != null ? String(realN) : (w.phase === 'frac' ? String(Math.floor(planPos)) : '—'), unit: '/ ' + M.N, icon: sv(IC.layers, 16), accent: 'a-teal', i: 0,
        badge: '<span class="gr ' + (realN != null ? 'neu' : 'ghost') + '">' + (realN != null ? 'actual' : 'plan') + '</span>',
        foot: '<span>' + (w.lastRep ? 'report ' + fDT(w.lastRep.t) : 'no frac crew reports') + '</span><span>' + (w.pace ? 'pace <b>' + nf1.format(w.pace.v) + '</b>' : 'design <b>' + nf1.format(w.designPace) + '</b>') + ' stg/day</span>' }),
      kpiCard({ label: 'Stages covered · ' + bTx, value: fmt.int(Math.floor(cov.pos + 1e-9)), unit: '/ ' + M.N, icon: sv(IC.target, 16), accent: 'a-mint', i: 1,
        badge: '<span class="gr neu">' + nf2.format(cov.pos) + ' stg</span>', foot: '<span><b>' + esc(cov.lim ? sandLabel(cov.lim) : '—') + '</b> limits</span><span>' + (realN != null ? 'buffer <b>' + nf1.format(cov.pos - realN) + '</b> stg' : '') + '</span>' }),
      kpiCard({ label: 'Sand covered · ' + bTx, value: nf1.format(pct * 100), unit: '%', icon: sv(IC.gauge, 16), accent: 'a-sky', i: 2,
        foot: '<span><b>' + uTxt(nB, lbsB) + '</b> ' + uLbl() + '</span><span>of ' + uTxt(nTot, totLbs) + '</span>' }),
      kpiCard({ label: 'OMMA delivered', value: uTxt(om.length, omLbs), unit: uLbl(), icon: sv(IC.truck, 16), accent: 'a-lav', i: 3, badge: '<span class="gr neu">actual</span>',
        foot: '<span>' + om.length + ' loads · ' + fmt.int(omLbs) + ' lb</span><span>' + (om.length ? 'last ' + fDT(Math.max.apply(null, om.map(l => l.d || l.a)))
          : M.wellLoads.length > M.jobLoads.length ? '<b>' + (M.wellLoads.length - M.jobLoads.length) + '</b> before the cut-off' : '') + '</span>' })
    ]);
    renderCoverageChart();
    renderStageChart();
    renderReportPanel();
    renderRecon();
  }
  /* the design alone, from the planned frac start (no reports, no stats) */
  function planX(t) {
    const base = E.schedule(M.tbd, S.config, { stage: [] }, tz());
    return base.X(t);
  }
  function renderCoverageChart() {
    const sands = S.config.sands;
    const labels = sands.map(s => s.label);
    const need = sands.map(s => uVal(M.sands[s.id].nNeeded, M.tb.R[s.id]));
    const asgV = sands.map(s => { const x = M.sands[s.id]; const rs = x.slots.filter(r => r.asg && carrierOn(r.carrier)); return uVal(rs.length, rs.reduce((p, r) => p + r.w, 0)); });
    const estV = sands.map(s => { const x = M.sands[s.id]; return uVal(x.estN, x.estLbs); });
    const omV = sands.map(s => { const x = M.sands[s.id]; return uVal(x.omma.delivered, x.ommaLbs); });
    const colsA = sands.map(s => sandOn(s.id) ? SAND_COLOR[s.id] : oA(SAND_COLOR[s.id], .3));
    const colsE = sands.map(s => sandOn(s.id) ? SAND_DARK[s.id] : oA(SAND_DARK[s.id], .3));
    const minCov = covFor(ui.basis);
    $('#covBadge').textContent = 'covers ' + stg(Math.max(1, Math.min(M.N, Math.floor(minCov.pos + 1e-9) + (minCov.pos < M.N ? 1 : 0))));
    chart('av_cov', {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Required', data: need, backgroundColor: dim(sands.map(() => GHOST), .5), borderRadius: 7, barPercentage: .92, categoryPercentage: .8, grouped: false, order: 3 },
        { label: 'Assigned', data: asgV, backgroundColor: dim(colsA), borderRadius: 7, barPercentage: .6, categoryPercentage: .8, grouped: false, order: 2 },
        { label: ui.basis === 'omma' ? 'OMMA actual' : 'Delivered (est.)', data: ui.basis === 'omma' ? omV : estV, backgroundColor: dim(colsE), borderRadius: 6, barPercentage: .3, categoryPercentage: .8, grouped: false, order: 1 }
      ] },
      options: {
        indexAxis: 'y',
        scales: { x: Object.assign(gYf(uAxis), { grid: { color: OMMA.grid } }), y: Object.assign({}, gX, { ticks: Object.assign({}, gX.ticks, { font: { size: 11.5, weight: '700' } }) }) },
        plugins: {
          crosshair: false,
          tooltip: tt3({
            title: it => it[0].label + ' · ' + mineOf(sands[it[0].dataIndex].mine).name,
            label: c => ' ' + c.dataset.label + ': ' + uN(c.parsed.x),
            rows: i => {
              const x = M.sands[sands[i].id];
              return ['Covers (assigned): ' + nf2.format(x.cov.asg) + ' stg · delivered est.: ' + nf2.format(x.cov.est) + ' stg',
                'OMMA actual: ' + x.omma.delivered + ' loads · ' + fmt.int(x.ommaLbs) + ' lb',
                'Left to assign: ' + (x.nNeeded - x.nAssignedNeeded) + ' loads · PO ' + (x.po || '—'), 'click filters the board →'];
            }
          })
        },
        onClick: onMarkClick('sand')
      }
    });
    legend('av_cov', [{ label: 'Required', color: GHOST }, { label: 'Assigned', swatch: SW.sands(false) },
      { label: ui.basis === 'omma' ? 'OMMA actual' : 'Delivered (est.)', swatch: SW.sands(true) }]);
    chartNote('av_cov', { read: '<b>' + esc(minCov.lim ? sandLabel(minCov.lim) : '—') + '</b> limits: with that sand, ' + ({ asg: 'assigned', est: 'delivered', omma: 'OMMA' }[ui.basis]) + ' coverage reaches <b>' + nf2.format(minCov.pos) + '</b> stages.', kind: 'filter' });
  }
  function renderStageChart() {
    const w = M.well, now = Date.now();
    const plan = E.schedule(M.tbd, S.config, { stage: [] }, tz());
    /* X axis aligned to local midnight, ticks every 12 h or every day depending on the length */
    const mid = t => { const p = wp(t); return E.wallToEpoch(p.y, p.mo, p.d, 0, 0, 0, tz()); };
    const t0 = mid(Math.min(plan.B[0], w.reports.length ? w.reports[0].t : Infinity) - 2 * HOUR);
    const tEnd = Math.max(plan.B[M.N], M.sc.B[M.N]) + 2 * HOUR;
    const nDays = Math.max(1, Math.ceil((tEnd - t0) / DAY));
    const tickEvery = nDays <= 4 ? 12 * HOUR : nDays <= 9 ? DAY : 2 * DAY;
    const t1 = t0 + Math.ceil((tEnd - t0) / tickEvery) * tickEvery;
    const xTicks = [];
    for (let t = t0; t <= t1 + 1; t += tickEvery) xTicks.push(t);
    const step = Math.max(HOUR, Math.round((t1 - t0) / 90 / HOUR) * HOUR);
    const pl = [], pr = [];
    for (let t = t0; t <= t1; t += step) { pl.push({ x: t, y: Math.max(0, Math.min(M.N, plan.X(t))) }); }
    const real = w.reports.map(r => ({ x: r.t, y: r.n }));
    if (w.lastRep) for (let t = w.lastRep.t; t <= M.sc.B[M.N] + step; t += step) pr.push({ x: t, y: Math.max(0, Math.min(M.N, M.sc.X(t))) });
    const diff = w.lastRep ? w.lastRep.n - plan.X(w.lastRep.t) : null;
    const b = $('#stageBadge');
    b.textContent = diff == null ? 'no reports' : (diff >= 0 ? '+' : '−') + nf1.format(Math.abs(diff)) + ' stg vs plan';
    b.className = 'pbadge ' + (diff == null ? '' : diff >= -0.5 ? 'ok' : diff >= -2 ? 'warn' : 'bad');
    chart('av_stage', {
      type: 'line',
      data: { datasets: [
        { label: 'Plan (design)', data: pl, borderColor: '#1B2538', borderDash: [6, 4], borderWidth: 1.8, pointRadius: 0, tension: 0, order: 3, endLabel: false },
        { label: 'Projection from last report', data: pr, borderColor: '#6BAED6', borderWidth: 2, borderDash: [2, 3], pointRadius: 0, tension: 0, order: 2 },
        { label: 'Reported stage', data: real, borderColor: '#1E6B7A', backgroundColor: '#1E6B7A', borderWidth: 2.4, pointRadius: 3.5, pointHoverRadius: 7, stepped: false, tension: 0, order: 1 }
      ] },
      options: {
        parsing: true,
        layout: { padding: { right: 44, top: 16 } },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        scales: {
          x: Object.assign({}, gX, { type: 'linear', min: t0, max: t1,
            afterBuildTicks: ax => { ax.ticks = xTicks.map(v => ({ value: v })); },
            ticks: Object.assign({}, gX.ticks, { autoSkip: true, callback: v => { const p = wp(v); return (p.h === 0 && p.mi === 0) ? fDayShort(v) : fHour(v); } }) }),
          y: Object.assign(gYf(v => stg(v)), { max: M.N, ticks: Object.assign({}, gY.ticks, { callback: v => stg(v), stepSize: 15 }) })
        },
        plugins: {
          endLabel: { enabled: true, fmt: v => stg(nf1.format(v)) },
          nowLine: { x: now },
          tooltip: tt3({
            title: it => fDT(it[0].parsed.x),
            label: c => ' ' + c.dataset.label + ': ' + stg(nf1.format(c.parsed.y)),
            rows: (i, items) => {
              const t = items[0].parsed.x;
              const pX = plan.X(t);
              const out = ['Plan at that time: ' + stg(nf1.format(Math.max(0, Math.min(M.N, pX))))];
              if (w.lastRep && t >= w.lastRep.t - HOUR) {
                const d = M.sc.X(t) - pX;
                out.push('Gap vs plan: ' + (d >= 0 ? '+' : '−') + nf1.format(Math.abs(d)) + ' stg (' + (d >= 0 ? '+' : '−') + E.fmtDur(Math.abs(d) * 1440 / (w.designPace || 19)) + ')');
              }
              out.push('Est. end: ' + fDT(M.sc.B[M.N]));
              out.push('click opens detail →');
              return out;
            }
          })
        },
        onClick: (e, els, c) => {
          if (!els || !els.length) return;
          const p = els[0].element.$context ? els[0].element.$context.parsed : c.data.datasets[els[0].datasetIndex].data[els[0].index];
          const t = p.x;
          showDetail(e.native || e, 'Well · ' + fDT(t), [['Plan', stg(nf1.format(Math.max(0, plan.X(t))))], ['Projection', stg(nf1.format(Math.max(0, M.sc.X(t))))],
            ['Last report', w.lastRep ? stg(w.lastRep.n) + ' · ' + fDT(w.lastRep.t) : '—'], ['Plan end', fDT(plan.B[M.N])], ['Projected end', fDT(M.sc.B[M.N])]]);
        }
      }
    });
    legend('av_stage', [{ label: 'Plan (design)', swatch: SW.dash('#1B2538'), line: true }, { label: 'Projection from last report', swatch: SW.dots('#6BAED6'), line: true },
      { label: 'Reported stage', color: '#1E6B7A', line: true }].concat(now >= t0 && now <= t1 ? [{ label: 'Now', swatch: SW.dots('#E6A23C'), line: true, toggle: false }] : []));
    chartNote('av_stage', { read: diff == null ? 'No reports yet: the calendar uses the frac start and the design pace. Log the stage as soon as the frac crew reports it.' :
      (diff >= 0 ? 'The well is <b>' + nf1.format(diff) + ' stages ahead</b> of the design.' : 'The well is <b>' + nf1.format(-diff) + ' stages behind</b> the design: the queue shifted and loads are needed later.'), kind: 'detail' });
  }
  function renderReportPanel() {
    const w = M.well;
    const nIn = $('#repN'), tIn = $('#repT');
    if (document.activeElement !== nIn && document.activeElement !== tIn) {
      nIn.max = M.N;
      if (!nIn.dataset.touched) nIn.value = w.lastRep ? Math.min(M.N, w.lastRep.n + 1) : Math.max(1, Math.min(M.N, Math.floor(Math.max(0, planX(Date.now())))));
      if (!tIn.dataset.touched) tIn.value = E.toWallString(Date.now(), tz());
    }
    const reps = w.reports.slice().reverse().slice(0, 30);
    const nPdf = w.reports.filter(r => r.src === 'pdf').length, nMan = w.reports.length - nPdf;
    $('#repBadge').textContent = !w.reports.length ? 'no reports' : nPdf ? nPdf + ' from PDF' + (nMan ? ' · ' + nMan + ' logged' : '') : nL(nMan, 'report', 'reports');
    /* stage ends read from the stats PDF have no delete: they change with the next PDF (Plan) */
    $('#repList').innerHTML = reps.length ? reps.map(r => '<div class="rep' + (r.src === 'pdf' ? ' pdf' : '') + '"><span class="n">' + stg(r.n) + '</span><span class="t">' + fDT(r.t) + '</span>' +
      (r.src === 'pdf' ? '<span class="mono mut" title="Stage end from the stats PDF (Plan)">PDF</span><span></span>' : '<span class="mono mut">' + esc(r.by || '—') + '</span><button type="button" class="x" data-rdel="' + esc(r.id) + '" aria-label="Delete report">×</button>') + '</div>').join('')
      : '<div class="empty">No reports. The calendar runs on the frac start and the design pace.</div>';
  }
  function renderRecon() {
    const out = [];
    let totalU = 0;
    S.config.sands.forEach(s => {
      const x = M.sands[s.id], o = x.omma;
      if (!o.delivered) return;
      totalU += o.reconcile.length;
      out.push('<div class="rc"><div class="nm">' + slotChip({ s: s.id, k: 0 }).replace(' · 000', '') + '</div>' +
        (o.reconcile.length ? '<button type="button" class="btn sm primary" data-recon="' + s.id + '">Check off ' + o.reconcile.length + ' as ' + esc(carrierName(M.trackedId)) + '</button>' : '<span class="st del">reconciled</span>') +
        '<div class="ks"><span><b>' + o.pool + '</b>assigned to OMMA or no carrier</span><span><b>' + o.delivered + '</b>OMMA delivered (file)</span><span><b>' + o.matched + '</b>matched</span><span><b class="a">' + o.unmatched.length + '</b>deliveries not checked off</span></div></div>');
    });
    const meta = S.omma && S.omma.meta;
    const rng = M.stats.range;
    $('#reconBadge').textContent = totalU ? totalU + ' to reconcile' : 'up to date';
    $('#reconBadge').className = 'pbadge ' + (totalU ? 'warn' : 'ok');
    $('#recon').innerHTML = (out.length ? out.join('') : '<div class="empty">No OMMA deliveries for this well in the file.</div>') +
      '<div class="note">Delivered counts come from the latest OMMA loads file' + (meta && meta.file ? ' (<b>' + esc(legacyFile(meta.file)) + '</b>' + (meta.at ? ', ' + fDT(meta.at) : '') + ')' : '') + (rng ? '; it covers ' + fDT(rng.from) + ' to ' + fDT(rng.to) : '') + '. Loads assigned to OMMA after that file cannot show as delivered yet.' +
      (M.countFrom ? ' Only deliveries since <b>' + fDT(M.countFrom) + '</b> count' + (M.wellLoads.length > M.jobLoads.length ? ' (' + (M.wellLoads.length - M.jobLoads.length) + ' earlier ones are left out)' : '') + '.' : '') + '</div>';
  }
  function legacyFile(f) { return f === 'Excel extracto de loads OMMA (referencia inicial)' ? 'OMMA loads extract (initial reference)' : f; }

  /* ============================== PLAN ============================== */
  function renderPlan() {
    const k = M.kpi;
    $('#plMeta').innerHTML = '<span class="pill">' + M.N + ' stages</span><span class="pill">' + nL(S.config.segments.length, 'segment', 'segments') + '</span>' +
      (M.tb.act ? '<span class="pill">' + nL(M.tb.act.n, 'stage', 'stages') + ' pumped · stats PDF</span>' : '');
    /* with stage stats: the totals are design + actual; the design alone next to them */
    const vsD = (n, nd) => M.tb.act ? ' · design <b>' + fmt.int(nd) + '</b>' + (n !== nd ? ' (' + sgn(n - nd) + ')' : '') : '';
    const tot = '<article class="gcard stot a-teal"><div class="l">Well total</div><div class="v">' + uTxt(k.reqLoads, k.reqLbs) + '<small>' + uLbl() + '</small></div>' +
      '<div class="s"><b>' + fmt.int(k.reqLoads) + '</b> loads' + vsD(k.reqLoads, k.reqLoadsDesign) + ' · <b>' + fmt.int(k.reqLbs) + '</b> lb · <b>' + nf1.format(k.reqLbs / 2000) + '</b> tons<br>final counts at <b>' + fcPctTxt() + '</b> · load <b>#' + k.fcAt + '</b></div></article>';
    $('#sandTotals').innerHTML = tot + S.config.sands.map(s => {
      const x = M.sands[s.id];
      return '<article class="gcard stot ' + SAND_ACC[s.id] + '"><div class="l"><i style="background:' + SAND_COLOR[s.id] + '"></i>' + esc(s.label) + ' · ' + esc(mineOf(s.mine).name) + '</div>' +
        '<div class="v">' + uTxt(x.nNeeded, x.R) + '<small>' + uLbl() + '</small></div>' +
        '<div class="s"><b>' + fmt.int(x.nNeeded) + '</b> loads' + vsD(x.nNeeded, x.nDesign) + ' · <b>' + fmt.int(x.R) + '</b> lb · <b>' + nf1.format(x.R / 2000) + '</b> tons<br>payload ' + fmt.int(x.params.payload) + ' lb ' + srcTag(x.params.payloadSrc) + ' · prefill ' + x.prefillN + ' · PO <b class="mono">' + esc(x.po || '—') + '</b></div></article>';
    }).join('');
    attachCardGlow($('#sandTotals'));
    renderDaysChart();
    renderTrucks();
    renderDrivers();
    renderActual();
    /* the form is not redrawn while someone is in a field: focus would be lost */
    const editing = $('#designForm').contains(document.activeElement);
    if (!ui.draft || (!ui.dirty && !editing)) { ui.draft = Seed.clone(S.config); ui.dirty = false; renderDesignForm(); }
    else updateDesignPreview();
  }
  function renderDaysChart() {
    const days = M.days;
    const sands = S.config.sands.filter(s => sandOn(s.id));
    const val = (d, s) => uVal(d.loads[s] || 0, d.lbs[s] || 0);
    const cap = days.map(d => {
      const [y, m, dd] = d.day.split('-').map(Number);
      const mid = E.wallToEpoch(y, m, dd, 12, 0, 0, tz());
      const pos = Math.max(0, Math.min(M.N - 1e-6, M.sc.X(mid)));
      const si = M.tb.segOf[Math.floor(pos) + 1];
      const sp = M.segPlans[si];
      if (!sp) return null;
      let c = 0, any = false;
      sands.forEach(s => { const q = sp.per[s.id]; if (q && q.trucksPlanned != null) { any = true; c += uVal(q.capLoadsDay, q.capLoadsDay * M.params[s.id].payload); } });
      return any ? c : null;
    });
    $('#daysBadge').textContent = nL(days.length, 'day', 'days');
    chart('pl_days', {
      type: 'bar',
      data: { labels: days.map(d => fDayKey(d.day)), datasets: sands.map(s => ({ type: 'bar', label: s.label, stack: 'd', data: days.map(d => val(d, s.id)), backgroundColor: dim(days.map(() => SAND_COLOR[s.id])), borderRadius: 5, maxBarThickness: 44, order: 2 }))
        .concat([{ type: 'line', label: 'Plan capacity', data: cap, borderColor: '#C25151', borderDash: [5, 4], borderWidth: 1.8, pointRadius: 3, pointBackgroundColor: '#C25151', spanGaps: false, order: 1 }]) },
      options: {
        layout: { padding: { right: 46, top: 12 } },
        scales: { x: Object.assign({}, gX, { stacked: true }), y: Object.assign(gYf(uAxis), { stacked: true }) },
        plugins: {
          endLabel: { enabled: true, fmt: v => uFmt(v) },
          tooltip: tt3({
            title: it => fDayKey(days[it[0].dataIndex].day),
            label: c => c.parsed.y == null ? ' ' + c.dataset.label + ': no truck plan' : ' ' + c.dataset.label + ': ' + uN(c.parsed.y),
            rows: i => {
              const d = days[i];
              const tt = sands.reduce((p, s) => p + val(d, s.id), 0);
              const out = ['Day total: ' + uN(tt) + ' · assigned ' + d.asg + ' of ' + d.total + ' loads'];
              if (cap[i] != null) out.push('vs capacity: ' + (tt <= cap[i] ? 'fits (' + uN(Math.abs(cap[i] - tt)) + ' of headroom)' : 'short ' + uN(Math.abs(cap[i] - tt))));
              out.push('click opens the queue →');
              return out;
            }
          })
        },
        onClick: (e, els) => { if (!els || !els.length) return; setTimeout(() => { ui.asStatus = 'pend'; go('assign'); }, 0); }
      }
    });
    legend('pl_days', sands.map(s => ({ label: s.label, color: SAND_COLOR[s.id] })).concat([{ label: 'Plan capacity', swatch: SW.dash('#C25151'), line: true }]));
    const totOf = d => sands.reduce((p, s) => p + val(d, s.id), 0);
    const pi = days.reduce((b, d, i) => (b < 0 || totOf(d) > totOf(days[b]) ? i : b), -1);
    const over = days.map((d, i) => cap[i] != null && totOf(d) > cap[i] + 1e-9 ? totOf(d) - cap[i] : 0);
    const nOver = over.filter(v => v > 0).length;
    let read = 'No days in the plan.';
    if (pi >= 0) {
      const pd = days[pi];
      const mix = sands.filter(s => pd.loads[s.id]).map(s => esc(s.label) + ' ' + uFmt(val(pd, s.id))).join(' · ');
      read = 'The busiest day is <b>' + fDayKey(pd.day) + '</b>: <b>' + uN(totOf(pd)) + '</b> (' + mix + ').' +
        (nOver ? ' <b>' + nL(nOver, 'day', 'days') + '</b> above the planned truck capacity, up to <b>' + uN(Math.max.apply(null, over)) + '</b> over.' : cap.some(c => c != null) ? ' The planned trucks cover the days that have a plan.' : '');
    }
    chartNote('pl_days', { read, kind: 'detail', act: 'click opens the queue →' });
  }
  function renderTrucks() {
    const sp = M.segPlans;
    if (ui.segPick == null || !sp[ui.segPick]) ui.segPick = Math.max(0, Math.min(sp.length - 1, M.well.segIdx >= 0 ? M.well.segIdx : sp.length - 1));
    if (M.well.phase === 'pre' && ui.segPickAuto !== false && sp.length > 1 && ui.segPick === 0 && !ui.segPickSet) ui.segPick = sp.length - 1;
    $('#segPick').innerHTML = sp.map((p, i) => '<button type="button" data-seg="' + i + '" class="' + (i === ui.segPick ? 'on' : '') + '">Stg ' + p.from + '–' + p.to + '</button>').join('');
    const p = sp[ui.segPick];
    if (!p) return;
    const sands = S.config.sands;
    const need = sands.map(s => p.per[s.id].trucksNeeded);
    const plan = sands.map(s => p.per[s.id].trucksPlanned);
    const parts = sands.filter(s => p.per[s.id].lbs > 0).map(s => { const q = p.per[s.id]; return '<b>' + nf1.format(q.trucksNeeded) + '</b> for ' + esc(s.label) + (q.trucksPlanned != null ? ' (plan ' + q.trucksPlanned + ')' : ' (no plan)'); });
    $('#trucksDesc').innerHTML = 'At ' + nf1.format(p.pace) + ' stages/day' + (p.fc ? ' (design ' + nf1.format(p.designPace) + ', averaged with the stages pumped)' : '') + ' you need ' + parts.join(', ') + '. ' +
      (p.sustainPace != null ? 'With the planned trucks the well holds <b>' + nf1.format(p.sustainPace) + ' stages/day</b>' + (p.sustainPace < p.pace ? ' — <b>' + esc(sandLabel(p.limiting)) + '</b> limits.' : '.') : 'The design has no complete truck plan for this segment.');
    chart('pl_trucks', {
      type: 'bar',
      data: { labels: sands.map(s => s.label), datasets: [
        { label: 'Plan', data: plan.map(v => v == null ? 0 : v), backgroundColor: dim(sands.map(() => GHOST), .5), borderRadius: 7, barPercentage: .9, categoryPercentage: .78, grouped: false, order: 2 },
        { label: 'Required', data: need, backgroundColor: dim(sands.map(s => (p.per[s.id].trucksPlanned != null && p.per[s.id].trucksPlanned < p.per[s.id].trucksNeeded - 0.05) ? '#E08A86' : SAND_COLOR[s.id])), borderRadius: 7, barPercentage: .5, categoryPercentage: .78, grouped: false, order: 1 }
      ] },
      options: {
        indexAxis: 'y',
        scales: { x: Object.assign(gYf(v => Number.isInteger(v) ? fmt.int(v) : nf1.format(v)), { grid: { color: OMMA.grid } }), y: Object.assign({}, gX, { ticks: Object.assign({}, gX.ticks, { font: { size: 11.5, weight: '700' } }) }) },
        plugins: {
          crosshair: false,
          tooltip: tt3({
            title: it => it[0].label + ' · Stg ' + p.from + '–' + p.to,
            label: c => ' ' + c.dataset.label + ': ' + (c.dataset.label === 'Plan' && plan[c.dataIndex] == null ? 'no plan' : nf1.format(c.parsed.x) + ' trucks'),
            rows: i => {
              const q = p.per[sands[i].id], pr = M.params[sands[i].id];
              return ['Loads/day required: ' + nf1.format(q.loadsPerDay) + ' · 1 every ' + E.fmtDur(q.everyMin),
                'Loads per truck/day: ' + nf2.format(pr.lptd) + ' (' + (SRC_TX[pr.lptdSrc] || pr.lptdSrc) + ')',
                q.trucksPlanned != null ? 'Gap: ' + (q.gapTrucks >= 0 ? '+' : '−') + nf1.format(Math.abs(q.gapTrucks)) + ' trucks' : 'No truck plan',
                q.sustainPace != null ? 'With the plan it holds ' + nf1.format(q.sustainPace) + ' stg/day' : '', 'click filters the board →'].filter(Boolean);
            }
          })
        },
        onClick: onMarkClick('sand')
      }
    });
    legend('pl_trucks', [{ label: 'Plan', color: GHOST }, { label: 'Required', swatch: SW.sands(false) }, { label: 'Required > plan', color: '#E08A86', toggle: false }]);
    chartNote('pl_trucks', { read: p.sustainPace != null && p.sustainPace < p.pace ? 'Short on trucks: at ' + (p.fc ? 'this' : 'the design') + ' pace you need <b>' + nf1.format(sands.reduce((q, s) => q + p.per[s.id].trucksNeeded, 0)) + '</b> and the plan has <b>' + sands.reduce((q, s) => q + (p.per[s.id].trucksPlanned || 0), 0) + '</b>.' : (p.fc ? 'The truck plan covers this pace in this segment, or there is no plan to compare.' : 'The truck plan covers the design pace in this segment, or there is no plan to compare.'), kind: 'filter' });
    $('#cadence').innerHTML = sands.filter(s => p.per[s.id].loadsPerDay > 0).map(s => {
      const q = p.per[s.id];
      return '<div class="cad"><div class="k"><i style="background:' + SAND_COLOR[s.id] + '"></i>' + esc(s.label) + '</div><div class="v">1 every ' + E.fmtDur(q.everyMin) + '</div><div class="s">' + nf1.format(q.loadsPerDay) + ' loads/day · ' + fmt.int(q.lbs) + ' lb/stg</div></div>';
    }).join('');
  }

  /* ---------- drivers and turn rate ----------
     E.driverPlan: a driver works one shift a day (12 h that can stretch to 14 h), a load keeps a driver for
     its full load time (assigned → delivered) and any driver can take any trip. */
  const SHIFT_COLOR = { D: '#9CCFD8', N: '#3E7C8C' };
  const TR_COLOR = '#C25151', PLAN_COLOR = '#1B2538';
  let DRV = null;
  function drvPlan() {
    const sk = selSands().join(',');
    if (!DRV || DRV.M !== M || DRV.sk !== sk) DRV = { M, sk, p: E.driverPlan(M, { sands: selSands() }) };
    return DRV.p;
  }
  const nDr = n => fmt.int(n) + ' ' + (n === 1 ? 'driver' : 'drivers');
  const trTxt = v => v == null || !isFinite(v) ? '—' : nf2.format(v);
  const sandsIn = loads => S.config.sands.filter(s => loads[s.id]).map(s => s.label + ' ' + fmt.int(loads[s.id])).join(' · ');
  const shiftTxt = p => nf2.format(p.shiftH) + ' h shifts' + (p.H > p.shiftH ? ' up to ' + nf2.format(p.H) + ' h' : '');
  /* the segment that needs the most drivers is the one to staff for */
  function drvKeySeg(p) { let b = -1; p.segs.forEach((g, i) => { if (b < 0 || g.need > p.segs[b].need) b = i; }); return b; }
  function drvCurSeg(p) { return Math.max(0, Math.min(p.segs.length - 1, M.well.segIdx >= 0 ? M.well.segIdx : 0)); }
  function renderDrivers() {
    const p = drvPlan();
    const mines = Object.keys(p.loadH);
    const card = (acc, l, v, sm, s) => '<article class="gcard stot ' + acc + '"><div class="l">' + l + '</div><div class="v">' + v + (sm ? '<small>' + sm + '</small>' : '') + '</div><div class="s">' + s + '</div></article>';
    const split = d => 'day <b>' + (d.D ? d.D.drivers : 0) + '</b> · night <b>' + (d.N ? d.N.drivers : 0) + '</b>';
    const td = p.today, pk = p.peak, ki = drvKeySeg(p), sg = ki >= 0 ? p.segs[ki] : null;
    $('#drvKpis').innerHTML =
      card('a-teal', 'Drivers today · ' + fDayKey(p.todayKey), td ? fmt.int(td.drivers) : '0', td && td.drivers === 1 ? 'driver' : 'drivers',
        td ? split(td) + ' · <b>' + fmt.int(td.total) + '</b> ' + (td.total === 1 ? 'load' : 'loads') + ' · turn rate <b>' + trTxt(td.tr) + '</b>' : 'No loads to haul today') +
      card('a-coral', 'Peak day' + (pk ? ' · ' + fDayKey(pk.day) : ''), pk ? fmt.int(pk.drivers) : '—', 'drivers',
        pk ? '<b>' + fmt.int(pk.total) + '</b> loads · ' + split(pk) + ' · turn rate <b>' + trTxt(pk.tr) + '</b>' + (pk.plan != null ? ' · plan <b>' + fmt.int(pk.plan) + '</b>' : '') : '—') +
      card('a-lav', 'Turn rate · whole well', trTxt(p.total.tr), 'loads/driver/day',
        mines.length ? mines.map(m => esc(mineOf(m).name) + ' <b>' + nf1.format(p.tr[m]) + '</b>').join(' · ') + ' · ' + shiftTxt(p) : '—') +
      (sg ? card('a-mint', 'Per shift · Stg ' + sg.from + '–' + sg.to, fmt.int(sg.onShift), 'drivers',
        (sg.plan != null
          ? 'plan <b>' + fmt.int(sg.plan) + '</b> · ' + (sg.gap < 0 ? '<b>' + fmt.int(-sg.gap) + '</b> short' : 'covered') + ' · the plan holds <b>' + nf1.format(sg.planHolds) + '</b> of <b>' + nf1.format(sg.pace) + '</b> stg/day'
          : '<b>' + fmt.int(sg.perDay) + '</b> a day at <b>' + nf1.format(sg.pace) + '</b> stg/day · <b>' + nf1.format(sg.driverHoursPerStage) + '</b> driver-h per stage')) : '');
    attachCardGlow($('#drvKpis'));
    renderDrvDays(p);
    renderDrvHour();
    renderDrvStage(p);
  }
  function renderDrvDays(p) {
    const days = p.days;
    $('#drvBadge').textContent = nL(days.length, 'day', 'days');
    const yI = gYf(v => fmt.int(v));
    yI.ticks = Object.assign({}, yI.ticks, { precision: 0 });
    yI.stacked = true;
    if (!days.some(d => d.drivers > 0)) yI.suggestedMax = 5;
    const hasPlan = days.some(d => d.plan != null);
    chart('pl_drivers', {
      type: 'bar',
      data: { labels: days.map(d => fDayKey(d.day)), datasets: [
        { type: 'bar', label: 'Day shift', stack: 'd', data: days.map(d => d.D ? d.D.drivers : 0), backgroundColor: dim(days.map(() => SHIFT_COLOR.D)), borderRadius: 5, maxBarThickness: 44, order: 3, yAxisID: 'y' },
        { type: 'bar', label: 'Night shift', stack: 'd', data: days.map(d => d.N ? d.N.drivers : 0), backgroundColor: dim(days.map(() => SHIFT_COLOR.N)), borderRadius: 5, maxBarThickness: 44, order: 3, yAxisID: 'y' },
        { type: 'line', label: 'Plan', data: days.map(d => d.plan), borderColor: PLAN_COLOR, borderDash: [5, 4], borderWidth: 1.8, pointRadius: 2.5, pointBackgroundColor: PLAN_COLOR, spanGaps: false, order: 1, yAxisID: 'y', endLabelFmt: v => fmt.int(v) },
        { type: 'line', label: 'Turn rate', data: days.map(d => d.tr), borderColor: TR_COLOR, backgroundColor: TR_COLOR, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, tension: .25, order: 2, yAxisID: 'y1', spanGaps: true }
      ] },
      options: {
        layout: { padding: { top: 12, right: 40 } },
        scales: {
          x: Object.assign({}, gX, { stacked: true }),
          y: yI,
          y1: Object.assign(gYf(v => nf1.format(v)), { display: false, position: 'right', grid: { display: false }, beginAtZero: true, suggestedMax: 3 })
        },
        plugins: {
          endLabel: { enabled: true, fmt: v => trTxt(v) },
          tooltip: tt3({
            title: it => fDayKey(days[it[0].dataIndex].day),
            label: c => c.dataset.label === 'Turn rate' ? ' Turn rate: ' + trTxt(c.parsed.y) + ' loads per driver'
              : c.dataset.label === 'Plan' ? (c.parsed.y == null ? ' Plan: none for these stages' : ' Plan: ' + nDr(c.parsed.y))
              : ' ' + c.dataset.label + ': ' + nDr(c.parsed.y),
            rows: i => {
              const d = days[i];
              const out = ['Drivers: ' + fmt.int(d.drivers) + ' · loads: ' + fmt.int(d.total) + (d.total ? ' (' + sandsIn(d.loads) + ')' : '')];
              ['D', 'N'].forEach(k => { const o = d[k]; if (o) out.push((k === 'D' ? 'Day' : 'Night') + ' shift ' + fHour(o.start) + '–' + fHour(o.end) + ': ' + nDr(o.drivers) + ' for ' + nL(o.total, 'load', 'loads')); });
              out.push('Load time to cover: ' + fmt.int(Math.round(d.hours)) + ' h ÷ ' + nf2.format(p.H) + ' h per driver');
              if (d.plan != null) out.push('vs plan ' + fmt.int(d.plan) + ': ' + (d.drivers > d.plan ? fmt.int(d.drivers - d.plan) + ' short' : 'covered'));
              out.push('click shows that day by hour →');
              return out;
            }
          })
        },
        onClick: (e, els) => {
          if (!els || !els.length) return;
          const d = days[els[0].index];
          setTimeout(() => { ui.drvRange = 'day'; ui.drvDay = d.day; renderDrvHour(); }, 0);
        }
      }
    });
    legend('pl_drivers', [{ label: 'Day shift', color: SHIFT_COLOR.D }, { label: 'Night shift', color: SHIFT_COLOR.N }]
      .concat(hasPlan ? [{ label: 'Plan', swatch: SW.dash(PLAN_COLOR), line: true }] : []).concat([{ label: 'Turn rate', color: TR_COLOR, line: true }]));
    const ki = drvKeySeg(p), g = ki >= 0 ? p.segs[ki] : null, mines = Object.keys(p.loadH);
    let read = 'No loads in the plan for these sands.';
    if (g && g.onShift) {
      read = 'Stages <b>' + g.from + '–' + g.to + '</b> at <b>' + nf1.format(g.pace) + '</b> stg/day need <b>' + fmt.int(g.onShift) + '</b> drivers per shift (<b>' + fmt.int(g.perDay) + '</b> a day), turn rate <b>' + trTxt(g.tr) + '</b>. ' +
        mines.map(m => 'A <b>' + esc(mineOf(m).name) + '</b> load takes ' + E.fmtDur(p.loadH[m] * 60) + ': <b>' + nf1.format(p.tr[m]) + '</b> per driver in ' + nf2.format(p.H) + ' h').join('; ') + '.' +
        (g.plan != null ? ' The plan of <b>' + fmt.int(g.plan) + '</b> per shift holds <b>' + nf1.format(g.planHolds) + '</b> stages/day.' : '');
    }
    chartNote('pl_drivers', { read, kind: 'detail', act: 'click shows that day by hour →' });
  }
  function renderDrvHour() {
    const p = drvPlan(), h = p.hourly;
    const sh0 = S.config.shiftStartHour == null ? 6 : +S.config.shiftStartHour;
    if (ui.drvRange === 'day' && !(ui.drvDay && p.days.some(d => d.day === ui.drvDay))) ui.drvRange = '48';
    const r = ui.drvRange || '48';
    const now = Date.now();
    let from, to;
    if (r === 'day') { const [y, m, d] = ui.drvDay.split('-').map(Number); from = E.wallToEpoch(y, m, d, sh0, 0, 0, tz()); to = from + 24 * HOUR; }
    else if (r === 'all') { from = h.t.length ? h.t[0] : now; to = h.t.length ? h.t[h.t.length - 1] + HOUR : now; }
    else { from = Math.floor(now / HOUR) * HOUR - 6 * HOUR; to = from + 48 * HOUR; }
    $('#drvRange').innerHTML = [['48', 'Next 48 h']].concat(ui.drvDay && p.days.some(d => d.day === ui.drvDay) ? [['day', fDayKey(ui.drvDay)]] : []).concat([['all', 'Whole well']])
      .map(([k, l]) => '<button type="button" data-r="' + k + '" class="' + (k === r ? 'on' : '') + '">' + esc(l) + '</button>').join('');
    syncSegs($('#drvRange'));
    const I = [];
    h.t.forEach((t, i) => { if (t >= from && t < to) I.push(i); });
    const T = I.map(i => h.t[i]);
    const busy = I.map(i => Math.round(h.busy[i] * 10) / 10);
    const labels = T.map(t => r === 'all' ? fDayShort(t) + ' ' + fHour(t) : (wp(t).h === 0 || t === T[0] ? fDayShort(t) + ' ' + fHour(t) : fHour(t)));
    const nowIdx = T.findIndex(t => now >= t && now < t + HOUR);
    const col = '#1E6B7A';
    chart('pl_drvhour', {
      type: 'line',
      data: { labels, datasets: [
        { label: 'On a load', data: busy, borderColor: col, backgroundColor: c => c.chart.chartArea ? oGrad(c.chart.ctx, c.chart.chartArea, col, .2, 0) : oA(col, .1), fill: true, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.2, tension: .3 }
      ] },
      options: {
        layout: { padding: { top: 16, right: 44 } },
        scales: { x: Object.assign({}, gX, { ticks: Object.assign({}, gX.ticks, { maxTicksLimit: 9 }) }), y: Object.assign(gYf(v => fmt.int(v)), { ticks: Object.assign({}, gY.ticks, { precision: 0, callback: v => fmt.int(v) }), suggestedMax: 5 }) },
        plugins: {
          nowLine: { x: nowIdx >= 0 ? nowIdx : null },
          endLabel: { enabled: true, fmt: v => nf1.format(v) },
          tooltip: tt3({
            title: it => { const t = T[it[0].dataIndex]; return fDay(t) + ' · ' + fHour(t) + '–' + fHour(t + HOUR); },
            label: c => ' On a load: ' + nf1.format(c.parsed.y) + ' drivers',
            rows: i => {
              const k = I[i], t = T[i], sh = E.shiftOf(t + 30 * MIN, tz(), sh0);
              const out = [(sh.shift === 'D' ? 'Day' : 'Night') + ' shift ' + fHour(sh.start) + '–' + fHour(sh.start + 12 * HOUR) + ': ' + nDr(h.shiftDrivers[k])];
              const st = h.starts[k];
              const n = Object.keys(st).reduce((q, s) => q + st[s], 0);
              out.push(n ? 'Loads leaving this hour: ' + n + ' (' + sandsIn(st) + ')' : 'No loads leaving this hour');
              out.push(r === 'day' ? 'click opens the queue →' : 'click shows that day by hour →');
              return out;
            }
          })
        },
        /* drill: an hour opens its operating day; inside a day it opens the queue */
        onClick: (e, els) => {
          if (!els || !els.length) return;
          const t = T[els[0].index];
          if (r === 'day') { setTimeout(() => { ui.asStatus = 'pend'; go('assign'); }, 0); return; }
          const dk = E.shiftOf(t + 30 * MIN, tz(), sh0).day;
          setTimeout(() => { ui.drvRange = 'day'; ui.drvDay = dk; renderDrvHour(); }, 0);
        }
      }
    });
    legend('pl_drvhour', [{ label: 'On a load', color: col }, { label: 'Now', swatch: SW.dots('#E6A23C'), line: true, toggle: false }]);
    let read = 'No loads in this window.';
    if (I.length) {
      let mi = 0; busy.forEach((v, i) => { if (v > busy[mi]) mi = i; });
      read = 'Most drivers on a load at once: <b>' + nf1.format(busy[mi]) + '</b> (' + fDay(T[mi]) + ', ' + fHour(T[mi]) + ').';
    }
    chartNote('pl_drvhour', { read, kind: 'detail', act: r === 'day' ? 'click opens the queue →' : 'click shows that day by hour →' });
  }
  function renderDrvStage(p) {
    const ci = drvCurSeg(p);
    $('#drvStageBadge').textContent = shiftTxt(p);
    const th = ['Stages', 'Stages/day', 'Stage every', 'Loads per stage', 'Driver-hours per stage', 'Loads per hour', 'On a load at once', 'Per shift', 'Per day', 'Turn rate', 'Plan per shift', 'vs plan', 'Pace the plan holds'];
    $('#drvStageTbl').innerHTML = '<thead><tr>' + th.map((c, i) => '<th' + (i ? ' style="text-align:right"' : '') + '>' + c + '</th>').join('') + '</tr></thead><tbody>' +
      (p.segs.length ? p.segs.map((g, i) => '<tr' + (i === ci ? ' class="cur"' : '') + '>' +
        '<td><b>Stg ' + g.from + '–' + g.to + '</b>' + (i === ci ? '<span class="nowtag">now</span>' : '') + '</td>' +
        '<td class="n">' + nf1.format(g.pace) + (g.fc ? '<div class="sub">design ' + nf1.format(g.designPace) + '</div>' : '') + '</td>' +
        '<td class="n">' + (g.stageMin != null ? E.fmtDur(g.stageMin) : '—') + '</td>' +
        '<td class="n">' + nf1.format(g.loadsPerStage) + '<div class="sub">' + S.config.sands.filter(s => g.perStage[s.id]).map(s => esc(s.label) + ' ' + nf1.format(g.perStage[s.id])).join(' · ') + '</div></td>' +
        '<td class="n">' + nf1.format(g.driverHoursPerStage) + '</td>' +
        '<td class="n">' + nf1.format(g.loadsPerHour) + '</td>' +
        '<td class="n">' + nf1.format(g.driving) + '</td>' +
        '<td class="n"><b>' + fmt.int(g.onShift) + '</b></td>' +
        '<td class="n">' + fmt.int(g.perDay) + '</td>' +
        '<td class="n">' + trTxt(g.tr) + '</td>' +
        '<td class="n">' + (g.plan != null ? fmt.int(g.plan) : '—') + '</td>' +
        '<td class="n">' + (g.plan != null ? (g.gap < 0 ? '<span class="gapneg">' + fmt.int(-g.gap) + ' short</span>' : '<span class="gappos">covered</span>') : '—') + '</td>' +
        '<td class="n">' + (g.planHolds != null ? nf1.format(g.planHolds) + ' stg/day' : '—') + '</td></tr>').join('')
        : '<tr><td colspan="13"><div class="empty">No design segments.</div></td></tr>') + '</tbody>';
  }

  /* ---------- stage stats from the frac crew (PDF): actual vs design ----------
     E.stageTable: pumped stages count what was pumped; the stages left in each segment average the
     design with them (the design counts as one stage), per sand, and the stage time the same way.
     The upload shows what would change before anyone applies it. */
  const SX = window.StageStats;
  const FC_ALPHA = .34, FC_COLOR = '#C88B3D';
  const pctTxt = v => v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + nf1.format(Math.abs(v * 100)) + '%';
  const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt.int(Math.abs(v));
  const durTxt = ms => ms == null || !isFinite(ms) ? '—' : E.fmtDur(ms / MIN);
  /* pumped stages vs the design of those same stages, per sand */
  function actSums() {
    const a = M.tb.act, o = {};
    S.config.sands.forEach(s => { o[s.id] = { act: 0, des: 0 }; });
    if (a) for (let j = 1; j <= M.N; j++) if (a.pumped[j]) S.config.sands.forEach(s => { o[s.id].act += M.tb.d[s.id][j]; o[s.id].des += M.tb.dd[s.id][j]; });
    return o;
  }
  /* the segment to talk about: the one of the last pumped stage, else the current one */
  function actSegIdx() {
    const a = M.tb.act;
    const n = a && a.last ? a.last.n : Math.max(1, M.well.curStage || 1);
    const i = M.tb.segOf[Math.max(1, Math.min(M.N, n))];
    return i >= 0 ? i : 0;
  }
  /* how a block's forecast is built: "design ×2 and Stg 7 ×2, the other 6 ×1 (÷ 10)" */
  function fcHow(g) {
    const a = M.tb.act;
    if (!a || !g || !g.n) return null;
    const rest = g.n - 1;
    return 'design ×' + a.weight + ' and Stg ' + g.lastN + ' ×' + a.lastWeight + (rest ? ', the other ' + rest + ' ×1' : '') + ' (÷ ' + (a.weight + g.n + a.lastWeight - 1) + ')';
  }
  /* one stage from the stats: start, end, pumping, transition from the previous end, end to end (ms) */
  function stageTimes(n) {
    const a = M.tb.act;
    const r = a ? a.A.get(n) : null;
    if (!r) return null;
    const p = a.A.get(n - 1);
    return { r, pump: r.start != null && r.end != null ? r.end - r.start : null,
      trans: r.start != null && p && p.end != null ? r.start - p.end : null, cyc: a.cyc[n] > 0 ? a.cyc[n] : null };
  }
  function renderActual() {
    const a = M.tb.act, meta = S.actual && S.actual.meta;
    const sands = S.config.sands.filter(s => sandOn(s.id));
    const all = sands.length === S.config.sands.length;
    const card = (acc, l, v, sm, s) => '<article class="gcard stot ' + acc + '"><div class="l">' + l + '</div><div class="v">' + v + (sm ? '<small>' + sm + '</small>' : '') + '</div><div class="s">' + s + '</div></article>';
    const sums = actSums();
    const tA = sands.reduce((p, s) => p + sums[s.id].act, 0), tD = sands.reduce((p, s) => p + sums[s.id].des, 0);
    const gi = actSegIdx(), sp = M.segPlans[gi], g = a && a.seg[gi] ? a.seg[gi] : null;
    const dCyc = sp ? DAY / sp.designPace : null;
    const nN = sands.reduce((p, s) => p + M.sands[s.id].nNeeded, 0), nD = sands.reduce((p, s) => p + M.sands[s.id].nDesign, 0);
    const lN = sands.reduce((p, s) => p + M.sands[s.id].R, 0);
    const dl = sands.map(s => ({ s, d: M.sands[s.id].nNeeded - M.sands[s.id].nDesign })).filter(x => x.d);
    $('#actKpis').innerHTML =
      card('a-teal', 'Stages pumped · stats PDF', a ? fmt.int(a.n) : '0', '/ ' + M.N,
        a && a.last ? 'last <b>Stg ' + a.last.n + '</b>' + (a.last.end != null ? ' ended <b>' + fDT(a.last.end) + '</b>' : '') + (meta && meta.at ? ' · uploaded ' + fWhen(meta.at) + (meta.by ? ' by ' + esc(meta.by) : '') : '')
          : 'No stats yet: the design runs the queue. Upload the PDF below.') +
      card('a-amber', 'Sand pumped vs design', a && tD > 0 ? pctTxt((tA - tD) / tD).replace('%', '') : '—', a && tD > 0 ? '%' : '',
        a ? sands.filter(s => sums[s.id].act > 0 || sums[s.id].des > 0).map(s => { const x = sums[s.id]; return esc(s.label) + ' <b>' + (x.des > 0 ? pctTxt((x.act - x.des) / x.des) : '+' + lbsTxt(x.act)) + '</b>'; }).join(' · ') + ' · ' + nL(a.n, 'stage', 'stages')
          : 'Lbs pumped per sand, stage by stage against the design') +
      card('a-sky', 'Stage time · <span class="nw">Stg ' + (sp ? sp.from + '–' + sp.to : '—') + '</span>', g && g.actCycle ? durTxt(g.actCycle) : durTxt(dCyc), g && g.actCycle ? 'actual' : 'design',
        !sp ? '—' : g && g.actCycle
          ? 'design <b>' + durTxt(dCyc) + '</b> · stages left <b>' + durTxt(g.fcCycle) + '</b> = <b>' + nf1.format(g.fcPace) + '</b> stg/day (design ' + nf1.format(sp.designPace) + ')'
          : '<b>' + nf1.format(sp.designPace) + '</b> stages/day by design · the PDF times replace it') +
      card('a-coral', 'Loads needed · ' + (all ? 'well' : sands.map(s => esc(s.label)).join(' + ')), uTxt(nN, lN), uLbl(),
        a ? 'design <b>' + fmt.int(nD) + '</b> loads · <b>' + sgn(nN - nD) + '</b>' + (dl.length ? ' · ' + dl.map(x => esc(x.s.label) + ' <b>' + sgn(x.d) + '</b>').join(' · ') : '')
          : 'By design · the pumped stages adjust it');
    attachCardGlow($('#actKpis'));
    renderActPanel();
    renderActLbs();
    renderActTime();
  }
  function renderActPanel() {
    const a = M.tb.act, meta = S.actual && S.actual.meta;
    const icon = $('#actDrop .drop-ic'); if (icon && !icon.innerHTML) icon.innerHTML = sv(IC.upload, 20);
    $('#actBadge').textContent = a ? nL(a.n, 'stage', 'stages') + ' pumped' : 'design only';
    $('#actBadge').className = 'pbadge' + (a ? ' ok' : '');
    if (ui.stats) return;   // a file is being read or previewed
    const nums = [];
    let lbs = 0;
    if (a) for (let j = 1; j <= M.N; j++) if (a.pumped[j]) { nums.push(j); S.config.sands.forEach(s => { lbs += M.tb.d[s.id][j]; }); }
    const ends = a ? a.ends : [];
    $('#actPrev').innerHTML = '<div class="ttl">Stage stats in use</div>' +
      '<div class="kv"><div><div class="k">Stages pumped</div><div class="v">' + nums.length + '</div></div>' +
      '<div><div class="k">Stages</div><div class="v" style="font-size:13px">' + (nums.length ? 'Stg ' + E.compactRanges(nums) : '—') + '</div></div>' +
      '<div><div class="k">Sand pumped</div><div class="v">' + (nums.length ? fmt.numK(lbs) + '<small> lb</small>' : '—') + '</div></div>' +
      '<div><div class="k">Last stage end</div><div class="v" style="font-size:12px">' + (ends.length ? fDT(ends[ends.length - 1].t) : '—') + '</div></div></div>' +
      '<p style="margin:0 0 10px;color:var(--mut)">' + (meta ? 'Last file: <b>' + esc(meta.file || '—') + '</b>' + (meta.at ? ' · ' + fDT(meta.at) : '') + (meta.by ? ' · ' + esc(meta.by) : '') + '. ' : 'No stats uploaded: the queue runs on the design. ') +
      'Pumped stages count what the crew pumped. The stages left blend the design with the pumped stages of their block, per sand: the design and the last pumped stage count double, every other stage once. Stage times set the pace the same way. A block keeps its design until its first stage is pumped.</p>' +
      '<div class="acts"><button type="button" class="btn sm danger" id="actClear"' + (S.actual ? '' : ' disabled') + '>Clear stage stats</button></div>';
  }
  async function handleStatsFile(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name || '') && file.type !== 'application/pdf') { ui.stats = { file: file.name, error: 'That is not a PDF. Choose the stats PDF.' }; renderActPreview(); return; }
    ui.stats = { file: file.name, reading: true };
    $('#actPrev').innerHTML = '<div class="ttl">Reading ' + esc(file.name) + '…</div><div class="sk" style="height:90px"></div>';
    try {
      const { items, pages } = await SX.readPdf(file);
      const r = SX.parse(items, S.config, E, Date.now());
      ui.stats = { file: file.name, pages, r, mode: 'merge' };
    } catch (e) {
      ui.stats = { file: file.name, error: e && e.message ? e.message : 'Could not read the PDF' };
    }
    renderActPreview();
  }
  function statsOp(up) { return { type: 'actual', mode: up.mode === 'replace' ? 'replace' : 'merge', stages: up.r.stages, meta: { file: up.file, title: up.r.title } }; }
  function renderActPreview() {
    const up = ui.stats, box = $('#actPrev');
    if (!up || !box || up.reading) return;
    if (up.error) {
      box.innerHTML = '<div class="ttl">' + esc(up.file || 'File') + '</div><ul class="issues"><li>' + esc(up.error) + '</li></ul><div class="acts" style="margin-top:10px"><button type="button" class="btn sm ghost" id="actCancel">Close</button></div>';
      return;
    }
    const r = up.r, st = r.stages;
    /* what changes: the model with the same operation the server will apply */
    let M2 = null;
    try {
      const nx = R.apply(S, [Object.assign({ id: 'preview-' + Date.now(), t: new Date().toISOString(), by: Store.me() || '' }, statsOp(up))]).state;
      M2 = E.build(nx.config, nx, Date.now());
    } catch (e) { console.warn('[stats] preview', e); }
    up.after = M2 ? M2.kpi.reqLoads : null;
    const pumped = st.filter(x => x.lbs), ends = st.filter(x => x.e != null);
    const lbsSum = pumped.reduce((p, x) => p + Object.keys(x.lbs).reduce((q, k) => q + x.lbs[k], 0), 0);
    const chg = [];
    if (M2) {
      const k0 = M.kpi, k1 = M2.kpi;
      const per = S.config.sands.filter(s => M.sands[s.id].nNeeded !== M2.sands[s.id].nNeeded).map(s => esc(s.label) + ' ' + M.sands[s.id].nNeeded + ' → ' + M2.sands[s.id].nNeeded);
      chg.push('Loads needed <b>' + fmt.int(k0.reqLoads) + ' → ' + fmt.int(k1.reqLoads) + '</b>' + (per.length ? ' (' + per.join(' · ') + ')' : ' · no change'));
      (M2.tb.act ? M2.tb.act.seg : []).forEach(g => {
        if (!g || !g.on) return;
        const lb = S.config.sands.filter(s => g.design[s.id] > 0 || g.fc[s.id] > 0).map(s => esc(s.label) + ' <b>' + fmt.int(Math.round(g.fc[s.id])) + '</b> (design ' + fmt.int(g.design[s.id]) + ')').join(' · ');
        chg.push('Stg ' + g.from + '–' + g.to + ', stages left: ' + lb + ' lb/stg · <b>' + nf1.format(g.fcPace) + '</b> stg/day (design ' + nf1.format(g.designPace) + ')');
      });
      if (k1.next && (!k0.next || k0.next.id !== k1.next.id || Math.abs(k0.next.ab - k1.next.ab) > MIN)) chg.push('Next load <b>' + esc(sandLabel(k1.next.s)) + ' · ' + pad3(k1.next.k) + '</b>: assign by <b>' + fDT(k1.next.ab) + '</b>' + (k0.next && k0.next.id === k1.next.id ? ' (now ' + fDT(k0.next.ab) + ')' : ''));
      if (k0.overdue !== k1.overdue) chg.push('Overdue <b>' + k0.overdue + ' → ' + k1.overdue + '</b>');
      chg.push('Well ends <b>' + fDT(M2.sc.B[M2.N]) + '</b>' + (Math.abs(M2.sc.B[M2.N] - M.sc.B[M.N]) > 5 * MIN ? ' (now ' + fDT(M.sc.B[M.N]) + ')' : ''));
    }
    const iss = r.warnings.slice(0, 12);
    box.innerHTML = '<div class="ttl">' + esc(up.file) + ' <span class="pbadge">PDF · ' + nL(up.pages || 1, 'page', 'pages') + '</span>' + (r.wellMatch === false ? '<span class="pbadge warn">other well?</span>' : '') + '</div>' +
      (r.title ? '<div class="up-sub">' + esc(r.title) + (r.wellMatch ? ' · this well' : '') + '</div>' : '') +
      '<div class="kv"><div><div class="k">Stages</div><div class="v">' + st.length + '</div></div>' +
      '<div><div class="k">Range</div><div class="v" style="font-size:13px">' + (st.length ? 'Stg ' + E.compactRanges(st.map(x => x.n)) : '—') + '</div></div>' +
      '<div><div class="k">Sand pumped</div><div class="v">' + fmt.numK(lbsSum) + '<small> lb</small></div></div>' +
      '<div><div class="k">Last end</div><div class="v" style="font-size:12px">' + (ends.length ? fDT(ends[ends.length - 1].e) : '—') + '</div></div></div>' +
      (chg.length ? '<div class="chg"><div class="k">What changes</div><ul>' + chg.map(x => '<li>' + x + '</li>').join('') + '</ul></div>' : '') +
      (iss.length ? '<ul class="issues mix">' + iss.map(w => '<li class="' + (w.lvl === 'info' ? 'info' : w.lvl === 'err' ? 'err' : 'warn') + '">' + esc(w.txt) + '</li>').join('') + (r.warnings.length > iss.length ? '<li class="info">… and ' + (r.warnings.length - iss.length) + ' more</li>' : '') + '</ul>' : '') +
      '<div class="acts">' + (S.actual ? '<div class="seg sm" id="actMode"><button type="button" data-m="merge" class="' + (up.mode !== 'replace' ? 'on' : '') + '">Update these stages</button><button type="button" data-m="replace" class="' + (up.mode === 'replace' ? 'on' : '') + '">Replace all</button></div>' : '') +
      '<button type="button" class="btn primary sm" id="actApply"' + (st.length ? '' : ' disabled') + '>Apply and recalculate</button><button type="button" class="btn sm ghost" id="actCancel">Cancel</button></div>';
    syncSegs();
  }
  function applyStats() {
    const up = ui.stats;
    if (!up || !up.r || !up.r.stages.length) return;
    const prev = S.actual ? Seed.clone(S.actual) : null;
    const before = M.kpi.reqLoads, after = up.after;
    Store.dispatch(statsOp(up));
    ui.stats = null;
    const undo = pushUndo('stage stats upload', () => Store.dispatch({ type: 'actual', mode: 'replace', stages: prev ? prev.stages : [], meta: prev ? prev.meta : {}, undo: true }));
    toast('Stage stats applied: <b>' + up.r.stages.length + '</b> stages' + (after != null ? ' · loads <b>' + fmt.int(before) + ' → ' + fmt.int(after) + '</b>' : '') + ' · queue recalculated', { label: 'Undo', fn: undo }, 9000);
  }
  function clearStats() {
    const n = S.actual && S.actual.stages ? S.actual.stages.length : 0;
    modal('Clear stage stats', '<p>Removes the <b>' + n + '</b> stages read from the stats PDF for all dispatch. The queue goes back to the design (lbs and pace) from the last reported stage.</p>',
      [{ label: 'Cancel', cls: 'ghost' }, { label: 'Clear', cls: 'danger', fn: () => {
        const prev = Seed.clone(S.actual);
        Store.dispatch({ type: 'actualClear' });
        const undo = pushUndo('clear stage stats', () => Store.dispatch({ type: 'actual', mode: 'replace', stages: prev.stages, meta: prev.meta, undo: true }));
        toast('Stage stats cleared · the queue runs on the design', { label: 'Undo', fn: undo });
      } }]);
  }
  /* one stage, pumped or to pump: times, lbs per sand against the design and where the forecast comes from */
  function stageDetail(evt, n) {
    const a = M.tb.act, tm = stageTimes(n);
    const pumped = !!(a && a.pumped[n]);
    const gi = M.tb.segOf[n], sp = M.segPlans[gi], g = a && a.seg[gi];
    const done = M.well.lastRep && n <= M.well.lastRep.n;
    const rows = [['Status', pumped ? 'pumped · stats PDF' : done ? 'done · no lbs in the stats' : 'to pump · forecast']];
    if (tm && tm.r.start != null) rows.push(['Start', fDT(tm.r.start)]);
    if (tm && tm.r.end != null) rows.push(['End', fDT(tm.r.end)]);
    if (tm && tm.trans != null) rows.push(['Transition', durTxt(tm.trans)]);
    if (tm && tm.pump != null) rows.push(['Pumping', durTxt(tm.pump)]);
    if (tm && tm.cyc != null && sp) rows.push(['End to end', durTxt(tm.cyc) + ' · design ' + durTxt(DAY / sp.designPace)]);
    if (!tm || tm.r.end == null) rows.push([done ? 'Ended (calendar)' : 'Expected end', fDT(M.sc.B[n])]);
    let tA = 0, tD = 0;
    S.config.sands.forEach(s => {
      const v = M.tb.d[s.id][n], d = M.tb.dd[s.id][n];
      tA += v; tD += d;
      if (v > 0.5 || d > 0) rows.push([esc(s.label), lbsTxt(v) + (Math.abs(v - d) > 0.5 ? ' · design ' + fmt.int(d) + (d > 0 ? ' (' + pctTxt((v - d) / d) + ')' : '') : ' · as designed'), SAND_DARK[s.id]]);
    });
    rows.push(['Total', lbsTxt(tA) + ' · design ' + fmt.int(tD) + (tD > 0 && Math.abs(tA - tD) > 0.5 ? ' (' + pctTxt((tA - tD) / tD) + ')' : '')]);
    if (!pumped && g && g.n) rows.push(['Forecast', fcHow(g)]);
    if (tm && tm.r.src === 'split') rows.push(['Source', 'total split like the design']);
    showDetail(evt, 'Stage ' + n + (sp ? ' · Stg ' + sp.from + '–' + sp.to : ''), rows);
  }
  function renderActLbs() {
    const a = M.tb.act, N = M.N, P = M.params;
    const sands = S.config.sands.filter(s => sandOn(s.id));
    const uv = (s, lbs) => ui.unit === 'loads' ? lbs / P[s].payload : ui.unit === 'lbs' ? lbs : lbs / E.LBS_PER_TON;
    const uF = v => ui.unit === 'loads' ? nf1.format(v) + ' loads' : ui.unit === 'lbs' ? fmt.int(Math.round(v)) + ' lb' : nf1.format(v) + ' tons';
    const uK = v => ui.unit === 'loads' ? nf1.format(v) : ui.unit === 'lbs' ? fmt.numK(v) : nf1.format(v);
    const idx = [];
    for (let j = 1; j <= N; j++) idx.push(j);
    const isP = j => !!(a && a.pumped[j]);
    const ds = sands.map(s => ({
      type: 'bar', label: s.label, stack: 'l', yAxisID: 'y', order: 3,
      data: idx.map(j => uv(s.id, M.tb.d[s.id][j])),
      backgroundColor: dim(idx.map(j => isP(j) ? SAND_COLOR[s.id] : oA(SAND_COLOR[s.id], FC_ALPHA))),
      borderRadius: 2, barPercentage: .94, categoryPercentage: .94, maxBarThickness: 18
    }));
    const des = idx.map(j => sands.reduce((p, s) => p + uv(s.id, M.tb.dd[s.id][j]), 0));
    let ce = 0, cd = 0;
    const gap = idx.map(j => { sands.forEach(s => { ce += uv(s.id, M.tb.d[s.id][j]); cd += uv(s.id, M.tb.dd[s.id][j]); }); return ce - cd; });
    /* lines on the same axis as the bars (same unit), each in its own stack so none adds onto another */
    ds.push({ type: 'line', label: 'Design', stack: 'design', data: des, borderColor: PLAN_COLOR, borderDash: [5, 4], borderWidth: 1.6, pointRadius: 0, pointHoverRadius: 3, stepped: 'middle', order: 1, endLabel: false });
    ds.push({ type: 'line', label: 'Running total vs design', stack: 'gap', data: gap, borderColor: TR_COLOR, backgroundColor: TR_COLOR, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: .2, order: 0,
      endLabelFmt: v => (v >= 0 ? '+' : '−') + uK(Math.abs(v)) });
    const last = a && a.last ? a.last.n : 0;
    $('#actLbsBadge').textContent = a ? 'Stg ' + E.compactRanges(idx.filter(isP)) + ' pumped' : 'design';
    const yMain = gYf(v => uK(v));
    yMain.stacked = true;
    yMain.beginAtZero = true;
    yMain.grace = '6%';
    chart('pl_actlbs', {
      type: 'bar',
      data: { labels: idx.map(String), datasets: ds },
      options: {
        layout: { padding: { top: 16, right: 58 } },
        scales: {
          x: Object.assign({}, gX, { stacked: true, ticks: Object.assign({}, gX.ticks, { autoSkip: true, maxTicksLimit: 14, maxRotation: 0 }) }),
          y: yMain
        },
        plugins: {
          nowLine: { x: last ? last - 0.5 : null, label: 'NOW' },
          endLabel: { enabled: true, fmt: v => uK(v) },
          tooltip: tt3({
            title: it => { const j = it[0].dataIndex + 1; return 'Stage ' + j + ' · ' + (isP(j) ? 'pumped' : 'forecast'); },
            label: c => {
              const j = c.dataIndex + 1;
              if (c.dataset.label === 'Design') return ' Design: ' + uF(c.parsed.y);
              if (c.dataset.label === 'Running total vs design') return ' Running total vs design: ' + (c.parsed.y >= 0 ? '+' : '−') + uF(Math.abs(c.parsed.y));
              const s = sands[c.datasetIndex];
              if (!s) return null;
              const d = uv(s.id, M.tb.dd[s.id][j]);
              if (!(c.parsed.y > 1e-9) && !(d > 0)) return null;
              return ' ' + s.label + ': ' + uF(c.parsed.y) + (Math.abs(c.parsed.y - d) > 1e-6 ? ' · design ' + uF(d) : '');
            },
            rows: i => {
              const j = i + 1, gi = M.tb.segOf[j], sp = M.segPlans[gi], g = a && a.seg[gi];
              const tm = stageTimes(j), out = [];
              if (tm && tm.r.end != null) out.push((tm.r.start != null ? fDT(tm.r.start) + ' → ' + fTime(tm.r.end) : 'Ended ' + fDT(tm.r.end)) + (tm.pump != null ? ' · pumping ' + durTxt(tm.pump) : ''));
              else out.push((M.well.lastRep && j <= M.well.lastRep.n ? 'Ended ' : 'Expected to end ') + fDT(M.sc.B[j]));
              if (!isP(j)) out.push(g && g.n ? 'Forecast: ' + fcHow(g) : sp ? 'Design: nothing pumped yet in Stg ' + sp.from + '–' + sp.to : 'Design');
              out.push('click opens the stage →');
              return out;
            }
          })
        },
        onClick: (e, els) => { if (!els || !els.length) return; stageDetail(e.native || e, els[0].index + 1); }
      }
    });
    legend('pl_actlbs', sands.map(s => ({ label: s.label, color: SAND_COLOR[s.id] }))
      .concat([{ label: 'Stages left (forecast)', swatch: 'linear-gradient(90deg,' + sands.map(s => oA(SAND_COLOR[s.id], .45)).join(',') + ')', toggle: false },
        { label: 'Design', swatch: SW.dash(PLAN_COLOR), line: true }, { label: 'Running total vs design', color: TR_COLOR, line: true }]));
    let read = 'No stats yet: every stage runs on the design. Upload the stats PDF to compare it with what the frac crew pumps.';
    if (a) {
      const sums = actSums();
      const parts = sands.filter(s => sums[s.id].des > 0).map(s => esc(s.label) + ' <b>' + pctTxt((sums[s.id].act - sums[s.id].des) / sums[s.id].des) + '</b>');
      const g = a.seg[actSegIdx()];
      const left = g ? g.stages - g.n : 0;
      const fcs = g ? sands.filter(s => g.fc[s.id] > 0).map(s => '<b>' + fmt.int(Math.round(g.fc[s.id])) + '</b> of ' + esc(s.label)).join(' and ') : '';
      const fin = gap[gap.length - 1];
      const dLoads = sands.reduce((p, s) => p + M.sands[s.id].nNeeded - M.sands[s.id].nDesign, 0);
      read = 'Pumped vs design: ' + (parts.join(' · ') || '—') + '.' +
        (g && left > 0 && fcs ? ' The <b>' + left + '</b> stages left in ' + g.from + '–' + g.to + ' take ' + fcs + ' lb per stage.' : '') +
        ' The well ends at <b>' + (fin >= 0 ? '+' : '−') + uF(Math.abs(fin)) + '</b> vs the design: <b>' + sgn(dLoads) + '</b> ' + (Math.abs(dLoads) === 1 ? 'load' : 'loads') + '.';
    }
    chartNote('pl_actlbs', { read, kind: 'detail', act: 'click opens the stage →' });
  }
  function renderActTime() {
    const a = M.tb.act;
    const rows = a ? Array.from(a.A.values()).filter(r => r.end != null).sort((x, y) => x.n - y.n) : [];
    const T = rows.map(r => stageTimes(r.n));
    const mn = v => v == null ? null : v / MIN;
    const trans = T.map(t => t && t.trans != null && t.trans >= 0 ? mn(t.trans) : null);
    const pump = T.map(t => t && t.pump != null ? mn(t.pump) : null);
    const other = T.map(t => t && t.cyc != null && t.pump == null ? mn(t.cyc) : null);
    const des = rows.map(r => { const sp = M.segPlans[M.tb.segOf[r.n]]; return sp ? 1440 / sp.designPace : null; });
    /* the forecast for the stages left after each stage: the design and the latest end-to-end time
       count double, every earlier one of the block once (E.blendStages) */
    const acc = {};
    const fc = rows.map(r => {
      const gi = M.tb.segOf[r.n], sp = M.segPlans[gi];
      if (!sp) return null;
      const o = acc[gi] || (acc[gi] = []);
      const c = a.cyc[r.n];
      if (c > 0 && c <= E.MAX_CYCLE) o.push(c / MIN);
      return E.blendStages(1440 / sp.designPace, o);
    });
    const hasOther = other.some(v => v != null);
    const top = Math.max(60, ...rows.map((r, i) => (trans[i] || 0) + (pump[i] || 0) + (other[i] || 0)), ...des.filter(v => v != null), ...fc.filter(v => v != null));
    const step = top <= 150 ? 30 : top <= 360 ? 60 : 120;
    const hT = v => v % 60 === 0 ? (v / 60) + ' h' : E.fmtDur(v);
    $('#actTimeBadge').textContent = rows.length ? nL(rows.length, 'stage', 'stages') + ' timed' : 'design pace';
    const ds = [
      { type: 'bar', label: 'Transition', stack: 't', data: trans, backgroundColor: dim(rows.map(() => '#9CCFD8')), borderRadius: 3, maxBarThickness: 36, order: 3 },
      { type: 'bar', label: 'Pumping', stack: 't', data: pump, backgroundColor: dim(rows.map(() => '#1E6B7A')), borderRadius: 3, maxBarThickness: 36, order: 3 }
    ];
    if (hasOther) ds.push({ type: 'bar', label: 'End to end (no start time)', stack: 't', data: other, backgroundColor: dim(rows.map(() => '#C8D0DA')), borderRadius: 3, maxBarThickness: 36, order: 3 });
    ds.push({ type: 'line', label: 'Design', stack: 'design', data: des, borderColor: PLAN_COLOR, borderDash: [5, 4], borderWidth: 1.6, pointRadius: 0, pointHoverRadius: 3, stepped: 'middle', order: 1, endLabel: false });
    ds.push({ type: 'line', label: 'Forecast', stack: 'fc', data: fc, borderColor: FC_COLOR, backgroundColor: FC_COLOR, borderWidth: 2.2, pointRadius: 3, pointHoverRadius: 6, tension: .25, order: 0, endLabelFmt: v => E.fmtDur(v) });
    chart('pl_acttime', {
      type: 'bar',
      data: { labels: rows.map(r => 'Stg ' + r.n), datasets: ds },
      options: {
        layout: { padding: { top: 12, right: 64 } },
        scales: {
          x: Object.assign({}, gX, { stacked: true, ticks: Object.assign({}, gX.ticks, { autoSkip: true, maxRotation: 0 }) }),
          y: Object.assign(gYf(hT), { stacked: true, beginAtZero: true, suggestedMax: top * 1.08, ticks: Object.assign({}, gY.ticks, { stepSize: step, callback: hT }) })
        },
        plugins: {
          endLabel: { enabled: true, fmt: v => E.fmtDur(v) },
          tooltip: tt3({
            title: it => { const r = rows[it[0].dataIndex]; return 'Stage ' + r.n + (r.start != null ? ' · ' + fDT(r.start) + ' → ' + fTime(r.end) : ' · ended ' + fDT(r.end)); },
            label: c => c.parsed.y == null ? null : ' ' + c.dataset.label + ': ' + E.fmtDur(c.parsed.y),
            rows: i => {
              const t = T[i], r = rows[i], out = [];
              if (t && t.cyc != null) {
                const d = des[i], cm = t.cyc / MIN;
                out.push('End to end: ' + E.fmtDur(cm) + (d ? ' · design ' + E.fmtDur(d) + ' (' + (cm >= d ? '+' : '−') + E.fmtDur(Math.abs(cm - d)) + ')' : ''));
                out.push('At this time: ' + nf1.format(1440 / cm) + ' stages/day');
                if (t.cyc > DAY) out.push('Over a day: left out of the pace');
              } else out.push(r.n === 1 || !a.A.get(r.n - 1) ? 'No end of the stage before: no end-to-end time' : 'No end-to-end time');
              if (fc[i] != null) out.push('Stages left after this one: ' + E.fmtDur(fc[i]) + ' · ' + nf1.format(1440 / fc[i]) + ' stg/day');
              out.push('click opens the stage →');
              return out;
            }
          })
        },
        onClick: (e, els) => { if (!els || !els.length) return; stageDetail(e.native || e, rows[els[0].index].n); }
      }
    });
    legend('pl_acttime', [{ label: 'Transition', color: '#9CCFD8' }, { label: 'Pumping', color: '#1E6B7A' }]
      .concat(hasOther ? [{ label: 'End to end (no start time)', color: '#C8D0DA' }] : [])
      .concat([{ label: 'Design', swatch: SW.dash(PLAN_COLOR), line: true }, { label: 'Forecast', color: FC_COLOR, line: true }]));
    const gi = actSegIdx(), sp = M.segPlans[gi], g = a && a.seg[gi];
    let read = sp ? 'No stage times yet: the calendar runs on the design, <b>' + nf1.format(sp.designPace) + '</b> stages/day (<b>' + E.fmtDur(1440 / sp.designPace) + '</b> per stage).' : 'No stage times yet.';
    if (g && g.cycN) {
      let lt = -1;
      T.forEach((t, i) => { if (t && t.trans != null && (lt < 0 || t.trans > T[lt].trans)) lt = i; });
      read = 'Stg ' + g.from + '–' + g.to + ': <b>' + durTxt(g.actCycle) + '</b> end to end on average over ' + nL(g.cycN, 'stage', 'stages') + ', vs <b>' + durTxt(g.designCycle) + '</b> by design (<b>' + nf1.format(DAY / g.actCycle) + '</b> vs <b>' + nf1.format(g.designPace) + '</b> stg/day).' +
        (lt >= 0 ? ' Longest transition: Stg ' + rows[lt].n + ', <b>' + durTxt(T[lt].trans) + '</b>.' : '') +
        ' The stages left run at <b>' + durTxt(g.fcCycle) + '</b>: the queue asks for loads ' + (g.fcCycle > g.designCycle ? 'later' : 'sooner') + ' than the design.';
    }
    chartNote('pl_acttime', { read, kind: 'detail', act: 'click opens the stage →' });
  }

  /* ---------- design editor ---------- */
  function renderDesignForm() {
    const d = ui.draft;
    const sands = d.sands;
    const num = (path, v, attrs) => '<input type="number" data-path="' + path + '" value="' + (v == null ? '' : v) + '" ' + (attrs || 'step="any"') + ' inputmode="decimal">';
    const txt = (path, v) => '<input type="text" data-path="' + path + '" value="' + esc(v == null ? '' : v) + '">';
    const dt = (path, v) => '<input type="datetime-local" data-path="' + path + '" value="' + esc(v || '') + '">';
    let h = '<div class="dform">';
    h += '<div class="dsec"><h4>Well and calendar</h4><div class="fgrid">' +
      '<label class="fld"><span>Well</span>' + txt('job.well', d.job.well) + '</label>' +
      '<label class="fld"><span>Client</span>' + txt('job.client', d.job.client) + '</label>' +
      '<label class="fld"><span>Total stages</span>' + num('job.totalStages', d.job.totalStages, 'step="1" min="1" max="2000"') + '</label>' +
      '<label class="fld"><span>Prefill start</span>' + dt('schedule.prefillStart', d.schedule.prefillStart) + '</label>' +
      '<label class="fld"><span>Prefill end <em>empty = frac start − lead</em></span>' + dt('schedule.prefillEnd', d.schedule.prefillEnd) + '</label>' +
      '<label class="fld"><span>Frac start · stage 1</span>' + dt('schedule.fracStart', d.schedule.fracStart) + '</label>' +
      '<label class="fld"><span>Count OMMA deliveries from <em>empty = all</em></span>' + dt('countFrom', d.countFrom) + '</label>' +
      '<label class="fld"><span>Buffer on location <em>stages</em></span>' + num('bufferStages', d.bufferStages, 'step="0.5" min="0"') + '</label>' +
      '<label class="fld"><span>"Assign now" window <em>hours</em></span>' + num('alertHours', d.alertHours, 'step="0.5" min="0"') + '</label>' +
      '<label class="fld"><span>Final counts at <em>% of loads assigned</em></span>' + num('finalCountsPct', d.finalCountsPct == null ? 80 : d.finalCountsPct, 'step="1" min="1" max="100"') + '</label>' +
      '<label class="fld"><span>Day shift starts <em>hour</em></span>' + num('shiftStartHour', d.shiftStartHour, 'step="1" min="0" max="23"') + '</label>' +
      '<label class="fld"><span>Time zone</span><select class="inp" data-path="tz">' + ['America/Mexico_City', 'America/Chicago', 'America/Denver'].map(z => '<option' + (z === d.tz ? ' selected' : '') + '>' + z + '</option>').join('') + '</select></label>' +
      '</div></div>';
    h += '<div class="dsec"><h4>Design segments · lbs per stage, planned trucks and drivers</h4><div class="tblwrap"><table class="segtbl"><thead><tr><th>From</th><th>To</th><th>Stages/day</th>' +
      sands.map(s => '<th>' + esc(s.label) + ' lb/stg</th>').join('') + sands.map(s => '<th>Trucks ' + esc(s.label) + '</th>').join('') + '<th>Drivers per shift</th><th></th></tr></thead><tbody>' +
      d.segments.map((g, i) => '<tr><td>' + num('segments.' + i + '.from', g.from, 'step="1" min="1"') + '</td><td>' + num('segments.' + i + '.to', g.to, 'step="1" min="1"') + '</td><td>' + num('segments.' + i + '.pace', g.pace, 'step="0.5" min="0.1"') + '</td>' +
        sands.map(s => '<td>' + num('segments.' + i + '.lbs.' + s.id, (g.lbs || {})[s.id], 'step="1000" min="0"') + '</td>').join('') +
        sands.map(s => '<td>' + num('segments.' + i + '.trucks.' + s.id, (g.trucks || {})[s.id], 'step="1" min="0" placeholder="—"') + '</td>').join('') +
        '<td>' + num('segments.' + i + '.drivers', g.drivers, 'step="1" min="0" placeholder="—"') + '</td>' +
        '<td>' + (d.segments.length > 1 ? '<button type="button" class="btn sm danger" data-segdel="' + i + '" aria-label="Remove segment">' + sv(IC.trash, 13) + '</button>' : '') + '</td></tr>').join('') +
      '</tbody></table></div><div class="dacts" style="margin-top:8px"><button type="button" class="btn sm" id="segAdd">' + sv(IC.plus, 13) + 'Add segment</button></div></div>';
    h += '<div class="dsec"><h4>Prefill and productivity</h4><div class="fgrid">' +
      sands.map(s => '<label class="fld"><span>Prefill ' + esc(s.label) + ' <em>loads</em></span>' + num('prefill.' + s.id, (d.prefill || {})[s.id], 'step="1" min="0"') + '</label>').join('') +
      sands.map(s => '<label class="fld"><span>Loads per truck/day ' + esc(s.label) + ' <em>empty = data</em></span>' + num('loadsPerTruckDay.' + s.id, (d.loadsPerTruckDay || {})[s.id], 'step="0.1" min="0"') + '</label>').join('') +
      '<label class="fld"><span>Driver shift <em>hours · empty = 12</em></span>' + num('drivers.shiftH', (d.drivers || {}).shiftH, 'step="0.5" min="4" max="16" placeholder="12"') + '</label>' +
      '<label class="fld"><span>Shift can stretch to <em>hours · empty = 14</em></span>' + num('drivers.maxH', (d.drivers || {}).maxH, 'step="0.5" min="4" max="16" placeholder="14"') + '</label>' +
      '</div></div>';
    h += '<div class="dsec"><h4>PO per sand <em class="hint">empty = latest OMMA export</em></h4><div class="fgrid">' +
      sands.map(s => { const x = M.sands[s.id]; const ex = x && x.poSrc === 'export' ? x.po : ''; return '<label class="fld"><span>PO ' + esc(s.label) + ' · ' + esc(mineOf(s.mine).name) + (ex ? ' <em>export: ' + esc(ex) + '</em>' : '') + '</span>' + txt('po.' + s.id, (d.po || {})[s.id]) + '</label>'; }).join('') +
      '</div></div>';
    h += '<div class="dsec"><h4>Carriers</h4><div class="fgrid">' +
      d.carriers.map((c, i) => '<label class="fld"><span>Carrier ' + (i + 1) + (c.tracked ? ' <em>· tracked loads</em>' : '') + '</span>' + txt('carriers.' + i + '.name', c.name) + '</label>').join('') +
      '</div></div>';
    h += '<div id="designPreview"></div>';
    h += '<div class="dacts"><button type="button" class="btn primary" id="dSave">Save for all dispatch</button><button type="button" class="btn" id="dDiscard">Discard changes</button>' +
      '<span class="grow"></span><button type="button" class="btn ghost" id="dDefault">Restore original design</button><button type="button" class="btn danger" id="dReset">Reset assignments</button></div>';
    h += '</div>';
    $('#designForm').innerHTML = h;
    updateDesignPreview();
  }
  function setPath(obj, path, val) {
    const ks = path.split('.');
    let o = obj;
    for (let i = 0; i < ks.length - 1; i++) { const k = ks[i]; if (o[k] == null) o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[k]; }
    o[ks[ks.length - 1]] = val;
  }
  function updateDesignPreview() {
    const box = $('#designPreview');
    if (!box) return;
    let issues = [], tb = null;
    try { tb = E.stageTable(ui.draft); issues = tb.issues; } catch (e) { issues = [{ lvl: 'err', txt: 'Invalid design: ' + e.message }]; }
    const tz0 = ui.draft.tz || 'America/Mexico_City';
    const ps = E.parseWall(ui.draft.schedule.prefillStart, tz0), fs = E.parseWall(ui.draft.schedule.fracStart, tz0);
    if (ps == null) issues.push({ lvl: 'err', txt: 'Prefill start is missing' });
    if (fs == null) issues.push({ lvl: 'err', txt: 'Frac start is missing' });
    if (ps != null && fs != null && fs <= ps) issues.push({ lvl: 'warn', txt: 'Frac start is before the prefill' });
    const fcp = ui.draft.finalCountsPct;
    if (fcp != null && !(fcp >= 1 && fcp <= 100)) issues.push({ lvl: 'err', txt: 'Final counts must be between 1% and 100%' });
    const dv = ui.draft.drivers || {};
    ['shiftH', 'maxH'].forEach(k => { const v = dv[k]; if (v != null && v !== '' && !(+v >= 4 && +v <= 16)) issues.push({ lvl: 'err', txt: 'Driver shift hours must be between 4 and 16' }); });
    if (dv.shiftH != null && dv.maxH != null && dv.shiftH !== '' && dv.maxH !== '' && +dv.maxH < +dv.shiftH) issues.push({ lvl: 'warn', txt: 'The stretch is shorter than the shift: the shift hours are used' });
    if (!issues.some(i => i.lvl === 'err') && !R.validConfig(draftConfig())) issues.push({ lvl: 'err', txt: 'A value is missing or out of range (a segment without stages/day, an empty carrier name, a sand label over 40 characters…)' });
    let sum = '';
    if (tb) {
      const tl = tb.ids.reduce((p, s) => p + tb.R[s], 0);
      const loads = tb.ids.reduce((p, s) => p + Math.ceil(tb.R[s] / M.params[s].payload), 0);
      sum = '<div class="note" style="font-size:12px;color:var(--soft);margin-bottom:8px">With this design: <b>' + fmt.int(tl) + ' lb</b> (' + nf1.format(tl / 2000) + ' tons) · ≈ <b>' + fmt.int(loads) + ' loads</b> at current payloads · ' +
        tb.ids.map(s => esc(sandLabel(s)) + ' ' + fmt.int(tb.R[s]) + ' lb').join(' · ') +
        (M.tb.act ? '<br>The pumped stages in the stats PDF (06) adjust it: the queue works on <b>' + fmt.int(M.kpi.reqLoads) + ' loads</b> today.' : '') + '</div>';
    }
    box.innerHTML = sum + (issues.length ? '<ul class="issues">' + issues.map(i => '<li>' + esc(i.txt) + '</li>').join('') + '</ul>' : '<ul class="issues ok"><li>Consistent design: every stage has a segment and a pace.</li></ul>') +
      (ui.dirty ? '<p class="dirty-note">Unsaved changes · they apply to all dispatch when saved.</p>' : '');
    const btn = $('#dSave');
    if (btn) btn.disabled = !ui.dirty || issues.some(i => i.lvl === 'err');
    $('#designBadge').textContent = ui.dirty ? 'unsaved' : 'current';
    $('#designBadge').className = 'pbadge ' + (ui.dirty ? 'warn' : 'ok');
  }

  /* ============================== MINES ============================== */
  function renderMines() {
    const st = M.stats;
    $('#arMeta').innerHTML = '<span class="pill">' + st.n + ' OMMA loads</span>' + (st.range ? '<span class="pill">' + fDay(st.range.from) + ' – ' + fDay(st.range.to) + '</span>' : '');
    const cell = (k, v, s) => '<div><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
    const tv = x => x && x.value != null ? x.value : x && x.n ? x.median : null;
    const dur = x => tv(x) != null ? E.fmtDur(tv(x)) : '—';
    const nTx = x => x && x.n ? 'n=' + x.n + (x.n > 1 ? ' · ' + E.fmtDur(x.min) + '–' + E.fmtDur(x.max) : '') : 'no data';
    if (!$('#mineCards').contains(document.activeElement)) $('#mineCards').innerHTML = S.config.mines.map((mi, i) => {
      const ms = st.mines[mi.id] || {};
      const sands = S.config.sands.filter(s => s.mine === mi.id);
      const p0 = M.params[sands[0] ? sands[0].id : ''] || {};
      const ov = (S.config.overrides && S.config.overrides.leadMin && S.config.overrides.leadMin[mi.id]) || '';
      return '<article class="gcard panel mine ' + (i ? 'a-amber' : 'a-lav') + '" style="--i:' + i + '"><div class="hd"><div><div class="nm">' + esc(mi.name) + '</div><div class="pl">' + esc(mi.place) + ' · ' + sands.map(s => esc(s.label)).join(' and ') + '</div></div><span class="mi">' + (mi.miles || ms.miles || '—') + ' mi</span></div>' +
        '<div class="pos">' + sands.map(s => { const x = M.sands[s.id]; return '<div class="po-it"><span class="sl s-' + s.id + '"><i></i>' + esc(s.label) + '</span><span class="po-k">PO</span><b class="mono">' + esc(x.po || '—') + '</b>' + (x.poSrc ? srcTag(x.poSrc) : '') + '</div>'; }).join('') + '</div>' +
        '<div class="kv">' +
        cell('Payload', ms.payload && ms.payload.n ? fmt.int(ms.payload.mean) + '<small>lb</small>' : '—', ms.payload && ms.payload.n ? 'n=' + ms.payload.n + ' · ' + fmt.int(ms.payload.min) + '–' + fmt.int(ms.payload.max) : 'no data') +
        cell('At mine', dur(ms.term), ms.term && ms.term.base ? '' : nTx(ms.term)) +
        cell('Loaded transit', dur(ms.transit), nTx(ms.transit)) +
        cell('On location', dur(ms.dest), nTx(ms.dest)) +
        cell('Assigned → delivered', (p0.leadMin ? E.fmtDur(p0.leadMin) : '—') + (p0.leadSrc ? srcTag(p0.leadSrc) : ''), nTx(ms.lead)) +
        cell('Cycle per truck', (p0.cycleMin ? E.fmtDur(p0.cycleMin) : '—') + (p0.cycleSrc ? srcTag(p0.cycleSrc) : ''), ms.cycle && ms.cycle.n ? 'n=' + nL(ms.cycle.n, 'trip', 'trips') : 'no back-to-back trips') +
        '</div>' +
        '<div class="nt">' + sands.map(s => { const p = M.params[s.id]; return '<b>' + esc(s.label) + '</b>: payload ' + fmt.int(p.payload) + ' lb ' + srcTag(p.payloadSrc) + ' · ' + nf2.format(p.lptd) + ' loads/truck/day ' + srcTag(p.lptdSrc); }).join('<br>') +
        '<br>Times from loads to <b>' + esc(S.config.job.well) + '</b> (' + ({ well: 'this well', all: 'all wells' }[ms.timesScope] || '—') + '). With few loads the reference is weak: upload the full file to refine it.</div>' +
        '<div class="ov">' + sands.map(s => '<label class="fld"><span>Manual payload ' + esc(s.label) + ' <em>lb</em></span><input type="number" data-ovp="' + s.id + '" value="' + ((S.config.overrides && S.config.overrides.payload && S.config.overrides.payload[s.id]) || '') + '" placeholder="' + fmt.int(M.params[s.id].payload) + '" step="100" min="0"></label>').join('') +
        '<label class="fld"><span>Manual lead <em>min</em></span><input type="number" data-ovl="' + mi.id + '" value="' + ov + '" placeholder="' + Math.round(p0.leadMin || 0) + '" step="5" min="0"></label>' +
        '<button type="button" class="btn sm" data-ovsave="' + mi.id + '">Apply</button></div>' +
        '</article>';
    }).join('');
    attachCardGlow($('#mineCards'));
    renderCycleChart();
    renderScatter();
    renderUploadPanel();
    renderLoadsTable();
  }
  function renderCycleChart() {
    const mines = S.config.mines;
    const st = M.stats.mines;
    const seg = mines.map(mi => {
      const ms = st[mi.id] || {};
      const sands = S.config.sands.filter(s => s.mine === mi.id);
      const p = M.params[sands[0] ? sands[0].id : ''] || {};
      const cyc = p.cycleMin || 0;
      const tv = x => x && x.value != null ? x.value : x && x.n ? x.median : null;
      const term = tv(ms.term) || 0, tr = tv(ms.transit) || 0, de = tv(ms.dest) || 0;
      return { term, tr, de, rest: Math.max(0, cyc - term - tr - de), cyc, hasTerm: tv(ms.term) != null, src: p.cycleSrc };
    });
    const labels = mines.map(m => m.name);
    const on = mines.map(mi => S.config.sands.filter(s => s.mine === mi.id).some(s => sandOn(s.id)));
    const col = (hex, i) => on[i] ? hex : oA(hex, .3);
    chart('ar_cycle', {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'At mine', data: seg.map(x => x.term / 60), backgroundColor: dim(mines.map((m, i) => col('#6BAED6', i))), borderRadius: 4, stack: 'c' },
        { label: 'Loaded transit', data: seg.map(x => x.tr / 60), backgroundColor: dim(mines.map((m, i) => col('#1E6B7A', i))), borderRadius: 4, stack: 'c' },
        { label: 'On location', data: seg.map(x => x.de / 60), backgroundColor: dim(mines.map((m, i) => col('#F4B860', i))), borderRadius: 4, stack: 'c' },
        { label: 'Return + wait', data: seg.map(x => x.rest / 60), backgroundColor: dim(mines.map((m, i) => col('#C8D0DA', i))), borderRadius: 4, stack: 'c' }
      ] },
      options: {
        indexAxis: 'y',
        scales: { x: Object.assign(gYf(v => nf1.format(v) + ' h'), { stacked: true, grid: { color: OMMA.grid } }), y: Object.assign({}, gX, { stacked: true, ticks: Object.assign({}, gX.ticks, { font: { size: 11.5, weight: '700' } }) }) },
        plugins: {
          crosshair: false,
          tooltip: tt3({
            title: it => it[0].label,
            label: c => c.parsed.x ? ' ' + c.dataset.label + ': ' + E.fmtDur(c.parsed.x * 60) : null,
            rows: i => {
              const x = seg[i];
              const out = ['Total cycle: ' + E.fmtDur(x.cyc) + ' (' + (SRC_TX[x.src] || x.src) + ') · ' + nf2.format(x.cyc ? 1440 / x.cyc : 0) + ' trips/day'];
              if (!x.hasTerm) out.push('No time-at-mine in the export: it sits inside "return + wait"');
              out.push('click filters by mine →');
              return out;
            }
          })
        },
        onClick: (e, els) => {
          if (!els || !els.length) return;
          const mi = mines[els[0].index];
          const labs = S.config.sands.filter(s => s.mine === mi.id).map(s => s.label);
          const cur = state.sand;
          const same = cur !== 'all' && cur.size === labs.length && labs.every(l => setHas(cur, l));
          state.sand = same ? 'all' : new Set(labs);
          syncChips('sand'); renderFilterBar(); renderSoon();
        }
      }
    });
    legend('ar_cycle', [{ label: 'At mine', color: '#6BAED6' }, { label: 'Loaded transit', color: '#1E6B7A' }, { label: 'On location', color: '#F4B860' }, { label: 'Return + wait', color: '#C8D0DA' }]);
    chartNote('ar_cycle', { read: 'The <b>' + esc(mines[0].name) + '</b> trip takes ' + E.fmtDur(seg[0].cyc) + (mines[1] ? ' and <b>' + esc(mines[1].name) + '</b> ' + E.fmtDur(seg[1].cyc) : '') + ': that is why an Iron Oak truck does fewer loads a day.', kind: 'filter', act: 'click filters by mine →' });
  }
  function renderScatter() {
    const L = (S.omma.loads || []).filter(l => l.a && l.d && l.d > l.a && sandOn(l.s));
    const byMine = S.config.mines.map(mi => ({ mi, pts: L.filter(l => l.m === mi.id).map(l => ({ x: (l.d - l.a) / HOUR, y: l.w, _l: l })) }));
    $('#scBadge').textContent = nL(L.length, 'load', 'loads');
    const payloadRef = byMine.map(b => b.pts.length ? b.pts.reduce((p, q) => p + q.y, 0) / b.pts.length : null);
    chart('ar_scatter', {
      type: 'scatter',
      data: { datasets: byMine.map(b => ({ label: b.mi.name, data: b.pts, backgroundColor: oA(MINE_COLOR[b.mi.id] || '#1E6B7A', .8), borderColor: MINE_COLOR[b.mi.id] || '#1E6B7A', borderWidth: 1.5, pointRadius: 7, pointHoverRadius: 10 })) },
      options: {
        interaction: { mode: 'nearest', intersect: false },
        scales: { x: Object.assign({}, gX, { type: 'linear', title: { display: true, text: 'Hours from assigned to delivered', color: OMMA.mut, font: { size: 10 } }, ticks: Object.assign({}, gX.ticks, { callback: v => nf1.format(v) + ' h' }) }),
          y: Object.assign(gYf(v => fmt.numK(v)), { beginAtZero: false, title: { display: true, text: 'Payload (lb)', color: OMMA.mut, font: { size: 10 } } }) },
        plugins: {
          tooltip: tt3({
            title: it => { const l = it[0].raw._l; return 'Load #' + l.n + ' · ' + sandLabel(l.s); },
            label: c => ' ' + c.dataset.label + ': ' + fmt.int(c.raw.y) + ' lb · ' + E.fmtDur(c.raw.x * 60),
            rows: (i, items) => {
              const l = items[0].raw._l;
              const ref = payloadRef[items[0].datasetIndex];
              return ['Transit ' + E.fmtDur(l.tx) + ' · on location ' + E.fmtDur(l.td), ref ? 'vs average payload: ' + (l.w >= ref ? '+' : '−') + fmt.int(Math.abs(l.w - ref)) + ' lb' : '', 'PO ' + (l.po || '—'), 'click opens detail →'].filter(Boolean);
            }
          })
        },
        onClick: (e, els, c) => {
          if (!els || !els.length) return;
          const l = c.data.datasets[els[0].datasetIndex].data[els[0].index]._l;
          showDetail(e.native || e, 'Load #' + l.n + ' · ' + sandLabel(l.s), [
            ['Mine', esc(mineOf(l.m).name)], ['PO', esc(l.po || '—')], ['Net weight', fmt.int(l.w) + ' lb'], ['Accepted', fDT(l.a)], ['Delivered', fDT(l.d)],
            ['Assigned → delivered', E.fmtDur((l.d - l.a) / MIN)], ['At mine', E.fmtDur(l.tm)], ['Transit', E.fmtDur(l.tx)], ['On location', E.fmtDur(l.td)],
            ['Truck', esc(l.tr || '—')], ['Well', esc(l.wl || '—')]]);
        }
      }
    });
    legend('ar_scatter', byMine.map(b => ({ label: b.mi.name, color: MINE_COLOR[b.mi.id] || '#1E6B7A' })));
    chartNote('ar_scatter', { read: L.length < 6 ? 'With <b>' + nL(L.length, 'load', 'loads') + '</b> the spread is not conclusive yet: upload the full OMMA export.' : 'Dots to the right are loads that took longer to arrive; check whether the wait was at the mine or on location.', kind: 'detail' });
  }
  function renderUploadPanel() {
    const meta = S.omma && S.omma.meta;
    $('#upBadge').textContent = nL((S.omma.loads || []).length, 'load', 'loads');
    const icon = $('.drop-ic'); if (icon && !icon.innerHTML) icon.innerHTML = sv(IC.upload, 20);
    if (ui.upload) return;   // a file is in preview
    $('#upPrev').innerHTML = '<div class="ttl">Current data</div>' +
      '<div class="kv"><div><div class="k">Loads</div><div class="v">' + (S.omma.loads || []).length + '</div></div><div><div class="k">Count toward the well</div><div class="v">' + M.jobLoads.length + (M.wellLoads.length > M.jobLoads.length ? '<small> / ' + M.wellLoads.length + '</small>' : '') + '</div></div>' +
      '<div><div class="k">From</div><div class="v" style="font-size:12px">' + (M.stats.range ? fDT(M.stats.range.from) : '—') + '</div></div><div><div class="k">To</div><div class="v" style="font-size:12px">' + (M.stats.range ? fDT(M.stats.range.to) : '—') + '</div></div></div>' +
      '<p style="margin:0 0 10px;color:var(--mut)">' + (meta ? 'Last file: <b>' + esc(legacyFile(meta.file || '—')) + '</b>' + (meta.at ? ' · ' + fDT(meta.at) : '') + (meta.by ? ' · ' + esc(meta.by) : '') : 'No file loaded.') + ' Uploading a new one recalculates payload, times, deliveries and the queue.' +
      (M.countFrom ? ' Deliveries since <b>' + fDT(M.countFrom) + '</b> count as well sand; earlier ones only feed times and payload (change it in Plan).' : '') + '</p>' +
      '<div class="acts"><button type="button" class="btn sm danger" id="ommaClear"' + ((S.omma.loads || []).length ? '' : ' disabled') + '>Clear OMMA data</button></div>';
  }
  async function handleFile(file) {
    if (!file) return;
    $('#upPrev').innerHTML = '<div class="ttl">Reading ' + esc(file.name) + '…</div><div class="sk" style="height:90px"></div>';
    try {
      const { rows, format } = await LP.readFile(file);
      const { loads, report } = LP.toLoads(rows, S.config, E);
      ui.upload = { file: file.name, format, loads, report };
      const r = report;
      const wells = Object.entries(r.wells).sort((a, b) => b[1] - a[1]);
      const toWell = loads.filter(l => E.normText(l.wl) === E.normText(S.config.job.well));
      const jobN = toWell.length;
      const jobC = toWell.filter(l => !M.countFrom || (l.d || l.a) >= M.countFrom).length;
      $('#upPrev').innerHTML = '<div class="ttl">' + esc(file.name) + ' <span class="pbadge">' + esc(format) + '</span></div>' +
        '<div class="kv"><div><div class="k">Rows</div><div class="v">' + r.rows + '</div></div><div><div class="k">OMMA loads</div><div class="v">' + r.kept + '</div></div><div><div class="k">To this well</div><div class="v">' + jobN + (jobC < jobN ? '<small> · ' + jobC + ' count</small>' : '') + '</div></div><div><div class="k">Dropped</div><div class="v">' + (r.rows - r.kept) + '</div></div></div>' +
        (r.missing.length ? '<ul class="issues"><li>Columns not found: ' + esc(r.missing.join(', ')) + '</li></ul>' : '') +
        '<ul>' + (r.from ? '<li>Deliveries from ' + fDT(r.from) + ' to ' + fDT(r.to) + '</li>' : '') +
        '<li>Wells: ' + (wells.length ? wells.slice(0, 4).map(w => esc(w[0]) + ' (' + w[1] + ')').join(' · ') : '—') + '</li>' +
        '<li>Sands: ' + Object.entries(loads.reduce((o, l) => { o[l.s] = (o[l.s] || 0) + 1; return o; }, {})).map(([s, n]) => esc(sandLabel(s)) + ' ' + n).join(' · ') + '</li>' +
        (Object.keys(r.skipped).length ? '<li>Dropped: ' + Object.entries(r.skipped).map(([k, v]) => esc(k) + ' ' + v).join(' · ') + '</li>' : '') +
        (r.dup ? '<li>Duplicates in the file: ' + r.dup + '</li>' : '') + '</ul>' +
        '<div class="acts"><div class="seg sm" id="upMode"><button type="button" class="on" data-m="merge">Add to existing</button><button type="button" data-m="replace">Replace all</button></div>' +
        '<button type="button" class="btn primary sm" id="upApply"' + (loads.length ? '' : ' disabled') + '>Apply and recalculate</button><button type="button" class="btn sm ghost" id="upCancel">Cancel</button></div>';
      syncSegs();
    } catch (e) {
      ui.upload = null;
      $('#upPrev').innerHTML = '<ul class="issues"><li>Could not read the file: ' + esc(e.message) + '</li></ul>';
    }
  }
  function renderLoadsTable() {
    const L = M.wellLoads.filter(l => sandOn(l.s)).slice().sort((a, b) => (b.d || b.a) - (a.d || a.a)).slice(0, 300);
    const counts = l => !M.countFrom || (l.d || l.a) >= M.countFrom;
    const nPrev = M.wellLoads.length - M.jobLoads.length;
    $('#loadsBadge').textContent = M.jobLoads.length + ' count' + (nPrev ? ' · ' + nPrev + ' earlier' : '');
    $('#loadsTable').innerHTML = '<thead><tr><th>Load</th><th>Sand</th><th>Mine</th><th>PO</th><th style="text-align:right">Weight</th><th>Accepted</th><th>Delivered</th><th style="text-align:right" title="Accepted → delivered">Lead time</th><th style="text-align:right">Transit</th><th style="text-align:right">On location</th><th>Truck</th><th>Counts</th></tr></thead><tbody>' +
      (L.length ? L.map(l => '<tr' + (counts(l) ? '' : ' class="prev"') + '><td class="m">#' + esc(l.n) + '</td><td>' + slotChip({ s: l.s, k: 0 }).replace(' · 000', '') + '</td><td>' + esc(mineOf(l.m).name || l.t) + '</td><td class="m">' + esc(l.po || '—') + '</td><td class="n">' + fmt.int(l.w) + '</td><td class="m">' + fDT(l.a) + '</td><td class="m">' + fDT(l.d) + '</td>' +
        '<td class="n">' + (l.a && l.d ? E.fmtDur((l.d - l.a) / MIN) : '—') + '</td><td class="n">' + E.fmtDur(l.tx) + '</td><td class="n">' + E.fmtDur(l.td) + '</td><td class="m">' + esc(l.tr || '—') + '</td>' +
        '<td>' + (counts(l) ? '<span class="st del">well sand</span>' : '<span class="st extra" title="Delivered before the cut-off (' + esc(fDT(M.countFrom)) + '): used for times and payload">before cut-off</span>') + '</td></tr>').join('')
        : '<tr><td colspan="12"><div class="empty">No OMMA loads for this well.</div></td></tr>') + '</tbody>';
  }

  /* ============================== navigation ============================== */
  function go(view) {
    view = viewKey(view) || 'command';
    const prev = ui.view;
    const iPrev = VIEWS.findIndex(v => v.key === prev), iNew = VIEWS.findIndex(v => v.key === view);
    if (prev !== view) {
      const pv = VIEWS[iPrev];
      if (pv) destroyPage(pv.prefix);
      clearAllFloats(); hideDetail();
      $('#sbMini').classList.remove('show'); document.body.classList.remove('minion');
      if (view === 'assign') { ui.foldIds = null; ui.fold = true; }        // fresh context: fold what is already assigned
    }
    ui.view = view;
    $$('.view').forEach(s => {
      const on = s.dataset.pane === view;
      s.classList.toggle('active', on);
      s.classList.remove('from-right', 'from-left');
      if (on && prev !== view) s.classList.add(iNew > iPrev ? 'from-right' : 'from-left');
    });
    try { history.replaceState(null, '', '#' + view); } catch (e) {}
    renderNav();
    if (M) renderView();
    if (view === 'assign') watchSandBar();
    requestAnimationFrame(() => { resizeVisibleCharts(); settleVisibleCharts(); syncSegs(); });
    if (prev !== view) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }
  function renderView() {
    try {
      ({ command: renderCommand, assign: renderAssign, progress: renderProgress, plan: renderPlan, mines: renderMines })[ui.view]();
    } catch (e) {
      console.error('[render]', ui.view, e);
      const sec = $('#v-' + ui.view);
      if (sec && !sec.querySelector('.retry-note')) sec.insertAdjacentHTML('afterbegin', '<div class="retry-note">This view failed to render (' + esc(e.message) + '). <a data-retry="1">Retry</a></div>');
    }
  }
  function renderAll() {
    if (!S) return;
    rebuild();
    renderShell();
    renderView();
    syncSegs();
    /* someone else took the well into final counts: say it once */
    const on = M.kpi.fcOn;
    if (ui.fcWas === false && on && !S.fc && M.kpi.reqLoads) toast('Final counts: ' + fcPctTxt() + ' of loads assigned — confirm load assignments with the frac crew', { label: 'Log', fn: confirmFc }, 9000);
    if (Store.mode !== 'init') ui.fcWas = on;
    document.body.classList.remove('booting');
  }
  const renderSoon = deferRender(renderAll);

  /* ============================== events ============================== */
  function wire() {
    onFilterChange(renderSoon);
    document.addEventListener('click', e => {
      const t = e.target;
      const lg = t.closest('[data-lg]'); if (lg) { toggleLayer(lg); return; }
      const nv = t.closest('[data-view]'); if (nv) { go(nv.dataset.view); return; }
      const gd = t.closest('[data-go]'); if (gd) { go(gd.dataset.go); return; }
      const u = t.closest('#unitSeg button'); if (u) { ui.unit = u.dataset.u; saveUI(); renderSoon(); return; }
      const aq = t.closest('[data-assign-q]'); if (aq) { assign(aq.dataset.assignQ, null, aq); return; }
      const as = t.closest('[data-assign]'); if (as) { assign(as.dataset.assign, null, as); return; }
      const dca = t.closest('[data-dc-asg]'); if (dca) { hideDetail(); const r = $('#asList [data-slot="' + dca.dataset.dcAsg + '"] .tick'); assign(dca.dataset.dcAsg, null, r || dca); return; }
      const dcr = t.closest('[data-dc-range]'); if (dcr) { hideDetail(); rangeAssign(dcr.dataset.dcRange, dcr); return; }
      const dcu = t.closest('[data-dc-unasg]'); if (dcu) { hideDetail(); unassign(dcu.dataset.dcUnasg); return; }
      const fc = t.closest('[data-fc]'); if (fc) { confirmFc(); return; }
      const sm = t.closest('#sbMode button'); if (sm) { ui.sbMode = sm.dataset.m; saveUI(); renderSandBar(); syncSegs($('#sbMode')); return; }
      const sf = t.closest('[data-sfilter]'); if (sf) { hideScFloat($('#sbBody')); crossFilter('sand', sf.dataset.sfilter); return; }
      const fd = t.closest('[data-fold]');
      if (fd) {
        const list = $('#asList');
        if (fd.dataset.fold === 'hide') { ui.fold = true; ui.foldIds = assignedIds(); }
        else { ui.fold = false; list.classList.add('reveal'); clearTimeout(list._rv); list._rv = setTimeout(() => list.classList.remove('reveal'), 700); }
        applyQueueFilter();
        return;
      }
      if (t.closest('#kbdBtn')) { shortcuts(); return; }
      if (t.closest('#goNext') || t.closest('#sbMini')) { if (ui.view !== 'assign') go('assign'); scrollToNext(true); return; }
      if (t.closest('#installBtn')) { installApp(); return; }
      if (t.closest('#seedApply')) { $('#seedBar').hidden = true; Store.dispatch(reseedOp()); toast('Starting point applied: <b>37</b> loads assigned'); return; }
      if (t.closest('#seedLater')) { $('#seedBar').hidden = true; return; }
      const an = t.closest('[data-assign-next]');
      if (an) {
        e.stopPropagation();
        const s = an.dataset.assignNext;
        const nx = M.sands[s].slots.filter(x => x.needed && !x.asg).sort((a, b) => a.seq - b.seq)[0];
        if (nx) assign(nx.id, null, an);
        return;
      }
      const sc = t.closest('.sand[data-sand]'); if (sc && !t.closest('button')) { crossFilter('sand', sc.dataset.sand); return; }
      const tk = t.closest('[data-tick]');
      if (tk) {
        const id = tk.dataset.tick;
        if (S.asg[id]) unassign(id);
        else if (e.shiftKey) rangeAssign(id, tk);
        else assign(id, null, tk);
        return;
      }
      const row = t.closest('#asList .qrow');
      if (row && !t.closest('select,button,a,input')) { rowDetail(e, row.dataset.slot); return; }
      const st = t.closest('#asStatus .chip'); if (st) { ui.asStatus = st.dataset.st; applyQueueFilter(); return; }
      const gr = t.closest('#gapRange button'); if (gr) { ui.gapRange = gr.dataset.r; saveUI(); renderSoon(); return; }
      const dr = t.closest('#drvRange button'); if (dr) { ui.drvRange = dr.dataset.r; renderDrvHour(); return; }
      const bs = t.closest('#basisSeg button'); if (bs) { ui.basis = bs.dataset.b; saveUI(); renderSoon(); return; }
      const sp = t.closest('#segPick button'); if (sp) { ui.segPick = +sp.dataset.seg; ui.segPickSet = true; renderSoon(); return; }
      const rd = t.closest('[data-rdel]');
      if (rd) { withMe(() => { Store.dispatch({ type: 'stageDel', rid: rd.dataset.rdel }); toast('Report deleted'); }); return; }
      const rc = t.closest('[data-recon]');
      if (rc) {
        const s = rc.dataset.recon;
        const items = M.sands[s].omma.reconcile.map(r => ({ slot: r.slot, c: r.c, t: new Date(r.t).toISOString() }));
        const nNeed = items.filter(i => { const x = slotById(i.slot); return x && x.needed; }).length;
        const txt = 'reconciliation ' + sandLabel(s);
        const run = () => {
          Store.dispatch({ type: 'bulk', items, txt });
          const undo = pushUndo(txt, () => Store.dispatch({ type: 'unbulk', slots: items.map(i => i.slot), txt }));
          toast('Checked off <b>' + items.length + '</b> ' + esc(sandLabel(s)) + (items.length === 1 ? ' load' : ' loads') + ' as ' + esc(carrierName(M.trackedId)), { label: 'Undo', fn: undo });
        };
        /* reconciling can also take the well into final counts: same confirmation as a check mark */
        if (nNeed && fcNeedsGate(nNeed)) {
          modal('Final counts · ' + fcPctTxt(), fcGateHTML(nNeed, { [s]: nNeed }) + meField(), [
            { label: 'Cancel', cls: 'ghost' },
            { label: 'Confirmed with frac crew · check off ' + items.length, cls: 'primary', fn: () => { if (!takeMe()) return false; Store.dispatch({ type: 'fc', n: M.kpi.asgNeeded + nNeed }); run(); } }
          ]);
        } else run();
        return;
      }
      const cr = t.closest('.dnrow[data-sname]'); if (cr) { crossFilter('sand', cr.dataset.sname); return; }
      if (t.closest('#segAdd')) {
        const segs = ui.draft.segments;
        const last = segs[segs.length - 1];
        segs.push({ from: (last ? +last.to : 0) + 1, to: +ui.draft.job.totalStages, pace: last ? last.pace : 19, lbs: Seed.clone(last ? last.lbs : {}), trucks: Seed.clone(last ? (last.trucks || {}) : {}) });
        ui.dirty = true; renderDesignForm(); return;
      }
      const sd = t.closest('[data-segdel]'); if (sd) { ui.draft.segments.splice(+sd.dataset.segdel, 1); ui.dirty = true; renderDesignForm(); return; }
      if (t.closest('#dSave')) { saveDesign(); return; }
      if (t.closest('#dDiscard')) { ui.dirty = false; ui.draft = null; renderSoon(); return; }
      if (t.closest('#dDefault')) { ui.draft = Seed.clone(Seed.DEFAULT_CONFIG); ui.draft.carriers = Seed.clone(S.config.carriers); ui.dirty = true; renderDesignForm(); toast('Original design loaded in the editor · not saved yet'); return; }
      if (t.closest('#dReset')) { confirmReset(); return; }
      const ovs = t.closest('[data-ovsave]'); if (ovs) { saveOverrides(ovs.dataset.ovsave); return; }
      if (t.closest('#ommaClear')) {
        modal('Clear OMMA loads', '<p>Removes the ' + (S.omma.loads || []).length + ' loaded OMMA loads for all dispatch. Payload and times go back to assumptions until another file is uploaded.</p>',
          [{ label: 'Cancel', cls: 'ghost' }, { label: 'Clear', cls: 'danger', fn: () => withMe(() => Store.dispatch({ type: 'ommaClear' })) }]);
        return;
      }
      const um = t.closest('#upMode button'); if (um) { $$('#upMode button').forEach(b => b.classList.toggle('on', b === um)); syncSegs($('#upMode')); return; }
      if (t.closest('#upCancel')) { ui.upload = null; renderSoon(); return; }
      if (t.closest('#upApply')) {
        const up = ui.upload; if (!up) return;
        const mode = ($('#upMode button.on') || {}).dataset ? $('#upMode button.on').dataset.m : 'merge';
        withMe(() => {
          Store.dispatch({ type: 'omma', loads: up.loads, mode, meta: { file: up.file, rows: up.report.rows, format: up.format } });
          ui.upload = null;
          toast('Loaded <b>' + up.loads.length + '</b> OMMA ' + (up.loads.length === 1 ? 'load' : 'loads') + ' · queue recalculated');
        });
        return;
      }
      const am = t.closest('#actMode button'); if (am) { if (ui.stats) { ui.stats.mode = am.dataset.m; renderActPreview(); } return; }
      if (t.closest('#actApply')) { applyStats(); return; }
      if (t.closest('#actCancel')) { ui.stats = null; renderSoon(); return; }
      if (t.closest('#actClear')) { clearStats(); return; }
      if (t.closest('#sync')) { syncInfo(); return; }
      if (t.closest('#dcClose')) { hideDetail(); return; }
      if (t.closest('[data-retry]')) { const n = t.closest('.retry-note'); if (n) n.remove(); renderSoon(); return; }
    });
    document.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-lg]')) { e.preventDefault(); toggleLayer(e.target); return; }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.sbr[data-sfilter]')) { e.preventDefault(); crossFilter('sand', e.target.dataset.sfilter); return; }
      if (!$('#modal').hidden) return;
      const tg = e.target, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName || '') || tg.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z') && !typing) { e.preventDefault(); undoLast(); return; }
      if (tg.id === 'asQuery' && e.key === 'Escape') { tg.value = ''; ui.asQuery = ''; applyQueueFilter(); tg.blur(); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      const onTick = tg.closest && tg.closest('#asList .tick');
      if (onTick && e.key === 'Enter' && e.shiftKey) { e.preventDefault(); const id = onTick.dataset.tick; if (!S.asg[id]) rangeAssign(id, onTick); return; }
      if (onTick && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); moveFocus(onTick, e.key === 'ArrowDown' ? 1 : -1); return; }
      if (onTick && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); const b = onTick.getBoundingClientRect(); rowDetail({ clientX: b.right + 120, clientY: b.bottom }, onTick.dataset.tick); const c = $('#dcClose'); if (c) c.focus({ preventScroll: true }); return; }
      if (e.key === 'Escape' && $('#detailCard').classList.contains('show')) { hideDetail(); return; }
      if (e.key === '/') { e.preventDefault(); if (ui.view !== 'assign') go('assign'); setTimeout(() => { const q = $('#asQuery'); if (q) q.focus(); }, 30); return; }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); if (ui.view !== 'assign') go('assign'); setTimeout(() => scrollToNext(true), 30); return; }
      if (e.key === '?') { e.preventDefault(); shortcuts(); }
    });
    document.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-csel]')) { setCarrier(t.dataset.csel, t.value); return; }
      if (t.matches('#fileIn')) { handleFile(t.files[0]); t.value = ''; return; }
      if (t.matches('#actIn')) { handleStatsFile(t.files[0]); t.value = ''; return; }
    });
    document.addEventListener('focusout', e => {
      if (e.target.matches && e.target.matches('#asList select') && ui.pendingList) setTimeout(() => { if (!document.activeElement || !document.activeElement.closest('#asList select')) renderQueue(); }, 50);
    });
    document.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'asQuery') { ui.asQuery = t.value; applyQueueFilter(); return; }
      if (t.dataset && t.dataset.path && ui.draft) {
        let v = t.type === 'number' ? (t.value === '' ? null : +t.value) : t.value;
        setPath(ui.draft, t.dataset.path, v);
        ui.dirty = true;
        updateDesignPreview();
        return;
      }
      if (t.id === 'repN' || t.id === 'repT') t.dataset.touched = '1';
    });
    $('#chipsSand').addEventListener('click', chipClick('sand'));
    $('#chipsCarrier').addEventListener('click', chipClick('carrier'));
    $('#carList').addEventListener('mouseover', e => {
      const r = e.target.closest('.dnrow'); const ch = CHZ.ce_sand; if (!r || !ch) return;
      try { ch.setActiveElements([{ datasetIndex: 0, index: +r.dataset.ci }]); ch.update('none'); } catch (_) {}
    });
    $('#carList').addEventListener('mouseleave', () => { const ch = CHZ.ce_sand; if (ch) try { ch.setActiveElements([]); ch.update('none'); } catch (_) {} });
    /* rich tooltip over the sand bar */
    const sbBody = $('#sbBody');
    sbBody.addEventListener('mousemove', e => {
      const h = e.target.closest('[data-s]');
      if (!h || !window.matchMedia || !matchMedia('(hover: hover)').matches) return;
      showScFloat(sbBody, e, sandTip(h.dataset.s));
    });
    sbBody.addEventListener('mouseleave', () => hideScFloat(sbBody));
    $('#repForm').addEventListener('submit', e => {
      e.preventDefault();
      const n = Math.round(+$('#repN').value);
      const at = E.parseWall($('#repT').value, tz());
      if (!(n >= 0 && n <= M.N) || at == null) { toast('Check the stage and the time'); return; }
      withMe(() => {
        Store.dispatch({ type: 'stage', n, at: new Date(at).toISOString() });
        delete $('#repN').dataset.touched; delete $('#repT').dataset.touched;
        toast('Stage <b>' + n + '</b> logged · queue re-anchored');
      });
    });
    const drop = $('#drop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f); });
    const aDrop = $('#actDrop');
    ['dragenter', 'dragover'].forEach(ev => aDrop.addEventListener(ev, e => { e.preventDefault(); aDrop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => aDrop.addEventListener(ev, e => { e.preventDefault(); aDrop.classList.remove('over'); }));
    aDrop.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleStatsFile(f); });
    window.addEventListener('hashchange', () => { const h = viewKey(location.hash); if (h && h !== ui.view) go(h); });
    let rt = 0;
    const setTop = () => document.documentElement.style.setProperty('--top-h', Math.round(topH()) + 'px');
    setTop();
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { setTop(); resizeVisibleCharts(); syncSegs(); if (spiral) { spiral.resize(); spiral.draw(); } if (M && ui.view === 'command') renderRouteLanes(); }, 120); });
  }
  /* the draft as it would be saved (numbers normalized) */
  function draftConfig() {
    const d = Seed.clone(ui.draft);
    d.segments = (d.segments || []).map(g => Object.assign({ from: +g.from, to: +g.to, pace: +g.pace, lbs: g.lbs || {}, trucks: Object.fromEntries(Object.entries(g.trucks || {}).filter(([k, v]) => v != null && v !== '')) },
      g.drivers != null && g.drivers !== '' ? { drivers: +g.drivers } : {}));
    d.job.totalStages = Math.round(+d.job.totalStages);
    d.countFrom = d.countFrom || null;
    d.finalCountsPct = Math.min(100, Math.max(1, Math.round(+d.finalCountsPct || 80)));
    if (d.drivers) {
      ['shiftH', 'maxH'].forEach(k => { if (d.drivers[k] == null || d.drivers[k] === '') delete d.drivers[k]; else d.drivers[k] = +d.drivers[k]; });
      if (!Object.keys(d.drivers).length) delete d.drivers;
    }
    return d;
  }
  function saveDesign() {
    const d = draftConfig();
    if (!R.validConfig(d)) { toast('Check the design: a value is missing or out of range'); return; }
    const wall = v => v ? fDT(E.parseWall(v, d.tz || tz())) : '—';
    const diff = [];
    const c0 = S.config;
    if ((c0.countFrom || null) !== d.countFrom) diff.push('delivery cut-off ' + (d.countFrom ? wall(d.countFrom) : 'all'));
    if (c0.job.totalStages !== d.job.totalStages) diff.push('stages ' + c0.job.totalStages + '→' + d.job.totalStages);
    if (c0.job.well !== d.job.well || c0.job.client !== d.job.client) diff.push('well ' + d.job.well + ' · ' + d.job.client);
    const segNoDrv = a => JSON.stringify((a || []).map(g => Object.assign({}, g, { drivers: undefined })));
    if (segNoDrv(c0.segments) !== segNoDrv(d.segments)) diff.push('segments');
    const nOr = v => v == null || v === '' ? null : +v;
    const dch = d.segments.filter((g, i) => { const o = (c0.segments || [])[i]; return !o || nOr(o.drivers) !== nOr(g.drivers); });
    if (dch.length) diff.push('driver plan ' + dch.map(g => 'Stg ' + g.from + '–' + g.to + ' ' + (g.drivers == null ? 'none' : g.drivers + ' per shift')).join(', '));
    if (c0.schedule.fracStart !== d.schedule.fracStart) diff.push('frac ' + wall(d.schedule.fracStart));
    if (c0.schedule.prefillStart !== d.schedule.prefillStart) diff.push('prefill ' + wall(d.schedule.prefillStart));
    if ((c0.schedule.prefillEnd || '') !== (d.schedule.prefillEnd || '')) diff.push('prefill end ' + wall(d.schedule.prefillEnd));
    if ((c0.tz || '') !== (d.tz || '')) diff.push('time zone ' + d.tz);
    if (+c0.bufferStages !== +d.bufferStages) diff.push('buffer ' + d.bufferStages + ' stg');
    if (+c0.alertHours !== +d.alertHours) diff.push('assign-now window ' + d.alertHours + ' h');
    if (+c0.shiftStartHour !== +d.shiftStartHour) diff.push('day shift at ' + d.shiftStartHour + ':00');
    if (JSON.stringify(c0.po || {}) !== JSON.stringify(d.po || {})) diff.push('PO');
    if (JSON.stringify(c0.prefill) !== JSON.stringify(d.prefill)) diff.push('prefill loads');
    if (JSON.stringify(c0.loadsPerTruckDay || {}) !== JSON.stringify(d.loadsPerTruckDay || {})) diff.push('loads per truck/day');
    if (JSON.stringify(c0.carriers) !== JSON.stringify(d.carriers)) diff.push('carriers');
    if ((c0.finalCountsPct || 80) !== d.finalCountsPct) diff.push('final counts ' + d.finalCountsPct + '%');
    const h0 = E.driverHours(c0), h1 = E.driverHours(d);
    if (h0.shift !== h1.shift || h0.max !== h1.max) diff.push('driver shift ' + nf2.format(h1.shift) + ' h up to ' + nf2.format(h1.max) + ' h');
    withMe(() => {
      Store.dispatch({ type: 'cfg', config: d, txt: diff.join(' · ') || 'parameters' });
      ui.dirty = false; ui.draft = null;
      toast('Design saved for all dispatch · queue recalculated');
    });
  }
  function saveOverrides(mineId) {
    const cfg = Seed.clone(S.config);
    cfg.overrides = cfg.overrides || { payload: {}, leadMin: {} };
    cfg.overrides.payload = cfg.overrides.payload || {}; cfg.overrides.leadMin = cfg.overrides.leadMin || {};
    $$('[data-ovp]').forEach(i => { const s = i.dataset.ovp; if (S.config.sands.find(x => x.id === s && x.mine === mineId)) { if (i.value === '') delete cfg.overrides.payload[s]; else cfg.overrides.payload[s] = +i.value; } });
    const l = $('[data-ovl="' + mineId + '"]');
    if (l) { if (l.value === '') delete cfg.overrides.leadMin[mineId]; else cfg.overrides.leadMin[mineId] = +l.value; }
    withMe(() => { Store.dispatch({ type: 'cfg', config: cfg, txt: 'manual values ' + mineOf(mineId).name }); toast('Values for ' + esc(mineOf(mineId).name) + ' applied'); });
  }
  function confirmReset() {
    const n = Object.keys(S.asg).length;
    modal('Reset assignments', '<p>Removes all <b>' + n + '</b> check marks for all dispatch. Use it only when starting a new well. Type <b>RESET</b> to confirm.</p><input type="text" id="rstIn" autocomplete="off">',
      [{ label: 'Cancel', cls: 'ghost' }, { label: 'Reset', cls: 'danger', fn: () => { if (($('#rstIn').value || '').trim().toUpperCase() !== 'RESET') return false; withMe(() => { Store.dispatch({ type: 'resetAsg' }); toast('Assignments reset'); }); } }]);
  }
  function syncInfo() {
    const me = Store.me();
    const txt = Store.mode === 'remote' ? 'Synced with the Netlify function: all dispatch sees the same check marks.' :
      Store.mode === 'offline' ? 'No connection to the server. You can keep checking loads off: ' + nL(Store.pending.length, 'change', 'changes') + ' will be sent when the network is back.' :
        'Local mode: the /api/state function was not found (site without Netlify Functions, or opened as a file). What you check off is saved on this device only.';
    modal('Sync', '<p>' + txt + '</p><p>Last sync: <b>' + (Store.lastSync ? fDT(Store.lastSync) : '—') + '</b> · version <b>' + (S.v || 0) + '</b></p>' +
      '<p>Dispatching as:</p><input type="text" id="meEdit" maxlength="12" value="' + esc(me || '') + '" placeholder="Your initials">',
      [{ label: 'Close', cls: 'ghost' }, { label: 'Save', cls: 'primary', fn: () => { const v = ($('#meEdit').value || '').trim(); if (v) Store.setMe(v.toUpperCase()); Store.poll(true); } }]);
  }

  /* ============================== clocks ============================== */
  function tick() {
    const now = Date.now();
    const p = wp(now);
    const off = -E.tzOffset(now, tz()) / HOUR;
    $('#clock').innerHTML = '<b>' + h12(p) + ':' + pad(p.mi) + ':' + pad(p.s) + '<i>' + ap(p) + '</i></b><small>' + WD[wdIdx(p)] + ' ' + MO[p.mo - 1] + ' ' + p.d + ' · UTC' + (off <= 0 ? '+' : '−') + Math.abs(off) + '</small>';
  }
  function tickCountdowns() {
    const now = Date.now();
    $$('[data-cd]').forEach(el => {
      const t = +el.dataset.cd;
      el.textContent = fRel(t, now);
      el.classList.toggle('late', t < now);
      el.classList.toggle('soon', t >= now && t - now < 2 * HOUR);
    });
    if (M) { const ph = phaseText(); const pt = $('#phase .ph-t'); if (pt) pt.innerHTML = ph.html; }
  }

  /* ============================== well starting point ==============================
     Revision 4 of the starting point: prefill from Sep 23 6:00 PM, POs for every mine (20/40 PO-24918,
     100 Mesh SPA00021226, 40/70 SPA00021227), final counts at 80%, and 37 loads already assigned.
     · A shared state on revision 2 or 3 where someone has worked gets a non-destructive patch,
       automatically: only fields that still hold the old value change and check marks are never touched.
     · A state with nobody's work on it gets the full starting point automatically; an older state with
       work is offered it with a button, so nothing is overwritten by surprise. */
  const R = window.DispatchReducer;
  let seedChecked = false;
  function reseedOp() {
    const cfg = Seed.clone(Seed.DEFAULT_CONFIG);
    if (S && S.config && Array.isArray(S.config.carriers)) cfg.carriers = Seed.clone(S.config.carriers);
    if (S && S.config && S.config.overrides) cfg.overrides = Seed.clone(S.config.overrides);
    return { type: 'reseed', rev: Seed.REV, config: cfg, asg: Seed.baselineAsg(), txt: 'prefill Sep 23 6:00 PM → Sep 28 3:00 AM · frac Sep 28 6:00 AM',
      meta: { from: 'Excel extracto de loads OMMA (referencia inicial)', file: 'OMMA loads extract (initial reference)' } };
  }
  function checkSeed() {
    const bar = $('#seedBar');
    const rev = S ? (+S.seedRev || 0) : 0;
    if (!S || rev >= Seed.REV) { bar.hidden = true; seedChecked = true; return; }
    /* decided only against the shared state, never a stale copy: offline it waits for the first sync */
    if (Store.mode !== 'remote' && Store.mode !== 'local') return;
    seedChecked = true;
    const worked = R.workedSinceReseed(S.log);
    const patch = Seed.patchFrom(rev);
    if (!worked || patch.length) {
      bar.hidden = true;
      /* automatic op: the shared state itself picks full starting point (nobody worked) or the patch
         (someone did), so a client with an old copy can never wipe anyone's check marks */
      Store.dispatch(Object.assign(reseedOp(), { auto: true, from: rev, patch, patchTxt: Seed.patchNote(rev) }));
      toast(worked ? 'Well setup updated: ' + esc(Seed.patchNote(rev)) : 'Starting point loaded: <b>37</b> loads assigned · <b>#38</b> is next · frac Sep 28 6:00 AM');
      return;
    }
    bar.hidden = false;
    bar.innerHTML = sv(IC.alert, 16) + '<span>There is a new well starting point: prefill Sep 23 6:00 PM → Sep 28 3:00 AM, frac Sep 28 6:00 AM and <b>37 loads already assigned</b> (30 × 20/40, 6 × 100 Mesh and 1 × 40/70). It replaces the current design and check marks; OMMA loads and stage reports are kept.</span>' +
      '<button type="button" class="btn sm primary" id="seedApply">Apply</button><button type="button" class="btn sm ghost" id="seedLater">Not now</button>';
  }

  /* ============================== install as an app ============================== */
  let deferredInstall = null;
  const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function initInstall() {
    const btn = $('#installBtn');
    btn.hidden = isStandalone() || !isIOS();
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; btn.hidden = isStandalone(); });
    window.addEventListener('appinstalled', () => { deferredInstall = null; btn.hidden = true; toast('App installed: open it from your desktop or home screen'); });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  async function installApp() {
    if (deferredInstall) {
      const ev = deferredInstall; deferredInstall = null;
      ev.prompt();
      try { const r = await ev.userChoice; if (r && r.outcome === 'accepted') $('#installBtn').hidden = true; } catch (e) {}
      return;
    }
    modal('Install OMMA Dispatch', isIOS()
      ? '<p>On iPhone or iPad, in Safari: tap <b>Share</b>, then <b>Add to Home Screen</b>. It opens as an app, without the browser bar.</p>'
      : '<p>In Chrome or Edge: open the browser menu and choose <b>Install OMMA Dispatch</b> (or the install icon in the address bar). On Android: menu → <b>Install app</b>.</p>',
      [{ label: 'Got it', cls: 'primary' }]);
  }

  /* ============================== boot ============================== */
  async function boot() {
    const h = viewKey(location.hash);
    if (h) ui.view = h;
    wire();
    $$('.view').forEach(s => s.classList.toggle('active', s.dataset.pane === ui.view));
    try { if (location.hash && location.hash !== '#' + ui.view) history.replaceState(null, '', '#' + ui.view); } catch (e) {}
    Store.subscribe((st, reason) => {
      S = st;
      if (!seedChecked && (Store.mode === 'remote' || Store.mode === 'local') && window.__app) setTimeout(checkSeed, 0);
      if (reason === 'mode' && M) { renderSync(); $('#railFoot').textContent = 'v' + (S.v || 0) + ' · ' + Store.mode; if (ui.view === 'assign' && ui.foldIds == null) renderSoon(); return; }
      renderSoon();
    });
    tick();
    setInterval(tick, 1000);
    setInterval(tickCountdowns, 15000);
    setInterval(renderSoon, 60000);      // statuses that change with the clock (overdue, window)
    startChartWatchdog(() => { renderSoon(); });
    initInstall();
    await Store.init();
    window.__app = { get model() { return M; }, get state() { return S; }, ui, go, renderAll, Store };
    checkSeed();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
