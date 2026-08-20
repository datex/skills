---
name: db-query
description: |
  Use when querying or mutating Datex Studio storage components via the
  `$db` predicate DSL — function-tier-only Mongo-backed access to
  `*-storage.json` configurations. Covers the fluent predicate operators (`.equals`,
  `.ne`, `.gt`/`.gte`, `.lt`/`.lte`, `.in`, `.isNull`/`.isNotNull`, regex via
  `.includes`, composed with `.and`/`.or` inside `.where`), result-row TypeScript-optionality
  semantics, the implicit `id` column, the `required: true` read-then-patch
  trap, and schema-change audit checklist. Flow datasources that back grids
  or selectors over `$db` are covered in the flow-db-datasources reference.
  Triggers: "query the storage", "add/update/remove rows in xxx_storage",
  "write a $db predicate", "filter by storage column", "$db predicate with
  AND/OR/null", "$db query returning wrong rows", "patch validation error",
  "TypeScript accepted my predicate but it doesn't work at runtime". For
  authoring the calling function itself, see function-creator.
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - function-creator
  - storage-creator
  - datasource-creator
  - grid-creator
  - selector-creator
  - impact-analysis
  - post-edit-verification
  - component-validator
---

# `$db` Query Guide

`$db` is the function-tier runtime handle for reading and writing the cloud-persisted Mongo-backed storage components. Predicates use a **fluent operator DSL** that's compiled to a server-side query — **not** raw JavaScript evaluation. This is the single most important thing to understand before writing `$db` code, because native operators compile without error and silently misbehave at runtime.

This skill is **read-only consultation**: it owns the `$db` mechanics (predicate DSL, operators, schema-change audit) and the flow-datasource-over-`$db` sub-variant. It does not author functions, datasources, or storage components on its own — those round-trips are owned by the parent creator skill that invoked this one (typically `function-creator`).

> **See also:** `function-creator` — authoring the backend flow that hosts the `$db` call. db-query owns the predicate DSL and storage-access mechanics; function-creator owns the function lifecycle (`dxs function generate` / `validate` / `upsert`).

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/db.md](references/db.md) — Authoritative `$db` reference: access path, API surface, predicate DSL, result-type rules, the implicit `id` column, read-then-patch idiom
- [references/flow-db-datasources.md](references/flow-db-datasources.md) — Flow-type datasources (`type: "flows"`, `configurationTypeId: 6` / `19`) whose `getListFlow` reads from `$db` and feeds a grid or selector — pagination, dynamic filter / order-by helper flows, four-location registration mirror
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — snake_case-everywhere rule for storage fields and the dynamic-filter pipeline
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — `$db` listed alongside `$flow`, `$apis`, `$flows`, `$datasources`, `$test`
- [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md) — the tier matrix explaining why actions can't reach `$db`
- [../storage-creator/references/storage.md](../storage-creator/references/storage.md) — storage component shape, column descriptors, `required: true` pitfalls
- [../function-creator/references/functions.md](../function-creator/references/functions.md) — the caller tier; round-trip rule for the function body that wraps a `$db` call
- [../datasource-creator/references/odata-datasources.md](../datasource-creator/references/odata-datasources.md) — sibling result-type-optional rule on OData datasources
- [../datasource-creator/references/flow-datasources.md](../datasource-creator/references/flow-datasources.md) — flow-type datasource shape and entity-definition contract

## Dependencies

- **`function-creator`** skill — the typical caller. It carries the round-trip rule (`dxs configuration get -O envelope.json` → `jq .json` → edit → `dxs configuration upsert`) for the function whose `code` string holds the `$db` call. This skill is consulted from inside that workflow, not standalone.
- **`storage-creator`** skill — invoked when the schema needs a column added / removed / renamed before the predicate or patch can land.
- **`datasource-creator`** skill — invoked when the `$db` call lives inside a flow-type datasource's `getListFlow` / `getByKeysFlow` / `getFlow` slot (the grid/selector backing pattern in `references/flow-db-datasources.md`).
- **`grid-creator`** / **`selector-creator`** skills — invoked together with `datasource-creator` when the flow-datasource-over-`$db` is wired into a grid or selector (the four-location registration mirror in `references/flow-db-datasources.md` § 8 spans both component types).
- **`impact-analysis`** skill — invoked whenever a storage schema change is in flight. Reverse-traces every caller by `$db.<Package>.<storage_referenceName>` and categorises read-side vs write-side hits so each call site is reviewed before the schema lands.
- **`post-edit-verification`** / **`component-validator`** skills — invoked after the parent creator skill pushes the function / datasource / storage that carries the `$db` call. This skill itself doesn't push anything.

## CLI Lifecycle

`$db` is a runtime API, not a Studio configuration type, so there is no `dxs db` subcommand and no round-trip for the `$db` call itself. Everything you change is the **embedded `code` string** inside whichever configuration is calling `$db`:

| Caller | Configuration type | Skill that owns the round-trip |
|---|---|---|
| Function body | `function` (`configurationTypeId: 9`, `-flow.json`) | `function-creator` |
| Flow slot inside a flow-type datasource | `datasource` (`configurationTypeId: 6` or `19`, `-datasource.json` with `type: "flows"`) | `datasource-creator` |
| Schema audit / column rename | `storage` (`-storage.json`) | `storage-creator` (plus `impact-analysis` for callers) |

This skill walks you through writing the predicate / patch correctly; the **parent creator skill carries the round-trip rule** (`get -O envelope.json` → `jq .json envelope.json > body.json` → edit → `update`). When you finish the predicate, return to that skill to push.

## Workflow

```
[Phase 1: Setup + Context]
Follow branch-setup.md for branch/connection selection (if the
parent skill hasn't already)
        |
Identify the storage:
  - storage referenceName (matches *-storage.json filename stem)
  - package the storage lives in ($db.<Package>.<storage>)
  - caller tier (function-tier ONLY — never an action, never UI)
  - schema (objectTypeDef[] field ids — predicates / patches
    must match these exactly)
        |
[Phase 2: Pick the $db operation]
Read vs mutate? Single-row vs list? Read-then-patch needed?
  - read list           -> .where(...).sort(...).take(n).toList()
  - read single by id   -> .where(r => r.id.equals(guid)).toList()
  - insert one          -> .add(record)
  - insert batch        -> .addMany(records)
  - patch one           -> .update(id, patch)
                          (read-then-patch if storage has
                           any `required: true` columns)
  - delete matching     -> .removeMany(predicate)
Consult references/db.md → API Surface before picking
        |
[Phase 3: Author the predicate / patch]
Fluent DSL only — no native operators:
  - .equals / .in / .isNull / .and / .or  (NOT === / && / ||)
  - .update(id, patch) takes id string DIRECTLY, not a callback
  - Result rows are TypeScript-optional even for required columns
  - Field ids must match storage objectTypeDef[].id exactly
Walk references/db.md → Pre-Flight Checklist before push
        |
[Phase 4 (optional): Backing-datasource decision]
Is the $db call wrapping a grid or selector? If so:
  - YES -> consult references/flow-db-datasources.md for the full
           authoring rules (getQuery factory, dynamic filter /
           order-by helper flows, snake_case-everywhere rule,
           four-location registration mirror, $orderby / $filter
           inParam declarations)
           Invoke `datasource-creator` (+ `grid-creator` /
           `selector-creator` for the consumer side) for the
           round-trip
  - NO  -> the $db call lives directly inside a function body;
           return to `function-creator` for the round-trip
        |
Schema change in flight? -> invoke `impact-analysis` with
  `$db.<Package>.<storage_referenceName>` BEFORE the parent
  creator skill pushes the storage edit
```

## Phase Details

### Phase 1: Setup + Context

1. If the parent skill (typically `function-creator`) hasn't already established branch and connection, follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for selection. **Never assume a branch ID** — confirm with the user.
2. **Identify the storage being accessed.** The access path is `$db.<Package>.<storage_referenceName>`:
   - `<storage_referenceName>` matches the `-storage.json` filename stem (e.g. `widget_rule_storage`).
   - `<Package>` is the storage component's package placement — typically the feature package (`Acme`), not the default `Utilities`. Read the storage file's package declaration directly; never infer from the feature folder name.
3. **Confirm caller tier.** `$db` is function-tier only. Verify the calling configuration is either a function (`configurationTypeId: 9`, `-flow.json`) or a flow slot inside a flow-type datasource (`getListFlow` / `getByKeysFlow` / `getFlow` on a `-datasource.json` with `type: "flows"`, configurationTypeId `6` or `19`). It is **not** available inside actions (`-footprintFlow.json`) and **not** exposed to UI components. When an action needs storage access, wrap the read/write in a function and call it via `$apis.<Package>.FootprintApi.extendedActions.<function>`.
4. **Read the storage schema** — the `objectTypeDef[]` array on the storage file lists every column's `id` (snake_case), `type`, `isCollection`, and `required` flag. Field names referenced in predicates and patches must match these `id`s exactly; a rename in the schema breaks every unupdated call site (see Phase 4 schema-change audit).

### Phase 2: Pick the `$db` operation

Consult [references/db.md → API Surface](references/db.md#api-surface) and pick the operation matching the intent:

| Intent | API call |
|---|---|
| Read a list of matching rows | `.where(predicate).sort({...}).take(n).toList()` |
| Read a single row by id | `.where(r => r.id.equals(guid)).toList()` (or omit `.where` for "all") |
| Insert one record | `.add(record)` |
| Insert a batch | `.addMany(records)` |
| Patch a record by id | `.update(id, patch)` — first argument is the id string directly, **not** a predicate callback |
| Patch all matching rows | `.updateMany(predicate, patch)` |
| Atomically claim / test-and-set one row | `.findOneAndModify(predicate, patch, { sort?, select?, returnDocument? })` — the only CAS primitive; **no upsert option**, cannot insert-if-absent (see references/db.md) |
| Delete one row by id | `.remove(id)` |
| Delete matching rows | `.removeMany(predicate)` |
| Count matching rows | `.count()` (terminal — see flow-db-datasources for `getQuery()` factory rule) |

`.where(...)` returns a cursor — it doesn't hit the store until a terminal like `.toList()` or `.count()` runs. Multiple chainable stages (`.where(...).sort(...).take(10).toList()`) compose into a single server-side query.

If the storage has any `required: true` columns and the intent is a patch, plan a **read-then-patch** flow: pull the row first, then build a patch that echoes the required fields alongside the actual change. See [references/db.md → Read-then-patch for a storage with `required: true` columns](references/db.md#read-then-patch-for-a-storage-with-required-true-columns).

### Phase 3: Author the predicate / patch

Write the call against the rules in [references/db.md](references/db.md). The key invariants — all silent failures if violated:

1. **Predicate DSL is fluent, not native.** Every comparison is `.equals(...)` / `.in([...])` / `.isNull()`, never `===` / `!==`. Every boolean composition is `.and(...)` / `.or(...)`, never `&&` / `||`. TypeScript accepts the wrong forms without complaint (the column-expression objects have loose types), so the bug appears at runtime as either a translation error or a silently wrong result set.
2. **`.update(id, patch)` takes the id string directly.** It is **not** a predicate-callback signature.
3. **`required: true` columns must be echoed in patches.** The platform validates the patch against the full column schema; an omitted required column fails the update even when the existing record has that field populated.
4. **Field ids match `objectTypeDef[].id` exactly.** Snake_case from the storage carries through into every predicate and patch.
5. **Package access is correct.** The caller's package must have access to the storage's package (same package, or a declared dependency).
6. **Cursor terminals are present.** Every `.where(...)` chain ends in `.toList()` (or `.count()` for counts, or a mutation call). Unterminated cursors don't execute.
7. **Local types for result rows are fully optional** (or left inferred). `$db` results come back with every field typed as `T | undefined`, even for `required: true` columns — the platform's type generator does not propagate `required` into the caller-side row type. A strict local annotation fails the import. Same behavior as OData and flow-type datasources — treat all three result shapes identically at the type level.

Walk [references/db.md → Pre-Flight Checklist](references/db.md#pre-flight-checklist) before handing back to the parent creator skill.

### Phase 4 (optional): Backing-datasource decision

If the `$db` call wraps a grid or selector — i.e. it lives inside a `getListFlow` / `getByKeysFlow` / `getFlow` slot on a flow-type datasource (`type: "flows"`, `configurationTypeId: 6` or `19`) — the pattern has additional rules beyond the base `$db` checklist above:

- **`getQuery()` factory** — cursors are single-shot. Wrap the query body in a factory and call it per terminal; never reuse a cursor across `.toList()` and `.count()`.
- **Single `.where(r => …)` callback** with `predicate = predicate.and(...)` composition, never `.where(...).where(...)` chaining.
- **Push paging to `$db`** via `.skip($skip).take($top).toList()`; run `.count()` in parallel via `Promise.all`.
- **Case-insensitive full-text** goes through `r.<field>.includes(\`(?i)${needle}\`)` — never `.toLowerCase().includes(...)` (that JS method doesn't exist on the DSL).
- **Dynamic filter / order-by** comes from `apply_storage_datasource_dynamic_filters_flow` / `apply_storage_datasource_dynamic_order_by_flow` (Utilities package); the helper's `column` names pass through verbatim as `r[filter.column]`, so every per-column `dynamicFilter` / `dynamicOrderBy` value in the grid must match the storage's snake_case field id (and for post-aggregation shapes, the same snake_case keys carried through into the aggregated row).
- **Snake_case all internal identifiers** — flow inParams, outParam `objectTypeDef[].id`, `queryOptionsObjectTypeDef[].id`, the `$orderby.column` and `$filter.operands.*Filters.column` `oneOf.constantValue` literals, grid column `id` / `source`, dynamic registration `id` / `property`, per-column `dynamicOrderBy` / `dynamicFilter` / `dynamicFilterType.id`. The only camelCase that survives inside an internal block is an **external selector contract** (`warehouse_dd` → `warehouseId`, `owners_dd` → `projectId`); verify by reading the selector's own `inParams[0].id`.
- **Five entity-schema declarations stay in sync** (see `references/flow-db-datasources.md` § 11 and the canonical grid wiring rule). A field renamed in only some places passes type-check but throws "Property X not exists in entity definition" at runtime.
- **Four-location registration mirror** — `datasourceConfig.dynamicFilters / dynamicOrderBys` ≡ `datasources[0].dynamicFilters / dynamicOrderBys`, with `allSelectedIsDynamicFilters` / `allSelectedIsDynamicOrderBys` set to `true` on `datasources[0]`.

For the full walkthrough and code templates, consult [references/flow-db-datasources.md](references/flow-db-datasources.md). The round-trip for the datasource itself (and any grid / selector consuming it) is carried by `datasource-creator` / `grid-creator` / `selector-creator`; return to the parent creator skill once the predicate body is correct.

### Schema-change audit (cross-cutting)

When a storage schema changes (column added / removed / renamed), every caller is a potential edit site. Before the parent creator skill pushes the storage edit:

1. **Invoke the `impact-analysis` skill** with `$db.<Package>.<storage_referenceName>` — it enumerates read-side and write-side call sites separately and keeps the multi-file scan out of this skill.
2. **For each hit**, confirm field ids in predicates and patches still match `objectTypeDef[]` `id`s exactly. A rename breaks every unupdated site silently (predicate accesses an undefined column expression, the resulting query effectively collapses).
3. **For an added `required: true` column**, every existing `.update(id, patch)` caller must start echoing the new field — read-then-patch becomes mandatory. This is the riskiest drift direction; flag it explicitly to the user before the storage edit lands.

## Pre-Flight Checklist

Walk the full checklist in [references/db.md](references/db.md). The fast version:

1. **Caller tier.** This code lives in a function (`configurationTypeId: 9`) or a flow slot inside a flow-type datasource. **Not** an action. **Not** UI.
2. **Predicate DSL is fluent.** Every comparison is `.equals(...)` / `.in([...])` / `.isNull()`, not `===` / `!==`. Every boolean composition is `.and(...)` / `.or(...)`, not `&&` / `||`.
3. **`.update(id, patch)`** passes the id string directly as the first argument — not a predicate callback.
4. **`required: true` columns are echoed** in patches via read-then-patch. No omitted required columns.
5. **Field names match the storage's `objectTypeDef[]` ids** exactly.
6. **Package access is correct.** The caller's package has access to the storage's package.
7. **Cursor terminals present.** Every `.where(...)` chain ends in `.toList()` (or `.count()`, or a mutation call); unterminated cursors don't execute.
8. **Local types for result rows are fully optional** (or left inferred). Strict annotations — including `id: string` — fail the import because `$db` results come back with every field typed as `T | undefined`, matching OData and flow-type datasources.
9. **If this is a flow-type datasource over `$db`** (grid or selector backing), walk the additional checklist in [references/flow-db-datasources.md → Pre-Flight Checklist](references/flow-db-datasources.md#pre-flight-checklist) — `getQuery()` factory, single `.where` callback, paging pushed to `$db`, `(?i)` regex full-text, helper flows called at top, `$orderby` / `$filter` declared in `getListFlow.inParams`, snake_case verbatim rule, four registration arrays mirrored, per-column `dynamicFilterControl` matches type, `mapRow` keeps result shape consistent, five-location row-shape sync, `$orderby` / `$filter` oneOf-literal sync, hub mount inParams match the grid's inParams.
10. **Schema change in flight?** Invoke `impact-analysis` with `$db.<Package>.<storage_referenceName>` and audit every hit before the parent creator skill pushes the storage edit.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Using `===` / `&&` / `||` inside a `$db` predicate | The DSL doesn't translate native operators — TypeScript accepts them, the query silently misbehaves. Use `.equals(...)` / `.and(...)` / `.or(...)`. |
| Calling `.update(id, patch)` with a predicate callback as the first argument | The signature takes the id string directly. `.update(guid, { ... })`, not `.update(r => r.id.equals(guid), { ... })`. |
| Omitting a `required: true` column from a `.update` patch | The platform validates the patch against the full column schema; the call fails even when the existing record has that field populated. Read-then-patch — echo every required field. |
| Patching a column to `null` to clear it | Null-valued patch keys are **silently dropped** — the column keeps its old value, no error. Write a typed sentinel (e.g. `0` on an epoch-ms column) and map it back to null on read. See [references/db.md](references/db.md#api-surface). |
| Assuming multi-row writes are atomic | `$db` has no transactions. Order writes so every crash interleaving self-heals (mark losers before atomically flipping the winner via `.findOneAndModify`), and make each write no-op when the row is already in the target state. |
| Annotating result rows with a strict local type (`id: string`) | `$db` returns every field as `T | undefined`. Strict annotations fail the import. Leave inferred or annotate with optional fields; narrow at access sites with `?.` / `??` / `$utils.isDefined`. |
| Using `$db` inside an action (`-footprintFlow.json`) | Tier mismatch — `$db` is function-tier only. Wrap the read/write in a function and call it from the action via `$apis.<Package>.FootprintApi.extendedActions.<function>`. |
| Forgetting a terminal on a `.where(...)` chain | Cursors don't execute until a terminal runs. The line `const cursor = $db.<...>.where(...);` returns the cursor; you still need `.toList()` (or `.count()`, or a mutation). |
| Field id in predicate / patch doesn't match storage `objectTypeDef[].id` | Silent — predicate accesses an undefined column expression, the resulting query effectively collapses. Match the snake_case id exactly. Run `impact-analysis` after any rename. |
| Reusing a cursor across `.toList()` and `.count()` in a flow-datasource backing slot | Terminals consume cursors; the second call no-ops with stale or wrong data. Wrap the query body in a `getQuery()` factory and call it per terminal. See `references/flow-db-datasources.md` § 1. |
| `.where(...).where(...)` chaining inside a flow-datasource backing slot | Each chained `.where` creates a new cursor stage with unpredictable composition. Compose the entire predicate inside one callback using `predicate = predicate.and(...)`. See `references/flow-db-datasources.md` § 2. |
| `.toLowerCase().includes(...)` for case-insensitive full-text | That JS method doesn't exist on column expressions; even if it did, the match would evaluate per-row in JS after the fetch. Use `r.<field>.includes(\`(?i)${needle}\`)` for Mongo-side case-insensitive match. |
| Camel-casing internal identifiers in a flow-datasource backing slot | The dynamic-filter loop passes `filter.column` through as `r[filter.column]`; a camelCase value misses the snake_case storage field and the predicate throws at runtime. Snake_case everything internal; the only camelCase that survives is an external selector contract. |
| Building a distinct-values `*_dd` selector over high-volume fact storage | Every dropdown open triggers a `.toList()` that scans the table. Default to `textBox` filtering on the readable string field; reserve `selectBox` filters for bounded reference stores. See `references/flow-db-datasources.md` § 8. |
| Skipping `impact-analysis` before a storage schema change | A column rename or `required: true` addition breaks every unupdated caller silently. Reverse-trace by `$db.<Package>.<storage_referenceName>` before the storage edit lands. |

**After authoring the function or datasource that uses `$db`, invoke `post-edit-verification` (via the parent creator skill) and re-read the relevant section here if a `$db` validation error surfaces.**
