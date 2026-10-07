# `$db` — Storage Runtime Global

`$db` is the function-tier runtime handle for reading and writing the cloud-persisted Mongo-backed storage components described in [`storage.md`](../../storage-creator/references/storage.md). This doc covers **how to use `$db`** — access path, API surface, and the predicate DSL. For the schema side (column descriptors, `required`, additive evolution), see `storage.md`.

## Purpose & When to Use

Anywhere you need to read or mutate a feature's own storage from a function. UI components (forms, grids, editors, hubs) never reach `$db` directly — they bind to datasources, which in turn may wrap a `$db` call inside a flow-type datasource's `getListFlow` / `getByKeysFlow` / `getFlow`. Actions also cannot reach `$db` directly — see the tier restriction below.

## Access Path

```
$db.<Package>.<storage_referenceName>
```

The package is determined by the storage component's package placement (typically the feature package, e.g. `Acme`, not the default `Utilities`), and the storage's `referenceName` matches the filename stem — e.g. `$db.Acme.widget_option_storage`.
**Resolving `<Package>` when you don't already know it.** `<Package>` is the storage's *owning* package — concretely, either the package the current branch belongs to (the common case: the storage lives in the same package as the function calling it), or, when the call crosses package lines, the name of a package the caller's package references. Read the storage component's own package declaration directly (`dxs configuration get storage <referenceName> -b <branchId>`, or `dxs source explore` by referenceName) rather than guessing from a feature folder name or assuming it matches the calling function's package — a storage can be declared in a different package than every one of its callers.

## Tier Restriction — Function-Tier Only

`$db` is available only inside functions (`-flow.json`, `configurationTypeId: 9`) and the flow slots embedded inside flow-type datasources (`getListFlow` / `getByKeysFlow` / `getFlow`). It is **not** available inside actions (`-footprintFlow.json`), and it is not exposed to UI components.

When an action needs storage access, wrap the read/write in a function and call it via `$apis.<Package>.FootprintApi.extendedActions.<function>`. (This is inverted from the action-only `$datasource` scope on `-footprintDatasource.json` components.)

## API Surface

The observed API surface is grown as we encounter more usages — this table is not exhaustive.

| Call | Purpose |
|---|---|
| `.add(record)` | Insert one record. **Returns the generated `id` as a plain string** — NOT the record. `added?.id` fails the TS pass with `Property 'id' does not exist on type 'string'` (verified live in Studio); use the return value directly. **Date columns are typed `string` in the add payload** (`IStorageItemAdd_…`) — pass `new Date(x).toISOString()`, not a `Date` object (a `Date` fails validation; verified live 2026-08-10). |
| `.addMany(records)` | Insert a batch. |
| `.update(id, patch)` | Update a single record by its implicit GUID `id` with a partial patch. **Not a predicate-callback signature** — the first argument is the id string directly. **Null-valued patch keys are silently dropped** — you cannot clear a set column back to `null` via a patch; see the callout below. |
| `.updateMany(predicate, patch)` | Patch every matching record. Predicate is the same fluent form as `.where`. Verified in shipped PrintNode/PrintManager queue flows. |
| `.findOneAndModify(predicate, patch, options?)` | **Atomic read-modify-write** — the platform's only compare-and-swap primitive. Options: `{ sort?, select?, returnDocument?: 'before' \| 'after' }`. Returns the matched record or `undefined` if no match — so `predicate` + patch is an atomic claim: e.g. `i.locked.equals(false)` → `{ locked: true }` lets exactly one concurrent caller win. **No upsert option** (confirmed from designer typedefs): it cannot insert-if-absent, so atomic dedup of *inserts* is impossible — serialize through a single consumer instead. Verified in shipped PrintNode/PrintManager queue consumers. |
| `.remove(id)` | Delete one record by id. Returns boolean. |
| `.removeMany(predicate)` | Delete matching records. Predicate is the same fluent form as `.where`. |
| `.where(predicate)` | Filter. Predicate uses the fluent operator DSL described below. Chainable with `.sort`, `.skip`, `.take`, `.select`, `.toList`. |
| `.sort({ <field>: "asc" \| "desc" })` | Order. Chainable. |
| `.skip(n)` | Offset. Chainable (see also flow-db-datasources paging). |
| `.take(n)` | Limit. Chainable. |
| `.select('f1', 'f2', …)` | Server-side projection to the named fields (implicit `id` allowed). Chainable. Field names are type-checked against the storage schema. |
| `.toList()` | Materialize into an array. Terminal. |

`.where(...)` returns a cursor — it doesn't hit the store until a terminal like `.toList()` runs. Multiple calls like `.where(...).sort(...).take(10).toList()` compose into a single server-side query.

> **Date-range predicates on date columns: treat as unverified.** This doc's operator table lists `.lt`/`.gt` for number/Date, but the shipped PrintManager queue consumer explicitly works around a missing less-than for **date** columns (its stale-lock reclaim projects `locked_on` with `.select` and filters client-side: `new Date(row.locked_on).getTime() < cutoff`). Until a live date-range predicate is verified end-to-end, follow that idiom: project the date field on a bounded set and compare client-side. Number and string comparisons are unaffected.

> **`.toList()` can return `undefined` on a never-written storage.** A storage's backing collection isn't created until its first `.add(...)`. Until then, `.toList()` (with or without `.where(...)`) comes back **`undefined`, not `[]`** — so `(await …toList())[0]` and `(await …toList()).length` throw *"cannot read properties of undefined (reading '0')"* on a fresh environment, even though the same code works once any row exists. Optional-chaining the *row* (`rows[0]?.field`) does not help — the `[0]` index runs first. **Always coalesce the array before indexing:** `const rows = (await $db.<Pkg>.<storage>.where(...).toList()) ?? [];`.

> **Patches cannot write `null` over a set value.** `$db.update` / `.updateMany` / `.findOneAndModify` silently drop null-valued patch keys — the write succeeds, the other keys apply, and the null'd column keeps its old value with no error (probe-verified 2026-07-20: a sibling string column cleared while the null'd column kept its create-time value). A patch like `{ next_due_on: computed ?? null }` is a latent no-op on the null branch. **Fix: a typed sentinel plus read-side mapping** — write a value that is invalid in the domain (e.g. `0` for an epoch-ms column: `{ next_due_on: computed ?? 0 }`) and map it back to null wherever rows are hydrated (`row.next_due_on <= 0 ? null : row.next_due_on`). Document the sentinel in the storage column's `description` so readers know `0` means "cleared".

> **`$db` has no transactions.** There is no multi-write atomicity beyond a single `.findOneAndModify` call. For multi-row state changes, **order the writes so every crash interleaving self-heals** — e.g. in a winner-election pattern, mark the losers *before* atomically flipping the winner: dying between the writes leaves the winner unclaimed and the next pass re-elects it, whereas the reverse order strands the losers as a fresh group that acts twice. Design each write so a concurrent or repeated pass no-ops on rows already in the target state (predicate on the pre-state, patch to the post-state).
> **Shared budget / semaphore without a counter column.** `$db` has no atomic increment/decrement, so a "no more than N concurrent" budget can't be enforced with a single counter row (a read-then-write counter races). The one-row-per-lease pattern sidesteps this: each concurrent unit of work `.add()`s its own lease row (holder id, acquired-at timestamp), and the budget check is `.where(...).toList().length < N` immediately before adding — add-then-count rather than count-then-add, so the race window is the gap between the count and the add, not a stale counter. Reap stale leases (rows older than a timeout) before counting, since a crashed holder never gets to release. Back off with jitter and retry the count+add when the budget is full, rather than failing immediately. Always release (`.remove(leaseId)`) in a `finally` so a thrown error still frees the slot.
>

**The query builder enforces stage order in its types.** Each stage returns `Omit<IQueryBuilder<T>, …>`, removing the stages that may no longer follow, so an out-of-order chain fails validation with *"Property 'take' does not exist on type 'Omit<…>'"* (or `'toList'`). The order is **select → where → sort → skip → take → terminal**. Every stage is optional, and `select` may also come after `where`.

| After | Removed from the chain |
|---|---|
| `.select(...)` | `where`, `select`, `sort` |
| `.where(...)` | `where`, `skip`, `take`. **To page or limit a filtered query, `.sort(...)` first**: `.where(p).sort({...}).take(n).toList()` |
| `.sort(...)` | `sort`, `where`, `single` |
| `.skip(n)` | `sort`, `select`, `where`, `skip` |
| `.take(1)` | `toList` (and `sort`, `select`, `where`, `skip`, `take`). Finish with `.single()` |
| `.take(n)`, n > 1 | `single` (and `sort`, `select`, `where`, `skip`, `take`). Finish with `.toList()` |

Terminals: `.toList(): Promise<Partial<T>[]>`, `.single(): Promise<Partial<T>>`, `.first(): Promise<Partial<T>>` and `.count(): Promise<number>`. `.first()` is the cheapest one-row read and works straight off the storage: `$db.<Pkg>.<storage>.select('id').first()`. The typedef promises a row, but on an empty collection expect no row rather than an error (`_TODO_ (runtime unverified)`). Code that treats a missing row as an error, such as a reachability probe, must coalesce: `.first().then(row => row ?? {})`.

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

**`$utils.isDefined(value: any): boolean` is not a TypeScript type predicate** — it returns a plain `boolean`, not `value is T`, so guarding `if ($utils.isDefined(optionalArg))` does not narrow `optionalArg` from `string | undefined` to `string` for TypeScript's purposes. Passing the still-optional-typed variable straight into a strictly-typed predicate method (e.g. `.equals(optionalArg)` on a `StringExprBuilder`, which wants `string | StringExprBuilder`) is a type error even though the `isDefined` guard makes it logically safe at runtime. Use a non-null assertion inside the guarded branch (`.equals(optionalArg!)`) or an explicit `!= null` check, which TypeScript does narrow on.

### Observed operators

Grown as encountered. Document additions here when you use a new one:

| Operator | Purpose | Example |
|---|---|---|
| `.equals(value)` | Scalar equality | `r.id.equals(guid)` |
| `.in(values)` | Set membership | `o.key.in(['KEY_A', 'KEY_B'])` |
| `.isNull()` | Null check | `r.is_active.isNull()` |
| `.and(other)` | Logical AND | `a.and(b)` |
| `.or(other)` | Logical OR | `a.or(b)` |
| `.ne(value)` | Scalar inequality (string/number/Date; NOT `.notEquals`) — verified live (Studio Validate + Preview + runtime) | `r.status_id.ne(closedId)` |
| `.gt(value)` / `.gte(value)` | Greater-than / greater-than-or-equal (number/Date) | `r.qty.gt(0)` |
| `.lt(value)` / `.lte(value)` | Less-than / less-than-or-equal (number/Date) | `r.qty.lte(max)` |
| `.includes(pattern)` | String **regex** match (not substring!); `(?i)` prefix = case-insensitive, `^` anchors work | `r.name.includes('(?i)' + needle)`, `r.name.includes('^OA-TEST-')` |
| `.isNotNull()` | Not-null check; also the read-all idiom on the implicit id column | `r.owner_id.isNotNull()`, `c.id.isNotNull()` (read all) |
| `.any(s => …)` | Collection predicate (array-typed fields) | `r.items.any(i => i.qty.gt(0))` |

This is the complete method set, confirmed from the platform's designer-context definition (the `StringExprBuilder` / `NumberExprBuilder` / `DateExprBuilder` / `BoolExprBuilder` / `ArrayExpressionBuilder` / `BaseExprBuilder` interfaces in `DesignerConfigContextTemplates.Global.cs`). The comparison methods are the short `te`-suffixed forms `.gt` / `.gte` / `.lt` / `.lte` — there is **no** `.greaterThan`, `.notEquals`, `.ge`, or `.le`. `equals` / `ne` / `in` apply to string, number, and Date columns; `gt`/`gte`/`lt`/`lte` to number and Date; `includes` (regex) to string; `isNull`/`isNotNull` to any column; `any()` to array-typed columns; `and`/`or` compose `BoolExprBuilder`s. Operators can also be applied dynamically via the accessor form `r[column][operator](value)` (see [`flow-db-datasources.md`](flow-db-datasources.md)).

## Result field optionality mirrors `required`, unlike datasources

Records returned by `$db` reads (`.toList()`, `.add(...)` return, row access inside `.where(...)` callbacks' result) are typed in the generated context against the storage's own `required` flag per column: a column declared `required: true` on the storage comes back **non-optional** on the caller-side row type; every other column comes back optional (`T | undefined`). This is the opposite of what an author coming from the OData/flow-datasource result shape expects — on those, **every** field is optional regardless of the entity's own required flags (see [`odata-datasources.md` → Result fields are TypeScript-optional on the caller side](../../datasource-creator/references/odata-datasources.md#result-fields-are-typescript-optional-on-the-caller-side) and [`flow-datasources.md` → Result fields are TypeScript-optional on the caller side](../../datasource-creator/references/flow-datasources.md#result-fields-are-typescript-optional-on-the-caller-side)). Storage rows are the one result shape where `required` actually propagates into the type — don't assume `$db`, OData, and flow-datasource rows are identical at the type level.

```typescript
// Storage has: id (required), owner_id (nullable), project_id (nullable), is_active (nullable)
// $db-returned row type: { id: string, owner_id?: number, project_id?: number, is_active?: boolean, ... }

const rules = await $db.Acme.widget_rule_storage.toList();

// ✓ Required columns typed non-optional, nullable columns optional — matches the storage schema
type Rule = { id: string, owner_id?: number, project_id?: number, is_active?: boolean };
const typed: Rule[] = rules;

// ✗ Marking a required column optional, or a nullable column non-optional, mismatches the
// generated type and can fail the import depending on how the local type is used downstream.

// ✓ Inferred — use ?. / ?? on access to the nullable columns only
for (const r of rules) {
    const active = r.is_active ?? true;
    // ...
}
```

The same rule applies to nested objects and collections inside a row (e.g. child records loaded through a flow-datasource-then-$db pipeline): a nested `required: true` field stays non-optional, siblings stay optional. Narrow nullable fields at the access site with `?.` / `??` / `$utils.isDefined`; don't blanket-mark every field optional on a local annotation — that drifts from the generated shape for the required columns.

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
7. **Local types for `$db` result rows mirror `required`** — a `required: true` column is non-optional on the generated row type, every other column is optional (`T | undefined`). Leave inferred, or annotate matching that split; don't blanket-mark every field optional (that's the datasource rule, not the storage one).
8. After any storage schema change, find callers via `impact-analysis` (`dxs source explore reverse-trace <storage_referenceName> --branch <id>`) and audit each one.
9. Reads coalesce the materialized array before indexing — `(await …toList()) ?? []` — because a never-written storage returns `undefined`, not `[]`.

## Cross-References

- [`storage.md`](../../storage-creator/references/storage.md) — storage component authoring, column descriptors, `required: true` pitfalls.
- [`functions.md`](../../function-creator/references/functions.md) — `$db`'s caller tier.
- [`flow-datasources.md`](../../datasource-creator/references/flow-datasources.md) — flow-type datasources that wrap `$db` reads for UI consumption.
- [`calling-conventions.md`](../../datex-studio-runtime/calling-conventions.md) — the tier matrix, including why actions can't reach `$db`.
