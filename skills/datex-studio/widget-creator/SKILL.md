---
name: widget-creator
description: |
  Use when authoring or modifying a Datex Studio widget (configurationTypeId=8,
  *-widget.json suffix, CLI type `widget`) on a branch — the at-a-glance tile
  (big number, pie chart, or image) embedded in a hub's or editor's `widgets[]`
  strip. Owns the type decision (fatNumber / apexPieChart / image) and the
  block-name trap (`apexPieChart` → `pieChartConfig`; a wrong block surfaces only
  as a nameless DXS-API-500), the rows-source rule (standalone datasource
  reference only, single result for a number, collection for a pie), the host
  embedding contract, the boolean `refresh` inParam idiom, and threshold styling
  via `$widget.styles` in on_data_loaded. Triggers: "create a widget", "add a KPI
  tile to the hub", "add a pie chart of X by status", "$widget.entity",
  "$slice.entity", "Object reference not set to an instance of an object on
  validate widget", "cannot be used by a large number widget", "widget never
  changes colour".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - datasource-creator
  - hub-creator
  - editor-creator
  - dashboard-creator
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
---
# Widget Creator

Author or modify a Datex Studio widget (configurationTypeId=8) on a branch — a small summary tile hosted in a hub's or editor's `widgets[]` array. A widget binds one value expression to the result of a **standalone** datasource (or to its own `inParams`), renders it as a big number (`fatNumber`), a pie (`apexPieChart`), or an image (`image`), and can colour itself in a lifecycle flow. It has no toolbar, fields, events, or click flow, and nothing opens it as a dialog.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/widgets.md](references/widgets.md) — Authoritative widget reference: designer types and config blocks, skeletons, rows-source rule, `IWidget`/`ISlice` runtime surface, host contract, refresh idiom, styling, failure modes, pre-flight checklist
- [../datasource-creator/references/datasources.md](../datasource-creator/references/datasources.md) — standalone vs owned datasources (widgets can only reference a standalone one)
- [../hub-creator/references/hubs.md](../hub-creator/references/hubs.md) / [../editor-creator/references/editors.md](../editor-creator/references/editors.md) — the two production hosts
- [../dashboard-creator/references/dashboards.md](../dashboard-creator/references/dashboards.md#section-model) — models a widget section; unused in production
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and the TypeScript-expression encoding rule (applies to `fatNumberConfig.value`, `pieChartConfig.label`/`value`, `imageConfig.value`)
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_widget` suffix, snake_case ids, display-name rule for `title`
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — UI-tier globals available in widget flows
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — `moduleId`, `configParameters`, declared-vars rules for widget→datasource and host→widget

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`datasource-creator`** skill — invoked to author the standalone datasource **before** the widget (single-result for a number, collection for a pie)
- **`hub-creator`** / **`editor-creator`** skills — invoked to add the widget to its host's `widgets[]` (and the host's refresh var)
- **`dashboard-creator`** skill — consulted only if the user insists on a dashboard host; the widget section is modelled but has no production instance
- **`component-wiring-check`** skill — invoked to audit the widget→datasource and host→widget contracts before push

## CLI Lifecycle

Widget authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs widget` subcommand and no field-level patching; build (or fetch + extract) the whole JSON body, edit it, push it back. The CLI type is **`widget`** (lowercase), mapping to `configurationTypeId: 8`.

**Create a new widget:**

```bash
# 0. The standalone datasource must already exist on the branch (datasource-creator)
# 1. Build body.json from references/widgets.md → Minimal Valid Skeleton
# 2. Validate — gates the push; exit 1 = errors found, not a broken CLI.
#    Catches cardinality mismatches, contract drift, and TS errors in value/label bindings
dxs configuration validate widget -b <branchId> -D body.json
# 3. Create (upsert creates or updates by referenceName)
dxs configuration upsert widget -b <branchId> -D body.json
```

**Edit an existing widget:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get widget <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate widget -b <branchId> -D body.json
# 5. Push
dxs configuration upsert widget -b <branchId> -D body.json
```

To see the exact `IWidget` / `ISlice` typing for a body (read-only, no validation), run `dxs -O json configuration contexts widget -b <branchId> -D body.json` and project `.configuration_contexts.designerContexts[] | select(.id=="widgetContext") | .text` — never print the multi-megabyte `appContext`.

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. Always `jq .json envelope.json > body.json` before editing. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: Type decision]
  one figure (count, total, %)          -> fatNumber    (block fatNumberConfig)
  share of a whole by category          -> apexPieChart (block pieChartConfig!)
  a picture / generated image           -> image        (block imageConfig)
  rows, buttons, click target, bespoke  -> not a widget (grid / card / custom Angular)
        |
[Phase 3: Rows source]
  host already holds the value -> no datasource; bind $widget.inParams.<id>
  otherwise -> standalone datasource FIRST (invoke `datasource-creator`):
     fatNumber -> single result (isCollection:false)
     apexPieChart -> collection, one row per slice
        |
[Phase 4: Author widget body]
  - type + matching <type>Config block
  - datasourceConfig: configId, datasource's moduleId,
    configParameters per ds inParam, configOutParameters = full result shape
  - value/label TS expressions over $widget.entity / $slice.entity, null-guarded
  - pie: outParams slice{entity{...result fields}}
  - styling flow (fatNumber/image only) wired via onDataLoadedFlowConfig
  - inParams incl. boolean `refresh` if the host must reload it
        |
[Phase 5: Validate + push]
dxs configuration validate widget -b <branchId> -D body.json
dxs configuration upsert  widget -b <branchId> -D body.json
        |
[Phase 6: Embed in the host]  (hub-creator / editor-creator round-trip)
  widgets[] += {id, widgetConfig{configId, moduleId, configParameters,
                configOutParameters (pie), outParamsChangeFlowConfig?}}
  refresh idiom: bind `refresh` to a declared host var, flip it after mutations
  validate + upsert the host; audit via `component-wiring-check`
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 2: Type decision

`EWidgetDesignerType` has five members (`fatNumber`, `apexPieChart`, `image`, `linearGauge`, `radialGauge`; captured from the Studio designer (option lists), dxs 0.5.8). Three are observed in production, so author only these by default; the two gauges (`linearGaugeConfig` / `radialGaugeConfig`, keys `value`, `max`, `label`, plus `direction` `horizontal` | `vertical` on the linear gauge) validate clean but their rendering is `_TODO_ (runtime unverified)` — use one only on explicit request and say so. The block name is **not** always `<type>Config`: `apexPieChart` takes **`pieChartConfig`**. A missing or misnamed block makes validate return a bare `DXS-API-500 Object reference not set to an instance of an object` that names nothing — check the block first when you see it. A widget is the wrong tool when the user needs rows (grid), a click target or buttons (card — widgets have no click hook), or a chart type outside the three (custom Angular component). See [references/widgets.md → The designer types](references/widgets.md#the-designer-types).

### Phase 3: Rows source — standalone reference only

A widget **cannot own a datasource** — `isOwned: true` fails with `… this component cannot hold owned configurations`. Author the datasource first with `datasource-creator` as a standalone component, then reference it by `configId` + the **datasource's** `moduleId`. Cardinality is enforced: a collection behind a `fatNumber` fails `cannot be used by a large number widget: its result is a collection`; a single result behind a pie fails `… pie chart widget: its result is not a collection`. `configOutParameters` must mirror the datasource's result **field-for-field** — a trimmed subset fails `Outdated contract. Type mismatch for output parameters`. When the host already has the number, skip the datasource and bind `$widget.inParams.<id>`. Details: [references/widgets.md → Rows Source](references/widgets.md#rows-source-standalone-reference-only).

### Phase 4: Author widget body

Build `body.json` from [references/widgets.md → Minimal Valid Skeleton](references/widgets.md#minimal-valid-skeleton). Key points:

1. **File basics.** `configurationTypeId: 8`, suffix `-widget.json`, `referenceName` ends `_widget` and matches the filename stem, `title` a sentence-case caption. Plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)) — `description` non-empty and ≤100 chars. **Validate does not enforce `description`**; many production widgets lack it — don't copy them.
2. **Bindings are TS expressions** and are type-checked: `fatNumberConfig.value` over `$widget.entity.<field>` (only exists when a datasource is referenced), `pieChartConfig.label`/`value` over `$slice.entity.<field>`. Null-guard (`?? 0`). `prefix`/`suffix` are **plain text** (not compiled); `useAbbreviations` is a JSON boolean.
3. **`IWidget` depends on the type.** Large number: `inParams`, `vars`, `entity`, `styles: IFatNumberStyles`. Pie: `inParams` (+ `vars`) only — **no `entity`, no `styles`**. Image: `styles: IStyles`. No widget has `outParams`, `events`, or `refresh()` at runtime.
4. **Hooks.** Only `onInitFlowConfig` and `onDataLoadedFlowConfig` exist. Every flow in `flows[]` must be referenced by one of them — production carries unwired `on_init` flows that never run.
5. **Pie outParam.** Declare `outParams: [{ id: "slice", type: "object", objectTypeDef: [{ id: "entity", type: "object", objectTypeDef: <result fields> }] }]` — not enforced by validate, but it is the contract hosts mirror.

### Styling in on_data_loaded

Colour a large number by threshold in the `on_data_loaded` flow (that's when `$widget.entity` holds the result): `$widget.styles.setGoodClass()` / `setMediumClass()` / `setBadClass()` / `setKeyClass()`, or inline `setStyle('background-color', '…')` + `clearStyle()`. **Always call with parentheses** — `$widget.styles.setMediumClass;` compiles, validates clean, and silently does nothing (a live production defect). Datasource-less widgets style in `on_init` from `$widget.inParams`. Pies cannot be styled. Pattern: [references/widgets.md → Threshold styling](references/widgets.md#threshold-styling-in-on_data_loaded).

### Phase 6: Embed in the host

Hubs (40 in production) and editors (19) carry a top-level `widgets[]`:

```json
{ "id": "open_orders",
  "widgetConfig": { "configParameters": [ { "parameter": { "id": "warehouse_id", "required": false, "type": "number", "isCollection": false, "isSecured": false },
                                            "value": "$hub.filters.warehouse.control.value" } ],
                    "configId": "open_orders_count_widget", "moduleId": "<widget's package>" } }
```

Host validate catches a missing inParam (`Outdated contract. Missing input parameter <id>`), a wrong `moduleId` (`Invalid contract. Referenced configuration … does not exist`), and a missing `configOutParameters` mirror for a pie's `slice` (`Type mismatch for output parameters`). It does **not** check `outParamsChangeFlowConfig.flowId` — confirm the host flow exists by name. The host's only runtime handle is `$hub.widgets.<id>.hidden` / `$editor.widgets.<id>.hidden`; there is no `refresh()`, hence the **refresh idiom**: the widget declares a boolean `refresh` inParam it never reads, the host binds it to a declared host var (`$hub.vars.refresh_control`) and flips it after a mutation (`$hub.vars.refresh_control = !$hub.vars.refresh_control;`). Reload-on-inParam-change is inferred from production use — `_TODO_ (runtime unverified)`. No production dashboard hosts a widget. See [references/widgets.md → Invocation Contract](references/widgets.md#invocation-contract) and [→ Refresh idiom](references/widgets.md#refresh-idiom-host-driven-reload).

## Pre-Flight Checklist

Walk the full checklist in [references/widgets.md → Pre-Flight Checklist](references/widgets.md#pre-flight-checklist). The fast version:

1. **File basics.** `configurationTypeId: 8`, suffix `-widget.json`, `referenceName` ends `_widget` and matches the stem, `title` a sentence-case caption ≠ `referenceName` — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)); `description` non-empty ≤100 chars.
2. **Type ↔ block.** `fatNumber`→`fatNumberConfig`, `apexPieChart`→`pieChartConfig`, `image`→`imageConfig`, `linearGauge`→`linearGaugeConfig`, `radialGauge`→`radialGaugeConfig` (the gauges are validate-clean but runtime-unverified).
3. **Standalone datasource** referenced by `configId` + its own `moduleId`; no `isOwned`; single result for a number, collection for a pie; `configOutParameters` mirror the full result.
4. **Bindings** null-guarded TS expressions over `$widget.entity` / `$slice.entity`; `prefix`/`suffix` plain text.
5. **Every flow wired** to `onInitFlowConfig` or `onDataLoadedFlowConfig`; every `set*Class()` has `()`; no styling on pies.
6. **Pie** declares the `slice` outParam; no other type declares outParams; no events/click flows.
7. **Host** `widgets[]` entry mirrors every inParam (and `slice` for pies), uses the widget's `moduleId`, declares any refresh var; host validated.
8. **Validate clean** — `dxs configuration validate widget -b <branchId> -D body.json` before upsert.

## Common Mistakes

The authoritative symptom → cause → fix table is in [references/widgets.md → Common Failure Modes](references/widgets.md#common-failure-modes). The gotchas that bite most often:

- **`apexPieChartConfig` (or no block)** — validate answers with a nameless `DXS-API-500 Object reference not set…`; the pie's block is `pieChartConfig`.
- **An owned/embedded datasource** — widgets can only reference a standalone one.
- **Wrong cardinality** — collection behind a number, single row behind a pie.
- **Trimmed `configOutParameters`** — mirror the datasource's full result shape.
- **`$widget.styles.setMediumClass;`** without `()` — validates clean, does nothing.
- **Styling a pie or reading `$widget.entity` on a pie** — neither exists on the pie's `IWidget`.
- **A flow in `flows[]` with no hook pointing at it** — never runs.
- **Host `outParamsChangeFlowConfig.flowId` typo** — validate won't catch it.
- **Missing `description`** — validate passes, convention fails.
- **Upserting the envelope instead of the inner `.json`** — silently destroys config content.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
