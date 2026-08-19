# Flow Code Patterns

> **Shared reference** — used by `function-creator`, `hub-editor`, and any other skill whose output includes Datex Studio flow code (datasource flows, click flows, scheduled jobs). Function-specific patterns (jobs, progress, $services) live in [../function-creator/references/code-patterns.md](../function-creator/references/code-patterns.md).

## `$utils.isDefined()` — Null/Undefined Checks

Always use `$utils.isDefined(value)` to check for nullish values in flow code. Native JavaScript checks (`== null`, `=== undefined`, falsy checks) may behave incorrectly against Datex Studio's runtime value model — optional inParams and unbound fields are wrapped in a way that doesn't always compare cleanly with literal `null`/`undefined`, and falsy checks misfire on legitimate `0` and `""` values.

```typescript
// CORRECT
if ($utils.isDefined(startDate)) { /* ... */ }
if ($utils.isDefined($flow.inParams.warehouseId)) { /* ... */ }

// WRONG
if (startDate != null) { /* ... */ }
if (startDate !== undefined) { /* ... */ }
if (!startDate) { /* fails for valid 0 or "" */ }
```

For multiple values, `$utils.isAllDefined(a, b, c)` returns `true` only when every argument is defined.

This rule applies in **all** flow code: function bodies, flow datasource `get`/`getList` methods, hub click flows, and `--param-filter`/`--dynamic-filter` conditions (the CLI emits `$utils.isDefined()` guards automatically for those).

## Date Defaulting Pattern (Hub Click Flows)

When a hub click flow accepts an optional date range — user may or may not have populated date inputs before clicking the toolbar button — default missing values to a sensible bounded range before passing them downstream. The canonical "last 7 days through end-of-today" pattern handles all three null cases and caps the end date at today:

```typescript
const today = new Date();
today.setHours(23, 59, 59, 999);

if (!$utils.isDefined(startDate) && !$utils.isDefined(endDate)) {
    const s = new Date(); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0);
    startDate = s;
    endDate = today;
} else if (!$utils.isDefined(startDate)) {
    const s = new Date(); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0);
    startDate = s;
} else if (!$utils.isDefined(endDate)) {
    const candidate = new Date(startDate);
    candidate.setDate(candidate.getDate() + 7);
    candidate.setHours(23, 59, 59, 999);
    endDate = candidate <= today ? candidate : today;
}
```

Key choices:
- Set `endDate` to `23:59:59.999` so OData `le` comparisons capture every record from today
- Cap the computed end date at `today` when only `startDate` was provided — never let the range run into the future
- All three null states are handled explicitly; do not collapse into a single ternary

## `$shell.Reports.open{ref}()` — Launching Reports from Click Flows

Hub click flows launch reports through the `$shell.Reports` service. The method name is derived directly from the report's **reference name** (the `referenceName` field on the report config), prefixed with the literal string `open` — no separator, no camelCase transformation:

| Report `referenceName` | Method to call |
|-----------------------|----------------|
| `labor_summary_report` | `$shell.Reports.openlabor_summary_report(...)` |
| `bol_master` | `$shell.Reports.openbol_master(...)` |
| `inventory_aging` | `$shell.Reports.openinventory_aging(...)` |

```typescript
await $shell.Reports.openlabor_summary_report({
    Warehouse: String(warehouseId),
    StartDate: startDate,
    EndDate: endDate
});
```

**Parameter keys must exactly match the report's parameter `Name` values** (case-sensitive). Mismatches don't throw — the report just renders with the parameter unset.

**Parameter value types:**

| Report param `DataType` | Pass as |
|-------------------------|---------|
| `String` | JavaScript string. Numeric IDs that back a `String` parameter must be wrapped with `String(...)`. |
| `Integer` / `Float` | JavaScript number |
| `DateTime` | JavaScript `Date` object |
| `Boolean` | JavaScript boolean |

When in doubt, check the report's `ReportParameters` section — `DataType` there is authoritative.

## OData Pagination — The 5,000-Record Cap

OData endpoints return **at most 5,000 records per request**. Any flow that aggregates over a date range, multiple owners, or any other dimension that produces high record counts must paginate. Busy warehouses routinely exceed 5k in a single day on `Tasks` and `ArchivedShippingLicensePlateContents`.

### Wiring `skip` through a standalone OData datasource

The standalone OData datasource must declare `skip` as a detected parameter so the flow can pass it:

```bash
dxs datasource generate -c <id> \
  -q 'Tasks?$top=5000&$skip=${$datasource.inParams.skip}&$filter=...' \
  --detect-params \
  -r ds_recv_tasks -t "ds_recv_tasks" -d "Receiving tasks (paged)" \
  --branch <id> -o ds_recv_tasks.json
```

`--detect-params` picks up the `${$datasource.inParams.skip}` template literal and adds `skip` to the datasource's `inParams`. Verify with `dxs report datasource-fields <ref> --branch <id>` that `skip` is listed alongside your other params.

### Paged fetch loop in flow code

```typescript
const PAGE_SIZE = 5000;
const results: Task[] = [];
let skip = 0;

while (true) {
    const resp = await $datasources.Reports.ds_recv_tasks.getList({
        warehouseId,
        fromDate,
        toDate,
        skip
    });
    const page = resp.result ?? [];
    results.push(...page);
    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
}
```

**Always loop until a short page comes back.** Don't rely on a `@odata.count` field — the flow's typed `result` array doesn't surface it.

### When to paginate

| Scenario | Paginate? |
|----------|-----------|
| Date-range aggregation over `Tasks`, `ArchivedShippingLicensePlateContents`, `Shipments`, etc. | **Yes** — high-volume warehouses easily exceed 5k |
| Single-entity fetch (`Shipments(0)`, `Orders(123)`) using `--param-keys` | No — single record |
| Bounded queries with an explicit `$top=N` smaller than 5k | No — bounded by `$top` |
| Lookup tables (warehouses, owners, materials) | Usually no — but spot-check counts; large material catalogs can need it |

### Common pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Forgot to declare `skip` as an inParam | `getList({ skip })` silently returns the first page only — no error | Add `--detect-params` and `${$datasource.inParams.skip}` to the query; verify with `datasource-fields` |
| Used `$skip` literally in the query without `${...}` template | Same as above — `skip` is not a real parameter | Use the template-literal syntax that `--detect-params` requires |
| Looped on `page.length > 0` instead of `< PAGE_SIZE` | One extra round-trip per query (returns empty 5001st page) | Break when `page.length < PAGE_SIZE` |
| Hardcoded a "reasonable" cap like `$top=10000` | Server still caps at 5k; you get 5k records and think you got 10k | Always paginate; never assume server limits can be raised |

## Escaping-Safe Content Writer — JSON Stored in Entity String Fields

Passing a configuration **object** through Studio-side object-parameter serialization corrupts any nested JSON-**string** field it carries: string values containing quotes are embedded unescaped, and the stored `Content` becomes invalid JSON that no longer parses. Any flow that saves user-authored JSON (criteria trees, rule definitions) inside a serialized object parameter is exposed.

The shipped pattern (cloned across Allocations → Totes → SalesOrders, so treat it as the platform convention):

1. **Serialize caller-side.** The caller does `JSON.stringify(config)` and passes Content as one opaque **string** parameter — never as a structured object the platform re-serializes.
2. **Store verbatim** via `crud_update_entity` on the Content property, behind a **parse-check gate**: the writer does `JSON.parse` on the incoming string and refuses to store anything unparseable (a corrupted write is strictly worse than a failed one).
3. **Create-then-write.** Entity creation flows with typed contracts force Content through the object serializer — so create the row with **empty** content (no nested JSON strings survive that path safely), then immediately write the real Content through the safe writer.

Read-side companion: fail-soft on `JSON.parse` of stored Content (skip + surface, don't throw) — rows written before the safe writer landed may hold corrupted JSON, and a re-save through the editor overwrites them cleanly.
