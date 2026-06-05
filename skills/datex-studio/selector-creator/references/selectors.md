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
