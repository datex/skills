# Tailoring — Overlay Model for Per-Customer Component Extensions

For the grid concepts tailoring builds on, see [`grids.md`](../../grid-creator/references/grids.md).

## Purpose

**Tailoring** is the overlay mechanism for adapting a core-library component to a specific customer's needs without forking it. A **tailored grid** (or form / editor / hub) references a **base component** via `baseConfiguration`, inherits its full contract, and then layers targeted overrides on top — new columns, new flows, customization hooks against existing flows, additional secondary datasources, suppressed items.

The benefit: the base component continues to evolve and the tailored overlay picks up those evolutions automatically. The cost: tailoring introduces an additional moving part (the overlay) that must be resolved at import/runtime, plus several concepts that only make sense inside an overlay (the `fromBaseConfiguration: true` shadow marker, the `onCustomization*FlowConfig` hook pairs, the `removed: true` suppression flag).

Tailoring is an overlay concept. When a customer's needs diverge enough that they're tracking little of the base's behavior, flatten the tailored component into a **standalone custom component** (the `custom_<base_name>` variant) — see [Conversion Recipe: Flattening a Tailored Component](#conversion-recipe-flattening-a-tailored-component).

## Provenance Variants

Three provenance variants for grids (and analogously for other tailorable types), spelled out in [`naming-conventions.md`](../../datex-studio-conventions/naming-conventions.md):

| Variant | Name pattern | `baseConfiguration` | When to use |
|---|---|---|---|
| Core-library grid | `<intuitive_name>_grid` | `null` | Shipped as part of a core package; canonical base. |
| Tailored grid | `tailored_<base_name>_grid` | `{ configId, moduleId, isOwned }` pointing at a core grid | Extend a core grid with customer-specific tweaks while inheriting ongoing improvements. |
| Standalone custom grid | `custom_<base_name>_grid` | `null` | Net-new customer-specific grid; no overlay relationship. Typically the result of flattening a tailored grid. |

Internal components authored alongside a tailored grid carry the `tailored_` prefix (`tailored_on_save_row`, `tailored_ds_contact_addresses_grid`); alongside a custom grid, the `custom_` prefix (`custom_ds_contact_addresses_grid`, `custom_ds_countries_dd`).

Cross-package overlay is supported: a tailored grid can live in a different package than its base. The base's package is recorded in `baseConfiguration.moduleId`.

## The Anatomy of a Tailored Component

### `baseConfiguration` — pointer to the base

Top-level field. Present and non-null on tailored components; `null` on core and custom components.

```json
"baseConfiguration": {
  "configId": "contact_addresses_grid",
  "moduleId": "FootprintManager",
  "isOwned": null
}
```

`configId` is the base component's `referenceName`. `moduleId` is the package the base lives in — not the package the tailored overlay lives in. `isOwned` is `null` for cross-referenced bases (the common case).

### `fromBaseConfiguration: true` — the shadow marker

Every nested element inherited from the base carries `fromBaseConfiguration: true` in the tailored component's JSON. These are **shadow copies** — the authoritative definition lives in the base; the shadow exists in the overlay file so column ids, inParam ids, etc. can be referenced by flow code and by nested collections without having to resolve against the base at every access.

Places the marker appears (grid example; analogous for other component types):

- Top-level: `inParams[].fromBaseConfiguration`, `outParams[].fromBaseConfiguration`
- `columns[].fromBaseConfiguration`
- `topToolbar[].fromBaseConfiguration`, `topToolbar[].buttonConfig.fromBaseConfiguration`
- `flows[].fromBaseConfiguration`, `rowFlows[].fromBaseConfiguration`
- `datasources[].fromBaseConfiguration`
- `datasources[0].queryOptionsObjectTypeDef[].fromBaseConfiguration`
- `datasources[0].outParams[].objectTypeDef[].fromBaseConfiguration`
- `datasources[0].inParams[].fromBaseConfiguration`
- `datasources[0].dynamicFilters[].fromBaseConfiguration`
- `datasources[0].configParameters[].parameter.fromBaseConfiguration`

Rules:

- **New elements** (columns, flows, datasources, inParams authored fresh on the tailored overlay) use `fromBaseConfiguration: null`.
- **Shadow elements** use `fromBaseConfiguration: true`. Do not hand-edit their content — the base owns them; drift between shadow and base at import time surfaces as "Outdated contract" errors.
- **Flipping `true` → `null` is a flatten step** — the element becomes authoritative on whatever file holds it. Done wholesale when converting a tailored overlay into a standalone custom component.

### `onCustomization<Slot>FlowConfig` + `...ExecutionBehaviorType` — the hook pair

Every platform-recognized flow slot that a grid (or form / editor / hub) exposes carries a **pair** of config fields at top level:

| Base slot | Tailoring pair |
|---|---|
| `onInitFlowConfig` | `onCustomizationInitFlowConfig` + `onCustomizationInitFlowConfigExecutionBehaviorType` |
| `onDataLoadedFlowConfig` | `onCustomizationDataLoadedFlowConfig` + `...ExecutionBehaviorType` |
| `onSelectionChangedFlowConfig` | `onCustomizationSelectionChangedFlowConfig` + `...ExecutionBehaviorType` |
| `onInitNewRowFlowConfig` | `onCustomizationInitNewRowFlowConfig` + `...ExecutionBehaviorType` |
| `onSaveNewRowFlowConfig` | `onCustomizationSaveNewRowFlowConfig` + `...ExecutionBehaviorType` |
| `onSaveExistingRowFlowConfig` | `onCustomizationSaveExistingRowFlowConfig` + `...ExecutionBehaviorType` |
| `onRowDataLoadedFlowConfig` | `onCustomizationRowDataLoadedFlowConfig` + `...ExecutionBehaviorType` |
| `onExcelImportFlowConfig` | `onCustomizationExcelImportFlowConfig` + `...ExecutionBehaviorType` |
| `onExcelExportFlowConfig` | `onCustomizationExcelExportFlowConfig` + `...ExecutionBehaviorType` |

Buttons carry their own pair: `buttonConfig.clickFlowConfig` (the base-defined click flow, if any) and `buttonConfig.onCustomizationClickFlowConfig` on tailored overlays.

The customization config has the same `{ flowId, flowParameters }` shape as the base config, and the `referenceName` it names must exist in the overlay's `flows[]` or `rowFlows[]` array (typically `tailored_<slot>`). The **execution behavior** controls ordering relative to the base flow:

| Behavior | Meaning |
|---|---|
| `before` | Run the tailored flow, then the base's flow. |
| `after` | Run the base's flow, then the tailored flow. |
| `replace` | Run the tailored flow only — skip the base entirely. |

The `...ExecutionBehaviorType` field is present even when `onCustomization<Slot>FlowConfig` is null — it carries a placeholder value (typically `after`) so the pair is always contractually shaped. Only non-null `onCustomization<Slot>FlowConfig` entries actually fire.

Practical implication for flattening: `replace` drops the base flow body, `before` / `after` concatenate base and tailored bodies in the right order.

### `removed: true` — suppression flag

Applied to an inherited (`fromBaseConfiguration: true`) entry to suppress it from the tailored component at runtime without deleting the shadow from the JSON. Appears on toolbar entries (and nested `buttonConfig`), and is shaped identically across other collection slots (columns, flows) where supported.

On a tailored grid, a `removed: true` toolbar button disappears from the UI even though the base still declares it. When flattening to a custom grid, every `removed: true` entry is simply dropped from the output — there's no base to suppress against anymore.

### Secondary (Enrichment) Datasources

The standard tailoring pattern for **adding a field that isn't in the base datasource's `select` list** (UDFs, external-system fields, foreign-key display resolutions) is to embed a second datasource in `datasources[]` alongside the inherited one:

- `datasources[0]` — the inherited primary (`fromBaseConfiguration: true`). Still drives row population. The first datasource (or the one named by `datasourceConfig.configId`) is always the primary — see [grids.md → Datasource Wiring](../../grid-creator/references/grids.md#datasource-wiring--five-places-must-stay-in-sync).
- `datasources[1]` — the tailored overlay's secondary datasource (`tailored_ds_<base>`). Typically filtered by `Id in ${contactIds}` against the same entity set, selecting only the extra fields.

Then an `after` customization on `on_data_loaded` walks `$grid.rows`, batches a lookup against the secondary datasource, and writes the enrichment into each row using the [Imperative Cell API](../../grid-creator/references/grids.md#imperative-cell-api):

```typescript
let contactIds = $grid.rows.map(r => r.entity?.Id).filter(Boolean);
const { result } = await $grid.datasources.tailored_ds_contact_addresses_grid.get({ contactIds });
for (let row of $grid.rows) {
  const extra = result.find(r => r.Id === row.entity?.Id);
  if (!extra) continue;
  row.cells.reference_code.displayControl.text = extra.ReferenceCode;
  row.cells.reference_code.editControl.value = extra.ReferenceCode;
  row.cells.inactive.displayControl.value = extra.inactive;
  row.cells.inactive.editControl.value = extra.inactive;
}
```

The tailored-specific columns (`reference_code`, `inactive` above) carry **empty `value`** strings in their declarative `displayControl` / `editControl` configs — they're populated imperatively. See [grids.md → Empty Declarative Bindings Are Legitimate](../../grid-creator/references/grids.md#empty-declarative-bindings-are-legitimate).

### Tailored Columns

Columns without `fromBaseConfiguration: true` are authored on the overlay. They use the normal column descriptor; their `displayControl` / `editControl` values bind to `$row.entity.<field>` when the field comes from the secondary datasource or from the base's entity, or to empty strings when populated imperatively post-load.

Naming: prefix with `tailored_` when the column's **display** purpose overlaps an inherited column (`tailored_country` overriding the inherited `country`). Otherwise use a plain domain name.

## Conversion Recipe: Flattening a Tailored Component

Converting a tailored component into a standalone `custom_` one is mechanical once you recognize every tailoring surface. Follow top-to-bottom:

1. **Rename.** `referenceName` → `custom_<base_name>`. Rename the file to match. Update any embedded component ids (e.g. the overlay's secondary datasource goes from `tailored_ds_<base>` → `custom_ds_<base>`, flows from `tailored_on_<slot>` → `custom_on_<slot>` or merge-into-existing).
2. **Drop `baseConfiguration`.** Set to `null`.
3. **Unshadow everything.** Flip every `fromBaseConfiguration: true` to `null` across the file — top-level params, columns, toolbar entries, flows, datasource, queryOptionsObjectTypeDef, dynamicFilters, dynamicOrderBys, configParameters, every nested occurrence. All elements become authoritative on the custom component.
4. **Cut suppressed items.** Drop every entry with `removed: true` from the JSON outright (no base to suppress against).
5. **Collapse the customization hooks.** For each populated `onCustomization<Slot>FlowConfig` + `...ExecutionBehaviorType` pair, merge the tailored flow into the base slot per its behavior:
   - `before`: prepend the tailored body to the base's `on<Slot>FlowConfig` flow.
   - `after`: append the tailored body to the base's `on<Slot>FlowConfig` flow.
   - `replace`: replace the base flow body with the tailored body.
   Then null out every `onCustomization*` field. Delete the freestanding `tailored_*` flow entry from `flows[]` / `rowFlows[]` once its body has been merged (unless it's still being called by another flow — then keep it as a plain helper flow).
6. **Consolidate datasources.** If the overlay used a secondary datasource for enrichment, either:
   - **Preferred**: merge the secondary's fields into the primary. Touch **all** of these locations — missing any one causes silent failures at runtime:
     - `datasources[0].queryOptions.selects` — the OData `$select` clause. **This is the runtime data shape; without this entry, the field is undefined on `$row.entity` even if every type-metadata location is correct.** For a nested field, add it to the appropriate `expands[].queryOptions.selects` instead.
     - All five type-metadata / contract locations per [grids.md → Datasource Wiring — Five Places Must Stay in Sync](../../grid-creator/references/grids.md#datasource-wiring--five-places-must-stay-in-sync) (for OData datasources, locations 3 and 4 are `null` — skip them, but `queryOptions.selects` replaces them as the sixth, runtime-only slot; see [OData-Backed Grid Datasources](../../grid-creator/references/grids.md#odata-backed-grid-datasources--queryoptionsselects-is-a-sixth-runtime-only-location)).
     - `datasources[0].dynamicFilters` / `dynamicOrderBys` and `datasourceConfig.dynamicFilters` / `dynamicOrderBys` if the merged field is filterable or sortable.

     Then delete the secondary entirely and strip the post-load enrichment calls to `$grid.datasources.<secondary>.get(...)` from the flattened `on_data_loaded`.
   - **Alternative**: keep the secondary as a `custom_ds_<base>` enrichment datasource if it queries a different entity set or can't be folded into a single query (e.g. it hits a different API or aggregates).
7. **Resolve overlapping columns.** If the tailoring added a parallel column (e.g. `tailored_country` overriding the inherited `country`), drop the base's column and rename the tailored one to the canonical id (`tailored_country` → `country`). Update every `$row.cells.<col>` reference in flow code to the new id.
8. **Update imperative populations.** Cells that were being written imperatively from the secondary datasource are now source-bound — replace the empty declarative `value` with `$row.entity.<field>` and strip the matching `row.cells.<col>.displayControl.text = ...` / `editControl.value = ...` lines from `on_data_loaded`. Cells that still require imperative population (foreign-key display resolution, computed display text) stay as they were.
9. **Repackage.** The custom grid lives in a package chosen for customer context — often the same package as the tailored overlay, not the base. Update cross-component references (`$shell.<Package>.*`, `$types.<Package>.*`, `$flows.<Package>.*`) to match.
10. **Pre-flight OData schema.** Any newly-authoritative OData field additions (selects, entity shape entries, dynamic filter/orderby registrations) trigger the normal schema pre-flight via the `schema-explorer` skill — see [`odata-datasources.md` → Pre-Flight](../../datasource-creator/references/odata-datasources.md#pre-flight-validate-against-schema). UDF fields that are queryable via OData but absent from the exported schema are acceptable (they were already working on the tailored overlay); document them in the change notes.
11. **Re-declare vars / rowVars.** Any `$grid.vars.<id>` / `$row.vars.<id>` touched by the now-flattened flows must be declared at the custom grid's top-level `vars[]` / `rowVars[]`. On the tailored overlay they may have been implicitly inherited; on the standalone they must be explicit.
12. **Verify descriptions are ≤ 100 chars** per the platform rule.

Once the recipe is complete, the custom component has no `baseConfiguration`, no `fromBaseConfiguration: true` markers, no `onCustomization*` values, and no `removed` flags — it's indistinguishable in shape from a from-scratch custom grid.

## Pre-Flight Checklist — Authoring a Tailored Overlay

When creating a new tailored overlay on top of a core grid (as opposed to flattening one), walk this list:

1. Read the base component file. Identify its `referenceName`, `moduleId`, columns, flows, datasources, inParams, outParams.
2. Create the tailored file as `tailored_<base_name>_grid-grid.json`.
3. Set `baseConfiguration: { configId: <base_referenceName>, moduleId: <base_package>, isOwned: null }`.
4. Copy every inherited element with `fromBaseConfiguration: true` — top-level params, columns, toolbar entries, flows, rowFlows, the primary datasource and its nested shape. These shadow copies must match the base exactly; drift surfaces as "Outdated contract" at import.
5. Add new columns, new toolbar entries, new flows / rowFlows with `fromBaseConfiguration: null`.
6. For each base flow you want to hook, populate the matching `onCustomization<Slot>FlowConfig` with a pointer to your tailored flow, and set `onCustomization<Slot>FlowConfigExecutionBehaviorType` to `before` / `after` / `replace`.
7. If you need fields not in the base datasource's select list, embed a secondary `tailored_ds_<base>` datasource in `datasources[]` alongside the inherited one, and populate cells imperatively in `on_data_loaded` via `$grid.datasources.<secondary>.get(...)`.
8. To suppress an inherited toolbar button, column, or flow, set its `removed: true` — don't delete the shadow.
9. Declare any `$grid.vars.<id>` / `$row.vars.<id>` your tailored flows use, at the tailored file's top-level `vars[]` / `rowVars[]`.

## Cross-References

- [`grids.md`](../../grid-creator/references/grids.md) — grid component authoring, imperative cell API, secondary enrichment datasources, toolbar item polymorphism.
- [`flow-datasources.md`](../../datasource-creator/references/flow-datasources.md) — the five-location rule for datasource entity shapes (still applies when consolidating a secondary datasource into the primary).
- [`odata-datasources.md`](../../datasource-creator/references/odata-datasources.md) — pre-flight metadata validation for OData-backed datasources.
- [`naming-conventions.md`](../../datex-studio-conventions/naming-conventions.md) — the `tailored_` / `custom_` prefix rules.
- [`component-wiring.md` → Component Variables Must Be Declared](../../component-wiring-check/references/component-wiring.md#component-variables-must-be-declared) — the `vars` / `rowVars` declaration rule, including the grid-specific `rowVars`.
