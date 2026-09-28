/* OMMA · Velox dispatch — initial well configuration and reference loads.
   Everything here can be edited in the app (Plan tab). Values tagged [ASSUMPTION] were not in the
   well design and should be confirmed with the client. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Seed = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_CONFIG = {
    schema: 1,
    job: {
      well: 'Riley Horned Frog 5',   // destination well in the OMMA loads extract
      client: 'Velox',               // from the repository name
      totalStages: 105
    },
    tz: 'America/Mexico_City',       // dispatch time zone; export times are read in this zone
    shiftStartHour: 6,               // [ASSUMPTION] shifts 06:00–18:00 / 18:00–06:00
    schedule: {
      prefillStart: '2026-09-23T18:00',  // prefill started Sep 23 at 6:00 PM
      prefillEnd: '2026-09-28T03:00',    // prefill ended Sep 28 at 3:00 AM
      fracStart: '2026-09-28T06:00'      // well start (stage 1) scheduled Sep 28 at 6:00 AM
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
    // lbs per stage. Stages 31–105 run at 19 stages/day per the design;
    // stages 1–30 had no pace: [ASSUMPTION] the same 19.
    // trucks: trucks running per sand in that segment (the design only gives it for 31–105).
    segments: [
      { from: 1, to: 30, pace: 19, lbs: { '100M': 10000, '4070': 0, '2040': 111000 }, trucks: {} },
      { from: 31, to: 105, pace: 19, lbs: { '100M': 90000, '4070': 169000, '2040': 20000 },
        trucks: { '100M': 14, '4070': 26, '2040': 2 } }
    ],
    prefill: { '100M': 6, '4070': 0, '2040': 30 },
    // from the design: 14 trucks → 28 loads/day and 26 trucks → 52 loads/day = 2 loads per truck.
    // 20/40 had no pace: it is computed from the actual IronHorse cycle.
    loadsPerTruckDay: { '100M': 2, '4070': 2, '2040': null },
    bufferStages: 2,                 // [ASSUMPTION] sand on location 2 stages ahead
    alertHours: 2,                   // "assign now" window
    gapAlert: { warn: 2, alert: 5 }, // loads behind that turn the signal on
    finalCountsPct: 80,              // at 80% of loads assigned: final counts, confirm with the frac crew
    // OMMA deliveries count as sand for this frac from the prefill start (Sep 23 6:00 PM):
    // the 4 loads in the extract (Sep 24–27) are part of the prefill. Empty = every load to the well.
    countFrom: '2026-09-23T18:00',
    // PO per sand for the assignment queue. Empty = taken from the latest OMMA export.
    po: { '100M': 'SPA00021226', '4070': 'PO-24918', '2040': 'PO-1236' },
    carriers: [
      { id: 'OMMA', name: 'OMMA', tracked: true },
      { id: 'C2', name: 'Carrier 2', tracked: false },
      { id: 'C3', name: 'Carrier 3', tracked: false },
      { id: 'C4', name: 'Carrier 4', tracked: false }
    ],
    overrides: { payload: {}, leadMin: {} }
  };

  /* OMMA delivered-loads extract (4 loads, Sep 24–27 2026).
     Only the fields the calculation and the queue use (the PO says which order a load is assigned against);
     no driver names. Export times read in America/Mexico_City (UTC−6). */
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

  /* Dispatch starting point (Sep 28 2026): the prefill is already assigned — 30 × 20/40 and
     6 × 100 Mesh — plus one 40/70 load that went out early by mistake: 37 assigned, #38 is next.
     No carrier: the queue does not need it. The prefill check marks are stamped evenly across the prefill
     window (Sep 23 6:00 PM → Sep 28 3:00 AM, the last one at 11:30 PM on Sep 27); the 40/70 is stamped
     00:50 on Sep 28, after all of them, so it is #37. */
  const REV = 3;
  const OLD_FILE = 'Excel extracto de loads OMMA (referencia inicial)';
  const SEED_FILE = 'OMMA loads extract (initial reference)';
  function baselineAsg() {
    const PS = Date.parse('2026-09-23T18:00:00-06:00'), PE = Date.parse('2026-09-28T03:00:00-06:00');
    const out = {};
    const spread = (sand, n) => {
      for (let k = 1; k <= n; k++) {
        const t = PS + (k - 1) / n * (PE - PS);
        out[sand + '-' + String(k).padStart(3, '0')] = { c: '', t: new Date(t).toISOString(), by: '' };
      }
    };
    spread('2040', 30);
    spread('100M', 6);
    out['4070-001'] = { c: '', t: '2026-09-28T06:50:00.000Z', by: '' };   // 00:50 Central
    return out;
  }

  /* Non-destructive update for a shared state already on revision 2: only fields that still hold the
     revision-2 value change, so anything dispatch edited in Plan stays. Check marks are not touched. */
  function patchFrom(rev) {
    if (rev !== 2) return [];
    return [
      { path: 'config.schedule.prefillStart', from: '2026-09-23T00:00', to: '2026-09-23T18:00' },
      { path: 'config.countFrom', from: '2026-09-23T00:00', to: '2026-09-23T18:00' },
      { path: 'config.po.100M', from: '', to: 'SPA00021226' },
      { path: 'config.po.4070', from: '', to: 'PO-24918' },
      { path: 'config.po.2040', from: '', to: 'PO-1236' },
      { path: 'config.finalCountsPct', from: '', to: 80 },
      { path: 'omma.meta.file', from: OLD_FILE, to: SEED_FILE }
    ];
  }

  function initialState() {
    return {
      schema: 1,
      seedRev: REV,
      v: 0,
      config: clone(DEFAULT_CONFIG),
      asg: baselineAsg(),
      stage: [],
      fc: null,
      omma: {
        loads: clone(SEED_LOADS),
        meta: { file: SEED_FILE, rows: 4, at: Date.parse('2026-09-27T23:09:00-06:00') }
      },
      log: [],
      opIds: [],
      updatedAt: null
    };
  }

  return { DEFAULT_CONFIG, SEED_LOADS, REV, baselineAsg, patchFrom, initialState, clone };
});
