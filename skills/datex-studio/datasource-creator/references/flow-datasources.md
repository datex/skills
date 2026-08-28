# Flow-Type Datasources

For the full datasource taxonomy (component variant vs query type), see [`datasources.md`](datasources.md). For OData query type details, see [`odata-datasources.md`](odata-datasources.md).

This doc describes the **flow query type** (`type: "flows"`) — datasources that embed TypeScript code instead of a declarative OData query. Flow is one of two query types; the other is OData.

The flow query type can appear inside either component variant. The structure is identical across both except for two delta fields:

| Variant | `configurationTypeId` | `apiSettingName` |
|---|---|---|
| `-datasource.json` (cloud backend, function-tier) | `6` | `null` |
| `-footprintDatasource.json` (Footprint server, action-tier) | `19` | `"FootprintApi"` |

Note the `apiSettingName` difference: flow-type `-datasource.json` sets it to `null` (no OData endpoint to resolve), while flow-type `-footprintDatasource.json` sets it to `"FootprintApi"`. OData-type datasources always use `"FootprintApi"` in both variants.

## Three Execution Shapes

Flow datasources come in three legitimate shapes. The generated methods (`get` / `getList` /
`getByKeys`) exist **iff the corresponding flow slot is populated** — nothing derives them from
the flags — so slot population must match `resultIsCollection` / `keyDef` exactly. The Studio
designer enforces this imperatively (`createMissingFlows` / `clearUnusedFlows`); configs
authored outside the designer must get it right by construction. `dxs datasource generate-flow`
rejects every violation at authoring time; `dxs datasource validate` reports hand-edit
corruption (`hasKey`↔`keyDef` mismatch, `getByKeysFlow` without `keyDef`, collection slots on
a single-result config) as errors — which make it exit non-zero — along with two shapes older
CLI versions generated: a collection without `getListFlow`, and a keyed collection without
`getByKeysFlow`. Those two are errors rather than advisory warnings because the server's
`validateFlowSlots` demands both slots and blocks publish without them, so no config holding
either shape can be deployed. The one legacy shape that stays a warning is `getFlow` on a
collection: `validateFlowSlots` checks for *missing* slots and ignores stray ones, so such a
config still deploys.
A **missing `resultIsCollection`** is an error rather than a warning even though older CLI
versions produced it: the server refuses to save a flow datasource without the flag
(`Use in ... is required`), so always stamp it. The same lint runs on the FootprintDatasource
variant (`-footprintDatasource.json`) too. There the server-side *usage* gate is still absent —
it does not reach FPDS references — but the isolation checks are not: an FPDS gets the same
`validateFlowSlots` treatment as a regular flow datasource, so the CLI lint is no longer the only
shape check standing between it and a failed publish. FootprintQuery configs are the one
exemption; they override the check to a no-op, since get/getList/getByKeys slot rules never
applied to them.

| Shape | `resultIsCollection` | `keyDef` | `getFlow` | `getListFlow` | `getByKeysFlow` | Suitable consumers |
|---|---|---|---|---|---|---|
| **Single-result** | `false` | optional (best practice) | populated | `null` | `null` | Editor, form, large-number/gauge widget, `oneToOne` linked DS |
| **Collection, unkeyed** | `true` | empty | `null` | populated | `null` | List, calendar, pie-chart widget, `oneToMany` linked DS — **not** grid/selector |
| **Collection, keyed** | `true` | required (`isKey` on output type) | `null` | populated | populated | Grid, selector, `oneToOneWithMerge` linked DS |

Any other slot combination is malformed: a single-result shape with `getListFlow` or
`getByKeysFlow` populated, a single-result shape with no `getFlow` at all (the config would
generate no methods), a collection with `getFlow` populated, a collection without
`getListFlow`, or `getByKeysFlow` without a `keyDef`.

**Why grid/selector require the keyed shape:** both call `getByKeys` at runtime — the grid to
re-fetch a single row after an action, the selector to resolve the display label of an
already-selected value. `getByKeys` only exists when the slot is populated and `keyDef` is
non-empty.

### Reading suitability off an existing flow datasource

When wiring an existing flow datasource into a consumer, read its implemented methods:

- has `get` only → editor / form / single-widget material
- has `getList` but no `getByKeys` → list / calendar / pie-chart / `oneToMany` material; **not**
  grid/selector
- has `getList` + `getByKeys` (and a `keyDef`) → grid / selector material, plus everything on the
  line above — those consumers need only `getList`

List and calendar call `getList` and never `getByKeys`, so they sit with the unkeyed consumers:
requiring a `keyDef` of them would reject datasources they can use perfectly well. The server-side
usage gate mirrors this split exactly.

`onInitFlow` is `null` in all shapes unless explicit initialization logic is needed.

### Picking a Shape

- **Collection, keyed** is the shape for selector backings and grid datasources.
  `resultIsCollection: true`, `outParams[0].isCollection: true`. The `getListFlow` receives
  platform-injected `$top` / `$skip` / `$orderby` / `$filter` params; the `getByKeysFlow`
  receives `$keys`.
- **Collection, unkeyed** is the shape for consumers that only ever enumerate — pie-chart
  widgets and `oneToMany` linked-datasource targets. Same `getListFlow` contract, no
  `getByKeysFlow`.
- **Single-result** is the shape for datasources invoked with a specific set of inputs that
  produce one output object. `resultIsCollection: false`, `outParams[0].isCollection: false`.
  No pagination inputs, no `$keys`.

### Keys in Single-Result Shape

For single-result flow datasources, `hasKey` / `keyDef` is the author's choice:

- **Set a key** when the result has an obvious identifying property (or composite of properties) — best practice even when the datasource is not queried by key. Example: a `fpds_get_widget_info` utility has `hasKey: true` with `keyDef: [{id: "id", type: "number", isSecured: null}]` even though `id` is not used in the computation.
- **Omit the key** (`hasKey: false`, `keyDef: []`) when the result has no natural identifier — e.g. a bag of unrelated computed fields.

For paginated + key lookup shape, `hasKey: true` and `keyDef` are mandatory (the shape itself is key-centric).

## Paginated Shape — getListFlow

- `inParams`: component-specific inputs plus the platform-injected `$top` (number, optional), `$skip` (number, optional). Grid datasources also declare `$orderby` (object, `isCollection: true`, optional) and `$filter` (object, `isCollection: false`, optional) — **objects, not strings** (the platform injects a typed `{column, order}` / filter-operand shape; see [../../db-query/references/flow-db-datasources.md](../../db-query/references/flow-db-datasources.md) §6).
- `outParams`: `result` (collection of the result shape) + `totalCount` (number).
- Code: fetch/compute the full result set, apply any `full_text_search` filtering, set `totalCount` before slicing, then slice by `.slice(pageSkip, pageSkip + pageTop)` (not `.slice(pageSkip, pageTop)`).

**Reserved words — `top` and `skip` must never be used as local variable names.** They collide with Footprint runtime internals and cause errors. Always assign pagination params to `pageTop` / `pageSkip` with fallback defaults:

```typescript
const pageTop = $flow.inParams.$top ?? 25;
const pageSkip = $flow.inParams.$skip ?? 0;
```

Then use `pageTop` / `pageSkip` everywhere in the code — never reference `$flow.inParams.$top` or `$flow.inParams.$skip` inline after this point.

## Paginated Shape — getByKeysFlow

- `inParams`: component-specific inputs plus `$keys` (required, collection — type matches the key field's type).
- `outParams`: `result` (collection of the result shape). No `totalCount`.
- Code: fetch/compute the full result set, filter to entries whose key field value is in `$keys`.

## Single-Result Shape — getFlow

- `inParams`: component-specific inputs only. No `$top` / `$skip` / `$keys` (the shape is not paginated or key-addressed at call time).
- `outParams`: `result` (single object). No `totalCount`.
- Code: fetch/compute one result from the inputs, assign to `$flow.outParams.result`.
- `referenceName`: `"get"` (not `"getList"` / `"getByKeys"`).

**Editor datasources require this shape.** An editor's `datasourceConfig` resolves by calling `.get({...})` against a single entity id and binding the resulting object as `$editor.entity`. A collection-returning datasource breaks that binding — the editor cannot hydrate fields from a list. Any datasource embedded in (or referenced by) an editor must therefore implement the single-result shape, with `resultIsCollection: false` and `outParams[0].isCollection: false`. See [`../../editor-creator/references/editors.md`](../../editor-creator/references/editors.md).

## Callsite Syntax — Invoke By Flow referenceName

`$datasources.<Package>.<name>` exposes the datasource's populated flows as **direct properties**, named after each flow's `referenceName`. Call the flow as `$datasources.<Package>.<name>.<flow_referenceName>({ ... })` — the call returns the flow's `outParams` shape directly. There is no chained `.get()` step appended after `.getList` / `.getByKeys`.

| Shape | Call form | Returns |
|---|---|---|
| Paginated list | `$datasources.<Package>.<name>.getList({ ...inputs, $top, $skip })` | `{ result: T[], totalCount: number }` |
| Key lookup | `$datasources.<Package>.<name>.getByKeys({ ...inputs, $keys: […] })` | `{ result: T[] }` |
| Single-result | `$datasources.<Package>.<name>.get({ ...inputs })` | `{ result: T }` |

The `.get` you sometimes see on a single-result datasource is the **flow referenceName `"get"` itself** — not a generic terminal accessor. A paginated datasource has no `get` property because it declares `getFlow: null`; writing `$datasources.Acme.ds_widget_options.getByKeys.get({...})` is a TypeScript error (no `.get` on the `getByKeys` function reference) and fails at import.

```ts
// ✓ correct — paginated + key lookup
const { result } = await $datasources.Acme.ds_widget_options.getByKeys({ $keys: KEYS });

// ✓ correct — single-result
const { result } = await $datasources.Acme.fpds_get_widget_info.get({ });

// ✗ wrong — .get is not a method on .getByKeys
await $datasources.Acme.ds_widget_options.getByKeys.get({ $keys: KEYS });
```

The rule is uniform across both component variants (`-datasource.json` called from functions, `-footprintDatasource.json` called from actions) and across all three execution shapes. Flow referenceNames (`getList`, `getByKeys`, `get`) are the only method names on the datasource handle.

## Top-Level Datasource Fields

Fields below apply across all three shapes; shape-dependent values are called out inline:

- `inParams` — only the component-specific inputs (e.g. `full_text_search`, or editor-specific id inputs). The platform-injected params (`$top`, `$skip`, `$keys`) are **not** declared at the top level — they appear only inside the respective flow's `inParams`.
- `outParams` — `[{ id: "result", type: "object", isCollection: <bool>, objectTypeDef: [...] }]` (same simple descriptor as OData datasources). `isCollection` is `true` for both collection shapes (unkeyed and keyed), `false` for single-result.
- `keyDef` — the key field(s) of the result. **Required** (non-empty) for the collection-keyed shape; **must be empty** (`[]`) for the collection-unkeyed shape; author's choice for single-result (empty array `[]` when omitted — see [Keys in Single-Result Shape](#keys-in-single-result-shape)).
- `queryOptionsObjectTypeDef` — the **entity definition**: the authoritative result shape / output contract (see [The entity definition is the output contract](#the-entity-definition-is-the-output-contract) below). Flow datasources use the fat parameter-descriptor boilerplate here (with `required`/`oneOf`/etc.), unlike OData datasources which use the simple descriptor. Must match the surrounding flow's `outParams[0].objectTypeDef` exactly.
- `resultIsCollection`: `true` for both collection shapes (unkeyed and keyed), `false` for single-result. **`hasResult`**: `true` in all three shapes. **`hasKey`**: matches `keyDef` presence — always `true` for collection-keyed, always `false` for collection-unkeyed, author's choice for single-result.
- The unused flow slot(s) are `null`: both collection shapes set `getFlow: null`; the collection-unkeyed shape additionally leaves `getByKeysFlow: null` (only `getListFlow` is populated); single-result sets `getListFlow: null` and `getByKeysFlow: null`.
- `onInitFlow: null` unless initialization logic is needed.
- All OData-specific fields (`paths`, `queryOptions`, `outputResultAsSingleObject`, `allSelectedIs*`, `dynamicOrderBys`, `dynamicFilters`, `linkedDatasources`, `customColumns`) are `null`.
- `apiSettingName`: `null` for `-datasource.json`, `"FootprintApi"` for `-footprintDatasource.json`.

## Result fields are TypeScript-optional on the caller side

The simple property descriptor (`{id, type, isCollection, objectTypeDef}`) used in `outParams[0].objectTypeDef` carries no `required` slot — the platform type-generator treats the absence as "optional", so every field on the imported result type comes out as `T | undefined`. The populating flow (`getListFlow` / `getByKeysFlow` / `getFlow`) can write any field back with `null`, so callers must not assume fields are populated.

```typescript
// Declared as { id: "targets", type: "object", isCollection: true, objectTypeDef: [
//   { id: "project_id", type: "number", ... },
//   { id: "rule_level", type: "string", ... },
//   { id: "reason", type: "string", ... }
// ]}
// Imported caller-side type: { targets?: Array<{ project_id?: number, rule_level?: string, reason?: string }> }
const resolved = await $flows.Acme.resolve_widget_targets_for_warehouse_flow({ ... });

// ✗ Strict annotation fails import with "Type '{...?:...}[]' is not assignable to type '{...:...}[]'"
const strict: Array<{ project_id: number, rule_level: string, reason: string }> = resolved?.targets ?? [];

// ✓ Annotate with optionals, or leave inferred
const targets = resolved?.targets ?? [];
for (const t of targets) {
    if (!$utils.isDefined(t.project_id)) continue;
    const projectId = t.project_id;  // narrowed to number
    // …
}
```

The same shape applies to `(await $datasources.<Pkg>.<name>.getList({...})).result` and the other call forms — the `result` wrapper itself may be undefined, and every field inside each record is optional. Either leave the variable type inferred and use `?.` chains / nullish-coalesce on access, or annotate with optional fields. Never annotate with a strict shape; the import will fail.

This same behavior applies to OData datasources for the same underlying reason — see [`odata-datasources.md` → Result fields are TypeScript-optional on the caller side](odata-datasources.md#result-fields-are-typescript-optional-on-the-caller-side).

## The entity definition is the output contract

`queryOptionsObjectTypeDef` on the flow-type datasource is the **entity definition** — it is the authoritative output contract and acts as the shape that every consumer (selectors, grids) binds against. Whenever you add, remove, or retype a field in any flow's `outParams[0].objectTypeDef` (`getListFlow`, `getByKeysFlow`, or `getFlow`), make the same change to `queryOptionsObjectTypeDef` in the same edit — they cannot drift.

Consumers that reference the datasource keep their own copy of the subset they care about, and those copies are independent — they must also be updated when the entity's fields change. For example, a grid carries `datasourceConfig.configOutParameters[result].objectTypeDef` that binds each grid column to a field on the entity; a selector carries `datasourceConfig.configOutParameters` for the display/value fields it exposes. A complete field addition on a grid-backed flow datasource therefore typically touches **five** places in the grid file:

1. `datasources[0].queryOptionsObjectTypeDef` (the entity definition)
2. `datasources[0].outParams[result].objectTypeDef` (the datasource component's own top-level outParams)
3. `datasources[0].getListFlow.outParams[result].objectTypeDef`
4. `datasources[0].getByKeysFlow.outParams[result].objectTypeDef`
5. `datasourceConfig.configOutParameters[result].objectTypeDef` (the grid-side consumer copy)

Plus the `code` strings inside the flows that actually populate the new field. See [`../../grid-creator/references/grids.md` → Datasource Wiring — Five Places Must Stay in Sync](../../grid-creator/references/grids.md#datasource-wiring--five-places-must-stay-in-sync) for the grid-specific walkthrough.

**Rule of thumb**: whenever you add a field to a flow datasource's result, grep the file for a neighbor field's id (e.g. `"carriers"`) and confirm every occurrence has a matching sibling for the new field. If one is missing, the entity definition has drifted from either a flow's out-params or a consumer's binding — neither of which fails loudly at import, but both of which cause runtime binding holes.

## Enum Dropdown Datasource Pattern

A common use case is exposing a custom enum type as a dropdown datasource. The pattern:

1. Enumerate `Object.entries($types.<Package>.<enum>)` to get `[id, value]` pairs.
2. Map to `{ Key: formatKey(id), Value: value }` where `Key` is a human-readable label and `Value` is the stored enum string.
3. `keyDef` uses `Value` (the stored value, not the display label).
4. `getListFlow`: assign `pageTop`/`pageSkip` from `$flow.inParams.$top`/`$flow.inParams.$skip` with fallback defaults, full-text filter on `Key`, set `totalCount`, slice by `.slice(pageSkip, pageSkip + pageTop)`.
5. `getByKeysFlow`: filter by `$flow.inParams.$keys.includes(r.Value)`.
6. Include a `formatKey` helper that converts PascalCase enum ids to readable text (e.g. `"SingleWave"` → `"Single wave"`, preserving acronyms).

## Canonical Skeletons

Two skeletons below, covering the collection-keyed shape (the "Paginated Shape" skeleton, which
also covers key lookup) and the single-result shape. The collection-unkeyed shape is not shown
as its own skeleton — it is a small variant of the paginated skeleton (see the note after the
`getByKeysFlow` skeleton for how to derive it). Single-line minified JSON in practice; shown
expanded here for readability.

All flow-style datasources share a common null-slot layout — the parts that vary per use case are the `code` strings, `inParams` (component-specific inputs), `outParams`/`objectTypeDef` (result shape), `keyDef`, and which flow slot is populated.

### Paginated Shape (getListFlow + getByKeysFlow)

**Top-level structure:**

```json
{
  "configurationTypeId": 6,
  "type": "flows",
  "fromBaseConfiguration": null,
  "apiSettingName": null,
  "paths": null,
  "isCollection": null,
  "queryOptions": null,
  "outputResultAsSingleObject": null,
  "allSelectedIsDynamicOrderBys": null,
  "dynamicOrderBys": null,
  "allSelectedIsDynamicFilters": null,
  "dynamicFilters": null,
  "onInitFlow": null,
  "getFlow": null,
  "getListFlow": "<see getListFlow skeleton>",
  "getByKeysFlow": "<see getByKeysFlow skeleton>",
  "resultIsCollection": true,
  "keyDef": [{"id": "<KeyField>", "type": "<type>", "isSecured": null}],
  "queryOptionsObjectTypeDef": ["<same entries as outParams[0].objectTypeDef>"],
  "linkedDatasources": null,
  "customColumns": null,
  "hasKey": true,
  "hasResult": true,
  "id": 0,
  "referenceName": "<name>",
  "title": "<name>",
  "description": "<description>",
  "inParams": ["<component-specific inputs only — not $top/$skip/$keys>"],
  "outParams": [
    {"id": "result", "type": "object", "isCollection": true, "objectTypeDef": ["<result field descriptors>"]}
  ],
  "vars": null,
  "events": null,
  "accessModifier": "<public|private>"
}
```

**`getListFlow` skeleton:**

```json
{
  "enableProgressAndCancelation": false,
  "configurationTypeId": 9,
  "start": "step1",
  "nodes": [
    {
      "id": "step1",
      "type": "step",
      "stepConfig": {
        "type": "ExecuteCodeActivity",
        "executeCodeConfig": {"code": "<TypeScript code>"},
        "next": null,
        "error": null
      },
      "decisionConfig": null
    }
  ],
  "fromBaseConfiguration": null,
  "id": null,
  "referenceName": "getList",
  "title": null,
  "description": null,
  "inParams": [
    "<component-specific inputs (same as top-level inParams)>",
    {"id": "$top", "required": false, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "number", "objectTypeDef": null, "objectType": null, "isCollection": false, "isSecured": null, "isConstant": null, "constantValue": null},
    {"id": "$skip", "required": false, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "number", "objectTypeDef": null, "objectType": null, "isCollection": false, "isSecured": null, "isConstant": null, "constantValue": null}
  ],
  "outParams": [
    {"id": "result", "required": null, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "object", "objectTypeDef": ["<result field descriptors with full boilerplate>"], "objectType": null, "isCollection": true, "isSecured": null, "isConstant": null, "constantValue": null},
    {"id": "totalCount", "required": null, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "number", "objectTypeDef": null, "objectType": null, "isCollection": false, "isSecured": null, "isConstant": null, "constantValue": null}
  ],
  "vars": null,
  "events": null,
  "accessModifier": "public"
}
```

**`getByKeysFlow` skeleton:**

```json
{
  "enableProgressAndCancelation": false,
  "configurationTypeId": 9,
  "start": "step1",
  "nodes": [
    {
      "id": "step1",
      "type": "step",
      "stepConfig": {
        "type": "ExecuteCodeActivity",
        "executeCodeConfig": {"code": "<TypeScript code>"},
        "next": null,
        "error": null
      },
      "decisionConfig": null
    }
  ],
  "fromBaseConfiguration": null,
  "id": null,
  "referenceName": "getByKeys",
  "title": null,
  "description": null,
  "inParams": [
    "<component-specific inputs (same as top-level inParams)>",
    {"id": "$keys", "required": true, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "<matches keyDef type>", "objectTypeDef": null, "objectType": null, "isCollection": true, "isSecured": null, "isConstant": null, "constantValue": null}
  ],
  "outParams": [
    {"id": "result", "required": null, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "object", "objectTypeDef": ["<result field descriptors with full boilerplate>"], "objectType": null, "isCollection": true, "isSecured": null, "isConstant": null, "constantValue": null}
  ],
  "vars": null,
  "events": null,
  "accessModifier": "public"
}
```

**Deriving the collection-unkeyed shape from this skeleton:** drop the `getByKeysFlow` block
entirely (set the top-level `getByKeysFlow: null`), set `keyDef: []` and `hasKey: false` on the
top-level structure, and remove the `getByKeysFlow` skeleton. Everything else — the top-level
structure and the `getListFlow` skeleton — is unchanged.

### Single-Result Shape (getFlow)

**Top-level structure:**

```json
{
  "configurationTypeId": 6,
  "type": "flows",
  "fromBaseConfiguration": null,
  "apiSettingName": null,
  "paths": null,
  "isCollection": null,
  "queryOptions": null,
  "outputResultAsSingleObject": null,
  "allSelectedIsDynamicOrderBys": null,
  "dynamicOrderBys": null,
  "allSelectedIsDynamicFilters": null,
  "dynamicFilters": null,
  "onInitFlow": null,
  "getFlow": "<see getFlow skeleton>",
  "getListFlow": null,
  "getByKeysFlow": null,
  "resultIsCollection": false,
  "keyDef": "<[] when no key, or [{id,type,isSecured:null}] when author sets one>",
  "queryOptionsObjectTypeDef": ["<same entries as outParams[0].objectTypeDef, using fat parameter boilerplate>"],
  "linkedDatasources": null,
  "customColumns": null,
  "hasKey": "<true when keyDef is populated, false when keyDef is []>",
  "hasResult": true,
  "id": 0,
  "referenceName": "<name>",
  "title": "<name>",
  "description": "<description>",
  "inParams": ["<component-specific inputs only>"],
  "outParams": [
    {"id": "result", "type": "object", "isCollection": false, "objectTypeDef": ["<result field descriptors>"]}
  ],
  "vars": null,
  "events": null,
  "accessModifier": "<public|private>"
}
```

**`getFlow` skeleton:**

```json
{
  "enableProgressAndCancelation": false,
  "configurationTypeId": 9,
  "start": "step1",
  "nodes": [
    {
      "id": "step1",
      "type": "step",
      "stepConfig": {
        "type": "ExecuteCodeActivity",
        "executeCodeConfig": {"code": "<TypeScript code>"},
        "next": null,
        "error": null
      },
      "decisionConfig": null
    }
  ],
  "fromBaseConfiguration": null,
  "id": null,
  "referenceName": "get",
  "title": null,
  "description": null,
  "inParams": ["<component-specific inputs (same as top-level inParams)>"],
  "outParams": [
    {"id": "result", "required": null, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "object", "objectTypeDef": ["<result field descriptors with full boilerplate>"], "objectType": null, "isCollection": false, "isSecured": null, "isConstant": null, "constantValue": null}
  ],
  "vars": null,
  "events": null,
  "accessModifier": "public"
}
```

For the `-footprintDatasource.json` variant of either shape, flip `configurationTypeId` to `19` and `apiSettingName` to `"FootprintApi"`. Everything else is identical.

**Parameter field boilerplate** — every entry in `inParams`, `outParams`, and `objectTypeDef` (inside a flow) uses this full shape (omit no fields):

```json
{"id": "<name>", "required": <bool|null>, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "<string|number|boolean|date|object>", "objectTypeDef": null, "objectType": null, "isCollection": <bool>, "isSecured": null, "isConstant": null, "constantValue": null}
```

### Enum Dropdown Example

For the enum dropdown pattern described above, the typical result shape uses `Key` (display label, string) and `Value` (stored enum value, string), with `keyDef` on `Value`. The `getListFlow` code enumerates `Object.entries($types.<Package>.<enum>)`, applies full-text filtering, sets `totalCount`, and slices. The `getByKeysFlow` code filters by `$keys`. Both include a `formatKey` helper for PascalCase → readable text.
