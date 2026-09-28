/* OMMA · Velox dispatch — lectura del export de loads de OMMA.
   Formatos: el .xls que en realidad es una tabla HTML (así sale del sistema), .xlsx/.xls binario
   (SheetJS, se carga sólo si hace falta) y .csv/.tsv. Nunca guarda el nombre del driver. El PO sí: dice a despacho contra qué orden asignar. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LoadParser = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
  function decode(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isFinite(n) ? String.fromCharCode(n) : m; }
      return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m;
    });
  }
  function stripTags(s) { return decode(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim(); }

  /* Tabla HTML → matriz. Toma la tabla con más filas. */
  function htmlToRows(html) {
    const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [html];
    let best = [];
    tables.forEach(tb => {
      const rows = [];
      (tb.match(/<tr[\s\S]*?<\/tr>/gi) || []).forEach(tr => {
        const cells = [];
        const re = /<t([dh])([^>]*)>([\s\S]*?)<\/t\1>/gi;
        let m;
        while ((m = re.exec(tr))) {
          const span = /colspan\s*=\s*"?(\d+)/i.exec(m[2]);
          cells.push(stripTags(m[3]));
          if (span) for (let i = 1; i < +span[1]; i++) cells.push('');
        }
        if (cells.length) rows.push(cells);
      });
      if (rows.length > best.length) best = rows;
    });
    return best;
  }

  function csvToRows(text) {
    const first = text.split(/\r?\n/, 1)[0] || '';
    const cand = [',', ';', '\t', '|'];
    const sep = cand.map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell.trim()); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell.trim()); cell = '';
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell.trim());
    if (row.some(c => c !== '')) rows.push(row);
    return rows;
  }

  function hnorm(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  const COLS = {
    n: ['load', 'loadno', 'loadnumber', 'loadid', 'loadnum'],
    product: ['product', 'producto', 'sand', 'sandtype', 'material', 'mesh'],
    terminal: ['terminal', 'origin', 'mine', 'loadingfacility', 'pickup', 'arenera', 'plant'],
    miles: ['mileage', 'miles', 'loadedmiles', 'distance', 'millas'],
    carrier: ['carrier', 'company', 'trucking'],
    truck: ['truck', 'trucknumber', 'truckno', 'unit', 'tractor'],
    ticket: ['ticket', 'ticketno', 'ticketnumber', 'bol', 'bolnumber'],
    weight: ['loadweight', 'netweight', 'net', 'netlbs', 'weight', 'lbs', 'peso'],
    term: ['atterminalconsumedtime', 'timeatterminal', 'terminaltime', 'loadtime', 'attimeterminal'],
    transit: ['intransitconsumedtime', 'transittime', 'intransit', 'transit'],
    dest: ['atdestinationconsumedtime', 'timeatdestination', 'destinationtime', 'unloadtime', 'atdestination'],
    acc: ['accepted', 'acceptedat', 'accepteddate', 'acceptedtime', 'assigned', 'dispatched'],
    del: ['delivered', 'deliveredat', 'delivereddate', 'deliveredtime', 'completed', 'completedat'],
    well: ['well', 'wellname', 'destination', 'pad', 'location', 'pozo'],
    po: ['po', 'ponumber', 'pono', 'purchaseorder', 'ordendecompra']
  };
  function mapHeaders(headers) {
    const H = headers.map(hnorm);
    const idx = {};
    const used = new Set();
    Object.keys(COLS).forEach(key => {
      for (const syn of COLS[key]) { const i = H.findIndex((h, j) => !used.has(j) && h === syn); if (i >= 0) { idx[key] = i; used.add(i); return; } }
    });
    Object.keys(COLS).forEach(key => {
      if (idx[key] != null) return;
      for (const syn of COLS[key]) { const i = H.findIndex((h, j) => !used.has(j) && h.startsWith(syn) && syn.length >= 4); if (i >= 0) { idx[key] = i; used.add(i); return; } }
    });
    return idx;
  }
  function headerRowIndex(rows) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const idx = mapHeaders(rows[i]);
      if (idx.product != null && (idx.weight != null || idx.del != null)) return i;
    }
    return 0;
  }
  function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(x) ? x : null;
  }

  /* matriz → loads normalizados + reporte de calidad */
  function toLoads(rows, cfg, E) {
    const tz = cfg.tz || 'America/Mexico_City';
    const hi = headerRowIndex(rows);
    const headers = rows[hi] || [];
    const idx = mapHeaders(headers);
    const trackedNames = (cfg.carriers || []).filter(c => c.tracked).map(c => E.normText(c.name));
    const sandIds = new Set((cfg.sands || []).map(s => s.id));
    const rep = { rows: 0, kept: 0, skipped: {}, wells: {}, products: {}, carriers: {}, mines: {}, from: null, to: null, dup: 0, headers: headers.slice(), mapped: idx, missing: [] };
    ['product', 'weight', 'acc', 'del'].forEach(k => { if (idx[k] == null) rep.missing.push(k); });
    const skip = r => { rep.skipped[r] = (rep.skipped[r] || 0) + 1; };
    const out = [];
    const keys = new Set();
    const get = (r, k) => idx[k] != null ? r[idx[k]] : null;
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => c === '' || c == null)) continue;
      rep.rows++;
      const carrierRaw = get(r, 'carrier');
      const cn = E.normText(carrierRaw);
      if (carrierRaw != null && cn) rep.carriers[carrierRaw] = (rep.carriers[carrierRaw] || 0) + 1;
      if (idx.carrier != null && cn && trackedNames.length && !trackedNames.some(t => cn.includes(t))) { skip('otro carrier'); continue; }
      const prodRaw = get(r, 'product');
      const s = E.normProduct(prodRaw);
      if (prodRaw) rep.products[prodRaw] = (rep.products[prodRaw] || 0) + 1;
      if (!s) { skip('producto no reconocido'); continue; }
      if (!sandIds.has(s)) { skip('arena fuera del diseño (' + s + ')'); continue; }
      const w = num(get(r, 'weight'));
      if (!(w > 1000 && w < 120000)) { skip('sin peso válido'); continue; }
      const a = E.parseWall(get(r, 'acc'), tz);
      const d = E.parseWall(get(r, 'del'), tz);
      if (d == null && a == null) { skip('sin fechas'); continue; }
      const termRaw = get(r, 'terminal') || '';
      const m = E.normMine(termRaw, cfg.mines);
      const wl = String(get(r, 'well') || '').trim();
      const n = String(get(r, 'n') || '').trim();
      const tk = String(get(r, 'ticket') || '').trim();
      const k = n + '|' + (tk || (m || termRaw) + '|' + (a || d));
      if (keys.has(k)) { rep.dup++; continue; }
      keys.add(k);
      if (wl) rep.wells[wl] = (rep.wells[wl] || 0) + 1;
      rep.mines[m || termRaw || '(sin terminal)'] = (rep.mines[m || termRaw || '(sin terminal)'] || 0) + 1;
      const tt = d || a;
      rep.from = rep.from == null ? tt : Math.min(rep.from, tt);
      rep.to = rep.to == null ? tt : Math.max(rep.to, tt);
      out.push({
        k, n, p: String(prodRaw).slice(0, 60), s, m, t: String(termRaw).slice(0, 80),
        mi: num(get(r, 'miles')), tr: String(get(r, 'truck') || '').slice(0, 20), w: Math.round(w),
        tm: E.parseDuration(get(r, 'term')), tx: E.parseDuration(get(r, 'transit')), td: E.parseDuration(get(r, 'dest')),
        a, d, wl: wl.slice(0, 80), c: carrierRaw ? String(carrierRaw).slice(0, 30) : 'OMMA',
        po: String(get(r, 'po') || '').trim().slice(0, 40)
      });
    }
    rep.kept = out.length;
    return { loads: out, report: rep };
  }

  function looksHTML(text) { return /<table[\s>]/i.test(text.slice(0, 20000)); }

  let _xlsxLoading = null;
  function loadSheetJS(src) {
    if (root.XLSX) return Promise.resolve(root.XLSX);
    if (_xlsxLoading) return _xlsxLoading;
    _xlsxLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src || 'assets/js/vendor/xlsx.full.min.js';
      s.onload = () => res(root.XLSX);
      s.onerror = () => { _xlsxLoading = null; rej(new Error('No se pudo cargar el lector de Excel')); };
      document.head.appendChild(s);
    });
    return _xlsxLoading;
  }

  /* archivo del navegador → {rows, format} */
  async function readFile(file) {
    const name = (file.name || '').toLowerCase();
    const buf = await file.arrayBuffer();
    const head = new Uint8Array(buf.slice(0, 8));
    const isZip = head[0] === 0x50 && head[1] === 0x4B;          // xlsx
    const isOle = head[0] === 0xD0 && head[1] === 0xCF;          // xls binario
    if (!isZip && !isOle) {
      let text = new TextDecoder('utf-8').decode(buf);
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      if (looksHTML(text)) return { rows: htmlToRows(text), format: 'tabla HTML (.xls exportado)' };
      if (/\.(csv|tsv|txt)$/.test(name) || text.indexOf('\n') > 0) return { rows: csvToRows(text), format: 'CSV' };
    }
    const X = await loadSheetJS();
    const wb = X.read(buf, { type: 'array', cellDates: false });
    let best = [];
    wb.SheetNames.forEach(n => {
      const rows = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '', dateNF: 'm/d/yyyy h:mm' });
      if (rows.length > best.length) best = rows;
    });
    return { rows: best, format: isZip ? 'Excel (.xlsx)' : 'Excel (.xls)' };
  }

  return { htmlToRows, csvToRows, mapHeaders, toLoads, readFile, looksHTML, stripTags };
});
