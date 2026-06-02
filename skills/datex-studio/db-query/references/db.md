# `$db` — Storage Runtime Global

`$db` is the function-tier runtime handle for reading and writing the cloud-persisted Mongo-backed storage components described in [`storage.md`](../../storage-creator/references/storage.md). This doc covers **how to use `$db`** — access path, API surface, and the predicate DSL. For the schema side (column descriptors, `required`, additive evolution), see `storage.md`.

## Purpose & When to Use

Anywhere you need to read or mutate a feature's own storage from a function. UI components (forms, grids, editors, hubs) never reach `$db` directly — they bind to datasources, which in turn may wrap a `$db` call inside a flow-type datasource's `getListFlow` / `getByKeysFlow` / `getFlow`. Actions also cannot reach `$db` directly — see the tier restriction below.

## Access Path

```
$db.<Package>.<storage_referenceName>
```

The package is determined by the storage component's package placement (typically the feature package, e.g. `Acme`, not the default `Utilities`), and the storage's `referenceName` matches the filename stem — e.g. `$db.Acme.widget_option_storage`.

## Tier Restriction — Function-Tier Only

`$db` is available only inside functions (`-flow.json`, `configurationTypeId: 9`) and the flow slots embedded inside flow-type datasources (`getListFlow` / `getByKeysFlow` / `getFlow`). It is **not** available inside actions (`-footprintFlow.json`), and it is not exposed to UI components.

When an action needs storage access, wrap the read/write in a function and call it via `$apis.<Package>.FootprintApi.extendedActions.<function>`. (This is inverted from the action-only `$datasource` scope on `-footprintDatasource.json` components.)

## API Surface

The observed API surface is grown as we encounter more usages — this table is not exhaustive.

| Call | Purpose |
|---|---|
| `.add(record)` | Insert one record. Returns the record including its generated `id`. |
| `.addMany(records)` | Insert a batch. |
| `.update(id, patch)` | Update a single record by its implicit GUID `id` with a partial patch. **Not a predicate-callback signature** — the first argument is the id string directly. |
| `.removeMany(predicate)` | Delete matching records. Predicate is the same fluent form as `.where`. |
| `.where(predicate)` | Filter. Predicate uses the fluent operator DSL described below. Chainable with `.sort`, `.take`, `.toList`. |
| `.sort({ <field>: "asc" \| "desc" })` | Order. Chainable. |
| `.take(n)` | Limit. Chainable. |
| `.toList()` | Materialize into an array. Terminal. |

`.where(...)` returns a cursor — it doesn't hit the store until a terminal like `.toList()` runs. Multiple calls like `.where(...).sort(...).take(10).toList()` compose into a single server-side query.

## Predicate DSL — Fluent Operators, Not Raw TypeScript

`$db` predicates are **not** evaluated as raw JavaScript against plain records. The predicate function is introspected at compile time and translated into a server-side query; each field access (`r.<field>`) returns a **column-expression object** whose fluent methods (`.equals`, `.isNull`, `.and`, `.or`, …) are the building blocks of the query.

This has two consequences that catch authors off guard:

1. **Use `.equals(value)`, not `===`.** Native operators don't participate in the translation and silently fall through — the generated query either errors at runtime or omits the intended predicate.
2. **Use `.and(...)` / `.or(...)` chained on the column expressions, not `&&` / `||`.** Same reason: the logical operators need to be composable column expressions, not native JavaScript boolean ops.

### Correct form

```typescript
// Single condition
const cursor = $db.Acme.widget_rule_storage
    .where(r => r.warehouse_id.equals(warehouseId));

// Conjunction
const cursor = $db.Acme.widget_rule_storage
    .where(r => r.warehouse_id.equals(warehouseId)
                 .and(r.is_active.equals(true)));

// Nullable column: "is_active is true OR is_active is null"
const cursor = $db.Acme.widget_rule_storage
    .where(r => r.warehouse_id.equals(warehouseId)
                 .and(r.is_active.equals(true).or(r.is_active.isNull())));

const rules = await cursor.toList();
```

### Wrong form — silently compiles, misbehaves at runtime

```typescript
// ✗ Native operators — do not use
const cursor = $db.Acme.widget_rule_storage
    .where(r => r.warehouse_id === warehouseId
                 && (r.is_active === true || r.is_active === null));
```

TypeScript accepts it (the column-expression objects have loose types), so there is no compile-time signal. The misbehavior appears at runtime: the predicate either errors during translation, or the conjunction collapses and the resulting set is wrong. Treat **every** comparison and boolean composition inside a `$db` predicate as a method call on the column expression, not a native operator.

### Observed operators

Grown as encountered. Document additions here when you use a new one:

| Operator | Purpose | Example |
|---|---|---|
| `.equals(value)` | Scalar equality | `r.id.equals(guid)` |
| `.in(values)` | Set membership | `o.key.in(['KEY_A', 'KEY_B'])` |
| `.isNull()` | Null check | `r.is_active.isNull()` |
| `.and(other)` | Logical AND | `a.and(b)` |
| `.or(other)` | Logical OR | `a.or(b)` |
| `.ne(value)` | Scalar inequality (string/number/Date) | `r.status_id.ne(closedId)` |
| `.gt(value)` / `.gte(value)` | Greater-than / greater-than-or-equal (number/Date) | `r.qty.gt(0)` |
| `.lt(value)` / `.lte(value)` | Less-than / less-than-or-equal (number/Date) | `r.qty.lte(max)` |
| `.includes(pattern)` | String regex match; `(?i)` prefix = case-insensitive | `r.name.includes('(?i)' + needle)` |
| `.isNotNull()` | Not-null check | `r.owner_id.isNotNull()` |
| `.any(s => …)` | Collection predicate (array-typed fields) | `r.items.any(i => i.qty.gt(0))` |

This is the complete method set, confirmed from the platform's designer-context definition (the `StringExprBuilder` / `NumberExprBuilder` / `DateExprBuilder` / `BoolExprBuilder` / `ArrayExpressionBuilder` / `BaseExprBuilder` interfaces in `DesignerConfigContextTemplates.Global.cs`). The comparison methods are the short `te`-suffixed forms `.gt` / `.gte` / `.lt` / `.lte` — there is **no** `.greaterThan`, `.ge`, or `.le`. `equals` / `ne` / `in` apply to string, number, and Date columns; `gt`/`gte`/`lt`/`lte` to number and Date; `includes` (regex) to string; `isNull`/`isNotNull` to any column; `any()` to array-typed columns; `and`/`or` compose `BoolExprBuilder`s. Operators can also be applied dynamically via the accessor form `r[column][operator](value)` (see [`flow-db-datasources.md`](flow-db-datasources.md)).

## Result fields are TypeScript-optional on the caller side

Records returned by `$db` reads (`.toList()`, `.add(...)` return, row access inside `.where(...)` callbacks' result) are typed with **every field optional** — `T | undefined` — even for columns declared `required: true` on the storage. The platform's type generator does not propagate the storage's `required` slot into the caller-side row type, so a strict local annotation will fail the import.

This matches the same behavior on datasources (see [`odata-datasources.md` → Result fields are TypeScript-optional on the caller side](../../datasource-creator/references/odata-datasources.md#result-fields-are-typescript-optional-on-the-caller-side) and [`flow-datasources.md` → Result fields are TypeScript-optional on the caller side](../../datasource-creator/references/flow-datasources.md#result-fields-are-typescript-optional-on-the-caller-side)) — treat `$db`, OData datasource, and flow-datasource result records identically at the type level.

```typescript
// Storage has: id (required), owner_id (nullable), project_id (nullable), is_active (nullable)
// $db-returned row type: { id?: string, owner_id?: number, project_id?: number, is_active?: boolean, ... }

const rules = await $db.Acme.widget_rule_storage.toList();

// ✗ Strict local type — import fails with "Type '{ id?: string, ... }[]' is not assignable to type '{ id: string, ... }[]'."
type Rule = { id: string, owner_id: number | null, project_id: number | null, is_active: boolean };
const typed: Rule[] = rules;

// ✓ Every field optional on the local type, or leave inferred
type Rule = { id?: string, owner_id?: number, project_id?: number, is_active?: boolean };
const typed: Rule[] = rules;

// ✓ Inferred — use ?. / ?? on access
for (const r of rules) {
    const active = r.is_active ?? true;
    // ...
}
```

The same rule applies to nested objects and collections inside a row (e.g. child records loaded through a flow-datasource-then-$db pipeline). Either leave result variables inferred and narrow at the access site with `?.` / `??` / `$utils.isDefined`, or annotate with a fully-optional shape. Never annotate with a strict shape — the import will fail.

## The Implicit `id` Column

Every storage record carries a platform-generated GUID `id` string column (see [`storage.md` → Implicit `id` column](../../storage-creator/references/storage.md#column-descriptors)). All `$db` predicates and `.update(id, patch)` calls key off this.

```typescript
// Lookup by id
const cursor = $db.Acme.widget_rule_storage
    .where(r => r.id.equals(guid));

// Patch by id — first argument is the id string, NOT a predicate callback
await $db.Acme.widget_rule_storage.update(guid, { is_active: false });
```

## Common Patterns

### Read-list → map

```typescript
const rows = await $db.Acme.widget_rule_storage
    .sort({ project_id: "asc" })
    .toList();

const summaries = rows.map(r => ({
    project: r.project_lookupcode,
    warehouse: r.warehouse_name,
    level: r.rule_level
}));
```

### Filter-then-index

```typescript
const activeRules = await $db.Acme.widget_rule_storage
    .where(r => r.warehouse_id.equals(warehouseId)
                 .and(r.is_active.equals(true).or(r.is_active.isNull())))
    .toList();

const byProject = new Map<number, typeof activeRules[number]>();
for (const rule of activeRules) {
    byProject.set(rule.project_id, rule);
}
```

### Read-then-patch for a storage with `required: true` columns

See [`storage.md` → Patching a record with required columns](../../storage-creator/references/storage.md#patching-a-record-with-required-columns) for the full idiom. The key point: `.update(id, patch)` must echo every `required: true` column, even when its value isn't changing, because the platform validates the patch against the full schema.

## Invocation Contract

Storage is referenced by name — there is no `configParameters` / `moduleId` binding layer. The contract is:

- The caller's package must have access to the storage's package (same package, or a declared dependency).
- Field names in predicates / patches must match the storage's `objectTypeDef[]` `id` values exactly.
- The implicit `id` column is always present on reads and is the sole key for `.update()`.

When a storage schema changes (column added / removed / renamed), every caller referencing the affected column is a potential edit site. Find them via the `impact-analysis` skill (`dxs source explore reverse-trace <storage_referenceName> --branch <id>`) — the branch is the source of truth, not a local tree.

## Pre-Flight Checklist

1. Caller is a function (`configurationTypeId: 9`) or a flow slot inside a flow-type datasource. Actions cannot reach `$db`.
2. The storage's package is accessible from the caller's package.
3. Every field accessed in a predicate matches an `objectTypeDef[]` `id` on the storage.
4. **Predicate uses `.equals(...)` / `.and(...)` / `.or(...)` / `.isNull()` — never `===`, `&&`, `||`.**
5. `.update(id, patch)` passes the id string directly as the first argument (not a predicate callback).
6. If the storage has any `required: true` columns, `.update` calls **read the current row first** and echo the required fields in the patch.
7. **Local types for `$db` result rows treat every field as optional** (`T | undefined`), even for `required: true` columns. Strict annotations fail the import — leave inferred or annotate with optional fields.
8. After any storage schema change, find callers via `impact-analysis` (`dxs source explore reverse-trace <storage_referenceName> --branch <id>`) and audit each one.

## Cross-References

- [`storage.md`](../../storage-creator/references/storage.md) — storage component authoring, column descriptors, `required: true` pitfalls.
- [`functions.md`](../../function-creator/references/functions.md) — `$db`'s caller tier.
- [`flow-datasources.md`](../../datasource-creator/references/flow-datasources.md) — flow-type datasources that wrap `$db` reads for UI consumption.
- [`calling-conventions.md`](../../datex-studio-runtime/calling-conventions.md) — the tier matrix, including why actions can't reach `$db`.
