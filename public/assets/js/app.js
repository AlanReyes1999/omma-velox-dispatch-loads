/* OMMA · Velox dispatch — aplicación.
   Ciclo único: Store (estado compartido) → Engine.build (modelo) → render de la vista activa.
   Modelo semántico para chartkit: una fila = un load (slot). Dimensiones: arena y carrier.
   IDs de gráficas con prefijo de vista (ce_, as_, av_, pl_, ar_) para destruir por pestaña. */
(function () {
  'use strict';
  const E = window.Engine, Seed = window.Seed, Store = window.Store, Viz = window.Viz, LP = window.LoadParser;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = Viz.esc;
  const HOUR = E.HOUR, DAY = E.DAY, MIN = E.MIN;

  /* ============================== iconos (SVG, sin emojis) ============================== */
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
    tick: '<polyline points="5 12.5 10 17 19 7.5"/>'
  };
  const VIEWS = [
    { key: 'centro', label: 'Centro', icon: IC.grid, prefix: 'ce' },
    { key: 'asignar', label: 'Asignar', icon: IC.check, prefix: 'as' },
    { key: 'avance', label: 'Avance', icon: IC.layers, prefix: 'av' },
    { key: 'plan', label: 'Plan', icon: IC.sliders, prefix: 'pl' },
    { key: 'areneras', label: 'Areneras', icon: IC.factory, prefix: 'ar' }
  ];

  /* ============================== colores ============================== */
  const SAND_COLOR = { '100M': '#7DCFB6', '4070': '#9D8FCB', '2040': '#F4B860' };
  const SAND_DARK = { '100M': '#2F8A6C', '4070': '#6A5CA3', '2040': '#9A6420' };
  const SAND_ACC = { '100M': 'a-mint', '4070': 'a-lav', '2040': 'a-amber' };
  const CARRIER_PALETTE = ['#1E6B7A', '#6BAED6', '#F08080', '#15384A', '#C99A17', '#8C63AC'];
  const FIXED_CARRIER = { MAXCARGO: '#1E6B7A', JE: '#F4B860', MASIV: '#9D8FCB', MEDRANOS: '#F08080', RENTROL: '#7DCFB6' };
  const MINE_COLOR = { IRONOAK: '#6A5CA3', IRONHORSE: '#C88B3D' };
  const GHOST = '#E3E8EF';

  /* ============================== estado de UI ============================== */
  const LS_UI = 'ovd.ui.v1';
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS_UI) || '{}'); } catch (e) { return {}; } })();
  const ui = {
    view: 'centro', unit: saved.unit || 'loads', carrier: saved.carrier || 'OMMA', basis: saved.basis || 'est',
    asStatus: 'pend', asQuery: '', asHour: null, asDay: null, asLimit: 80, gapRange: saved.gapRange || '48',
    segPick: null, draft: null, dirty: false, lastLogKey: null, pendingList: false, upload: null
  };
  function saveUI() { try { localStorage.setItem(LS_UI, JSON.stringify({ unit: ui.unit, carrier: ui.carrier, basis: ui.basis, gapRange: ui.gapRange })); } catch (e) {} }

  let S = null;   // estado compartido
  let M = null;   // modelo calculado

  /* ============================== formato ============================== */
  const WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const tz = () => (S && S.config && S.config.tz) || 'America/Mexico_City';
  const pad = n => String(n).padStart(2, '0');
  function wp(t) { return E.wallParts(t, tz()); }
  function wdIdx(p) { return new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay(); }
  function fTime(t) { if (t == null) return '—'; const p = wp(t); return pad(p.h) + ':' + pad(p.mi); }
  function fDay(t) { if (t == null) return '—'; const p = wp(t); return WD[wdIdx(p)] + ' ' + p.d + ' ' + MO[p.mo - 1]; }
  function fDT(t) { if (t == null) return '—'; return fDay(t) + ' · ' + fTime(t); }
  /* hora sola si es hoy; si no, día de la semana + hora (botones y chips cortos) */
  function fWhen(t) { if (t == null) return '—'; const a = wp(t), b = wp(Date.now()); return (a.y === b.y && a.mo === b.mo && a.d === b.d) ? fTime(t) : WD[wdIdx(a)] + ' ' + fTime(t); }
  function fDayKey(k) { const [y, m, d] = k.split('-').map(Number); return WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] + ' ' + d + ' ' + MO[m - 1]; }
  function fRel(t, now) {
    if (t == null) return '—';
    now = now || Date.now();
    const d = t - now, a = Math.abs(d);
    if (a < 60e3) return 'ahora';
    const m = Math.round(a / MIN);
    let s;
    if (m < 60) s = m + ' min';
    else if (m < 1440) s = Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min';
    else s = Math.floor(m / 1440) + ' d ' + Math.floor((m % 1440) / 60) + ' h';
    return d > 0 ? 'en ' + s : 'hace ' + s;
  }
  function cd(t, cls) {
    const now = Date.now();
    const c = t < now ? 'late' : (t - now < 2 * HOUR ? 'soon' : '');
    return '<span class="cd ' + (cls || c) + '" data-cd="' + t + '">' + fRel(t, now) + '</span>';
  }
  const nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  function uLbl() { return ui.unit === 'loads' ? 'loads' : ui.unit === 'lbs' ? 'lb' : 't'; }
  function uVal(loads, lbs) { return ui.unit === 'loads' ? loads : ui.unit === 'lbs' ? lbs : lbs / E.LBS_PER_TON; }
  function uFmt(v) { return ui.unit === 'tons' ? nf1.format(v) : fmt.int(Math.round(v)); }
  function uTxt(loads, lbs) { return uFmt(uVal(loads, lbs)); }
  function uAxis(v) { return ui.unit === 'loads' ? fmt.int(v) : fmt.numK(v); }
  function lbsTxt(v) { return fmt.int(Math.round(v)) + ' lb'; }
  function tonsTxt(v) { return nf1.format(v / E.LBS_PER_TON) + ' t'; }
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
  function slotChip(x) { return '<span class="sl s-' + x.s + '"><i></i>' + esc(sandLabel(x.s)) + ' · ' + String(x.k).padStart(3, '0') + '</span>'; }
  const STATUS_TX = { late: 'Vencido', now: 'Asignar ya', next: 'Programado', eta: 'En camino', arr: 'Llegó est.', del: 'Entregado', extra: 'Excedente' };
  function stPill(st) { return '<span class="st ' + st + '">' + STATUS_TX[st] + '</span>'; }
  const nL = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  function srcTag(src) { return '<span class="src ' + src + '">' + src + '</span>'; }

  /* ============================== modelo + filtros ============================== */
  function rebuild() {
    M = E.build(S.config, S, Date.now());
    defineModel({
      rows: M.slots,
      dims: {
        sand: Object.assign(r => sandLabel(r.s), { label: 'Arena' }),
        carrier: Object.assign(r => r.carrier ? carrierName(r.carrier) : 'Sin asignar', { label: 'Carrier' })
      },
      measures: { loads: rs => rs.length, lbs: rs => rs.reduce((p, r) => p + r.w, 0) }
    });
  }
  const sandOn = s => inSel(state.sand, sandLabel(s));
  const carrierOn = c => inSel(state.carrier, c ? carrierName(c) : 'Sin asignar');
  const carrierFilterActive = () => state.carrier !== 'all' && state.carrier && state.carrier.size;
  function selSands() { return S.config.sands.map(s => s.id).filter(sandOn); }

  /* ============================== upsert de gráficas ============================== */
  const HIDDEN = {};   // capas apagadas desde la leyenda: chartId → Set(label de la serie)
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
  /* leyenda HTML bajo la gráfica: cada serie es una capa que se prende y se apaga (clic o Enter)
     items: {label, color|swatch, line, ds (label de la serie si difiere), toggle:false = sólo lectura} */
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
  /* eje Y de conteo: enteros en loads y lbs, y un tope mínimo cuando todo vale 0 (evita "0 0 0 0") */
  function yCount(max, extra) {
    const y = gYf(uAxis);
    y.ticks = Object.assign({}, y.ticks, ui.unit === 'tons' ? {} : { precision: 0 });
    if (!(max > 0)) y.suggestedMax = ui.unit === 'loads' ? 5 : ui.unit === 'lbs' ? 250000 : 125;
    return Object.assign(y, extra || {});
  }

  /* línea vertical de "ahora" (eje de categorías o lineal) */
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
      const tx = o.label || 'AHORA', w = ctx.measureText(tx).width + 10;
      ctx.fillStyle = '#E6A23C'; ctx.beginPath();
      rrect(ctx, Math.min(px - w / 2, ar.right - w), ar.top - 1, w, 15, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(tx, Math.min(px - w / 2, ar.right - w) + 5, ar.top + 6.5);
      ctx.restore();
    }
  });

  /* ============================== acciones ============================== */
  function toast(html, action, ms) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span>' + html + '</span>' + (action ? '<button type="button">' + action.label + '</button>' : '');
    if (action) el.querySelector('button').addEventListener('click', () => { action.fn(); close(); });
    box.appendChild(el);
    let t = setTimeout(close, ms || (action ? 6500 : 3200));
    function close() { clearTimeout(t); el.classList.add('out'); setTimeout(() => el.remove(), 200); }
    while (box.children.length > 3) box.firstElementChild.remove();
  }
  function modal(title, bodyHTML, actions) {
    const m = $('#modal');
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
    const inp = m.querySelector('input'); if (inp) setTimeout(() => inp.focus(), 60);
    function onKey(e) { if (e.key === 'Escape') close(); if (e.key === 'Enter' && inp && document.activeElement === inp) { const p = A.querySelector('.primary'); if (p) p.click(); } }
    function onBg(e) { if (e.target === m) close(); }
    document.addEventListener('keydown', onKey); m.addEventListener('click', onBg);
    function close() { m.hidden = true; document.removeEventListener('keydown', onKey); m.removeEventListener('click', onBg); }
    return close;
  }
  function withMe(cb) {
    if (Store.me()) return cb();
    modal('¿Quién está despachando?',
      '<p>Tus iniciales quedan en cada load que palomees, para que el resto del equipo sepa quién lo asignó.</p><input type="text" id="meIn" maxlength="12" placeholder="Ej. AR" autocomplete="off">',
      [{ label: 'Cancelar', cls: 'ghost' },
       { label: 'Continuar', cls: 'primary', fn: () => { const v = ($('#meIn').value || '').trim(); if (!v) return false; Store.setMe(v.toUpperCase()); cb(); } }]);
  }
  function assign(slot, c) {
    withMe(() => {
      c = c || ui.carrier;
      Store.dispatch({ type: 'asg', slot, c });
      toast('Asignado <b>' + esc(slot) + '</b> a ' + esc(carrierName(c)), { label: 'Deshacer', fn: () => Store.dispatch({ type: 'unasg', slot }) });
    });
  }
  function unassign(slot) {
    const prev = S.asg[slot];
    if (!prev) return;
    withMe(() => {
      Store.dispatch({ type: 'unasg', slot });
      toast('Quitado <b>' + esc(slot) + '</b> (' + esc(carrierName(prev.c)) + ')', { label: 'Deshacer', fn: () => Store.dispatch({ type: 'asg', slot, c: prev.c, t: prev.t }) });
    });
  }
  function setCarrier(slot, c) {
    const prev = S.asg[slot];
    if (!prev || prev.c === c) return;
    withMe(() => {
      Store.dispatch({ type: 'setc', slot, c });
      toast('<b>' + esc(slot) + '</b>: ' + esc(carrierName(prev.c)) + ' → ' + esc(carrierName(c)), { label: 'Deshacer', fn: () => Store.dispatch({ type: 'setc', slot, c: prev.c }) });
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
    const html = VIEWS.map(v => '<button type="button" class="nvb' + (ui.view === v.key ? ' on' : '') + '" data-view="' + v.key + '" aria-label="' + v.label + '">' +
      sv(v.icon, 20) + '<span>' + v.label + '</span>' + (v.key === 'asignar' ? badge() : '') + '</button>').join('');
    $('#railItems').innerHTML = html;
    $('#tabbar').innerHTML = html;
  }
  function renderSync() {
    const b = $('#sync');
    const pend = Store.pending.length;
    b.className = 'sync ' + Store.mode + (pend && Store.mode === 'remote' ? ' pending' : '');
    const tx = Store.mode === 'remote' ? (pend ? 'Enviando ' + pend : 'En vivo')
      : Store.mode === 'offline' ? 'Sin conexión' + (pend ? ' · ' + pend : '')
        : Store.mode === 'local' ? 'Modo local' : 'Conectando…';
    b.querySelector('.stx').textContent = tx;
    b.title = Store.mode === 'local' ? 'Las palomitas se guardan sólo en este equipo (no hay función de Netlify)' :
      Store.mode === 'offline' ? 'Sin conexión: los cambios se envían al volver la red' : 'Sincronizado con todo despacho';
  }
  function phaseText() {
    const w = M.well, now = Date.now();
    if (w.phase === 'pre') return { cls: 'pre', html: 'PREFILL <b>' + fRel(w.prefillStart, now).toUpperCase() + '</b> · FRAC ' + fDT(w.fracStart).toUpperCase() };
    if (w.phase === 'prefill') return { cls: 'prefill', html: 'PREFILL EN CURSO · FRAC <b>' + fRel(w.fracStart, now).toUpperCase() + '</b>' };
    if (w.phase === 'frac') return { cls: 'frac', html: 'FRAC · ETAPA <b>' + w.curStage + '/' + w.N + '</b> · FIN EST. ' + fDT(w.end).toUpperCase() };
    return { cls: 'done', html: 'POZO TERMINADO · <b>' + w.N + '/' + w.N + '</b>' };
  }
  function renderShell() {
    const c = S.config;
    $('#brandSub').textContent = c.job.well + ' · ' + c.job.client + ' · ' + c.job.totalStages + ' etapas';
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
      '<span class="asm">' + (up ? 'estado compartido ' + fDT(up) + ' · ' : '') + 'v' + (S.v || 0) + ' · supuestos editables en Plan</span>';
  }
  function renderChips() {
    const sands = S.config.sands;
    const cntS = {};
    rowsF('sand').filter(r => r.needed).forEach(r => { cntS[r.s] = (cntS[r.s] || 0) + 1; });
    const sc = $('#chipsSand');
    sc.setAttribute('data-chips', 'sand');
    sc.innerHTML = '<button type="button" class="chip all' + (state.sand === 'all' ? ' active' : '') + '" data-v="all">Todas</button>' +
      sands.map(s => '<button type="button" class="chip' + (state.sand !== 'all' && setHas(state.sand, s.label) ? ' active' : '') + '" data-v="' + esc(s.label) + '"><span class="cdot" style="background:' + SAND_COLOR[s.id] + '"></span>' + esc(s.label) + ' <span class="n">' + (cntS[s.id] || 0) + '</span></button>').join('');
    const cc = $('#chipsCarrier');
    cc.setAttribute('data-chips', 'carrier');
    const cntC = {};
    rowsF('carrier').forEach(r => { if (r.carrier) cntC[r.carrier] = (cntC[r.carrier] || 0) + 1; });
    cc.innerHTML = '<button type="button" class="chip all' + (state.carrier === 'all' ? ' active' : '') + '" data-v="all">Todos</button>' +
      carriers().map(c => '<button type="button" class="chip' + (state.carrier !== 'all' && setHas(state.carrier, c.name) ? ' active' : '') + '" data-v="' + esc(c.name) + '"><span class="cdot" style="background:' + carrierColor(c.id) + '"></span>' + esc(c.name) + ' <span class="n">' + (cntC[c.id] || 0) + '</span></button>').join('');
    $('#fnote').textContent = carrierFilterActive() ? 'Con filtro de carrier se ven sólo sus loads asignados' : '';
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
        it.push('<span class="tk-it"><i style="background:' + SAND_COLOR[s.id] + '"></i>' + esc(s.label) + ' <b>' + nf1.format(q.loadsPerDay) + '</b> LOADS/DÍA · 1 CADA <b>' + E.fmtDur(q.everyMin) + '</b></span>');
      });
      it.push('<span class="tk-it">RITMO DISEÑO <b>' + nf1.format(seg.pace) + '</b> ET/DÍA' + (seg.sustainPace ? ' · SOSTENIBLE CON TRUCKS DEL PLAN <b class="' + (seg.sustainPace < seg.pace ? 'r' : 'g') + '">' + nf1.format(seg.sustainPace) + '</b>' : '') + '</span>');
    }
    if (k.next) it.push('<span class="tk-it">PRÓXIMO <b>' + esc(sandLabel(k.next.s)) + ' #' + String(k.next.k).padStart(3, '0') + '</b> · ASIGNAR ANTES DE <b class="a">' + fDT(k.next.ab).toUpperCase() + '</b></span>');
    it.push('<span class="tk-it">VENCIDOS <b class="' + (k.overdue ? 'r' : 'g') + '">' + k.overdue + '</b> · EN VENTANA <b class="a">' + k.nowWindow + '</b> · PRÓX 24 H <b>' + k.next24 + '</b></span>');
    it.push('<span class="tk-it">ASIGNADOS <b class="t">' + fmt.int(k.asgNeeded) + '</b> / ' + fmt.int(k.reqLoads) + ' LOADS · ' + nf1.format(k.pct * 100) + '%</span>');
    it.push('<span class="tk-it">OMMA ENTREGADO <b>' + k.ommaLoads + '</b> LOADS · <b>' + fmt.int(k.ommaLbs) + '</b> LB</span>');
    it.push('<span class="tk-it">TOTAL POZO <b>' + fmt.int(k.reqLbs) + '</b> LB · <b>' + nf1.format(k.reqLbs / 2000) + '</b> T</span>');
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
    if (M.kpi.invalid.length) w.push({ lvl: 'warn', txt: M.kpi.invalid.length + ' asignación(es) no corresponden al diseño actual (' + M.kpi.invalid.slice(0, 4).join(', ') + (M.kpi.invalid.length > 4 ? '…' : '') + ')' });
    const bar = $('#warnbar');
    if (!w.length) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.className = 'warnbar' + (w.some(x => x.lvl === 'err') ? ' err' : '');
    bar.innerHTML = sv(IC.alert, 16) + '<ul>' + w.map(x => '<li>' + esc(x.txt) + '</li>').join('') + '</ul>';
  }

  /* ============================== CENTRO ============================== */
  let spiral = null;
  function renderCentro() {
    const k = M.kpi, now = Date.now();
    const req = rowsF('carrier').filter(r => r.needed);                     // requerido: respeta arena
    const reqLbs = selSands().reduce((p, s) => p + M.tb.R[s], 0);
    const asg = rowsF().filter(r => r.needed && r.asg);                   // asignado: respeta carrier
    const asgLbs = asg.reduce((p, r) => p + r.w, 0);
    const due = req.filter(r => r.ab <= now);
    const pend = req.filter(r => !r.asg);
    /* la cadencia es del pozo, no de un carrier: el gap siempre compara todo lo asignado (con el filtro de arena) */
    const gap = req.filter(r => r.asg).length - due.length;
    const gapLbs = req.filter(r => r.asg).reduce((p, r) => p + r.w, 0) - due.reduce((p, r) => p + r.w, 0);
    const overdue = pend.filter(r => r.status === 'late').length;
    const inWin = pend.filter(r => r.status === 'now').length;
    const next = pend.slice().sort((a, b) => a.ab - b.ab)[0] || null;
    const ga = S.config.gapAlert || { warn: 2, alert: 5 };
    const perDay = M.days.map(d => selSands().reduce((p, s) => p + (d.loads[s] || 0), 0));
    const cov = covFor(ui.basis);
    const basisTx = { asg: 'con lo asignado', est: 'con lo entregado (est.)', omma: 'con lo entregado por OMMA' }[ui.basis];
    const gapSig = sigClass(gap, { alert: -ga.alert, warn: -ga.warn, better: 'high' });
    const reqU = uTxt(req.length, reqLbs);
    const pctA = req.length ? (carrierFilterActive() ? asg.length : req.filter(r => r.asg).length) / req.length : 0;
    const shouldPct = req.length ? due.length / req.length : 0;
    const cards = [
      kpiCard({ label: 'Requeridos del pozo', value: reqU, unit: uLbl(), icon: sv(IC.layers, 16), accent: 'a-teal', i: 0, id: 'req',
        badge: '<span class="gr neu">' + M.N + ' etapas</span>', series: perDay, sparkStyle: 'bars',
        foot: '<span>' + (ui.unit === 'loads' ? lbsTxt(reqLbs) : req.length + ' loads') + '</span><b>' + tonsTxt(reqLbs) + '</b>' }),
      kpiCard({ label: carrierFilterActive() ? 'Asignados · filtro' : 'Asignados', value: uTxt(carrierFilterActive() ? asg.length : req.filter(r => r.asg).length, carrierFilterActive() ? asgLbs : req.filter(r => r.asg).reduce((p, r) => p + r.w, 0)), unit: uLbl(),
        icon: sv(IC.check, 16), accent: 'a-sky', i: 1, id: 'asg', badge: '<span class="gr neu">' + nf1.format(pctA * 100) + '%</span>',
        foot: '<span>Faltan <b>' + fmt.int(pend.length) + '</b></span><span>debían ir <b>' + fmt.int(due.length) + '</b></span>' }),
      kpiCard({ label: 'Gap vs cadencia', value: (gap > 0 ? '+' : gap < 0 ? '−' : '') + uFmt(Math.abs(uVal(gap, gapLbs))), unit: uLbl(), icon: sv(IC.activity, 16),
        accent: gap < -ga.warn ? 'a-danger' : gap < 0 ? 'a-warn' : 'a-success', i: 2, id: 'gap',
        badge: '<span class="gr ' + (gap < 0 ? 'bad' : gap > 0 ? 'good' : 'neu') + (gapSig ? ' ' + gapSig : '') + '"><span class="arw">' + (gap < 0 ? '↓' : gap > 0 ? '↑' : '→') + '</span>' + (gap < 0 ? 'atrasado' : gap > 0 ? 'adelantado' : 'en plan') + '</span>',
        foot: '<span>Vencidos <b>' + overdue + '</b></span><span>en ventana <b>' + inWin + '</b></span>' + (carrierFilterActive() ? '<span>todos los carriers</span>' : '') }),
      kpiCard({ label: 'Etapas cubiertas', value: fmt.int(Math.floor(cov.pos + 1e-9)), unit: '/ ' + M.N, icon: sv(IC.target, 16), accent: 'a-mint', i: 3, id: 'cov',
        badge: '<span class="gr neu">' + (ui.basis === 'asg' ? 'asignado' : ui.basis === 'est' ? 'entregado est.' : 'OMMA real') + '</span>',
        foot: '<span>arena para <b>' + nf2.format(cov.pos) + '</b> et.</span><span>limita <b>' + esc(cov.lim ? sandLabel(cov.lim) : '—') + '</b></span>' }),
      next ? kpiCard({ label: 'Próximo a asignar', value: '<span class="mono">' + fTime(next.ab) + '</span>', unit: fDay(next.ab), icon: sv(IC.clock, 16), accent: next.status === 'late' ? 'a-danger' : 'a-amber', i: 4, id: 'next',
        badge: stPill(next.status), foot: '<span>' + slotChip(next) + '</span><span>' + cd(next.ab) + '</span>' })
        : kpiCard({ label: 'Próximo a asignar', value: 'Al día', icon: sv(IC.clock, 16), accent: 'a-success', i: 4, foot: '<span>No hay loads pendientes con el filtro actual</span>' })
    ];
    paintKpis('#ceKpis', cards);
    $('#ceMeta').innerHTML = '<span class="pill">' + esc(basisTx) + '</span><span class="pill">corte ' + fTime(now) + '</span>';

    /* 01 · espiral */
    renderSpiral(cov);
    /* 02 · próximos */
    renderNextList(pend, overdue, inWin);
    /* 03 · ruta */
    renderRouteLanes();
    /* 04 · gap tracker */
    renderGapChart();
    /* 05 · carriers */
    renderCarrierDonut();
    /* 06 · ledger de arenas */
    renderSandCards();
    /* 07 · bitácora */
    renderStream();
  }

  /* ¿hasta qué etapa alcanza la arena? (según base y filtro de arena) */
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
        onPick: (st, e) => { if (st) showDetail(e, 'Etapa ' + st.n + ' · ' + st.segTx, stageRows(st)); }
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
      if (isDone) { fill = '#1B2538'; stroke = '#fff'; status = 'Completada (reporte real)'; }
      else if (coveredE) { fill = '#1E6B7A'; stroke = '#fff'; status = 'Cubierta · entregado est.'; }
      else if (coveredA) { fill = '#6BAED6'; stroke = '#fff'; status = 'Cubierta · asignado'; }
      else if (partial) { fill = '#D0E5F2'; stroke = '#6BAED6'; status = 'Cubierta a medias · asignado'; }
      else { fill = '#FFFFFF'; stroke = '#C8D0DA'; status = 'Sin arena asignada'; }
      stages.push({ n: i, fill, stroke, status, cur, color: SAND_COLOR[dom] || '#9AA6B6', seg: si,
        segTx: si >= 0 ? 'tramo ' + S.config.segments[si].from + '–' + S.config.segments[si].to : 'sin tramo',
        start: M.sc.B[i - 1], end: M.sc.B[i], lbs: S.config.sands.map(s => [s.id, M.tb.d[s.id][i]]) });
    }
    const pace = w.pace ? w.pace.v : w.designPace;
    const speed = w.phase === 'frac' ? 0.32 * Math.max(0.3, Math.min(2, pace / 19)) : 0;
    spiral.set(stages, speed, { bounds: segBounds });
    const badge = $('#wellBadge');
    badge.textContent = { pre: 'antes del prefill', prefill: 'prefill', frac: 'bombeando', done: 'terminado' }[w.phase];
    badge.className = 'pbadge' + (w.phase === 'frac' ? ' ok' : w.phase === 'prefill' ? ' warn' : '');
    $('#coLeft').innerHTML = '<div class="k">Ritmo</div><div class="v">' + nf1.format(w.pace ? w.pace.v : w.designPace) + '<small>et/día</small></div><div class="s">' + (w.pace ? 'real · diseño ' + nf1.format(w.designPace) : 'del diseño') + '</div>';
    $('#coRight').innerHTML = '<div class="k">Cobertura</div><div class="v">' + nf2.format(cov.pos) + '<small>etapas</small></div><div class="s">' + ({ asg: 'asignado', est: 'entregado est.', omma: 'OMMA real' }[ui.basis]) + (cov.lim ? ' · limita ' + esc(sandLabel(cov.lim)) : '') + '</div>';
    $('#spLegend').innerHTML = [['#1B2538', '#1B2538', 'Completada'], ['#1E6B7A', '#1E6B7A', 'Entregado est.'], ['#6BAED6', '#6BAED6', 'Asignado'], ['#fff', '#C8D0DA', 'Sin arena'], ['#fff', '#E6A23C', 'Etapa actual']]
      .map(x => '<span><i style="background:' + x[0] + ';border-color:' + x[1] + '"></i>' + x[2] + '</span>').join('');
    const enCamino = M.slots.filter(x => x.status === 'eta' && sandOn(x.s) && carrierOn(x.carrier)).length;
    $('#wellStats').innerHTML =
      '<div><div class="k">Etapa actual</div><div class="v t">' + (w.phase === 'pre' || w.phase === 'prefill' ? '—' : w.curStage + '<small class="mut"> / ' + w.N + '</small>') + '</div></div>' +
      '<div><div class="k">Inicio frac</div><div class="v">' + fDT(w.fracStart) + '</div></div>' +
      '<div><div class="k">Fin estimado</div><div class="v">' + fDT(w.end) + '</div></div>' +
      '<div><div class="k">En camino</div><div class="v a">' + enCamino + ' <small class="mut">loads</small></div></div>';
  }
  function stageRows(st) {
    const rows = [['Tramo', st.segTx], ['Inicio (plan)', fDT(st.start)], ['Fin (plan)', fDT(st.end)]];
    st.lbs.forEach(([s, v]) => { if (v > 0) rows.push([sandLabel(s), lbsTxt(v)]); });
    rows.push(['Estado', st.status]);
    return rows;
  }
  function stageHTML(st) {
    return '<div class="schead">Etapa ' + st.n + ' · ' + esc(st.segTx) + '</div>' + stageRows(st).slice(1).map(r => scRow(r[0], esc(r[1]))).join('');
  }

  function carrierPick(host) {
    const el = $(host);
    if (!el) return;
    el.innerHTML = '<span class="lb">Asignar a</span>' + carriers().map(c => {
      const on = ui.carrier === c.id;
      return '<button type="button" class="cbtn' + (on ? ' on' : '') + '" data-c="' + esc(c.id) + '" style="' + (on ? 'background:' + carrierColor(c.id) : '') + '"><i style="background:' + (on ? 'rgba(255,255,255,.85)' : carrierColor(c.id)) + '"></i>' + esc(c.name) + '</button>';
    }).join('');
  }
  function renderNextList(pend, overdue, inWin) {
    carrierPick('#cePick');
    const list = pend.slice().sort((a, b) => a.ab - b.ab).slice(0, 6);
    const b = $('#nextBadge');
    b.textContent = overdue ? nL(overdue, 'vencido', 'vencidos') : inWin ? inWin + ' en ventana' : 'al día';
    b.className = 'pbadge ' + (overdue ? 'bad' : inWin ? 'warn' : 'ok');
    $('#nextList').innerHTML = list.length ? list.map(x =>
      '<div class="nx ' + x.status + '"><div>' + slotChip(x) + '</div><div class="who"><div class="t1">' + stPill(x.status) + '<span class="mono">' + fTime(x.ab) + '</span> ' + cd(x.ab) + '</div>' +
      '<div class="t2">' + (x.prefill ? 'Prefill · ' : 'Etapa ' + x.stage + ' · ') + esc(mineOf(x.mine).name) + ' · en locación ' + fDT(x.nb) + '</div></div>' +
      '<button type="button" class="go" data-assign="' + x.id + '">Asignar</button></div>').join('')
      : '<div class="empty">No hay loads pendientes con el filtro actual.</div>';
  }
  function renderRouteLanes() {
    const now = Date.now();
    const lanes = S.config.mines.map(mi => {
      const sands = S.config.sands.filter(s => s.mine === mi.id).map(s => s.id);
      const p = M.params[sands[0]];
      const loads = M.slots.filter(x => x.status === 'eta' && sands.includes(x.s) && sandOn(x.s) && carrierOn(x.carrier)).map(x => ({
        p: (now - x.asgT) / M.params[x.s].leadMs, color: carrierColor(x.carrier),
        title: x.id + ' · ' + carrierName(x.carrier) + ' · asignado ' + fTime(x.asgT) + ' · llega ~' + fTime(x.eta)
      }));
      return { id: mi.id, name: mi.name, place: mi.place, miles: mi.miles || '—', leadTxt: p ? E.fmtDur(p.leadMin) : '—', color: MINE_COLOR[mi.id] || '#1E6B7A', loads };
    });
    const tot = lanes.reduce((p, l) => p + l.loads.length, 0);
    $('#routeBadge').textContent = tot + ' en camino';
    Viz.renderRoute($('#route'), { lanes, wellShort: (S.config.job.well || '').split(' ').slice(0, 2).join(' ') });
    const eta = M.slots.filter(x => x.status === 'eta' && sandOn(x.s) && carrierOn(x.carrier)).sort((a, b) => a.eta - b.eta);
    const nh = $('#pRoute .subnote');
    if (nh) nh.outerHTML = subNote({ kind: 'read', read: eta.length
      ? '<b>' + eta.length + '</b> en camino; el próximo llega ~<b>' + fTime(eta[0].eta) + '</b> (' + esc(sandLabel(eta[0].s)) + ' · ' + esc(carrierName(eta[0].carrier)) + '). Cada punto va según su hora de asignación y el lead de la arenera.'
      : 'Sin loads en camino. Cada load asignado aparece aquí según su hora de asignación y el lead de la arenera.' });
  }

  function renderGapChart() {
    const now = Date.now();
    const all = ui.gapRange === 'all';
    /* 48 h alrededor de ahora; antes del prefill la ventana mira hacia adelante (6 h atrás, 42 h adelante) */
    const back = M.well.phase === 'pre' ? 6 : 24;
    const from = all ? null : Math.floor((now - back * HOUR) / HOUR) * HOUR;
    const to = all ? null : from + 48 * HOUR;
    const filt = x => sandOn(x.s);
    const base = E.cumulativeSeries(M, { unit: ui.unit, filter: filt, from, to, step: all ? 2 * HOUR : HOUR });
    const cf = carrierFilterActive() ? E.cumulativeSeries(M, { unit: ui.unit, filter: x => filt(x) && (!x.asg || carrierOn(x.carrier)), from, to, step: all ? 2 * HOUR : HOUR }) : null;
    const dayShort = t => fDay(t).split(' ').slice(0, 2).join(' ');
    const labels = base.t.map(t => all ? dayShort(t) + ' ' + fTime(t) : (wp(t).h === 0 ? dayShort(t) : fTime(t)));
    const nowIdx = base.t.findIndex(t => t >= now);
    $('#gapRange').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.r === ui.gapRange));
    /* con filtro de carrier el total queda como contexto (gris) y el carrier seleccionado va a color */
    const baseCol = carrierFilterActive() ? '#8A97A8' : '#1E6B7A';
    const ds = [
      { type: 'line', label: 'Asignado', data: base.asg, borderColor: baseCol, backgroundColor: c => c.chart.chartArea ? oGrad(c.chart.ctx, c.chart.chartArea, baseCol, .16, 0) : oA(baseCol, .1),
        fill: true, pointRadius: 0, pointHoverRadius: 6, borderWidth: 2.4, tension: .25, spanGaps: false, order: 2 },
      { type: 'line', label: 'Requerido (cadencia)', data: base.req, borderColor: '#1B2538', borderDash: [6, 4], borderWidth: 1.8, pointRadius: 0, tension: .1, order: 1, endLabel: false }
    ];
    let cfColor = null;
    if (cf) {
      const nm = Array.from(state.carrier).join(' + ');
      const c0 = carriers().find(c => setHas(state.carrier, c.name));
      cfColor = c0 ? carrierColor(c0.id) : '#6BAED6';
      ds.push({ type: 'line', label: 'Asignado a ' + nm, data: cf.asg, borderColor: cfColor, borderWidth: 2, pointRadius: 0, order: 0 });
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
            label: c => ' ' + c.dataset.label + ': ' + (c.parsed.y == null ? '—' : uFmt(c.parsed.y) + ' ' + uLbl()),
            rows: i => {
              const r = base.req[i], a = base.asg[i];
              const out = [];
              if (a != null) {
                const g = a - r;
                out.push('Gap acumulado: ' + (g >= 0 ? '+' : '−') + uFmt(Math.abs(g)) + ' ' + uLbl() + (r ? ' (' + (g >= 0 ? '+' : '−') + nf1.format(Math.abs(g / r * 100)) + '%)' : ''));
              }
              out.push('Faltan por asignar: ' + uFmt(Math.max(0, base.total - (a == null ? base.asg.filter(v => v != null).slice(-1)[0] || 0 : a))) + ' ' + uLbl() + ' de ' + uFmt(base.total));
              const t0 = base.t[i], t1 = t0 + (all ? 2 : 1) * HOUR;
              const dueH = M.slots.filter(x => x.needed && filt(x) && x.ab >= t0 && x.ab < t1).length;
              out.push('Hora límite en este tramo: ' + dueH + ' loads');
              out.push('clic abre la cola en esta hora →');
              return out;
            }
          })
        },
        onClick: (e, els, c) => {
          const i = els && els.length ? els[0].index : null;
          if (i == null) return;
          ui.asHour = base.t[i]; ui.asDay = null; ui.asStatus = 'all';
          go('asignar');
        }
      }
    }, ch => attachLivePoint(ch, { datasetIndex: 0, color: baseCol }));
    legend('ce_gap', [{ label: 'Asignado', color: baseCol }, { label: 'Requerido (cadencia)', swatch: SW.dash('#1B2538'), line: true }]
      .concat(cf ? [{ label: ds[2].label, color: cfColor, line: true }] : []).concat([{ label: 'Ahora', swatch: SW.dots('#E6A23C'), line: true, toggle: false }]));
    chartNote('ce_gap', { read: gapRead(base, nowIdx), kind: 'detail', act: 'clic abre la cola →' });
  }
  function gapRead(base, nowIdx) {
    if (nowIdx < 0) return 'Fuera de la ventana: cambia a <b>Todo el pozo</b> para ver el acumulado completo.';
    const i = Math.max(0, nowIdx - 1);
    const a = base.asg[i] || 0, r = base.req[i] || 0, g = a - r;
    if (!r && !a) return 'Todavía no vence ningún load en esta ventana; la cadencia arranca con el prefill.';
    return g < 0 ? 'Van <b>' + uFmt(-g) + ' ' + uLbl() + ' atrás</b> de la cadencia: hay que asignar lo vencido antes de lo programado.'
      : 'La asignación va <b>' + (g > 0 ? uFmt(g) + ' ' + uLbl() + ' adelante' : 'justo en cadencia') + '</b>.';
  }

  function renderCarrierDonut() {
    const rows = rowsF('carrier').filter(r => r.asg);
    const agg = carriers().map(c => {
      const rs = rows.filter(r => r.carrier === c.id);
      return { id: c.id, name: c.name, n: rs.length, lbs: rs.reduce((p, r) => p + r.w, 0) };
    });
    const vals = agg.map(a => uVal(a.n, a.lbs));
    const tot = vals.reduce((p, v) => p + v, 0);
    const cols = agg.map(a => (carrierFilterActive() && !setHas(state.carrier, a.name)) ? oA(carrierColor(a.id), .28) : carrierColor(a.id));
    const empty = tot === 0;
    $('#carBadge').textContent = nL(rows.length, 'load', 'loads');
    chart('ce_car', {
      type: 'doughnut',
      data: { labels: empty ? ['Sin asignaciones'] : agg.map(a => a.name), datasets: [{ data: empty ? [1] : vals, backgroundColor: empty ? ['#E5E9F0'] : cols, hoverOffset: empty ? 0 : 8 }] },
      options: {
        cutout: '66%',
        plugins: {
          crosshair: false,
          doughnutCenter: { value: uFmt(tot), text: (ui.unit === 'loads' ? 'loads' : ui.unit === 'lbs' ? 'lb' : 't') + ' asignados' },
          tooltip: empty ? { enabled: true, callbacks: { label: () => ' Sin asignaciones todavía', afterBody: () => [SEP, 'Palomea loads en Asignar'] } } : tt3({
            title: it => it[0].label,
            label: c => ' ' + uFmt(c.parsed) + ' ' + uLbl() + ' · ' + (tot ? nf1.format(c.parsed / tot * 100) : 0) + '%',
            rows: i => {
              const a = agg[i];
              const rs = rows.filter(r => r.carrier === a.id);
              const byS = S.config.sands.map(s => sandLabel(s.id) + ': ' + rs.filter(r => r.s === s.id).length).join(' · ');
              const last = rs.length ? Math.max.apply(null, rs.map(r => r.asgT)) : null;
              return [byS, 'En camino: ' + rs.filter(r => r.status === 'eta').length + ' · entregados OMMA: ' + rs.filter(r => r.status === 'del').length,
                last ? 'Última asignación: ' + fDT(last) : 'Sin asignaciones', 'clic filtra el tablero →'];
            }
          })
        },
        onClick: empty ? () => go('asignar') : onMarkClick('carrier')
      }
    }, ch => attachHoverDim(ch));
    $('#carList').innerHTML = agg.map((a, i) => '<div class="dnrow' + (carrierFilterActive() && !setHas(state.carrier, a.name) ? ' dim' : '') + (carrierFilterActive() && setHas(state.carrier, a.name) ? ' act' : '') + '" data-ci="' + i + '" data-cname="' + esc(a.name) + '">' +
      '<span class="sq" style="background:' + carrierColor(a.id) + '"></span><span class="nm">' + esc(a.name) + '</span><b>' + uFmt(vals[i]) + ' <span class="pc">' + (tot ? nf1.format(vals[i] / tot * 100) : '0.0') + '%</span></b></div>').join('');
    chartNote('ce_car', { read: carRead(agg, tot), kind: 'filter' });
  }
  function carRead(agg, tot) {
    if (!tot) return 'Aún no hay loads asignados; el reparto por carrier aparece con la primera palomita.';
    const top = agg.slice().sort((a, b) => b.n - a.n)[0];
    const o = agg.find(a => a.id === M.trackedId);
    return '<b>' + esc(top.name) + '</b> lleva la mayor parte (' + nf1.format(uVal(top.n, top.lbs) / tot * 100) + '%).' + (o ? ' OMMA es el único carrier con entregas trackeadas.' : '');
  }

  function renderSandCards() {
    const now = Date.now();
    const seg = M.segPlans[Math.max(0, M.well.segIdx)] || M.segPlans[0];
    const html = S.config.sands.map((s, i) => {
      const x = M.sands[s.id];
      const rows = x.slots.filter(r => r.needed);
      const asg = rows.filter(r => r.asg && carrierOn(r.carrier));
      const pend = rows.filter(r => !r.asg);
      const due = rows.filter(r => r.ab <= now).length;
      const lbsA = asg.reduce((p, r) => p + r.w, 0);
      const q = seg && seg.per[s.id];
      const pct = rows.length ? asg.length / rows.length : 0;
      const dueP = rows.length ? due / rows.length : 0;
      const nx = pend.slice().sort((a, b) => a.ab - b.ab)[0];
      const series = M.days.map(d => d.loads[s.id] || 0);
      const on = sandOn(s.id);
      return '<article class="gcard sand ' + SAND_ACC[s.id] + (on ? '' : ' dimcard') + '" data-sand="' + esc(s.label) + '" style="--i:' + i + (on ? '' : ';opacity:.5') + '">' +
        '<div class="top"><div class="nm"><i style="background:' + SAND_COLOR[s.id] + '"></i>' + esc(s.label) + '</div><div class="mn">' + esc(mineOf(s.mine).name) + '</div></div>' +
        '<div class="big">' + uTxt(asg.length, lbsA) + '<small>/ ' + uTxt(rows.length, x.R) + ' ' + uLbl() + '</small></div>' +
        '<div class="trk" title="Marca: lo que ya debía estar asignado"><i style="--s:' + pct.toFixed(4) + '"></i><em style="left:' + (dueP * 100).toFixed(2) + '%"></em></div>' +
        '<div class="rows">' +
        '<span>Vencidos</span><b class="' + (pend.filter(r => r.status === 'late').length ? 'r' : 'g') + '">' + pend.filter(r => r.status === 'late').length + '</b>' +
        '<span>En ventana · 24 h</span><b class="a">' + pend.filter(r => r.status === 'now').length + ' · ' + pend.filter(r => r.ab <= now + DAY).length + '</b>' +
        '<span>Loads/día (tramo)</span><b>' + (q ? nf1.format(q.loadsPerDay) : '—') + '</b>' +
        '<span>Trucks req. · plan</span><b class="' + (q && q.trucksPlanned != null && q.trucksPlanned < q.trucksNeeded - 0.05 ? 'r' : '') + '">' + (q ? nf1.format(q.trucksNeeded) : '—') + ' · ' + (q && q.trucksPlanned != null ? q.trucksPlanned : 'sin plan') + '</b>' +
        '<span>Payload · lead</span><b>' + fmt.int(x.params.payload) + ' lb · ' + E.fmtDur(x.params.leadMin) + '</b>' +
        '</div>' +
        '<div class="k-spark">' + sparkbars(series, { highlight: M.days.findIndex(d => d.day === E.dayKey(now, tz())) }) + '</div>' +
        '<div class="act"><button type="button" class="btn sm primary" data-assign-next="' + s.id + '"' + (nx ? '' : ' disabled') + '>Asignar siguiente' + (nx ? ' · ' + fWhen(nx.ab) : '') + '</button></div>' +
        subNote({ read: nx ? 'Siguiente: <b>#' + String(nx.k).padStart(3, '0') + '</b> ' + cd(nx.ab) : 'Sin pendientes', kind: 'filter', act: 'clic filtra →' }) +
        '</article>';
    }).join('');
    const box = $('#sandCards');
    box.innerHTML = html;
    attachCardGlow(box);
  }
  function logText(e) {
    const slot = e.slot ? '<b>' + esc(e.slot) + '</b>' : '';
    switch (e.type) {
      case 'asg': return 'Asignó ' + slot + ' → ' + esc(carrierName(e.c));
      case 'unasg': return 'Quitó ' + slot + ' (' + esc(carrierName(e.c)) + ')';
      case 'setc': return 'Cambió ' + slot + ': ' + esc(carrierName(e.from)) + ' → ' + esc(carrierName(e.c));
      case 'bulk': return 'Palomeó <b>' + e.n + '</b> loads ' + esc(carrierName(e.c)) + (e.txt ? ' · ' + esc(e.txt) : '');
      case 'stage': return 'Reportó etapa <b>' + e.n + '</b> (' + fDT(Date.parse(e.at)) + ')';
      case 'stageDel': return 'Borró reporte de etapa <b>' + e.n + '</b>';
      case 'cfg': return 'Guardó el diseño' + (e.txt ? ': ' + esc(e.txt) : '');
      case 'omma': return 'Subió loads OMMA: <b>' + e.n + '</b> (total ' + e.total + ')' + (e.txt ? ' · ' + esc(e.txt) : '');
      case 'ommaClear': return 'Borró los loads OMMA';
      case 'resetAsg': return 'Reinició asignaciones (' + e.n + ')';
      case 'init': return 'Inició el estado compartido';
      default: return esc(e.type);
    }
  }
  function renderStream() {
    const L = (S.log || []).slice().reverse().filter(e => !e.c || carrierOn(e.c)).slice(0, 40);
    const key = L.length ? L[0].t + L[0].type + (L[0].slot || '') : '';
    const prevKey = ui.lastLogKey;
    $('#logBadge').textContent = (S.log || []).length + ' eventos';
    let seenPrev = false;
    $('#stream').innerHTML = L.length ? L.map(e => {
      const k = e.t + e.type + (e.slot || '');
      const isNew = prevKey && !seenPrev && k !== prevKey;
      if (k === prevKey) seenPrev = true;
      const t = Date.parse(e.t);
      return '<div class="ev' + (isNew ? ' new' : '') + '"><span class="tm">' + fTime(t) + '</span><span class="tx" title="' + esc(fDT(t)) + '">' + logText(e) + '</span><span class="by">' + esc(e.by || '—') + '</span></div>';
    }).join('') : '<div class="empty">Aquí aparece cada asignación, reporte de etapa y carga de archivo.</div>';
    ui.lastLogKey = key;
  }

  /* ============================== ASIGNAR ============================== */
  function asRows() {
    const now = Date.now();
    const q = ui.asQuery.trim().toLowerCase();
    let R = rowsF();
    R = R.filter(r => {
      if (ui.asStatus === 'pend' && (!r.needed || r.asg)) return false;
      if (ui.asStatus === 'late' && r.status !== 'late') return false;
      if (ui.asStatus === 'asg' && !r.asg) return false;
      if (ui.asHour != null) {
        if (ui.asHour === 'late') { if (!(r.ab < now && !r.asg)) return false; }
        else if (!(r.ab >= ui.asHour && r.ab < ui.asHour + HOUR)) return false;
      }
      if (ui.asDay && E.dayKey(r.ab, tz()) !== ui.asDay) return false;
      if (q) {
        const hay = [r.id, sandLabel(r.s) + ' ' + r.k, String(r.k).padStart(3, '0'), 'e' + r.stage, 'etapa ' + r.stage, r.carrier ? carrierName(r.carrier) : 'sin asignar', mineOf(r.mine).name, r.prefill ? 'prefill' : ''].join(' | ').toLowerCase();
        if (!q.split(/\s+/).every(t => hay.includes(t))) return false;
      }
      return true;
    });
    return R.sort((a, b) => a.ab - b.ab || a.s.localeCompare(b.s) || a.k - b.k);
  }
  function renderAsignar() {
    const now = Date.now();
    const k = M.kpi;
    $('#asMeta').innerHTML = '<span class="pill">vencidos ' + k.overdue + '</span><span class="pill">en ventana ' + k.nowWindow + '</span><span class="pill">próx. 24 h ' + k.next24 + '</span>';
    renderCadence();
    carrierPick('#asPick');
    const base = rowsF();
    const cnt = {
      pend: base.filter(r => r.needed && !r.asg).length, late: base.filter(r => r.status === 'late').length,
      asg: base.filter(r => r.asg).length, all: base.length
    };
    const st = [['pend', 'Pendientes'], ['late', 'Vencidos'], ['asg', 'Asignados'], ['all', 'Todos']];
    $('#asStatus').innerHTML = st.map(s => '<button type="button" class="chip' + (ui.asStatus === s[0] ? ' active' : '') + '" data-st="' + s[0] + '">' + s[1] + ' <span class="n">' + cnt[s[0]] + '</span></button>').join('');
    const pills = [];
    if (ui.asHour != null) pills.push('<button type="button" class="fpill" data-clear="hour">Hora límite: <b>' + (ui.asHour === 'late' ? 'vencidos' : fDT(ui.asHour) + '–' + fTime(ui.asHour + HOUR)) + '</b><i>×</i></button>');
    if (ui.asDay) pills.push('<button type="button" class="fpill" data-clear="day">Día: <b>' + fDayKey(ui.asDay) + '</b><i>×</i></button>');
    $('#asFilters').innerHTML = pills.join('');
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#asList select')) { ui.pendingList = true; return; }
    renderAsList();
  }
  function renderAsList() {
    ui.pendingList = false;
    const now = Date.now();
    const R = asRows();
    const show = R.slice(0, ui.asLimit);
    $('#asCount').textContent = show.length + ' de ' + R.length + ' loads';
    const more = $('#asMore');
    more.hidden = R.length <= ui.asLimit;
    more.textContent = 'Mostrar ' + Math.min(120, R.length - ui.asLimit) + ' más';
    if (!R.length) {
      const why = carrierFilterActive() && (ui.asStatus === 'pend' || ui.asStatus === 'late') ? 'Hay un filtro de carrier activo y los pendientes todavía no tienen carrier.' : 'Nada con estos filtros.';
      $('#asList').innerHTML = '<div class="empty">' + why + '</div>';
      return;
    }
    const groups = [];
    let cur = null;
    show.forEach(r => {
      if (!cur || cur.key !== r.shiftKey) { cur = { key: r.shiftKey, day: r.day, shift: r.shift, start: r.shiftStart, rows: [] }; groups.push(cur); }
      cur.rows.push(r);
    });
    const sh = S.config.shiftStartHour == null ? 6 : S.config.shiftStartHour;
    const shTx = s => s === 'D' ? 'Día ' + pad(sh) + ':00–' + pad((sh + 12) % 24) + ':00' : 'Noche ' + pad((sh + 12) % 24) + ':00–' + pad(sh) + ':00';
    const nowKey = E.shiftOf(now, tz(), sh).key;
    const opts = c => carriers().map(x => '<option value="' + esc(x.id) + '"' + (x.id === c ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('');
    let i = 0;
    const html = groups.map(g => {
      const all = M.slots.filter(x => x.shiftKey === g.key && x.needed && sandOn(x.s));
      const done = all.filter(x => x.asg).length;
      const late = all.filter(x => x.status === 'late').length;
      return '<div class="shg"><div class="shg-h' + (g.key === nowKey ? ' now' : '') + '"><span class="d">' + fDayKey(g.day) + '</span><span class="sh">' + shTx(g.shift) + (g.key === nowKey ? ' · turno actual' : '') + '</span>' +
        '<span class="bar"><i style="--s:' + (all.length ? (done / all.length).toFixed(4) : 0) + '"></i></span>' +
        '<span class="cnt"><b>' + done + '</b>/' + all.length + ' asignados' + (late ? ' · <span class="r">' + nL(late, 'vencido', 'vencidos') + '</span>' : '') + '</span></div>' +
        '<div class="rhead"><span></span><span>Load</span><span class="c-mine">Arenera</span><span>Etapa</span><span>Asignar antes de</span><span>En locación</span><span>Estado</span><span>Carrier</span></div>' +
        g.rows.map(r => {
          i++;
          const on = !!r.asg;
          const m = mineOf(r.mine);
          return '<div class="row ' + r.status + (on ? ' done' : '') + (r.prefill ? ' pre' : '') + '" data-slot="' + r.id + '" style="--i:' + Math.min(i, 20) + '">' +
            '<div class="c c-tick"><button type="button" class="tick' + (on ? ' on' : '') + '" data-tick="' + r.id + '"' + (on ? ' style="--tc:' + carrierColor(r.carrier) + '"' : '') + ' aria-pressed="' + on + '" aria-label="' + (on ? 'Quitar asignación de ' + r.id : 'Asignar ' + r.id + ' a ' + esc(carrierName(ui.carrier))) + '">' + sv(IC.tick, 14) + '</button></div>' +
            '<div class="c c-slot">' + slotChip(r) + '</div>' +
            '<div class="c c-mine mut">' + esc(m.name) + '</div>' +
            '<div class="c c-stg stg">E' + r.stage + '</div>' +
            '<div class="c c-ab tm">' + fDT(r.ab) + (on ? '' : '<small>' + cd(r.prefill ? r.ab : r.hard) + '</small>') + '</div>' +
            '<div class="c c-nb mono mut">' + fDT(r.nb) + '</div>' +
            '<div class="c c-st">' + stPill(r.status) + '</div>' +
            '<div class="c c-who who">' + (on ? '<select class="csel" data-csel="' + r.id + '" aria-label="Carrier de ' + r.id + '" style="border-left:3px solid ' + carrierColor(r.carrier) + '">' + opts(r.carrier) + '</select><span class="by">' + fTime(r.asgT) + (r.asg.by ? ' · ' + esc(r.asg.by) : '') + '</span>' : '<span class="mut">—</span>') + '</div>' +
            '<div class="c c-meta">E' + r.stage + ' · ' + esc(m.name) + ' · en locación ' + fDT(r.nb) + '</div>' +
            '</div>';
        }).join('') + '</div>';
    }).join('');
    const list = $('#asList');
    list.style.setProperty('--cc', carrierColor(ui.carrier));
    list.innerHTML = html;
  }
  function renderCadence() {
    const now = Date.now();
    const R = rowsF('carrier').filter(r => r.needed);
    /* si nada vence en las próximas 24 h (antes del prefill), la ventana arranca en la primera hora límite */
    const firstPend = R.filter(r => !r.asg).reduce((m, r) => Math.min(m, r.ab), Infinity);
    const shifted = isFinite(firstPend) && firstPend > now + DAY;
    const h0 = Math.floor((shifted ? firstPend : now) / HOUR) * HOUR;
    $('#pCad h3').textContent = shifted ? 'Cadencia · 24 h desde ' + fDT(h0) : 'Cadencia · próximas 24 h';
    const buckets = [{ key: 'late', label: 'Vencidos', t0: -Infinity, t1: now }];
    for (let h = 0; h < 24; h++) buckets.push({ key: h0 + h * HOUR, label: fTime(h0 + h * HOUR), t0: Math.max(now, h0 + h * HOUR), t1: h0 + (h + 1) * HOUR });
    const sands = S.config.sands.filter(s => sandOn(s.id));
    const pendIn = (b, s) => R.filter(r => r.s === s && !r.asg && (b.key === 'late' ? r.ab < now : (r.ab >= b.t0 && r.ab < b.t1)));
    const asgIn = b => R.filter(r => r.asg && (b.key === 'late' ? false : (r.ab >= b.t0 && r.ab < b.t1)));
    const val = rs => uVal(rs.length, rs.reduce((p, r) => p + r.w, 0));
    const ds = sands.map(s => ({
      label: s.label, stack: 'p', data: buckets.map(b => val(pendIn(b, s.id))),
      backgroundColor: dim(buckets.map(b => b.key === 'late' ? '#D9534F' : SAND_COLOR[s.id]), .25), borderRadius: 5, maxBarThickness: 26
    }));
    ds.push({ label: 'Ya asignados', stack: 'p', data: buckets.map(b => val(asgIn(b))), backgroundColor: dim(buckets.map(() => GHOST), .4), borderRadius: 5, maxBarThickness: 26 });
    const lateN = R.filter(r => !r.asg && r.ab < now).length;
    const next24 = R.filter(r => !r.asg && r.ab >= now && r.ab < now + DAY).length;
    const inWin = R.filter(r => r.ab >= h0 && r.ab < h0 + DAY).length;
    const b = $('#cadBadge');
    b.textContent = lateN ? nL(lateN, 'vencido', 'vencidos') : shifted ? 'arranca ' + fRel(firstPend, now) : next24 + ' en 24 h';
    b.className = 'pbadge ' + (lateN ? 'bad' : shifted ? 'warn' : '');
    chart('as_cad', {
      type: 'bar', data: { labels: buckets.map(x => x.label), datasets: ds },
      options: {
        scales: { x: Object.assign({}, gX, { stacked: true, ticks: Object.assign({}, gX.ticks, { maxTicksLimit: 13 }) }), y: yCount(inWin + lateN, { stacked: true }) },
        plugins: {
          tooltip: tt3({
            title: it => { const x = buckets[it[0].dataIndex]; return x.key === 'late' ? 'Vencidos sin asignar' : fDay(x.key) + ' · ' + x.label + '–' + fTime(x.t1); },
            label: c => c.parsed.y ? ' ' + c.dataset.label + ': ' + uFmt(c.parsed.y) + ' ' + uLbl() : null,
            rows: i => {
              const x = buckets[i];
              const p = sands.reduce((q, s) => q + pendIn(x, s.id).length, 0), a = asgIn(x).length;
              const out = ['Total con hora límite aquí: ' + (p + a) + ' loads', 'Asignados: ' + a + ' · pendientes: ' + p];
              if (p + a) out.push('Avance de la hora: ' + nf1.format(a / (p + a) * 100) + '%');
              out.push('clic filtra la cola →');
              return out;
            }
          })
        },
        onClick: (e, els) => { if (!els || !els.length) return; const x = buckets[els[0].index]; ui.asHour = ui.asHour === x.key ? null : x.key; ui.asDay = null; if (ui.asHour != null && ui.asStatus === 'asg') ui.asStatus = 'all'; renderSoon(); }
      }
    });
    legend('as_cad', sands.map(s => ({ label: s.label, color: SAND_COLOR[s.id] })).concat([
      { label: 'Ya asignados', color: GHOST }, { label: 'Vencidos sin asignar', color: '#D9534F', toggle: false }]));
    chartNote('as_cad', {
      read: lateN ? 'Hay <b>' + nL(lateN, 'load vencido', 'loads vencidos') + '</b>: ' + (lateN === 1 ? 'va' : 'van') + ' primero en la cola, antes que la cadencia de la hora.'
        : shifted ? 'Nada vence en las próximas 24 h. La primera hora límite es <b>' + fDT(firstPend) + '</b>; la gráfica muestra las 24 h desde ahí (<b>' + inWin + '</b> loads).'
          : 'Sin vencidos. En las próximas 24 h vencen <b>' + next24 + '</b> loads.', kind: 'filter', act: 'clic filtra la cola →' });
  }

  /* ============================== AVANCE ============================== */
  function renderAvance() {
    const w = M.well, now = Date.now();
    $$('#basisSeg button').forEach(b => b.classList.toggle('on', b.dataset.b === ui.basis));
    const cov = covFor(ui.basis);
    const ss = selSands();
    const totLbs = ss.reduce((p, s) => p + M.tb.R[s], 0);
    const lbsB = ss.reduce((p, s) => p + (ui.basis === 'asg' ? M.sands[s].asgLbs : ui.basis === 'est' ? M.sands[s].estLbs : M.sands[s].ommaLbs), 0);
    const pct = totLbs ? Math.min(1, lbsB / totLbs) : 0;
    const om = M.jobLoads.filter(l => sandOn(l.s));
    const omLbs = om.reduce((p, l) => p + l.w, 0);
    const bTx = { asg: 'asignado', est: 'entregado est.', omma: 'OMMA real' }[ui.basis];
    const planPos = Math.max(0, Math.min(M.N, planX(now)));
    const realN = w.lastRep ? w.lastRep.n : null;
    paintKpis('#avKpis', [
      kpiCard({ label: 'Etapa del pozo', value: realN != null ? String(realN) : (w.phase === 'frac' ? String(Math.floor(planPos)) : '—'), unit: '/ ' + M.N, icon: sv(IC.layers, 16), accent: 'a-teal', i: 0,
        badge: '<span class="gr ' + (realN != null ? 'neu' : 'ghost') + '">' + (realN != null ? 'real' : 'plan') + '</span>',
        foot: '<span>' + (w.lastRep ? 'reporte ' + fDT(w.lastRep.t) : 'sin reportes del frac crew') + '</span><span>' + (w.pace ? 'ritmo <b>' + nf1.format(w.pace.v) + '</b>' : 'diseño <b>' + nf1.format(w.designPace) + '</b>') + ' et/día</span>' }),
      kpiCard({ label: 'Etapas cubiertas · ' + bTx, value: fmt.int(Math.floor(cov.pos + 1e-9)), unit: '/ ' + M.N, icon: sv(IC.target, 16), accent: 'a-mint', i: 1,
        badge: '<span class="gr neu">' + nf2.format(cov.pos) + ' et</span>', foot: '<span>limita <b>' + esc(cov.lim ? sandLabel(cov.lim) : '—') + '</b></span><span>' + (realN != null ? 'colchón <b>' + nf1.format(cov.pos - realN) + '</b> et' : '') + '</span>' }),
      kpiCard({ label: 'Arena cubierta · ' + bTx, value: nf1.format(pct * 100), unit: '%', icon: sv(IC.gauge, 16), accent: 'a-sky', i: 2,
        foot: '<span><b>' + uTxt(ss.reduce((p, s) => p + (ui.basis === 'asg' ? M.sands[s].nAssigned : ui.basis === 'est' ? M.sands[s].estN : M.sands[s].omma.delivered), 0), lbsB) + '</b> ' + uLbl() + '</span><span>de ' + uTxt(M.slots.filter(x => x.needed && sandOn(x.s)).length, totLbs) + '</span>' }),
      kpiCard({ label: 'OMMA entregado', value: uTxt(om.length, omLbs), unit: uLbl(), icon: sv(IC.truck, 16), accent: 'a-lav', i: 3, badge: '<span class="gr neu">real</span>',
        foot: '<span>' + om.length + ' loads · ' + fmt.int(omLbs) + ' lb</span><span>' + (om.length ? 'último ' + fDT(Math.max.apply(null, om.map(l => l.d || l.a)))
          : M.wellLoads.length > M.jobLoads.length ? '<b>' + (M.wellLoads.length - M.jobLoads.length) + '</b> antes del corte' : '') + '</span>' })
    ]);
    renderCoverageChart();
    renderStageChart();
    renderReportPanel();
    renderRecon();
  }
  function planX(t) {
    const base = E.schedule(M.tb, S.config, { stage: [] }, tz());
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
    $('#covBadge').textContent = 'alcanza E' + Math.max(1, Math.min(M.N, Math.floor(minCov.pos + 1e-9) + (minCov.pos < M.N ? 1 : 0)));
    chart('av_cov', {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Requerido', data: need, backgroundColor: dim(sands.map(() => GHOST), .5), borderRadius: 7, barPercentage: .92, categoryPercentage: .8, grouped: false, order: 3 },
        { label: 'Asignado', data: asgV, backgroundColor: dim(colsA), borderRadius: 7, barPercentage: .6, categoryPercentage: .8, grouped: false, order: 2 },
        { label: ui.basis === 'omma' ? 'OMMA real' : 'Entregado est.', data: ui.basis === 'omma' ? omV : estV, backgroundColor: dim(colsE), borderRadius: 6, barPercentage: .3, categoryPercentage: .8, grouped: false, order: 1 }
      ] },
      options: {
        indexAxis: 'y',
        scales: { x: Object.assign(gYf(uAxis), { grid: { color: OMMA.grid } }), y: Object.assign({}, gX, { ticks: Object.assign({}, gX.ticks, { font: { size: 11.5, weight: '700' } }) }) },
        plugins: {
          crosshair: false,
          tooltip: tt3({
            title: it => it[0].label + ' · ' + mineOf(sands[it[0].dataIndex].mine).name,
            label: c => ' ' + c.dataset.label + ': ' + uFmt(c.parsed.x) + ' ' + uLbl(),
            rows: i => {
              const x = M.sands[sands[i].id];
              return ['Alcanza (asignado): ' + nf2.format(x.cov.asg) + ' et · entregado est.: ' + nf2.format(x.cov.est) + ' et',
                'OMMA real: ' + x.omma.delivered + ' loads · ' + fmt.int(x.ommaLbs) + ' lb',
                'Faltan por asignar: ' + (x.nNeeded - x.nAssignedNeeded) + ' loads', 'clic filtra el tablero →'];
            }
          })
        },
        onClick: onMarkClick('sand')
      }
    });
    legend('av_cov', [{ label: 'Requerido', color: GHOST }, { label: 'Asignado', swatch: SW.sands(false) },
      { label: ui.basis === 'omma' ? 'OMMA real' : 'Entregado est.', swatch: SW.sands(true) }]);
    chartNote('av_cov', { read: 'Limita <b>' + esc(minCov.lim ? sandLabel(minCov.lim) : '—') + '</b>: con esa arena la cobertura ' + ({ asg: 'asignada', est: 'entregada', omma: 'de OMMA' }[ui.basis]) + ' llega a <b>' + nf2.format(minCov.pos) + '</b> etapas.', kind: 'filter' });
  }
  function renderStageChart() {
    const w = M.well, now = Date.now();
    const plan = E.schedule(M.tb, S.config, { stage: [] }, tz());
    /* eje X alineado a medianoche local, con marcas cada 12 h o cada día según el largo */
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
    b.textContent = diff == null ? 'sin reportes' : (diff >= 0 ? '+' : '−') + nf1.format(Math.abs(diff)) + ' et vs plan';
    b.className = 'pbadge ' + (diff == null ? '' : diff >= -0.5 ? 'ok' : diff >= -2 ? 'warn' : 'bad');
    chart('av_stage', {
      type: 'line',
      data: { datasets: [
        { label: 'Plan (diseño)', data: pl, borderColor: '#1B2538', borderDash: [6, 4], borderWidth: 1.8, pointRadius: 0, tension: 0, order: 3, endLabel: false },
        { label: 'Proyección desde el último reporte', data: pr, borderColor: '#6BAED6', borderWidth: 2, borderDash: [2, 3], pointRadius: 0, tension: 0, order: 2 },
        { label: 'Etapa reportada', data: real, borderColor: '#1E6B7A', backgroundColor: '#1E6B7A', borderWidth: 2.4, pointRadius: 3.5, pointHoverRadius: 7, stepped: false, tension: 0, order: 1 }
      ] },
      options: {
        parsing: true,
        layout: { padding: { right: 44, top: 16 } },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        scales: {
          x: Object.assign({}, gX, { type: 'linear', min: t0, max: t1,
            afterBuildTicks: ax => { ax.ticks = xTicks.map(v => ({ value: v })); },
            ticks: Object.assign({}, gX.ticks, { autoSkip: true, callback: v => { const p = wp(v); return (p.h === 0 && p.mi === 0) ? fDay(v).split(' ').slice(0, 2).join(' ') : fTime(v); } }) }),
          y: Object.assign(gYf(v => 'E' + v), { max: M.N, ticks: Object.assign({}, gY.ticks, { callback: v => 'E' + v, stepSize: 15 }) })
        },
        plugins: {
          endLabel: { enabled: true, fmt: v => 'E' + nf1.format(v) },
          nowLine: { x: now },
          tooltip: tt3({
            title: it => fDT(it[0].parsed.x),
            label: c => ' ' + c.dataset.label + ': E' + nf1.format(c.parsed.y),
            rows: (i, items) => {
              const t = items[0].parsed.x;
              const pX = plan.X(t);
              const out = ['Plan a esa hora: E' + nf1.format(Math.max(0, Math.min(M.N, pX)))];
              if (w.lastRep && t >= w.lastRep.t - HOUR) {
                const d = M.sc.X(t) - pX;
                out.push('Gap vs plan: ' + (d >= 0 ? '+' : '−') + nf1.format(Math.abs(d)) + ' et (' + (d >= 0 ? '+' : '−') + E.fmtDur(Math.abs(d) * 1440 / (w.designPace || 19)) + ')');
              }
              out.push('Fin estimado: ' + fDT(M.sc.B[M.N]));
              out.push('clic abre el detalle →');
              return out;
            }
          })
        },
        onClick: (e, els, c) => {
          if (!els || !els.length) return;
          const p = els[0].element.$context ? els[0].element.$context.parsed : c.data.datasets[els[0].datasetIndex].data[els[0].index];
          const t = p.x;
          showDetail(e.native || e, 'Pozo · ' + fDT(t), [['Plan', 'E' + nf1.format(Math.max(0, plan.X(t)))], ['Proyección', 'E' + nf1.format(Math.max(0, M.sc.X(t)))],
            ['Último reporte', w.lastRep ? 'E' + w.lastRep.n + ' · ' + fDT(w.lastRep.t) : '—'], ['Fin plan', fDT(plan.B[M.N])], ['Fin proyectado', fDT(M.sc.B[M.N])]]);
        }
      }
    });
    legend('av_stage', [{ label: 'Plan (diseño)', swatch: SW.dash('#1B2538'), line: true }, { label: 'Proyección desde el último reporte', swatch: SW.dots('#6BAED6'), line: true },
      { label: 'Etapa reportada', color: '#1E6B7A', line: true }].concat(now >= t0 && now <= t1 ? [{ label: 'Ahora', swatch: SW.dots('#E6A23C'), line: true, toggle: false }] : []));
    chartNote('av_stage', { read: diff == null ? 'Sin reportes todavía: el calendario usa el inicio de frac y el ritmo del diseño. Registra la etapa en cuanto la reporte el frac crew.' :
      (diff >= 0 ? 'El pozo va <b>' + nf1.format(diff) + ' etapas adelante</b> del diseño.' : 'El pozo va <b>' + nf1.format(-diff) + ' etapas atrás</b> del diseño: la cola se recorrió y los loads se necesitan más tarde.'), kind: 'detail' });
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
    $('#repBadge').textContent = w.reports.length ? nL(w.reports.length, 'reporte', 'reportes') : 'sin reportes';
    $('#repList').innerHTML = reps.length ? reps.map(r => '<div class="rep"><span class="n">E' + r.n + '</span><span class="t">' + fDT(r.t) + '</span><span class="mono mut">' + esc(r.by || '—') + '</span><button type="button" class="x" data-rdel="' + esc(r.id) + '" aria-label="Borrar reporte">×</button></div>').join('')
      : '<div class="empty">Sin reportes. El calendario corre con el inicio de frac y el ritmo del diseño.</div>';
  }
  function renderRecon() {
    const out = [];
    let totalU = 0;
    S.config.sands.forEach(s => {
      const x = M.sands[s.id], o = x.omma;
      if (!o.assigned && !o.delivered) return;
      totalU += o.reconcile.length;
      out.push('<div class="rc"><div class="nm">' + slotChip({ s: s.id, k: 0 }).replace(' · 000', '') + '</div>' +
        (o.reconcile.length ? '<button type="button" class="btn sm primary" data-recon="' + s.id + '">Palomear ' + o.reconcile.length + ' como ' + esc(carrierName(M.trackedId)) + '</button>' : '<span class="st del">conciliado</span>') +
        '<div class="ks"><span><b>' + o.assigned + '</b>asignados OMMA</span><span><b>' + o.delivered + '</b>entregados (archivo)</span><span><b>' + o.matched + '</b>casados</span><span><b class="a">' + o.pending + '</b>en camino / sin registro</span><span><b class="a">' + o.unmatched.length + '</b>sin palomear</span></div></div>');
    });
    const meta = S.omma && S.omma.meta;
    const rng = M.stats.range;
    $('#reconBadge').textContent = totalU ? totalU + ' por conciliar' : 'al día';
    $('#reconBadge').className = 'pbadge ' + (totalU ? 'warn' : 'ok');
    $('#recon').innerHTML = (out.length ? out.join('') : '<div class="empty">Sin loads OMMA asignados ni entregados todavía.</div>') +
      '<div class="note">Los entregados salen del último archivo de loads OMMA' + (meta && meta.file ? ' (<b>' + esc(meta.file) + '</b>' + (meta.at ? ', ' + fDT(meta.at) : '') + ')' : '') + (rng ? '; cubre del ' + fDT(rng.from) + ' al ' + fDT(rng.to) : '') + '. Lo asignado a OMMA después de ese archivo aún no puede aparecer como entregado.' +
      (M.countFrom ? ' Sólo cuentan entregas desde <b>' + fDT(M.countFrom) + '</b>' + (M.wellLoads.length > M.jobLoads.length ? ' (' + (M.wellLoads.length - M.jobLoads.length) + ' anteriores quedan fuera)' : '') + '.' : '') + '</div>';
  }

  /* ============================== PLAN ============================== */
  function renderPlan() {
    const k = M.kpi;
    $('#plMeta').innerHTML = '<span class="pill">' + M.N + ' etapas</span><span class="pill">' + S.config.segments.length + ' tramos</span>';
    const tot = '<article class="gcard stot a-teal"><div class="l">Total del pozo</div><div class="v">' + uTxt(k.reqLoads, k.reqLbs) + '<small>' + uLbl() + '</small></div>' +
      '<div class="s"><b>' + fmt.int(k.reqLoads) + '</b> loads · <b>' + fmt.int(k.reqLbs) + '</b> lb · <b>' + nf1.format(k.reqLbs / 2000) + '</b> t</div></article>';
    $('#sandTotals').innerHTML = tot + S.config.sands.map(s => {
      const x = M.sands[s.id];
      return '<article class="gcard stot ' + SAND_ACC[s.id] + '"><div class="l"><i style="background:' + SAND_COLOR[s.id] + '"></i>' + esc(s.label) + ' · ' + esc(mineOf(s.mine).name) + '</div>' +
        '<div class="v">' + uTxt(x.nNeeded, x.R) + '<small>' + uLbl() + '</small></div>' +
        '<div class="s"><b>' + fmt.int(x.nNeeded) + '</b> loads · <b>' + fmt.int(x.R) + '</b> lb · <b>' + nf1.format(x.R / 2000) + '</b> t<br>payload ' + fmt.int(x.params.payload) + ' lb ' + srcTag(x.params.payloadSrc) + ' · prefill ' + x.prefillN + '</div></article>';
    }).join('');
    attachCardGlow($('#sandTotals'));
    renderDaysChart();
    renderTrucks();
    /* no se redibuja el formulario mientras alguien está parado en un campo: se perdería el foco */
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
    $('#daysBadge').textContent = days.length + ' días';
    chart('pl_days', {
      type: 'bar',
      data: { labels: days.map(d => fDayKey(d.day)), datasets: sands.map(s => ({ type: 'bar', label: s.label, stack: 'd', data: days.map(d => val(d, s.id)), backgroundColor: dim(days.map(() => SAND_COLOR[s.id])), borderRadius: 5, maxBarThickness: 44, order: 2 }))
        .concat([{ type: 'line', label: 'Capacidad del plan', data: cap, borderColor: '#C25151', borderDash: [5, 4], borderWidth: 1.8, pointRadius: 3, pointBackgroundColor: '#C25151', spanGaps: false, order: 1 }]) },
      options: {
        layout: { padding: { right: 46, top: 12 } },
        scales: { x: Object.assign({}, gX, { stacked: true }), y: Object.assign(gYf(uAxis), { stacked: true }) },
        plugins: {
          endLabel: { enabled: true, fmt: v => uFmt(v) },
          tooltip: tt3({
            title: it => fDayKey(days[it[0].dataIndex].day),
            label: c => c.parsed.y == null ? ' ' + c.dataset.label + ': sin plan de trucks' : ' ' + c.dataset.label + ': ' + uFmt(c.parsed.y) + ' ' + uLbl(),
            rows: i => {
              const d = days[i];
              const tt = sands.reduce((p, s) => p + val(d, s.id), 0);
              const out = ['Total del día: ' + uFmt(tt) + ' ' + uLbl() + ' · asignados ' + d.asg + ' de ' + d.total + ' loads'];
              if (cap[i] != null) out.push('vs capacidad: ' + (tt <= cap[i] ? 'cabe (' : 'faltan ') + uFmt(Math.abs(cap[i] - tt)) + ' ' + uLbl() + (tt <= cap[i] ? ' de holgura)' : ''));
              out.push('clic abre la cola de ese día →');
              return out;
            }
          })
        },
        onClick: (e, els) => { if (!els || !els.length) return; ui.asDay = days[els[0].index].day; ui.asHour = null; ui.asStatus = 'all'; go('asignar'); }
      }
    });
    legend('pl_days', sands.map(s => ({ label: s.label, color: SAND_COLOR[s.id] })).concat([{ label: 'Capacidad del plan', swatch: SW.dash('#C25151'), line: true }]));
    const totOf = d => sands.reduce((p, s) => p + val(d, s.id), 0);
    const pi = days.reduce((b, d, i) => (b < 0 || totOf(d) > totOf(days[b]) ? i : b), -1);
    const over = days.map((d, i) => cap[i] != null && totOf(d) > cap[i] + 1e-9 ? totOf(d) - cap[i] : 0);
    const nOver = over.filter(v => v > 0).length;
    let read = 'Sin días en el plan.';
    if (pi >= 0) {
      const pd = days[pi];
      const mix = sands.filter(s => pd.loads[s.id]).map(s => esc(s.label) + ' ' + uFmt(val(pd, s.id))).join(' · ');
      read = 'El día más cargado es <b>' + fDayKey(pd.day) + '</b>: <b>' + uFmt(totOf(pd)) + ' ' + uLbl() + '</b> (' + mix + ').' +
        (nOver ? ' <b>' + nL(nOver, 'día', 'días') + '</b> por encima de la capacidad de los trucks del plan, hasta <b>' + uFmt(Math.max.apply(null, over)) + ' ' + uLbl() + '</b> de más.' : cap.some(c => c != null) ? ' Los trucks del plan alcanzan en los días que tienen plan.' : '');
    }
    chartNote('pl_days', { read, kind: 'detail', act: 'clic abre ese día →' });
  }
  function renderTrucks() {
    const sp = M.segPlans;
    if (ui.segPick == null || !sp[ui.segPick]) ui.segPick = Math.max(0, Math.min(sp.length - 1, M.well.segIdx >= 0 ? M.well.segIdx : sp.length - 1));
    if (M.well.phase === 'pre' && ui.segPickAuto !== false && sp.length > 1 && ui.segPick === 0 && !ui.segPickSet) ui.segPick = sp.length - 1;
    $('#segPick').innerHTML = sp.map((p, i) => '<button type="button" data-seg="' + i + '" class="' + (i === ui.segPick ? 'on' : '') + '">E' + p.from + '–' + p.to + '</button>').join('');
    const p = sp[ui.segPick];
    if (!p) return;
    const sands = S.config.sands;
    const need = sands.map(s => p.per[s.id].trucksNeeded);
    const plan = sands.map(s => p.per[s.id].trucksPlanned);
    const parts = sands.filter(s => p.per[s.id].lbs > 0).map(s => { const q = p.per[s.id]; return '<b>' + nf1.format(q.trucksNeeded) + '</b> de ' + esc(s.label) + (q.trucksPlanned != null ? ' (plan ' + q.trucksPlanned + ')' : ' (sin plan)'); });
    $('#trucksDesc').innerHTML = 'A ' + nf1.format(p.pace) + ' etapas/día se necesitan ' + parts.join(', ') + '. ' +
      (p.sustainPace != null ? 'Con los trucks del plan el pozo sostiene <b>' + nf1.format(p.sustainPace) + ' etapas/día</b>' + (p.sustainPace < p.pace ? ' — limita <b>' + esc(sandLabel(p.limiting)) + '</b>.' : '.') : 'El diseño no trae plan de trucks completo para este tramo.');
    chart('pl_trucks', {
      type: 'bar',
      data: { labels: sands.map(s => s.label), datasets: [
        { label: 'Plan', data: plan.map(v => v == null ? 0 : v), backgroundColor: dim(sands.map(() => GHOST), .5), borderRadius: 7, barPercentage: .9, categoryPercentage: .78, grouped: false, order: 2 },
        { label: 'Requeridos', data: need, backgroundColor: dim(sands.map(s => (p.per[s.id].trucksPlanned != null && p.per[s.id].trucksPlanned < p.per[s.id].trucksNeeded - 0.05) ? '#E08A86' : SAND_COLOR[s.id])), borderRadius: 7, barPercentage: .5, categoryPercentage: .78, grouped: false, order: 1 }
      ] },
      options: {
        indexAxis: 'y',
        scales: { x: Object.assign(gYf(v => fmt.int(v)), { grid: { color: OMMA.grid } }), y: Object.assign({}, gX, { ticks: Object.assign({}, gX.ticks, { font: { size: 11.5, weight: '700' } }) }) },
        plugins: {
          crosshair: false,
          tooltip: tt3({
            title: it => it[0].label + ' · E' + p.from + '–' + p.to,
            label: c => ' ' + c.dataset.label + ': ' + (c.dataset.label === 'Plan' && plan[c.dataIndex] == null ? 'sin plan' : nf1.format(c.parsed.x) + ' trucks'),
            rows: i => {
              const q = p.per[sands[i].id], pr = M.params[sands[i].id];
              return ['Loads/día requeridos: ' + nf1.format(q.loadsPerDay) + ' · 1 cada ' + E.fmtDur(q.everyMin),
                'Loads por truck/día: ' + nf2.format(pr.lptd) + ' (' + pr.lptdSrc + ')',
                q.trucksPlanned != null ? 'Brecha: ' + (q.gapTrucks >= 0 ? '+' : '−') + nf1.format(Math.abs(q.gapTrucks)) + ' trucks' : 'Sin plan de trucks',
                q.sustainPace != null ? 'Con el plan sostiene ' + nf1.format(q.sustainPace) + ' et/día' : '', 'clic filtra el tablero →'].filter(Boolean);
            }
          })
        },
        onClick: onMarkClick('sand')
      }
    });
    legend('pl_trucks', [{ label: 'Plan', color: GHOST }, { label: 'Requeridos', swatch: SW.sands(false) }, { label: 'Requeridos > plan', color: '#E08A86', toggle: false }]);
    chartNote('pl_trucks', { read: p.sustainPace != null && p.sustainPace < p.pace ? 'Faltan trucks: al ritmo del diseño se necesitan <b>' + nf1.format(sands.reduce((q, s) => q + p.per[s.id].trucksNeeded, 0)) + '</b> y el plan trae <b>' + sands.reduce((q, s) => q + (p.per[s.id].trucksPlanned || 0), 0) + '</b>.' : 'El plan de trucks cubre el ritmo del diseño en este tramo, o no hay plan que comparar.', kind: 'filter' });
    $('#cadence').innerHTML = sands.filter(s => p.per[s.id].loadsPerDay > 0).map(s => {
      const q = p.per[s.id];
      return '<div class="cad"><div class="k"><i style="background:' + SAND_COLOR[s.id] + '"></i>' + esc(s.label) + '</div><div class="v">1 cada ' + E.fmtDur(q.everyMin) + '</div><div class="s">' + nf1.format(q.loadsPerDay) + ' loads/día · ' + fmt.int(q.lbs) + ' lb/et</div></div>';
    }).join('');
  }

  /* ---------- editor del diseño ---------- */
  function renderDesignForm() {
    const d = ui.draft;
    const sands = d.sands;
    const num = (path, v, attrs) => '<input type="number" data-path="' + path + '" value="' + (v == null ? '' : v) + '" ' + (attrs || 'step="any"') + ' inputmode="decimal">';
    const txt = (path, v) => '<input type="text" data-path="' + path + '" value="' + esc(v == null ? '' : v) + '">';
    const dt = (path, v) => '<input type="datetime-local" data-path="' + path + '" value="' + esc(v || '') + '">';
    let h = '<div class="dform">';
    h += '<div class="dsec"><h4>Pozo y calendario</h4><div class="fgrid">' +
      '<label class="fld"><span>Pozo</span>' + txt('job.well', d.job.well) + '</label>' +
      '<label class="fld"><span>Cliente</span>' + txt('job.client', d.job.client) + '</label>' +
      '<label class="fld"><span>Etapas totales</span>' + num('job.totalStages', d.job.totalStages, 'step="1" min="1" max="2000"') + '</label>' +
      '<label class="fld"><span>Inicio del prefill</span>' + dt('schedule.prefillStart', d.schedule.prefillStart) + '</label>' +
      '<label class="fld"><span>Inicio de frac · etapa 1</span>' + dt('schedule.fracStart', d.schedule.fracStart) + '</label>' +
      '<label class="fld"><span>Contar entregas OMMA desde <em>vacío = todas</em></span>' + dt('countFrom', d.countFrom) + '</label>' +
      '<label class="fld"><span>Colchón en locación <em>etapas</em></span>' + num('bufferStages', d.bufferStages, 'step="0.5" min="0"') + '</label>' +
      '<label class="fld"><span>Ventana "asignar ya" <em>horas</em></span>' + num('alertHours', d.alertHours, 'step="0.5" min="0"') + '</label>' +
      '<label class="fld"><span>Turno de día inicia <em>hora</em></span>' + num('shiftStartHour', d.shiftStartHour, 'step="1" min="0" max="23"') + '</label>' +
      '<label class="fld"><span>Zona horaria</span><select class="inp" data-path="tz">' + ['America/Mexico_City', 'America/Chicago', 'America/Denver'].map(z => '<option' + (z === d.tz ? ' selected' : '') + '>' + z + '</option>').join('') + '</select></label>' +
      '</div></div>';
    h += '<div class="dsec"><h4>Tramos del diseño · lbs por etapa y trucks del plan</h4><div class="tblwrap"><table class="segtbl"><thead><tr><th>Desde</th><th>Hasta</th><th>Etapas/día</th>' +
      sands.map(s => '<th>' + esc(s.label) + ' lb/et</th>').join('') + sands.map(s => '<th>Trucks ' + esc(s.label) + '</th>').join('') + '<th></th></tr></thead><tbody>' +
      d.segments.map((g, i) => '<tr><td>' + num('segments.' + i + '.from', g.from, 'step="1" min="1"') + '</td><td>' + num('segments.' + i + '.to', g.to, 'step="1" min="1"') + '</td><td>' + num('segments.' + i + '.pace', g.pace, 'step="0.5" min="0.1"') + '</td>' +
        sands.map(s => '<td>' + num('segments.' + i + '.lbs.' + s.id, (g.lbs || {})[s.id], 'step="1000" min="0"') + '</td>').join('') +
        sands.map(s => '<td>' + num('segments.' + i + '.trucks.' + s.id, (g.trucks || {})[s.id], 'step="1" min="0" placeholder="—"') + '</td>').join('') +
        '<td>' + (d.segments.length > 1 ? '<button type="button" class="btn sm danger" data-segdel="' + i + '" aria-label="Quitar tramo">' + sv(IC.trash, 13) + '</button>' : '') + '</td></tr>').join('') +
      '</tbody></table></div><div class="dacts" style="margin-top:8px"><button type="button" class="btn sm" id="segAdd">' + sv(IC.plus, 13) + 'Agregar tramo</button></div></div>';
    h += '<div class="dsec"><h4>Prefill y productividad</h4><div class="fgrid">' +
      sands.map(s => '<label class="fld"><span>Prefill ' + esc(s.label) + ' <em>loads</em></span>' + num('prefill.' + s.id, (d.prefill || {})[s.id], 'step="1" min="0"') + '</label>').join('') +
      sands.map(s => '<label class="fld"><span>Loads por truck/día ' + esc(s.label) + ' <em>vacío = dato</em></span>' + num('loadsPerTruckDay.' + s.id, (d.loadsPerTruckDay || {})[s.id], 'step="0.1" min="0"') + '</label>').join('') +
      '</div></div>';
    h += '<div class="dsec"><h4>Carriers</h4><div class="fgrid">' +
      d.carriers.map((c, i) => '<label class="fld"><span>Carrier ' + (i + 1) + (c.tracked ? ' <em>· loads trackeados</em>' : '') + '</span>' + txt('carriers.' + i + '.name', c.name) + '</label>').join('') +
      '</div></div>';
    h += '<div id="designPreview"></div>';
    h += '<div class="dacts"><button type="button" class="btn primary" id="dSave">Guardar para todo despacho</button><button type="button" class="btn" id="dDiscard">Descartar cambios</button>' +
      '<span class="grow"></span><button type="button" class="btn ghost" id="dDefault">Restaurar diseño original</button><button type="button" class="btn danger" id="dReset">Reiniciar asignaciones</button></div>';
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
    try { tb = E.stageTable(ui.draft); issues = tb.issues; } catch (e) { issues = [{ lvl: 'err', txt: 'Diseño inválido: ' + e.message }]; }
    const tz0 = ui.draft.tz || 'America/Mexico_City';
    const ps = E.parseWall(ui.draft.schedule.prefillStart, tz0), fs = E.parseWall(ui.draft.schedule.fracStart, tz0);
    if (ps == null) issues.push({ lvl: 'err', txt: 'Falta el inicio del prefill' });
    if (fs == null) issues.push({ lvl: 'err', txt: 'Falta el inicio de frac' });
    if (ps != null && fs != null && fs <= ps) issues.push({ lvl: 'warn', txt: 'El inicio de frac es antes que el prefill' });
    let sum = '';
    if (tb) {
      const tl = tb.ids.reduce((p, s) => p + tb.R[s], 0);
      const loads = tb.ids.reduce((p, s) => p + Math.ceil(tb.R[s] / M.params[s].payload), 0);
      sum = '<div class="note" style="font-size:12px;color:var(--soft);margin-bottom:8px">Con este diseño: <b>' + fmt.int(tl) + ' lb</b> (' + nf1.format(tl / 2000) + ' t) · ≈ <b>' + fmt.int(loads) + ' loads</b> con los payloads actuales · ' +
        tb.ids.map(s => esc(sandLabel(s)) + ' ' + fmt.int(tb.R[s]) + ' lb').join(' · ') + '</div>';
    }
    box.innerHTML = sum + (issues.length ? '<ul class="issues">' + issues.map(i => '<li>' + esc(i.txt) + '</li>').join('') + '</ul>' : '<ul class="issues ok"><li>Diseño consistente: todas las etapas tienen tramo y ritmo.</li></ul>') +
      (ui.dirty ? '<p class="dirty-note">Cambios sin guardar · se aplican a todo despacho al guardar.</p>' : '');
    const btn = $('#dSave');
    if (btn) btn.disabled = !ui.dirty || issues.some(i => i.lvl === 'err');
    $('#designBadge').textContent = ui.dirty ? 'sin guardar' : 'vigente';
    $('#designBadge').className = 'pbadge ' + (ui.dirty ? 'warn' : 'ok');
  }

  /* ============================== ARENERAS ============================== */
  function renderAreneras() {
    const st = M.stats;
    $('#arMeta').innerHTML = '<span class="pill">' + st.n + ' loads OMMA</span>' + (st.range ? '<span class="pill">' + fDay(st.range.from) + ' – ' + fDay(st.range.to) + '</span>' : '');
    const cell = (k, v, s) => '<div><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
    const dur = x => x && x.n ? E.fmtDur(x.median) : '—';
    const nTx = x => x && x.n ? 'n=' + x.n + (x.n > 1 ? ' · ' + E.fmtDur(x.min) + '–' + E.fmtDur(x.max) : '') : 'sin dato';
    if (!$('#mineCards').contains(document.activeElement)) $('#mineCards').innerHTML = S.config.mines.map((mi, i) => {
      const ms = st.mines[mi.id] || {};
      const sands = S.config.sands.filter(s => s.mine === mi.id);
      const p0 = M.params[sands[0] ? sands[0].id : ''] || {};
      const ov = (S.config.overrides && S.config.overrides.leadMin && S.config.overrides.leadMin[mi.id]) || '';
      return '<article class="gcard panel mine ' + (i ? 'a-amber' : 'a-lav') + '" style="--i:' + i + '"><div class="hd"><div><div class="nm">' + esc(mi.name) + '</div><div class="pl">' + esc(mi.place) + ' · ' + sands.map(s => esc(s.label)).join(' y ') + '</div></div><span class="mi">' + (mi.miles || ms.miles || '—') + ' mi</span></div>' +
        '<div class="kv">' +
        cell('Payload', ms.payload && ms.payload.n ? fmt.int(ms.payload.mean) + '<small>lb</small>' : '—', ms.payload && ms.payload.n ? 'n=' + ms.payload.n + ' · ' + fmt.int(ms.payload.min) + '–' + fmt.int(ms.payload.max) : 'sin dato') +
        cell('En arenera', dur(ms.term), nTx(ms.term)) +
        cell('Tránsito cargado', dur(ms.transit), nTx(ms.transit)) +
        cell('En locación', dur(ms.dest), nTx(ms.dest)) +
        cell('Asignado → entregado', (p0.leadMin ? E.fmtDur(p0.leadMin) : '—') + (p0.leadSrc ? srcTag(p0.leadSrc) : ''), nTx(ms.lead)) +
        cell('Ciclo por truck', (p0.cycleMin ? E.fmtDur(p0.cycleMin) : '—') + (p0.cycleSrc ? srcTag(p0.cycleSrc) : ''), ms.cycle && ms.cycle.n ? 'n=' + ms.cycle.n + ' vueltas' : 'sin vueltas consecutivas') +
        '</div>' +
        '<div class="nt">' + sands.map(s => { const p = M.params[s.id]; return '<b>' + esc(s.label) + '</b>: payload ' + fmt.int(p.payload) + ' lb ' + srcTag(p.payloadSrc) + ' · ' + nf2.format(p.lptd) + ' loads/truck/día ' + srcTag(p.lptdSrc); }).join('<br>') +
        '<br>Tiempos de loads a <b>' + esc(S.config.job.well) + '</b> (' + (ms.timesScope || '—') + '). Con pocos loads la referencia es débil: sube el archivo completo para afinarla.</div>' +
        '<div class="ov">' + sands.map(s => '<label class="fld"><span>Payload manual ' + esc(s.label) + ' <em>lb</em></span><input type="number" data-ovp="' + s.id + '" value="' + ((S.config.overrides && S.config.overrides.payload && S.config.overrides.payload[s.id]) || '') + '" placeholder="' + fmt.int(M.params[s.id].payload) + '" step="100" min="0"></label>').join('') +
        '<label class="fld"><span>Lead manual <em>min</em></span><input type="number" data-ovl="' + mi.id + '" value="' + ov + '" placeholder="' + Math.round(p0.leadMin || 0) + '" step="5" min="0"></label>' +
        '<button type="button" class="btn sm" data-ovsave="' + mi.id + '">Aplicar</button></div>' +
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
      const term = ms.term && ms.term.n ? ms.term.median : 0;
      const tr = ms.transit && ms.transit.n ? ms.transit.median : 0;
      const de = ms.dest && ms.dest.n ? ms.dest.median : 0;
      return { term, tr, de, rest: Math.max(0, cyc - term - tr - de), cyc, hasTerm: !!(ms.term && ms.term.n), src: p.cycleSrc };
    });
    const labels = mines.map(m => m.name);
    const on = mines.map(mi => S.config.sands.filter(s => s.mine === mi.id).some(s => sandOn(s.id)));
    const col = (hex, i) => on[i] ? hex : oA(hex, .3);
    chart('ar_cycle', {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'En arenera', data: seg.map(x => x.term / 60), backgroundColor: dim(mines.map((m, i) => col('#6BAED6', i))), borderRadius: 4, stack: 'c' },
        { label: 'Tránsito cargado', data: seg.map(x => x.tr / 60), backgroundColor: dim(mines.map((m, i) => col('#1E6B7A', i))), borderRadius: 4, stack: 'c' },
        { label: 'En locación', data: seg.map(x => x.de / 60), backgroundColor: dim(mines.map((m, i) => col('#F4B860', i))), borderRadius: 4, stack: 'c' },
        { label: 'Regreso + espera', data: seg.map(x => x.rest / 60), backgroundColor: dim(mines.map((m, i) => col('#C8D0DA', i))), borderRadius: 4, stack: 'c' }
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
              const out = ['Ciclo total: ' + E.fmtDur(x.cyc) + ' (' + x.src + ') · ' + nf2.format(x.cyc ? 1440 / x.cyc : 0) + ' vueltas/día'];
              if (!x.hasTerm) out.push('Sin tiempo en arenera en el export: queda dentro de "regreso + espera"');
              out.push('clic filtra por arenera →');
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
    legend('ar_cycle', [{ label: 'En arenera', color: '#6BAED6' }, { label: 'Tránsito cargado', color: '#1E6B7A' }, { label: 'En locación', color: '#F4B860' }, { label: 'Regreso + espera', color: '#C8D0DA' }]);
    chartNote('ar_cycle', { read: 'La vuelta de <b>' + esc(mines[0].name) + '</b> dura ' + E.fmtDur(seg[0].cyc) + (mines[1] ? ' y la de <b>' + esc(mines[1].name) + '</b> ' + E.fmtDur(seg[1].cyc) : '') + ': por eso un truck de Iron Oak hace menos loads al día.', kind: 'filter', act: 'clic filtra por arenera →' });
  }
  function renderScatter() {
    const L = (S.omma.loads || []).filter(l => l.a && l.d && l.d > l.a && sandOn(l.s));
    const byMine = S.config.mines.map(mi => ({ mi, pts: L.filter(l => l.m === mi.id).map(l => ({ x: (l.d - l.a) / HOUR, y: l.w, _l: l })) }));
    $('#scBadge').textContent = L.length + ' loads';
    const payloadRef = byMine.map(b => b.pts.length ? b.pts.reduce((p, q) => p + q.y, 0) / b.pts.length : null);
    chart('ar_scatter', {
      type: 'scatter',
      data: { datasets: byMine.map((b, i) => ({ label: b.mi.name, data: b.pts, backgroundColor: oA(MINE_COLOR[b.mi.id] || '#1E6B7A', .8), borderColor: MINE_COLOR[b.mi.id] || '#1E6B7A', borderWidth: 1.5, pointRadius: 7, pointHoverRadius: 10 })) },
      options: {
        interaction: { mode: 'nearest', intersect: false },
        scales: { x: Object.assign({}, gX, { type: 'linear', title: { display: true, text: 'Horas de asignado a entregado', color: OMMA.mut, font: { size: 10 } }, ticks: Object.assign({}, gX.ticks, { callback: v => nf1.format(v) + ' h' }) }),
          y: Object.assign(gYf(v => fmt.numK(v)), { beginAtZero: false, title: { display: true, text: 'Payload (lb)', color: OMMA.mut, font: { size: 10 } } }) },
        plugins: {
          tooltip: tt3({
            title: it => { const l = it[0].raw._l; return 'Load #' + l.n + ' · ' + sandLabel(l.s); },
            label: c => ' ' + c.dataset.label + ': ' + fmt.int(c.raw.y) + ' lb · ' + E.fmtDur(c.raw.x * 60),
            rows: (i, items) => {
              const l = items[0].raw._l;
              const ref = payloadRef[items[0].datasetIndex];
              return ['Tránsito ' + E.fmtDur(l.tx) + ' · en locación ' + E.fmtDur(l.td), ref ? 'vs payload medio: ' + (l.w >= ref ? '+' : '−') + fmt.int(Math.abs(l.w - ref)) + ' lb' : '', 'clic abre el detalle →'].filter(Boolean);
            }
          })
        },
        onClick: (e, els, c) => {
          if (!els || !els.length) return;
          const l = c.data.datasets[els[0].datasetIndex].data[els[0].index]._l;
          showDetail(e.native || e, 'Load #' + l.n + ' · ' + sandLabel(l.s), [
            ['Arenera', esc(mineOf(l.m).name)], ['Peso neto', fmt.int(l.w) + ' lb'], ['Aceptado', fDT(l.a)], ['Entregado', fDT(l.d)],
            ['Asignado → entregado', E.fmtDur((l.d - l.a) / MIN)], ['En arenera', E.fmtDur(l.tm)], ['Tránsito', E.fmtDur(l.tx)], ['En locación', E.fmtDur(l.td)],
            ['Truck', esc(l.tr || '—')], ['Pozo', esc(l.wl || '—')]]);
        }
      }
    });
    legend('ar_scatter', byMine.map(b => ({ label: b.mi.name, color: MINE_COLOR[b.mi.id] || '#1E6B7A' })));
    chartNote('ar_scatter', { read: L.length < 6 ? 'Con <b>' + L.length + ' loads</b> la dispersión todavía no es concluyente: sube el export completo de OMMA.' : 'Los puntos a la derecha son loads que tardaron más en llegar; revisa si fue espera en arenera o en locación.', kind: 'detail' });
  }
  function renderUploadPanel() {
    const meta = S.omma && S.omma.meta;
    $('#upBadge').textContent = (S.omma.loads || []).length + ' loads';
    const icon = $('.drop-ic'); if (icon && !icon.innerHTML) icon.innerHTML = sv(IC.upload, 20);
    if (ui.upload) return;   // hay un archivo en vista previa
    $('#upPrev').innerHTML = '<div class="ttl">Datos actuales</div>' +
      '<div class="kv"><div><div class="k">Loads</div><div class="v">' + (S.omma.loads || []).length + '</div></div><div><div class="k">Cuentan en el pozo</div><div class="v">' + M.jobLoads.length + (M.wellLoads.length > M.jobLoads.length ? '<small> / ' + M.wellLoads.length + '</small>' : '') + '</div></div>' +
      '<div><div class="k">Desde</div><div class="v" style="font-size:12px">' + (M.stats.range ? fDT(M.stats.range.from) : '—') + '</div></div><div><div class="k">Hasta</div><div class="v" style="font-size:12px">' + (M.stats.range ? fDT(M.stats.range.to) : '—') + '</div></div></div>' +
      '<p style="margin:0 0 10px;color:var(--mut)">' + (meta ? 'Último archivo: <b>' + esc(meta.file || '—') + '</b>' + (meta.at ? ' · ' + fDT(meta.at) : '') + (meta.by ? ' · ' + esc(meta.by) : '') : 'Sin archivo cargado.') + ' Al subir uno nuevo se recalculan payload, tiempos, entregados y la cola.' +
      (M.countFrom ? ' Cuentan como arena del pozo las entregas desde <b>' + fDT(M.countFrom) + '</b>; las anteriores sólo alimentan tiempos y payload (se cambia en Plan).' : '') + '</p>' +
      '<div class="acts"><button type="button" class="btn sm danger" id="ommaClear"' + ((S.omma.loads || []).length ? '' : ' disabled') + '>Borrar datos OMMA</button></div>';
  }
  async function handleFile(file) {
    if (!file) return;
    $('#upPrev').innerHTML = '<div class="ttl">Leyendo ' + esc(file.name) + '…</div><div class="sk" style="height:90px"></div>';
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
        '<div class="kv"><div><div class="k">Filas</div><div class="v">' + r.rows + '</div></div><div><div class="k">Loads OMMA</div><div class="v">' + r.kept + '</div></div><div><div class="k">A este pozo</div><div class="v">' + jobN + (jobC < jobN ? '<small> · ' + jobC + ' cuentan</small>' : '') + '</div></div><div><div class="k">Descartadas</div><div class="v">' + (r.rows - r.kept) + '</div></div></div>' +
        (r.missing.length ? '<ul class="issues"><li>Columnas no encontradas: ' + esc(r.missing.join(', ')) + '</li></ul>' : '') +
        '<ul>' + (r.from ? '<li>Entregas del ' + fDT(r.from) + ' al ' + fDT(r.to) + '</li>' : '') +
        '<li>Pozos: ' + (wells.length ? wells.slice(0, 4).map(w => esc(w[0]) + ' (' + w[1] + ')').join(' · ') : '—') + '</li>' +
        '<li>Arenas: ' + Object.entries(loads.reduce((o, l) => { o[l.s] = (o[l.s] || 0) + 1; return o; }, {})).map(([s, n]) => esc(sandLabel(s)) + ' ' + n).join(' · ') + '</li>' +
        (Object.keys(r.skipped).length ? '<li>Descartadas: ' + Object.entries(r.skipped).map(([k, v]) => esc(k) + ' ' + v).join(' · ') + '</li>' : '') +
        (r.dup ? '<li>Duplicados en el archivo: ' + r.dup + '</li>' : '') + '</ul>' +
        '<div class="acts"><div class="seg sm" id="upMode"><button type="button" class="on" data-m="merge">Agregar a lo existente</button><button type="button" data-m="replace">Reemplazar todo</button></div>' +
        '<button type="button" class="btn primary sm" id="upApply"' + (loads.length ? '' : ' disabled') + '>Aplicar y recalcular</button><button type="button" class="btn sm ghost" id="upCancel">Cancelar</button></div>';
    } catch (e) {
      ui.upload = null;
      $('#upPrev').innerHTML = '<ul class="issues"><li>No se pudo leer el archivo: ' + esc(e.message) + '</li></ul>';
    }
  }
  function renderLoadsTable() {
    const L = M.wellLoads.filter(l => sandOn(l.s)).slice().sort((a, b) => (b.d || b.a) - (a.d || a.a)).slice(0, 300);
    const counts = l => !M.countFrom || (l.d || l.a) >= M.countFrom;
    const nPrev = M.wellLoads.length - M.jobLoads.length;
    $('#loadsBadge').textContent = M.jobLoads.length + ' cuentan' + (nPrev ? ' · ' + nPrev + ' previos' : '');
    $('#loadsTable').innerHTML = '<thead><tr><th>Load</th><th>Arena</th><th>Arenera</th><th style="text-align:right">Peso</th><th>Aceptado</th><th>Entregado</th><th style="text-align:right">Asig → entr.</th><th style="text-align:right">Tránsito</th><th style="text-align:right">En locación</th><th>Truck</th><th>Cuenta</th></tr></thead><tbody>' +
      (L.length ? L.map(l => '<tr' + (counts(l) ? '' : ' class="prev"') + '><td class="m">#' + esc(l.n) + '</td><td>' + slotChip({ s: l.s, k: 0 }).replace(' · 000', '') + '</td><td>' + esc(mineOf(l.m).name || l.t) + '</td><td class="n">' + fmt.int(l.w) + '</td><td class="m">' + fDT(l.a) + '</td><td class="m">' + fDT(l.d) + '</td>' +
        '<td class="n">' + (l.a && l.d ? E.fmtDur((l.d - l.a) / MIN) : '—') + '</td><td class="n">' + E.fmtDur(l.tx) + '</td><td class="n">' + E.fmtDur(l.td) + '</td><td class="m">' + esc(l.tr || '—') + '</td>' +
        '<td>' + (counts(l) ? '<span class="st del">arena del pozo</span>' : '<span class="st extra" title="Entregado antes del corte (' + esc(fDT(M.countFrom)) + '): se usa para tiempos y payload">antes del corte</span>') + '</td></tr>').join('')
        : '<tr><td colspan="11"><div class="empty">Sin loads OMMA de este pozo.</div></td></tr>') + '</tbody>';
  }

  /* ============================== navegación ============================== */
  let RENDERED = {};
  function go(view) {
    if (!VIEWS.find(v => v.key === view)) view = 'centro';
    const prev = ui.view;
    const iPrev = VIEWS.findIndex(v => v.key === prev), iNew = VIEWS.findIndex(v => v.key === view);
    if (prev !== view) {
      const pv = VIEWS[iPrev];
      if (pv) destroyPage(pv.prefix);
      clearAllFloats(); hideDetail();
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
    requestAnimationFrame(() => { resizeVisibleCharts(); settleVisibleCharts(); });
    if (prev !== view) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }
  function renderView() {
    try {
      ({ centro: renderCentro, asignar: renderAsignar, avance: renderAvance, plan: renderPlan, areneras: renderAreneras })[ui.view]();
    } catch (e) {
      console.error('[render]', ui.view, e);
      const sec = $('#v-' + ui.view);
      if (sec && !sec.querySelector('.retry-note')) sec.insertAdjacentHTML('afterbegin', '<div class="retry-note">Esta vista falló al dibujarse (' + esc(e.message) + '). <a data-retry="1">Reintentar</a></div>');
    }
  }
  function renderAll() {
    if (!S) return;
    rebuild();
    renderShell();
    renderView();
    document.body.classList.remove('booting');
  }
  const renderSoon = deferRender(renderAll);

  /* ============================== eventos ============================== */
  function wire() {
    onFilterChange(renderSoon);
    document.addEventListener('click', e => {
      const t = e.target;
      const lg = t.closest('[data-lg]'); if (lg) { toggleLayer(lg); return; }
      const nv = t.closest('[data-view]'); if (nv) { go(nv.dataset.view); return; }
      const gd = t.closest('[data-go]'); if (gd) { go(gd.dataset.go); return; }
      const u = t.closest('#unitSeg button'); if (u) { ui.unit = u.dataset.u; saveUI(); renderSoon(); return; }
      const cb = t.closest('.cbtn[data-c]'); if (cb) { ui.carrier = cb.dataset.c; saveUI(); renderSoon(); return; }
      const as = t.closest('[data-assign]'); if (as) { assign(as.dataset.assign); return; }
      const an = t.closest('[data-assign-next]');
      if (an) {
        e.stopPropagation();
        const s = an.dataset.assignNext;
        const nx = M.sands[s].slots.filter(x => x.needed && !x.asg).sort((a, b) => a.ab - b.ab)[0];
        if (nx) assign(nx.id);
        return;
      }
      const sc = t.closest('.sand[data-sand]'); if (sc && !t.closest('button')) { crossFilter('sand', sc.dataset.sand); return; }
      const tk = t.closest('[data-tick]');
      if (tk) { const id = tk.dataset.tick; if (S.asg[id]) unassign(id); else assign(id); return; }
      const st = t.closest('#asStatus .chip'); if (st) { ui.asStatus = st.dataset.st; ui.asLimit = 80; renderSoon(); return; }
      const cl = t.closest('[data-clear]'); if (cl) { if (cl.dataset.clear === 'hour') ui.asHour = null; else ui.asDay = null; renderSoon(); return; }
      if (t.closest('#asMore')) { ui.asLimit += 120; renderAsList(); return; }
      const gr = t.closest('#gapRange button'); if (gr) { ui.gapRange = gr.dataset.r; saveUI(); renderSoon(); return; }
      const bs = t.closest('#basisSeg button'); if (bs) { ui.basis = bs.dataset.b; saveUI(); renderSoon(); return; }
      const sp = t.closest('#segPick button'); if (sp) { ui.segPick = +sp.dataset.seg; ui.segPickSet = true; renderSoon(); return; }
      const rd = t.closest('[data-rdel]');
      if (rd) { withMe(() => { Store.dispatch({ type: 'stageDel', rid: rd.dataset.rdel }); toast('Reporte borrado'); }); return; }
      const rc = t.closest('[data-recon]');
      if (rc) {
        const s = rc.dataset.recon;
        const items = M.sands[s].omma.reconcile.map(r => ({ slot: r.slot, c: r.c, t: new Date(r.t).toISOString() }));
        withMe(() => { Store.dispatch({ type: 'bulk', items, txt: 'conciliación ' + sandLabel(s) }); toast('Palomeados <b>' + items.length + '</b> loads ' + esc(sandLabel(s)) + ' como ' + esc(carrierName(M.trackedId))); });
        return;
      }
      const cr = t.closest('.dnrow[data-cname]'); if (cr) { crossFilter('carrier', cr.dataset.cname); return; }
      if (t.closest('#segAdd')) {
        const segs = ui.draft.segments;
        const last = segs[segs.length - 1];
        segs.push({ from: (last ? +last.to : 0) + 1, to: +ui.draft.job.totalStages, pace: last ? last.pace : 19, lbs: Seed.clone(last ? last.lbs : {}), trucks: Seed.clone(last ? (last.trucks || {}) : {}) });
        ui.dirty = true; renderDesignForm(); return;
      }
      const sd = t.closest('[data-segdel]'); if (sd) { ui.draft.segments.splice(+sd.dataset.segdel, 1); ui.dirty = true; renderDesignForm(); return; }
      if (t.closest('#dSave')) { saveDesign(); return; }
      if (t.closest('#dDiscard')) { ui.dirty = false; ui.draft = null; renderSoon(); return; }
      if (t.closest('#dDefault')) { ui.draft = Seed.clone(Seed.DEFAULT_CONFIG); ui.draft.carriers = Seed.clone(S.config.carriers); ui.dirty = true; renderDesignForm(); toast('Diseño original cargado en el editor · falta guardar'); return; }
      if (t.closest('#dReset')) { confirmReset(); return; }
      const ovs = t.closest('[data-ovsave]'); if (ovs) { saveOverrides(ovs.dataset.ovsave); return; }
      if (t.closest('#ommaClear')) {
        modal('Borrar loads OMMA', '<p>Se quitan los ' + (S.omma.loads || []).length + ' loads cargados para todo despacho. Payload y tiempos vuelven a supuestos hasta subir otro archivo.</p>',
          [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Borrar', cls: 'danger', fn: () => withMe(() => Store.dispatch({ type: 'ommaClear' })) }]);
        return;
      }
      const um = t.closest('#upMode button'); if (um) { $$('#upMode button').forEach(b => b.classList.toggle('on', b === um)); return; }
      if (t.closest('#upCancel')) { ui.upload = null; renderSoon(); return; }
      if (t.closest('#upApply')) {
        const up = ui.upload; if (!up) return;
        const mode = ($('#upMode button.on') || {}).dataset ? $('#upMode button.on').dataset.m : 'merge';
        withMe(() => {
          Store.dispatch({ type: 'omma', loads: up.loads, mode, meta: { file: up.file, rows: up.report.rows, format: up.format } });
          ui.upload = null;
          toast('Cargados <b>' + up.loads.length + '</b> loads OMMA · cola recalculada');
        });
        return;
      }
      if (t.closest('#sync')) { syncInfo(); return; }
      if (t.closest('#dcClose')) { hideDetail(); return; }
      if (t.closest('[data-retry]')) { const n = t.closest('.retry-note'); if (n) n.remove(); renderSoon(); return; }
    });
    document.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-lg]')) { e.preventDefault(); toggleLayer(e.target); }
    });
    document.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-csel]')) { setCarrier(t.dataset.csel, t.value); return; }
      if (t.matches('#fileIn')) { handleFile(t.files[0]); t.value = ''; return; }
    });
    document.addEventListener('focusout', e => {
      if (e.target.matches && e.target.matches('#asList select') && ui.pendingList) setTimeout(() => { if (!document.activeElement || !document.activeElement.closest('#asList select')) renderAsList(); }, 50);
    });
    document.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'asQuery') { ui.asQuery = t.value; ui.asLimit = 80; renderAsList(); return; }
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
      const r = e.target.closest('.dnrow'); const ch = CHZ.ce_car; if (!r || !ch) return;
      try { ch.setActiveElements([{ datasetIndex: 0, index: +r.dataset.ci }]); ch.update('none'); } catch (_) {}
    });
    $('#carList').addEventListener('mouseleave', () => { const ch = CHZ.ce_car; if (ch) try { ch.setActiveElements([]); ch.update('none'); } catch (_) {} });
    $('#repForm').addEventListener('submit', e => {
      e.preventDefault();
      const n = Math.round(+$('#repN').value);
      const at = E.parseWall($('#repT').value, tz());
      if (!(n >= 0 && n <= M.N) || at == null) { toast('Revisa la etapa y la hora'); return; }
      withMe(() => {
        Store.dispatch({ type: 'stage', n, at: new Date(at).toISOString() });
        delete $('#repN').dataset.touched; delete $('#repT').dataset.touched;
        toast('Etapa <b>' + n + '</b> registrada · la cola se re-ancló');
      });
    });
    const drop = $('#drop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f); });
    window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (h && h !== ui.view) go(h); });
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resizeVisibleCharts(); if (spiral) { spiral.resize(); spiral.draw(); } }, 120); });
  }
  function saveDesign() {
    const d = Seed.clone(ui.draft);
    d.segments = d.segments.map(g => ({ from: +g.from, to: +g.to, pace: +g.pace, lbs: g.lbs || {}, trucks: Object.fromEntries(Object.entries(g.trucks || {}).filter(([k, v]) => v != null && v !== '')) }));
    d.job.totalStages = Math.round(+d.job.totalStages);
    d.countFrom = d.countFrom || null;
    const diff = [];
    const c0 = S.config;
    if ((c0.countFrom || null) !== d.countFrom) diff.push('corte de entregas ' + (d.countFrom ? d.countFrom.replace('T', ' ') : 'todas'));
    if (c0.job.totalStages !== d.job.totalStages) diff.push('etapas ' + c0.job.totalStages + '→' + d.job.totalStages);
    if (JSON.stringify(c0.segments) !== JSON.stringify(d.segments)) diff.push('tramos');
    if (c0.schedule.fracStart !== d.schedule.fracStart) diff.push('frac ' + d.schedule.fracStart.replace('T', ' '));
    if (c0.schedule.prefillStart !== d.schedule.prefillStart) diff.push('prefill ' + d.schedule.prefillStart.replace('T', ' '));
    if (JSON.stringify(c0.prefill) !== JSON.stringify(d.prefill)) diff.push('prefill loads');
    if (JSON.stringify(c0.carriers) !== JSON.stringify(d.carriers)) diff.push('carriers');
    withMe(() => {
      Store.dispatch({ type: 'cfg', config: d, txt: diff.join(' · ') || 'parámetros' });
      ui.dirty = false; ui.draft = null;
      toast('Diseño guardado para todo despacho · cola recalculada');
    });
  }
  function saveOverrides(mineId) {
    const cfg = Seed.clone(S.config);
    cfg.overrides = cfg.overrides || { payload: {}, leadMin: {} };
    cfg.overrides.payload = cfg.overrides.payload || {}; cfg.overrides.leadMin = cfg.overrides.leadMin || {};
    $$('[data-ovp]').forEach(i => { const s = i.dataset.ovp; if (S.config.sands.find(x => x.id === s && x.mine === mineId)) { if (i.value === '') delete cfg.overrides.payload[s]; else cfg.overrides.payload[s] = +i.value; } });
    const l = $('[data-ovl="' + mineId + '"]');
    if (l) { if (l.value === '') delete cfg.overrides.leadMin[mineId]; else cfg.overrides.leadMin[mineId] = +l.value; }
    withMe(() => { Store.dispatch({ type: 'cfg', config: cfg, txt: 'valores manuales ' + mineOf(mineId).name }); toast('Valores de ' + esc(mineOf(mineId).name) + ' aplicados'); });
  }
  function confirmReset() {
    const n = Object.keys(S.asg).length;
    modal('Reiniciar asignaciones', '<p>Se quitan las <b>' + n + '</b> palomitas de todo despacho. Úsalo sólo al arrancar un pozo nuevo. Escribe <b>BORRAR</b> para confirmar.</p><input type="text" id="rstIn" autocomplete="off">',
      [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Reiniciar', cls: 'danger', fn: () => { if (($('#rstIn').value || '').trim().toUpperCase() !== 'BORRAR') return false; withMe(() => { Store.dispatch({ type: 'resetAsg' }); toast('Asignaciones reiniciadas'); }); } }]);
  }
  function syncInfo() {
    const me = Store.me();
    const txt = Store.mode === 'remote' ? 'Sincronizado con la función de Netlify: todo despacho ve las mismas palomitas.' :
      Store.mode === 'offline' ? 'Sin conexión con el servidor. Puedes seguir palomeando: ' + Store.pending.length + ' cambio(s) se enviarán al volver la red.' :
        'Modo local: no se encontró la función /api/state (sitio sin Netlify Functions o abierto como archivo). Lo que palomees se guarda sólo en este equipo.';
    modal('Sincronización', '<p>' + txt + '</p><p>Última sincronización: <b>' + (Store.lastSync ? fDT(Store.lastSync) + ':' + pad(new Date(Store.lastSync).getSeconds()) : '—') + '</b> · versión <b>' + (S.v || 0) + '</b></p>' +
      '<p>Despachando como:</p><input type="text" id="meEdit" maxlength="12" value="' + esc(me || '') + '" placeholder="Tus iniciales">',
      [{ label: 'Cerrar', cls: 'ghost' }, { label: 'Guardar', cls: 'primary', fn: () => { const v = ($('#meEdit').value || '').trim(); if (v) Store.setMe(v.toUpperCase()); Store.poll(true); } }]);
  }

  /* ============================== relojes ============================== */
  function tick() {
    const now = Date.now();
    const p = wp(now);
    const off = -E.tzOffset(now, tz()) / HOUR;
    $('#clock').innerHTML = '<b>' + pad(p.h) + ':' + pad(p.mi) + ':' + pad(p.s) + '</b><small>' + WD[wdIdx(p)] + ' ' + p.d + ' ' + MO[p.mo - 1] + ' · UTC' + (off <= 0 ? '+' : '−') + Math.abs(off) + '</small>';
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

  /* ============================== arranque ============================== */
  async function boot() {
    const h = (location.hash || '').replace('#', '');
    if (VIEWS.find(v => v.key === h)) ui.view = h;
    wire();
    $$('.view').forEach(s => s.classList.toggle('active', s.dataset.pane === ui.view));
    Store.subscribe((st, reason) => {
      S = st;
      if (reason === 'mode' && M) { renderSync(); $('#railFoot').textContent = 'v' + (S.v || 0) + ' · ' + Store.mode; return; }
      renderSoon();
    });
    tick();
    setInterval(tick, 1000);
    setInterval(tickCountdowns, 15000);
    setInterval(renderSoon, 60000);      // estados que cambian con la hora (vencidos, ventana)
    startChartWatchdog(() => { RENDERED = {}; renderSoon(); });
    await Store.init();
    window.__app = { get model() { return M; }, get state() { return S; }, ui, go, renderAll, Store };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
