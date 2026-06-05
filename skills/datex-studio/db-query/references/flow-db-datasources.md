# Flow-Type Datasources Over `$db`

For the datasource taxonomy see [`datasources.md`](../../datasource-creator/references/datasources.md); for flow-type datasource authoring in general see [`flow-datasources.md`](../../datasource-creator/references/flow-datasources.md); for the `$db` DSL itself see [`db.md`](db.md).

This doc captures the specific authoring rules for a flow-type datasource (`type: "flows"`, `configurationTypeId: 6` or `19`) whose `getListFlow` reads from `$db.<Pkg>.<storage>` and feeds a grid or selector. The platform injects `$top` / `$skip` / `$orderby` / `$filter` into `getListFlow.inParams`, and the callsite UI (grid column headers, selector full-text box) routes user intent through those params back into the `$db` query. Getting that wiring right is the difference between a grid that filters and paginates at the database versus one that silently pulls every row and slices in memory.

## Why This Shape is Different

An OData datasource is declarative: `paths`, `queryOptions`, and `dynamicFilters` are strings the platform compiles into an OData URL. A flow-type datasource over `$db` is imperative: you write TypeScript that builds the query, calls terminals, and shapes the result. That freedom means every guarantee the declarative shape handed you — paging at the database, operator translation, case-insensitive match — becomes your responsibility to implement, and a one-line mistake silently falls back to "load everything, sort in JS."

Eight concepts, in order of how often they bite.

## 1. `getQuery()` Factory — Cursors Are Single-Shot

`$db.<storage>.where(...)` returns a cursor. Terminals (`.toList()`, `.count()`) **consume** the cursor. Chaining additional `.where(...)` / `.sort(...)` onto a consumed cursor silently no-ops — TypeScript accepts it because the method signature is preserved, but the underlying query has already been sent.

**Wrong** — cursor reuse after terminal:

```typescript
// ✗ silently wrong
let cursor = $db.Acme.widget_daily_snapshot.where(r => r.warehouse_id.equals(w));
const results = await cursor.skip(skip).take(top).toList();   // cursor consumed
const count = await cursor.count();                            // no-op; returns stale/wrong
```

**Right** — wrap the query in a factory and call it per terminal:

```typescript
function getQuery() {
    return $db.Acme.widget_daily_snapshot.where(r => {
        let predicate = r.capture_date.equals($flow.inParams.capture_date)
            .and(r.warehouse_id.equals($flow.inParams.warehouse_id));
        // …
        return predicate;
    });
}

const [results, count] = await Promise.all([
    getQuery().sort({ capture_date: 'desc' }).skip($skip).take($top).toList(),
    getQuery().count(),
]);
```

The factory rebuilds the cursor on every call. The `Promise.all` runs the page fetch and the count in parallel at the database.

## 2. Compose Predicates Inside a Single `.where(...)` Callback

`.where(r => ...)` does not compose across multiple calls the way you might expect — each chained `.where` creates a new cursor stage. Compose the entire predicate inside **one** callback using the fluent DSL's `.and()` / `.or()` methods.

**Wrong** — `.where().where()` chain:

```typescript
// ✗ second .where replaces / shadows in unpredictable ways
$db.<storage>.where(r => r.a.equals(x)).where(r => r.b.equals(y))
```

**Right** — single callback, mutate a local `predicate` variable, return at end:

```typescript
$db.<storage>.where(r => {
    let predicate = r.a.equals(x).and(r.b.equals(y));

    if ($utils.isDefined(optionalIds) && optionalIds.length > 0) {
        predicate = predicate.and(r.c.in(optionalIds));
    }

    if ($utils.isDefinedTrimmed(fts)) {
        const needle = fts.toLowerCase();
        predicate = predicate.and(
            r.label_a.includes(`(?i)${needle}`)
                .or(r.label_b.includes(`(?i)${needle}`))
        );
    }

    for (const filter of dynamicFilters) {
        predicate = predicate.and(r[filter.column][filter.operator](filter.value));
    }

    return predicate;
});
```

The reassignment pattern (`predicate = predicate.and(...)`) works because `.and()` returns a new composed expression — the DSL is immutable at the expression level.

## 3. Push Paging to `$db`

Default habit from OData/array work: `await cursor.toList()`, then `.slice(skip, skip + top)` in memory. Don't. `$db` supports `.skip(n).take(m)` as cursor stages that translate to Mongo `$skip` / `$limit` — paging happens at the database:

```typescript
const [results, count] = await Promise.all([
    getQuery().sort(orderBy ?? { capture_date: 'desc' }).skip($skip).take($top).toList(),
    getQuery().count(),
]);

$flow.outParams.totalCount = count;
$flow.outParams.result = results.map(mapRow);
```

**Alias the `$top` / `$skip` params** to locals early:

```typescript
const $skip = $flow.inParams.$skip ?? 0;
const $top = $flow.inParams.$top ?? 100;
```

…so the rest of the code reads cleanly. (Unlike the enum-dropdown pattern in [`flow-datasources.md`](../../datasource-creator/references/flow-datasources.md), `$db`-backed datasources can safely use `$top`/`$skip` as local names because they're passed through to cursor terminals, not held across activity boundaries.)

Pair `.take(pageSize)` with `.count()` of the same base query in a `Promise.all` so the grid has both page and total in one round-trip pair. `totalCount` drives the paging UI; if you skip the count the grid shows "Page 1" forever.

## 4. Case-Insensitive Full-Text: `(?i)` Regex, Not `.toLowerCase()`

Intuitive wrong turn: `r.label.toLowerCase().includes(...)` — but the DSL has no `.toLowerCase()` on column expressions; even if it did, the match would evaluate per-row in JS after the fetch. `$db.includes()` accepts a regex string; prefix with `(?i)` for Mongo-side case-insensitive match:

```typescript
const needle = fts.toLowerCase();  // normalize the user input
predicate = predicate.and(r.label.includes(`(?i)${needle}`));
```

For multi-field OR across labels, chain `.or()`:

```typescript
predicate = predicate.and(
    r.material_lookupcode.includes(`(?i)${needle}`)
        .or(r.packaging_shortname.includes(`(?i)${needle}`))
        .or(r.warehouse_name.includes(`(?i)${needle}`))
);
```

Escape the needle if the user input can contain regex metacharacters. The platform helper `escapeRegex` (see `apply_storage_datasource_dynamic_filters_flow`) does this inside the operator translator — for your own full-text call, either escape explicitly or trust that the search box strips the offenders.

## 5. Dynamic Filter / Order-By Helper Flows

The platform publishes two shared function-tier flows under `Utilities`:

| Flow | Input | Output |
|---|---|---|
| `apply_storage_datasource_dynamic_filters_flow` | `{ filter: <the injected $filter object> }` | `{ filters: [{ column: string, operator: string, value: any }] }` |
| `apply_storage_datasource_dynamic_order_by_flow` | `{ order_by: <the injected $orderby object> }` | `{ order_by: { [column]: 'asc' \| 'desc' } }` |

The filters flow translates grid-facing operator names (`equals`, `contains`, `startsWith`, `notEqual`, `in`, `blank`, `lessThanOrEqual`, date macros like `sameDay`/`sameWeek`, …) into `$db`-side operators (`equals`, `includes` with `(?i)…` regex, `ne`, `in`, `isNull`, `lt`, `lte`, `gt`, `gte`). It also expands date macros into `gte`/`lte` pairs and range-expands string-typed date-equal filters.

**The output `filters` array is consumed verbatim.** Each entry's `column` is passed through as `r[filter.column]` and each `operator` as a method name — see §7 for the column-name rule.

**Call both helpers near the top of the flow**, before building `getQuery()`, so the closure captures the resolved `dynamicFilters` and `orderBy`:

```typescript
const dynamicFilters = (await $flows.Utilities.apply_storage_datasource_dynamic_filters_flow({
    filter: $flow.inParams.$filter
}))?.filters ?? [];

const orderBy = (await $flows.Utilities.apply_storage_datasource_dynamic_order_by_flow({
    order_by: $flow.inParams.$orderby
})).order_by;
```

The `?? []` on filters matters — the helper can return `null` when `$filter` is absent; without the fallback the `for (const filter of dynamicFilters)` inside `getQuery()` explodes.

## 6. `$filter` / `$orderby` Are Auto-Injected `getListFlow` inParams

For the grid to push its column-header filter/sort UI into your datasource, the `getListFlow.inParams` array must declare two platform-injected params alongside `$top` / `$skip`:

```json
{"id": "$orderby", "type": "object", "isCollection": true,  "required": false, /* full param-descriptor boilerplate */ },
{"id": "$filter",  "type": "object", "isCollection": false, "required": false, /* full param-descriptor boilerplate */ }
```

These do **not** appear on the datasource component's top-level `inParams` — just inside `getListFlow.inParams`. The platform injects values at call time based on which columns the user has filtered/sorted.

The matching pair — how the grid **advertises** its sortable and filterable columns to that UI — lives on the datasource component itself and on its grid-side consumer copy (see §8).

## 7. `r[filter.column]` Is Verbatim — Column Names Must Match the Row Under Inspection

This is the single subtlest trap in the pattern. The `dynamicFilters` loop:

```typescript
for (const filter of dynamicFilters) {
    predicate = predicate.and(r[filter.column][filter.operator](filter.value));
}
```

…passes `filter.column` through as a property access against `r`. `r` is a column-expression object whose properties match the storage's `objectTypeDef[].id`s. If `filter.column` is `"warehouseId"` (camelCase) but the storage declares `"warehouse_id"` (snake_case), `r["warehouseId"]` is `undefined` and the predicate throws at runtime.

**Rule**: every `column` value that flows through the helper must match the row shape under inspection.

### Snake_case all internal identifiers

Internal-to-the-grid identifiers are **snake_case** across the board: storage column names, flow inParams (`capture_date`, `warehouse_id`, `material_ids`, `full_text_search`), `outParams[0].objectTypeDef[].id`, `queryOptionsObjectTypeDef[].id`, the `oneOf.constantValue` literals on `$orderby.column` and `$filter.operands.*Filters.column` unions, grid column `id` and `source`, dynamic registration entries' `id` and `dynamicOrderBys[].property`, per-column `dynamicOrderBy` / `dynamicFilter` / `dynamicFilterType.id` — everything. Customer-facing strings (column `displayName`, button `label`, hub tab `title`) stay sentence-case English.

The only camelCase that survives inside an internal block is **external-component contract**: a `dropdownConfig.configId: "warehouse_dd"` block's `configParameters[0].parameter.id` must spell the selector's actual inParam — `warehouseId` for `warehouse_dd`, `projectId` for `owners_dd`, etc. Verify the contract by reading the selector's `inParams[0].id` before assuming.

### Non-aggregating datasources (read passthrough from storage)

`r` is the storage row. Snake_case storage field names cover every wiring location.

### Aggregating datasources (group-by in memory after the query)

The `$db`-side predicate is built against storage fields. The dynamic filter/sort runs **post-aggregation** against the aggregated row objects — and per the snake_case-everywhere rule above, those aggregated keys are also snake_case (`total_packaged_amount`, `material_lookupcode` as a grouping key, etc.), matching the storage field names they derive from. You cannot push the dynamic filter into `$db`-side `.where` because the aggregated columns are computed in JS, not on the row, but the *names* stay aligned.

Apply the dynamic filter and order-by in JS after aggregation, using the snake_case aggregated keys:

```typescript
function matchesFilter(value: any, op: string, target: any): boolean {
    switch (op) {
        case 'equals':    return value === target;
        case 'ne':        return value !== target;
        case 'in':        return Array.isArray(target) && target.includes(value);
        case 'includes':  return value != null && new RegExp(String(target)).test(String(value));
        case 'isNull':    return value == null;
        case 'isNotNull': return value != null;
        case 'lt':        return value < target;
        case 'lte':       return value <= target;
        case 'gt':        return value > target;
        case 'gte':       return value >= target;
        default:          return true;
    }
}

let result = Array.from(groups.values());

if (dynamicFilters.length > 0) {
    result = result.filter(row => dynamicFilters.every(f =>
        matchesFilter(row[f.column], f.operator, f.value)
    ));
}

if (orderBy) {
    const entries = Object.entries(orderBy);
    result.sort((a, b) => {
        for (const [col, dir] of entries) {
            const av = a[col], bv = b[col];
            if (av === bv) continue;
            const cmp = av == null ? -1 : bv == null ? 1 : (av < bv ? -1 : 1);
            return dir === 'desc' ? -cmp : cmp;
        }
        return 0;
    });
}

$flow.outParams.totalCount = result.length;
$flow.outParams.result = result.slice($skip, $skip + $top);
```

Every `dynamicOrderBy` / `dynamicFilter` in the grid columns and every registration entry uses the **same snake_case key** the aggregator wrote (`material_lookupcode`, `total_packaged_amount`) — which by convention matches the storage field name.

### Summary table

| Datasource shape | `$db` predicate fields | Dynamic filter/sort column names | Registration arrays |
|---|---|---|---|
| Passthrough (non-aggregating) | storage snake_case | storage snake_case | storage snake_case |
| Aggregating | storage snake_case (pre-agg base predicate only — full-text + fixed inParams) | aggregated snake_case keys (verbatim from storage) | aggregated snake_case keys |

The full-text `.includes('(?i)…')` clause always runs pre-aggregation against storage fields, regardless of shape — it's a performance-bounded base filter, not part of the dynamic filter loop.

## 8. `dynamicFilters` / `dynamicOrderBys` Registrations — Four Places Must Stay in Sync

The grid advertises its sortable/filterable columns through arrays that must be **mirrored** in two locations, with `allSelectedIs*` flags set on one of them:

| Location | Purpose |
|---|---|
| `grid.datasourceConfig.dynamicFilters` | Grid-side copy — tells the grid which columns the datasource can filter |
| `grid.datasourceConfig.dynamicOrderBys` | Grid-side copy — tells the grid which columns the datasource can sort |
| `grid.datasources[0].dynamicFilters` | Datasource component copy — must match the grid-side copy byte-for-byte |
| `grid.datasources[0].dynamicOrderBys` | Datasource component copy — must match the grid-side copy byte-for-byte |

Plus on `grid.datasources[0]`:

- `allSelectedIsDynamicFilters: true`
- `allSelectedIsDynamicOrderBys: true`

Shapes:

```json
"dynamicFilters": [
  {"id": "capture_date", "type": "date",   "isCollection": false, /* full param boilerplate */ },
  {"id": "warehouse_id", "type": "number", "isCollection": false, /* full param boilerplate */ },
  {"id": "total_packaged_amount", "type": "number", "isCollection": false, ... }
],
"dynamicOrderBys": [
  {"property": ["capture_date"]},
  {"property": ["warehouse_id"]},
  {"property": ["total_packaged_amount"]}
]
```

Each entry is one **unique** field name — the union of everything any column wires to. A single field used by multiple columns appears once. Field ids here must match the column-name-under-inspection rule in §7.

### Per-column attributes

Each column on the grid carries four attributes that wire it into the dynamic machinery:

- `dynamicOrderBy`: string — the field name to sort on (same name rule as above). Set to `null` to make the column non-sortable by the header.
- `dynamicFilter`: string — the field name to filter on. Set to `null` to make the column non-filterable.
- `dynamicFilterType`: parameter descriptor — same shape as a `dynamicFilters` registration entry. Mirrors the target field's type.
- `dynamicFilterControl`: control descriptor — the UI widget shown in the filter header: `textBox`, `numberBox`, `dateBox`, or `selectBox` (for id-based filters that should use a dropdown).

**Identifier columns** (lookupcode-style) — two patterns, picked on data volume:

1. **Default for high-volume storage: filter by `textBox` on the string field.** Sort on and filter on the same readable field (`material_lookupcode`, `location_name`, …). The helper flow translates `contains` → `includes` with `(?i)` regex, which pushes to `$db` on a passthrough shape, so substring matching stays at the database.

    ```json
    {
      "id": "material_lookupcode",
      "source": "material_lookupcode",
      "displayName": "Material",
      "dynamicOrderBy": "material_lookupcode",
      "dynamicFilter": "material_lookupcode",
      "dynamicFilterType": {"id": "material_lookupcode", "type": "string", "isCollection": false, ...},
      "dynamicFilterControl": {"type": "textBox", "textBoxConfig": {...}}
    }
    ```

2. **Selector-backed only when the option set is already bounded.** A `selectBox` pointed at a `*_dd` selector is appropriate when the backing datasource is small or can be scoped cheaply — e.g. `warehouse_dd` (backed by a bounded warehouse list) or `projects_dd` / `owners_dd` (backed by a platform OData endpoint). Use sparingly: a dropdown that loads distinct `(id, label)` tuples from a multi-GB storage fetches the full source set every time the user opens the filter. See [Don't build distinct-values selectors over high-volume storage](#dont-build-distinct-values-selectors-over-high-volume-storage) below.

    ```json
    {
      "id": "warehouse_name",
      "source": "warehouse_name",
      "displayName": "Warehouse",
      "dynamicOrderBy": "warehouse_name",
      "dynamicFilter": "warehouse_id",
      "dynamicFilterType": {"id": "warehouse_id", "type": "number", "isCollection": false, ...},
      "dynamicFilterControl": {
        "type": "selectBox",
        "selectBoxConfig": {
          "dropdownConfig": {
            "configId": "warehouse_dd",
            "moduleId": "Inventory",
            "configParameters": [{
              "parameter": {"id": "warehouseId", "type": "number", "isCollection": true, ...},
              "value": ""
            }],
            "configOutParameters": null
          },
          "type": "dropdown",
          "allowMultiSelection": true
        }
      }
    }
    ```

    Note `parameter.id` is `warehouseId` (camelCase) — that's `warehouse_dd`'s own contract, not ours. Internal-to-the-grid identifiers around it (`id`, `source`, `dynamicFilter`, `dynamicFilterType.id`) all stay snake_case.

**Data columns** — sort and filter on the same field, control matches type:

```json
{
  "id": "total_packaged_amount",
  "source": "total_packaged_amount",
  "displayName": "Total packaged amount",
  "dynamicOrderBy": "total_packaged_amount",
  "dynamicFilter": "total_packaged_amount",
  "dynamicFilterType": {"id": "total_packaged_amount", "type": "number", "isCollection": false, ...},
  "dynamicFilterControl": {"type": "numberBox", "numberBoxConfig": {...}}
}
```

**Unwired columns** — array columns, JSON blobs, derived columns — set both to `null` and both attribute descriptors to `null`:

```json
{"id": "serial_numbers", "dynamicOrderBy": null, "dynamicFilter": null, "dynamicFilterType": null, "dynamicFilterControl": null}
```

### Selector-backed filters reference an `*_dd` selector

The `selectBox.dropdownConfig.configId` points at a selector component (see [`selectors.md`](../../selector-creator/references/selectors.md)). The selector supplies the options. The `configParameters[0].parameter.id` names the selector's own inParam — typically `<entity>_ids` for a multi-select dropdown that pre-loads currently-selected ids.

### Don't build distinct-values selectors over high-volume storage

It's tempting to build a `*_dd` selector whose backing datasource pulls distinct `(id, label)` tuples from the same storage the grid is reading. For a bounded reference storage (a few hundred warehouses, a thousand projects) this works fine. For a high-volume fact storage — anything that stores per-license-plate snapshots, per-order-line events, or similar transactional rows — it's a trap:

- Every dropdown open triggers a `.toList()` that scans the table to build the distinct set.
- Even with a `.take(200)` cap, the scan still touches every row until 200 distinct values accumulate.
- As the storage grows into GB scale, that scan cost scales with it — the filter UI gets slower over time.

**For high-volume fact-storage grids, default to `textBox` filtering** on the readable string field (pattern #1 above). The `contains` → `(?i)` regex path is case-insensitive, pushes to `$db`, and scales with the filter's selectivity rather than the storage's row count.

**Reserve `selectBox` filters** for grids whose filter source is a bounded reference — typically `warehouse_dd`, `projects_dd`, `owners_dd`, or an enum dropdown (see [`flow-datasources.md` → Enum Dropdown Datasource Pattern](../../datasource-creator/references/flow-datasources.md#enum-dropdown-datasource-pattern)).

## Pre-Flight Checklist

Before committing a flow-type datasource over `$db`:

1. **`getQuery()` factory.** Query body wrapped in a function so every terminal gets a fresh cursor; `.toList()` and `.count()` both call it.
2. **Single `.where(r => …)` callback.** All predicate composition inside one callback using the local `predicate = predicate.and(...)` pattern. No `.where(...).where(...)` chaining.
3. **`Promise.all` over page + count.** Paging with `.skip($skip).take($top).toList()` pushed to `$db`, not sliced in JS.
4. **`(?i)` regex on full-text.** Never `.toLowerCase().includes(...)` on the column expression — that's a JS method that doesn't exist on the DSL.
5. **Helper flows called at top of the code.** `apply_storage_datasource_dynamic_filters_flow` for `$filter`, `apply_storage_datasource_dynamic_order_by_flow` for `$orderby`. Output `filters` array used verbatim inside the predicate loop; `orderBy` object passed to `.sort(...)`. `?? []` and `?? { <default_sort>: 'desc' }` fallbacks in place.
6. **`$orderby` / `$filter` declared in `getListFlow.inParams`** with the full param-descriptor boilerplate (`$orderby`: object, collection=true; `$filter`: object, collection=false).
7. **Column-name verbatim rule honored.** Snake_case everywhere internal — passthrough rows and aggregated rows alike. Per-column `dynamicOrderBy` / `dynamicFilter` values match what the helper loop will dereference on the row. The only camelCase that may appear inside an internal block is the `parameter.id` of an external selector contract (`warehouseId` for `warehouse_dd`, `projectId` for `owners_dd`); verify by reading the selector's own `inParams[0].id`.
8. **Four registration arrays mirrored.** `grid.datasourceConfig.dynamicFilters` ≡ `grid.datasources[0].dynamicFilters`; `grid.datasourceConfig.dynamicOrderBys` ≡ `grid.datasources[0].dynamicOrderBys`. Both `allSelectedIsDynamicFilters` and `allSelectedIsDynamicOrderBys` are `true` on `datasources[0]`.
9. **Per-column `dynamicFilterControl` matches field type.** `textBox` for strings, `numberBox` for numbers, `dateBox` for dates, `selectBox` for id columns whose options come from an `*_dd` selector.
10. **`mapRow` / group-by block keeps the result shape consistent** with `outParams[0].objectTypeDef` / `queryOptionsObjectTypeDef`. Field additions drift the entity definition — see [`flow-datasources.md` → The entity definition is the output contract](../../datasource-creator/references/flow-datasources.md#the-entity-definition-is-the-output-contract).
11. **Five-location row-shape sync.** The grid row entity is declared in five independent places and all five must agree. See the canonical list in [`grids.md` → Datasource Wiring — Five Places Must Stay in Sync](../../grid-creator/references/grids.md#datasource-wiring--five-places-must-stay-in-sync): `datasources[0].queryOptionsObjectTypeDef`, `datasources[0].outParams[result].objectTypeDef`, `datasources[0].getListFlow.outParams[result].objectTypeDef`, `datasources[0].getByKeysFlow.outParams[result].objectTypeDef`, `datasourceConfig.configOutParameters[result].objectTypeDef`. Partial syncs pass basic validation but fail at upload with **"Outdated contract. Type missmatch for output parameters"** and/or **"Property X does not exist on type ICCEntity"**. When adding a storage column, remember to carry **every** new field into all five — including numeric `_id` companions, not just the `_lookupcode` variants that get visible columns.
12. **`$orderby` / `$filter` oneOf-literal sync (separate from #11).** When the grid's `getListFlow.inParams` carries typed `$orderby` / `$filter` objects whose nested `column.oneOf` enumerates valid column names, every addition to the row shape must also be added to those enumerations — otherwise the platform rejects dynamic sort / filter requests citing the literal list. This is a distinct sync from the row-shape mirror in #11; a field can be absent from the oneOf list even when all five row-shape OTDs are correct, and vice versa.
13. **Hub mount inParams match the grid's inParams.** A grid mount in a hub's `tabs[].contentConfig.configParameters[]` lists the grid's inParams as `parameter.id`s. After a snake_case rename, the hub's mount must follow — otherwise the hub's "Outdated contract: missing input parameter X" validator fires.

## Cross-References

- [`db.md`](db.md) — the `$db` runtime and full operator DSL
- [`flow-datasources.md`](../../datasource-creator/references/flow-datasources.md) — flow-type datasource shape, two execution shapes, entity definition
- [`datasources.md`](../../datasource-creator/references/datasources.md) — taxonomy (variants × query types)
- [`selectors.md`](../../selector-creator/references/selectors.md) — the `*_dd` selector pattern that backs identifier-column filters
- [`grids.md`](../../grid-creator/references/grids.md) — grid file shape, five-locations-must-stay-in-sync for datasource binding
- `apply_storage_datasource_dynamic_filters_flow` (Utilities package) — the filter operator translator flow. Takes `{ filter: <injected $filter object> }` and returns `{ filters: [{ column, operator, value }] }` normalized for `$db` predicate use.
- `apply_storage_datasource_dynamic_order_by_flow` (Utilities package) — the order-by translator. Takes `{ order_by: <injected $orderby object> }` and returns `{ order_by: { [column]: 'asc' | 'desc' } }`.
