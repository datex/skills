import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { extractCommandLines } from './lib/cli-lines.mjs';

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
  assert.deepEqual({ ...s.moves[0], reason: undefined }, { rank: 1, material: 'M2', target: 'L2', picks: 4, lots: 2, reason: undefined });
  assert.equal(s.unplaced, 0);
  assert.deepEqual(s.fragmented, [{ material: 'M2', sourceLocations: 3, picks: 4 }]);
});

test('without IsPrimaryPick the lowest PickSequence slots form the golden zone, one per A material', () => {
  const noFlag = locations.map(l => ({ ...l, IsPrimaryPick: false }));
  const s = run({ 'picks.jsonl': picks, 'locations.jsonl': noFlag, 'inventory.jsonl': inventory });
  assert.deepEqual(s.goldenZone, { basis: 'lowest PickSequence', locations: 2, holdingA: 1, onlyC: 1, empty: 0 });
  assert.equal(s.moves[0].target, 'L2');
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
  assert.match(md, /--out inventory\.jsonl[\s\\]*&&\s*node analyse\.mjs/);
  assert.match(md, /FPX-051/);
  assert.match(md, /partial/i);
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
