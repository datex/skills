# Storage

Storage components describe **cloud-persisted Mongo-backed collections** owned by a feature. They hold state that lives outside the Footprint OData schema — configuration options, rule tables, snapshot captures, derived analytic rollups — anything that's "the feature's own data" rather than a first-class WMS entity.

## Purpose & When to Use

Choose a storage component when the data:

- Is feature-owned and never needs to round-trip through the Footprint OData layer.
- Doesn't warrant a first-class OData entity (no navigation relationships to WMS entities, no business-object lifecycle).
- Wants a simple column-set with implicit GUID identity, not an SQL schema.

Pick a first-class Footprint entity instead when the data has business meaning beyond the feature (e.g. a customer, a shipment, a task) — those belong in the platform OData schema and are reached through CRUD actions and OData datasources.

## File Location & Naming

- File name: `<name>_storage-storage.json` (`referenceName` stem + suffix). The component lives on the branch — this is the naming convention, not a local `src/` path.
- File suffix: `-storage.json`
- Component-name suffix: `_storage`. Carry the type indicator on the component name itself, matching every other component type (`_dd`, `_hub`, `_form`, `_editor`, etc.). Example: `widget_rule_storage`, filename `widget_rule_storage-storage.json`.
- Package: features place storage under their feature package (e.g. `Acme`), not the default `Utilities`. The package determines the `$db.<Package>.<storage_name>` access path.

**Known naming violations.** Some pre-existing storage components may predate this convention and be missing the `_storage` suffix — they should be renamed per the platform "Missing type indicator = flaw" rule. Don't mirror the pattern when authoring new storage; always include the suffix.

## Minimal Valid Skeleton

```json
{
  "objectTypeDef": [
    {
      "id": "key",
      "required": false,
      "description": null,
      "oneOf": null,
      "fromBaseConfiguration": null,
      "type": "string",
      "objectTypeDef": null,
      "objectType": null,
      "isCollection": false,
      "isSecured": null,
      "isConstant": null,
      "constantValue": null
    },
    {
      "id": "value",
      "required": false,
      "description": null,
      "oneOf": null,
      "fromBaseConfiguration": null,
      "type": "string",
      "objectTypeDef": null,
      "objectType": null,
      "isCollection": false,
      "isSecured": null,
      "isConstant": null,
      "constantValue": null
    }
  ],
  "isBlob": false,
  "configurationTypeId": 17,
  "id": 0,
  "referenceName": "<name>_storage",
  "title": "<name>_storage",
  "description": "<≤100 chars>",
  "inParams": null,
  "outParams": null,
  "vars": null,
  "events": null,
  "accessModifier": "public"
}
```

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `id` | Component identity | Platform-assigned numeric id; don't hand-author new ones for net-new components — import assigns. |
| `referenceName` | Code-facing handle | Snake_case with `_storage` suffix; matches the filename stem and the `$db.<Package>.<referenceName>` access path. |
| `title` | Display handle | Typically identical to `referenceName`. |
| `description` | Searchable description | **Required, non-empty, ≤ 100 chars** (SQL column limit). |
| `accessModifier` | Visibility | Default `public`; see [`defaults.md`](../../datex-studio-conventions/defaults.md). |
| `configurationTypeId` | Component kind | Always `17` for storage. |
| `isBlob` | Storage mode | `false` for structured records (the normal case). A `true` value switches to blob-style storage and changes the runtime contract — only use when intentional. |
| `objectTypeDef` | Column schema | Array of inParam-shaped descriptors, one per column. See "Column descriptors" below. |

Unused top-level slots (`inParams`, `outParams`, `vars`, `events`) stay `null`.

### Column descriptors

Each entry in `objectTypeDef[]` uses the same shape as an inParam:

- `id` — column name, snake_case.
- `type` — primitive type: `"string"`, `"number"`, `"boolean"`, `"date"`.
- `required` — **default to `false`** (or `null`). Validation belongs in the flow layer that writes the record, not in the storage schema. Marking a column `required: true` breaks `$db.update(id, patch)` partial patches: the platform validates the patch object against the full declared column schema, so any patch that omits a `required: true` column is rejected even when the existing record already has that field populated. Reserve `true` only for columns that genuinely must never be nullable at rest *and* where every future patch will always include them — and when the schema already has a `required: true` column you can't relax, the write-side code **must read the current row first and echo the required columns into the patch object**; see [Common Patterns → Patching a record with required columns](#patching-a-record-with-required-columns).
- `isCollection` — `false` for a scalar, `true` for an array column.
- `isSecured` — mirrors the inParam convention; typically `false` or `null`.
- Remaining slots (`description`, `oneOf`, `fromBaseConfiguration`, `objectTypeDef`, `objectType`, `isConstant`, `constantValue`) stay `null`.

**Implicit `id` column.** Every storage record automatically carries a platform-generated GUID `id` string column. Don't declare `id` in `objectTypeDef[]` — it's implicit. All `$db` predicates key off it (`i => i.id.equals(guid)`).

**Additive evolution.** Existing records don't get backfilled when a new nullable column is added; downstream code must tolerate `null` / `undefined` on older rows or run a one-shot backfill flow as part of the same edit.

**Removing a column that may still be populated on historical rows.** Dropping a column from `objectTypeDef[]` removes it from the generated `IStorageItem_<Package>_<storage>` type, but Mongo still returns the field on reads of rows written before the drop. Typed dot-access (`row.retired_field`) then fails to compile at any read site even though the value is still physically present. Two patterns, chosen by intent:

- **"This column is gone" (preferred when retiring a field):** keep it off `objectTypeDef[]` and read it untyped via bracket notation — `const level: string | null = (row['retired_field'] as string | null | undefined) ?? null;`. Bracket access widens to `any`, bypassing the missing-property check; the runtime still returns the value. New writes can't populate the field; the read path naturally rots and gets deleted once historical rows are migrated or retention expires.
- **"Still part of the model, just nullable now":** leave the column on the schema as `required: false`. Use only when new writes will keep populating it.

Off-schema + bracket-notation signals "legacy-only, delete me"; on-schema + non-required signals "durable part of the model." Don't confuse the two.

## Runtime Globals

Storage components have no code strings of their own — they're consumed through the `$db` runtime global from callers (functions and the flow slots embedded inside flow-type datasources).

See [`db.md`](../../db-query/references/db.md) for the full `$db` reference: access path, API surface (`.add` / `.addMany` / `.update` / `.removeMany` / `.where` / `.sort` / `.take` / `.toList`), the fluent predicate DSL (`.equals` / `.and` / `.or` / `.isNull` — **not** `===` / `&&` / `||`), the function-tier restriction, and usage patterns.

## Invocation Contract

Storage is referenced by name from function and datasource code — there is no `configParameters` / `moduleId` binding layer (unlike selectors or datasources embedded in grids). The contract is simply:

- The caller's package must have access to the storage's package (same package, or a declared dependency).
- Field names used in predicates / patches must match `objectTypeDef[]` `id`s.
- The implicit `id` column is always present on reads.

When a storage schema changes (column added / removed / renamed), every caller that references the affected column is a potential edit site. Find them via the `impact-analysis` skill (`dxs source explore reverse-trace <storage_referenceName> --branch <id>`) — the branch is the source of truth, not a local tree.

## Common Patterns

### Options / config table

Two columns: `key: string required`, `value: string required`. One row per configuration key, with `value` stringified even for non-string semantics (parsed by the consumer). Seed with an idempotent initialize flow that checks-then-inserts each key, so re-running is safe. Pairs with a flow-type datasource that returns the full row set for UI consumption.

### Rule table

One row per explicit rule, keyed by a composite of business ids (owner, project, warehouse, …) plus any qualifier (level, strategy). Add lookup-code columns alongside id columns when the UI needs to display labels without a join. Add an `is_active: boolean` column (nullable) so rules can be paused without deletion.

### Daily snapshot capture

One row per `(capture_date, entity_key…)` tuple. Wide aggregates stored denormalized (packaged amount, base amount, weights, shipped/received rolling totals). Retention governed by a feature-level configuration key.

### Patching a record with required columns

When a storage has any `required: true` columns — either by current schema design, or by pre-existing legacy schema you can't relax — every `$db.update(id, patch)` call has to include those columns in the patch, even if their value isn't changing. The platform validates the whole patch object against the full column schema, so omitting a required column fails the update with a validation error regardless of whether the existing record has that field populated.

The idiom is **read-then-patch**: pull the row first, then build the patch object that echoes the required fields alongside the actual change.

```typescript
// Storage: widget_option_storage
// Columns: key (required: true, string), value (required: true, string)

const rows = await $db.Acme.widget_option_storage
    .where(o => o.key.in(KEYS))
    .toList();

for (const row of rows) {
    const newValue = valuesByKey[row.key];
    // Patch MUST echo `key` even though we're only changing `value`,
    // because `key` is required: true on the storage schema.
    await $db.Acme.widget_option_storage
        .update(row.id, { key: row.key, value: newValue });
}
```

The opposite direction of drift also applies: adding a new `required: true` column to an existing storage forces every caller of `$db.update` to start echoing it. Treat any `required: true` change as a cross-cutting audit — use `impact-analysis` to enumerate the write-side callers of the storage on the branch before merging.

## Pre-Flight Checklist

1. `configurationTypeId: 17` and `isBlob: false` (unless you specifically need blob mode).
2. `accessModifier` set — default `public`.
3. `description` non-empty, ≤ 100 chars.
4. `referenceName`, `title`, and filename stem agree.
5. Package placement matches the feature (e.g. `Inventory`), not `Utilities`.
6. Every `objectTypeDef[]` entry has `id`, `type`, and `isCollection` set. Unused slots stay `null`.
7. Don't declare an explicit `id` column — the platform adds an implicit GUID.
8. Default every column's `required` to `false`; validate at the flow layer. `required: true` breaks partial patches via `$db.update(id, patch)` unless every caller **reads-then-patches** to echo the required columns (see [Common Patterns → Patching a record with required columns](#patching-a-record-with-required-columns)).
9. If adding a column to an existing storage, ensure the caller code tolerates nulls on pre-existing rows, or run a backfill in the same edit.

## Cross-References

- [`db.md`](../../db-query/references/db.md) — the `$db` runtime global: access path, API surface, predicate DSL (including the `.equals` / `.and` / `.or` / `.isNull` rules vs. native operators).
- [`file-format.md`](../../datex-studio-conventions/file-format.md) — `configurationTypeId` table and editing rules.
- [`calling-conventions.md`](../../datex-studio-runtime/calling-conventions.md) — `$db` is function-tier only.
- [`flow-datasources.md`](../../datasource-creator/references/flow-datasources.md) — flow-type datasources commonly wrap a storage read for UI consumption.
- [`functions.md`](../../function-creator/references/functions.md) — functions are the sole caller tier for `$db`. Write-side code (seeders, backfills, mutators) lives here.
