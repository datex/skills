# ABC slotting agent — reference example

This is a reference Agent application (spec §4.9): an on-demand agent that ranks a
warehouse's materials by pick frequency over a recent window, classes them A/B/C by
cumulative pick share (Pareto), compares the classes with where inventory actually sits, and
proposes re-slotting moves. It is analysis only — it never moves stock or creates tasks. Its
single owned skill, `abc-slotting.md`, is the agent's entire runtime instructions; `agent.json`
is the upsert body for `dxs configuration upsert agent`.

## Commands

| Alias | One row is | Required parameters |
|---|---|---|
| `warehouses` | One warehouse (Id, Name) | `full_text_filter: string` (empty string lists all) |
| `pick-history` | One completed pick task | `warehouseId: number`, `dateFrom: date`, `dateTo: date`, `skip: number` |
| `locations` | One storage location | `warehouseId: number`, `skip: number` |
| `inventory` | One location x lot x packaging inventory row | `warehouseId: number`, `skip: number` |
| `materials` | One material master row | `skip: number` (optional `projectId: number`) |
| `empty-locations` | One empty location near a given location | `warehouseId: number`, `locationId: number` |

## Why a script

The pick history of one warehouse over a six-month window routinely runs to tens of
thousands of rows, and each paged datasource call caps at 5000 rows. Handing rows to the
model one page at a time would burn the context on numbers nobody reads and would still need
the model to do the arithmetic. Instead the skill has the agent export `pick-history`,
`locations` and `inventory` to newline-delimited JSON files with `fpx ... --all --out
<file>.jsonl` — `--all` pages through the 5000-row cap automatically — and then run the
embedded `analyse.mjs` script over the files. The agent reads only the script's JSON summary:
class sizes, golden-zone occupancy, and the ranked move list. Raw rows never enter the
conversation.

## Rebuild `agent.json`

After editing `abc-slotting.md`, regenerate `agent.json` in place so `skills[0].content` stays
byte-identical to the markdown. Run this from the **repo root** — `SRC` must point at the
example's own `agent.json` via `$EX`, not at a same-named file elsewhere:

```bash
EX=skills/datex-studio/agent-creator/references/examples/abc-slotting
SRC=$EX/agent.json
node -e '
const fs = require("fs"); const [src, ex] = process.argv.slice(1);
const a = JSON.parse(fs.readFileSync(src, "utf8"));
a.skills = [{ name: "abc-slotting", source: "owned", content: fs.readFileSync(ex + "/abc-slotting.md", "utf8") }];
a.profile.systemPrompt = "You are the ABC slotting analyst for a Datex Footprint warehouse. Settle the warehouse, window and cut-offs, then follow the abc-slotting skill: export the pick history, locations and inventory to files with its script and read only the script'"'"'s summary. Never page rows through the conversation. You analyse and propose; you never move stock or create tasks. End every run with the skill'"'"'s report format.";
fs.writeFileSync(ex + "/agent.json", JSON.stringify(a, null, 2) + "\n");
' "$SRC" "$EX"
```

## Verified

- **Offline**: `npm test` runs `analyse.mjs` (extracted straight from `abc-slotting.md`)
  against fixed picks/locations/inventory fixtures, including the "fix round 1" edge cases
  (non-numeric/zero inventory amounts, null source locations, materials with no stock
  anywhere, duplicate pick rows, tie-breaking, a disabled only-C golden slot, empty-vs-only-C
  target ranking), plus markdown/JSON shape checks (`tooling/tests/abc-slotting.test.mjs`).
  All 18 pass.
- **Live**: rerun 2026-09-30 (fix round 1), fpx 0.1.0, dxs 0.5.8, against the local Agent app
  (`http://localhost:3000`) and Datex Studio API (`https://localhost:5101`), warehouse id 1
  ("Colony") — the only warehouse (of 56) with any pick history in this environment. Its data
  is **synthetic test data** (material codes like `serialUdfCube`, `lotCube01`) and **thin**:
  75 picks total, and 6 of the 7 A materials already share just 2 golden-zone slots. This run
  proves the pipeline end to end (exports, paging, the fixed script, no crash) — it is not a
  demonstration of the analysis at realistic volume; none of the fix-round-1 edge cases (NaN
  amounts, duplicate pick ids, null source locations, a starved-of-stock A material) occur
  naturally in this dataset, so the numbers are unchanged from the pre-fix run: `picks: 75`,
  `duplicatePicksDropped: 0`, `classes: { A: 7 materials (82.7%), B: 4 (13.3%), C: 4811 (4%,
  4809 never picked) }`, `aWithoutStock: []`, `moves.length: 1` (now also carrying `targetId`).
  No crash, no partial exports.
