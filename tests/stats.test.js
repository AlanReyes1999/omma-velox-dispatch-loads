/* Stage stats PDF: reader, shared operation and design + actual blending. Run: npm test */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/assets/js/engine.js');
const S = require('../public/assets/js/seed.js');
const R = require('../public/assets/js/reducer.js');
const T = require('../public/assets/js/stagestats.js');
const FX = require('./fixtures/stage-stats-sample.json');

const at = s => Date.parse(s);
const NOW = at('2026-09-29T01:56:00-06:00');
const MIN = 60e3;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ` expected ${b} ± ${tol}, got ${a}`);
const parsed = () => T.parse(FX.items, S.DEFAULT_CONFIG, E, NOW);
function model(mut, now) {
  const st = S.initialState();
  if (mut) mut(st);
  return E.build(st.config, st, now == null ? NOW : now);
}
const withStats = st => { st.actual = { stages: parsed().stages, meta: { file: 'stats.pdf' } }; };

/* a one-page table built by hand: header + rows, notes below */
function sheet(rows, notes) {
  const it = [];
  const col = { n: 136, lbs: 251, start: 348, end: 431, day: 726 };
  const put = (s, cx, y) => it.push({ p: 1, s, x: cx - s.length * 2.5, y, w: s.length * 5 });
  put('Riley Horned Frog 5 Well Pad', 150, 60);
  [['Total Stage', 'n'], ['Used Pounds', 'lbs'], ['Stage Start Time', 'start'], ['Stage End Time', 'end'], ['Day', 'day']].forEach(([s, k]) => put(s, col[k], 160));
  rows.forEach((r, i) => Object.keys(r).forEach(k => put(r[k], col[k], 190 + i * 16)));
  (notes || []).forEach((s, i) => it.push({ p: 2, s, x: 50, y: 60 + i * 24, w: s.length * 5 }));
  return it;
}

test('stats PDF: stages, lbs per sand from the notes and times on the calendar', () => {
  const r = parsed();
  assert.equal(r.title, '1. Riley Horned Frog 5 Well Pad');
  assert.equal(r.wellMatch, true);
  assert.equal(r.stages.length, 7);
  assert.deepEqual(r.stages.map(s => s.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(r.stages[0].lbs, { '2040': 110000, '100M': 11000 });
  assert.deepEqual(r.stages[4].lbs, { '2040': 110481, '100M': 0 }, 'an explicit 0 lb stays a 0');
  assert.deepEqual(r.stages[6].lbs, { '2040': 131790, '100M': 9004 }, 'the note with a label line reads the same');
  assert.ok(r.stages.every(s => s.src === 'notes'));
  assert.equal(r.stages[0].s, at('2026-09-28T10:53:00-06:00'));
  assert.equal(r.stages[0].e, at('2026-09-28T12:22:00-06:00'));
  /* stage 7 crosses midnight: Day 9/29 is the day it ended */
  assert.equal(r.stages[6].s, at('2026-09-28T23:33:00-06:00'));
  assert.equal(r.stages[6].e, at('2026-09-29T00:25:00-06:00'));
  /* total cell vs its sands: the sands win and the preview says so */
  assert.deepEqual(r.warnings.map(w => w.n), [1, 3, 4]);
  assert.ok(r.warnings.every(w => w.lvl === 'info'));
  assert.equal(r.stages[0].tot, 120000);
  assert.ok(!JSON.stringify(r.stages).match(/driver|pile/i), 'drivers and sandpile are not kept');
});

test('stats PDF: sand-first notes, totals with no breakdown, bad rows', () => {
  const items = sheet([
    { n: '1', lbs: '121,000 [1]', start: '6:00 AM', end: '7:10 AM', day: '9/28/2026' },
    { n: '2', lbs: '100,000', start: '8:00 AM', end: '9:00 AM', day: '9/28/2026' },
    { n: '3', lbs: '99,000 [2]', start: '11:40 PM', end: '12:30 AM', day: '9/29/2026' },
    { n: '140', lbs: '1', start: '1:00 AM', end: '2:00 AM', day: '9/29/2026' },
    { n: '4', lbs: '98,000', start: '3:00 AM', end: '4:00 AM', day: '9/29/2026' }
  ], ['[1] 20/40: 110,000 lbs', '100 mesh: 11,000 lbs', '[2] 99,000 lbs - 30/50']);
  const r = T.parse(items, S.DEFAULT_CONFIG, E, at('2026-09-29T02:00:00-06:00'));
  const st = n => r.stages.find(s => s.n === n);
  assert.deepEqual(st(1).lbs, { '2040': 110000, '100M': 11000 }, 'sand first');
  assert.equal(st(2).src, 'split');
  assert.deepEqual(st(2).lbs, { '100M': Math.round(100000 * 10000 / 121000), '2040': Math.round(100000 * 111000 / 121000) }, 'split like the design');
  assert.equal(st(3).lbs, null, 'a sand outside the design is left out, not guessed');
  assert.equal(st(3).s, at('2026-09-28T23:40:00-06:00'));
  assert.ok(!st(140), 'a stage outside the well is left out');
  assert.equal(st(4).s, null, 'times after now are left out');
  assert.equal(st(4).e, null);
  const txt = r.warnings.map(w => w.txt).join(' | ');
  assert.match(txt, /30\/50 is not a sand/);
  assert.match(txt, /Stage 140 is outside/);
  assert.match(txt, /Stage 4 ends after now/);
  assert.match(txt, /Stage 2: no breakdown/);
  assert.throws(() => T.parse([{ p: 1, s: 'Hello', x: 1, y: 1, w: 10 }], S.DEFAULT_CONFIG, E, NOW), /No stage table/);
  assert.deepEqual(T.pairsOf('[7] Stage 7 pumped sand - 131,790 lbs - 20/40 9,004 lbs - 100 mesh'), [['20/40', 131790], ['100 mesh', 9004]]);
  assert.equal(T.clockOf('12:25 AM'), 25);
  assert.equal(T.clockOf('12:22 PM'), 742);
  assert.equal(T.clockOf('22:26'), 1346);
});

test('reducer: stage stats keep only stage, times and lbs; merge, replace and clear', () => {
  const st = S.initialState();
  const stages = parsed().stages;
  let r = R.apply(st, [{ id: 'a1', type: 'actual', stages: stages.slice(0, 5).map(s => Object.assign({ driver: 'Jane Doe', pile: 1776688 }, s)), meta: { file: 'stats.pdf', driver: 'x' }, by: 'AR' }]);
  assert.deepEqual(r.applied, ['a1']);
  assert.equal(r.state.actual.stages.length, 5);
  assert.ok(!JSON.stringify(r.state.actual).match(/driver|Jane|pile/i), 'nothing but the stage data is kept');
  assert.equal(r.state.actual.meta.file, 'stats.pdf');
  assert.equal(r.state.actual.meta.by, 'AR');
  assert.equal(R.workedSinceReseed(r.state.log), true, 'uploading stats is work: no automatic starting point over it');
  r = R.apply(r.state, [{ id: 'a2', type: 'actual', stages: stages.slice(3) }]);
  assert.deepEqual(r.state.actual.stages.map(s => s.n), [1, 2, 3, 4, 5, 6, 7], 'merge by stage number');
  r = R.apply(r.state, [{ id: 'a3', type: 'actual', mode: 'replace', stages: stages.slice(5) }]);
  assert.deepEqual(r.state.actual.stages.map(s => s.n), [6, 7]);
  r = R.apply(r.state, [{ id: 'a4', type: 'actual', mode: 'replace', stages: [], undo: true }]);
  assert.equal(r.state.actual, null, 'replace with nothing clears (undo of a first upload)');
  r = R.apply(r.state, [{ id: 'a5', type: 'actualClear' }]);
  assert.deepEqual(r.applied, [], 'nothing to clear');
  r = R.apply(r.state, [{ id: 'a6', type: 'actual', stages: [{ n: 3, s: 'x', e: 1e20, lbs: { __proto__: 5, '2040': -4, '100M': 'abc', '4070': 1200.4, 'bad key!': 9 }, tot: 'x' }, { n: 0 }, { n: 9999 }, 'junk'] }]);
  assert.deepEqual(r.state.actual.stages, [{ n: 3, s: null, e: null, lbs: { '4070': 1200 }, tot: null, src: '' }]);
  assert.equal(({}).polluted, undefined);
  r = R.apply(r.state, [{ id: 'a7', type: 'actualClear' }]);
  assert.equal(r.state.actual, null);
  assert.deepEqual(R.apply(S.initialState(), [{ id: 'a8', type: 'actual', stages: [] }]).applied, [], 'an empty merge is refused');
});

test('design + actual: pumped stages count as pumped, the rest averages design with them', () => {
  const M0 = model();
  const M = model(withStats);
  const g = M.tb.act.seg;
  /* stages 1–30: (design + 7 pumped) ÷ 8 */
  near(g[0].fc['2040'], (111000 + 823954) / 8, 1e-6);
  near(g[0].fc['100M'], (10000 + 54659) / 8, 1e-6);
  assert.equal(g[0].fc['4070'], 0);
  /* stages 31–105 keep the design until their own stages are pumped */
  assert.deepEqual(g[1].fc, { '100M': 90000, '4070': 169000, '2040': 20000 });
  assert.equal(g[1].on, false);
  assert.equal(M.tb.d['2040'][7], 131790);
  near(M.tb.d['2040'][8], 116869.25, 1e-6);
  near(M.tb.R['2040'], 823954 + 23 * 116869.25 + 75 * 20000, 1e-3);
  near(M.tb.R['100M'], 54659 + 23 * 8082.375 + 75 * 90000, 1e-3);
  assert.equal(M.tbd.R['2040'], 4830000, 'the design alone stays available');
  assert.equal(M.sands['2040'].nNeeded, 98);
  assert.equal(M.sands['100M'].nNeeded, 141);
  assert.equal(M.sands['2040'].nDesign, M0.sands['2040'].nNeeded);
  assert.equal(M.kpi.reqLoads, 494);
  assert.equal(M.kpi.reqLoadsDesign, 492);
  assert.equal(M.kpi.reqLbsDesign, M0.kpi.reqLbs);
  /* with no stats nothing changes */
  assert.equal(M0.tb.act, null);
  assert.equal(M0.tbd, M0.tb);
});

test('design + actual: stage time end to end, the calendar pinned on the PDF stage ends', () => {
  const M = model(withStats);
  const g = M.tb.act.seg[0];
  const cycles = [218, 72, 118, 95, 101, 119];                 // stage 2–7, end to end (min)
  assert.equal(g.cycN, 6);
  near(g.actCycle / MIN, cycles.reduce((a, b) => a + b, 0) / 6, 1e-9);
  near(g.fcCycle / MIN, (1440 / 19 + 723) / 7, 1e-9);
  near(g.fcPace, 1440 / ((1440 / 19 + 723) / 7), 1e-9);
  assert.equal(M.sc.anchor.k, 7);
  assert.equal(M.sc.anchor.t, at('2026-09-29T00:25:00-06:00'));
  assert.equal(M.sc.B[0], at('2026-09-28T10:53:00-06:00'), 'stage 1 began when the PDF says');
  assert.equal(M.sc.B[3], at('2026-09-28T17:12:00-06:00'));
  near(M.sc.B[8] - M.sc.B[7], g.fcCycle, 1);
  near(M.sc.B[31] - M.sc.B[30], 1440 / 19 * MIN, 1, '31–105 at its design pace');
  assert.equal(M.well.lastRep.src, 'pdf');
  near(M.well.pace.v, 6 / ((at('2026-09-29T00:25:00-06:00') - at('2026-09-28T12:22:00-06:00')) / E.DAY), 1e-9);
  const p = M.segPlans[0];
  assert.equal(p.fc, true);
  near(p.pace, g.fcPace, 1e-9);
  assert.equal(p.designPace, 19);
  near(p.per['2040'].lbs, 116869.25, 1e-6);
  assert.equal(p.per['2040'].designLbs, 111000);
  assert.equal(M.segPlans[1].fc, false);
  assert.equal(M.segPlans[1].pace, 19);
  /* the next load waits for the real well: nothing overdue at the actual pace */
  assert.equal(M.kpi.next.id, '2040-031');
  assert.equal(M.kpi.overdue, 0);
  assert.ok(model().kpi.overdue > 0, 'at the design pace from 6:00 AM it would look overdue');
});

test('design + actual: the PDF wins over a report of the same stage; a later report anchors and PDF ends stay pinned', () => {
  const r9 = at('2026-09-29T04:30:00-06:00');
  const M = model(st => {
    withStats(st);
    st.stage.push({ id: 'r7', n: 7, t: new Date(at('2026-09-29T01:00:00-06:00')).toISOString() });
    st.stage.push({ id: 'r9', n: 9, t: new Date(r9).toISOString() });
  }, r9);
  assert.equal(M.sc.reports.filter(x => x.n === 7).length, 1);
  assert.equal(M.sc.reports.find(x => x.n === 7).src, 'pdf');
  assert.equal(M.sc.anchor.k, 9);
  assert.equal(M.sc.B[9], r9);
  assert.equal(M.sc.B[7], at('2026-09-29T00:25:00-06:00'), 'the PDF stage end is still pinned');
  near(M.sc.B[8], (M.sc.B[7] + r9) / 2, 1, 'the stage in between shares the time');
  near(M.sc.X(M.sc.B[8]), 8, 1e-9);
  /* a report that contradicts a later one is left out of the pins */
  const M2 = model(st => { st.stage.push({ id: 'a', n: 20, t: new Date(at('2026-10-01T10:00:00-06:00')).toISOString() }); st.stage.push({ id: 'b', n: 18, t: new Date(at('2026-10-01T12:00:00-06:00')).toISOString() }); }, at('2026-10-01T12:00:00-06:00'));
  assert.equal(M2.sc.anchor.k, 18, 'the latest report wins');
  assert.equal(M2.sc.pts.length, 1);
});
