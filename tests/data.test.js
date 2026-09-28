/* Pruebas del lector de archivos y del reductor compartido. Correr: npm test */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../public/assets/js/engine.js');
const S = require('../public/assets/js/seed.js');
const P = require('../public/assets/js/parser.js');
const R = require('../public/assets/js/reducer.js');

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'omma-export-sample.xls'), 'utf8');

test('lee el export HTML-.xls, filtra otros carriers y arenas fuera del diseño', () => {
  const rows = P.htmlToRows(fixture);
  assert.equal(rows.length, 7);
  const { loads, report } = P.toLoads(rows, S.DEFAULT_CONFIG, E);
  assert.equal(report.rows, 6);
  assert.equal(loads.length, 4);
  assert.equal(report.skipped['otro carrier'], 1);
  assert.equal(report.skipped['arena fuera del diseño (3050)'], 1);
  assert.deepEqual(report.missing, []);
  // idéntico a la referencia sembrada
  loads.forEach(l => {
    const s = S.SEED_LOADS.find(x => x.k === l.k);
    assert.ok(s, 'load ' + l.k + ' en la semilla');
    Object.keys(s).forEach(k => assert.deepEqual(l[k], s[k], l.k + '.' + k));
  });
  // nunca guarda el nombre del driver
  assert.ok(!JSON.stringify(loads).includes('Driver'));
});

test('CSV con comillas y punto y coma', () => {
  const csv = 'Load #;Product;Terminal;Load Weight;Accepted;Delivered;Well\n' +
    '1;"20/40";"Ironhorse Permian Basin - Artesia";51000;9/28/2026 10:00;9/28/2026 15:30;Riley Horned Frog 5\n' +
    '2;"100 Mesh";"Iron Oak Energy - Kermit 115 Plant";"49,900";9/28/2026 01:00;9/28/2026 08:10;Riley Horned Frog 5\n';
  const rows = P.csvToRows(csv);
  assert.equal(rows.length, 3);
  const { loads } = P.toLoads(rows, S.DEFAULT_CONFIG, E);
  assert.equal(loads.length, 2);
  assert.equal(loads[1].w, 49900);
  assert.equal(loads[1].s, '100M');
  assert.equal(loads[1].m, 'IRONOAK');
});

test('reductor: operaciones idempotentes y validadas', () => {
  const st = S.initialState();
  let r = R.apply(st, [
    { id: 'a', type: 'asg', slot: '2040-001', c: 'OMMA', by: 'AR' },
    { id: 'a', type: 'asg', slot: '2040-001', c: 'C2' },           // repetida: se ignora
    { id: 'b', type: 'asg', slot: '<script>', c: 'OMMA' },         // slot inválido
    { id: 'c', type: 'setc', slot: '2040-001', c: 'C3' },
    { id: 'd', type: 'unasg', slot: '9999-001' },                  // no existe
    { id: 'e', type: 'cfg', config: { bad: true } }                // config inválida
  ]);
  assert.deepEqual(r.applied, ['a', 'c']);
  assert.equal(r.state.asg['2040-001'].c, 'C3');
  assert.ok(st.asg['2040-001'] === undefined, 'no muta la entrada');
  r = R.apply(r.state, [{ id: 'f', type: 'unasg', slot: '2040-001' }, { id: 'g', type: 'stage', n: 12, at: '2026-10-01T10:00:00Z' }]);
  assert.equal(Object.keys(r.state.asg).length, 0);
  assert.equal(r.state.stage.length, 1);
  r = R.apply(r.state, [{ id: 'h', type: 'stageDel', rid: 'g' }]);
  assert.equal(r.state.stage.length, 0);
});

test('reductor: merge de loads OMMA sin duplicar y config válida', () => {
  const st = S.initialState();
  const { loads } = P.toLoads(P.htmlToRows(fixture), S.DEFAULT_CONFIG, E);
  let r = R.apply(st, [{ id: 'm1', type: 'omma', loads, meta: { file: 'x.xls' } }]);
  assert.equal(r.state.omma.loads.length, 4);
  r = R.apply(r.state, [{ id: 'm2', type: 'omma', loads: loads.slice(0, 1), mode: 'replace', meta: {} }]);
  assert.equal(r.state.omma.loads.length, 1);
  const cfg = S.clone(S.DEFAULT_CONFIG); cfg.job.totalStages = 110;
  r = R.apply(r.state, [{ id: 'm3', type: 'cfg', config: cfg, txt: 'etapas 110' }]);
  assert.equal(r.state.config.job.totalStages, 110);
  assert.ok(R.validConfig(S.DEFAULT_CONFIG));
});

test('reductor: init sólo siembra un store vacío', () => {
  const seed = S.initialState();
  let r = R.apply(null, [{ id: 'i1', type: 'init', state: seed }]);
  assert.equal(r.state.config.job.totalStages, 105);
  r = R.apply(r.state, [{ id: 'i2', type: 'asg', slot: '100M-001', c: 'OMMA' }, { id: 'i3', type: 'init', state: S.initialState() }]);
  assert.ok(r.state.asg['100M-001'], 'un init tardío no borra lo asignado');
});
