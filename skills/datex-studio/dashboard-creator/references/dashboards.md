# Dashboards — Authoring Reference

Authoritative reference for Datex Studio **dashboard** components (`configurationTypeId: 35`, CLI type `dashboard`, `-dashboard.json` suffix). A dashboard is a multi-panel UI composition: a recursive row/column tree of **sections**, each hosting tabs (embedded grids), a fieldset (form-style fields), or widgets, all sharing one set of dashboard `vars`. Since it declares `inParams`/`outParams` like any UI component, it can be opened as a **dialog returning a result**. Peer docs: [grids](../../grid-creator/references/grids.md) (the usual section content), [widgets](../../widget-creator/references/widgets.md) (widget sections), [wizards](../../wizard-creator/references/wizards.md) (the stepped alternative), [forms](../../form-creator/references/forms.md) (fieldset shape, dialog rule), [component-wiring](../../component-wiring-check/references/component-wiring.md) (embed contracts), [file-format](../../datex-studio-conventions/file-format.md), [naming-conventions](../../datex-studio-conventions/naming-conventions.md), [runtime-globals](../../datex-studio-runtime/runtime-globals.md).

> Provenance: distilled from production components on a Footprint Manager package and the generated designer contexts, dxs 0.5.8.

## Purpose & When to Use

- **Side-by-side / multi-panel compositions** with shared state: two grids coordinating through dashboard vars (the selection pattern), a summary fieldset above working grids, a control-panel fieldset driving a grid.
- **Dialog workflows a wizard would otherwise host**: a dashboard with `outParams` gets a code-generated `$shell.<Module>.open<referenceName>Dialog(...) => Promise<outParams>` opener — free layout, collapsible sections and a live summary, with a simpler contract than a wizard.

### Dashboard vs adjacent types

| Need | Type |
|---|---|
| Several coordinated panels, side-by-side grids, live summary over a selection | **dashboard** |
| An ordered sequence of steps where later steps depend on earlier ones | **wizard** — [wizards.md](../../wizard-creator/references/wizards.md) |
| Filter bar plus a tab strip of lists | **hub** — [hubs.md](../../hub-creator/references/hubs.md) |
| Plain transient input, validate-then-confirm | **form** — [forms.md](../../form-creator/references/forms.md) |
| Single-entity view/edit | **editor** |

A dashboard has no step model; a wizard has no free layout or collapsible panels. When a wizard exists only to host one selection grid plus a confirm, a dialog dashboard is the better host (see [Replacing a wizard](#replacing-a-wizard)).

A shell menu item can also target a dashboard directly as a full view (`viewType: "dashboard"` — validate-accepts the value; `_TODO_ (runtime unverified)` whether it renders correctly end-to-end). See [`shell-editor/references/shell.md`](../../shell-editor/references/shell.md).

## File Location & Naming

The dashboard lives on the branch (authored via the dxs CLI round-trip); the file name is a naming convention only.

- File name: `<referenceName>-dashboard.json`; suffix **`-dashboard.json`**.
- `configurationTypeId`: **35**; CLI type argument: **`dashboard`**.
- `referenceName`: snake_case ending in **`_dashboard`** ([naming-conventions](../../datex-studio-conventions/naming-conventions.md)). Every dashboard observed in production carries the suffix; treat a name without it as legacy and rename only after impact analysis.
- `title`: user-facing, sentence case, distinct from `referenceName`.
- `description`: non-empty, ≤100 chars. Defaults per [defaults.md](../../datex-studio-conventions/defaults.md).

## CLI / Transport

`dashboard` is a registered `dxs configuration` type from dxs 0.5.8. Use the standard round-trip in [configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md):

```bash
dxs configuration get dashboard <configId> -b <branchId> -O envelope.json   # numeric id → body included
jq .json envelope.json > body.json        # with `-O json` stdout instead: jq .configuration.json
dxs configuration validate dashboard -b <branchId> -D body.json             # exit 1 = findings
dxs configuration upsert dashboard -b <branchId> -D body.json
dxs -O json configuration contexts dashboard -b <branchId> -D body.json     # read the dashboardContext
```

Status: `get`, `validate`, `contexts` and `upsert` (create path — a net-new, not-yet-existing `referenceName`) verified live.

**What component validate catches** (verified live): it typechecks every flow against the generated `IDashboard` (bad property paths such as `$dashboard.sections.<row>.fieldsets`, `$datasources.<Module>.<ds>` signatures and result-shape field access) and lints structure (`Section '<ref>' is empty; add at least one tab, widget, or fieldset`). **What it does not catch** (verified live): a wrong embed `moduleId`, a dropped `configParameters` entry, a stray `filters` key, and a `""` (instead of `"''"`) in a TS-expression slot all validate clean. Embed-contract breaks surface at `dxs source branch validate` (`Outdated contract. Missing input parameter <id>` verified; the wrong-`moduleId` message is `_TODO_`).

**Locks.** `upsert` acquires the source-control lock for registered types. On the raw routes it never ran: a branch that only *inherited* the dashboard returned 400 `Cannot update configuration that is not locked or marked for deletion` until the lock was taken explicitly. Confirmed live: a net-new owned dashboard upserts (POST, no lock needed — nothing to lock yet). `_TODO_ (runtime unverified)`: the validation branch used for this check had no inherited dashboard to test against, so whether `upsert` takes the lock on an *inherited* dashboard before PUT remains unconfirmed.

**Raw-route fallback (older CLIs without the `dashboard` type).** `GET|PUT /applications/<branchId>/dashboardconfigurations/<id>`, `POST /applications/<branchId>/dashboardconfigurations` (create, `id: null`), plus `…/validate` and `…/contexts`, through `dxs api`. Every write takes the **inner body only** — the envelope silently wipes the dashboard (the trap in [configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md)) — and an inherited dashboard needs `POST /sourcecontrol/<branchId>/config/<referenceName>/lock` before the first PUT.

## Minimal Valid Skeleton

A dialog dashboard with one context fieldset and confirm/cancel (validated clean with `dxs configuration validate dashboard`, dxs 0.5.8). Short-form authoring works: the server normalizes omitted null-valued keys and stamps flow envelopes with `configurationTypeId: 9`, `accessModifier: "public"`, `enableProgressAndCancelation: false`.

```json
{
  "icon": null,
  "sections": [
    {
      "referenceName": "row_context",
      "widthPercent": 100,
      "hasSubsections": false,
      "componentType": "fieldset",
      "fieldsets": [
        {
          "id": "context", "label": "Context", "hideTitle": false,
          "collapsible": false, "expanded": true, "info": "''",
          "fields": [
            {
              "id": "summary", "label": "Summary", "required": false, "widthType": "standard",
              "controlConfig": {
                "type": "textBox",
                "textBoxConfig": { "multiline": false, "readOnly": true, "disabled": false, "placeholder": null,
                                   "value": "''", "tooltip": "''", "uiValueChangeFlowConfig": null }
              }
            }
          ]
        }
      ],
      "tabs": null, "widgets": null, "sections": null,
      "hideHeaderOnSingleTab": null, "collapsible": false, "expanded": true, "info": "''"
    }
  ],
  "toolbar": [
    { "id": "confirm", "type": "button",
      "buttonConfig": { "label": "Confirm", "icon": null, "buttonDefaultStyleClass": "creation", "readOnly": false,
                        "disabled": false, "splitButton": false, "tooltip": "''", "buttons": [],
                        "clickFlowConfig": { "flowId": "on_confirm", "flowParameters": null } } },
    { "id": "cancel", "type": "button",
      "buttonConfig": { "label": "Cancel", "icon": null, "buttonDefaultStyleClass": null, "readOnly": false,
                        "disabled": false, "splitButton": false, "tooltip": "''", "buttons": [],
                        "clickFlowConfig": { "flowId": "on_cancel", "flowParameters": null } } }
  ],
  "flows": [
    { "configurationTypeId": 9, "start": "step1", "referenceName": "on_confirm", "title": "on_confirm", "accessModifier": "public",
      "nodes": [ { "id": "step1", "type": "step", "stepConfig": { "type": "ExecuteCodeActivity", "executeCodeConfig": {
        "code": "$dashboard.outParams.is_confirmed = true;\n$dashboard.events.outParamsChange.emit();\n$dashboard.close();\n" } } } ] },
    { "configurationTypeId": 9, "start": "step1", "referenceName": "on_cancel", "title": "on_cancel", "accessModifier": "public",
      "nodes": [ { "id": "step1", "type": "step", "stepConfig": { "type": "ExecuteCodeActivity", "executeCodeConfig": {
        "code": "$dashboard.outParams.is_confirmed = false;\n$dashboard.events.outParamsChange.emit();\n$dashboard.close();\n" } } } ] }
  ],
  "onInitFlowConfig": null,
  "configurationTypeId": 35,
  "id": null,
  "referenceName": "example_selection_dashboard",
  "title": "Example selection",
  "description": "Dialog dashboard that returns a confirmed selection to its caller.",
  "inParams": [],
  "outParams": [ { "id": "is_confirmed", "type": "boolean", "isCollection": false } ],
  "vars": [],
  "accessModifier": "public"
}
```

A **tab leaf** embedding a grid (the shape of most production sections):

```json
{ "referenceName": "section_selected", "widthPercent": 50, "hasSubsections": false, "componentType": "tab",
  "hideHeaderOnSingleTab": true, "collapsible": true, "expanded": false, "info": "''",
  "tabs": [ { "id": "selected", "title": "Selected", "contentType": "grid", "isActive": true,
              "hasSubtabs": null, "tabs": null,
              "contentConfig": { "configId": "<grid_ref>", "moduleId": "<GridPackage>",
                                 "configParameters": [ /* one per grid inParam */ ],
                                 "configEvents": [ /* one per grid event */ ],
                                 "configOutParameters": null } } ],
  "widgets": null, "fieldsets": null, "sections": null }
```

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `sections` | The section tree | Recursive; see [Section Model](#section-model). Every leaf non-empty. |
| `toolbar` | Dashboard toolbar | Canonical toolbar-item shape (same as a grid's `topToolbar`). `[]` when none. |
| `flows` | Embedded flows | Function-envelope shape (`configurationTypeId: 9`); each is also callable as `$dashboard.<flowRef>()`. |
| `onInitFlowConfig` | Init hook | `{ "flowId": "on_init" }` or `null`. |
| `onCustomizationInitFlowConfig` (+`…ExecutionBehaviorType`) | Tailoring init seam | Usually `null`. |
| `onIntervalFlowConfig` + `intervalSeconds` | Polling hook | Usually `null`. |
| `inParams` / `outParams` / `vars` / `events` | Contract and state | `outParams` makes the dialog opener return them; object vars/params use inline `objectTypeDef`. |
| `baseConfiguration` | Tailoring base | `null` for an original component. |
| `configurationTypeId` | Type | `35`. |
| `id`, `referenceName`, `title`, `description`, `icon` | Identity | `id: null` on create; `description` ≤100 chars. |
| `accessModifier` | Visibility | `"public"`. |

**No `filters[]`.** Unlike a hub, a dashboard has no filter bar: the generated `IDashboard` has no `filters` member, and a stray `filters` key validates clean but does nothing. Surface filter context through fieldset fields (selectBox / numberBox / checkBox) and bind their values, usually via vars, into the embeds' `configParameters` — see [Control-panel fieldset](#control-panel-fieldset-filter-context).

## Section Model

`sections[]` is a **recursive row tree**. Every node:

| Key | Meaning |
|---|---|
| `referenceName` | Section id; becomes `$dashboard.sections.<id>`. |
| `hasSubsections` | `true` → container: `sections[]` holds children whose `widthPercent` split the row (50/50 side-by-side, 33/33/34 three columns); `componentType` null. `false` → leaf. |
| `componentType` | Leaf discriminator: `"tab"` → `tabs[]`, `"fieldset"` → `fieldsets[]`, `"widget"` → `widgets[]`. The other two arrays are `null`. |
| `collapsible` / `expanded` | **Built-in collapse.** `collapsible: true, expanded: false` = collapsed by default. Works on 50%-width columns and on container rows. Replaces any imperative show/hide scaffolding (vars + toggle flows + init hiding). |
| `hideHeaderOnSingleTab` | `true` renders a single-tab section as a plain panel (no tab strip). |
| `info` | Help-text slot — a TS-expression string: encode empty as `"''"`, never `""` ([file-format](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions)). |

- **Empty sections fail validation** — every leaf must carry at least one tab, widget, or fieldset. Delete placeholders.
- **Fieldsets** take the form fieldset shape (`id`, `label`, `hideTitle`, `collapsible`, `expanded`, `info`, `fields[]` with the `controlConfig` discriminator; sibling `*Config` keys null). Field `value`/`tooltip` are TS-expression slots. See [forms.md](../../form-creator/references/forms.md) and [control-types](../../datex-studio-runtime/control-types.md).
- **Tab embedding**: `contentType: "grid"` + `contentConfig { configId, moduleId, configParameters[], configEvents[], configOutParameters }`. Each `configParameters` entry duplicates the callee's **full param descriptor** under `parameter` with the binding TS-expression under `value` (`"$dashboard.inParams.x"`, `"$dashboard.vars.y"`, `"false"`, `""` for unbound). `configEvents` entries mirror the grid's `events[]` under `eventConfig` with `flowConfig: { flowId } | null`.
- **Object-collection params flow through `configParameters`**: a dashboard var `object[]` with inline `objectTypeDef` bound to a grid inParam `object[]` with a matching typedef validates clean. Inline typedefs on both sides — UI components cannot use custom `$types`.
- **Widget sections**: no production dashboard uses `componentType: "widget"` (every one observed is tab or fieldset; `widgets[]` always `null`). The widget instance shape inside `widgets[]` is `{id: "widget<N>", widgetConfig: {configId, moduleId, ...}}` — the id is generated by the designer, unique among the dashboard's widgets and other ids, and `widgetConfig` starts `null` until a widget is picked; the widgets designer defaults `maxWidgets` to 4 (captured from the Studio designer, dxs 0.5.8; shape inferred from its add flow, extra `widgetConfig` keys such as `configParameters` not listed, and no production dashboard uses it, so `_TODO_ (runtime unverified)`); the nearest known shape is the hub/editor `widgetConfig` contract documented at [widgets.md → Invocation Contract](../../widget-creator/references/widgets.md#invocation-contract) (mirrored by the hub's `WidgetDesignerReferenceConfig`, see [hubs.md](../../hub-creator/references/hubs.md)) — treat that as the working assumption until a dashboard widget section is captured.

## Runtime Globals

`$dashboard` — from the generated `dashboardContext` (fetch it per body with `dxs configuration contexts dashboard`; verified live, dxs 0.5.8):

```ts
interface IDashboardSection { hidden: boolean; width: number; expanded: boolean; toggle(); }
interface IDashboard {
  title: string;
  inParams: {…}; outParams: {…}; vars: {…};
  events: { outParamsChange: { emit: () => void } };
  sections:  { <row>: IDashboardSection & { sections: { <child>: IDashboardSection } } };
  tabs:      { <tabId>: ITabItemModel };            // flattened by tab id
  widgets:   { … };                                  // flattened
  fieldsets: { <fieldsetId>: IFieldsetModel };       // flattened — NOT under sections
  fields:    { <fieldId>: IFieldModel<…> };          // flattened, form-style
  toolbar:   { <btnId>: IToolModel<IButtonModel> };
  <flowRef>(event?: any): Promise<any>;              // sibling flows callable as methods
  refresh();
  close();                                           // closes the hosting dialog
}
```

- **Fieldset fields are flattened**: `$dashboard.fields.<id>.control.value = …`. The `$dashboard.sections.<row>.fieldsets…` path does not exist (`Property 'fieldsets' does not exist on type 'IDashboardSection'`).
- Imperative section state: `$dashboard.sections.<row>.hidden` / `.expanded` / `.toggle()`.
- Toolbar gating: `$dashboard.toolbar.<id>.control.readOnly = …`.
- Event-handler flows receive the payload as bare **`$event`** (no declared inParams).
- Flow code may call `$datasources.<Module>.<ds>.get/getList(...)` (UI tier; [calling-conventions](../../datex-studio-runtime/calling-conventions.md)). Same-named datasources in different modules can have **different signatures** — never assume; validate typechecks the exact copy you reference.
- Flow-code strings round-trip from Studio with **CRLF** line endings — make any scripted multi-line match CRLF-aware.

## Invocation Contract

Declaring `outParams` makes the platform codegen, for every component in scope:

```ts
$shell.<Module>.open<referenceName>Dialog(
    inParams: {…}, mode?: 'modal' | 'flyout', size?: EModalSize
) => Promise<{ …outParams… }>
// enum EModalSize { Small = 1, Standard, Large, Xlarge }
// plus navigation: $shell.<Module>.open<referenceName>(inParams, replaceCurrentView?: boolean)
```

The method name keeps the snake_case `referenceName`; `<Module>` is the **dashboard's** package. Side-by-side selection dashboards need the width — open them `open<name>Dialog({…}, 'modal', EModalSize.Xlarge)`. A dashboard with no `outParams` is opened as a navigation view.

**Confirm/cancel** (the form rule — never truthy-check data fields to detect cancel): `is_confirmed: boolean` in outParams; `on_confirm` sets outParams → `$dashboard.events.outParamsChange.emit()` → `$dashboard.close()`; `on_cancel` sets `is_confirmed = false` → emit → close. Gate the confirm button on a valid, non-empty selection. Confirmed in Preview (verified live): `close()` resolves the caller's Promise with the populated outParams, for both confirm and cancel.

**Init-resolved state is dialog-scoped.** Anything resolved in `on_init` from inParams (config flags, display names) is fixed for the dialog's lifetime — grid refreshes re-query rows but never re-run dashboard init, so an external config change applies only on close-and-reopen. Surface such state in the context header (e.g. "Inactive inventory: Allowed") so a stale-looking result explains itself.

**Embeds** follow [component-wiring](../../component-wiring-check/references/component-wiring.md): the **target's** `moduleId`, a one-for-one `configParameters` mirror of the target's `inParams`, declared vars for every binding.

### Preview-confirmed behaviours

Confirmed in Preview (verified live): the dialog round-trip above; built-in collapse on a 50%-width side-by-side column; rebinding a var bound into `configParameters` auto-refreshes the embedded grids; imperative `$dashboard.fields.<id>.control.value` writes update live; the `` Id in ${$utils.odata.formatNumberArray(ids ?? [])} `` empty-set filter renders an empty grid (no 400). `_TODO_ (runtime unverified)`: whether a collapsed section's grid fires its datasource before it is expanded.

## Common Patterns

### Dual-grid selection (available vs selected)

One **dual-mode grid** embedded twice — the available section and a selected section beside it.

- The grid declares an **optional** `is_selected_mode: boolean` plus selection params (e.g. `selected_ids`, `exclude_ids`). The available embed binds `is_selected_mode` to `"false"` and `exclude_ids` to the selection var; the selected embed binds `"true"` and `selected_ids`. **Unbound (legacy host) ⇒ legacy context**: `!$utils.isDefined($grid.inParams.is_selected_mode)` hides dashboard-only toolbar buttons in wizards and hubs that also embed the grid.
- The grid datasource branches per mode via filter `condition`s: availability/context filters behind `!is_selected_mode`; the selected mode applies `` `Id in ${$utils.odata.formatNumberArray($datasource.inParams.selected_ids ?? [])}` `` under condition `$utils.isDefined($datasource.inParams.selected_ids) || $datasource.inParams.is_selected_mode` — the `?? []` renders the selected grid **empty** when nothing is selected instead of unfiltered.
- The grid emits `on_add_…` / `on_remove_…` events with **object[] snapshot payloads** carrying every field the summary needs (weights, quantities) so totals never re-query; dashboard handlers merge/filter a `selected_…` var; rebinding the var refreshes both embeds.
- **Snapshot vars over id arrays** when rows carry data; derive the id array alongside for the datasource params.
- Selected section: `collapsible: true, expanded: false`.
- **Reconcile, don't accumulate.** Each embed is an independent grid instance, so a removal in the other instance leaves stale local state. In dashboard context, rebuild grid-local bookkeeping (outParams, tracking vars) from the bound selection param on every `on_data_loaded`, clear cells for de-selected tuples, and gate legacy wizard-session persistence blocks to wizard context. Stale local state re-rendered by restore blocks is the classic "removed line still shows its quantity" bug.

### Context/summary fieldset header

Read-only textBox fields (warehouse, project, counts, totals) driven imperatively by an `update_summary` flow called from `on_init` and every add/remove handler:

```ts
$dashboard.fields.selected_count.control.value = count;
$dashboard.toolbar.confirm.control.readOnly = count === 0;
```

Resolve display names once in `on_init`, inside try/catch with an id fallback — a lookup failure must never break init.

### Control-panel fieldset (filter context)

Because there is no `filters[]`, a navigation dashboard puts its filter context in a row of fieldset columns (e.g. three sections at 33/33/34, the row `collapsible`) holding selectBox / numberBox / checkBox fields. An edit-mode field's `uiValueChangeFlowConfig` runs a flow that recomputes a var; the var is bound into the grid's `configParameters`, so the grid refreshes on rebind. Reassign the var only when its value actually changed, to avoid redundant refreshes.

### Quantity-grain selection (page-batched netting)

For inventory that can be **partially** allocated (lots, license plates), an existence predicate can't express availability.

- Keep the fast OData primary rows-source; add **owned enrichment datasources** — the availability view (`InventoryBy…` selecting the available and soft-allocated amounts), open unallocated outbound demand over `OrderLines` (pre-processing order statuses and outbound order class; codes in footprint-status-codes.md (see the `footprint-entity-expert` skill\'s status-codes reference)), unit weights over `MaterialsPackagingsLookup`.
- `on_data_loaded` calls them via `$grid.datasources.<ref>.getList({...page keys})`, computes `net = Σ Available − Σ SoftAllocated − demand − in-session qty` per tuple, writes the available cell, grays/blocks exhausted rows (`row.vars.is_excluded` + `styles.setPlannedClass()`), stashes unit weights in rowVars.
- **Quantity entry is the selection**: no add/remove toolbar; the grid emits upsert/remove events and the dashboard merges by tuple key. The selected view is the same grid, server-filtered by ids.
- **Build only on events that actually fire.** `uiValueChangeFlowConfig` on a **display-mode** grid control typechecks and validates but never fires at runtime (known platform issue). Reliable primitives: `onCellClickFlowConfig` (click the available cell = take full available), toolbar `clickFlowConfig` (a selection-gated "Take available" bulk fill with ONE batched emit), row selection, and row edit mode (`onSaveExistingRowFlowConfig`) for partial quantities. Clamp over-entry to `net + sessionQty`; keep displayControl and editControl values in sync at every write site.
- **`$grid.selection` is not runtime-writable** (`Property 'selection' does not exist on type 'IGrid'`) — set `selection: true` statically (the checkbox column then shows in every host) and scope behavior with mode-gated toolbar buttons. `$grid.filters.<id>.hidden` is writable.
- **Hide-unavailable toggle: server-side or not at all** — client-side row splicing visibly underfills pages. When a same-grain availability view exists (identical keys and navs), make it the primary entity and bind a checkBox filter through `configParameters` to a ds filter like `AvailablePackagedAmount gt SoftAllocatedPackagedAmount`; bound filter params refresh the grid natively.
- **Units trap**: the `InventoryBy*` views carry base-unit (`AvailableAmount`) and packaged-unit (`AvailablePackagedAmount`) columns. Quantity entry, `OrderLine.PackagedAmount` demand and on-hand displays are packaged units — netting math must use the `*PackagedAmount` variants. The mix-up is invisible on 1:1 packagings.
- **Do not double-subtract**: available amounts already net hard allocations; soft allocation is separate; demand counts only pre-processing orders.
- **Allow-inactive variants**: when the order class allows inactive inventory, availability is available plus inactive (OData filter arithmetic works: `(AvailablePackagedAmount add InactivePackagedAmount) gt SoftAllocatedPackagedAmount`); resolve the flag once in `on_init` and pass it down.
- **Upsert handlers merge over the previous tuple**, not replace it — selected-view edits run without enrichment rowVars, so their snapshots carry undefined weights; carry prior fields forward for any undefined incoming field.
- **Display the splitting key**: if the rows entity splits by a key (e.g. packaging), show that key as a column.
- Whole-unit variants (composite license plates): qualify only if every child content row has `Available == Total > 0`, no soft allocation, and no open demand bound to the parent; a checkbox column's `onCellClickFlowConfig` toggle emits all child tuples at once.

### Cross-module and cloning traps

- **Ownership**: a grid fetched through your branch may belong to another module — check the envelope's `application.referenceName`. Upserting it cross-module fails (`DomainObjectNotFoundException`). Either work on the owning module's branch (then publish and bump the reference) or clone into your module under a NEW `referenceName` and leave the original and its hosts untouched.
- **Enrichment clones**: when cloning a datasource body as an enrichment template, null both `customColumns` and `linkedDatasources` — stale custom-column code typechecks against the new typedefs and fails (`Property … does not exist on type 'ICCEntity'`).

### Replacing a wizard

Keep the callee grid's wizard contract intact (additive retrofit), give the dashboard the wizard's inParams (preserve `custom_input` tailoring seams verbatim), and return the wizard's result shape via outParams (snake_case; one snake→camel map at the caller). **After adding inParams to a shared grid, sweep every host that embeds it** — wizards, hubs and dashboards each need mirrored `configParameters` entries (value `""` when unbound), or the branch fails with `Outdated contract. Missing input parameter <id>`. That surfaces **only at `dxs source branch validate`**, never at the grid's or dashboard's own validate; find the hosts server-side with the `impact-analysis` skill.

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| `Section '<ref>' is empty; add at least one tab, widget, or fieldset` | Placeholder leaf | Delete it or give it content. |
| `Property 'fieldsets' does not exist on type 'IDashboardSection'` | Field reached through its section | `$dashboard.fields.<id>`. |
| Filter bar never appears | `filters[]` added (validates, ignored) | Fieldset fields bound into the embeds. |
| `Outdated contract. Missing input parameter <id>` at branch validate | A shared grid gained inParams; a host was not swept | Mirror the param into every host (`""` when unbound). |
| Caller treats cancel as an empty confirm | Cancel detected by truthy-checking data | `is_confirmed` outParam set on both paths. |
| Caller's Promise resolves with stale/undefined outParams | `close()` called before `outParamsChange.emit()` | Set → emit → close. |
| Removed selection still shows its quantity | Grid-local state accumulated across instances | Rebuild from the bound param every `on_data_loaded`. |
| Dashboard saved empty after a push | Envelope upserted instead of inner body | `jq .json envelope.json > body.json`; re-push the last good body. |
| 400 `Cannot update configuration that is not locked…` | Raw-route write on an inherited dashboard | Use `upsert dashboard`, or lock first on the raw route. |

## Pre-Flight Checklist

1. `description` non-empty ≤100 chars; `title` sentence case; `accessModifier` set; `configurationTypeId: 35`; `referenceName` ends `_dashboard`. Plus the [universal checklist](../../datex-studio-conventions/universal-checklist.md).
2. No empty sections; every leaf's `componentType` matches its one populated array.
3. All TS-expression slots encoded (`info`/`tooltip`/`value`: `"''"`, not `""` — validate will not catch it).
4. Every embed: `moduleId` = the **target's** package; `configParameters` mirror the target's `inParams` one-for-one (unbound = `""`); `configEvents` mirror the target's events; a handler flow exists for every wired `flowConfig.flowId`. Component validate does not check this — audit with `component-wiring-check`.
5. Every `$dashboard.vars.<id>` written in flow code is declared (inline `objectTypeDef` for objects).
6. No `filters[]`; filter context is in fieldset fields.
7. Dialog dashboards: `is_confirmed` outParam; confirm/cancel emit `outParamsChange` before `close()`; confirm gated on valid state.
8. `dxs configuration validate dashboard` clean before `dxs configuration upsert dashboard`; the inner body is pushed, never the envelope.
9. If a shared grid gained inParams: every other host mirrors them; `dxs source branch validate` clean.
10. Dual-mode grids: mode param optional; dashboard-only toolbar hidden when it is unbound.

## Cross-References

- [grids.md](../../grid-creator/references/grids.md) — the embedded content type; its dynamic-filter wiring rule applies to any grid retrofitted for a dashboard.
- [widgets.md](../../widget-creator/references/widgets.md) — widget authoring and the host contract a widget section follows.
- [wizards.md](../../wizard-creator/references/wizards.md) — the stepped dialog alternative; the hosts most often swept after a shared-grid change.
- [forms.md](../../form-creator/references/forms.md) — fieldset/field shape and the confirm/cancel dialog rule.
- [hubs.md](../../hub-creator/references/hubs.md) — the filter-bar container; `WidgetDesignerReferenceConfig`.
- [component-wiring.md](../../component-wiring-check/references/component-wiring.md) — the `configParameters`/`moduleId`/vars contract rules the embeds follow.
- [configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md) — round-trip, validate exit codes, silent-wipe guard.
- [file-format.md](../../datex-studio-conventions/file-format.md) — cti 35 / `dashboard` row; TS-expression encoding.
