---
name: abc-slotting
description: Use when asked to analyse pick velocity, classify materials A/B/C (Pareto), review how well a warehouse is slotted, or propose re-slotting moves that bring fast movers to primary pick locations.
---

# ABC / Pareto slotting analysis

You rank every material of one warehouse by how often it was picked over a recent window,
split the ranking into A, B and C classes by cumulative share of picks, and compare each
class with where its inventory sits. The output is a short report and a ranked list of
proposed moves. Nothing is moved: proposals are for a human to apply.

The pick history of a warehouse runs to tens of thousands of rows. Never read those rows
yourself. Export them to files with the script below and let it compute the answer; you read
only its summary.

## Inputs to settle first

1. **Warehouse.** Run `warehouses` with `full_text_filter` set to the name the user gives. If
   the user names none, run it with an empty `full_text_filter` and ask which one.
2. **Window.** Default to the last 6 months (`dateFrom` = today minus 6 months, `dateTo` =
   today, ISO dates). Use 12 months when the user asks for a seasonal view.
3. **Cut-offs.** Default A = first 80% of cumulative picks, B = up to 95%, C = the rest. Use
   the user's cut-offs when given (`--a` and `--b` below, as fractions).

## Run the analysis

In a fresh working directory, write the three parameter files, export the three lists, and
run the analysis. Replace `12` and the dates with the settled inputs.

```bash
mkdir -p slotting && cd slotting
printf '{"warehouseId": %s, "skip": 0}' 12 > warehouse.json
printf '{"warehouseId": %s, "dateFrom": "%s", "dateTo": "%s", "skip": 0}' 12 2026-04-01 2026-09-30 > picks.json
fpx pick-history -D picks.json --all --out picks.jsonl \
  && fpx locations -D warehouse.json --all --out locations.jsonl \
  && fpx inventory -D warehouse.json --all --out inventory.jsonl \
  && node analyse.mjs .
```

Before the first run, write the script below to `analyse.mjs` in that directory. Add
`--a 0.7 --b 0.9` for other cut-offs and `--top 50` for a longer move list.

If any export fails, its file is **partial**: `FPX-051` reports how many of the total rows
arrived before a short page. Delete the `.jsonl` files and rerun the whole block; never
analyse a partial export. Each export prints only a row count, so the conversation stays small.

```js analyse.mjs
// analyse.mjs - ABC/Pareto slotting from three fpx exports in one directory.
// Usage: node analyse.mjs <dir> [--a 0.8] [--b 0.95] [--top 20]
// Reads <dir>/picks.jsonl, locations.jsonl, inventory.jsonl and prints one JSON summary.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const dir = argv[0] && !argv[0].startsWith('--') ? argv[0] : '.';
const num = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = Number(argv[i + 1]);
  if (!Number.isFinite(v)) { console.error(`--${name} needs a number`); process.exit(2); }
  return v;
};
const A_CUT = num('a', 0.8);
const B_CUT = num('b', 0.95);
const TOP = num('top', 20);

function read(name) {
  const path = join(dir, name);
  if (!existsSync(path)) { console.error(`missing ${path}: export it with fpx first`); process.exit(2); }
  const text = readFileSync(path, 'utf8').trim();
  return text === '' ? [] : text.split(/\r?\n/).map(line => JSON.parse(line));
}
const picks = read('picks.jsonl');
const locations = read('locations.jsonl');
const inventory = read('inventory.jsonl');
const pct = (n, d) => (d === 0 ? 0 : Math.round((1000 * n) / d) / 10);

// Velocity: pick task count per material; quantity only breaks ties.
const byMaterial = new Map();
for (const p of picks) {
  let m = byMaterial.get(p.MaterialId);
  if (!m) {
    m = { id: p.MaterialId, code: p.Material?.LookupCode ?? String(p.MaterialId), picks: 0, qty: 0, sources: new Set() };
    byMaterial.set(p.MaterialId, m);
  }
  m.picks += 1;
  m.qty += Number(p.ActualPackagedAmount ?? 0);
  m.sources.add(p.ActualSourceLocationId);
}
const ranked = [...byMaterial.values()].sort((x, y) => y.picks - x.picks || y.qty - x.qty);
let before = 0;
for (const m of ranked) {
  const share = picks.length === 0 ? 1 : before / picks.length;
  m.cls = share < A_CUT ? 'A' : share < B_CUT ? 'B' : 'C';
  before += m.picks;
}
const classOf = id => byMaterial.get(id)?.cls ?? 'C'; // never picked in the window

// Stock per location and material; lots per material.
const stock = new Map();
const lots = new Map();
for (const r of inventory) {
  const amount = Number(r.TotalPackagedAmount ?? 0);
  if (amount <= 0) continue;
  if (!stock.has(r.LocationId)) stock.set(r.LocationId, new Map());
  const held = stock.get(r.LocationId);
  held.set(r.MaterialId, (held.get(r.MaterialId) ?? 0) + amount);
  if (!lots.has(r.MaterialId)) lots.set(r.MaterialId, new Set());
  if (r.LotId != null) lots.get(r.MaterialId).add(r.LotId);
}

// Golden zone: IsPrimaryPick; without the flag, the lowest PickSequence slots, one per A material.
const aMaterials = ranked.filter(m => m.cls === 'A');
const flagged = locations.filter(l => l.IsPrimaryPick === true);
const golden = flagged.length > 0
  ? flagged
  : locations.filter(l => l.PickSequence != null).sort((x, y) => x.PickSequence - y.PickSequence).slice(0, aMaterials.length);
const goldenIds = new Set(golden.map(l => l.Id));
const usable = l => l.Enabled !== false && l.EligibleForAllocation !== false;

let holdingA = 0;
let onlyC = 0;
let empty = 0;
const targets = [];
for (const l of golden) {
  const held = stock.get(l.Id);
  if (!held || held.size === 0) {
    empty += 1;
    if (usable(l)) targets.push({ l, why: 'empty primary-pick location', order: 0 });
    continue;
  }
  const classes = [...held.keys()].map(classOf);
  if (classes.includes('A')) holdingA += 1;
  if (classes.every(c => c === 'C')) {
    onlyC += 1;
    if (usable(l)) targets.push({ l, why: 'primary-pick location holding only C stock', order: 1 });
  }
}
targets.sort((x, y) => x.order - y.order || (x.l.PickSequence ?? Infinity) - (y.l.PickSequence ?? Infinity));

const inGolden = id => [...stock].some(([locationId, held]) => goldenIds.has(locationId) && held.has(id));
const lacking = aMaterials.filter(m => !inGolden(m.id));
const moves = lacking.slice(0, Math.min(TOP, targets.length)).map((m, i) => ({
  rank: i + 1,
  material: m.code,
  target: targets[i].l.Name,
  picks: m.picks,
  lots: lots.get(m.id)?.size ?? 0,
  reason: `A material with no primary-pick slot; target: ${targets[i].why}`,
}));

const neverPicked = [...lots.keys()].filter(id => !byMaterial.has(id)).length;
const inClass = c => ranked.filter(m => m.cls === c);
const shareOf = c => pct(inClass(c).reduce((s, m) => s + m.picks, 0), picks.length);
console.log(JSON.stringify({
  picks: picks.length,
  materialsPicked: ranked.length,
  sourceLocations: new Set(picks.map(p => p.ActualSourceLocationId)).size,
  classes: {
    A: { materials: inClass('A').length, pickShare: shareOf('A') },
    B: { materials: inClass('B').length, pickShare: shareOf('B') },
    C: { materials: inClass('C').length + neverPicked, pickShare: shareOf('C'), neverPicked },
  },
  goldenZone: { basis: flagged.length > 0 ? 'IsPrimaryPick' : 'lowest PickSequence', locations: golden.length, holdingA, onlyC, empty },
  aWithoutPrimarySlot: lacking.length,
  moves,
  unplaced: lacking.length - moves.length,
  fragmented: ranked.filter(m => m.sources.size >= 3).slice(0, 10)
    .map(m => ({ material: m.code, sourceLocations: m.sources.size, picks: m.picks })),
  notes: picks.length === 0 ? ['no picks in the window: widen the window or check the warehouse'] : [],
}, null, 2));
```

## Read the summary

- `classes`: how many materials fall in A, B and C and their share of picks. Materials with
  stock but no picks in the window are C (`neverPicked`).
- `goldenZone`: the primary-pick locations and what they hold. `basis: lowest PickSequence`
  means no location carries the primary-pick flag; say so in the report.
- `moves`: A materials with no stock in the golden zone, each paired with an enabled,
  allocatable golden-zone slot that is empty or holds only C stock. Ranked by picks.
- `unplaced`: A materials that still lack a slot after every free target was used.
- `fragmented`: materials picked from three or more locations.
- `notes`: anything that makes the numbers unreliable, such as an empty window.

## Decision rules

- Rank by pick **task count**, never by quantity. One task is one trip.
- A move whose material has `lots` above 1 moves stock split across lots: name the lot count
  in the proposal.
- Before recommending a target, you may run `empty-locations` with `warehouseId` and the
  target's `locationId` to offer free bins nearby as alternatives.
- Include the material lookup code and the target location name in every proposal.
- Do not create tasks or move stock. You analyse and propose.

## Report format

```
Warehouse: <name> (<id>)   Window: <from> .. <to>
Picks analysed: <picks> tasks over <materialsPicked> materials, <sourceLocations> source locations
Classes: A = <n> materials (<share>% of picks), B = <n> (<share>%), C = <n> (<share>%, <neverPicked> never picked)
Golden zone (<basis>): <locations> locations; <holdingA> hold A stock, <onlyC> hold only C stock, <empty> empty

Top proposed moves (material -> target location, picks in window):
 1. <material> -> <target> (<picks>)   <reason>
 2. ...

Unplaced A materials: <unplaced>
Notes: <fragmented materials, notes, assumptions>
```
