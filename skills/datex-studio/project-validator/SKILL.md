---
name: project-validator
description: |
  Use when running project-wide lint across a Datex Studio codebase
  (or a scope subset) — checks 5 categories of cross-component issues
  that per-file validation misses: (1) description-rule conformance
  across all component files, (2) schema-code alignment between
  declared `inParams`/`outParams` and the embedded TypeScript that
  consumes them, (3) cross-component `objectType` reference
  resolution, (4) OData query pre-flight against connection schemas,
  (5) result-shape sync between a datasource's query options and its
  declared `outParams`. Triggers: "validate the project", "run
  cross-component validation checks", "lint the codebase", "find
  broken type references", "find OData pre-flight failures", "check
  the project before merge". For single-file audits use
  `component-validator` instead.
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - component-validator
  - schema-explorer
  - codebase-research
---

# Project Validator

Project-wide lint for a Datex Studio **branch**. The branch is the source of truth: the validator enumerates the branch's configs via `dxs source explore configs` and bulk-exports them to a throwaway temp directory with `dxs source document build` (the CLI's offline-analysis path), then runs five cross-component checks against that temp export — checks that per-file validation cannot see in isolation. Returns a structured, read-only punch-list grouped by check type. Never modifies the branch, and never treats a local `src/` checkout as authoritative.

This is the **project-level** validator. It complements per-file validation: `component-validator` audits one component file end-to-end against its type-specific rule sheet; **this skill** audits the whole project (or a scope subset) for issues that only appear when you look across files — broken `objectType` references, OData queries that don't match the live schema, datasource query options that have drifted away from declared `outParams`, etc. The two skills are designed to be used together — `component-validator` after authoring each file, `project-validator` before merging a batch or shipping a release.

> **See also:** `component-validator` — single-file audit against the per-type creator rule sheet. Use it after authoring or modifying any one component. This skill is the project-level counterpart.
>
> **See also:** `component-wiring-check` — chases a specific cross-component reference contract. This skill is broader (5 categories across the whole project) but shallower (lint-grade, not deep wiring trace).
>
> **See also:** `post-edit-verification` — quick post-write check on a single file. Different scope and lighter touch than this skill.

## Dependencies

- **`datex-studio-conventions`** — `defaults.md` (description ≤100 chars, mandatory description), `file-format.md` (`configurationTypeId` table, suffix rules), `naming-conventions.md` (type-indicator rules). These are the rules the checks below enforce.
- **`datex-studio-shared`** / **`datex-studio-runtime`** — branch-setup primitives and platform-runtime globals used when interpreting flow code (e.g. resolving `$flow.inParams.<name>` and `$flow.outParams.<name>` references).
- **`component-validator`** — per-file companion. Sibling scope. When the project validator surfaces a file-local violation that a creator skill's rule sheet documents in detail, route the parent to `component-validator` for the deep audit.
- **`schema-explorer`** — invoked for OData pre-flight (check 4). The project validator must **not** load raw schema documents into the parent context — always delegate the entity / property / navigation lookups to `schema-explorer`.
- **`codebase-research`** — invoked when a finding needs grounded read-only inspection of supporting context (e.g. confirming an enum's allowed values by fetching the `*-customType` config from the branch). Optional, on demand.

## Mode

This is a **read-only** project lint. Do NOT modify any files. Do NOT run commands that mutate branch state (no `upsert`, no `--fix`, no writes). The validator reports; the parent decides what to do with the findings, and routes fixes back to the matching creator/editor skill.

## Workflow

### 1. Resolve scope

The validator always runs against a **branch** (follow `datex-studio-shared/branch-setup.md` to establish the branch ID — never assume one). The caller additionally supplies one of:

- **`all`** (default) — every owned config on the branch.
- A check name — `descriptions`, `schema`, `types`, `metadata`, `result-shapes`. Run only that check across the project.
- A scope subset — one or more config types (e.g. `grid`, `datasource`) or a name pattern. Apply all five checks (or the named check) within that subset only.

If the caller is ambiguous (e.g. just says "validate the project"), default to `all` owned configs on the branch and report the scope you chose in the output.

### 2. Enumerate and export the target configs (from the branch)

The branch is the source of truth — do **not** walk a local `src/` checkout. Acquire the configs via the CLI:

```bash
# List what's on the branch (optionally filter by type / owned-only / scope)
dxs source explore configs --branch <branchId> --owned-only

# Bulk-export every config to a THROWAWAY temp dir for offline analysis
dxs source document build --branch <branchId> --include-summaries -o "$TMP/dxs-validate"
```

`document build` writes one file per config under `$TMP/dxs-validate/<App>/<branchId>/local/<type>/<referenceName>.yaml`. That temp export is the only thing the checks read or grep — searching a temp file you just fetched is the sanctioned pattern; greping a persistent `src/` tree is not. Delete the temp dir when done.

Group the exported configs by type (the export is already organized into per-type folders, and each config carries its `configurationTypeId`):

- `footprintflow` — actions (`*-footprintFlow`)
- `flow` — functions (`*-flow`)
- `customtype` — interfaces / enums (`*-customType`)
- `footprintdatasource` — Footprint-tier OData datasources
- `datasource` — cloud-tier datasources (OData or flow-backed)
- `selector`, `storage`, `grid`, `form`, `editor`, `hub`, `backendtest`

A config whose type doesn't match the table is recorded as `unknown component type` and skipped (do not block the run on it).

### 3. Run the 5 checks

Run each check against the enumerated files. Order doesn't matter; do whichever is cheapest first. Collect findings as a structured list, never edit in-place.

### 4. Report

Compose the punch-list per the **Output format** section below. Findings are grouped by check type. End with a one-line summary (`total files checked`, `passes`, `warnings`, `failures`). Do not propose fixes beyond a one-line pointer.

## The 5 Checks

### 1. Description Validation (`descriptions`)

**Scans:** every component file (all suffixes above).

**Rule** (from `datex-studio-conventions/defaults.md` and `file-format.md`):
- `description` must not be `null`.
- `description` must not be `""` (empty string).
- `description` must be **≤ 100 characters**. This is a hard SQL column cap on the Footprint side — imports fail with a SQL truncation error when exceeded.

**Severity:**
- `null` or `""` description → **fail**.
- `> 100 chars` description → **fail** (not a warning — imports break).
- Description present and within cap → **pass**.

**Output line:**
```
[pass] i_awi_configuration-customType.json — "Allocation config interface" (35 chars)
[FAIL] my_action-footprintFlow.json — description is null
[FAIL] orders_grid-grid.json — description is 137 chars (cap is 100)
```

### 2. Schema-Code Alignment (`schema`)

**Scans:** action files (`*-footprintFlow.json`) and function files (`*-flow.json`).

**What it checks:** the declared `inParams` / `outParams` JSON declaration vs. the embedded TypeScript code that lives at `nodes[0].stepConfig.executeCodeConfig.code` (per the pattern documented in `codebase-research` — flow code lives inside the JSON, not on top).

**Procedure:**
1. Parse `inParams[]` and `outParams[]` from the JSON.
2. Extract the embedded code string (and iterate `nodes[*]` for multi-step flows).
3. Heuristic match each declared `inParam.id` against `$flow.inParams.<id>` references in the code.
4. Heuristic match each declared `outParam.id` against `$flow.outParams.<id>` references in the code.
5. Look for `$flow.inParams.<name>` or `$flow.outParams.<name>` references in code that have no matching declaration.

**Severity:**
- Declared `inParam` not referenced in code → **warning** (may be deliberate — kept for back-compat, future use, or external wiring).
- Declared `outParam` never assigned in code → **warning**.
- Code references `$flow.inParams.<name>` / `$flow.outParams.<name>` that has no matching declaration → **fail** (runtime error or silent `undefined`).

**Caveat:** this is a heuristic string match, not a TypeScript compiler. False positives are acceptable when surfaced as warnings — the caller decides whether each warning is real. Do not escalate a warning to a fail without source-code grounded evidence.

**Output line:**
```
[warn] plan_inventory_consumption_action — inParam 'unused_param' declared but not referenced in code
[FAIL] commit_allocation_plan_action — code references $flow.inParams.foo but 'foo' is not declared in inParams
```

### 3. Type Resolution (`types`)

**Scans:** every component file. Looks for `"objectType": "<Package>.<TypeName>"` values anywhere in the JSON (commonly inside `inParams[*].objectType`, `outParams[*].objectType`, `objectTypeDef.properties[*].objectType`, and nested datasource shapes).

**Rule:** every referenced `<Package>.<TypeName>` must resolve to either:
- A `<TypeName>` `customType` config owned by the current package on the branch (a `customtype/<TypeName>-customType.*` entry in the temp export, equivalently `dxs source explore configs --branch <id> --type customtype --search <TypeName>`), **or**
- A type owned by another package the project depends on (treat unknown packages as "out of scope, do not report" unless the caller explicitly asked to chase cross-package references).

**Procedure:**
1. Determine the current package (read from one of the package's component files; cross-check via folder convention).
2. Collect every `objectType` string across all scanned component files.
3. For each in-package reference, verify a matching `<TypeName>` customType config exists on the branch (in the temp export's `customtype/` folder).
4. Report unresolved references.

**Severity:**
- Reference to a type in the current package with no matching customType config on the branch → **fail**.
- Reference whose package is unknown to the project → **warning** (may be a typo, may be a legitimate external package).

**Output line:**
```
[FAIL] orders_grid-grid.json — references `Allocations.i_unknown_type`, no i_unknown_type-customType.json found
[warn] import_orders_action-footprintFlow.json — references `ExternalPkg.i_thing`; ExternalPkg is unknown to this project
```

### 4. OData Schema Pre-Flight (`metadata`)

**Scans:** OData datasource files — `*-footprintDatasource.json`, and `*-datasource.json` files whose `type` is `"oDataQuery"`. Skips flow-backed datasources.

**Procedure:**
1. **Resolve the connection.** Each datasource references a connection (a connection ID or a connection name). Determine it from the file. If ambiguous, ask the caller which connection to validate against.
2. **Delegate to `schema-explorer`** for every entity / property / navigation lookup. **Do not** load raw OData metadata documents into the parent context — `schema-explorer` returns concise structured answers and handles connection resolution and FootPrintApi special cases.
3. For each OData datasource:
   - Confirm the `entitySet` in `paths[0].entitySet` exists in the OData schema.
   - Confirm every property in `queryOptions.selects` exists on the entity type.
   - Confirm every property referenced in `queryOptions.filters` (filter-expression operands) exists on the entity type.
   - Confirm every navigation property in `queryOptions.expands` exists on the entity type.
4. Report mismatches.

**Severity:**
- Missing entity set → **fail**.
- Missing select/filter property → **fail**.
- Missing navigation in expand → **fail**.
- Schema lookup failed (connection unreachable, schema not loaded) → **warning** with a note that the check could not run for this file. Do not fail the entire run on a single unreachable connection — record the warning and continue.

**Output line:**
```
[FAIL] fpds_get_material-footprintDatasource.json — entitySet 'Materials' not found in schema (did you mean 'Material'?)
[FAIL] ds_orders_grid-datasource.json — selects: property 'CustomeName' not on entity 'Orders' (typo?)
[warn] ds_legacy_thing-datasource.json — could not reach connection 'LegacyProd'; check skipped
```

### 5. Result-Shape Sync (`result-shapes`)

**Scans:** all datasource files (both `*-datasource.json` and `*-footprintDatasource.json`, both OData and flow-backed).

**Rule:** the datasource's query-side shape (`queryOptionsObjectTypeDef`) and its consumer-facing shape (`outParams[0].objectTypeDef`) must agree. Each property on one side should have a matching entry on the other with the same `id` **and** the same `type`. Drift between these two declarations is the canonical "datasource works in Studio preview but breaks consumers" failure mode.

**Procedure:**
1. Read `queryOptionsObjectTypeDef.properties[]` from the file.
2. Read `outParams[0].objectTypeDef.properties[]` from the file.
3. Pair properties by `id`.
4. Flag any property on one side without a counterpart on the other, or any `id` pair whose `type` differs.

**Severity:**
- Property present on one side, missing on the other → **fail**.
- Property pair with mismatched `type` → **fail**.
- Property pair with matching `id` and `type` but different ordering / metadata → **nit**.

**Output line:**
```
[FAIL] ds_open_orders-datasource.json — `queryOptionsObjectTypeDef.OrderId` is `int32`, `outParams[0].objectTypeDef.OrderId` is `string`
[FAIL] fpds_lots-footprintDatasource.json — `outParams[0].objectTypeDef` declares property `LotCode`, missing from `queryOptionsObjectTypeDef`
```

## Output Format

Group findings by check type, in the order of the five checks above. Within each group, list failures first, then warnings, then nits. Pass-lines are optional — include them when the caller asked for a verbose run, omit them when the run is the default lint summary. Always end with a one-line summary.

```
## 1. Description Validation
  [FAIL] my_action-footprintFlow.json — description is null
  [FAIL] orders_grid-grid.json — description is 137 chars (cap is 100)
  [pass] i_awi_configuration-customType.json — "Allocation config interface" (35 chars)
  ...

## 2. Schema-Code Alignment
  [FAIL] commit_allocation_plan_action — code references $flow.inParams.foo but 'foo' is not declared in inParams
  [warn] plan_inventory_consumption_action — inParam 'unused_param' declared but not referenced

## 3. Type Resolution
  [FAIL] orders_grid-grid.json — references `Allocations.i_unknown_type`, no i_unknown_type-customType.json found

## 4. OData Schema Pre-Flight
  [FAIL] fpds_get_material-footprintDatasource.json — entitySet 'Materials' not found (did you mean 'Material'?)
  [warn] ds_legacy_thing-datasource.json — could not reach connection 'LegacyProd'; check skipped

## 5. Result-Shape Sync
  [FAIL] ds_open_orders-datasource.json — `OrderId` type drift: query=int32, outParams=string

## Summary
  files checked: 142
  passes: 128
  warnings: 7
  failures: 7
  scope: all
```

If a check ran with no findings, write `(no issues)` under that heading rather than omitting it — explicit emptiness is more legible than silent absence.

## Rules

- **Read-only.** Do not modify any files. Do not auto-fix. Do not run mutating `dxs` commands. The validator's job is to report; the parent (or the user) decides what to do.
- **Punch-list, not rewrite.** Findings are one-line citations with file path and a brief evidence line. Do not include long code suggestions or proposed JSON. If a fix is non-obvious, name the matching creator skill that owns the fix (e.g. "route to `datasource-creator`"), not the fix itself.
- **Delegate OData schema to `schema-explorer`.** Never load raw OData metadata into the parent context. This is the single biggest context-poisoning anti-pattern in Datex Studio work.
- **Heuristic checks may warn, not fail.** Schema-code alignment in particular is a string-match lint, not a compiler. Use `warning` for "may be real" and `fail` only when the evidence is unambiguous.
- **Scope discipline.** When the caller scopes to a check name, run only that check. When they scope to a subtree, walk only that subtree. Do not expand scope on your own initiative.
- **Don't speculate about intent.** If a violation could be deliberate (a kept-around `inParam` for external wiring, an `outParams` declared wider than the query for a future-proofing reason), flag it as a warning with a note — not as a failure.
- **One run per invocation.** Don't loop the validator until "clean." Surface the punch-list and let the parent decide whether to iterate.
- **Branch is the source of truth.** Enumerate and export configs from the branch via `dxs source explore configs` / `dxs source document build`. Never read a local `src/` checkout as authoritative.
- **No writes to the branch, no fix patches.** The only local artifact is the throwaway `dxs source document build` temp export, which the checks read and which you delete when done. The report itself is returned in the response body — no `references/`, log, or patch files.
