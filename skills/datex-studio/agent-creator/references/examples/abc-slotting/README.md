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
byte-identical to the markdown:

```bash
SRC=agent.json
EX=skills/datex-studio/agent-creator/references/examples/abc-slotting
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
  against fixed picks/locations/inventory fixtures, plus markdown/JSON shape checks
  (`tooling/tests/abc-slotting.test.mjs`). All 8 pass.
- **Live**: 2026-09-30, fpx 0.1.0, dxs 0.5.8, against the local Agent app
  (`http://localhost:3000`) and Datex Studio API (`https://localhost:5101`), warehouse id 1
  ("Colony") — the only warehouse (of 56) with any pick history in this environment. Its 75
  picks all fall between 2020-03-31 and 2025-01-10, so the window used was `2020-01-01` to
  `2025-12-31` rather than a literal last-12-months window (every warehouse returns 0 picks
  in the last 12 months relative to today; see the task report for the full probe). Summary:
  `picks: 75`, `classes: { A: 7 materials (82.7%), B: 4 (13.3%), C: 4811 (4%, 4809 never
  picked) }`, `moves.length: 1`. No crash, no partial exports.
