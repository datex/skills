# Grids

For the datasources that back grids, see [`datasources.md`](../../datasource-creator/references/datasources.md) and [`flow-datasources.md`](../../datasource-creator/references/flow-datasources.md).

Grids render tabular data with optional inline editing, selection, toolbars, and per-row/per-cell interactions. A grid component is named `<name>-grid.json` — it lives on the branch; this is the naming convention, not a local `src/` path.

## File Shape at a Glance

Top-level fields of interest (many others exist but default to `null`):

- `columns` — array of column descriptors. The JSON key is `columns`, but runtime code accesses them as `$grid.headers.<column_id>` (e.g. `$grid.headers.carrier_service.hidden = true`).
- `datasourceConfig` — the grid's **consumer reference** to its backing datasource. Carries `datasourceKeyDef`, `configParameters` (inputs piped into the datasource), `configOutParameters` (the subset of the entity shape the grid binds against), and `configId` / `moduleId` pointing at the datasource. **`isOwned: true` is what makes the reference owned** — it selects which resolution path the platform uses, and `moduleId` is then ignored (it is *not* an either/or with `configId` / `moduleId`; the canonical grid skeleton carries all three). See [`../../datasource-creator/references/datasources.md` → Resolving an Owned Reference](../../datasource-creator/references/datasources.md#resolving-an-owned-reference--isowned-alone-decides).
- `datasources` — an array containing **embedded** datasource definitions (when `datasourceConfig.isOwned: true`). `datasources[0]` is a full flow-type datasource in its own right (same shape as a standalone `-datasource.json`) and carries its own `queryOptionsObjectTypeDef` (the entity definition), top-level `outParams`, and per-flow `getListFlow` / `getByKeysFlow` out-params.
- `flows` — grid-level flows keyed by `referenceName`. Platform-recognized names include `on_data_loaded`, `on_select_row`, `on_excel_import`, `on_excel_export`, `on_init`, `on_interval`. Author-defined flows can also live here and be invoked from toolbars/row actions (e.g. `open_wave_creation_form`).
- `rowFlows` — per-row flows, typically hooked to cell-click handlers (`on_click_<field>`). Any flow whose body reads `$row` must be registered here, not in `flows` — see [Flows](#flows).
- `topToolbar` / `toolbar` — buttons and controls above/below the grid. Each entry is a polymorphic control descriptor — see [Toolbar Items](#toolbar-items) below for the full shape.
- `filters` — filter panel fields (same shape as hub filters). Values flow into `datasourceConfig.configParameters` via `$grid.filters.<id>.control.value`.
- `selection` — configures row-selection behavior (single vs multi).
- `fullTextSearch` — non-nullable boolean. `true` mounts the built-in search box (its value arrives at `$flow.inParams.full_text_search` inside a flow datasource's code, or at `$datasource.inParams.full_text_search` in an OData datasource's filter expressions — declare the `full_text_search` inParam on the datasource in either variant); `false` omits the box. `null` and the object form `{ "enabled": true }` both fail import — the server expects a bare `System.Boolean` and rejects every other shape ("Error converting value {null} to type 'System.Boolean'" / "Unexpected character encountered while parsing value: {").
- `pageSize` — required integer. The number of rows fetched per page. The skeleton uses `25` as a reasonable default; override per grid if the row size makes a different page size more appropriate. "Required" here means **build-required**: the grid imports cleanly without it and then fails the build — see [Import-Time vs Build-Time Validation](#import-time-vs-build-time-validation).
- `rowSizingType` / `columnSizingType` — layout-mode enums. Members are **camelCase**, not PascalCase. Both fields are technically nullable but leaving them `null` renders badly — set explicit values. `columnSizingType` is additionally **build-required**: `null` imports cleanly and then fails the build (see [Import-Time vs Build-Time Validation](#import-time-vs-build-time-validation)).
  - `columnSizingType` (`EGridColumnSizingType`) members: `"cellsWidth"` (size columns to content — default), `"headersWidth"`, `"fixedWidth"` (per-column pixel `width`), `"fitedWidth"` (note: spelled `fitedWidth`, not `fittedWidth` — match the platform's literal). The skeleton uses `"cellsWidth"`.
  - `rowSizingType` (`ERowSizingType`) members: `"default"`, `"relaxed"`, `"compact"`. The skeleton uses `"default"`.
  - **Anti-patterns observed empirically:** `"fill"` (lowercase, not a member) and `"Fill"` (PascalCase, wrong casing) both fail with `Error converting value '...' to type 'System.Nullable\`1[...EGridColumnSizingType]'`. The error message doesn't list the valid members — copy them from this section.
- `inParams` / `outParams` — the grid's own callable-component I/O, distinct from its datasource's. Accessed as `$grid.inParams.<id>` in grid and row flow code.

## Minimal Valid Skeleton

A complete copy-pasteable grid with an **embedded flow-type datasource**. The example entity is `{ id (number), name (string) }`; the same two-field shape appears in all five entity-shape locations (`queryOptionsObjectTypeDef`, `datasources[0].outParams[result].objectTypeDef`, `getListFlow.outParams[result].objectTypeDef`, `getByKeysFlow.outParams[result].objectTypeDef`, `datasourceConfig.configOutParameters[result].objectTypeDef`) — pick an unchanged neighbor field and grep its id to verify every edit. Replace `example_grid` / `ds_example_grid` / `Utilities` (package) / the entity fields with your own:

```json
{
  "configurationTypeId": 3,
  "id": null,
  "referenceName": "example_grid",
  "title": "Example grid",
  "description": "≤100 chars description.",
  "accessModifier": "public",
  "inParams": null,
  "outParams": null,
  "vars": null,
  "rowVars": null,
  "events": null,
  "selection": null,
  "pageSize": 25,
  "rowSizingType": "default",
  "columnSizingType": "cellsWidth",
  "fullTextSearch": false,
  "filters": [],

  "columns": [
    {
      "id": "id",
      "name": "Id",
      "visible": true,
      "width": null,
      "hyperLink": false,
      "displayControl": {
        "type": "text",
        "textConfig": { "value": "$row.entity.id?.toString()", "fontSize": null, "fontColor": null, "tooltip": "''" },
        "checkBoxConfig": null,
        "selectBoxConfig": null,
        "numberBoxConfig": null,
        "dateBoxConfig": null,
        "buttonConfig": null,
        "imageConfig": null
      },
      "editControl": null,
      "onCellClickFlowConfig": null,
      "dynamicFilter": null,
      "dynamicOrderBy": null,
      "dynamicFilterType": null,
      "dynamicFilterControl": null
    },
    {
      "id": "name",
      "name": "Name",
      "visible": true,
      "width": null,
      "hyperLink": false,
      "displayControl": {
        "type": "text",
        "textConfig": { "value": "$row.entity.name", "fontSize": null, "fontColor": null, "tooltip": "''" },
        "checkBoxConfig": null,
        "selectBoxConfig": null,
        "numberBoxConfig": null,
        "dateBoxConfig": null,
        "buttonConfig": null,
        "imageConfig": null
      },
      "editControl": null,
      "onCellClickFlowConfig": null,
      "dynamicFilter": null,
      "dynamicOrderBy": null,
      "dynamicFilterType": null,
      "dynamicFilterControl": null
    }
  ],

  "datasourceConfig": {
    "datasourceKeyDef": [
      { "id": "id", "type": "number", "isSecured": null }
    ],
    "dynamicOrderBys": null,
    "dynamicFilters": null,
    "configParameters": [],
    "configOutParameters": [
      {
        "id": "result",
        "type": "object",
        "isCollection": true,
        "isSecured": null,
        "required": null,
        "description": null,
        "fromBaseConfiguration": null,
        "objectType": null,
        "oneOf": null,
        "isConstant": null,
        "constantValue": null,
        "objectTypeDef": [
          { "id": "id", "type": "number", "isCollection": false, "required": false, "objectType": null, "isSecured": false },
          { "id": "name", "type": "string", "isCollection": false, "required": false, "objectType": null, "isSecured": false }
        ]
      },
      { "id": "totalCount", "type": "number", "isCollection": false, "isSecured": null, "required": null, "description": null, "fromBaseConfiguration": null, "objectType": null, "oneOf": null, "isConstant": null, "constantValue": null, "objectTypeDef": null }
    ],
    "configEvents": null,
    "outParamsChangeFlowConfig": null,
    "configId": "ds_example_grid",
    "moduleId": "Utilities",
    "isOwned": true
  },

  "datasources": [
    {
      "configurationTypeId": 6,
      "type": "flows",
      "fromBaseConfiguration": null,
      "apiSettingName": null,
      "paths": null,
      "isCollection": true,
      "queryOptions": null,
      "outputResultAsSingleObject": false,
      "allSelectedIsDynamicOrderBys": false,
      "dynamicOrderBys": null,
      "allSelectedIsDynamicFilters": false,
      "dynamicFilters": null,
      "onInitFlow": null,
      "getFlow": null,
      "getListFlow": {
        "start": "step1",
        "nodes": [{
          "id": "step1", "type": "step",
          "stepConfig": {
            "type": "ExecuteCodeActivity",
            "executeCodeConfig": { "code": "$flow.outParams.result = [];\r\n$flow.outParams.totalCount = 0;" }
          }
        }],
        "referenceName": "get_list",
        "title": "get_list",
        "description": "Return the page of rows for the grid.",
        "inParams": [
          { "id": "$top", "type": "number", "isCollection": false, "required": false, "objectType": null, "isSecured": false },
          { "id": "$skip", "type": "number", "isCollection": false, "required": false, "objectType": null, "isSecured": false }
        ],
        "outParams": [
          {
            "id": "result",
            "type": "object",
            "isCollection": true,
            "required": false,
            "objectType": null,
            "isSecured": false,
            "objectTypeDef": [
              { "id": "id", "type": "number", "isCollection": false, "required": false, "objectType": null, "isSecured": false },
              { "id": "name", "type": "string", "isCollection": false, "required": false, "objectType": null, "isSecured": false }
            ]
          },
          { "id": "totalCount", "type": "number", "isCollection": false, "required": false, "objectType": null, "isSecured": false }
        ],
        "vars": null,
        "events": null,
        "accessModifier": "private"
      },
      "getByKeysFlow": {
        "start": "step1",
        "nodes": [{
          "id": "step1", "type": "step",
          "stepConfig": {
            "type": "ExecuteCodeActivity",
            "executeCodeConfig": { "code": "const keys = $flow.inParams.$keys ?? [];\r\n$flow.outParams.result = [];" }
          }
        }],
        "referenceName": "get_by_keys",
        "title": "get_by_keys",
        "description": "Return the rows matching the requested keys.",
        "inParams": [
          { "id": "$keys", "type": "number", "isCollection": true, "required": true, "objectType": null, "isSecured": false }
        ],
        "outParams": [
          {
            "id": "result",
            "type": "object",
            "isCollection": true,
            "required": false,
            "objectType": null,
            "isSecured": false,
            "objectTypeDef": [
              { "id": "id", "type": "number", "isCollection": false, "required": false, "objectType": null, "isSecured": false },
              { "id": "name", "type": "string", "isCollection": false, "required": false, "objectType": null, "isSecured": false }
            ]
          }
        ],
        "vars": null,
        "events": null,
        "accessModifier": "private"
      },
      "resultIsCollection": true,
      "keyDef": [
        { "id": "id", "type": "number", "isSecured": null }
      ],
      "queryOptionsObjectTypeDef": [
        { "id": "id", "type": "number", "isCollection": false, "required": false, "objectType": null, "isSecured": false },
        { "id": "name", "type": "string", "isCollection": false, "required": false, "objectType": null, "isSecured": false }
      ],
      "linkedDatasources": null,
      "customColumns": null,
      "hasKey": true,
      "hasResult": true,
      "id": null,
      "referenceName": "ds_example_grid",
      "title": "ds_example_grid",
      "description": "Embedded datasource backing example_grid.",
      "inParams": [],
      "outParams": [
        {
          "id": "result",
          "type": "object",
          "isCollection": true,
          "required": false,
          "objectType": null,
          "isSecured": false,
          "objectTypeDef": [
            { "id": "id", "type": "number", "isCollection": false, "required": false, "objectType": null, "isSecured": false },
            { "id": "name", "type": "string", "isCollection": false, "required": false, "objectType": null, "isSecured": false }
          ]
        },
        { "id": "totalCount", "type": "number", "isCollection": false, "required": false, "objectType": null, "isSecured": false }
      ],
      "vars": null,
      "events": null,
      "accessModifier": "private"
    }
  ],

  "topToolbar": [
    {
      "id": "refresh",
      "type": "button",
      "buttonConfig": {
        "label": "Refresh",
        "buttonDefaultStyleClass": "primary",
        "readOnly": false,
        "tooltip": "''",
        "clickFlowConfig": { "flowId": "on_click_refresh", "flowParameters": null }
      },
      "selectBoxConfig": null,
      "separatorConfig": null
    }
  ],
  "toolbar": [],

  "flows": [
    {
      "start": "step1",
      "nodes": [{
        "id": "step1", "type": "step",
        "stepConfig": {
          "type": "ExecuteCodeActivity",
          "executeCodeConfig": { "code": "$grid.refresh();" }
        }
      }],
      "referenceName": "on_click_refresh",
      "title": "on_click_refresh",
      "description": "Refresh the grid.",
      "inParams": null,
      "outParams": null,
      "vars": null,
      "events": null,
      "accessModifier": "public"
    }
  ],
  "rowFlows": []
}
```

_The two-field row shape (`id`, `name`) appears verbatim at all five entity-shape locations. After any field-set edit, grep an unchanged neighbor id (e.g. `"id": "name"`) across the file — your new field must have a matching occurrence at each site. The canonical key order for `datasources[0]` follows [Embedded Datasource Component-Identity Envelope](#embedded-datasource-component-identity-envelope) below; toolbar entries keep all sibling `*Config` keys present and explicitly `null`._

### Import-Time vs Build-Time Validation

Platform errors surface in **two phases**, and passing the first proves nothing about the second:

1. **Import** validates JSON shape and enum membership — wrong shapes (`fullTextSearch` as an object) and phantom enum values (`columnSizingType: "fill"`) fail here with `400` responses naming the offending path.
2. **Build** additionally requires concrete values for codegen-critical fields — `pageSize` and `columnSizingType` are nullable/omittable at import yet **required to build**. A grid can import cleanly and still fail to build.

Static validation (the grid-validator rule set, JSON-parse checks) catches neither phase — it derives from these docs, not from the platform's binding model. When a new field draws an import or build error despite matching this doc, treat the doc as wrong, fix the component against the platform's actual contract, and update this doc + the skeleton with the verified value.

## Columns

Each entry in `columns` has:

- `id` — identifier used both as the runtime handle (`$grid.headers.<id>`) and as the column's schema key.
- `name` — the display label shown in the column header (sentence case per [`naming-conventions.md` → Display Text Conventions](../../datex-studio-conventions/naming-conventions.md#display-text-conventions)).
- `visible` — initial visibility. Runtime code can flip `$grid.headers.<id>.hidden` (inverse boolean, confusingly named).
- `displayControl` — the control shown in read mode. Most common is `type: "text"` with `textConfig.value` bound to an entity field (`"$row.entity.<field>"`), but any control type from the platform's control repertoire is available (selectBox, checkBox, dateBox, numberBox, button, image, etc.).
- `editControl` — the control shown in edit mode. `null` when the column is read-only.
- `width` — pixel width, applied when `columnSizingType: "fixedWidth"` (see [File Shape at a Glance](#file-shape-at-a-glance) above for the full member list).
- `hyperLink` — when `true`, the cell renders as a clickable link that fires `onCellClickFlowConfig`.
- `onCellClickFlowConfig` — flow reference fired on cell click; the flow typically lives under `rowFlows` and receives `$row` / `$grid` runtime globals.
- `dynamicOrderBy` / `dynamicFilter` / `dynamicFilterType` / `dynamicFilterControl` — per-column sort/filter wiring for OData-backed grids.

## Runtime Globals

Inside grid flows (`flows[]` and `rowFlows[]`):

- `$grid.headers.<id>` — column handle (`.hidden`, `.disabled`, etc.).
- `$grid.rows` — all loaded rows. `$grid.selectedRows` — subset the user has ticked. `$grid.hasSelectedRows` — boolean.
- `$grid.totalCount` — total record count reported by the backing datasource (pre-pagination). Useful for export flows that need the full size (`data: { total_records: $grid.totalCount }`).
- `$grid.inParams.<id>` — grid-level input values passed in by whatever mounts the grid (hub tab, dialog, etc.). Writable — mutating `$grid.inParams.entity_id` inside a save flow lets a later refresh pick up the new parent id.
- `$grid.outParams.<id>` — grid-level outputs, assigned from flow code. Changes notify the host via `$grid.events.outParamsChange.emit()` — call this after updating any `outParams.*` field that hosts are subscribed to.
- `$grid.filters.<id>.control.value` — filter panel field values.
- `$grid.topToolbar.<id>` / `$grid.toolbar.<id>` — toolbar entry handles. Top-level `.hidden = true` hides the entry; the nested control (`.buttonConfig` / `.control` under the shared alias) carries `.readOnly`, `.disabled`, etc. Useful to gate button `readOnly` on selection. The nested control's `.label` is also writable — imperative assignment (`$grid.topToolbar.<id>.control.label = ...`) is the proven pattern for state-reflecting button text (e.g. showing an applied-filter summary on a Filters button); there is no declarative binding for a live label. The control's `.styles` object carries semantic class toggles (`setPrimaryClass()`) and resets (`resetStyle()`, `resetClasses()`) for marking a button active/inactive — the same `.control.styles` API exists on hub toolbar buttons.
- `$grid.canAdd`, `$grid.canEdit` — booleans controlling the add-row / inline-edit affordances. Flip in `on_init` or `on_apply_operations` based on permission checks (`$operations.<Package>.<Op>.isAssignedToAll()`).
- `$grid.refresh()` — re-triggers the backing datasource.
- `$grid.fullTextSearch` — current search box value. To forward this value to the embedded datasource as `full_text_search`, you must wire it explicitly via a `datasourceConfig.configParameters` entry whose `value` is `"$grid.fullTextSearch"` — see [`datasourceConfig.configParameters` — Feeding Inputs to the Datasource](#datasourceconfigconfigparameters--feeding-inputs-to-the-datasource).
- `$grid.vars.<id>` — grid-scope scratch state, declared at top-level `vars[]`. See [`component-wiring.md` → Component Variables Must Be Declared](../../component-wiring-check/references/component-wiring.md#component-variables-must-be-declared).
- `$grid.datasources.<ds_referenceName>.get({ ... })` — call any embedded datasource by its `referenceName`. Primary use is secondary-datasource enrichment (a grid can carry more than one embedded datasource — see [Secondary (Enrichment) Datasources](#secondary-enrichment-datasources) and [`tailoring.md`](../../tailoring-overlay/references/tailoring.md)).
- `$row.entity.<field>` — inside row flows and column display control bindings, the row's typed data. `$row.entity` matches the shape declared in `datasources[0].queryOptionsObjectTypeDef`.
- `$row.cells.<column_id>.displayControl.<ctrl>` — the read-mode control for a cell. `displayControl.text` (for text-type), `displayControl.value` (for checkBox/selectBox/etc.) are writable — see [Imperative Cell API](#imperative-cell-api).
- `$row.cells.<column_id>.editControl.<ctrl>` — the edit-mode control. `editControl.value` is writable; `editControl.isChanged` is a boolean the platform sets when the user has dirtied the cell during an inline edit.
- `$row.vars.<id>` — per-row scratch state, declared at top-level `rowVars[]`. Typical use: stash a freshly-reserved id during `on_save_new_row` so `on_save_existing_row` (or a chained tailored handler) can use it on the next pass.
- `$row.refresh()` — re-fetches just this row via the datasource's `getByKeysFlow`. Cheaper than `$grid.refresh()` for single-row updates.
- `$row` also exposes selection/edit state (`.isNew`, `.isSelected`, etc.) where relevant.

### Stable Compiled-Instance APIs (advanced)

Generic browser-side tooling that receives a live grid reference as an object argument (frontend flows called with `{ grid: $grid }` — object arguments pass by reference, so the callee sees live grid state) can introspect the compiled grid instance beyond the documented handles:

- `$grid.$dataLoad` — the grid's compiled data-load method. Its source carries the literal inParams object the grid passes to its backing datasource (grid inParams, filter-control values, vars, page size), which can be parsed/evaluated to reproduce the grid's current query inputs. Caveat: the compiled form differs between Preview and the built app, so state recovered by evaluating the compiled literal can silently drop dynamic filter/sort in Preview — prefer the `$getDynamic_*` APIs below for that state.
- `$grid.$getDynamic_orderby()` / `$grid.$getDynamic_<family>()` — stable methods that rebuild the grid's **current dynamic sort and filter state** without parsing compiled code. Filter families are `number` / `numberMulti` / `string` / `date` / `boolean`; feature-detect each method, since a grid only compiles the families its columns register. Family results slot into the standard envelope `{ operator: 'and', operands: [{ operator: 'and', <family>: arr || null }] }` — the same `$filter` shape delivered to flow datasources — and `$getDynamic_orderby()` returns the `$orderby` array. The envelope shape is identical across grids; calling these is idempotent in the built app and corrective in Preview.

## Embedded Datasource Component-Identity Envelope

An embedded entry in `datasources[]` isn't just a query spec — it's a full datasource component in the same shape a standalone `src/datasources/<name>-datasource.json` would have, carrying an identity envelope in addition to the query-related fields. The grid's `datasourceConfig.configId` resolves its owned datasource **by `referenceName`**; if the envelope is incomplete, the lookup fails and the platform emits a placeholder binding whose generated TS is broken.

Every embedded datasource must carry these identity fields alongside the query/shape fields:

| Field | Required value |
|---|---|
| `referenceName` | Must match `datasourceConfig.configId` exactly. This is the lookup key. |
| `title` | Usually same as `referenceName`. |
| `description` | Non-empty, ≤ 100 chars (same rule as any component). |
| `hasKey` | `true` for paginated/collection datasources with a `keyDef`. |
| `hasResult` | `true` — the datasource returns a row shape. |
| `id` | Numeric id on imported datasources; `null` on net-new (the platform assigns on first save). |
| `linkedDatasources` | `null` unless the datasource chains to another. |
| `customColumns` | `null` unless the datasource declares customer-specific column metadata. |
| `inParams` / `outParams` | Declared the same as a standalone component. |
| `vars` / `events` | `null` if unused, otherwise declared. |
| `accessModifier` | Typically `"private"` for embedded datasources. |

**Canonical key order for the datasource block** (both OData and flow variants in the codebase sort this way — diverging from it makes diffs noisy and, for some tooling, breaks round-trips):

```
configurationTypeId, type, fromBaseConfiguration, apiSettingName,
paths, isCollection, queryOptions, outputResultAsSingleObject,
allSelectedIsDynamicOrderBys, dynamicOrderBys,
allSelectedIsDynamicFilters, dynamicFilters,
onInitFlow, getFlow, getListFlow, getByKeysFlow,
resultIsCollection, keyDef, queryOptionsObjectTypeDef,
linkedDatasources, customColumns, hasKey, hasResult, id,
referenceName, title, description,
inParams, outParams, vars, events, accessModifier
```

**Failure signature of a missing identity envelope:** the platform reports

> Grid `<grid_name>` → `<ds_configId>`: Invalid contract. Referenced own configuration `<ds_configId>` does not exist or has been renamed

…followed by a cascade of downstream TS errors (`Cannot find name 'get'`, `Cannot find name 'getList'`, `Cannot find name 'inParams'`, `Cannot find name 'refresh'`, `'string' only refers to a type, but is being used as a value here`, arithmetic-operand errors, element-access errors). Those are *all* fallout from the one unresolved reference — the platform couldn't bind `$grid.datasources.<configId>` so every generated access site compiles as garbage. Fix the identity envelope and the entire cascade disappears.

Note the wording: **`Referenced own configuration`** means the owned path resolved and found no matching `referenceName` in `datasources[]` — a name mismatch. The near-identical **`Referenced configuration`** (no "own") is a *different* failure, meaning the reference never took the owned path at all because `datasourceConfig.isOwned` is absent or false. All three messages in this family, and which mistake each points at, are tabulated in [`../../datasource-creator/references/datasources.md` → Resolving an Owned Reference](../../datasource-creator/references/datasources.md#resolving-an-owned-reference--isowned-alone-decides).

## Datasource Wiring — Five Places Must Stay in Sync

A grid-embedded flow datasource carries the result shape in **five** independent locations. When you add, remove, or retype an entity field, update every one of them in the same edit:

1. `datasources[0].queryOptionsObjectTypeDef` — the entity definition (authoritative output contract; see [`flow-datasources.md` → The entity definition is the output contract](../../datasource-creator/references/flow-datasources.md#the-entity-definition-is-the-output-contract)).
2. `datasources[0].outParams[result].objectTypeDef` — the datasource component's own top-level outParams result shape.
3. `datasources[0].getListFlow.outParams[result].objectTypeDef` — the paginated-list flow's result shape.
4. `datasources[0].getByKeysFlow.outParams[result].objectTypeDef` — the key-lookup flow's result shape.
5. `datasourceConfig.configOutParameters[result].objectTypeDef` — the grid's consumer-side reference; only fields the grid actually binds against need to appear here, but they must match the entity's types exactly.

Plus the `code` strings inside `getListFlow` / `getByKeysFlow` that populate the new field.

**Rule of thumb**: after any entity-shape edit, grep the grid file for an unchanged neighbor field's id (e.g. `"carriers"`) and confirm every occurrence has a matching sibling for the new field. If the count of entity-shape occurrences doesn't line up, a location has drifted.

### OData-Backed Grid Datasources — `queryOptions.selects` Is a Sixth, Runtime-Only Location

When `datasources[0].type === "oDataQuery"` (OData-backed grid datasource), the five-location rule above partly changes:

- Locations **3** and **4** (`getListFlow` / `getByKeysFlow`) are `null` — OData datasources don't carry paginated flow bodies; the platform synthesizes the HTTP query from the declarative `queryOptions`. Skip them.
- Locations **1**, **2**, **5** still apply identically.
- **A sixth location becomes load-bearing**: `datasources[0].queryOptions.selects` — the literal OData `$select` clause. This is the **runtime data shape** (what the HTTP response actually carries), independent of every type-metadata location above. If a field is declared in `queryOptionsObjectTypeDef` but **absent** from `selects`, the field is undefined at runtime — the type says it's there, the query never asked for it. Every column that binds `$row.entity.<Field>` declaratively, every row-flow that reads `$row.entity.<Field>`, and every `on_data_loaded` imperative reference silently returns `undefined`.

Expanded navigation properties carry their own per-expand `selects`:

```json
"expands": [
  { "property": "Address", "queryOptions": { "selects": [{ "property": "Line1" }, { "property": "City" }, ...] } },
  { "property": "Type",    "queryOptions": { "selects": [{ "property": "Name" }] } }
]
```

Each expand's `selects` must likewise enumerate every leaf referenced from `queryOptionsObjectTypeDef`'s nested `objectTypeDef` for that property.

**Rule of thumb (OData)**: when adding a field, verify it appears in **four** places — `queryOptionsObjectTypeDef`, `outParams[0].objectTypeDef`, `datasourceConfig.configOutParameters[0].objectTypeDef`, **and** `queryOptions.selects` (or the appropriate `expands[].queryOptions.selects` for nested fields). Missing the fourth is the classic silent-failure mode: the grid imports cleanly, renders an empty column, and may throw on first row render if a binding expression dereferences the undefined value.

Related dynamic-filter/orderBy registrations (see [Dynamic Filters and Sorting](#dynamic-filters-and-sorting)) are distinct from `selects`. Declaring `ReferenceCode` in `dynamicFilters` does not cause it to be selected. They serve different purposes and must both be maintained.

### Pagination and Key Shape

Because a grid-embedded datasource is a paginated flow datasource:

- `datasources[0].resultIsCollection: true`, `hasKey: true`, `hasResult: true`.
- `keyDef` and `datasourceConfig.datasourceKeyDef` must agree (same ids/types) — the former declares the key on the datasource, the latter is how the grid addresses rows for re-fetch / selection persistence.
- Inside the flow code, remember the reserved-word constraint: never use `top` / `skip` as locals (see [`flow-datasources.md` → Paginated Shape — getListFlow](../../datasource-creator/references/flow-datasources.md#paginated-shape--getlistflow)).

## `datasourceConfig.configParameters` — Feeding Inputs to the Datasource

Each entry in `configParameters` declares an input the grid passes to its backing datasource:

```json
{
  "parameter": { "id": "search", "type": "object", "isCollection": false, ... },
  "value": "$grid.inParams.search"
}
```

The `value` is a runtime expression (usually `$grid.inParams.<id>`, `$grid.filters.<id>.control.value`, or a literal).

**Every inParam declared on the embedded datasource needs an explicit `configParameters` entry — including `full_text_search`.** There is no auto-wiring from the built-in search box. When `fullTextSearch: true` and the datasource declares `inParams: [{ id: "full_text_search", ... }]`, you must add a corresponding entry whose `value` is `"$grid.fullTextSearch"`:

```json
"configParameters": [
  {
    "parameter": { "id": "full_text_search", "type": "string", "isCollection": false, "required": false, "objectType": null, "isSecured": false },
    "value": "$grid.fullTextSearch"
  }
]
```

Omitting this entry leaves the datasource's `full_text_search` inParam unbound at runtime, the conditional filter that depends on it never fires, and the import reports a contract mismatch between the grid and its embedded datasource.

## Flows

Common platform-recognized flow slots (each has a matching `on<Name>FlowConfig` entry at top level):

- `on_init` (`onInitFlowConfig`) — fires when the grid mounts.
- `on_data_loaded` (`onDataLoadedFlowConfig`) — fires after the datasource resolves. Typical use: toggle column visibility based on current `search.group_by` inputs.
- `on_select_row` (`onSelectionChangedFlowConfig`) — fires when the selection set changes. Typical use: gate toolbar button `readOnly` on `$grid.hasSelectedRows`.
- `on_excel_import` / `on_excel_export`.
- `on_interval` — with `intervalSeconds`, re-fires on a timer.
- Row-level: `on_init_new_row`, `on_save_new_row`, `on_save_existing_row`, `on_row_data_loaded`.

Author-defined flows sit in `flows[]` alongside these. Reference them from toolbar click handlers (`"flowId": "open_wave_creation_form"`), cell-click handlers, or other flow code (`$grid.<flow_referenceName>(...)`).

**Flows that read `$row` must be registered in `rowFlows[]`, not `flows[]`.** Grid-level `flows[]` compile with grid scope only (`$grid`); only `rowFlows[]` entries receive the `$row` global. A row-scoped flow (e.g. `on_row_data_loaded`) placed in `flows[]` fails platform validation with `Cannot find name '$row'` plus `Missing 'Row data loaded (Row Flows)'` — pointing `onRowDataLoadedFlowConfig` at the flow is not enough; the flow object itself must live in `rowFlows[]`. Automated grid audits have missed this, so check manually: scan every flow body for `$row` and move any hit into `rowFlows[]`.

**`on_row_data_loaded` must not make backend calls — it is the platform's N+1 anti-pattern.** The flow fires once per rendered row, so a `$flows` / `$datasources` call inside it multiplies into a page-size burst of dispatches on every load, sort, and filter change. Restructure instead: hoist row-invariant work (permission checks, config reads) to `on_init` / `apply_operations` and stash it in `$grid.vars`; derive per-row display state from fields already on `$row.entity` (extend the datasource's projection if a field is missing); and when a genuine per-row lookup is unavoidable, batch it once per data-load from `on_data_loaded` — collect the page's ids, make one `in`-query, index into a map keyed by row id.

**Awaited writes to `$grid.vars` lose the race against a refresh.** A refresh triggered by a filter change reads the datasource inputs **before** an `await`-delayed write to `$grid.vars` lands — the stale value applies, and the fresh value sits unused until the *next* filter change (synchronous writes win the refresh; awaited writes lose it — verified both directions live). Rule: change-handler flows that feed `$grid.vars` into datasource inputs must write **synchronously, with no `await` between flow entry and the write**. Precompute whatever the handler needs (e.g. lookup tables) at grid init into a `$grid.vars` entry, resolve from that var synchronously in the handler, and keep an async fallback (followed by an explicit `$grid.refresh()`) only for the init-load-failed path.

## Dynamic Filters and Sorting

Grids expose per-column filter/sort controls that bind against entity properties of the result set. Wiring lives in two tiers: a grid-level registration under `datasourceConfig`, and per-column pointers on each `columns[]` entry.

### Checklist — Adding a Filterable/Sortable Field

Run this top-to-bottom when adding a new field that columns will filter or sort against. Every box must be ticked; a partial edit produces either silent wrong behavior or loud contract errors at import.

1. **Entity shape (five locations)** — add the field to all five sites per [Datasource Wiring — Five Places Must Stay in Sync](#datasource-wiring--five-places-must-stay-in-sync). If the field is a scalar sidecar for a collection, also populate it in `getListFlow` code before filter/sort runs (see [Array-Field Caveat](#array-field-caveat--scalar-sidecar-pattern)). **For OData-backed datasources**, also add the field to `datasources[0].queryOptions.selects` (or the appropriate nested `expands[].queryOptions.selects`) — see [OData-Backed Grid Datasources — `queryOptions.selects` Is a Sixth, Runtime-Only Location](#odata-backed-grid-datasources--queryoptionsselects-is-a-sixth-runtime-only-location). The type metadata declares the field; `selects` is what actually retrieves it.
2. **Registration sites (two)** — add the field to **both** `datasources[0].dynamicFilters`/`dynamicOrderBys` (embedded datasource side) and `datasourceConfig.dynamicFilters`/`dynamicOrderBys` (consumer side). Identical entries on both. Drifting between the two surfaces at import as `Outdated contract. Type mismatch for dynamic filtering/sorting`.
3. **Per-column wiring** — on the `columns[]` entry that exposes the field: `dynamicFilter`, `dynamicOrderBy`, `dynamicFilterType` (inParam-shaped leaf type), and `dynamicFilterControl` (textBox / numberBox / dateBox).
4. **Do not declare `$filter` / `$orderby` in any `inParams` list** (not `datasources[0].inParams`, not `getListFlow.inParams`, not `getByKeysFlow.inParams`). The platform auto-injects typed versions from the registrations in step 2. A manual entry collides with the auto-injected declaration. `$top` / `$skip` are unrelated pagination inputs and *do* get declared on `getListFlow.inParams` normally.
5. **Do not add `$filter` / `$orderby` to `datasourceConfig.configParameters`** — the platform auto-forwards them from the registrations.


### Grid-level Registration

`dynamicFilters` and `dynamicOrderBys` are registered at **two** top-level locations, and the two must stay in sync:

- `datasourceConfig.dynamicFilters` / `datasourceConfig.dynamicOrderBys` — the grid's consumer-side view.
- `datasources[0].dynamicFilters` / `datasources[0].dynamicOrderBys` — the embedded datasource's own declaration.

Both carry the same shape. A difference between the two surfaces at import as `Datasource <id>: Outdated contract. Type mismatch for dynamic filtering / sorting`. When adding, removing, or retyping a registration, update both lists in the same edit.

Shape:

- `dynamicFilters` — array of property type-defs (same shape as `inParams` entries). Flat scalar fields use a single entry (`{ id: "ReferenceCode", type: "string" }`); nested navigation paths use `type: "object"` with an `objectTypeDef` array carrying the leaf (`{ id: "Type", type: "object", objectTypeDef: [{ id: "Name", type: "string" }] }`).
- `dynamicOrderBys` — array of `{ "property": [<path parts>] }`. Flat fields use a single-element array (`{ "property": ["ReferenceCode"] }`); nested paths use the path split (`{ "property": ["Type", "Name"] }`).

`datasources[0]` also carries `allSelectedIsDynamicFilters` / `allSelectedIsDynamicOrderBys` flags alongside the arrays. When they're `true`, the platform treats every scalar entity field as implicitly eligible — but the explicit array still has to be maintained; the flag doesn't cover fields added later.

### Per-Column Wiring

Each filterable/sortable column entry carries:

- `dynamicFilter` — dotted property path (e.g. `"Address.City"`). Matches an entry in `dynamicFilters`.
- `dynamicOrderBy` — dotted property path (typically the same value as `dynamicFilter`).
- `dynamicFilterType` — an `inParam`-shaped object describing the leaf type (`{ id: "Address.City", type: "string", isCollection: false, ... }`). Drives operator selection in the filter UI.
- `dynamicFilterControl` — control descriptor for the filter input (`{ type: "textBox", textBoxConfig: { ... } }` for strings; `{ type: "numberBox", numberBoxConfig: { ... } }` for numbers; `dateBox` for dates).

### OData-Type Datasources

For grids backed by an OData datasource, the platform translates the dynamic filter/sort registrations directly into `$filter` and `$orderby` segments of the OData URL. The datasource's flow code (if any) does nothing; the registrations and per-column paths are the whole mechanism.

### Flow-Type Datasources

For grids backed by a flow datasource, the platform forwards dynamic filter/sort as two explicit `getListFlow.inParams`:

- `$filter` — `type: "object"`, `isCollection: false`. Shape: `{ operands: [{ stringFilters: [...], stringMultiFilters: [...], numberFilters: [...], numberMultiFilters: [...], booleanFilters: [...], dateFilters: [...] }, ...] }`. Each filter entry carries `{ column, operation, value }`. Operands are typically OR-combined; filters within an operand are AND-combined. Reference helpers at `apply_storage_datasource_dynamic_filters_flow` (and the orderby counterpart) document the exact operator set — `equals`, `notEqual`, `contains`, `notContains`, `startsWith`, `endsWith`, `blank`/`empty`, `notBlank`, `lessThan`, `lessThanOrEqual`, `greaterThan`, `greaterThanOrEqual`, `in`, `notIn`, `sameDay`, plus date macros (`today`, `yesterday`, `thisWeek`, ...).
- `$orderby` — `type: "object"`, `isCollection: true`. Shape: `[{ column, order }, ...]` where `order` is `'asc'` or `'desc'`.

The flow is responsible for applying them. Two viable application strategies:

- **Source-side** (typical): translate `$filter` into the OData `$filter` portion of the query before fetching, and `$orderby` into OData `$orderby`. Works when each filterable column maps cleanly to an entity property path.
- **Post-aggregation** (for grids that reduce source rows into derived groups): apply `$filter` and `$orderby` in memory after aggregation completes. See the post-aggregation caveats below.

**Do not declare `$filter` / `$orderby` in any `inParams` list** (not on `datasources[0].inParams`, `getListFlow.inParams`, or `getByKeysFlow.inParams`). The platform auto-injects typed versions derived from the `dynamicFilters` / `dynamicOrderBys` registrations — column unions, operation enums, and value types are all narrowed from the registrations. A manual `inParams` entry (even as `type: "object"`) collides with the auto-injected declaration, producing duplicate-identifier errors and contract-mismatch warnings at import. `$top` / `$skip` are unrelated pagination inputs and do get declared on `getListFlow.inParams` in the normal way. `datasourceConfig.configParameters` also does not need entries for `$filter` / `$orderby` — the platform auto-forwards from the registrations.

#### Application Is All-Or-Nothing

Dynamic filter/sort registrations control **only** the UI: they make filter inputs and sort affordances appear on each registered column. The data is filtered/sorted **only** if the flow code applies `$filter` and `$orderby` to the row set. There is no auto-application for flow-type backings.

This produces a hard authoring rule with two acceptable end states and one bug state:

| State | Registrations | Per-column wiring | Flow code applies $filter/$orderby | Result |
|---|---|---|---|---|
| **A. Fully wired** | yes | yes | yes | Users filter/sort; data responds. |
| **B. Fully disabled** | no | no | no | No filter/sort UI; row set is as the flow returns. |
| **C. Half-wired (bug)** | yes | yes | **no** | UI shows filter/sort controls that visibly do nothing. |

State C is the trap. If the flow's row shape, aggregation strategy, or value semantics make in-memory filter/sort genuinely hard to implement correctly — or if no established pattern fits the use case — **remove the registrations and per-column wiring** instead of leaving the controls inert. Disable both ends together. Bringing them back is a single edit later when the pattern is clearer.

For source-side application (translating `$filter` into the upstream OData query), the same rule applies: either the translation is fully implemented, or the registrations / per-column wiring come off until it is. Partial application — e.g. only `equals`, silently dropping `contains` — is the same UI-vs-data divergence in a slightly nicer disguise.

#### Default In-Memory $filter / $orderby Application

For flow-type grid datasources that *do* commit to dynamic filter/sort (state A above) — the enum-dropdown pattern, computed/derived rowsets, and any case where the row set isn't a single OData entity — the canonical `getListFlow` body includes two generic helper functions that apply `$filter` and `$orderby` against the row array in memory. They cover the documented operator set and the standard ascending/descending sort, and they're safe to drop into any flow whose row shape is a plain `Record<string, primitive>`.

```typescript
function applyDynamicFilter(rows: any[], filter: any): any[] {
    if (!filter || !filter.operands || filter.operands.length === 0) { return rows; }
    return rows.filter(row => filter.operands.some((operand: any) => {
        const checks: any[] = [
            ...(operand.stringFilters ?? []),
            ...(operand.stringMultiFilters ?? []),
            ...(operand.numberFilters ?? []),
            ...(operand.numberMultiFilters ?? []),
            ...(operand.booleanFilters ?? []),
            ...(operand.dateFilters ?? [])
        ];
        return checks.every(f => {
            const v = row[f.column];
            const sv = typeof v === 'string' ? v.toLowerCase() : v;
            const fv = typeof f.value === 'string' ? f.value.toLowerCase() : f.value;
            switch (f.operation) {
                case 'equals': return v === f.value;
                case 'notEqual': return v !== f.value;
                case 'contains': return typeof v === 'string' && sv.includes(String(fv));
                case 'notContains': return typeof v === 'string' && !sv.includes(String(fv));
                case 'startsWith': return typeof v === 'string' && sv.startsWith(String(fv));
                case 'endsWith': return typeof v === 'string' && sv.endsWith(String(fv));
                case 'blank':
                case 'empty': return v == null || v === '';
                case 'notBlank': return v != null && v !== '';
                case 'lessThan': return v != null && v < f.value;
                case 'lessThanOrEqual': return v != null && v <= f.value;
                case 'greaterThan': return v != null && v > f.value;
                case 'greaterThanOrEqual': return v != null && v >= f.value;
                case 'in': return Array.isArray(f.value) && f.value.includes(v);
                case 'notIn': return Array.isArray(f.value) && !f.value.includes(v);
                default: return true;
            }
        });
    }));
}

function applyDynamicOrderBy(rows: any[], orderby: any): any[] {
    if (!orderby || orderby.length === 0) { return rows; }
    return [...rows].sort((a, b) => {
        for (const ob of orderby) {
            const av = a[ob.column];
            const bv = b[ob.column];
            const dir = ob.order === 'desc' ? -1 : 1;
            if (av == null && bv == null) { continue; }
            if (av == null) { return 1; }
            if (bv == null) { return -1; }
            if (av < bv) { return -1 * dir; }
            if (av > bv) { return 1 * dir; }
        }
        return 0;
    });
}
```

Application order inside `getListFlow`:

```typescript
// 1. Build the full row set.
let rows: any[] = /* ... */;

// 2. Apply any component-specific filters (full_text_search, etc.).
if ($utils.isDefined($flow.inParams.full_text_search)) { /* ... */ }

// 3. Apply auto-injected $filter and $orderby. Cast to `any` because they aren't declared in inParams.
rows = applyDynamicFilter(rows, ($flow.inParams as any).$filter);
rows = applyDynamicOrderBy(rows, ($flow.inParams as any).$orderby);

// 4. Set totalCount on the post-filter / pre-pagination set.
$flow.outParams.totalCount = rows.length;

// 5. Slice for pagination.
$flow.outParams.result = rows.slice(pageSkip, pageSkip + pageTop);
```

Notes on the cast: per the "Do not declare `$filter` / `$orderby`" rule above, these inputs aren't part of the flow's declared `inParams` shape, but the platform injects them at runtime from the registrations. The `as any` cast bypasses the compile-time check; runtime access is safe.

Operator coverage in the helper matches the full set documented for the filter shape (equals, notEqual, contains, notContains, startsWith, endsWith, blank/empty, notBlank, lessThan, lessThanOrEqual, greaterThan, greaterThanOrEqual, in, notIn). `stringMultiFilters` / `numberMultiFilters` carry the same `{column, operation, value}` shape — routed through the same `checks` array. Date macros (`today`, `yesterday`, `thisWeek`, ...) arrive as resolved `Date` values from the platform — the standard comparison branches work without extra cases.

The helpers are nested function declarations inside the flow `code` body (hoisted to the top of the function scope) — same idiom as `formatKey` / `capitalize` in the enum-dropdown pattern. Duplicate them in any flow that needs them; the platform compiles each flow independently.

**When the default helper won't fit:** row shapes that aren't flat `Record<string, primitive>` (collection-typed columns, deeply-nested objects, fields stored under one name but filtered under another via sidecars), filterable columns whose value semantics need custom comparison (case-sensitive vs. insensitive variants, locale-aware ordering, IP/version sort), or aggregated rows where `$filter` has to run against group totals computed differently from the per-row values. For those, write a use-case-specific applier — or fall back to state B (disable filter/sort entirely) until the pattern is clear.

### Array-Field Caveat — Scalar Sidecar Pattern

`dynamicFilter` / `dynamicOrderBy` target a single scalar leaf. Entity fields declared as collections (`isCollection: true`) cannot be used directly — the filter UI would generate clauses like `equals "X"` that don't apply cleanly to arrays.

When the entity carries aggregated collection fields that you want users to filter or sort against, introduce **scalar sidecar fields** alongside them: a field with a parallel id (e.g. `accounts_display` next to `accounts`) populated as a single comparable string. Typical population is `accounts.join(', ')`, which gives a natural `contains`-matchable string for either lookup codes or names when entries carry both. The column keeps its existing array-indexed display binding (e.g. `$row.entity.accounts[0]`); `dynamicFilter` and `dynamicOrderBy` target the sidecar.

Sidecar fields must appear in all five entity-shape locations (see [Datasource Wiring — Five Places Must Stay in Sync](#datasource-wiring--five-places-must-stay-in-sync)) and be populated in the flow code.

### Post-Aggregation Pagination

When `$filter` / `$orderby` run post-aggregation, `$top` / `$skip` must also slice **post-aggregation**, not at the OData layer. Applying OData-level pagination before aggregation would produce inconsistent page contents as filtered groups vanish. The flow pattern:

1. Aggregate source rows into result groups.
2. Populate scalar sidecars.
3. Apply `$filter` against the groups.
4. Apply `$orderby` against the filtered groups.
5. Set `$flow.outParams.totalCount` to the length of the filtered-and-sorted set (pre-slice — the UI's paging controls need the grand total).
6. Assign any sequential group-naming (pre-slice, so ids stay stable across pages).
7. Slice by `$skip` / `$top`.

Trade-off: the entire source result set is fetched before filtering, so the OData record cap (~5000) applies to pre-aggregation rows. Upstream search filters (the `search` input) should narrow enough to stay well below that cap.

## Toolbar Items

Each entry in `topToolbar` / `toolbar` is a polymorphic control descriptor:

```json
{
  "id": "import_contact",
  "type": "button",
  "buttonConfig": {
    "label": "Import contact",
    "icon": "icon-ic_fluent_arrow_upload_20_regular",
    "clickFlowConfig": { "flowId": "on_import_contact_clicked", "flowParameters": null },
    "readOnly": false, "disabled": false, "splitButton": false, "buttons": [], "tooltip": ""
  },
  "labelConfig": null, "textConfig": null, "selectBoxConfig": null,
  "textBoxConfig": null, "dateBoxConfig": null, "numberBoxConfig": null, "checkBoxConfig": null,
  "imageConfig": null, "drawConfig": null, "codeBoxConfig": null, "progressBarConfig": null, "matrixConfig": null,
  "fromBaseConfiguration": null, "removed": null
}
```

The `type` field selects which sibling `<type>Config` block the platform reads — `button` → `buttonConfig`, `label` → `labelConfig`, `selectBox` → `selectBoxConfig`, etc. All other sibling blocks stay `null`. Separator entries carry a distinct `id` (`separator1`, `separator2`, ...) with all control configs null.

**Click handlers live inside the type-specific config block** — `buttonConfig.clickFlowConfig.flowId` for buttons, `selectBoxConfig.uiValueChangeFlowConfig` for dropdowns, etc. They do **not** live at the toolbar entry's top level.

`fromBaseConfiguration` and `removed` on toolbar entries (and on nested `buttonConfig` for button-detail fields) are tailoring-overlay markers — see [`tailoring.md`](../../tailoring-overlay/references/tailoring.md). On a standalone grid they stay `null`.

## Imperative Cell API

Row flows and grid-level flows can mutate individual cell state in addition to reading `$row.entity.<field>`. The mutable surface per cell:

| Surface | Shape |
|---|---|
| Read-mode display (text-type controls) | `$row.cells.<col>.displayControl.text = "..."` |
| Read-mode display (checkBox/selectBox/numberBox) | `$row.cells.<col>.displayControl.value = ...` |
| Edit-mode value | `$row.cells.<col>.editControl.value = ...` |
| Edit-mode dirtiness flag | `$row.cells.<col>.editControl.isChanged` (read-only boolean set by the platform) |

Two common idioms:

- **Post-load enrichment** in `on_data_loaded` — walk `$grid.rows`, fetch side-data from another datasource, then assign `row.cells.<col>.displayControl.text` / `editControl.value` for columns whose `displayControl.textConfig.value` is an empty string (i.e. not source-bound). This is the standard way to populate a column that isn't part of the primary datasource's `select`, and the backbone of the secondary-datasource pattern below.
- **Change-guarded writes** in `on_save_existing_row` — wrap every field assignment to the update payload in `if ($row.cells.<col>.editControl.isChanged) { payload.<X> = $row.cells.<col>.editControl.value; }`. This produces a minimal PATCH — unchanged fields stay absent.

### Cell Styling — Icons, Classes, and the Two `setStyle` Targets

Three constraints govern imperative cell icons/styling. Local TypeScript accepts violations of all three; they surface only at platform validation — or as silently missing visuals:

- **`displayControl.icon` exists only on button-typed cells.** A cell whose display control is a button (`IButtonModel`) exposes `.icon` — assign a Fluent class string (e.g. `'icon-ic_fluent_arrow_up_20_regular'`), clear with `null`. Text-typed cells (`ITextModel`) do **not** have `.icon`; assigning it compiles locally but fails platform validation with `Property 'icon' does not exist on type 'ITextModel'`. To put an icon on a text column, change the column's `displayControl.type` to `button` — a structural column edit, not a code-only change.
- **`ICellStyles` exposes only `setAttentionClass()` (plus `clearClasses()` to reset).** The richer semantic class toggles — `setCreationClass()`, `setPlannedClass()`, `setDestructiveClass()`, `setClass(<name>)` — live on button / button-group styles (`IButtonStyles` / `IButtonsStyles`, i.e. toolbar buttons and editor/hub controls), **not** on grid cells. Consequence: two row states cannot be distinguished by cell background color alone — both land on the same attention class. Carry the distinction in the cell text (e.g. prefix a failure label) or in a sibling cell.
- **`setStyle(prop, value)` has two targets — pick by which DOM element the property affects.** Every cell carries two `.styles` objects that apply inline CSS to *different* elements:

  | Target | Element styled | Properties that belong here |
  |---|---|---|
  | `$row.cells.<col>.styles.setStyle(...)` | the parent cell `<div>` wrapping the control | cell-spanning backgrounds and layout chrome; the class toggles (`setAttentionClass()` / `clearClasses()`) also act on this element |
  | `$row.cells.<col>.displayControl.styles.setStyle(...)` | the inner control element itself (the `<button>` when button-typed, the `<input>` when text-typed; `editControl.styles` is the edit-mode counterpart) | hover state, `pointer-events`, `cursor`, `opacity`, `text-decoration` of the control/label |

  A control-level property applied to the parent-div target type-checks and validates fine but has **zero visible effect** — the CSS lands on the wrong element. Rule of thumb: cell-level chrome on `cells.<col>.styles`, control-level chrome on `displayControl.styles`. For multi-state visuals inside one cell, combine them: a button-typed column with `displayControl.icon` + `displayControl.styles` for the control affordance, and `setAttentionClass()` on the cell parent for the background.

### Text Display Bindings Need String Values

`displayControl.textConfig.value` is typed `string`. Binding a non-string entity field (`"$row.entity.Id"` when `Id` is `Edm.Int32`, `"$row.entity.Active"` when `Active` is boolean, `"$row.entity.CreatedSysDateTime"` when it's a date) fails import with

> Grid `<name>` → displayControl → Column `<id>` → Value : Type '`<number|boolean|...>`' is not assignable to type 'string'.

**Coerce at the bind site, not in the entity schema.** The entity's declared `type` is the authoritative schema for dynamic filter/sort operator generation — changing it to `string` to satisfy the display binding corrupts filter/sort typing. Valid coercion patterns:

| Source type | Canonical binding |
|---|---|
| `number` | `"$row.entity.Id?.toString()"` or `` "`${$row.entity.Id}`" `` |
| `boolean` | `"$row.entity.Active ? 'Yes' : 'No'"` (or route through a display selector) |
| `Date` | `"$utils.date.format($row.entity.CreatedSysDateTime, 'MM/DD/YYYY')"` |
| `string` (already) | `"$row.entity.Name"` — no coercion needed |

The same rule applies to any declarative string slot that accepts an entity-field expression — `textConfig.value`, `tooltip`, `placeholder`, and similar. When in doubt, check the source field's declared `type` in `queryOptionsObjectTypeDef` and coerce if it isn't `string`.

For columns whose value comes from **imperative** assignment in `on_data_loaded` (`$row.cells.<col>.displayControl.text = ...`), leave the declarative `value` as `""` — see [Empty Declarative Bindings Are Legitimate](#empty-declarative-bindings-are-legitimate).

### Empty Declarative Bindings Are Legitimate

A column whose value is populated imperatively intentionally leaves `displayControl.<cfg>.value` and `editControl.<cfg>.value` as empty strings. Do not "fix" these to `$row.entity.<field>` unless the field actually exists on the entity — doing so overwrites the imperative population on every render. See the general rule in [`file-format.md` → Declarative String Values Are TypeScript Expressions](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions); imperatively-populated cells are the one allowed exception.

## Secondary (Enrichment) Datasources

A grid may carry more than one entry in its `datasources[]` array. The first (or the one named by `datasourceConfig.configId` when `isOwned: true`) is the **primary** datasource — it drives row population, pagination, sort, filter. Additional entries are **secondary** datasources, invoked explicitly from grid flow code:

```typescript
const { result } = await $grid.datasources.ds_country_lookup.get({ iso_codes: codes });
```

Typical use:

- **Enrich each row** with fields not in the primary entity (UDFs, external system fields, derived values from another entity keyed by the row's Id). The enrichment flow runs in `on_data_loaded`, walks `$grid.rows`, issues one batched secondary query (`Id in ${...}` filter), then writes results to cells via the [Imperative Cell API](#imperative-cell-api).
- **Resolve foreign-key display values** (e.g. converting a stored ISO country code to a friendly `"US-United States"` label by joining against a country datasource).

Secondary datasources follow the normal embedded-datasource shape (same five-location rule for their own entity shape). They do **not** need `dynamicFilters` / `dynamicOrderBys` — those drive the primary's filter/sort UI only.

Tailored grids use this pattern heavily — a tailored overlay often ships a `tailored_ds_<base>` secondary datasource that queries extra fields keyed by the primary's row Ids. When flattening a tailored grid into a standalone, the secondary is typically merged back into the primary's `select` list. See [`tailoring.md`](../../tailoring-overlay/references/tailoring.md).

## Mounting a Grid from a Hub

Hubs embed grids inside `tabs[].contentConfig` (when `contentType: "grid"`). The mount carries its own `configId` + `moduleId` — which must point to where the grid **actually** lives (see [`component-wiring.md` → Cross-Component References Use the Target's Module](../../component-wiring-check/references/component-wiring.md#cross-component-references-use-the-targets-module)). `configParameters` on the mount feed the grid's own `inParams`, and `configEvents` subscribe to grid-emitted events.

## Conventions

- **Column names** use sentence case; acronyms preserved. See [`naming-conventions.md` → Display Text Conventions](../../datex-studio-conventions/naming-conventions.md#display-text-conventions).
- **Column id** typically matches the entity field id (e.g. `carrier_service` column bound to `$row.entity.carrier_services[0]`). Collection entity fields often render the first element in the display cell and expose the full list elsewhere (tooltip, flyout).
- **Hidden-by-default columns** (`visible: false` or runtime `hidden: true`) are common for group-by-dependent columns — toggle them in `on_data_loaded` based on the active grouping configuration.
- **Toolbar button readOnly gating** lives in `on_select_row`, not in the button config, so the gate responds to live selection changes.
- **Built-in CRUD actions** (`crud_create_entity`, `crud_update_entity`, `crud_delete_entity` from Utilities) are the conventional way to persist grid row edits — see [`calling-conventions.md` → CRUD Actions](../../datex-studio-runtime/calling-conventions.md#crud-actions).
- **Vars and rowVars**. Grid-scope scratch lives in top-level `vars[]`, accessed as `$grid.vars.<id>`. Per-row scratch lives in top-level `rowVars[]`, accessed as `$row.vars.<id>`. Both use the standard inParam-shaped descriptor. Declare every id you read or write — see [`component-wiring.md` → Component Variables Must Be Declared](../../component-wiring-check/references/component-wiring.md#component-variables-must-be-declared).
- **Icons** use the `icon-ic_fluent_<name>_<size>_<style>` identifier set (Fluent icons), e.g. `icon-ic_fluent_arrow_upload_20_regular`, `icon-ic_fluent_arrow_download_20_regular`. Used on `buttonConfig.icon`, column `displayControl.imageConfig`, and other icon-taking fields.
- **Injected CSS must be scoped.** Stylesheets injected at runtime from component flow code are document-global, so unscoped rules leak into every other component on screen. Scope rules to the owning component by anchoring selectors on a unique inline-style marker set imperatively (e.g. a distinctive `border-left-color` assigned in `on_init`, matched via `[style*="<rgb-value>"]`). Keep marker values distinct across states — attribute `*=` matching is substring-based, so overlapping RGB strings inherit each other's rules. Toolbar/action-bar buttons can be targeted through their stable wrapper attribute, `.toolContainer[data-cy="tool-id-<id>"]`.
- **Tailoring overlay**. Grids can be extended by a tailored overlay (`baseConfiguration` + `onCustomization*FlowConfig`) without forking. See [`tailoring.md`](../../tailoring-overlay/references/tailoring.md) for the overlay model, the `fromBaseConfiguration: true` marker semantics, and the recipe for flattening a tailored grid into a standalone custom one.
