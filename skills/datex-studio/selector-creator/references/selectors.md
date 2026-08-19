# Selectors

For the datasource taxonomy (component variant vs query type), see [`datasources.md`](../../datasource-creator/references/datasources.md).

A selector is named `<referenceName>-selector.json` (`configurationTypeId: 7`). The component lives on the branch — this is the naming convention, not a local `src/` path. A selector defines a dropdown/autocomplete control that can be bound to a form field or grid column.

## Backing Datasource Variant — Hard Rule

Selectors **must** be backed by a `-datasource.json` component (platform backend, `configurationTypeId: 6`). They **cannot** be backed by a `-footprintDatasource.json` (FPDS, `configurationTypeId: 19`). This is a hard platform rule with no exceptions.

The **query type** inside the backing `-datasource.json` is unconstrained — it can be either:

- **Flow type** (`type: "flows"`, embedded TS) — most common, e.g. enum dropdowns with `formatKey` helpers. See [`flow-datasources.md`](../../datasource-creator/references/flow-datasources.md).
- **OData type** (`type: "oDataQuery"`, declarative) — used when the dropdown options come from a database entity. Wrap the OData query in the `-datasource.json` variant, not an FPDS. See [`odata-datasources.md`](../../datasource-creator/references/odata-datasources.md) for the OData query shape.

Put another way: selectors care about the **component variant**, not the **query type**.

## Datasource-Backed Selector

The most common type:

```json
{
  "placeholder": null,
  "dataType": "datasource",
  "customOptionsConfig": null,
  "datasourceConfig": {
    "datasourceKeyDef": [{"id": "<KeyField>", "type": "<type>", "isSecured": null}],
    "dynamicOrderBys": null,
    "dynamicFilters": null,
    "configParameters": [
      {
        "parameter": {"id": "full_text_search", "required": false, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "string", "objectTypeDef": null, "objectType": null, "isCollection": false, "isSecured": null, "isConstant": null, "constantValue": null},
        "value": "$selector.fullTextSearch",
        "parsedValue": null
      }
    ],
    "configOutParameters": [
      {"id": "result", "required": null, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "object", "objectTypeDef": ["<result field descriptors with full boilerplate>"], "objectType": null, "isCollection": true, "isSecured": null, "isConstant": null, "constantValue": null}
    ],
    "configEvents": null,
    "outParamsChangeFlowConfig": null,
    "configId": "<datasource_referenceName>",
    "moduleId": "<Package>",
    "isOwned": null
  },
  "text": "$option.entity.<DisplayField>",
  "top": "25",
  "multiSelectionDisplayTextItemsSeparator": null,
  "actionConfig": null,
  "flows": null,
  "onInitFlowConfig": null,
  "configurationTypeId": 7,
  "id": 0,
  "referenceName": "<selector_name>",
  "title": "<selector_name>",
  "description": "<description>",
  "inParams": null,
  "outParams": null,
  "vars": null,
  "events": null,
  "accessModifier": "<public|private>"
}
```

`configOutParameters` mirrors the backing datasource's `outParams` — use the same `objectTypeDef` entries with full parameter boilerplate (see [Flow-Style Datasources → Canonical Skeletons](../../datasource-creator/references/flow-datasources.md#canonical-skeletons) for the field shape).

## Key Points

- `datasourceConfig.configId` + `moduleId` identify which datasource to query.
- `datasourceConfig.datasourceKeyDef` must mirror the datasource's `keyDef`.
- `datasourceConfig.configParameters` wires selector inputs (e.g. `$selector.fullTextSearch`) to datasource inParams.
- `datasourceConfig.configOutParameters` must mirror the datasource's `outParams` shape.
- `text` is a template expression for the display label — typically `"$option.entity.Key"` for enum dropdowns.
- `top` is a **string** (not number) controlling how many items to show.
- **Sort by display label** — when creating a selector's backing datasource, sort results by the field used as the display label (the field referenced in `text`). For OData datasources, add an `orderBys` entry; for flow-style datasources, sort the array in code. Example: a `task_status_dd` selector displaying `Name` should have its datasource order by `Name` ascending.

## Custom-Options Selectors — Consumers Must Not Assume String Values

Besides the datasource-backed shape above, a selector can instead populate `customOptionsConfig` with a static options table baked into the component. The two flavors differ in what value type they emit:

1. **Datasource-backed** (`dataType: "datasource"`) — emits whatever the backing datasource returns for the key field. Enum dropdowns built this way (a flow-type datasource exposing `Object.entries($types.<Pkg>.<enum>)`) emit the enum's string values (e.g. `"eligible"` / `"not-eligible"`).
2. **Custom-options** (`customOptionsConfig` populated) — emits whatever the option table's Value column holds. That is frequently a **number**, because the author was thinking "1 = on, 2 = off" rather than semantic strings (e.g. an eligibility dropdown mapping `Eligible → 1`, `Not eligible → 2`).

The trap: a consumer (engine flow, editor field handler, filter mapping) written against string enum values silently falls through its `switch` / mapping to the default branch when a shared custom-options selector emits `1` / `2` instead. Nothing errors — the behavior just stops responding to the dropdown ("I changed the selection and got the same results every time").

Rules:

- **Wiring a field to a shared selector you didn't author:** inspect the selector's configuration first — fetch it from the branch and check whether `customOptionsConfig` or `datasourceConfig` is populated, and what the option values actually are. Don't assume it emits strings.
- **Authoring a new dropdown:** prefer an enum-customType-backed flow datasource (see [`flow-datasources.md` → Enum Dropdown Datasource Pattern](../../datasource-creator/references/flow-datasources.md#enum-dropdown-datasource-pattern)) over custom options — it aligns with string-typed interface fields and avoids numeric drift.
- **Consuming a value from a possibly-shared selector:** be defensive — accept both the string and numeric forms in the switch/mapping (e.g. `v === "eligible" || v === 1`).

## Full-Text Search Wiring — Selector-Backing Datasources

This rule applies to datasources authored **specifically to back a selector** (i.e. the datasource exists because the selector needs it). Standalone datasources used by other flows/actions are not subject to this rule.

Three coupled requirements:

1. **Backing datasource declares `full_text_search` as an inParam** — string, `required: false`. The id must be exactly `full_text_search`.

2. **Backing datasource applies a conditional contains-filter on the display-label field** (the field referenced by the selector's `text`). The condition must be gated on `$utils.isDefined($datasource.inParams.full_text_search)` so empty input disables the filter entirely.

   **OData-type backing** (`type: "oDataQuery"`):

   ```json
   {
     "expression": {"type": "statement", "value": "`contains(<LabelField>, ${$utils.odata.formatString($datasource.inParams.full_text_search)})`"},
     "hasCondition": true,
     "condition": "$utils.isDefined($datasource.inParams.full_text_search)"
   }
   ```

   **Flow-type backing** (`type: "flows"`): apply the filter inside the `getListFlow` code, guarded by an `if ($utils.isDefined($flow.inParams.full_text_search)) { ... }` branch. Typical shape:

   ```typescript
   if ($utils.isDefined($flow.inParams.full_text_search)) {
       const needle = ($flow.inParams.full_text_search as string).toLowerCase();
       rows = rows.filter(r => r.<LabelField>.toLowerCase().includes(needle));
   }
   ```

3. **Selector wires `$selector.fullTextSearch` into the datasource's `full_text_search` input** via a `configParameters` entry:

   ```json
   {
     "parameter": {"id": "full_text_search", "required": false, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "string", "objectTypeDef": null, "objectType": null, "isCollection": false, "isSecured": null, "isConstant": null, "constantValue": null},
     "value": "$selector.fullTextSearch",
     "parsedValue": null
   }
   ```

Combined with the `top: "25"` and "sort by display label" rules, this is the baseline behavior of a selector-backing datasource. Do not omit pieces — a selector that doesn't wire `full_text_search` or a backing datasource that ignores it feels broken to end users typing in the dropdown.

## getList ↔ getByKeys Key Transformation Parity

Selector-backing datasources expose two flows the platform calls at different lifecycle points:

- **`getListFlow`** — returns the dropdown's option set when the user opens it (or types into the full-text-search box).
- **`getByKeysFlow`** — returns the displayable record(s) for a previously-saved Value when the platform re-hydrates a form/editor/grid filter that already has a selection.

If `getListFlow` applies a Key transformation (e.g. `formatKey` to convert `ParentOfTarget` → `Parent of target`, or any other label massaging), **`getByKeysFlow` must apply the identical transformation**. Otherwise the saved selection round-trips through `getByKeys`, returns the raw enum id, and the dropdown control renders `ParentOfTarget` instead of `Parent of target`. Users see one label while editing and a different one after reload — a classic "looks broken" UX bug.

The fix is mechanical: duplicate the same Key-producing expression in both flows. For enum-backed flow datasources that use `formatKey`:

```typescript
// getListFlow
$flow.outParams.result = Object.entries($types.<Package>.<enum>)
    .filter(([k, v]) => typeof v === 'string')
    .map(([key, value]) => ({ Key: formatKey(key), Value: value as string }));

// getByKeysFlow
$flow.outParams.result = Object.entries($types.<Package>.<enum>)
    .filter(([k, v]) => typeof v === 'string')
    .map(([key, value]) => ({ Key: formatKey(key), Value: value as string }))
    .filter(r => $flow.inParams.$keys.includes(r.Value));
```

The `formatKey` (and `capitalize`) helper functions live as nested function declarations inside each flow's `code` body — duplicate the same definitions in both flows; the platform compiles each flow independently and they don't share scope.

OData-type backing datasources rarely hit this because their `getByKeys` is auto-generated from the `keyDef` and selects raw columns. But if you ever add computed columns or column-aliasing inside the OData query options, the same parity rule applies — the projection used at list-time must match the projection used at key-lookup time.

## `getByKeysFlow` Contract — Self-Sufficient, Read-Only, Key-Faithful

Three further rules for `getByKeysFlow`, each learned from a shipped defect:

1. **Self-sufficient.** `getByKeysFlow` runs in a fresh datasource invocation — state populated by `onInitFlow` into `$datasource.inParams` (or any other per-invocation slot) is **undefined** when getByKeys fires. A getByKeys that depends on init-populated state fails with an empty result ("No data to display" on the control). The dependency can stay latent for a long time: single-select controls often resolve the display label from the option list, and only `allowMultiSelection: true` (or a re-hydration path) forces value resolution through getByKeys. Derive everything getByKeys needs from `$flow.inParams.$keys` and its own queries.
2. **Read-only.** getByKeys is a lookup the platform may call at any re-hydration point — it must never perform writes. A selector whose getByKeys performed a copy-entity side effect created records on every form reload.
3. **Key-faithful.** getByKeys must return records whose Value equals the **requested** keys. Returning a different id (e.g. the copy's new id) breaks the control's key reconciliation and persists stale/wrong ids through the form save.
