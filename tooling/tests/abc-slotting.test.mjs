import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { extractCommandLines, splitCommand } from './lib/cli-lines.mjs';
import { ALIAS_FLAGS, hasFlag, aliasHelp } from './lib/run-cli.mjs';

const DIR = 'skills/datex-studio/agent-creator/references/examples/abc-slotting';
const md = existsSync(join(DIR, 'abc-slotting.md')) ? readFileSync(join(DIR, 'abc-slotting.md'), 'utf8') : '';

function script() {
  const m = /```js analyse\.mjs\r?\n([\s\S]*?)```/.exec(md);
  assert.ok(m, 'abc-slotting.md carries a ```js analyse.mjs block');
  return m[1];
}
const jsonl = rows => rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');

function run(fixture, extra = []) {
  const dir = mkdtempSync(join(tmpdir(), 'abc-'));
  writeFileSync(join(dir, 'analyse.mjs'), script());
  for (const [name, rows] of Object.entries(fixture)) writeFileSync(join(dir, name), jsonl(rows));
  const r = spawnSync(process.execPath, [join(dir, 'analyse.mjs'), dir, ...extra], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

// 20 picks: M1 x12 (A), M2 x4 (A, picked from 3 locations), M3 x2 (B), M4 x1 (B), M5 x1 (C).
const pick = (MaterialId, loc) => ({ MaterialId, Material: { LookupCode: `M${MaterialId}` }, ActualSourceLocationId: loc, ActualPackagedAmount: 1 });
const picks = [
  ...Array.from({ length: 12 }, () => pick(1, 1)),
  pick(2, 4), pick(2, 4), pick(2, 5), pick(2, 1),
  pick(3, 5), pick(3, 5), pick(4, 4), pick(5, 4),
];
const loc = (Id, IsPrimaryPick, PickSequence, Enabled = true) => ({ Id, Name: `L${Id}`, IsPrimaryPick, PickSequence, Enabled, EligibleForAllocation: true });
const locations = [loc(1, true, 1), loc(2, true, 2), loc(3, true, 3, false), loc(4, false, 10), loc(5, false, 11)];
const inv = (LocationId, MaterialId, LotId, TotalPackagedAmount) => ({ LocationId, MaterialId, Material: { LookupCode: `M${MaterialId}` }, LotId, TotalPackagedAmount });
const inventory = [inv(1, 1, 10, 50), inv(4, 2, 100, 5), inv(4, 2, 101, 7), inv(2, 6, 60, 9), inv(5, 3, 30, 4)];

test('classes by cumulative share before each material; unpicked stock is C', () => {
  const s = run({ 'picks.jsonl': picks, 'locations.jsonl': locations, 'inventory.jsonl': inventory });
  assert.equal(s.picks, 20);
  assert.equal(s.materialsPicked, 5);
  assert.equal(s.sourceLocations, 3);
  assert.deepEqual(s.classes.A, { materials: 2, pickShare: 80 });
  assert.deepEqual(s.classes.B, { materials: 2, pickShare: 15 });
  assert.deepEqual(s.classes.C, { materials: 2, pickShare: 5, neverPicked: 1 });
});

test('golden zone occupancy, a disabled empty slot is never a target, one move proposed', () => {
  const s = run({ 'picks.jsonl': picks, 'locations.jsonl': locations, 'inventory.jsonl': inventory });
  assert.deepEqual(s.goldenZone, { basis: 'IsPrimaryPick', locations: 3, holdingA: 1, onlyC: 1, empty: 1 });
  assert.equal(s.aWithoutPrimarySlot, 1);
  assert.equal(s.moves.length, 1);
  assert.deepEqual({ ...s.moves[0], reason: undefined }, { rank: 1, material: 'M2', target: 'L2', targetId: 2, picks: 4, lots: 2, reason: undefined });
  assert.equal(s.unplaced, 0);
  assert.deepEqual(s.fragmented, [{ material: 'M2', sourceLocations: 3, picks: 4 }]);
});

test('without IsPrimaryPick the lowest PickSequence slots form the golden zone, one per A material', () => {
  const noFlag = locations.map(l => ({ ...l, IsPrimaryPick: false }));
  const s = run({ 'picks.jsonl': picks, 'locations.jsonl': noFlag, 'inventory.jsonl': inventory });
  assert.deepEqual(s.goldenZone, { basis: 'lowest PickSequence', locations: 2, holdingA: 1, onlyC: 1, empty: 0 });
  assert.equal(s.moves[0].target, 'L2');
  assert.equal(s.moves[0].targetId, 2);
  assert.match(s.notes.join(' '), /golden zone inferred from the lowest PickSequence; no location carries IsPrimaryPick/);
});

test('Review Focus 5: an empty window is a summary with a note, not a crash', () => {
  const s = run({ 'picks.jsonl': [], 'locations.jsonl': locations, 'inventory.jsonl': inventory });
  assert.equal(s.picks, 0);
  assert.deepEqual(s.moves, []);
  assert.match(s.notes.join(' '), /widen the window/);
});

test('custom cut-offs and --top are honoured', () => {
  const s = run({ 'picks.jsonl': picks, 'locations.jsonl': locations, 'inventory.jsonl': inventory }, ['--a', '0.5', '--top', '0']);
  assert.equal(s.classes.A.materials, 1);
  assert.equal(s.moves.length, 0);
});

test('Review Focus 1/3: exports use -D files and are chained with &&; partial files are named', () => {
  const exports = extractCommandLines(md, 'fpx').filter(l => l.includes('--all'));
  assert.equal(exports.length, 3, 'pick-history, locations, inventory');
  for (const l of exports) assert.match(l, /\s-D\s/);
  assert.match(md, /--out slotting\/inventory\.jsonl[\s\\]*&&\s*node slotting\/analyse\.mjs/);
  assert.match(md, /FPX-051/);
  assert.match(md, /partial/i);
});

test('every fpx alias flag named in abc-slotting.md is valid', () => {
  const aliasHelpText = aliasHelp(); // real `fpx <alias> --help`; fall back to ALIAS_FLAGS only when fpx can't produce it
  const lines = extractCommandLines(md, 'fpx');
  assert.ok(lines.length > 0, 'at least one fpx command line');
  for (const line of lines) {
    const { flags } = splitCommand(line);
    for (const f of flags) assert.ok(aliasHelpText ? hasFlag(aliasHelpText, f) : ALIAS_FLAGS.has(f), `alias flag ${f} in: ${line}`);
  }
});

// --- Fix round 1 ---

test('Fix 1/inGolden perf: a material stocked in a golden location is not proposed as a move (unchanged behaviour, now O(n))', () => {
  const s = run({ 'picks.jsonl': picks, 'locations.jsonl': locations, 'inventory.jsonl': inventory });
  // M1 (class A) is stocked at L1, a golden location, so it must never appear among the moves.
  assert.ok(!s.moves.some(m => m.material === 'M1'));
});

test('Fix 2/8b: inventory rows with a non-numeric or zero amount are not stock (NaN and zero)', () => {
  const locs = [loc(1, true, 1), loc(2, true, 2)];
  const badInventory = [
    inv(1, 99, 1, 'n/a'),
    inv(2, 98, 2, 0),
  ];
  const s = run({ 'picks.jsonl': [], 'locations.jsonl': locs, 'inventory.jsonl': badInventory });
  assert.deepEqual(s.goldenZone, { basis: 'IsPrimaryPick', locations: 2, holdingA: 0, onlyC: 0, empty: 2 });
});

test('Fix 3: a pick with a null/undefined source location is not counted toward sourceLocations or fragmentation', () => {
  const rows = [pick(1, 1), pick(1, 1), pick(1, null), pick(1, undefined)];
  const s = run({ 'picks.jsonl': rows, 'locations.jsonl': locations, 'inventory.jsonl': inventory });
  assert.equal(s.sourceLocations, 1);
  assert.deepEqual(s.fragmented, []);
});

test('Fix 4: an A material with no inventory anywhere is reported as aWithoutStock, never proposed as a move', () => {
  const rows = Array.from({ length: 10 }, () => pick(7, 1));
  const locs = [loc(1, true, 1)];
  const s = run({ 'picks.jsonl': rows, 'locations.jsonl': locs, 'inventory.jsonl': [] });
  assert.deepEqual(s.aWithoutStock, ['M7']);
  assert.equal(s.aWithoutPrimarySlot, 0);
  assert.equal(s.moves.length, 0);
  assert.equal(s.unplaced, 0);
});

test('Fix 4: aWithoutStock is capped at 20 codes', () => {
  const rows = [];
  for (let i = 1; i <= 25; i++) rows.push(pick(100 + i, 1));
  const locs = [loc(1, true, 1)];
  const s = run({ 'picks.jsonl': rows, 'locations.jsonl': locs, 'inventory.jsonl': [] }, ['--a', '0.999']);
  assert.equal(s.aWithoutStock.length, 20);
});

test('Fix 5: fallback golden zone only considers usable locations with a positive PickSequence, and notes the inference', () => {
  const locs = [
    loc(1, false, 0), // PickSequence 0: not > 0, excluded
    loc(2, false, 1, false), // disabled: excluded even though lowest positive sequence
    loc(3, false, 2),
    loc(4, false, 3),
  ];
  const onePick = [pick(1, 3)];
  const s = run({ 'picks.jsonl': onePick, 'locations.jsonl': locs, 'inventory.jsonl': [] });
  assert.deepEqual(s.goldenZone, { basis: 'lowest PickSequence', locations: 1, holdingA: 0, onlyC: 0, empty: 1 });
  assert.match(s.notes.join(' '), /golden zone inferred from the lowest PickSequence; no location carries IsPrimaryPick/);
});

test('Fix 6: a duplicated pick row (same Id) is counted once and reported', () => {
  const dupPick = (Id, MaterialId, l) => ({ Id, MaterialId, Material: { LookupCode: `M${MaterialId}` }, ActualSourceLocationId: l, ActualPackagedAmount: 1 });
  const rows = [dupPick(1, 1, 1), dupPick(2, 1, 1), dupPick(2, 1, 1), dupPick(3, 2, 4)];
  const s = run({ 'picks.jsonl': rows, 'locations.jsonl': locations, 'inventory.jsonl': inventory });
  assert.equal(s.picks, 3);
  assert.equal(s.duplicatePicksDropped, 1);
  assert.equal(s.materialsPicked, 2);
});

test('Fix 6: materials tied on picks and qty are ranked by MaterialId ascending', () => {
  const rows = [pick(9, 3), pick(5, 3)];
  const locs = [loc(1, true, 1), loc(2, true, 2)];
  const inv2 = [inv(3, 9, 1, 5), inv(3, 5, 2, 5)];
  const s = run({ 'picks.jsonl': rows, 'locations.jsonl': locs, 'inventory.jsonl': inv2 }, ['--a', '0.999']);
  assert.equal(s.moves[0].material, 'M5');
  assert.equal(s.moves[1].material, 'M9');
});

test('Fix 8a: a disabled primary-pick location holding only C stock is never a move target', () => {
  const locs = [loc(1, true, 1, false), loc(2, false, 2)];
  const invRows = [inv(1, 50, 900, 5), inv(2, 10, 901, 3)];
  const rows = [pick(10, 2)];
  const s = run({ 'picks.jsonl': rows, 'locations.jsonl': locs, 'inventory.jsonl': invRows }, ['--a', '0.999']);
  assert.equal(s.goldenZone.onlyC, 1);
  assert.equal(s.moves.length, 0);
  assert.equal(s.unplaced, 1);
});

test('Fix 8c: empty golden slots outrank only-C slots, so the higher-picked material gets the empty slot', () => {
  const locs = [loc(1, true, 1), loc(2, true, 2)];
  const invRows = [
    inv(1, 60, 1, 5), // L1 holds a never-picked (class C) material -> only-C slot
    inv(3, 20, 2, 5), // material 20's stock lives off-golden
    inv(3, 30, 3, 5), // material 30's stock lives off-golden
  ];
  const rows = [
    ...Array.from({ length: 5 }, () => pick(20, 3)),
    ...Array.from({ length: 2 }, () => pick(30, 3)),
  ];
  const s = run({ 'picks.jsonl': rows, 'locations.jsonl': locs, 'inventory.jsonl': invRows }, ['--a', '0.999']);
  assert.equal(s.moves[0].material, 'M20');
  assert.equal(s.moves[0].targetId, 2); // L2 is empty -> preferred target
  assert.equal(s.moves[1].material, 'M30');
  assert.equal(s.moves[1].targetId, 1); // L1 holds only-C stock -> second-choice target
});

test('owned-skill rules: no Studio internals, aliases only', () => {
  for (const bad of [/\$datasources/, /\$flows/, /\bdxs /, /ds_slot_/, /FootprintManager\//]) assert.doesNotMatch(md, bad, `found ${bad}`);
});

test('agent.json carries this markdown verbatim and the aliases the skill uses', () => {
  const agent = JSON.parse(readFileSync(join(DIR, 'agent.json'), 'utf8'));
  assert.equal(agent.configurationTypeId, 38);
  assert.equal(agent.skills.length, 1);
  assert.equal(agent.skills[0].source, 'owned');
  assert.equal(agent.skills[0].content, md);
  const aliases = new Set(agent.commands.map(c => c.alias));
  for (const a of ['warehouses', 'pick-history', 'locations', 'inventory', 'empty-locations']) assert.ok(aliases.has(a), a);
  assert.match(agent.profile.systemPrompt, /abc-slotting/);
  assert.doesNotMatch(agent.profile.systemPrompt, /start at skip 0/);
});
