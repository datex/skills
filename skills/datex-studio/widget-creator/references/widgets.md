# Widgets — Authoring Reference

Authoritative reference for Datex Studio **widget** components (`configurationTypeId: 8`, CLI type `widget`, `-widget.json` suffix). A widget is a small at-a-glance tile — one big number, a pie chart, or an image — embedded in a hub's or an editor's widget strip. It has no toolbar, no fields, and no events: it binds one value expression to the result of a **standalone** datasource (or to its own `inParams`) and optionally colours itself in a lifecycle flow. Widgets are always hosted; nothing opens them as a dialog. Peer docs: [hubs.md](../../hub-creator/references/hubs.md) and [editors.md](../../editor-creator/references/editors.md) (the hosts), [datasources.md](../../datasource-creator/references/datasources.md) (the rows source), [dashboards.md](../../dashboard-creator/references/dashboards.md#section-model) (a modelled but unused host). Cross-cutting rules: [file-format.md](../../datex-studio-conventions/file-format.md), [naming-conventions.md](../../datex-studio-conventions/naming-conventions.md), [defaults.md](../../datex-studio-conventions/defaults.md), [runtime-globals.md](../../datex-studio-runtime/runtime-globals.md), [calling-conventions.md](../../datex-studio-runtime/calling-conventions.md).

> Provenance: distilled from the full population of production widgets (146 bodies) and the generated designer contexts; validation behaviour below was verified live with dxs 0.5.8.

## Purpose & When to Use

Pick a **widget** for a single summary figure or a small categorical breakdown shown above a hub's tabs or inside an editor — "open orders today", "shorted units", "tasks by status". Pick something else when:

- the user needs rows, sorting, or row actions → a grid ([grid-creator](../../grid-creator/SKILL.md));
- the tile needs buttons, a header, or a click target → a card ([card-creator](../../card-creator/SKILL.md)); widgets expose no click hook (the pie's slice outParam is the only outbound signal);
- the visual is bespoke (bar/line charts, custom layout; the two built-in gauge types are runtime-unverified) → a custom Angular component ([custom-angular-component-creator](../../custom-angular-component-creator/SKILL.md)); the widget designer types are fixed.

### The designer types

`type` is the server enum `EWidgetDesignerType`. Each type has exactly one sibling config block, and **the block name does not always follow the type name**:

| `type` | Config block | Block keys | Rows source | Production count |
|---|---|---|---|---|
| `fatNumber` | `fatNumberConfig` | `value`, `useAbbreviations`, `prefix?`, `suffix?` | single-result datasource, or `inParams`/`vars` | 130 |
| `apexPieChart` | **`pieChartConfig`** (not `apexPieChartConfig`) | `label`, `value` | collection datasource | 15 |
| `image` | `imageConfig` | `value`, `width`, `height` | `vars` set in `on_init` (no datasource observed) | 1 |
| `linearGauge` | `linearGaugeConfig` | `value`, `max`, `label`, `direction?` | datasource (the designer lists a linear-gauge datasource use case) | 0 |
| `radialGauge` | `radialGaugeConfig` | `value`, `max`, `label` | datasource (the designer lists a radial-gauge datasource use case) | 0 |

`EWidgetDesignerType` has exactly five members: `fatNumber`, `apexPieChart`, `image`, `linearGauge`, `radialGauge` (the designer's Type dropdown labels them Large number, Pie chart, Image, Linear Gauge, Radial Gauge); captured from the Studio designer (option lists), dxs 0.5.8. Validate names the enum on a bad value (`Error converting value "gauge" to type '...EWidgetDesignerType'`) but never lists members.

**Gauges.** `validate` accepts both gauge types with their config block and fails a gauge with no block with the bare `DXS-API-500` described under Common Failure Modes. `value`, `max` and `label` are TypeScript expressions (a bare word fails `Cannot find name '<word>'`, so a literal label is `"'Load'"`); a missing `value` fails `Data assignments Value is required`. Only the linear gauge has a `direction`, enum `horizontal` | `vertical` (anything else fails `Error converting value ... ELinearGaugeWidgetDirection`); on `radialGaugeConfig` a `direction` key is silently dropped. Probing found no `min` key: a `min` entry validates clean but is silently dropped like any unknown key. `_TODO_ (runtime unverified)`: how a gauge renders, whether a minimum exists, and which expression the datasource row feeds — no production widget uses either gauge type. Author a gauge only when the user asks for one, and tell them it is unverified at runtime; the production-proven members are `fatNumber`, `apexPieChart` and `image`.

The server's own error text calls a `fatNumber` a **"large number widget"** and an `apexPieChart` a **"pie chart widget"** — recognise those names in validate output.

## File Location & Naming

The widget lives on the branch (authored via the dxs CLI round-trip); the file name is a naming convention only.

- File name: `<referenceName>-widget.json`; suffix `-widget.json`.
- `configurationTypeId: 8`; CLI type argument `widget`.
- `referenceName` is snake_case and **ends in `_widget`** (16 production widgets lack the suffix — legacy, do not copy). Provenance prefix (`custom_` / `tailored_`) per [naming-conventions.md](../../datex-studio-conventions/naming-conventions.md#tailored-and-custom-prefixes--grid-provenance-variants).
- `title` is the caption rendered on the tile — sentence case, distinct from `referenceName` ([naming-conventions.md → Display Names](../../datex-studio-conventions/naming-conventions.md#display-names-for-user-facing-components)).
- `description` mandatory, non-empty, ≤100 chars. **Validate does not enforce it** (verified live — a body without `description` validates clean); 28 production widgets ship without one. Do not copy that.
- Param and var ids snake_case ([naming-conventions.md](../../datex-studio-conventions/naming-conventions.md#parameter-and-variable-ids-are-snake_case)); much production code uses camelCase ids — legacy.
- Package default and `accessModifier: "public"` per [defaults.md](../../datex-studio-conventions/defaults.md).

## Minimal Valid Skeleton

Key order as the platform emits it: `type, datasourceConfig, [hasTop, hasSkip], flows, onInitFlowConfig, onDataLoadedFlowConfig, <type>Config, configurationTypeId, id, referenceName, title, description, inParams, outParams, vars, accessModifier`. Omit keys you don't use.

### Large number from a standalone datasource (the common case)

```json
{
  "type": "fatNumber",
  "datasourceConfig": {
    "configParameters": [
      {
        "parameter": { "id": "warehouse_id", "required": false, "type": "number", "isCollection": false, "isSecured": false },
        "value": "$widget.inParams.warehouse_id"
      }
    ],
    "configOutParameters": [
      {
        "id": "result",
        "type": "object",
        "objectTypeDef": [
          { "id": "OpenCount", "type": "number", "isCollection": false }
        ],
        "isCollection": false
      }
    ],
    "configId": "ds_open_orders_count",
    "moduleId": "Acme"
  },
  "fatNumberConfig": {
    "value": "$widget.entity.OpenCount ?? 0",
    "useAbbreviations": false
  },
  "configurationTypeId": 8,
  "id": null,
  "referenceName": "open_orders_count_widget",
  "title": "Open orders",
  "description": "Count of open orders for the selected warehouse.",
  "inParams": [
    { "id": "warehouse_id", "required": false, "type": "number", "isCollection": false, "isSecured": false }
  ],
  "accessModifier": "public"
}
```

### Pie chart (note the block name and the `slice` outParam)

```json
{
  "type": "apexPieChart",
  "datasourceConfig": {
    "configParameters": [
      {
        "parameter": { "id": "warehouse_id", "required": false, "type": "number", "isCollection": false, "isSecured": false },
        "value": "$widget.inParams.warehouse_id"
      }
    ],
    "configOutParameters": [
      {
        "id": "result",
        "type": "object",
        "objectTypeDef": [
          { "id": "StatusName", "type": "string", "isCollection": false },
          { "id": "Count", "type": "number", "isCollection": false }
        ],
        "isCollection": true
      }
    ],
    "configId": "ds_orders_by_status",
    "moduleId": "Acme"
  },
  "pieChartConfig": {
    "label": "$slice.entity.StatusName",
    "value": "$slice.entity.Count ?? 0"
  },
  "configurationTypeId": 8,
  "id": null,
  "referenceName": "orders_by_status_widget",
  "title": "Orders by status",
  "description": "Pie of order counts per status for the selected warehouse.",
  "inParams": [
    { "id": "warehouse_id", "required": false, "type": "number", "isCollection": false, "isSecured": false }
  ],
  "outParams": [
    {
      "id": "slice",
      "type": "object",
      "objectTypeDef": [
        {
          "id": "entity",
          "type": "object",
          "objectTypeDef": [
            { "id": "StatusName", "type": "string", "isCollection": false },
            { "id": "Count", "type": "number", "isCollection": false }
          ]
        }
      ]
    }
  ],
  "accessModifier": "public"
}
```

### Datasource-less large number (host feeds the value)

```json
{
  "type": "fatNumber",
  "fatNumberConfig": { "value": "$widget.inParams.wait_minutes ?? 0", "suffix": "min", "useAbbreviations": false },
  "configurationTypeId": 8,
  "id": null,
  "referenceName": "dock_wait_time_widget",
  "title": "Wait time",
  "description": "Shows a wait time in minutes supplied by the host.",
  "inParams": [
    { "id": "wait_minutes", "required": true, "type": "number", "isCollection": false, "isSecured": false }
  ],
  "accessModifier": "public"
}
```

Five production widgets work this way (no `datasourceConfig` at all). An `image` widget follows the same datasource-less shape: an `on_init` flow writes a declared string var (a URL or a `data:image/...;base64,` URI) and `imageConfig.value` binds it (`"$widget.vars.image_source"`), with `width`/`height` as **strings** (`"1000"`).

Verified live: the skeletons above already omit every unused block rather than nulling it, so `get` after `upsert` returns keys byte-identical to what was sent (only the server-assigned `id` differs) — consistent with the null-stripping behavior documented for other component types; keep omitting rather than nulling.

## Required Top-Level Fields

| Key | Required | Notes |
|---|---|---|
| `type` | yes | `EWidgetDesignerType` — `fatNumber`, `apexPieChart`, `image` (production-proven), or `linearGauge` / `radialGauge` (validate-clean, runtime unverified). A non-member fails with the enum-conversion error. |
| `<type>Config` | yes | Exactly the block for the type (table above). **Missing or misnamed block → validate returns `DXS-API-500 Object reference not set to an instance of an object`** (verified live for a missing `fatNumberConfig`, a missing `pieChartConfig`, and an `apexPieChartConfig`). The 500 names nothing — check the block name first. |
| `fatNumberConfig.value` | yes | TS expression ([file-format.md → Declarative String Values](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions)), type-checked against `IWidget`. Empty → `Data assignments Number is required`. Guard nulls (`?? 0`); production commonly uses `$utils.isDefined(x) ? x : 0`. |
| `fatNumberConfig.useAbbreviations` | yes | JSON boolean — not an expression (`"$widget… > 1"` fails `Could not convert string to boolean`). Rendering (e.g. `12.3K`): _TODO_ (runtime unverified). 48 true / 82 false in production. |
| `fatNumberConfig.prefix` / `suffix` | optional | **Plain display text, not a TS expression** — validate does not compile them (`$`, `%`, `min`, and even invalid TS all validate). Don't TS-quote them; quotes would presumably render literally (_TODO_ runtime unverified). Production emits `""` when cleared. |
| `pieChartConfig.label` / `value` | yes | TS expressions over **`$slice.entity.<field>`** (one evaluation per result row). Empty label → `Data assignments Label is required`. |
| `imageConfig.value` / `width` / `height` | yes | `value` a TS expression yielding an image URL / data URI; `width`/`height` strings (an empty `width` still validates). |
| `datasourceConfig` | for datasource widgets | Reference to a **standalone** datasource — see [Rows Source](#rows-source-standalone-reference-only). |
| `hasTop`, `hasSkip` | no | Seen once (both `false`, on a pie). Semantics _TODO_ (runtime unverified) — omit. |
| `flows` | when hooked | Embedded `configurationTypeId: 9` flows, same node shape as every component flow. |
| `onInitFlowConfig` | optional | `{ "flowId": "on_init" }`. |
| `onDataLoadedFlowConfig` | optional | `{ "flowId": "on_data_loaded" }` — the styling hook for datasource widgets. A flowId with no matching flow fails `Missing 'Data loaded flow' <id>`. |
| `inParams` | usual | What the host passes (filter values, a record id, a refresh flag). |
| `outParams` | pie only | `slice` — see [Pie slice outParam](#pie-slice-outparam). Never author outParams on other types: `$widget.outParams` does not exist, so nothing can write them. |
| `vars` | optional | Declare every `$widget.vars.<id>` you write. |
| `configurationTypeId` | yes | `8`. |
| `id`, `referenceName`, `title`, `description`, `accessModifier` | yes | Standard identity; `id: null` for a new widget. |

There are **no** `events`, toolbar, click flow, `onIntervalFlowConfig`, or filters on a widget. Validate does not reject unknown keys such as `events` or `onClickFlowConfig` (verified live), but they are absent from the model and from every production body — never author them.

### Rows Source: standalone reference only

`datasourceConfig` is always a **reference** to a standalone datasource — the widget cannot own one. `isOwned: true` fails with `Invalid contract. '<id>' is marked as owned, but this component cannot hold owned configurations` (verified live; see [datasources.md → Owned by Default](../../datasource-creator/references/datasources.md#owned-by-default)). Author the datasource first with [datasource-creator](../../datasource-creator/SKILL.md), then reference it:

| Field | Rule |
|---|---|
| `configId` | The datasource's `referenceName`. A wrong name or wrong module fails `Invalid contract. Referenced configuration <id> does not exist or has been renamed`. |
| `moduleId` | The **datasource's** package, not the widget's ([component-wiring.md](../../component-wiring-check/references/component-wiring.md#cross-component-references-use-the-targets-module)). |
| `configParameters` | One entry per datasource inParam: `{ parameter: <the datasource's inParam descriptor>, value: <TS expression> }`, usually `$widget.inParams.<id>`. Omit the array when the datasource has no inParams (8 production widgets). |
| `configOutParameters` | One `result` entry mirroring the datasource's output **field-for-field**. A trimmed subset fails `Outdated contract. Type mismatch for output parameters` (verified live) — copy the full shape from the datasource body. |
| `datasourceKeyDef` | Optional; usually `[]`. Twelve production widgets list key fields; their effect is _TODO_ (runtime unverified). |

The result cardinality must match the type (verified live):

- `fatNumber` needs a **single result** (`isCollection: false`) — a collection fails `Datasource '<id>' cannot be used by a large number widget: its result is a collection.` Use the single-result shape ([flow-datasources.md → Single-Result Shape](../../datasource-creator/references/flow-datasources.md#single-result-shape--getflow)) or an OData query that returns one aggregate row.
- `apexPieChart` needs a **collection** (`isCollection: true`) — a single result fails `… cannot be used by a pie chart widget: its result is not a collection.` One row per slice.

## Runtime Globals

Regenerated from the designer contexts (`dxs configuration contexts widget`). The widget context exports `$widget` and `$slice`; the value bindings and flows import `$widget`, the pie bindings also import `$slice`, and flows additionally get the UI-tier app globals (`$shell`, `$flows`, `$datasources`, `$frontendFlows`, `$settings`, `$operations`, `$types`, `$userSettings`, `$utils`, …).

`IWidget` is generated per body and **its members depend on the type**:

```ts
// fatNumber with a datasource
interface IWidget {
    inParams: { warehouse_id?: number };
    vars: { ... };                // only when vars[] is declared
    entity: { OpenCount?: number };   // only when a datasource is referenced
    styles: IFatNumberStyles;
}
// apexPieChart — no entity, no styles
interface IWidget {
    inParams: { warehouse_id?: number };
}
interface ISlice {
    entity: { StatusName?: string, Count?: number };   // one result row
}
// image — generic styles only
interface IWidget { inParams: {...}; vars: {...}; styles: IStyles }
```

- **`$widget.entity`** — the single result row, fields TS-optional. Present only on a datasource-backed large number; reading it on a datasource-less widget fails `Property 'entity' does not exist on type 'IWidget'`.
- **`$slice.entity`** — the current row inside `pieChartConfig.label`/`value`. On a datasource-less body it is `{}`; using `$slice` on an `image` fails `Cannot find name '$slice'`.
- **`$widget.styles`** — `IFatNumberStyles` on a large number: `setGoodClass()`, `setMediumClass()`, `setBadClass()`, `setKeyClass()`, plus the base `IStyles` members `setStyle(nameAndUnit, value)`, `removeStyle(name)`, `clearStyle()`, `resetStyle()`, `clearClasses()`, `resetClasses()`, `clear()`, `reset()`. An image gets bare `IStyles` (`setGoodClass` fails `Property 'setGoodClass' does not exist on type 'IStyles'`). **A pie has no `styles` at all** (`Property 'styles' does not exist on type 'IWidget'`).
- **No `outParams`, `events`, `refresh()`, or `close()`** on `IWidget` — `$widget.outParams.x = …` fails `Property 'outParams' does not exist on type 'IWidget'`.

Exact rendering of the good/medium/bad/key classes, and whether a later `set*Class()` replaces an earlier one on reload: _TODO_ (runtime unverified).

## Invocation Contract

Widgets are **host-embedded only**. The generated app context exposes no `$shell.open<ref>Dialog` for a widget. Hosts in production: 40 hubs and 19 editors, via a top-level `widgets[]` array (hub key order: `toolbar, hubTitle, hubDescription, icon, actionbar, filters, widgets, tabs, flows, …`; editor: `…, fieldsets, widgets, datasourceConfig, …`):

```json
"widgets": [
  {
    "id": "open_orders",
    "widgetConfig": {
      "configParameters": [
        {
          "parameter": { "id": "warehouse_id", "required": false, "type": "number", "isCollection": false, "isSecured": false },
          "value": "$hub.filters.warehouse.control.value"
        }
      ],
      "configId": "open_orders_count_widget",
      "moduleId": "Acme"
    }
  }
]
```

- `id` is the host-local instance id (snake_case); `configId` is the widget's `referenceName`; `moduleId` is the **widget's** package.
- `configParameters` carries one entry per widget inParam, unused ones with `value: null` ([component-wiring.md → Reference Contracts](../../component-wiring-check/references/component-wiring.md#reference-contracts-include-every-target-inparam)). A missing one fails host validate with `Outdated contract. Missing input parameter <id>` (verified live).
- `configOutParameters` must mirror the widget's `outParams` (the pie's `slice`); dropping it fails `Outdated contract. Type mismatch for output parameters` (verified live). Omit for widgets without outParams.
- `outParamsChangeFlowConfig: { "flowId": "<host flow>" }` runs a host flow when the pie's outParams change (one production use). **Host validate does not check this flowId** (a nonexistent flow validates clean — verified live), so confirm the host flow exists by name. What the host flow receives (`$event` shape) and the exact trigger (slice click) are _TODO_ (runtime unverified).
- Server-emitted extras (`fromBaseConfiguration`, `removed`, `configEvents`, `isOwned`, all `null`) are optional — the trimmed shape above validates.
- On the host, the only widget handle is **`$hub.widgets.<id>.hidden`** / **`$editor.widgets.<id>.hidden`** (boolean). There is no `refresh()` — see the refresh idiom.
- **Dashboards:** the dashboard section model defines `componentType: "widget"` with a `widgets[]` leaf, but no production dashboard uses it — the instance shape is unobserved ([dashboards.md → Section Model](../../dashboard-creator/references/dashboards.md#section-model)).

## Common Patterns

### Refresh idiom (host-driven reload)

Hosts cannot call into a widget, so the widget declares a boolean inParam it never reads, and the host binds it to a host var it flips after a mutation:

```jsonc
// widget inParams
{ "id": "refresh", "required": false, "type": "boolean", "isCollection": false, "isSecured": false }
// host widgets[].widgetConfig.configParameters
{ "parameter": { "id": "refresh", "required": false, "type": "boolean", "isCollection": false, "isSecured": false },
  "value": "$hub.vars.refresh_control" }
// host vars[] — must be declared
{ "id": "refresh_control", "type": "boolean", "isCollection": false, "isSecured": false }
```

```ts
// host flow, after creating/updating records
$hub.vars.refresh_control = !$hub.vars.refresh_control;
```

Production code assigns `true` each time; whether re-assigning an unchanged value re-triggers a reload is _TODO_ (runtime unverified) — toggling guarantees the bound value changes. That an inParam change re-queries the widget's datasource is inferred from the idiom, also _TODO_ (runtime unverified).

### Threshold styling in on_data_loaded

```json
"flows": [ { "...": "cti 9 flow, referenceName on_data_loaded, code below" } ],
"onDataLoadedFlowConfig": { "flowId": "on_data_loaded" }
```

```ts
const pct = $widget.entity.AccuracyPct;
if ($utils.isDefined(pct)) {
    if (pct >= 98) {
        $widget.styles.setGoodClass();
    } else if (pct >= 90) {
        $widget.styles.setMediumClass();
    } else {
        $widget.styles.setBadClass();
    }
}
```

- Style datasource widgets in **on_data_loaded** — that is when `$widget.entity` holds the result. Style datasource-less widgets (value from `inParams`) in **on_init**.
- **Always call with parentheses.** `$widget.styles.setMediumClass;` is a property read, compiles, validates clean (verified live), and does nothing — a production widget ships this bug.
- Inline colours: `$widget.styles.setStyle('background-color', 'rgba(82, 125, 29, 0.9)')`, cleared with `clearStyle()` (the production pattern). Prefer the classes.
- Pies cannot be styled — `IWidget` has no `styles` for `apexPieChart`.

### Pie slice outParam

Every production pie declares `outParams: [{ id: "slice", type: "object", objectTypeDef: [{ id: "entity", type: "object", objectTypeDef: <result fields> }] }]`. Widget validate does **not** require it (absent, renamed, or empty all validate — verified live), but it is the contract a host mirrors in `configOutParameters` and reacts to with `outParamsChangeFlowConfig`. Keep it, keep the id `slice`, and keep `entity`'s fields identical to the datasource result. Whether the platform emits it when undeclared: _TODO_ (runtime unverified).

### Host-fed value

When the host already holds the number (e.g. computed in a grid event), skip the datasource: declare an inParam, bind `fatNumberConfig.value` to `$widget.inParams.<id> ?? 0`, and have the host pass `$hub.vars.<x>`. Styling then goes in `on_init`.

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| `DXS-API-500 Object reference not set to an instance of an object` on validate | Config block missing or misnamed (e.g. `apexPieChartConfig` on a pie) | Use `fatNumberConfig` / `pieChartConfig` / `imageConfig`. |
| `Error converting value "…" to type '…EWidgetDesignerType'` | `type` not a member (`pieChart`, `gauge`) | One of the five members listed under The designer types. |
| `Invalid contract. '<ds>' is marked as owned…` | `isOwned: true` on the datasource reference | Reference a standalone datasource. |
| `cannot be used by a large number widget: its result is a collection` / `… pie chart widget: its result is not a collection` | Result cardinality wrong for the type | Single-result datasource for `fatNumber`; collection for `apexPieChart`. |
| `Outdated contract. Type mismatch for output parameters` (widget) | `configOutParameters` trimmed or stale | Mirror the datasource's full result shape. |
| `Property 'entity'/'styles' does not exist on type 'IWidget'` | Styling a pie, or reading `entity` with no datasource | Pies have no styles; feed datasource-less values via `inParams`. |
| `Data assignments Number is required` / `… Label is required` | Empty `value` / `label` | Bind a TS expression. |
| `Missing 'Data loaded flow' <id>` | Hook flowId names no flow in `flows[]` | Match `flowId` to the flow's `referenceName`. |
| Tile never changes colour, validate clean | `setXClass;` without `()`, or a flow in `flows[]` that no hook references (six production widgets carry an unwired flow, mostly `on_init`) | Call with `()`; wire the flow via `onInitFlowConfig` / `onDataLoadedFlowConfig` or delete it. |
| Host: `Outdated contract. Missing input parameter <id>` | Host `configParameters` lacks a widget inParam | Add it (`value: null` if unused). |
| Host: `Invalid contract. Referenced configuration <widget> does not exist…` | Host `moduleId` is not the widget's package | Use the widget's package. |
| Host slice handler never runs, validate clean | `outParamsChangeFlowConfig.flowId` names no host flow | Fix the flowId — validate won't. |
| Push wiped content | Upserted the envelope | `jq .json envelope.json > body.json` first ([configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md)). |

## Pre-Flight Checklist

1. **File basics** — `configurationTypeId: 8`, suffix `-widget.json`, `referenceName` ends `_widget` and matches the file stem, `title` a sentence-case caption ≠ `referenceName`; universal checks ([universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)); `description` non-empty ≤100 chars (validate won't catch a missing one).
2. **Type ↔ block** — `fatNumber`→`fatNumberConfig`, `apexPieChart`→`pieChartConfig`, `image`→`imageConfig`; exactly one block.
3. **Rows source** — standalone datasource authored first; `configId` + the datasource's `moduleId`; no `isOwned`; result cardinality matches the type.
4. **Contract mirrors** — `configParameters` cover every datasource inParam; `configOutParameters` mirror the full result shape.
5. **Bindings** — `value`/`label` are TS expressions over `$widget.entity` (large number) or `$slice.entity` (pie), null-guarded; `prefix`/`suffix` plain text; `useAbbreviations` a JSON boolean.
6. **Hooks** — every flow in `flows[]` is referenced by `onInitFlowConfig` or `onDataLoadedFlowConfig`; every `$widget.vars.<id>` declared.
7. **Styling** — only on `fatNumber` (classes) or `image` (`IStyles`); every `set*Class()` has parentheses; entity-driven styling in `on_data_loaded`.
8. **Pie** — `outParams` `slice` with `entity` mirroring the result fields.
9. **No events / click flow / outParams on non-pies.**
10. **Validate clean** — `dxs configuration validate widget -b <branchId> -D body.json`.
11. **Host contract** — host `widgets[]` entry with the widget's `moduleId`, a `configParameters` entry per inParam, `configOutParameters` mirroring `slice` for pies, any `outParamsChangeFlowConfig.flowId` present in host `flows[]`, any refresh var declared in host `vars[]`; host validated too ([component-wiring-check](../../component-wiring-check/SKILL.md)).

## Cross-References

- [../../datasource-creator/references/datasources.md](../../datasource-creator/references/datasources.md) — standalone vs owned; widgets must reference a standalone datasource. Single-result vs collection shapes: [flow-datasources.md](../../datasource-creator/references/flow-datasources.md#three-execution-shapes).
- [../../hub-creator/references/hubs.md](../../hub-creator/references/hubs.md) — the main host; `widgets[]` sits beside `filters` and `tabs`, filter values feed widget inParams.
- [../../editor-creator/references/editors.md](../../editor-creator/references/editors.md) — the second host; widgets usually take the editor's record id.
- [../../dashboard-creator/references/dashboards.md](../../dashboard-creator/references/dashboards.md#section-model) — models a widget section; unused in production.
- [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md) — `moduleId`, `configParameters`, and declared-vars rules for both the widget→datasource and host→widget references.
- [../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions) — TS-expression encoding for `value`/`label`.
- [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md) — `_widget` suffix, display-name rule.
- [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md) and [calling-conventions.md](../../datex-studio-runtime/calling-conventions.md) — UI-tier globals and calling rules for widget flows.
- [../../datex-studio-shared/configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md) — get → extract `.json` → edit → validate → upsert.
