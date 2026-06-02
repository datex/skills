---
name: impact-analysis
description: |
  Use BEFORE any rename, removal, required-field change, or other
  contract-breaking edit to a config on a Datex Studio branch. Runs
  reverse-trace to find all callers, categorizes them (including write-side
  vs read-side for storage-shape changes), and presents a safety gate.
  Generic — works for any config type (functions, datasources, flows,
  storages, type definitions, reports, etc.). Also invoke when a calling
  skill asks you to "audit all callers" or "verify a contract change is
  safe" before proceeding.
depends:
  - datex-studio-shared
  - function-creator
  - datasource-creator
  - storage-creator
  - type-definition-creator
  - db-query
  - action-creator
---

# Impact Analysis

Assess the impact of modifying or removing a configuration on a Datex Studio branch. This skill analyzes dependencies only — it does not make changes.

## When to Use

- Before modifying input/output parameters of any config
- Before renaming or removing a config from a branch
- Before adding a `required: true` field to a storage or changing a storage column's shape
- Before any other contract-breaking edit
- When a calling skill needs to verify that a contract change is safe — e.g.:
  - `function-creator` — before changing a function's input/output parameters
  - `datasource-creator` — before altering datasource shape
  - `storage-creator` — before renaming/removing a column or adding a required field
  - `type-definition-creator` — before removing or reshaping a `_dd` / `i_*` / `e_*` type
  - `db-query` / `action-creator` — before a storage schema change or when diagnosing a contract bug

## Workflow

> **Branch selection.** Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for branch/connection selection — never assume a branch ID; confirm it with the user or list feature branches first.

### Step 1: Find callers

```bash
dxs source explore reverse-trace <reference_name> --branch <branch_id>
```

This returns all configs that reference the target. Use `--type <type>` to speed up lookup if the config type is known (e.g., `--type flow`, `--type datasource`).

### Step 2: Interpret results

Categorize referencing configs by type:
- **Flows / Functions** — call the target via `$flows.*`
- **Datasources** — reference via `$datasources.*`
- **Forms / Grids / Editors** — UI components that bind to the target
- **Reports** — reference via `$reports.*`

When the change is a storage column rename, removal, or required-field addition, further split the callers into:
- **Write-side callers** — configs that `insert` / `update` / `patch` the storage (highest risk for required-field or rename changes; will fail at runtime if not updated alongside the storage edit)
- **Read-side callers** — configs that only query/read the storage (lower risk; may surface stale field names in filters or projections)

Flag any caller whose reference is ambiguous (e.g., a string literal that *looks like* a reference but may be inline content) as "review" rather than counting it as a real caller. Let the calling skill or user disambiguate.

> **Column-level granularity (storage shape changes).** `reverse-trace` reports *config-level* edges — it tells you which configs write to a storage, not which **columns** each one sets. When the change is to a specific column (rename, remove, or `required: true`), narrow each write-side caller by fetching its body from the branch (`dxs source explore config <caller_ref> --branch <id>`) and inspecting the `$db.<Pkg>.<storage>.insert/update/patch` payload in its embedded code for that column. This recovers the column-level write-side analysis that a config-level trace alone can't give — without grepping a local tree.

### Step 3: Decision gate

- **No callers found** — safe to proceed. Inform the calling skill/user.
- **Callers exist** — present the full list to the user with:
  - Each caller's reference name and type
  - What would break (e.g., "these 3 flows call fn_sum with 2 args — changing to 3 args will break them")
  - Ask for explicit confirmation before proceeding

### Step 4: Return to caller

Report the decision back to the calling skill:
- **Safe** — no callers, proceed with changes
- **Approved** — callers exist but user approved; the calling skill must update all affected callers as part of the change
- **Rejected** — user decided not to proceed

## Additional Commands

| Command | When to use |
|---------|------------|
| `dxs source explore trace <name> --branch <id>` | Understand what the target depends on (forward dependencies) |
| `dxs source explore graph <name> --branch <id>` | Visualize the full dependency chain (both directions) |

## Scope Boundaries

- This skill **analyzes only** — it never modifies configs
- The calling skill is responsible for updating affected callers
- Reference name changes are not covered — they require delete + recreate and should be flagged to the user as a manual operation
- **One hop only.** Report direct callers of the target. Do not chase transitive impact ("this function is called by X which is called by Y") — transitive analysis is the calling skill's or user's decision. If the user needs the full chain, use `dxs source explore graph <name> --branch <id>` instead.
- **No speculation on ambiguous matches.** If a reference is ambiguous (string literal vs. real binding, comment vs. config field), flag it for review rather than classifying it as a real caller.
- **Zero callers means stop.** If `reverse-trace` returns no callers, report that plainly and stop. Do not suggest similar reference names or broaden the search.
