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
      prefillStart: '2026-09-29T14:00',  // [SUPUESTO] "Tuesday evening/afternoon"
      fracStart: '2026-09-30T06:00'      // [SUPUESTO] arranque de la etapa 1
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
    // [SUPUESTO] las entregas OMMA cuentan como arena de este frac desde el día del prefill.
    // Los 4 loads del extracto (25 y 27 sep) quedan como referencia de tiempos y payload, no como
    // arena en locación. Vacío = cuentan todas las entregas al pozo.
    countFrom: '2026-09-29T00:00',
    carriers: [
      { id: 'OMMA', name: 'OMMA', tracked: true },
      { id: 'C2', name: 'Carrier 2', tracked: false },
      { id: 'C3', name: 'Carrier 3', tracked: false },
      { id: 'C4', name: 'Carrier 4', tracked: false }
    ],
    overrides: { payload: {}, leadMin: {} }
  };

  /* Extracto de loads entregados por OMMA (4 loads, 24–27 sep 2026).
     Sólo los campos que el cálculo usa: sin nombres de driver ni PO.
     Horarios del export leídos en America/Mexico_City (UTC−6). */
  const SEED_LOADS = [
    { k: '9|2746', n: '9', p: '2040', s: '2040', m: 'IRONHORSE', t: 'Ironhorse Permian Basin - Artesia',
      mi: 7, tr: 'OP1030', w: 52480, tm: 39, tx: 13, td: 59,
      a: Date.parse('2026-09-27T12:49:00-06:00'), d: Date.parse('2026-09-27T18:37:00-06:00'),
      wl: 'Riley Horned Frog 5', c: 'OMMA' },
    { k: '8|2742', n: '8', p: '20/40', s: '2040', m: 'IRONHORSE', t: 'Ironhorse Permian Basin - Artesia',
      mi: 7, tr: 'OP1024', w: 50220, tm: 27, tx: 15, td: 212,
      a: Date.parse('2026-09-27T12:40:00-06:00'), d: Date.parse('2026-09-27T18:22:00-06:00'),
      wl: 'Riley Horned Frog 5', c: 'OMMA' },
    { k: '4|1830519', n: '4', p: '100 Mesh Frac Sand', s: '100M', m: 'IRONOAK', t: 'Iron Oak Energy - Kermit 115 Plant',
      mi: 135, tr: 'COM140', w: 50020, tm: null, tx: 186, td: 108,
      a: Date.parse('2026-09-25T03:25:00-06:00'), d: Date.parse('2026-09-25T12:11:00-06:00'),
      wl: 'Riley Horned Frog 5', c: 'OMMA' },
    { k: '2|18030401', n: '2', p: '100 100 Mesh Frac Sand', s: '100M', m: 'IRONOAK', t: 'Iron Oak Energy - Kermit 115 Plant',
      mi: 135, tr: 'COM140', w: 49720, tm: null, tx: 199, td: 7,
      a: Date.parse('2026-09-24T20:44:00-06:00'), d: Date.parse('2026-09-25T02:40:00-06:00'),
      wl: 'Riley Horned Frog 5', c: 'OMMA' }
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function initialState() {
    return {
      schema: 1,
      v: 0,
      config: clone(DEFAULT_CONFIG),
      asg: {},
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

  return { DEFAULT_CONFIG, SEED_LOADS, initialState, clone };
});
