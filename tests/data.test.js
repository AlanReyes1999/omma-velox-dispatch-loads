/* File reader and shared reducer tests. Run: npm test */
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

test('reads the HTML .xls export, drops other carriers and sands outside the design', () => {
  const rows = P.htmlToRows(fixture);
  assert.equal(rows.length, 7);
  const { loads, report } = P.toLoads(rows, S.DEFAULT_CONFIG, E);
  assert.equal(report.rows, 6);
  assert.equal(loads.length, 4);
  assert.equal(report.skipped['other carrier'], 1);
  assert.equal(report.skipped['sand not in design (3050)'], 1);
  assert.deepEqual(report.missing, []);
  // identical to the seeded reference
  loads.forEach(l => {
    const s = S.SEED_LOADS.find(x => x.k === l.k);
    assert.ok(s, 'load ' + l.k + ' in the seed');
    Object.keys(s).filter(k => k !== 'po').forEach(k => assert.deepEqual(l[k], s[k], l.k + '.' + k));
    assert.equal(l.po, 'PO-TEST');                  // the PO is kept (the sample carries an anonymized one)
  });
  // never stores the driver's name
  assert.ok(!JSON.stringify(loads).includes('Driver'));
});

test('CSV with quotes and semicolons', () => {
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

test('reducer: idempotent, validated operations', () => {
  const st = S.initialState();
  st.asg = {};
  let r = R.apply(st, [
    { id: 'a', type: 'asg', slot: '2040-001', c: 'OMMA', by: 'AR' },
    { id: 'a', type: 'asg', slot: '2040-001', c: 'C2' },           // repeated: ignored
    { id: 'b', type: 'asg', slot: '<script>', c: 'OMMA' },         // invalid slot
    { id: 'c', type: 'setc', slot: '2040-001', c: 'C3' },
    { id: 'd', type: 'unasg', slot: '9999-001' },                  // does not exist
    { id: 'e', type: 'cfg', config: { bad: true } }                // invalid config
  ]);
  assert.deepEqual(r.applied, ['a', 'c']);
  assert.equal(r.state.asg['2040-001'].c, 'C3');
  assert.ok(st.asg['2040-001'] === undefined, 'does not mutate its input');
  r = R.apply(r.state, [{ id: 'f', type: 'unasg', slot: '2040-001' }, { id: 'g', type: 'stage', n: 12, at: '2026-10-01T10:00:00Z' }]);
  assert.equal(Object.keys(r.state.asg).length, 0);
  assert.equal(r.state.stage.length, 1);
  r = R.apply(r.state, [{ id: 'h', type: 'stageDel', rid: 'g' }]);
  assert.equal(r.state.stage.length, 0);
});

test('reducer: merges OMMA loads without duplicates; valid config', () => {
  const st = S.initialState();
  const { loads } = P.toLoads(P.htmlToRows(fixture), S.DEFAULT_CONFIG, E);
  let r = R.apply(st, [{ id: 'm1', type: 'omma', loads, meta: { file: 'x.xls' } }]);
  assert.equal(r.state.omma.loads.length, 4);
  r = R.apply(r.state, [{ id: 'm2', type: 'omma', loads: loads.slice(0, 1), mode: 'replace', meta: {} }]);
  assert.equal(r.state.omma.loads.length, 1);
  const cfg = S.clone(S.DEFAULT_CONFIG); cfg.job.totalStages = 110;
  r = R.apply(r.state, [{ id: 'm3', type: 'cfg', config: cfg, txt: 'stages 110' }]);
  assert.equal(r.state.config.job.totalStages, 110);
  assert.ok(R.validConfig(S.DEFAULT_CONFIG));
});

test('reducer: init only seeds an empty store', () => {
  const seed = S.initialState();
  let r = R.apply(null, [{ id: 'i1', type: 'init', state: seed }]);
  assert.equal(r.state.config.job.totalStages, 105);
  r = R.apply(r.state, [{ id: 'i2', type: 'asg', slot: '100M-001', c: 'OMMA' }, { id: 'i3', type: 'init', state: S.initialState() }]);
  assert.ok(r.state.asg['100M-001'], 'a late init does not wipe assignments');
});

test('reducer: starting point (reseed) once per revision, keeps OMMA loads and stage reports', () => {
  const old = S.initialState();
  delete old.seedRev; old.asg = { '2040-005': { c: 'C2', t: '2026-09-27T10:00:00Z' } };
  old.stage = [{ id: 'r1', n: 3, t: '2026-09-28T09:00:00Z' }];
  const op = { id: 'rs1', type: 'reseed', rev: S.REV, config: S.clone(S.DEFAULT_CONFIG), asg: S.baselineAsg(), txt: 'x' };
  let r = R.apply(old, [op]);
  assert.deepEqual(r.applied, ['rs1']);
  assert.equal(Object.keys(r.state.asg).length, 37);
  assert.equal(r.state.seedRev, S.REV);
  assert.equal(r.state.stage.length, 1);
  assert.equal(r.state.omma.loads.length, 4);
  r = R.apply(r.state, [Object.assign({}, op, { id: 'rs2' })]);          // another client, same revision
  assert.deepEqual(r.applied, []);
  assert.equal(Object.keys(r.state.asg).length, 37);
});

test('reducer: revision-2 patch updates only untouched fields and never touches check marks', () => {
  const v2 = S.initialState();
  v2.seedRev = 2;
  v2.config.schedule.prefillStart = '2026-09-23T00:00';
  v2.config.countFrom = '2026-09-22T12:00';                  // edited by dispatch: must stay
  v2.config.po = { '100M': '', '4070': '', '2040': 'PO-MINE' };  // 20/40 captured by dispatch: must stay
  delete v2.config.finalCountsPct;
  v2.omma.meta.file = 'Excel extracto de loads OMMA (referencia inicial)';
  v2.asg['2040-031'] = { c: 'C2', t: '2026-09-28T07:40:00Z', by: 'AR' };
  const op = { id: 'p1', type: 'reseed', rev: S.REV, patch: S.patchFrom(2), txt: 'x' };
  let r = R.apply(v2, [op]);
  assert.deepEqual(r.applied, ['p1']);
  const c = r.state.config;
  assert.equal(c.schedule.prefillStart, '2026-09-23T18:00');
  assert.equal(c.countFrom, '2026-09-22T12:00');
  assert.deepEqual(c.po, { '100M': 'SPA00021226', '4070': 'SPA00021227', '2040': 'PO-MINE' });
  assert.equal(c.finalCountsPct, 80);
  assert.equal(r.state.omma.meta.file, 'OMMA loads extract (initial reference)');
  assert.equal(Object.keys(r.state.asg).length, 38);         // check marks untouched
  assert.equal(r.state.seedRev, S.REV);
  r = R.apply(r.state, [Object.assign({}, op, { id: 'p2' })]);
  assert.deepEqual(r.applied, []);                           // once per revision
  assert.equal(R.applyPatch({ config: {}, meta: null }, { path: 'config.__proto__.x', from: '', to: 1 }), false);
  assert.equal(R.applyPatch({ config: {}, meta: null }, { path: 'asg.2040-001', from: '', to: 1 }), false);
});

test('reducer: final counts confirmation, range assign and its undo', () => {
  const st = S.initialState();
  let r = R.apply(st, [{ id: 'f1', type: 'fc', n: 394, by: 'AR', note: 'confirmed remaining loads' }]);
  assert.equal(r.state.fc.n, 394);
  assert.equal(r.state.fc.by, 'AR');
  r = R.apply(r.state, [{ id: 'f2', type: 'fcClear' }, { id: 'f3', type: 'fcClear' }]);
  assert.deepEqual(r.applied, ['f2']);
  assert.equal(r.state.fc, null);
  const items = ['2040-031', '2040-032', '2040-033'].map(slot => ({ slot, c: '' }));
  r = R.apply(r.state, [{ id: 'b1', type: 'bulk', items: items.concat([{ slot: 'bad slot' }]), txt: 'range #38–#40' }]);
  assert.equal(Object.keys(r.state.asg).length, 40);
  assert.equal(r.state.log[r.state.log.length - 1].n, 3);
  r = R.apply(r.state, [{ id: 'u1', type: 'unbulk', slots: items.map(i => i.slot) }]);
  assert.equal(Object.keys(r.state.asg).length, 37);
  r = R.apply(r.state, [{ id: 'u2', type: 'unbulk', slots: ['2040-099'] }]);
  assert.deepEqual(r.applied, []);
});

test('reducer: an automatic starting point is decided against the live state', () => {
  const full = () => ({ type: 'reseed', rev: S.REV, auto: true, from: 2, patch: S.patchFrom(2), config: S.clone(S.DEFAULT_CONFIG), asg: S.baselineAsg(), txt: 'x' });
  /* revision 2 on the server with someone's work after its reseed: a client with a stale cache sends the
     automatic op; the server patches instead of replacing, so no check mark is lost */
  const live = S.initialState();
  live.seedRev = 2; live.config.schedule.prefillStart = '2026-09-23T00:00'; live.config.po = { '100M': '', '4070': '', '2040': '' };
  live.log = [{ t: '2026-09-28T07:40:00Z', type: 'reseed', n: 37 }, { t: '2026-09-28T07:50:00Z', type: 'asg', slot: '2040-031' }];
  live.asg['2040-031'] = { c: '', t: '2026-09-28T07:50:00Z', by: 'B', o: 1 };
  live.asg['2040-032'] = { c: '', t: '2026-09-28T07:51:00Z', by: 'B', o: 2 };
  let r = R.apply(live, [Object.assign(full(), { id: 'r1' })]);
  assert.deepEqual(r.applied, ['r1']);
  assert.equal(Object.keys(r.state.asg).length, 39, 'check marks kept');
  assert.equal(r.state.config.schedule.prefillStart, '2026-09-23T18:00');
  assert.equal(r.state.config.po['4070'], 'SPA00021227');
  assert.equal(r.state.config.po['2040'], 'PO-24918');
  /* nobody worked since the last starting point → full starting point */
  const idle = S.initialState(); idle.seedRev = 2; idle.log = [{ t: '2026-09-28T07:40:00Z', type: 'reseed', n: 37 }];
  idle.asg['2040-031'] = { c: '', t: '2026-09-28T07:50:00Z' };
  r = R.apply(idle, [Object.assign(full(), { id: 'r2' })]);
  assert.equal(Object.keys(r.state.asg).length, 37);
  /* an older state with work is never replaced automatically; only a confirmed (non-auto) op does it */
  const old = S.initialState(); delete old.seedRev; old.log = [{ t: '2026-09-27T23:10:00Z', type: 'asg', slot: '2040-005' }];
  old.asg = { '2040-005': { c: 'C2', t: '2026-09-27T20:00:00Z' } };
  r = R.apply(old, [Object.assign(full(), { id: 'r3' })]);
  assert.deepEqual(r.applied, []);
  assert.equal(Object.keys(r.state.asg).length, 1);
  r = R.apply(old, [{ id: 'r4', type: 'reseed', rev: S.REV, config: S.clone(S.DEFAULT_CONFIG), asg: S.baselineAsg() }]);
  assert.equal(Object.keys(r.state.asg).length, 37);
});

test('reducer: revision-3 update corrects the POs and keeps every check mark', () => {
  /* the live state: revision 2 loaded 37 check marks, someone removed 2040-030, then the revision-3 patch */
  const live = S.initialState();
  live.seedRev = 3;
  live.config.po = { '100M': 'SPA00021226', '4070': 'PO-24918', '2040': 'PO-1236' };
  delete live.asg['2040-030'];
  live.log = [
    { t: '2026-09-28T06:00:00Z', type: 'reseed', n: 37 },
    { t: '2026-09-28T06:30:00Z', type: 'unasg', slot: '2040-030' },
    { t: '2026-09-28T09:10:00Z', type: 'reseed', n: 0, patch: 7 }
  ];
  /* work from before a patch still counts: a full starting point would wipe it */
  assert.equal(R.workedSinceReseed(live.log), true);
  assert.equal(R.workedSinceReseed(live.log.filter(e => e.type === 'reseed')), false);
  const op = { id: 'q1', type: 'reseed', rev: S.REV, auto: true, from: 3, patch: S.patchFrom(3), patchTxt: S.patchNote(3),
    config: S.clone(S.DEFAULT_CONFIG), asg: S.baselineAsg(), txt: 'x' };
  let r = R.apply(live, [op]);
  assert.deepEqual(r.applied, ['q1']);
  assert.deepEqual(r.state.config.po, { '100M': 'SPA00021226', '4070': 'SPA00021227', '2040': 'PO-24918' });
  assert.equal(Object.keys(r.state.asg).length, 36, 'check marks untouched');
  assert.ok(!r.state.asg['2040-030']);
  assert.equal(r.state.seedRev, S.REV);
  const last = r.state.log[r.state.log.length - 1];
  assert.equal(last.patch, 2);
  assert.equal(last.txt, 'POs corrected · 20/40 PO-24918 · 40/70 SPA00021227');
  /* a PO that dispatch already typed in Plan stays as they left it */
  const typed = S.clone(live); typed.config.po['2040'] = 'PO-7777';
  r = R.apply(typed, [Object.assign({}, op, { id: 'q2' })]);
  assert.equal(r.state.config.po['2040'], 'PO-7777');
  assert.equal(r.state.config.po['4070'], 'SPA00021227');
  /* the default design and a new shared state carry the corrected POs */
  assert.deepEqual(S.DEFAULT_CONFIG.po, { '100M': 'SPA00021226', '4070': 'SPA00021227', '2040': 'PO-24918' });
  assert.deepEqual(S.patchFrom(4), []);
});

test('reducer: hostile input is refused', () => {
  const st = S.initialState();
  let r = R.apply(st, [{ id: 'p1', type: 'setc', slot: '__proto__', c: 'x' }, { id: 'p2', type: 'unasg', slot: '__proto__' }, { id: 'p3', type: 'asg', slot: 'constructor' }]);
  assert.deepEqual(r.applied, []);
  assert.equal(({}).c, undefined, 'no prototype pollution');
  r = R.apply(r.state, [{ id: 'i9', type: 'init', force: true, state: S.initialState() }]);
  assert.deepEqual(r.applied, [], 'init never replaces a live state');
  const bad = S.clone(S.DEFAULT_CONFIG); bad.tz = 'Mars/Base';
  assert.equal(R.validConfig(bad), false);
  const bad2 = S.clone(S.DEFAULT_CONFIG); bad2.mines = null;
  assert.equal(R.validConfig(bad2), false);
  const bad3 = S.clone(S.DEFAULT_CONFIG); bad3.sands[0].mine = 'NOPE';
  assert.equal(R.validConfig(bad3), false);
  const bad4 = S.clone(S.DEFAULT_CONFIG); bad4.segments[0].pace = null;
  assert.equal(R.validConfig(bad4), false);
  r = R.apply(st, [{ id: 'o1', type: 'omma', loads: [{ k: 'z|1', n: 'z', s: '2040', w: 50000, driver: 'Jane Doe', nested: { a: 1 } }], meta: { file: 'x.xls', __proto__: { evil: 1 }, driver: 'Jane' } }]);
  const l = r.state.omma.loads.find(x => x.k === 'z|1');
  assert.ok(l && !('driver' in l) && !('nested' in l), 'only known load fields are kept');
  assert.ok(!('driver' in r.state.omma.meta));
  r = R.apply(st, [{ id: 't1', type: 'asg', slot: '2040-050', t: 'garbage' }, { id: 'x'.repeat(200), type: 'asg', slot: '2040-051' }]);
  assert.ok(isFinite(Date.parse(r.state.asg['2040-050'].t)), 'bad time replaced by now');
  assert.ok(!r.state.asg['2040-051'], 'oversized id ignored');
});

test('config: driver hours per shift within 4–16', () => {
  const c = S.clone(S.DEFAULT_CONFIG);
  assert.equal(R.validConfig(Object.assign(S.clone(c), { drivers: { shiftH: 12 } })), true);
  assert.equal(R.validConfig(Object.assign(S.clone(c), { drivers: {} })), true);
  assert.equal(R.validConfig(Object.assign(S.clone(c), { drivers: { shiftH: 40 } })), false);
  assert.equal(R.validConfig(Object.assign(S.clone(c), { drivers: 'x' })), false);
});
