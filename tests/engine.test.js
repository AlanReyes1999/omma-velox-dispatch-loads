/* Pruebas del motor de cálculo. Correr: npm test */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/assets/js/engine.js');
const S = require('../public/assets/js/seed.js');

const TZ = 'America/Mexico_City';
const at = s => Date.parse(s);              // ISO con zona
const NOW = at('2026-09-27T23:30:00-06:00'); // domingo por la noche, antes del prefill
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

test('prefill: 30 × 20/40 y 6 × 100M repartidos entre el inicio del prefill y el lead antes del frac', () => {
  const M = model();
  const pf20 = M.sands['2040'].slots.filter(x => x.prefill);
  const pf100 = M.sands['100M'].slots.filter(x => x.prefill);
  assert.equal(pf20.length, 30);
  assert.equal(pf100.length, 6);
  assert.equal(M.sands['4070'].slots.filter(x => x.prefill).length, 0);
  const PS = at('2026-09-29T14:00:00-06:00'), FS = at('2026-09-30T06:00:00-06:00');
  assert.equal(pf20[0].ab, PS);
  assert.equal(pf100[0].ab, PS);
  pf20.forEach(x => { assert.equal(x.nb, FS); assert.ok(x.ab < FS - 345 * 60e3); });
  // 100M: ventana 14:00 → 22:39 (06:00 − 7h21m), 6 loads → uno cada 86.5 min
  near(pf100[1].ab - pf100[0].ab, (FS - 441 * 60e3 - PS) / 6, 1);
});

test('40/70 arranca en la etapa 31 con 2 etapas de colchón', () => {
  const M = model();
  const first = M.sands['4070'].slots[0];
  assert.equal(first.pos, 30);
  assert.equal(first.stage, 31);
  const FS = at('2026-09-30T06:00:00-06:00');
  near(first.nb, FS + 28 / 19 * E.DAY, 1);                  // posición 28 a 19 etapas/día
  assert.equal(first.ab, first.nb - 441 * 60e3);
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

test('corte de entregas: lo previo al prefill es referencia de tiempos, no arena en locación', () => {
  const M = model();                                         // corte por defecto: 29 sep 00:00
  assert.equal(M.countFrom, at('2026-09-29T00:00:00-06:00'));
  assert.equal(M.wellLoads.length, 4);
  assert.equal(M.jobLoads.length, 0);
  assert.equal(M.kpi.cov.omma, 0);
  assert.equal(M.sands['2040'].omma.reconcile.length, 0);
  assert.equal(M.params['2040'].payload, 51350);             // el payload sí sale del extracto
  const all = model(st => { st.config.countFrom = ''; });
  assert.equal(all.jobLoads.length, 4);
});

test('estados: vencido, asignar ya, programado, asignado, en camino, entregado', () => {
  const t0 = at('2026-09-29T15:30:00-06:00');                 // prefill en marcha
  const M = model(st => {
    st.config.countFrom = null;
    st.asg['2040-001'] = { c: 'C2', t: at('2026-09-29T14:05:00-06:00'), by: 'AR' };
    st.asg['2040-002'] = { c: 'OMMA', t: at('2026-09-29T14:20:00-06:00'), by: 'AR' };
  }, t0);
  const s = id => M.slots.find(x => x.id === id);
  assert.equal(s('2040-001').status, 'eta');                  // C2, lead 5h45 aún no se cumple
  assert.equal(s('2040-002').status, 'del');                  // OMMA casado con su entrega real
  assert.equal(s('2040-003').status, 'now');                  // cadencia 14:41, dentro de la ventana de 2 h
  assert.equal(s('100M-005').status, 'next');                 // 19:46
  const late = model(null, at('2026-09-30T05:00:00-06:00'));
  assert.equal(late.slots.find(x => x.id === '100M-001').status, 'late');
  assert.ok(late.kpi.overdue > 0);
});

test('gap vs plan y conciliación OMMA', () => {
  const M0 = model(st => { st.config.countFrom = null; });
  assert.equal(M0.sands['2040'].omma.reconcile.length, 2);    // 2 entregas OMMA sin palomear
  assert.equal(M0.sands['2040'].omma.reconcile[0].slot, '2040-001');
  const t = at('2026-09-29T16:00:00-06:00');
  const M = model(st => { ['2040-001', '2040-002', '100M-001'].forEach(id => { st.asg[id] = { c: 'C3', t: at('2026-09-29T14:10:00-06:00') }; }); }, t);
  const due = M.slots.filter(x => x.needed && x.ab <= t).length;
  assert.equal(M.kpi.dueNow, due);
  assert.equal(M.kpi.gap, 3 - due);
});

test('entregado estimado: OMMA sin registro sólo se estima después del corte del archivo', () => {
  const t = at('2026-09-29T21:00:00-06:00');
  const asg = st => { st.asg['2040-001'] = { c: 'OMMA', t: at('2026-09-29T14:05:00-06:00') };   // llega ~19:50
                      st.asg['2040-002'] = { c: 'C2', t: at('2026-09-29T14:20:00-06:00') }; };
  const M = model(asg, t);                                   // archivo cortado el 27 sep: no puede saberlo
  assert.equal(M.slots.find(x => x.id === '2040-001').status, 'arr');
  near(M.sands['2040'].estLbs, 2 * 51350, 1e-6);
  const M2 = model(st => {                                   // archivo nuevo con corte 29 sep 22:00 sin esa entrega
    asg(st);
    st.omma.loads.push({ k: 'x|1', n: 'x', s: '100M', m: 'IRONOAK', w: 50000, a: at('2026-09-29T15:00:00-06:00'), d: at('2026-09-29T22:00:00-06:00'), wl: 'Otro pozo', c: 'OMMA' });
  }, t);
  assert.equal(M2.slots.find(x => x.id === '2040-001').status, 'eta');   // en camino / sin registro
  near(M2.sands['2040'].estLbs, 51350, 1e-6);                            // sólo el de Carrier 2
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
