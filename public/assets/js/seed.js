/* OMMA · Velox dispatch — configuración inicial del pozo y loads de referencia.
   Todo lo que aquí viene es editable desde la app (pestaña Plan). Los valores marcados
   [SUPUESTO] no venían en el diseño y hay que confirmarlos con el cliente. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Seed = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_CONFIG = {
    schema: 1,
    job: {
      well: 'Riley Horned Frog 5',   // pozo de destino en el extracto de loads OMMA
      client: 'Velox',               // del nombre del repositorio
      totalStages: 105
    },
    tz: 'America/Mexico_City',       // zona de despacho; los horarios del export se leen en esta zona
    shiftStartHour: 6,               // [SUPUESTO] turnos 06:00–18:00 / 18:00–06:00
    schedule: {
      prefillStart: '2026-09-23T00:00',  // el prefill arrancó el 23 sep ([SUPUESTO] 00:00, sin hora)
      prefillEnd: '2026-09-28T03:00',    // terminó 03:00 del 28 sep
      fracStart: '2026-09-28T06:00'      // inicio del pozo (etapa 1) programado 06:00 del 28 sep
    },
    sands: [
      { id: '100M', label: '100 Mesh', mine: 'IRONOAK' },
      { id: '4070', label: '40/70', mine: 'IRONOAK' },
      { id: '2040', label: '20/40', mine: 'IRONHORSE' }
    ],
    mines: [
      { id: 'IRONOAK', name: 'Iron Oak 115', place: 'Kermit, TX', miles: 135,
        match: ['iron oak', 'ironoak', 'kermit'] },
      { id: 'IRONHORSE', name: 'IronHorse', place: 'Artesia, NM', miles: 7,
        match: ['ironhorse', 'iron horse', 'artesia'] }
    ],
    // lbs por etapa. Etapas 31–105 a 19 etapas/día según el diseño;
    // etapas 1–30 no traían ritmo: [SUPUESTO] el mismo 19.
    // trucks: plan de trucks corriendo por arena en ese tramo (el diseño sólo lo da para 31–105).
    segments: [
      { from: 1, to: 30, pace: 19, lbs: { '100M': 10000, '4070': 0, '2040': 111000 }, trucks: {} },
      { from: 31, to: 105, pace: 19, lbs: { '100M': 90000, '4070': 169000, '2040': 20000 },
        trucks: { '100M': 14, '4070': 26, '2040': 2 } }
    ],
    prefill: { '100M': 6, '4070': 0, '2040': 30 },
    // del diseño: 14 trucks → 28 loads/día y 26 trucks → 52 loads/día = 2 loads por truck.
    // 20/40 no traía ritmo: se calcula con el ciclo real de IronHorse.
    loadsPerTruckDay: { '100M': 2, '4070': 2, '2040': null },
    bufferStages: 2,                 // [SUPUESTO] arena en locación con 2 etapas de anticipación
    alertHours: 2,                   // ventana "asignar ya"
    gapAlert: { warn: 2, alert: 5 }, // loads atrasados que encienden la señal
    // las entregas OMMA cuentan como arena de este frac desde el inicio del prefill (23 sep):
    // los 4 loads del extracto (25 y 27 sep) son parte del prefill. Vacío = todas las del pozo.
    countFrom: '2026-09-23T00:00',
    // PO por arena para la cola de asignación. Vacío = se toma del export de OMMA más reciente.
    po: { '100M': '', '4070': '', '2040': '' },
    carriers: [
      { id: 'OMMA', name: 'OMMA', tracked: true },
      { id: 'C2', name: 'Carrier 2', tracked: false },
      { id: 'C3', name: 'Carrier 3', tracked: false },
      { id: 'C4', name: 'Carrier 4', tracked: false }
    ],
    overrides: { payload: {}, leadMin: {} }
  };

  /* Extracto de loads entregados por OMMA (4 loads, 24–27 sep 2026).
     Sólo los campos que el cálculo y la cola usan (el PO dice contra qué orden se asigna); sin nombres de driver.
     Horarios del export leídos en America/Mexico_City (UTC−6). */
  const SEED_LOADS = [
    { k: '9|2746', n: '9', p: '2040', s: '2040', m: 'IRONHORSE', t: 'Ironhorse Permian Basin - Artesia',
      mi: 7, tr: 'OP1030', w: 52480, tm: 39, tx: 13, td: 59,
      a: Date.parse('2026-09-27T12:49:00-06:00'), d: Date.parse('2026-09-27T18:37:00-06:00'),
      wl: 'Riley Horned Frog 5', c: 'OMMA', po: 'PO-1236' },
    { k: '8|2742', n: '8', p: '20/40', s: '2040', m: 'IRONHORSE', t: 'Ironhorse Permian Basin - Artesia',
      mi: 7, tr: 'OP1024', w: 50220, tm: 27, tx: 15, td: 212,
      a: Date.parse('2026-09-27T12:40:00-06:00'), d: Date.parse('2026-09-27T18:22:00-06:00'),
      wl: 'Riley Horned Frog 5', c: 'OMMA', po: 'PO-1236' },
    { k: '4|1830519', n: '4', p: '100 Mesh Frac Sand', s: '100M', m: 'IRONOAK', t: 'Iron Oak Energy - Kermit 115 Plant',
      mi: 135, tr: 'COM140', w: 50020, tm: null, tx: 186, td: 108,
      a: Date.parse('2026-09-25T03:25:00-06:00'), d: Date.parse('2026-09-25T12:11:00-06:00'),
      wl: 'Riley Horned Frog 5', c: 'OMMA', po: 'SPA00021226' },
    { k: '2|18030401', n: '2', p: '100 100 Mesh Frac Sand', s: '100M', m: 'IRONOAK', t: 'Iron Oak Energy - Kermit 115 Plant',
      mi: 135, tr: 'COM140', w: 49720, tm: null, tx: 199, td: 7,
      a: Date.parse('2026-09-24T20:44:00-06:00'), d: Date.parse('2026-09-25T02:40:00-06:00'),
      wl: 'Riley Horned Frog 5', c: 'OMMA', po: 'SPA00021226' }
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Punto de partida de despacho (28 sep 2026): el prefill ya quedó asignado — 30 × 20/40 y
     6 × 100 Mesh — más el primer load de 40/70. Sin carrier: la cola no lo usa. La hora de cada
     palomita se reparte a lo largo de la ventana del prefill (23 sep 00:00 → 28 sep 03:00). */
  const REV = 2;
  function baselineAsg() {
    const PS = Date.parse('2026-09-23T00:00:00-06:00'), PE = Date.parse('2026-09-28T03:00:00-06:00');
    const out = {};
    const spread = (sand, n) => {
      for (let k = 1; k <= n; k++) {
        const t = PS + (k - 1) / n * (PE - PS);
        out[sand + '-' + String(k).padStart(3, '0')] = { c: '', t: new Date(t).toISOString(), by: '' };
      }
    };
    spread('2040', 30);
    spread('100M', 6);
    out['4070-001'] = { c: '', t: '2026-09-28T06:50:00.000Z', by: '' };   // 00:50 hora del centro
    return out;
  }

  function initialState() {
    return {
      schema: 1,
      seedRev: REV,
      v: 0,
      config: clone(DEFAULT_CONFIG),
      asg: baselineAsg(),
      stage: [],
      omma: {
        loads: clone(SEED_LOADS),
        meta: { file: 'Excel extracto de loads OMMA (referencia inicial)', rows: 4, at: Date.parse('2026-09-27T23:09:00-06:00') }
      },
      log: [],
      opIds: [],
      updatedAt: null
    };
  }

  return { DEFAULT_CONFIG, SEED_LOADS, REV, baselineAsg, initialState, clone };
});
