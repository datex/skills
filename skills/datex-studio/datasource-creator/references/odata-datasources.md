# OData-Type Datasources

For the full datasource taxonomy (component variant vs query type), see [`datasources.md`](datasources.md).

This doc describes the **OData query type** (`type: "oDataQuery"`) — declarative queries with no embedded TypeScript. OData is one of two query types; the other is flow (embedded TS), covered in [`flow-datasources.md`](flow-datasources.md).

The OData query type can appear inside either component variant, and the structure is **identical across both** except for `configurationTypeId`:

| Variant | Folder | `configurationTypeId` | `apiSettingName` |
|---|---|---|---|
| `-footprintDatasource.json` (Footprint server, action-tier) | `src/footprint-datasources/` | `19` | `"FootprintApi"` |
| `-datasource.json` (platform backend, function-tier; required to back selectors) | `src/datasources/` | `6` | `"FootprintApi"` |

The query shape (`queryOptions`, `filters`, `selects`, `expands`, `keyDef`, etc.), every null-slot, the `outParams` descriptor shape, and every other field are the same across variants. Author one skeleton, flip the `configurationTypeId` to match the target variant.

Callers invoke either variant with the same syntax — `$datasources.<Package>.<reference_name>.get({ ... })` — but **callability is tier-restricted**: functions can only call `-datasource.json`, actions can only call `-footprintDatasource.json`. Cross-tier datasource calls are not allowed in either direction. See [`datasources.md`](datasources.md) for the full matrix.

**Package = folder location.** Datasource files do not carry a package field internally. The owning package is inferred from which feature folder the file lives in. To "move" a datasource between packages, just move the file — no internal edits required.

## Top-Level Structure of an OData Footprint-Datasource

- `configurationTypeId: 19`, `type: "oDataQuery"`
- `apiSettingName: "FootprintApi"`
- `paths` — array of `{ entitySet: <string>, keyDef: [{ id, type, isSecured }], type: "entitySet" }`
- `isCollection` — `true` for list queries, `false` for single-object queries
- `queryOptions` — declarative tree (see below)
- `outputResultAsSingleObject` — `true` for single-object queries, otherwise `null`
- `resultIsCollection` — mirror of `isCollection` (`false` for single-object, `true` for collections)
- `keyDef` — top-level entity keys, e.g. `[{ id: "Id", type: "number", isSecured: false }]`
- `queryOptionsObjectTypeDef` — result shape (see "Result type" below)
- `inParams` — standard component input descriptors (same shape as functions/actions)
- `outParams` — exactly one entry: `{ id: "result", type: "object", isCollection: <bool>, objectTypeDef: <same as queryOptionsObjectTypeDef> }`
- `linkedDatasources`, `customColumns`, `dynamicOrderBys`, `dynamicFilters`, `allSelectedIs*` — typically `null`
- `hasKey: true`, `hasResult: true`
- `onInitFlow` / `getFlow` / `getListFlow` / `getByKeysFlow` — **all `null`** for OData type (those are only populated for flow-style datasources)
- `id`, `referenceName`, `title`, `description`, `accessModifier` — same conventions as other components

## queryOptions Tree

Most fields are **optional** — only include what you need. A minimal queryOptions can be just `selects` + `filters`. The full set of accepted fields:

```
{
    selects: [{ "property": "Field1" }, ...],    // DSSelectConfig objects (see contract note below)
    filters: [ <filter expression> ],             // optional, see below
    orderBys: [ { property: ["Field"], order: "asc" | "desc" } ],  // optional
    expands: [ <expand entry> ],                  // optional, see below
    hasTop, top, hasSkip, skip, count,            // optional, all default null
    apply, applyKeyDef                            // optional, all default null
}
```

Sibling files may explicitly set the optional fields to `null` (the working `fpds_get_orders_by_order_ids` does); both styles import successfully. When building from scratch, prefer the minimal shape — fewer fields means fewer chances of authoring a wrong null vs `[]` etc.

### `hasTop` Is Tri-State — `false` Suppresses Caller-Passed `$top`

`hasTop` (and the parallel `hasSkip`) is **three-valued**, not boolean:

- `null` (the doc default, or omit the field entirely): the platform honors `$top` passed by the caller's `getList({$top: N})`. This is what you want for paginated collection queries.
- `true`: the platform applies a literal cap from `queryOptions.top` (e.g. `"1"` for single-object queries) on every call, regardless of what the caller passes.
- `false`: **the platform actively suppresses the caller's `$top`** — the OData URL is built with no `$top` clause. This is almost never what you want. The OData server then returns its configured default page (typically ~5000 rows) regardless of `getList({$top: N})`.

The bug pattern: an author meant "no top by default" and wrote `hasTop: false` (intuitive English, wrong API contract). The datasource silently ignores `$top` from callers, and a per-LP-loop that intended `$top: 50` ends up pulling thousands of rows per call. Performance degrades but no error fires. Diagnose by checking the actual response row count vs the requested `$top`.

**Rule:** for collection queries that should accept caller-paginated `$top`, leave `hasTop` as `null` (or omit). Only set `hasTop: true` for fixed-cap queries (single-object lookups with `top: "1"`). Never set `hasTop: false`.

## Filter Expressions

Array of:

```
{
    "expression": {
        "type": "statement",
        "value": "`Id eq ${$utils.odata.formatNumber($datasource.inParams.shipment_id)}`"
    }
}
```

`expression.isCollection` is optional (default `null`).

**`hasCondition` / `condition` — conditional filter application.** These two fields are paired:

- When `hasCondition: null` (or absent) the filter always applies.
- When `hasCondition: true`, `condition` holds a **TypeScript expression stored as a string**, evaluated at query time against `$datasource.inParams` / `$utils` / etc. If the expression returns truthy, the filter is applied; otherwise the filter is skipped entirely and its `expression.value` is never evaluated.

This is the idiomatic way to express optional filters. Prefer it over null-safe ternaries inside the `expression.value` template literal — it's easier to read and keeps the OData fragment well-formed regardless of input state.

Typical condition expressions:

- `"$utils.isDefined($datasource.inParams.full_text_search)"` — apply only when the optional string input is provided (remember `$utils.isDefined` also returns `false` for empty strings and empty arrays).
- `"$datasource.inParams.include_inactive === true"` — apply only when a boolean flag is explicitly set.

When authoring, set `hasCondition: true` and populate `condition`, **or** set both to `null` (or omit them). Do not set `hasCondition: true` with `condition: null`.

The `value` is a **TypeScript template literal — stored as a string with the backticks preserved**. Inside it:
- Reference inputs as `$datasource.inParams.<name>` (singular `$datasource`, not `$datasources`).
- **Always use `$utils.odata` formatters** when interpolating inParams into filter expressions. Never hand-format values (no manual quotes around strings, no manual parentheses around arrays, etc.). The formatters handle OData syntax correctly **and protect against injection**. This is a hard rule, not a style preference.

  | Input type | Single value | Array / collection |
  |---|---|---|
  | number | `$utils.odata.formatNumber(...)` | `$utils.odata.formatNumberArray(...)` |
  | string | `$utils.odata.formatString(...)` | `$utils.odata.formatStringArray(...)` |
  | boolean | `$utils.odata.formatBoolean(...)` | `$utils.odata.formatBooleanArray(...)` |
  | date | `$utils.odata.formatDate(...)` | `$utils.odata.formatDateArray(...)` |
  | ISO date | `$utils.odata.formatISODate(...)` | `$utils.odata.formatISODateArray(...)` |

  Examples:
  - `` `Id eq ${$utils.odata.formatNumber($datasource.inParams.shipment_id)}` ``
  - `` `Id in ${$utils.odata.formatNumberArray($datasource.inParams.order_ids)}` ``
  - `` `Name eq ${$utils.odata.formatString($datasource.inParams.name)}` ``

- For navigation collections, use OData lambda operators: `` `ShipmentOrderLookups/any(sol: sol/ShipmentId in ${$utils.odata.formatNumberArray($datasource.inParams.shipment_ids)})` ``. The lambda variable (`sol` here) is arbitrary.

## Expands

Recursive. Each entry is `{ isCollection: null, property: "<NavProp>", queryOptions: { ...same shape... } }`. Nest expands to whatever depth the OData entity model allows. Omit `expands` from `queryOptions` entirely when not needed (do not write `expands: null` if you can avoid it; minimal is safer).

## Composite-Key Entities

Fully supported as FPDS roots. Just list every key field in `paths[0].keyDef` *and* the top-level `keyDef`. Example: `ShipmentOrderLookup` is keyed on `OrderId`+`ShipmentId`; both go in. The actual filtering happens via `queryOptions.filters`, so a composite-key query can still filter on just one of the key fields (`` `ShipmentId in ${...}` `` is fine).

## EntitySet Naming

**EntitySet name ≠ EntityType name, and is not always plural.** The OData `<EntityContainer>` declares EntitySets with their canonical names. Most are plural (`Orders`, `Shipments`, `OrderLines`) but some are singular (e.g. `ShipmentOrderLookup` — the join entity is singular even though most others pluralize). Using the wrong name (e.g. `ShipmentOrderLookups` when it's actually `ShipmentOrderLookup`) causes the import to fail with `Cannot read properties of undefined (reading 'type')` because the importer can't resolve the EntitySet and then walks into `undefined`. **Always confirm the EntitySet name from the OData schema** (via the `schema-explorer` skill) before authoring an FPDS — don't assume pluralization. The CRUD action `entity` field uses the same names, so an existing `crud_*_entity({ entity: 'X', ... })` callsite is also a reliable witness.

## Navigation Property Names

**Navigation property names depend on direction.** The same join is named differently from each side. The OData metadata uses `Partner=` to declare the inverse name. For example, `Order.ShipmentOrderLookups` and `Shipment.OrderLookups` are the **same** join — querying from `Orders` you traverse `ShipmentOrderLookups`, but querying from `Shipments` you'd traverse `OrderLookups`. Always look up the navigation name *from the side you're querying* (via the `schema-explorer` skill), not the side you're thinking about.

## Result Type

**`queryOptionsObjectTypeDef` and `outParams[0].objectTypeDef`:**

The result shape is described **twice** and the two copies must stay in sync:

1. `queryOptionsObjectTypeDef` — at top level
2. `outParams[0].objectTypeDef` — inside the `result` outParam

Both use a **simpler property descriptor** than interface customTypes — only `id`, `type`, `isCollection`, and (for nested objects) `objectTypeDef`. **No** `required` / `isSecured` / `oneOf` / `fromBaseConfiguration` / `objectType` / `isConstant` / `constantValue` / `description` fields. Nested objects are described inline; there is no reference-by-name to other interfaces.

**This applies to `outParams[0]` itself, not just its nested `objectTypeDef`.** A common trap is to author the top-level outParam with the fat interface-style descriptor and only nest the simple shape inside. The platform import will fail with `Cannot read properties of undefined (reading 'type')` when this happens. The full `outParams` array should look exactly like `[{ "id": "result", "type": "object", "isCollection": <bool>, "objectTypeDef": [ ... simple descriptors ... ] }]` — nothing else.

```
{"id":"Id","type":"number","isCollection":false}
{"id":"Tasks","type":"object","isCollection":true,"objectTypeDef":[ ... ]}
```

The result tree must mirror the `selects` + `expands` tree exactly.

### Result fields are TypeScript-optional on the caller side

The simple property descriptor (`{id, type, isCollection, objectTypeDef}`) used in `outParams[0].objectTypeDef` carries **no** `required` slot. The platform type-generator treats the absence as "optional" — every field on the imported result type comes out as `T | undefined`. So the result of `(await $datasources.<Pkg>.<name>.get({...})).result` is typed as an array of records whose every field is optional, even when the underlying OData metadata declares the column `Nullable="false"`.

```typescript
// Declared in JSON as { id: "Id", type: "number", isCollection: false }
// Imported TS type: { Id?: number, Name?: string, TimeZoneId?: string }
const warehouses = (await $datasources.Acme.ds_get_warehouses_with_timezone.get({})).result ?? [];

// ✗ Strict annotation fails import: "Type '{ Id?: number; ... }[]' is not assignable to type '{ Id: number; ... }[]'."
let strict: Array<{ Id: number, Name: string, TimeZoneId: string }> = warehouses;

// ✓ Annotate with optionals, or leave inferred and narrow per access
let loose: Array<{ Id?: number, Name?: string, TimeZoneId?: string }> = warehouses;
for (const w of warehouses) {
    if (!$utils.isDefined(w.Id)) continue;
    const id = w.Id;  // now narrowed to number
    // …
}
```

The same applies to nested `objectTypeDef` entries inside expanded navigation properties — each level of the result tree is optional end-to-end. Either leave the variable type inferred and use `?.` chains / nullish-coalesce on access, or explicitly annotate with optional fields. Never annotate the result with a strict shape; the import will fail.

### `queryOptions.selects` Is the Runtime Data Shape

> **Contract note — `selects` entries are objects, not strings.** Since the server's
> Tailored Datasource change (merged 2026-07-31), every `selects` entry — top-level and
> inside `expands[].queryOptions` — binds to a `DSSelectConfig` object:
> `{ "property": "<Name>" }` (optional `removed`, `fromBaseConfiguration`). The legacy
> bare-string form (`"selects": ["Id"]`) is **rejected** by validate/upsert with
> `DXS-API-400` `Error converting value "…" to type '…DSSelectConfig'`. `dxs datasource
> generate` emits the object form (CLI versions after 0.4.13; older CLIs emit strings and
> fail against current servers — upgrade rather than hand-editing the JSON). When you hit a
> contract error like this, derive the expected shape from the validate error plus an
> existing valid config on the branch (via `dxs configuration get`) — never from the
> platform source.

The type-metadata locations (`queryOptionsObjectTypeDef`, `outParams[0].objectTypeDef`, and on grids also `datasourceConfig.configOutParameters[0].objectTypeDef`) are **compile-time contracts** — they tell the platform what fields the query *promises* to return. The actual HTTP request is driven by `queryOptions.selects`, which is the literal OData `$select` clause.

A field declared in every type-metadata location but missing from `queryOptions.selects` imports cleanly, types cleanly, and is **undefined at runtime**. The query never asked for it. Every consumer (grid column bound to `$row.entity.<Field>`, flow reading `$row.entity.<Field>`, expand-backed nested access) silently returns `undefined`, with no import-time error to warn you.

When adding or removing a field, update `queryOptions.selects` in the **same edit** as the type-metadata locations. For nested fields accessed through an expanded navigation property, the leaf goes in the corresponding `expands[].queryOptions.selects` — not the top-level `selects`.

On grids, this makes `queryOptions.selects` a **sixth location** in the "entity shape" rule, distinct from and orthogonal to the five type-metadata locations documented in [grids.md → OData-Backed Grid Datasources](../../grid-creator/references/grids.md#odata-backed-grid-datasources--queryoptionsselects-is-a-sixth-runtime-only-location).

## Single-Object vs Collection Queries

| Field | Collection query | Single-object query |
|---|---|---|
| top-level `isCollection` | `true` | `true` |
| `outputResultAsSingleObject` | `null` | `true` |
| `resultIsCollection` | `true` | `false` |
| `outParams[0].isCollection` | `true` | `false` |

**Top-level `isCollection` stays `true` even for single-object queries** — it describes the `paths` collection, not the result. What flips for a single-object query is the trio `outputResultAsSingleObject` (null → true), `resultIsCollection` (true → false), and `outParams[0].isCollection` (true → false). Getting this wrong is a common authoring trap.

For a single-object query, filter on the key (e.g. `` `Id eq ${$utils.odata.formatNumber($datasource.inParams.shipment_id)}` ``).

## Pre-Flight: Validate Against Schema

Every **OData-flavor** datasource edit must start with a schema cross-check. This applies equally to both component types — `-datasource.json` (runs in the cloud backend) and `-footprintDatasource.json` (runs on the Footprint server) — whenever the component carries a declarative OData query. The entity/property/navigation names flow through both the same way; only the runtime tier and the component's wrapping structure differ.

Flow-flavor datasources (either component type, embedding TypeScript rather than a declarative OData query tree) are out of scope for this rule because there is no declarative query to validate against metadata. If such a component still issues OData calls through embedded TS, apply judgment — validate the names in the TS query strings the same way, but the rule is not mechanically enforced there.

This is non-negotiable for OData-flavor components; the failure mode when you skip it is a silent and misleading import error (`Cannot read properties of undefined (reading 'type')` with no indication that a name is wrong), which is much more expensive to debug than the lookup is to perform.

**Hard rule: delegate every lookup to the `schema-explorer` skill. Do NOT load raw schema documents (e.g. an OData `metadata.xml`) into the parent conversation.** The OData schema document is typically large (megabytes of XML, hundreds of thousands of tokens) — pulling it into the parent context is always wrong, regardless of how "small" the lookup feels. Invoke `schema-explorer` with targeted questions ("Does `Order` have property `FooBar`?", "What is the EntitySet name for `ShipmentOrderLookup`?", "List navigations from `Shipment`") and fold its concise answers into your authoring decisions.

If you catch yourself about to `Read` or `Grep` an OData schema document from the parent, stop and invoke the skill instead. The only exception is if the parent already loaded a specific answer earlier in the same turn and is simply referring back to it.

Validate, in order:

1. **EntitySet name** — look it up via the `schema-explorer` skill (not inferred from the EntityType name), and do **not** assume pluralization. Most entities pluralize (`Orders`, `Shipments`, `OrderLines`) but some are hand-named singular (e.g. `ShipmentOrderLookup`). An existing `crud_*_entity({ entity: '...' })` callsite is a reliable secondary witness — the CRUD actions use the same EntitySet names.
2. **Every property name in `selects`** — confirm each exists on the EntityType (or on the expanded nav target for nested selects).
3. **Every navigation property in `expands` and in lambda filters (`any()` / `all()`)** — confirm it exists on the *source* side you are traversing from. Remember the `Partner=` inverse-name rule: the same join is named differently from each side (`Order.ShipmentOrderLookups` vs `Shipment.OrderLookups` are the same join), so look it up from the side you're querying, not the side you're thinking about.
4. **Key fields** — confirm the full key set. Composite-key entities need every key field listed in both `paths[0].keyDef` and the top-level `keyDef`.

Modifications to an existing datasource carry the same obligation: if you change a select, add an expand, edit a filter, or switch the entity, re-validate the pieces you touched. Do not rely on the file's current contents as proof that a new name is correct.

## Complete Canonical Skeleton

Write every field — including every null-slot. Omitting nulls has been observed to break Angular service codegen (e.g. a missing `resultIsCollection` causes the generated service to lack `getList` / `getByKeys` methods). "Present with null" and "absent" are not equivalent to the platform's code generators.

The skeleton below is a collection query against a single-key entity. Placeholders are in `<angle brackets>`. Flip `configurationTypeId` to `6` for the `-datasource.json` variant; everything else is identical.

```json
{
  "configurationTypeId": 19,
  "type": "oDataQuery",
  "fromBaseConfiguration": null,
  "apiSettingName": "FootprintApi",
  "paths": [{
    "entitySet": "<EntitySet>",
    "keyDef": [{"id": "Id", "type": "number", "isSecured": null}],
    "type": "entitySet"
  }],
  "isCollection": true,
  "queryOptions": {
    "hasTop": null,
    "top": null,
    "hasSkip": null,
    "skip": null,
    "count": null,
    "selects": [{ "property": "Id" }, { "property": "<Field>" }],
    "orderBys": null,
    "filters": [{
      "hasCondition": null,
      "condition": null,
      "expression": {
        "type": "statement",
        "isCollection": null,
        "value": "`Id in ${$utils.odata.formatNumberArray($datasource.inParams.ids)}`"
      }
    }],
    "expands": null,
    "apply": null,
    "applyKeyDef": null
  },
  "outputResultAsSingleObject": null,
  "allSelectedIsDynamicOrderBys": null,
  "dynamicOrderBys": null,
  "allSelectedIsDynamicFilters": null,
  "dynamicFilters": null,
  "onInitFlow": null,
  "getFlow": null,
  "getListFlow": null,
  "getByKeysFlow": null,
  "resultIsCollection": true,
  "keyDef": [{"id": "Id", "type": "number", "isSecured": false}],
  "queryOptionsObjectTypeDef": [
    {"id": "Id", "type": "number", "isCollection": false},
    {"id": "<Field>", "type": "string", "isCollection": false}
  ],
  "linkedDatasources": null,
  "customColumns": null,
  "hasKey": true,
  "hasResult": true,
  "id": 0,
  "referenceName": "<file_stem>",
  "title": "<file_stem>",
  "description": "<≤100 chars>",
  "inParams": [{
    "id": "ids",
    "required": true,
    "description": null,
    "oneOf": null,
    "fromBaseConfiguration": null,
    "type": "number",
    "objectTypeDef": null,
    "objectType": null,
    "isCollection": true,
    "isSecured": null,
    "isConstant": null,
    "constantValue": null
  }],
  "outParams": [{
    "id": "result",
    "type": "object",
    "isCollection": true,
    "objectTypeDef": [
      {"id": "Id", "type": "number", "isCollection": false},
      {"id": "<Field>", "type": "string", "isCollection": false}
    ]
  }],
  "vars": null,
  "events": null,
  "accessModifier": "public"
}
```

### Notes on Every Slot

**Component-variant deltas (the only cross-variant differences):**
- `configurationTypeId`: `19` for `-footprintDatasource.json`, `6` for `-datasource.json`.
- `apiSettingName`: `"FootprintApi"` in both OData variants — never null for OData, never omitted.

**`paths[0].keyDef[*].isSecured` vs top-level `keyDef[*].isSecured` asymmetry:**
- `paths[0].keyDef[*]` uses `isSecured: null`.
- Top-level `keyDef[*]` uses `isSecured: false`.
- This asymmetry is intentional — replicate exactly, do not normalize.

**`queryOptions` — every field explicit:**
- `hasTop`, `top`, `hasSkip`, `skip`, `count`, `orderBys`, `filters`, `expands`, `apply`, `applyKeyDef` — all present with `null` default when unused.
- `filters[*].hasCondition`, `filters[*].condition`, `filters[*].expression.isCollection` — all `null` when unused.

**Null-slot block (top-level fields that must all be present, all `null` for collection OData):**
- `fromBaseConfiguration`, `outputResultAsSingleObject`, `allSelectedIsDynamicOrderBys`, `dynamicOrderBys`, `allSelectedIsDynamicFilters`, `dynamicFilters`, `onInitFlow`, `getFlow`, `getListFlow`, `getByKeysFlow`, `linkedDatasources`, `customColumns`, `vars`, `events`.

**Result shape — written twice, kept in sync:**
- `queryOptionsObjectTypeDef` (top level)
- `outParams[0].objectTypeDef`
- Both use the simple descriptor — only `id`, `type`, `isCollection`, `objectTypeDef` (for nested). No `required` / `isSecured` / `oneOf` / etc. — see "Result Type" above for the trap.

**`inParams[*]`** — uses the **full parameter descriptor** (same boilerplate as functions/actions): `id`, `required`, `description`, `oneOf`, `fromBaseConfiguration`, `type`, `objectTypeDef`, `objectType`, `isCollection`, `isSecured`, `isConstant`, `constantValue`. Don't confuse with the simpler result descriptors.

**`outParams`** — always exactly one entry with `id: "result"`. The descriptor uses only `id` / `type` / `isCollection` / `objectTypeDef`.

**`id: 0`** — placeholder for new components; the platform fills in the real id on import. Existing files will show real ids like `8096849` — that's expected, not something to normalize on re-export.

**`resultIsCollection`** — mirrors `outParams[0].isCollection`. Non-negotiable for correct codegen.

**`hasKey`**: `true` whenever a `keyDef` is populated. **`hasResult`**: `true` when `outParams` produces a usable result (always `true` for selector-backing and lookup datasources).

**`accessModifier`**: `"public"` or `"private"` — author's choice per intended reuse.

## Composite-Key Variant

Change only the two `keyDef` blocks; everything else in the skeleton stays the same:

```json
"paths": [{
  "type": "entitySet",
  "entitySet": "<EntitySet>",
  "keyDef": [
    {"id": "<KeyA>", "type": "number"},
    {"id": "<KeyB>", "type": "number"}
  ]
}],
...
"keyDef": [
  {"id": "<KeyA>", "type": "number", "isSecured": false},
  {"id": "<KeyB>", "type": "number", "isSecured": false}
]
```

The `queryOptions.filters` can still filter on just one of the key fields — composite-key FPDSes don't require filtering on the full key.

## Single-Object Variant

Starting from the collection skeleton, change exactly three fields and the filter:

- `outputResultAsSingleObject`: `null` → `true`
- `resultIsCollection`: `true` → `false`
- `outParams[0].isCollection`: `true` → `false`
- Filter on the key: e.g. `` `Id eq ${$utils.odata.formatNumber($datasource.inParams.id)}` ``

**Leave top-level `isCollection: true`** — it describes the `paths` collection, not the result. This is the trap most likely to bite when first authoring a single-object variant.

## Authoring from Scratch

1. **Run the metadata pre-flight** (see above) — confirm the EntitySet name, every property in `selects`, every navigation property in `expands`/lambdas, and the full key set. List every key field in both `paths[0].keyDef` and the top-level `keyDef` (composite keys are fine).
2. Copy the **complete canonical skeleton** above and substitute the placeholders (`<EntitySet>`, `<Field>`, `<file_stem>`, etc.). Switch to the composite-key or single-object variant as needed.
3. Pick `configurationTypeId`: `19` for `-footprintDatasource.json`, `6` for `-datasource.json`. `apiSettingName` stays `"FootprintApi"` either way.
4. Update `paths[0].entitySet`, the filter expression, and the `selects` to match the desired entity and payload.
5. Build the `expands` tree only if needed (still write `expands: null` inside `queryOptions` when not used — do not omit the field).
6. **Write the result shape twice** — once into `queryOptionsObjectTypeDef`, once into `outParams[0].objectTypeDef` — and keep them identical. The result tree must mirror the `selects` + `expands` tree exactly.
7. **Do not omit null-slots.** Every field listed in the canonical skeleton must be present; use `null` rather than dropping the key.
8. Set `id` to `0` for new components; the platform fills in the real value on import.
9. `referenceName` and `title` both equal the filename stem.
10. `accessModifier` — `"public"` or `"private"` (ask the user when creating).
11. Keep `description` ≤ 100 characters per the platform limit.
