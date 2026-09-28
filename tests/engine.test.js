/* Engine tests. Run: npm test */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/assets/js/engine.js');
const S = require('../public/assets/js/seed.js');

const TZ = 'America/Mexico_City';
const at = s => Date.parse(s);              // ISO with zone
const NOW = at('2026-09-28T00:30:00-06:00'); // Monday 00:30: prefill wrapping up, frac at 06:00
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ` expected ${b} ± ${tol}, got ${a}`);

function model(mut, now) {
  const st = S.initialState();
  if (mut) mut(st);
  return E.build(st.config, st, now == null ? NOW : now);
}

test('time zone: wall ↔ epoch in Mexico City (UTC−6, no DST)', () => {
  const t = E.parseWall('2026-09-29T14:00', TZ);
  assert.equal(t, at('2026-09-29T14:00:00-06:00'));
  assert.equal(E.parseWall('9/27/2026 12:49', TZ), at('2026-09-27T12:49:00-06:00'));
  assert.equal(E.parseWall('9/27/2026 12:49 PM', TZ), at('2026-09-27T12:49:00-06:00'));
  assert.equal(E.parseWall('9/27/2026 12:05 AM', TZ), at('2026-09-27T00:05:00-06:00'));
  assert.equal(E.parseWall('2026-09-27T18:49:00Z', TZ), at('2026-09-27T12:49:00-06:00'));
  assert.equal(E.toWallString(t, TZ), '2026-09-29T14:00');
  // Excel serial 46292.5 = 2026-09-27 12:00
  assert.equal(E.parseWall(46292.5, TZ), at('2026-09-27T12:00:00-06:00'));
});

test('time zone: cached offsets match Intl across a DST change (Chicago) and in Mexico City', () => {
  const dtf = tz => new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const ref = (t, tz) => { const o = {}; for (const p of dtf(tz).formatToParts(new Date(t))) o[p.type] = +p.value; return [o.year, o.month, o.day, o.hour % 24, o.minute, o.second]; };
  for (const [tz, from] of [['America/Chicago', '2026-03-08T05:00:00Z'], ['America/Chicago', '2026-11-01T04:00:00Z'], ['America/Mexico_City', '2026-09-27T00:00:00Z']]) {
    for (let t = Date.parse(from); t < Date.parse(from) + 8 * 3600e3; t += 7 * 60e3 + 13e3) {
      const w = E.wallParts(t, tz);
      assert.deepEqual([w.y, w.mo, w.d, w.h, w.mi, w.s], ref(t, tz), tz + ' ' + new Date(t).toISOString());
    }
  }
  assert.equal(E.wallToEpoch(2026, 3, 8, 3, 30, 0, 'America/Chicago'), Date.parse('2026-03-08T08:30:00Z'));   // CDT after the jump
  assert.equal(E.wallToEpoch(2026, 3, 8, 1, 30, 0, 'America/Chicago'), Date.parse('2026-03-08T07:30:00Z'));   // still CST
});

test('shifts: early morning belongs to the previous night shift', () => {
  const a = E.shiftOf(at('2026-09-30T00:15:00-06:00'), TZ, 6);
  assert.equal(a.key, '2026-09-29|N');
  assert.equal(a.start, at('2026-09-29T18:00:00-06:00'));
  const b = E.shiftOf(at('2026-09-29T14:00:00-06:00'), TZ, 6);
  assert.equal(b.key, '2026-09-29|D');
});

test('normalizes product, mine and duration', () => {
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

test('design: lbs and loads per sand', () => {
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

test('extract references: payload, lead and cycle per mine', () => {
  const M = model();
  assert.equal(M.params['100M'].payload, 49870);
  assert.equal(M.params['2040'].payload, 51350);
  assert.equal(M.params['4070'].payload, 49870);            // no data of its own → Iron Oak average
  assert.equal(M.params['4070'].payloadSrc, 'mine');
  assert.equal(M.params['100M'].payloadSrc, 'data');
  assert.equal(M.params['2040'].lptdSrc, 'estimated');
  assert.equal(M.params['100M'].leadMin, 441);              // median of 526 and 356
  assert.equal(M.params['2040'].leadMin, 345);              // median of 348 and 342
  assert.equal(M.stats.mines.IRONOAK.cycle.median, 571);    // COM140: delivered 02:40 → next delivery 12:11
  assert.equal(M.stats.mines.IRONOAK.transit.median, 192.5);
  assert.equal(M.stats.mines.IRONHORSE.term.median, 33);
  assert.equal(M.params['100M'].lptd, 2);                   // from the plan: 14 trucks → 28 loads/day
  near(M.params['2040'].lptd, 1440 / 345, 1e-9);            // estimated with the IronHorse lead
});

test('plan per segment: loads/day, trucks and sustainable pace', () => {
  const M = model();
  const s2 = M.segPlans[1];
  near(s2.per['100M'].loadsPerDay, 34.289, 0.001);
  near(s2.per['4070'].loadsPerDay, 64.387, 0.001);
  near(s2.per['2040'].loadsPerDay, 7.400, 0.001);
  near(s2.per['100M'].trucksNeeded, 17.14, 0.01);
  near(s2.per['4070'].trucksNeeded, 32.19, 0.01);
  near(s2.sustainPace, 15.34, 0.01);                        // 52 loads/day × 49,870 ÷ 169,000
  assert.equal(s2.limiting, '4070');
  const s1 = M.segPlans[0];
  near(s1.per['2040'].loadsPerDay, 41.071, 0.001);
  assert.equal(s1.per['2040'].trucksPlanned, null);         // the design has no trucks for 1–30
  assert.equal(s1.sustainPace, null);
});

test('prefill: 30 × 20/40 and 6 × 100M spread between prefill start and end', () => {
  const M = model(st => { st.asg = {}; });
  const pf20 = M.sands['2040'].slots.filter(x => x.prefill);
  const pf100 = M.sands['100M'].slots.filter(x => x.prefill);
  assert.equal(pf20.length, 30);
  assert.equal(pf100.length, 6);
  assert.equal(M.sands['4070'].slots.filter(x => x.prefill).length, 0);
  const PS = at('2026-09-23T18:00:00-06:00'), PE = at('2026-09-28T03:00:00-06:00'), FS = at('2026-09-28T06:00:00-06:00');
  assert.equal(pf20[0].ab, PS);
  assert.equal(pf100[0].ab, PS);
  pf20.forEach(x => { assert.equal(x.nb, FS); assert.ok(x.ab < PE); });
  near(pf100[1].ab - pf100[0].ab, (PE - PS) / 6, 1);       // window Sep 23 6:00 PM → Sep 28 3:00 AM
  near(pf20[1].ab - pf20[0].ab, (PE - PS) / 30, 1);
  const noEnd = model(st => { st.asg = {}; delete st.config.schedule.prefillEnd; });   // no end: frac start − lead
  const q = noEnd.sands['2040'].slots.filter(x => x.prefill);
  near(q[29].ab - q[0].ab, 29 / 30 * (FS - 345 * 60e3 - PS), 1);
});

test('40/70 starts at stage 31 with a 2-stage buffer', () => {
  const M = model();
  const first = M.sands['4070'].slots[0];
  assert.equal(first.pos, 30);
  assert.equal(first.stage, 31);
  const FS = at('2026-09-28T06:00:00-06:00');
  near(first.nb, FS + 28 / 19 * E.DAY, 1);                  // position 28 at 19 stages/day
  assert.equal(first.ab, first.nb - 441 * 60e3);
});

test('starting point: 37 assigned, numbered queue, #38 is next', () => {
  const M = model(null, at('2026-09-28T01:00:00-06:00'));
  assert.equal(M.kpi.asgNeeded, 37);
  assert.equal(M.sands['2040'].nAssignedNeeded, 30);
  assert.equal(M.sands['100M'].nAssignedNeeded, 6);
  assert.equal(M.sands['4070'].nAssignedNeeded, 1);
  const needed = M.slots.filter(x => x.needed);
  assert.deepEqual(needed.map(x => x.seq), needed.map((x, i) => i + 1));   // 1..492, no gaps, in queue order
  assert.equal(needed[needed.length - 1].seq, 492);
  near(needed[needed.length - 1].cumAll, needed.reduce((p, x) => p + x.w, 0), 1e-6);
  assert.ok(needed.slice(0, 37).every(x => x.asg), 'the 37 assigned loads are #1–#37');
  assert.ok(needed.slice(37).every(x => !x.asg));
  assert.equal(M.slots.find(x => x.id === '4070-001').seq, 37);   // the 40/70 sent early is #37
  assert.equal(M.kpi.next.id, '2040-031');                  // next: 20/40 for stage 14
  assert.equal(M.kpi.next.seq, 38);
  assert.equal(M.kpi.next.stage, 14);
  near(M.kpi.cov.asg, 30 * 51350 / 111000, 0.01);          // assigned sand covers through stage 13.9 (20/40 limits)
  assert.equal(M.well.phase, 'prefill');
  near(M.slots[36].cumAll, M.kpi.asgLbs, 1e-6);             // running total at #37 = all assigned sand
  const x = M.slots.find(s => s.id === '2040-031');
  near(x.covAfter, 31 * 51350 / 111000, 0.01);
});

test('load numbers follow assignment order: a load assigned out of order takes the next number', () => {
  const t = at('2026-09-28T02:00:00-06:00');
  const M = model(st => { st.asg['2040-040'] = { c: '', t: new Date(t - 60e3).toISOString() }; }, t);
  assert.equal(M.slots.find(x => x.id === '2040-040').seq, 38);
  assert.equal(M.slots.find(x => x.id === '2040-031').seq, 39);   // the pending ones shift by one
  assert.equal(M.kpi.next.seq, 39);
  assert.equal(M.slots.find(x => x.id === '4070-001').seq, 37);   // assigned numbers stay put
});

test('load numbers follow the order the shared state received them, not client clocks', () => {
  const R = require('../public/assets/js/reducer.js');
  const st = S.initialState();
  /* B clicks first on a slow clock, A second with a correct one: B's op reaches the server first */
  let r = R.apply(st, [{ id: 'b1', type: 'asg', slot: '2040-031', c: '', t: '2026-09-28T07:58:00.000Z', by: 'B' }]);
  r = R.apply(r.state, [{ id: 'a1', type: 'asg', slot: '2040-032', c: '', t: '2026-09-28T07:55:00.000Z', by: 'A' }]);
  const M = E.build(r.state.config, r.state, NOW);
  assert.equal(M.slots.find(x => x.id === '2040-031').seq, 38);
  assert.equal(M.slots.find(x => x.id === '2040-032').seq, 39);   // earlier clock, later arrival: stays #39
  /* an offline op that arrives late (older timestamp) goes after what everyone already saw */
  r = R.apply(r.state, [{ id: 'x1', type: 'asg', slot: '2040-040', c: '', t: '2026-09-28T07:00:00.000Z', by: 'X' }]);
  const M2 = E.build(r.state.config, r.state, NOW);
  assert.equal(M2.slots.find(x => x.id === '2040-031').seq, 38);
  assert.equal(M2.slots.find(x => x.id === '2040-040').seq, 40);
  /* undo of a removal puts it back in its place */
  const o31 = r.state.asg['2040-031'].o;
  r = R.apply(r.state, [{ id: 'u1', type: 'unasg', slot: '2040-031' }, { id: 'u2', type: 'asg', slot: '2040-031', c: '', o: o31, t: '2026-09-28T07:58:00.000Z' }]);
  assert.equal(E.build(r.state.config, r.state, NOW).slots.find(x => x.id === '2040-031').seq, 38);
  r = R.apply(r.state, [{ id: 'u3', type: 'unasg', slot: '2040-040' }, { id: 'u4', type: 'asg', slot: '2040-040', o: 999 }]);
  assert.ok(r.state.asg['2040-040'].o <= r.state.ord, 'an order beyond the counter is not accepted');
});

test('final counts at 80% of loads assigned', () => {
  const M = model();
  assert.equal(M.kpi.fcAt, 394);                            // ceil(0.8 × 492)
  assert.equal(M.kpi.fcOn, false);
  assert.equal(M.kpi.fcLeft, 357);
  const pend = M.slots.filter(x => x.needed && !x.asg).slice(0, 393 - 37);
  const M2 = model(st => { pend.forEach((x, i) => { st.asg[x.id] = { c: '', t: new Date(NOW - 1e6 + i).toISOString() }; }); });
  assert.equal(M2.kpi.asgNeeded, 393);
  assert.equal(M2.kpi.fcOn, false);
  assert.equal(M2.kpi.fcLeft, 1);
  const nx = M2.slots.find(x => x.needed && !x.asg);
  const M3 = model(st => { pend.concat([nx]).forEach((x, i) => { st.asg[x.id] = { c: '', t: new Date(NOW - 1e6 + i).toISOString() }; }); });
  assert.equal(M3.kpi.fcOn, true);
  const M4 = model(st => { st.config.finalCountsPct = 50; });
  assert.equal(M4.kpi.fcAt, 246);
});

test('PO per sand: the one in the design wins; otherwise the latest export', () => {
  const def = model();
  assert.equal(def.sands['100M'].po, 'SPA00021226');
  assert.equal(def.sands['4070'].po, 'SPA00021227');
  assert.equal(def.sands['2040'].po, 'PO-24918');
  assert.equal(def.sands['4070'].poSrc, 'manual');
  const base = model(st => { st.config.po = {}; st.omma.loads.forEach(l => { l.po = l.s === '2040' ? 'PO-A' : 'PO-B'; }); });
  assert.equal(base.sands['2040'].po, 'PO-A');
  assert.equal(base.sands['2040'].poSrc, 'export');
  assert.equal(base.sands['4070'].po, '');
  assert.equal(base.slots.find(x => x.id === '2040-031').po, 'PO-A');
  const man = model(st => { st.config.po = { '100M': '', '4070': 'PO-4070', '2040': 'PO-X' }; st.omma.loads.forEach(l => { l.po = 'PO-A'; }); });
  assert.equal(man.sands['2040'].po, 'PO-X');
  assert.equal(man.sands['2040'].poSrc, 'manual');
  assert.equal(man.sands['4070'].po, 'PO-4070');
});

test('stage coverage: 40/70 with no loads covers through stage 30', () => {
  const tb = E.stageTable(S.DEFAULT_CONFIG);
  assert.equal(E.posOf(tb.prefix['4070'], tb.N, 0), 30);
  assert.equal(E.posOf(tb.prefix['2040'], tb.N, 111000), 1);
  near(E.posOf(tb.prefix['2040'], tb.N, 30 * 51350), 13.878, 0.001);
  near(E.posOf(tb.prefix['100M'], tb.N, 6 * 49870), 29.922, 0.001);
  assert.equal(E.posOf(tb.prefix['100M'], tb.N, 9e9), 105);
  const M = model(st => { st.config.countFrom = null; });  // no cut-off: the 4 extract deliveries count
  near(M.kpi.cov.omma, 102700 / 111000, 1e-9);               // 2 OMMA 20/40 loads = 0.93 stages
});

test('delivery cut-off: deliveries count from the prefill start; earlier ones only feed times', () => {
  const M = model();                                         // default cut-off: Sep 23 6:00 PM (prefill start)
  assert.equal(M.countFrom, at('2026-09-23T18:00:00-06:00'));
  assert.equal(M.wellLoads.length, 4);
  assert.equal(M.jobLoads.length, 4);                        // the 4 extract loads are part of the prefill
  const late = model(st => { st.config.countFrom = '2026-09-26T00:00'; });
  assert.equal(late.jobLoads.length, 2);                     // only the two 20/40 loads from Sep 27
  assert.equal(late.params['100M'].payload, 49870);          // payload still comes from all 4
  const all = model(st => { st.config.countFrom = ''; });
  assert.equal(all.jobLoads.length, 4);
});

test('queue statuses: assigned (delivered, en route, arrived), scheduled, assign now and overdue', () => {
  const t0 = at('2026-09-28T01:00:00-06:00');
  const M = model(null, t0);
  const s = id => M.slots.find(x => x.id === id);
  assert.equal(s('2040-001').status, 'del');                  // OMMA delivery matched to a load with no carrier
  assert.equal(s('100M-002').status, 'del');
  assert.equal(s('2040-030').status, 'eta');                  // assigned Sep 27 11:30 PM, arrives ~5:15 AM
  assert.equal(s('2040-031').status, 'next');                 // scheduled: assign by Sep 28 3:15 PM
  near(s('2040-031').ab, at('2026-09-28T15:15:00-06:00'), 2 * 60e3);
  assert.equal(model(null, at('2026-09-28T14:00:00-06:00')).slots.find(x => x.id === '2040-031').status, 'now');
  const late = model(null, at('2026-09-28T20:00:00-06:00'));
  assert.equal(late.slots.find(x => x.id === '2040-031').status, 'late');
  assert.ok(late.kpi.overdue > 0);
});

test('OMMA reconciliation: deliveries match loads with no carrier; gap vs cadence', () => {
  const M0 = model();
  assert.equal(M0.sands['2040'].omma.matched, 2);
  assert.equal(M0.sands['2040'].omma.reconcile.length, 0);    // already checked off in the prefill
  const M1 = model(st => { st.asg = {}; });
  assert.equal(M1.sands['2040'].omma.reconcile.length, 2);    // no check marks: suggests the first 2
  assert.equal(M1.sands['2040'].omma.reconcile[0].slot, '2040-001');
  const t = at('2026-09-28T16:00:00-06:00');
  const M = model(st => { st.asg['2040-031'] = { c: 'C3', t: at('2026-09-28T14:10:00-06:00') }; }, t);
  const due = M.slots.filter(x => x.needed && x.ab <= t).length;
  assert.equal(M.kpi.dueNow, due);
  assert.equal(M.kpi.gap, 38 - due);
});

test('estimated delivered: OMMA with no record only counts after the file cut-off', () => {
  const t = at('2026-09-28T13:00:00-06:00');
  const asg = st => { st.asg['2040-031'] = { c: 'OMMA', t: at('2026-09-28T06:05:00-06:00') }; };   // arrives ~11:50
  const M = model(asg, t);                                   // the file ends Sep 27: it cannot know
  assert.equal(M.slots.find(x => x.id === '2040-031').status, 'arr');
  const M2 = model(st => {                                   // new file ending Sep 28 12:30 without that delivery
    asg(st);
    st.omma.loads.push({ k: 'x|1', n: 'x', s: '100M', m: 'IRONOAK', w: 50000, a: at('2026-09-28T05:00:00-06:00'), d: at('2026-09-28T12:30:00-06:00'), wl: 'Other well', c: 'OMMA' });
  }, t);
  assert.equal(M2.slots.find(x => x.id === '2040-031').status, 'eta');   // en route / no record
  near(M.sands['2040'].estLbs - M2.sands['2040'].estLbs, 51350, 1e-6);   // no longer counted as delivered
});

test('an actual stage report re-anchors the calendar', () => {
  const rep = at('2026-10-01T12:00:00-06:00');
  const M = model(st => { st.stage.push({ id: 'r1', n: 20, t: new Date(rep).toISOString() }); }, rep);
  assert.equal(M.well.anchor.src, 'real');
  assert.equal(M.sc.B[20], rep);
  near(M.sc.T(31) - rep, 11 / 19 * E.DAY, 1);
  assert.equal(M.well.phase, 'frac');
  assert.equal(M.well.curStage, 21);
});

test('cumulative series: required ends at the total', () => {
  const M = model();
  const c = E.cumulativeSeries(M, { unit: 'loads' });
  assert.equal(c.req[c.req.length - 1], 492);
  const l = E.cumulativeSeries(M, { unit: 'lbs' });
  const slotLbs = M.slots.filter(x => x.needed).reduce((p, x) => p + x.w, 0);
  assert.equal(l.req[l.req.length - 1], slotLbs);
});

test('segments with gaps or overlaps are reported', () => {
  const cfg = S.clone(S.DEFAULT_CONFIG);
  cfg.segments[1].from = 35;
  const tb = E.stageTable(cfg);
  assert.ok(tb.issues.some(i => /no design: 31–34/.test(i.txt)));
  cfg.segments[1].from = 25;
  assert.ok(E.stageTable(cfg).issues.some(i => /two segments/.test(i.txt)));
});
