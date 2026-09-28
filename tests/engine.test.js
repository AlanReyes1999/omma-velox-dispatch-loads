/* Pruebas del motor de cálculo. Correr: npm test */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/assets/js/engine.js');
const S = require('../public/assets/js/seed.js');

const TZ = 'America/Mexico_City';
const at = s => Date.parse(s);              // ISO con zona
const NOW = at('2026-09-28T00:30:00-06:00'); // lunes 00:30: prefill terminando, frac a las 06:00
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ` esperado ${b} ± ${tol}, obtenido ${a}`);

function model(mut, now) {
  const st = S.initialState();
  if (mut) mut(st);
  return E.build(st.config, st, now == null ? NOW : now);
}

test('zona horaria: pared ↔ epoch en Ciudad de México (UTC−6 sin horario de verano)', () => {
  const t = E.parseWall('2026-09-29T14:00', TZ);
  assert.equal(t, at('2026-09-29T14:00:00-06:00'));
  assert.equal(E.parseWall('9/27/2026 12:49', TZ), at('2026-09-27T12:49:00-06:00'));
  assert.equal(E.parseWall('9/27/2026 12:49 PM', TZ), at('2026-09-27T12:49:00-06:00'));
  assert.equal(E.parseWall('9/27/2026 12:05 AM', TZ), at('2026-09-27T00:05:00-06:00'));
  assert.equal(E.parseWall('2026-09-27T18:49:00Z', TZ), at('2026-09-27T12:49:00-06:00'));
  assert.equal(E.toWallString(t, TZ), '2026-09-29T14:00');
  // serial de Excel 46292.5 = 2026-09-27 12:00
  assert.equal(E.parseWall(46292.5, TZ), at('2026-09-27T12:00:00-06:00'));
});

test('turnos: la madrugada pertenece a la noche del día operativo anterior', () => {
  const a = E.shiftOf(at('2026-09-30T00:15:00-06:00'), TZ, 6);
  assert.equal(a.key, '2026-09-29|N');
  assert.equal(a.start, at('2026-09-29T18:00:00-06:00'));
  const b = E.shiftOf(at('2026-09-29T14:00:00-06:00'), TZ, 6);
  assert.equal(b.key, '2026-09-29|D');
});

test('normalización de producto, arenera y duración', () => {
  assert.equal(E.normProduct('100 100 Mesh Frac Sand'), '100M');
  assert.equal(E.normProduct('100 Mesh Frac Sand'), '100M');
  assert.equal(E.normProduct('2040'), '2040');
  assert.equal(E.normProduct('20/40'), '2040');
  assert.equal(E.normProduct('40/70 White'), '4070');
  assert.equal(E.normProduct('30/50 Northern White'), '3050');
  assert.equal(E.normProduct(''), null);
  const mines = S.DEFAULT_CONFIG.mines;
  assert.equal(E.normMine('Iron Oak Energy - Kermit 115 Plant', mines), 'IRONOAK');
  assert.equal(E.normMine('Ironhorse Permian Basin - Artesia', mines), 'IRONHORSE');
  assert.equal(E.normMine('Somewhere Else', mines), null);
  assert.equal(E.parseDuration('3h 06m'), 186);
  assert.equal(E.parseDuration('39m'), 39);
  assert.equal(E.parseDuration('1d 2h'), 1560);
  assert.equal(E.parseDuration('2:30'), 150);
  assert.equal(E.parseDuration(''), null);
});

test('diseño: totales de lbs y loads por arena', () => {
  const M = model();
  assert.equal(M.tb.R['100M'], 7050000);
  assert.equal(M.tb.R['4070'], 12675000);
  assert.equal(M.tb.R['2040'], 4830000);
  assert.equal(M.kpi.reqLbs, 24555000);
  assert.equal(M.sands['100M'].nNeeded, 142);   // 7,050,000 ÷ 49,870 = 141.37 → 142
  assert.equal(M.sands['4070'].nNeeded, 255);   // 12,675,000 ÷ 49,870 = 254.16 → 255
  assert.equal(M.sands['2040'].nNeeded, 95);    // 4,830,000 ÷ 51,350 = 94.06 → 95
  assert.equal(M.kpi.reqLoads, 492);
  assert.equal(M.warnings.filter(w => w.lvl === 'err').length, 0);
});

test('referencias del extracto: payload, lead y ciclo por arenera', () => {
  const M = model();
  assert.equal(M.params['100M'].payload, 49870);
  assert.equal(M.params['2040'].payload, 51350);
  assert.equal(M.params['4070'].payload, 49870);            // sin dato propio → promedio de Iron Oak
  assert.equal(M.params['4070'].payloadSrc, 'arenera');
  assert.equal(M.params['100M'].leadMin, 441);              // mediana de 526 y 356
  assert.equal(M.params['2040'].leadMin, 345);              // mediana de 348 y 342
  assert.equal(M.stats.mines.IRONOAK.cycle.median, 571);    // COM140: entrega 02:40 → siguiente entrega 12:11
  assert.equal(M.stats.mines.IRONOAK.transit.median, 192.5);
  assert.equal(M.stats.mines.IRONHORSE.term.median, 33);
  assert.equal(M.params['100M'].lptd, 2);                   // del plan: 14 trucks → 28 loads/día
  near(M.params['2040'].lptd, 1440 / 345, 1e-9);            // estimado con el lead de IronHorse
});

test('plan por tramo: loads/día, trucks y ritmo sostenible', () => {
  const M = model();
  const s2 = M.segPlans[1];
  near(s2.per['100M'].loadsPerDay, 34.289, 0.001);
  near(s2.per['4070'].loadsPerDay, 64.387, 0.001);
  near(s2.per['2040'].loadsPerDay, 7.400, 0.001);
  near(s2.per['100M'].trucksNeeded, 17.14, 0.01);
  near(s2.per['4070'].trucksNeeded, 32.19, 0.01);
  near(s2.sustainPace, 15.34, 0.01);                        // 52 loads/día × 49,870 ÷ 169,000
  assert.equal(s2.limiting, '4070');
  const s1 = M.segPlans[0];
  near(s1.per['2040'].loadsPerDay, 41.071, 0.001);
  assert.equal(s1.per['2040'].trucksPlanned, null);         // el diseño no trae trucks para 1–30
  assert.equal(s1.sustainPace, null);
});

test('prefill: 30 × 20/40 y 6 × 100M repartidos entre inicio y fin del prefill', () => {
  const M = model(st => { st.asg = {}; });
  const pf20 = M.sands['2040'].slots.filter(x => x.prefill);
  const pf100 = M.sands['100M'].slots.filter(x => x.prefill);
  assert.equal(pf20.length, 30);
  assert.equal(pf100.length, 6);
  assert.equal(M.sands['4070'].slots.filter(x => x.prefill).length, 0);
  const PS = at('2026-09-23T00:00:00-06:00'), PE = at('2026-09-28T03:00:00-06:00'), FS = at('2026-09-28T06:00:00-06:00');
  assert.equal(pf20[0].ab, PS);
  assert.equal(pf100[0].ab, PS);
  pf20.forEach(x => { assert.equal(x.nb, FS); assert.ok(x.ab < PE); });
  near(pf100[1].ab - pf100[0].ab, (PE - PS) / 6, 1);       // ventana 23 sep 00:00 → 28 sep 03:00
  near(pf20[1].ab - pf20[0].ab, (PE - PS) / 30, 1);
  const noEnd = model(st => { st.asg = {}; delete st.config.schedule.prefillEnd; });   // sin fin: inicio de frac − lead
  const q = noEnd.sands['2040'].slots.filter(x => x.prefill);
  near(q[29].ab - q[0].ab, 29 / 30 * (FS - 345 * 60e3 - PS), 1);
});

test('40/70 arranca en la etapa 31 con 2 etapas de colchón', () => {
  const M = model();
  const first = M.sands['4070'].slots[0];
  assert.equal(first.pos, 30);
  assert.equal(first.stage, 31);
  const FS = at('2026-09-28T06:00:00-06:00');
  near(first.nb, FS + 28 / 19 * E.DAY, 1);                  // posición 28 a 19 etapas/día
  assert.equal(first.ab, first.nb - 441 * 60e3);
});

test('punto de partida: 37 asignados, cola numerada y arena acumulada en locación', () => {
  const M = model(null, at('2026-09-28T01:00:00-06:00'));
  assert.equal(M.kpi.asgNeeded, 37);
  assert.equal(M.sands['2040'].nAssignedNeeded, 30);
  assert.equal(M.sands['100M'].nAssignedNeeded, 6);
  assert.equal(M.sands['4070'].nAssignedNeeded, 1);
  const needed = M.slots.filter(x => x.needed);
  assert.deepEqual(needed.map(x => x.seq), needed.map((x, i) => i + 1));   // 1..492 sin huecos, en orden de asignación
  assert.equal(needed[needed.length - 1].seq, 492);
  near(needed[needed.length - 1].cumAll, needed.reduce((p, x) => p + x.w, 0), 1e-6);
  assert.equal(M.kpi.next.id, '2040-031');                  // lo que sigue: 20/40 para la etapa 14
  assert.equal(M.kpi.next.seq, 37);
  assert.equal(M.kpi.next.stage, 14);
  near(M.kpi.cov.asg, 30 * 51350 / 111000, 0.01);          // la arena asignada alcanza a la etapa 13.9 (limita 20/40)
  assert.equal(M.well.phase, 'prefill');
  // la carga de la etapa: cumAfter por arena y alcance después de cada load
  const x = M.slots.find(s => s.id === '2040-031');
  near(x.covAfter, 31 * 51350 / 111000, 0.01);
});

test('PO por arena: el capturado manda; si no, el del export más reciente', () => {
  const base = model(st => { st.omma.loads.forEach(l => { l.po = l.s === '2040' ? 'PO-A' : 'PO-B'; }); });
  assert.equal(base.sands['2040'].po, 'PO-A');
  assert.equal(base.sands['2040'].poSrc, 'export');
  assert.equal(base.sands['4070'].po, '');
  assert.equal(base.slots.find(x => x.id === '2040-031').po, 'PO-A');
  const man = model(st => { st.config.po = { '100M': '', '4070': 'PO-4070', '2040': 'PO-X' }; st.omma.loads.forEach(l => { l.po = 'PO-A'; }); });
  assert.equal(man.sands['2040'].po, 'PO-X');
  assert.equal(man.sands['2040'].poSrc, 'manual');
  assert.equal(man.sands['4070'].po, 'PO-4070');
});

test('cobertura de etapas: 40/70 sin loads cubre hasta la 30', () => {
  const tb = E.stageTable(S.DEFAULT_CONFIG);
  assert.equal(E.posOf(tb.prefix['4070'], tb.N, 0), 30);
  assert.equal(E.posOf(tb.prefix['2040'], tb.N, 111000), 1);
  near(E.posOf(tb.prefix['2040'], tb.N, 30 * 51350), 13.878, 0.001);
  near(E.posOf(tb.prefix['100M'], tb.N, 6 * 49870), 29.922, 0.001);
  assert.equal(E.posOf(tb.prefix['100M'], tb.N, 9e9), 105);
  const M = model(st => { st.config.countFrom = null; });  // sin corte: cuentan las 4 entregas del extracto
  near(M.kpi.cov.omma, 102700 / 111000, 1e-9);               // 2 loads 20/40 OMMA = 0.93 etapas
});

test('corte de entregas: cuentan desde el inicio del prefill; lo anterior sólo alimenta tiempos', () => {
  const M = model();                                         // corte por defecto: 23 sep 00:00 (inicio del prefill)
  assert.equal(M.countFrom, at('2026-09-23T00:00:00-06:00'));
  assert.equal(M.wellLoads.length, 4);
  assert.equal(M.jobLoads.length, 4);                        // los 4 del extracto son parte del prefill
  const late = model(st => { st.config.countFrom = '2026-09-26T00:00'; });
  assert.equal(late.jobLoads.length, 2);                     // sólo los 2 de 20/40 del 27 sep
  assert.equal(late.params['100M'].payload, 49870);          // el payload sigue saliendo de los 4
  const all = model(st => { st.config.countFrom = ''; });
  assert.equal(all.jobLoads.length, 4);
});

test('estados en la cola: asignado (entregado, en camino, llegó), programado, asignar ya y vencido', () => {
  const t0 = at('2026-09-28T01:00:00-06:00');
  const M = model(null, t0);
  const s = id => M.slots.find(x => x.id === id);
  assert.equal(s('2040-001').status, 'del');                  // entrega OMMA casada con un load sin carrier
  assert.equal(s('100M-002').status, 'del');
  assert.equal(s('2040-030').status, 'eta');                  // asignado 27 sep 22:54, llega ~04:39
  assert.equal(s('2040-031').status, 'next');                 // programado: su hora límite es 28 sep 15:15
  near(s('2040-031').ab, at('2026-09-28T15:15:00-06:00'), 2 * 60e3);
  assert.equal(model(null, at('2026-09-28T14:00:00-06:00')).slots.find(x => x.id === '2040-031').status, 'now');
  const late = model(null, at('2026-09-28T20:00:00-06:00'));
  assert.equal(late.slots.find(x => x.id === '2040-031').status, 'late');
  assert.ok(late.kpi.overdue > 0);
});

test('conciliación OMMA: las entregas se casan con lo asignado sin carrier; gap vs cadencia', () => {
  const M0 = model();
  assert.equal(M0.sands['2040'].omma.matched, 2);
  assert.equal(M0.sands['2040'].omma.reconcile.length, 0);    // ya están palomeados en el prefill
  const M1 = model(st => { st.asg = {}; });
  assert.equal(M1.sands['2040'].omma.reconcile.length, 2);    // sin palomitas: sugiere los 2 primeros
  assert.equal(M1.sands['2040'].omma.reconcile[0].slot, '2040-001');
  const t = at('2026-09-28T16:00:00-06:00');
  const M = model(st => { st.asg['2040-031'] = { c: 'C3', t: at('2026-09-28T14:10:00-06:00') }; }, t);
  const due = M.slots.filter(x => x.needed && x.ab <= t).length;
  assert.equal(M.kpi.dueNow, due);
  assert.equal(M.kpi.gap, 38 - due);
});

test('entregado estimado: OMMA sin registro sólo se estima después del corte del archivo', () => {
  const t = at('2026-09-28T13:00:00-06:00');
  const asg = st => { st.asg['2040-031'] = { c: 'OMMA', t: at('2026-09-28T06:05:00-06:00') }; };   // llega ~11:50
  const M = model(asg, t);                                   // el archivo corta el 27 sep: no puede saberlo
  assert.equal(M.slots.find(x => x.id === '2040-031').status, 'arr');
  const M2 = model(st => {                                   // archivo nuevo con corte 28 sep 12:30 sin esa entrega
    asg(st);
    st.omma.loads.push({ k: 'x|1', n: 'x', s: '100M', m: 'IRONOAK', w: 50000, a: at('2026-09-28T05:00:00-06:00'), d: at('2026-09-28T12:30:00-06:00'), wl: 'Otro pozo', c: 'OMMA' });
  }, t);
  assert.equal(M2.slots.find(x => x.id === '2040-031').status, 'eta');   // en camino / sin registro
  near(M.sands['2040'].estLbs - M2.sands['2040'].estLbs, 51350, 1e-6);   // deja de contarse como entregado
});

test('reporte de etapa real re-ancla el calendario', () => {
  const rep = at('2026-10-01T12:00:00-06:00');
  const M = model(st => { st.stage.push({ id: 'r1', n: 20, t: new Date(rep).toISOString() }); }, rep);
  assert.equal(M.well.anchor.src, 'real');
  assert.equal(M.sc.B[20], rep);
  near(M.sc.T(31) - rep, 11 / 19 * E.DAY, 1);
  assert.equal(M.well.phase, 'frac');
  assert.equal(M.well.curStage, 21);
});

test('serie acumulada: el requerido cierra en el total', () => {
  const M = model();
  const c = E.cumulativeSeries(M, { unit: 'loads' });
  assert.equal(c.req[c.req.length - 1], 492);
  const l = E.cumulativeSeries(M, { unit: 'lbs' });
  const slotLbs = M.slots.filter(x => x.needed).reduce((p, x) => p + x.w, 0);
  assert.equal(l.req[l.req.length - 1], slotLbs);
});

test('tramos con hueco o traslape se reportan', () => {
  const cfg = S.clone(S.DEFAULT_CONFIG);
  cfg.segments[1].from = 35;
  const tb = E.stageTable(cfg);
  assert.ok(tb.issues.some(i => /sin diseño: 31–34/.test(i.txt)));
  cfg.segments[1].from = 25;
  assert.ok(E.stageTable(cfg).issues.some(i => /dos tramos/.test(i.txt)));
});
