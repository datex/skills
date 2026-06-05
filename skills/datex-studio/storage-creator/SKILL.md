---
name: storage-creator
description: |
  Use when authoring or modifying a Datex Studio storage component
  (configurationTypeId=17, *-storage.json suffix) on a branch — cloud-persisted
  Mongo storage accessed via $db at function-tier. Owns the storage-vs-Footprint
  entity decision, column descriptor shape, the `required: true` read-then-patch
  trap (additive-only-after-shipping), additive evolution rules, and impact
  analysis before schema changes. Triggers: "create a storage", "add a column
  to xxx_storage", "options/config table", "rule table", "daily snapshot
  capture", "$db.update validation error after adding a required column",
  deciding between storage and Footprint entity.
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - db-query
  - function-creator
  - datasource-creator
  - impact-analysis
  - requirements-gathering
  - post-edit-verification
  - component-validator
---

# Storage Creator

Author or modify a Datex Studio storage component (configurationTypeId=17) on a branch — a cloud-persisted Mongo-backed collection owned by a feature. Storage holds state that lives outside the Footprint OData schema: configuration options, rule tables, snapshot captures, derived analytic rollups, anything that's "the feature's own data" rather than a first-class WMS entity. Storage has no code strings of its own; it's consumed at function-tier via the `$db.<Package>.<storage_referenceName>` runtime global.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/storage.md](references/storage.md) — Authoritative storage authoring reference: file shape, column descriptors, the `required: true` read-then-patch trap, additive evolution rules, common patterns
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and editing rules
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_storage` suffix convention, filename stem matching
- [../datex-studio-conventions/defaults.md](../datex-studio-conventions/defaults.md) — `accessModifier` defaults
- [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md) — `$db` is function-tier only; actions cannot reach storage
- [../db-query/references/db.md](../db-query/references/db.md) — the `$db` runtime global: access path, API surface, fluent predicate DSL (`.equals` / `.and` / `.or` / `.isNull` / `.in` — never `===` / `&&` / `||`)
- [../function-creator/references/functions.md](../function-creator/references/functions.md) — functions are the sole caller tier for `$db`; write-side code lives here
- [../datasource-creator/references/flow-datasources.md](../datasource-creator/references/flow-datasources.md) — flow-type datasources that wrap storage reads for UI consumption

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`function-creator`** skill — invoked when seeding storage, writing the read-then-patch idiom for `required: true` schemas, or authoring backfill flows. `$db` is function-tier only; every write to storage runs through a function
- **`datasource-creator`** skill — invoked when wrapping a storage read in a flow-type datasource for UI consumption (the canonical pattern for surfacing storage data on grids, selectors, and report sections)
- **`impact-analysis`** skill — invoked **before** any schema change that risks breaking write-side callers: adding a new `required: true` column, changing an existing column to `required: true`, renaming a column, or removing a column that may still be read by callers. Trace `$db.<Package>.<storage_referenceName>` to find every write site that needs read-then-patch echo or rename updates

## CLI Lifecycle

Storage authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs storage` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The type identifier in the CLI is **`storage`** (lowercase, matches `ConfigurationEndpoints.normalize_type` output), mapping to `configurationTypeId: 17`.

**Create a new storage:**

```bash
# 1. Build body.json from scratch (see references/storage.md → Minimal Valid Skeleton)
# 2. Validate (recommended)
dxs configuration validate storage -b <branchId> -D body.json
# 3. Create
dxs configuration upsert storage -b <branchId> -D body.json
```

**Edit an existing storage:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get storage <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard — see "Round-trip rule" below)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate (recommended)
dxs configuration validate storage -b <branchId> -D body.json
# 5. Push
dxs configuration upsert storage -b <branchId> -D body.json
```

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. The corrected sequence above (extract inner `.json` with `jq` before editing) is mandatory for any round-trip. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

Storage bodies are among the leanest configuration types — just `objectTypeDef[]` (the column schema), the component-identity envelope, and a handful of top-level slots that mostly stay `null`. There's no `inParams` / `outParams` / `vars` / `events` / `flows` content because storage has no code strings of its own; all read/write logic lives in callers. Round-trip discipline (fetch → jq-extract → edit → validate → push) still applies — the platform's import path runs the full envelope-aware update regardless of body size.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]
  +-----+-----+
  |            |
 YES          NO -> invoke `requirements-gathering`
  |            |
  +-----+------+
        |
[Phase 2: Decide storage vs Footprint entity]
Consult references/storage.md → Purpose & When to Use:
  - storage: feature-owned data, no Footprint round-trip, no business-
    object lifecycle, no navigation relationships to WMS entities,
    simple column-set with implicit GUID identity
  - first-class Footprint entity: data has business meaning beyond
    the feature (customer, shipment, task), needs OData navigation,
    has CRUD lifecycle reached via actions and OData datasources
If the decision lands on Footprint entity -> stop; this is not a
storage task. Otherwise continue.
        |
[Phase 3: Author storage body]
Build body.json:
  - File shape (configurationTypeId=17, isBlob=false unless intentional,
    suffix -storage.json, referenceName ends _storage, snake_case
    matches filename stem; description non-empty and <=100 chars;
    accessModifier set (default public); feature package, not Utilities)
  - Column descriptors (objectTypeDef[]) — inParam-shaped entries with
    id (snake_case), type (string/number/boolean/date), isCollection
    (false scalar, true array), required defaults to false, isSecured
    typically null; remaining slots null
  - No explicit `id` column — every record carries an implicit
    platform-generated GUID `id` keyed by every $db predicate
  - The `required: true` read-then-patch trap — defaulting `required`
    to false avoids the partial-patch validation footgun; reserve true
    only for columns where every future patch will always echo them;
    when stuck with a legacy required column, write-side code MUST
    read-then-patch (pull row, echo required fields into patch)
  - Additive evolution rules — new nullable columns leave older rows
    with null/undefined unless an explicit backfill runs in the same
    edit; column drops require choosing the legacy-only off-schema
    bracket-notation pattern OR the still-part-of-the-model
    on-schema-required-false pattern based on intent
  - Schema-change impact — for any required:true change, rename, or
    removal, invoke `impact-analysis` skill with target
    $db.<Package>.<storage_referenceName> before push to audit every
    write-side call site
  - Sibling slots — inParams / outParams / vars / events stay null;
    storage has no code strings of its own
        |
[Phase 4: Validate + push]
dxs configuration validate storage -b <branchId> -D body.json
        |
   +----+----+
   |         |
  CREATE   MODIFY-EXISTING
   |         |
   |         use the corrected round-trip
   |         (get -O envelope -> jq .json -> body)
   |         |
   +----+----+
        |
        v
dxs configuration upsert storage -b <branchId> -D body.json
   (upsert creates or updates by referenceName — one command for both)
        |
[Phase 5: Verify in Studio (optional)]
Exercise the storage end-to-end through its callers — seed flow
populates rows, read datasource returns them, write flow applies
the read-then-patch idiom for required columns, schema change
doesn't break existing call sites
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 1: Setup + Requirements

1. Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for branch and connection selection. **Never assume a branch ID** — ask the user to confirm, or run `dxs source branch list --all-repos --status feature` for selection.
2. Check whether a **requirements brief** already exists in the conversation context (produced by `requirements-gathering` or another calling skill).
   - **Brief exists** — use it. The brief should establish what data the storage holds (configuration values, business rules, daily snapshots, …), the column set with types, whether any columns are genuinely required at rest, the consuming surfaces (functions that write, datasources that read for UI), and the feature package the storage belongs to.
   - **No brief** — invoke the `requirements-gathering` skill first. Getting the column set and `required` decisions right up front avoids painful schema migrations later — once a storage ships, `required: true` is effectively additive-only (existing callers haven't been updated to echo new required columns).

### Phase 2: Decide storage vs Footprint entity

Consult [references/storage.md → Purpose & When to Use](references/storage.md#purpose--when-to-use) before authoring. The decision drives whether you're in the right skill at all.

**Storage** fits when the data:

- Is feature-owned and never needs to round-trip through the Footprint OData layer.
- Doesn't warrant a first-class OData entity — no navigation relationships to WMS entities, no business-object lifecycle (no status transitions, no audit history beyond the data itself).
- Wants a simple column-set with implicit GUID identity, not an SQL schema with foreign keys.
- Is accessed exclusively at function-tier via `$db.<Package>.<storage_referenceName>` (storage is not reachable from actions or UI components).

**First-class Footprint entity** fits when the data has business meaning beyond the feature — a customer, a shipment, a task. Those belong in the platform OData schema and are reached through CRUD actions and OData datasources. If the data warrants navigation properties to other WMS entities, or other features will read it, or it needs the full action-driven CRUD lifecycle, stop — this is not a storage task.

When in doubt, ask: "Does this data exist purely to support this one feature's behavior, or does it represent a business object the rest of the platform might care about?" The first lands in storage; the second lands in a Footprint entity.

### Phase 3: Author storage body

Build `body.json` from the skeleton in [references/storage.md → Minimal Valid Skeleton](references/storage.md#minimal-valid-skeleton). Key points:

1. **File basics.** Per the **Pre-Flight Checklist** below + [../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md); see [references/storage.md → File Location & Naming](references/storage.md#file-location--naming) for the `-storage.json` file shape. Two storage-specific calls while building: `isBlob: false` unless blob-style storage is intentional, and **package placement must match the feature** (e.g. `Inventory`), not the default `Utilities` — it drives the `$db.<Package>.<storage_name>` access path.

2. **Column descriptors.** Each `objectTypeDef[]` entry is inParam-shaped. Required slots: `id` (column name, snake_case), `type` (`"string"` / `"number"` / `"boolean"` / `"date"`), `isCollection` (`false` for scalar, `true` for array column). `required` defaults to `false`. `isSecured` typically `false` or `null`. All remaining slots (`description`, `oneOf`, `fromBaseConfiguration`, `objectTypeDef`, `objectType`, `isConstant`, `constantValue`) stay `null`. See [references/storage.md → Column descriptors](references/storage.md#column-descriptors).

3. **No explicit `id` column.** Every storage record automatically carries a platform-generated GUID `id` string column. **Don't declare `id` in `objectTypeDef[]`** — it's implicit. All `$db` predicates key off it (`i => i.id.equals(guid)`). Declaring an explicit `id` collides with the implicit one and breaks reads.

4. **The `required: true` read-then-patch trap.** Setting a column `required: true` breaks `$db.update(id, patch)` partial patches. The platform validates the patch object against the full declared column schema, so any patch that omits a `required: true` column is rejected **even when the existing record already has that field populated**. **Default every column's `required` to `false`** and validate at the flow layer that writes the record. Reserve `required: true` only for columns that (a) genuinely must never be nullable at rest, AND (b) every future patch will always include them. When a storage schema already has `required: true` columns you can't relax, **write-side code must read-then-patch** — pull the row first, then build the patch object that echoes the required fields. See [references/storage.md → Patching a record with required columns](references/storage.md#patching-a-record-with-required-columns) for the canonical idiom.

5. **Schema-change impact analysis.** Three schema changes are cross-cutting and need impact analysis before push:
   - **Adding a new `required: true` column** — forces every existing caller of `$db.update` to start echoing it; existing callers silently fail validation until updated.
   - **Renaming a column** — breaks every read and write site referencing the old name; the generated `IStorageItem_<Package>_<storage>` type changes shape.
   - **Removing a column that may still be populated on historical rows** — typed dot-access fails to compile at read sites even though Mongo still returns the field; choose the off-schema bracket-notation pattern or the on-schema `required: false` pattern based on intent (see [references/storage.md → Column descriptors](references/storage.md#column-descriptors) for the trade-off).
   
   For any of these, **invoke the `impact-analysis` skill** with target `$db.<Package>.<storage_referenceName>` before push to enumerate every write-side call site that needs read-then-patch echo or rename updates. Do not grep callers inline from the parent agent — multi-file scans are a dedicated skill's job.

6. **Additive evolution.** Existing records don't get backfilled when a new nullable column is added. Downstream code must either tolerate `null` / `undefined` on older rows, OR a one-shot backfill flow runs in the same edit. Plan the backfill alongside the schema change; don't ship a column whose readers crash on legacy rows.

7. **Sibling slots stay null.** `inParams`, `outParams`, `vars`, `events` all stay `null` on the storage body — storage has no code strings of its own. All read/write logic lives in callers (functions, flow-type datasources). Match the convention; don't invent code slots.

8. **Calling-tier compliance.** Storage is **function-tier only** via `$db.<Package>.<storage_referenceName>`. It is **not available** in actions, **not available** to UI components (selectors, grids, forms). When a UI surface needs storage data, wrap the read in a flow-type datasource that calls a function via `$flows.<Package>.<fn>`; when an action needs to write storage, wrap the write in a function and call it via `$apis.<Package>.FootprintApi.extendedActions.<function>`. See [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md) and [../db-query/references/db.md](../db-query/references/db.md).

### Phase 4: Validate + push

```bash
# Validate the body locally against the branch
dxs configuration validate storage -b <branchId> -D body.json

# For a new storage
dxs configuration upsert storage -b <branchId> -D body.json

# For modify-existing (round-trip — never skip the jq extract)
dxs configuration get storage <configId> -b <branchId> -O envelope.json
jq .json envelope.json > body.json
# ... edit body.json ...
dxs configuration upsert storage -b <branchId> -D body.json
```

Validation surfaces missing required fields, malformed column-descriptor shapes, and structural errors before push. It does **not** catch the `required: true` partial-patch trap (the storage validates fine; the runtime failures appear at write time in callers), the missing-backfill-on-additive-evolution gap (older rows return `null` and downstream code may crash), or schema-change ripples to callers (renames silently break every untouched call site). Walk the [references/storage.md → Pre-Flight Checklist](references/storage.md#pre-flight-checklist) (the checklist below mirrors it) before push.

### Phase 5: Verify in Studio (optional)

Exercise the storage end-to-end through its callers:

- A seed / initialize flow populates the expected starting rows idempotently (re-running doesn't duplicate).
- A read flow or flow-type datasource returns the rows with the expected column shape; predicate DSL operators (`.equals` / `.and` / `.or` / `.isNull` / `.in`) work as written.
- A write flow that targets a row with `required: true` columns successfully applies the read-then-patch idiom — the patch echoes the required columns and the update succeeds.
- For a schema change (column add / required change / rename / remove), every audited write-side call site continues to function — no silent validation failures, no stale dot-access compile errors.
- The implicit `id` GUID column is present on every row read; predicates that key off it resolve to the expected row.

If the running app isn't available, re-fetch the config (using the corrected `jq .json` extract pattern) and diff against `body.json` to confirm the push landed.

## Pre-Flight Checklist

Before push, walk the full checklist in [references/storage.md → Pre-Flight Checklist](references/storage.md#pre-flight-checklist). The fast version:

1. **File basics.** `configurationTypeId: 17`, `isBlob: false` (unless blob mode is intentional), suffix `-storage.json`, component-name `_storage` suffix — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
2. **Package placement matches the feature** (e.g. `Inventory`), not `Utilities`. This drives the `$db.<Package>.<storage_name>` access path.
3. **Columns are complete.** Every `objectTypeDef[]` entry has `id`, `type`, `isCollection`. Unused slots stay `null`.
4. **No explicit `id` column.** The platform adds an implicit GUID.
5. **Every column's `required` defaults to `false`.** Validate at the flow layer. Only set `required: true` when every future patch will always include the column; if it's already `required: true` on legacy schema, every `$db.update` call must read-then-patch and echo the required fields.
6. **Schema change safety.** New columns: callers tolerate `null` on pre-existing rows OR a backfill runs in the same edit. Changed `required: true` columns, renames, or removals: invoke the `impact-analysis` skill over `$db.<Package>.<storage_referenceName>` and audit every hit before merging — never grep callers inline from the parent.
7. **Sibling slots null.** `inParams`, `outParams`, `vars`, `events` stay `null` — storage has no code strings of its own.
8. **Consumers are on the right tier.** `$db` callers are functions (`-flow.json`, `configurationTypeId: 9`) or flow slots inside flow-type datasources. Actions cannot reach `$db`; UI components cannot reach `$db`.
9. **Predicates use the fluent DSL.** `.equals(...)` / `.and(...)` / `.or(...)` / `.isNull()` / `.in([...])` — never `===`, `&&`, `||`. (TypeScript accepts native operators without complaint, but at runtime the predicate either errors during translation or the logic silently collapses.)

## Common Mistakes

| Mistake | Fix |
|---|---|
| Picked storage when the data should have been a first-class Footprint entity | Storage is for feature-owned data with no business-object lifecycle and no navigation relationships. If the data is a customer / shipment / task or other WMS-wide concept, model it as a Footprint entity and reach it via CRUD actions + OData datasources. |
| Declared an explicit `id` column in `objectTypeDef[]` | Drop it. The platform adds an implicit GUID `id` string column to every record; explicit declaration collides with the implicit one and breaks reads. |
| Set every column `required: true` defensively | Reverses the partial-patch semantics — every `$db.update(id, patch)` then has to echo every required column even when only one changes. Default `required` to `false` and validate at the flow layer; reserve `true` only for columns every future patch will always include. |
| `$db.update(id, patch)` fails with a validation error after adding a new column | Either the new column is `required: true` and the caller isn't echoing it (read-then-patch idiom), OR the patch is being validated against the full schema. Default new columns to `required: false`, or invoke `impact-analysis` and update every write site to echo the new required column. |
| Added a new nullable column; reads on older rows crash because they expected the field | New columns don't backfill. Either tolerate `null` / `undefined` at the read site, or run a one-shot backfill flow in the same edit. |
| Removed a column but read sites that haven't been updated fail to compile (typed dot-access on the now-undeclared field) | Choose by intent: "this column is gone" → keep it off `objectTypeDef[]` and access untyped via bracket notation at the legacy read site (`row['retired_field'] as string \| null`); "still part of the model, just nullable" → leave on schema as `required: false`. The two patterns signal different intent — don't confuse them. |
| Storage placed under `Utilities` instead of the feature package | The package determines the `$db.<Package>.<storage_name>` access path. Place under the feature package (e.g. `Inventory`, `Acme`) so callers reach it as `$db.Inventory.<storage>`, not `$db.Utilities.<storage>`. |
| `description` exceeds 100 chars | SQL column limit — push will fail validation. Tighten. |
| `referenceName` doesn't end in `_storage`, or filename stem doesn't match `referenceName` | Convention drift — the `_storage` suffix is the type indicator, parallel to `_dd` / `_hub` / `_form` / `_editor`. Filename stem must match `referenceName` exactly. |
| Predicate uses native TypeScript operators (`===`, `&&`, `||`) | The `$db` predicate DSL is a fluent operator chain, not raw TypeScript. Use `.equals(value)`, `.and(...)`, `.or(...)`, `.isNull()`, `.in([...])`. TypeScript accepts the native operators without complaint but the predicate breaks at runtime. See [`db.md`](../db-query/references/db.md). |
| Action code tries to read storage via `$db` | `$db` is function-tier only — not available in actions, not exposed to UI components. Wrap the read in a function and call the function from the action via `$apis.<Package>.FootprintApi.extendedActions.<function>`. |
| Renamed a storage column without updating callers | Every read and write site referencing the old name breaks. Invoke the `impact-analysis` skill over `$db.<Package>.<storage_referenceName>` first, then update every hit in the same edit. |
| Piping `dxs configuration get -O envelope.json` directly into `dxs configuration upsert -D envelope.json` | Silently destroys config content. Always `jq .json envelope.json > body.json` before editing. See "Round-trip rule" above. |

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
