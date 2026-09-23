# Custom Angular Components

A **Custom Angular Component** (CAC, `configurationTypeId: 36`) is an **author-written standalone Angular component** that runs inside the generated Datex Studio app with the platform context injected. It is the escape hatch for UI that the declarative components (grid, form, hub, selector, editor) can't express — bespoke charts, dashboards, visualizations, and custom layouts. Unlike every other component type, a CAC is not a declarative JSON body: you write the actual `component.ts` / `.html` / `.scss`. Author it with the **`dxs ng`** command family and the screenshot-driven preview loop (see the parent [SKILL.md](../SKILL.md)). This doc is the authoring reference; for the platform `$`-globals see [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md).

> _Template note:_ this doc deviates from [docs/component-doc-template.md](../../../../docs/component-doc-template.md) — the template's JSON-body sections (Minimal Valid Skeleton, Required Top-Level Fields) are N/A because a CAC is a `dxs ng` working folder, not a single JSON body; `manifest.json` and the two author regions play those roles here.

## Purpose & When to Use

Reach for a CAC when the requirement is genuinely custom UI: a chart/visualization, a dashboard tile arrangement, a bespoke interaction, or a layout no declarative component produces. If the requirement is a tabular list use a **grid**; a single-entity view/edit use an **editor**; transient input a **form**; a dropdown a **selector**; a container a **hub**. A CAC is more powerful and more expensive to maintain than any of those — choose it only when the declarative components can't do the job.

## Authoring model — why this is different

Every other component type is authored as a JSON body through `dxs configuration`. A CAC is authored as **real code** through `dxs ng`:

1. **`dxs ng create` / `pull`** ask the server to generate a **light harness** for the branch and materialize it locally.
2. You edit the **two author regions** (and the template/styles) — real TypeScript/HTML/SCSS.
3. **`dxs ng preview`** renders the component locally to a **PNG** so you iterate visually.
4. **`dxs ng push`** extracts your regions and upserts the type-36 config — the only step that touches Studio.

The branch is still the system of record; the local folder is a throwaway working copy the harness materializes. Nothing exists in Studio until `push`.

## File Location & Naming

`dxs ng create <Name> -b <branch> [-d <dir>]` materializes this layout (the folder is a local working copy, not the system of record):

```
<name>/
  angularapp/                         # the runnable light-harness Angular app
    src/app/
      app.<referenceName>.component.ts    # ← you edit the two regions here
      app.<referenceName>.component.html  # ← template
      app.<referenceName>.component.scss  # ← styles
      … (generated context services: app.datasource.index.ts, app.shell.service.ts, …)
  manifest.json                       # identity + IO + datasource/flow refs + componentRefs (+ vestigial displayModes)
  mocks/harness-mocks.json            # fixtures the preview's $datasources/$flows read
  mocks/harness-inputs.json           # values for the CAC's own @Inputs + the "$container" host frame
  render.png / render.log / .dxs-serve.log   # written by `preview`: screenshot, browser console+errors, dev-server output
```

- **`<Name>` (the `create` arg): PascalCase** (`OutboundCommandCenter`).
- **`referenceName`: camelCase** derived from it (`outboundCommandCenter`) — the code-facing handle.
- **selector:** kebab-case `app-<kebab-case-name>` (e.g. `app-outbound-command-center`) — auto-derived into `manifest.json`; you never set it.
- **`configurationTypeId`: 36**; CLI type name (for `dxs api` / generic tooling): `customangularcomponent`.
- **Working-dir convention:** `-d <dir>` sets the **parent** directory (default: current dir). Pass `-d components` so working copies land under a shared `components/<Name>/` directory (`dxs ng create OutboundCommandCenter -d components` → `components/OutboundCommandCenter/`) rather than scattering them in the current directory.

## Authoring for a target

Establish **where the CAC will live** in Phase 1 (requirements) — it decides size, chrome and the binding contract, and it is not recorded in `manifest.json` (`displayModes` is vestigial; do not repurpose it). Set `"$container"` in `mocks/harness-inputs.json` to match, so `render.png` shows the real box. Design rules come from the vendored [Datex Studio App design system](../../datex-studio-shared/design-system/README.md); the rows below name the parts to read.

| Target | Where it renders | Appearance rules | Binding contract | Preview frame | Read |
|---|---|---|---|---|---|
| **Widget** (hub / editor widget slot, dashboard section) | Inside the host's `.widgets > .widget-container`. Hub and editor size it identically: **200px wide** (`calc(50% - .625rem)` under 1200px); a dashboard section widget flexes to its column (`flex: 1 1 0`). The host hides a container whose only child is empty. | **Compact:** one number or one small chart. The wrapper renders **no title chrome** — unlike the platform's fat-number/gauge/pie-chart widgets, which each print their own `.fat-title`/`.gauge-title`/`.pie-title` from the widget's `title`, a widget of type Custom Angular Component has none, so add a heading in your own markup only if it's genuinely needed. No scrollbars; a 4px-radius surface. The 200px width is fixed by the host, but height is not: the CSS only clamps the container to the design system's 42px widget height when it holds a `.fat-container` child (`:has(.fat-container)`), so your box instead grows to fit its content — aim for one or two lines anyway, to match its 42px neighbours. ≤2 widgets per screen (3 max) is the host's budget, not yours to exceed; tokens only. **Do not embed a grid, list, form, editor or card here.** Every one of those is built to fill a tab or a page and brings its own scroll region, toolbar or paging; at 200px it renders unusably and defeats the compactness this slot exists for. If the requirement genuinely needs one, the target is tab content, not a widget. | Create a **Widget of type Custom Angular Component** pointing at the CAC (below). The wrapper binds `[<id>]` from `$widget.inParams.<id>`, forwards `outParamsChange`, and calls your `refresh(true, false, null)` on the host's refresh and the widget's interval — the generated default re-runs `ngOnInit`, so implement the three-parameter `refresh` if your init is not idempotent. | `"$container": "widget"` (hub/editor) or `"dashboard-widget"` | [03-components → Widgets](../../datex-studio-shared/design-system/03-components.md#widgets--height-42px-radius-4px), [02-tokens](../../datex-studio-shared/design-system/02-tokens.md) |
| **Tab content** (hub, editor, dashboard tab) | Fills `.blade-wrapper .blade-content` (`padding: 1.25rem`, 4px radius, `--shadow-4`, `overflow-y: scroll`, `overflow-x: hidden`) beneath the host's tab strip. **A card tab is not a blade** — see the row below. | Fill the width; own a **vertical** scroll region, never horizontal; if it needs actions, a `.dataview-tools` toolbar (38px) in the strict order main → destructive → common → UI config, ~7 buttons max, **one** primary; tabular data = embed a `grid` ref, don't hand-roll a table. | The tab binds `[<inParamId>]` per configured parameter, `($refreshEvent)` unconditionally and `(outParamsChange)` when a flow is configured; implement `refresh(skipParent = false, skipChildren = false, childToSkip: string = null)` if data must reload; never declare an outParam named `refresh`/`$refreshEvent`/`outParamsChange`. | `"$container": "page"` | [03-components → Toolbars, Tabs, Dataviews](../../datex-studio-shared/design-system/03-components.md), [04-patterns → Window hierarchy](../../datex-studio-shared/design-system/04-patterns.md) |
| **Tab content — card host** | Renders inside the card's own surface, not a blade: `card.html.hbs` mounts tabs in `mat-card-content.card-content`, which the compiled CSS sets to `display: contents` — no box, no padding, no scroll region of its own. The content becomes a direct cell in the card's own CSS grid (`.card.datex-card`: grid `1fr auto`, gap 14px, padding 10px, radius 4px, `--shadow-4`). | Same binding/toolbar rules as the row above, but size to the card, not the page: no blade padding, no forced vertical scroll — the card (and the page around it) grows to fit your content instead. Don't bring blade-sized chrome (a 1.25rem-padded, independently-scrolling block) into a card tab. | Same as the row above. | `"$container": "page"` | [03-components → Cards](../../datex-studio-shared/design-system/03-components.md#cards--carddatex-card) |
| **Page / shell view** | A blade (`.blade-header` 40px toolbar + `.blade-content`) opened from navigation or a `$shell` opener. | Full page at blade sizing; **one** primary action, in the blade toolbar; `h1` (32px, accent) is the page title in sentence case; anything it opens follows blade ▸ flyout ▸ modal — never a modal on a modal, no "create new" in a modal. | Inputs arrive from the route/opener as `[<inParamId>]`; navigate and open through `$shell`, not `window.location`. | `"$container": "page"` | [04-patterns](../../datex-studio-shared/design-system/04-patterns.md), [03-components → Blade](../../datex-studio-shared/design-system/03-components.md#blade--blade-wrapper) |
| **Common to all** | — | Sentence case; button labels are action verbs, no trailing period; spacing 2 / 4 / 8 / 12 / 20 / 32 / 40 / 48 px (there is no 16px step); radius 4px (8px only for a modal surface); body text 14px; `var(--…)` tokens, **never a literal hex**; Fluent icons on `<i>` only; mirror the closest existing component's markup and classes rather than inventing. | — | — | [02-tokens](../../datex-studio-shared/design-system/02-tokens.md), [05-voice-and-copy](../../datex-studio-shared/design-system/05-voice-and-copy.md), [06-traps](../../datex-studio-shared/design-system/06-traps.md) |

### Widget of type Custom Angular Component

A CAC becomes a widget through a **companion Widget config (type 8)** whose type is `Custom Angular Component`; hosts keep placing widgets by name, so nothing about hub/editor/dashboard slots changes.

- **Studio:** Widgets → New → type **Custom Angular Component** → pick the CAC. Settings mirrors the CAC's `inParams`/`outParams` onto the widget (read-only in the Data flyouts) and default-maps every parameter to `$widget.inParams.<id>`; Save; Preview shows the CAC inside the 200px box. Then Hub/Editor → Add widget → pick that widget and bind its inputs like any other widget.
- **CLI:** `dxs configuration upsert widget -D <file.json> -b <branch>` with a type-8 body of this shape (mirror the CAC's `inParams` yourself; `moduleId` follows the normal reference rule — the CAC's owning module, `null` in a host app). `-D`/`--data-file` is required (`dxs configuration upsert` has no bare-argument form). Confirm the accepted shape against a saved one first (`dxs configuration get widget <id> -b <branch>`), per the CLI-first rule:

```json
{
  "id": 0,
  "referenceName": "outboundCommandCenterWidget",
  "title": "Outbound backlog",
  "description": "Outbound backlog fat number (custom Angular component)",
  "configurationTypeId": 8,
  "type": "customAngularComponent",
  "customAngularComponentConfig": {
    "configId": "outboundCommandCenter",
    "moduleId": null,
    "configParameters": [
      {
        "parameter": { "id": "warehouseId", "type": "string", "required": false, "isCollection": false, "objectTypeDef": null, "objectType": null },
        "value": "$widget.inParams.warehouseId"
      }
    ],
    "configOutParameters": null,
    "configEvents": null,
    "outParamsChangeFlowConfig": null
  },
  "inParams": [
    { "id": "warehouseId", "type": "string", "required": false, "isCollection": false, "objectTypeDef": null, "objectType": null }
  ],
  "outParams": null,
  "datasourceConfig": null,
  "fatNumberConfig": null,
  "pieChartConfig": null,
  "vars": null,
  "events": null
}
```

- **Drift:** when the CAC's `inParams`/`outParams` change later, save and publish both re-check the widget↔CAC contract and report `Outdated contract. …` under the widget — re-open the widget's Settings (or re-copy the parameters) to fix. Validation of the widget also requires `customAngularComponentConfig.configId` (`Custom Angular Component is required`) and that the target actually resolves to a CAC.
- **Behavior you inherit:** the widget's interval refresh calls the CAC's `refresh`; the generated default re-runs `ngOnInit`, so a CAC with one-time setup (a chart instance, subscriptions) must implement its own three-parameter `refresh`. The wrapper is never generated in the `dxs ng` harness — `"$container": "widget"` (hub/editor) or `"dashboard-widget"` (dashboard section — a different frame, not the same value) reproduces its **geometry** only, not its refresh/interval semantics; verify those in Studio's widget Preview after `push`.
- **Deploy order:** the wrapper only exists because codegen has a `customAngularComponent` branch in `WidgetsGenerator` — an app is generated by whatever code generator build the platform runs at publish time, and a generator build that predates this widget type does not know the branch. It fails the type with `Unknown widget type customAngularComponent to generate` and aborts the **entire** app generation, not just this one widget. A widget of this type is safe to author only once you know the target environment's code generator has this feature; if in doubt, ask rather than assume the deployed generator is current.

## The two author regions

You edit **only** these two regions inside `app.<referenceName>.component.ts`, plus the `.html` and `.scss`:

```ts
//#region __COMPONENT_TYPES__
//   imports, interfaces, type declarations  — spliced verbatim on push
//#endregion __COMPONENT_TYPES__

@Component({ selector: 'app-<ref>', templateUrl: …, styleUrls: […], imports: [SharedModule], … })
export class app_<Ref>Component implements OnInit, OnChanges, OnDestroy {
  // generated inputs / constructor (DO NOT EDIT) — injects the $-context:
  constructor(
    protected $utils: UtilsService,
    protected $settings: SettingsValuesService,
    protected $shell: app_ShellService,
    protected $datasources: app_DatasourceService,
    protected $flows: app_FlowService,
    protected $frontendFlows: app_FrontendFlowService,
    protected $reports: app_ReportService,
    protected $localization: app_LocalizationService,
    protected $operations: app_OperationService,
    protected $userSettings: app_UserSettingsService,
  ) { }

  //#region __COMPONENT_BODY__
  //   fields, methods, getters, lifecycle body  — spliced verbatim on push
  //#endregion __COMPONENT_BODY__

  // generated lifecycle stubs (DO NOT EDIT)
}
```

**Hard rule:** never edit the wrapper `class` line, the `@Component` decorator, the constructor, or the `//#region … //#endregion` sentinels. `dxs ng push` extracts your code from **between** the sentinels (byte-for-byte); damaging them makes `push` fail locally before any network call. `SharedModule` is imported, so template directives (`*ngFor`, `*ngIf`, `[ngClass]`, `[style.*]`, `[attr.*]`) and the platform's UI libraries (Angular Material, AG-Grid, ApexCharts, ActiveReports) are available.

## Runtime Globals (the injected `$`-context)

The constructor injects the real, branch-typed platform services — use these, **never** raw `HttpClient`/`fetch`:

| Global | Service | Use |
|---|---|---|
| `this.$datasources` | `app_DatasourceService` | read data (OData/flow datasources on the branch) |
| `this.$flows` | `app_FlowService` | run backend flows |
| `this.$frontendFlows` | `app_FrontendFlowService` | run client-side flows |
| `this.$shell` | `app_ShellService` | dialogs, toasts, navigation |
| `this.$utils` | `UtilsService` | date/format/http helpers |
| `this.$settings` | `SettingsValuesService` | app settings |
| `this.$reports` | `app_ReportService` | run/preview reports |
| `this.$localization` | `app_LocalizationService` | i18n |
| `this.$operations` | `app_OperationService` | operation assignments |
| `this.$userSettings` | `app_UserSettingsService` | per-user settings |

During `preview` (no backend), `$datasources`/`$flows` read from `mocks/harness-mocks.json` instead of calling the server, so the component renders with representative data offline. See [calling-conventions](../../datex-studio-runtime/calling-conventions.md) for the UI-tier rules.

## Mock data — `mocks/harness-mocks.json`

`dxs ng data generate <folder> -b <branch>` seeds this file with typed placeholders for the `$datasources`/`$flows` the component references; fill in realistic values so the preview looks real. Lookup order the harness stubs use: `mocks["<ref>.<method>"]` → `mocks["<ref>"]` → a typed empty default (so an un-fixtured call never throws).

```json
{
  "ds_orders.get":         { "result": { "…": "…" } },
  "ds_orders.getList":     { "result": [ { "…": "…" } ], "totalCount": 2 },
  "ds_order_lines.getList": { "result": [ { "…": "…" } ], "totalCount": 1 },
  "fn_submit_order.run":    { "success": true }
}
```

Keys are **flat** `"<ref>.<method>"` strings — never a nested `{ "<ref>": { "<method>": … } }` map. That nesting is the bare-name fallback's own value, not a key structure: the harness stub looks up `mocks["<ref>.<method>"]` first, and only when that is absent falls back to `mocks["<ref>"]`, returning whatever is stored there as-is (see the lookup order above). A nested per-method object at the bare name still satisfies that fallback — it isn't nil — so it renders with no error and no warning; the component just receives the method map itself instead of a `{ result, totalCount }` payload, which is an empty render, not a crash. One flat key per datasource method (`get` / `getList` / `getByKeys`) or per flow (`run`, always the same for every flow) is the only shape that actually reaches the component.

**Coverage gaps to check by hand.** `dxs ng data generate` does not seed from a fixed per-kind list — it scans every generated `*.component.ts` in the materialized harness (your CAC's own file, plus every embedded component's, transitively following the `$frontendFlows` any of them call) for `$datasources.<ref>.<method>(...)` / `$flows.<ref>(...)` call sites, and seeds one `"<ref>.<method>"` key per (ref, method) pair it actually finds — that scan, not a table of kinds, is why an embedded grid, editor, form, list or widget is seeded at all. Run it **after** `preview --refresh`, never before: it now compares the materialized harness against the current manifest and warns when the harness is stale. It still does not seed: `$frontendFlows` themselves (never mocked, see below — preview runs their real code, so there's nothing to fixture); anything reached only through `$shell.open*` (an inert stub in every harness build, for every component — see [The light harness](#the-light-harness)); and a datasource reached only through a call shape the scanner doesn't parse as a direct method call (e.g. a `get datasources()` getter). Such a ref gets a key only if it is also declared in your own `manifest.datasources`, and then the method is guessed from the datasource's own shape rather than the one actually called; if it is not declared there, it gets no key at all and the call falls back to a typed empty default. Either way, check it by hand. **Its warnings — a `componentRefs` entry that didn't materialize (won't render, wasn't seeded), a generated file it couldn't read, a stale harness — come back in the command's `warnings` array in the structured JSON result, not only printed to the terminal**; read them there, especially when scripting or driving this from an agent. After generating, open the file and fill in or correct whatever it flagged.

**`$frontendFlows` are never mocked.** Unlike `$datasources`/`$flows`, `$frontendFlows` run as real, computed client-side code in the harness during preview — a mock entry seeded for a frontendFlow key is inert. The preview always shows the flow's actual computed result.

## Preview inputs and host frame — `mocks/harness-inputs.json`

`dxs ng data generate` also writes `mocks/harness-inputs.json`: one key per manifest input (a typed placeholder) plus the reserved `"$container"` directive. `preview` copies it next to the mocks into the harness assets, and the harness bootstrap binds each value to the matching `@Input` **before** the first change detection — so your `ngOnChanges`/`ngOnInit` see real values exactly as they would under a tab or widget host. Every output the CAC emits is logged as a `[harness][out] <id> <value>` line in `render.log`.

```json
{
  "$container": "widget",
  "warehouseId": "WH-01",
  "orderId": 12345
}
```

- Keys are the manifest `inputs[].name`s; `type`/`required` stay in `manifest.json`, **values** live here. Editing a value is a local, warm edit — no `--refresh` (the file is deliberately outside the IO signature). `preview` warns locally on a key that is not a declared input, a `required` input with no key, and an unknown `$container`.
- `"$container"` picks the host frame the harness wraps the mounted element in: `"page"` (default — bare, as a shell view), `"widget"` (`.blade-wrapper > .blade-content > .datex-hub > .widgets > .widget-container` — the identical 200px box a hub **or** editor gives a widget), `"dashboard-widget"` (`.datex-dashboard > .section > .section-content > .widgets > .widget-container`). Set it from the target you established in requirements (see [Authoring for a target](#authoring-for-a-target)).
- The CAC has **no** built-in `Please provide …` gate: an unfed required input renders whatever your template renders with `undefined`. If the preview is blank, check this file before the code.

## `manifest.json`

Carries the component's identity + IO + declared datasource/flow refs + embedded component refs. `push` uses it to build the type-36 config; changes to IO (new `@Input`/`@Output`) or to `componentRefs` need codegen re-wiring, so re-preview with `--refresh -b <branch>` after editing it. The `datasources` array only *declares* dependencies — it never creates the datasource. Create it with `datasource-creator` on the branch **first** (ideally before materializing) so the harness types the `$datasources.<ref>` stub the body compiles against; see [Reading real data](#reading-real-data-via-datasources).

```json
{
  "displayName": "Outbound Command Center",
  "name": "OutboundCommandCenter",
  "selector": "app-outbound-command-center",
  "displayModes": ["inline", "modal"],
  "inputs":  [ { "name": "warehouseId", "type": "string", "required": false } ],
  "outputs": [ { "name": "cardClick", "type": "any" } ],
  "datasources": [],
  "componentRefs": [
    { "name": "status_dd", "kind": "selector" },
    { "name": "orders_grid", "kind": "grid", "module": "SalesOrders" }
  ]
}
```

The config `title` and `description` are derived from `displayName` — keep `displayName` ≤ 100 chars (platform column limit). `pull` builds `manifest.json` from the config's stored properties (`referenceName`, `title`, `inParams`, `outParams`, `componentReferences`) — so `componentRefs` **round-trip**; `datasources` does not (see [SKILL.md → Phase 2](../SKILL.md#phase-2-materialize-the-harness)).

**`displayModes` is vestigial.** The CLI always writes `["inline", "modal"]`, the server never persists it, and nothing reads it. Leave it as written and never repurpose it — in particular it does **not** say where the CAC will live (widget / tab / page); that comes from the requirements step and is expressed in preview through `"$container"` in `mocks/harness-inputs.json` (see [Authoring for a target](#authoring-for-a-target)).

### `componentRefs` — embedding another component

A CAC can embed any of **seven** app-generated component kinds. Each entry:

```json
{ "name": "<referenceName>", "kind": "<selector | grid | editor | form | card | list | widget>", "module": "<owning module — omit for your own application>" }
```

- **`kind`** is one of exactly `selector, grid, editor, form, card, list, widget` — lower-case, case-sensitive. Anything else is rejected at `push` (`DXS-NG-056`) and by the server validator (`Embedded component '<name>': kind '<k>' is not supported. Allowed: selector, grid, editor, form, card, list, widget`); in the harness an unknown kind is dropped with a `[codegen][custom-angular]` warning and the tag then fails to compile (`NG8001`).
- **`module`** is the reference name of the application that **owns the target**. Omit it (or leave it blank — the CLI normalizes `""` to omitted) when the target lives in your own application: the host app, or the package the CAC itself lives in. Set it when the target lives in another module. Never set it to the CAC's own module "to be explicit" — it is the same rule every component reference in Studio follows (`moduleId` = the target's package; see [component-wiring.md](../../component-wiring-check/references/component-wiring.md#cross-component-references-use-the-targets-module)).
- A `componentRefs` change is an IO-level change: `dxs ng preview <folder> --refresh -b <branch>` re-materializes the harness with the embedded component, its own dependencies (column selectors, tab content, row-expand components) and its context service generated. Then `dxs ng data generate <folder> -b <branch>` seeds its datasource keys, then `preview`.

#### Generated surface per kind

`<P>` is the reference name of the **target's** application — `app` for a host app, the package name for a component in a module (a same-app ref in a host app is `app-…`; a ref with `"module": "SalesOrders"` is `SalesOrders-…`). It is also the prefix of the generated file `angularapp/src/app/<P>.<ref>.component.ts`. The class is **already imported by codegen** — never re-import it in `__COMPONENT_TYPES__` (that is `TS2300: Duplicate identifier`).

| `kind` | Tag(s) | Class | Binding family | Mock keys `data generate` seeds |
|---|---|---|---|---|
| `selector` | `<P>-<ref>_single` and `<P>-<ref>_multi` (both generated, both imported) | `<P>_<ref>_singleComponent` / `<P>_<ref>_multiComponent` | **Value-bound control:** `[(ngModel)]` or `[formControl]`; `[placeholder]`, `[type]`, `[styles]`, `[tooltip]`, `(displayTextChange)`; one `[<inParamId>]` per datasource parameter. No `refresh()`, no `($refreshEvent)`. | `<ds>.getList`, `<ds>.getByKeys` |
| `grid` | `<P>-<ref>` | `<P>_<ref>Component` | **inParams + refresh:** `[<inParamId>]` (grid inputs are typed `any`); `(<eventId>)`; `(outParamsChange)` (only if the grid declares outParams); `($refreshEvent)`; `($finish)`; `#ref` + `@ViewChild('ref', { read: <P>_<ref>Component })` to call `refresh(skipParent, skipChildren, childToSkip)` | `<ds>.getList` (+ `<ds>.getByKeys` for row reload) |
| `editor` | `<P>-<ref>` | `<P>_<ref>Component` | inParams + refresh; inputs **strongly typed**; `(<eventId>)`, `(outParamsChange)` (if outParams), `($refreshEvent)`, `($finish)` | `<ds>.get` |
| `form` | `<P>-<ref>` | `<P>_<ref>Component` | inParams + refresh; typed inputs; `(<eventId>)`, `(outParamsChange)` (if outParams), `($refreshEvent)`, `($finish)` | `<ds>.get` (only if the form has a datasource) |
| `card` | `<P>-<ref>` | `<P>_<ref>Component` | inParams + refresh; typed inputs; `(<eventId>)`, `(outParamsChange)` (if outParams), `($refreshEvent)`, `($finish)` | none (a card reads through its tabs/fields) |
| `list` | `<P>-<ref>` | `<P>_<ref>Component` | inParams + refresh; typed inputs; `(<eventId>)`, `(outParamsChange)` (if outParams), `($refreshEvent)`, `($finish)` | `<ds>.getList` |
| `widget` | `<P>-<ref>` | `<P>_<ref>Component` | inParams + refresh; typed inputs; `(outParamsChange)` on the subtypes that declare outParams — the pie chart, and a widget of type Custom Angular Component, which passes its wrapped component's straight through; `($refreshEvent)`; `($finish)`. No per-event outputs. Widget subtypes differ: read the generated file rather than assuming. | `<ds>.get` (fat number, gauges), `<ds>.getList` (pie), none (Custom Angular Component — the wrapped component owns its data) |

The "Mock keys" column above is what a **typical** generated component of that kind calls — it is not a separate seeding rule. `data generate` seeds one flat `"<ds>.<method>"` key per datasource call it actually observes in *any* materialized component in the harness tree, yours or an embedded one (see [Mock data](#mock-data--mocksharness-mocksjson) above) — so a component that calls something the table doesn't list (an extra `getByKeys` for row reload, a second datasource) is still seeded for exactly what it calls, no table lookup involved. Everything else in the table — tag, class, binding family — is derived from the generated code; when in doubt, read the file (below), never guess.

#### Two binding families — markup

**Value-bound (selector).** The tag is a form control; bind the value, not inParams-and-refresh:

```html
<!-- same-app selector in a host app: <P> = app -->
<app-status_dd_single [(ngModel)]="statusId"
                      placeholder="Status"
                      [warehouseId]="inParams.warehouseId"
                      (displayTextChange)="statusText = $event">
</app-status_dd_single>
```

**inParams + refresh (every other kind).** The tag takes one input per inParam and emits the tab-content events — the same shape codegen writes for a hub/editor tab:

```html
<!-- grid owned by the SalesOrders module: <P> = SalesOrders -->
<SalesOrders-orders_grid #ordersGrid
                         [warehouseId]="inParams.warehouseId"
                         (outParamsChange)="onGridOut($event)"
                         ($refreshEvent)="refresh(false, true, null)">
</SalesOrders-orders_grid>
```

```ts
//#region __COMPONENT_BODY__
// ViewChild is already imported by the generated header, and SalesOrders_orders_gridComponent is
// already imported by codegen because the ref resolved — declare nothing in __COMPONENT_TYPES__.
@ViewChild('ordersGrid', { read: SalesOrders_orders_gridComponent }) ordersGrid: SalesOrders_orders_gridComponent;
statusId: string = null;
statusText = '';
selectedOrderId: number = null;

onGridOut($event: any) { this.selectedOrderId = $event?.selectedOrderId ?? null; }

// The sanctioned refresh override — this exact signature. A tab host calls it with three arguments
// through a typed @ViewChild, so any other arity fails the host's compile (TS2554). A CAC has no
// $refreshChildren(): forward to embedded children yourself.
refresh(skipParent = false, skipChildren = false, childToSkip: string = null) {
  if (skipParent === false) { this.$refreshEvent.emit(); }
  if (skipChildren === false) { this.ordersGrid?.refresh(true, false, null); }
  return Promise.resolve(null);
}
//#endregion __COMPONENT_BODY__
```

`($refreshEvent)="refresh(false, true, null)"` on the child means "when the grid asks its parent to refresh, refresh me but do not bounce back down into my children" — the wrapper-widget pattern (spec A9). Generated tab hosts instead pass the calling child's id: `refresh(false, false, '$tabs_<id>')` (tabs.html.partial.hbs:68); either form is acceptable in a CAC, the point is not to re-refresh the child that raised the event. Declare only the component you place in your template: its own dependencies (column selectors, tab content, row-expand components, its context service) are generated automatically.

#### What to read in the harness

- `angularapp/src/app/<P>.<ref>.component.ts` — `selector:` is the tag; `@Input('<id>')` setters are the inputs; `@Output()` members are the events. For a selector read `<P>.<ref>_single.component.ts` / `<P>.<ref>_multi.component.ts`.
- Your own `angularapp/src/app/<P>.<cacRef>.component.ts` — the `@Component` `imports:` array must contain one `forwardRef(() => <class>)` per resolved ref (two for a selector). **If the class is not in that list, the ref did not resolve** (wrong `name`, `kind`, or `module`): fix `manifest.json` and run `preview --refresh -b <branch>`. Do not add the import yourself.
- An embedded component whose **required** inParam you did not bind renders a `Please provide <id>` block (grid, editor, form, card, and the pie, gauge and Custom Angular Component widget subtypes), a disabled control (selector), or its empty state (list, fat-number widget). That is the harness telling you to bind the input — or, when it comes from the CAC's own input, to give it a value in `mocks/harness-inputs.json` — not a rendering bug.
- An embedded component that renders **completely empty** (not even a "Please provide" block) is more often missing data than missing markup. Both `dxs ng data generate` and `dxs ng preview` return a `warnings` array in their structured JSON result, not only on the terminal: `data generate`'s flags a `componentRefs` entry that never materialized (it will not render and its datasources were not seeded) and any generated file it couldn't read; `preview`'s flags a missing mocks fixture (a missing inputs fixture does not warn — `"$container"` simply defaults to `"page"`), a required input with no value, or an unrecognized `"$container"`. Read both before assuming the component itself is broken.

#### Preview and push are both strict

The harness compiles with `strictTemplates: true` — the **same** strictness as the real app build. A type-wrong binding on a typed input (editor/form/card/list/widget) or an unknown tag fails `dxs ng preview` with `DXS-NG-057` quoting the compiler line (`NG8001` unknown element, `NG8002` unknown property, `TS2322` type mismatch). Nothing that previews green fails the server's compile gate for a template reason. A dangling reference (wrong `name`, `kind`, or `module`) does **not** slip through as a green preview: codegen emits the import regardless, with a `[codegen][custom-angular]` warning, so it fails at the harness's own `ng build` exactly like any other dangling reference (the code generator's own comment: "a dangling name fails at ng build like any dangling tab reference," `codegen/src/generators/common/component-references.ts`). What preview's compile failure does *not* give you is a clean diagnosis — it's a generic unresolved-import/unknown-element error, not a message naming which entry is wrong or why. That clean, explicit diagnosis — and the only check that runs *before* a build — is `push`'s preflight (`DXS-NG-056`). A third, unrelated failure belongs here too: `dxs ng data generate` raises `DXS-NG-058` if it locates your CAC's own generated component file but can't read it (locked, or not valid UTF-8) — re-materialize (`preview --refresh` or `pull`) and re-run it.

#### Cross-module refs materialize like same-app refs

A ref with `module` set generates exactly like a same-app one — tag `<Module>-<ref>`, class `Module_<ref>Component` — and previews as a real, bindable component. There is no cross-module stub. What *is* a stub in every harness build, for every component, is `$shell.open<X>…`: the harness's shell service returns inert openers because only your candidate and its closure are generated — unrelated to `componentRefs`. Cross-module mistakes surface as: the class missing from your `imports:` list, `DXS-NG-057` (`NG8001`) in preview, and `DXS-NG-056` at push (whose message names the owning package it did find).

## The light harness

`create`/`pull` don't download the whole generated app. The server generates a **light harness**: the candidate component **plus the components it embeds via `componentRefs` and their own dependencies** (each with its context service) are real, fully-generated components + the real typed `$`-context services + mock-reading stub services + a minimal bootstrap — with every other component, the MSAL auth shell, and routing pruned out. The harness log line `[codegen][harness] '<candidate>' component closure: …` lists what was generated. That's what makes the loop fast: the app compiles in ~15s (not minutes) and boots straight into the component with no login. The pruning + light bootstrap are server-side; you just get a folder that previews quickly.

Because only that closure is real, the full typed surface is still there for authoring — `$datasources`/`$flows`/`$frontendFlows`/`$types` reflect the **real branch** (discover and reuse any of them), and `$shell` exposes every `open<X>Dialog`/`open<X>` — but `$shell.open<X>…` calls to **any** component are compilable, discoverable **stubs** in every harness build: they won't actually open that dialog/view in preview. Your own component's UI, its embedded components, and their `$datasources`/`$flows` reads (served from `mocks/`) are fully live.

## Preview & the screenshot loop

```bash
dxs ng preview <folder>              # serve locally + screenshot -> <folder>/render.png (+ render.log)
dxs ng preview <folder> -o out.png   # custom output path
dxs ng preview <folder> --refresh -b <branch>   # after a manifest IO / componentRefs change
dxs ng preview <folder> --clean      # kill a stuck server + reset the browser session, then rebuild
dxs ng stop <folder>                 # stop-only disposal: server + browser session + lock (idempotent)
```

`preview` copies `mocks/` (`harness-mocks.json` + `harness-inputs.json`) into the harness assets, runs `npm install` once, warms `ng serve` (its output goes to `<folder>/.dxs-serve.log`), waits for the build marker of **this** run, and drives a headless browser to screenshot the mounted component. Read the PNG, compare to the target, edit, re-run — the loop is the acceptance test for bespoke UI.

**The order after a `componentRefs` or IO change is fixed:** `dxs ng preview <folder> --refresh -b <branch>` (materialize the embedded components) → `dxs ng data generate <folder> -b <branch>` (seed their datasource keys and the inputs skeleton) → fill values → `dxs ng preview <folder>`. `data generate` before `--refresh` reads a stale harness and tells you so. Every run after the first hits `mocks/harness-mocks.json` already existing (`DXS-NG-020`) — that is expected on a component you're iterating on, not a sign something is wrong. Its own suggested `--force` is the expensive fix: it discards every value you've filled into `mocks/harness-inputs.json` and silently resets `"$container"` back to the `"page"` default (a legal value, so `preview` doesn't warn) — losing a widget target's frame without telling you. Prefer generating to a scratch path (`-o`) and hand-merging the new key(s) into your existing mocks file over reaching for `--force`.

**Where failures show up.**

- **Compile/template errors are `DXS-NG-057` (`harness compile failed`)**, not a picture: `preview` reads `.dxs-serve.log`, finds this run's `Application bundle generation failed` marker, quotes the `✘ [ERROR]` / `NG…` / `TS…` lines, and takes **no** screenshot — `render.png` is never a stale bundle. `NG8001` (unknown element) = a `componentRefs` entry did not resolve or the tag is misspelled; `NG8002` = wrong binding family or a misspelled input; `TS2300` = you re-imported an embedded class; `TS2554` = a `refresh` override with the wrong arity. The **same** code covers a second, different failure: if **neither** build marker appears before `DXS_NG_SERVE_TIMEOUT` (seconds) elapses, `preview` raises `DXS-NG-057` rather than screenshot a bundle it cannot confirm is current. That message has no compiler lines to quote, because there was no compiler error — it means the rebuild never finished. Raise the timeout and re-run.
- **`ng serve` never became ready is `DXS-NG-042`**, now carrying the last ~40 lines of `.dxs-serve.log`. Usually a long cold compile — extend `DXS_NG_SERVE_TIMEOUT` (seconds), re-run, `--clean` if it persists.
- **Runtime problems** (an exception in `ngOnInit`, an `undefined` read, a missing mock key) leave `preview` green and the PNG wrong: read `<folder>/render.log` — the browser console + errors from the render, including the `[harness][out] <output> <value>` lines for every output your CAC emitted.
- **Browser-step failures (`DXS-NG-053` timeout, `DXS-NG-052` other, `DXS-NG-050`/`DXS-NG-055` install)** are raised only after the build succeeded. First move `--clean`, then re-run; if it persists, read `render.log` and `.dxs-serve.log` before touching code, and report a reproducible one as a CLI issue.

`preview` captures the component's **default** rendered state — it doesn't interact. When a mode/variant is switched by in-component UI (not an `@Input`), temporarily set that default to screenshot each variant; when it is driven by an `@Input`, set the value in [`mocks/harness-inputs.json`](#preview-inputs-and-host-frame--mocksharness-inputsjson) (warm, local — no `--refresh`).

**`render.png` is the mounted element**, falling back to a viewport capture. The capture never resizes the viewport, so the 1200px responsive rules — including the widget box — resolve against whatever width the browser tool opens with, not a width `dxs` sets. It cannot see content hidden inside your own `overflow-y: auto` region; that is faithful to the host, not a bug. To inspect such content, drive `agent-browser` against the served port (`<folder>/.dxs-serve.lock`) and scroll the region: `agent-browser open http://127.0.0.1:<port>` → `wait '<css>'` → `scroll`/`click` → `screenshot out.png`.

### Preview error codes & session lifecycle

`dxs ng preview` raises its own error codes for the screenshot toolchain (older dxs ≤0.4.13 leaked report-preview codes `DXS-RPT-042/043` here — if you see those, the CLI is outdated):

| Code | Meaning | First move |
|---|---|---|
| `DXS-NG-045` | folder not materialized (no `angularapp/`) | `dxs ng create` / `dxs ng pull` |
| `DXS-NG-043` | `npm install` failed in the harness | check Node/npm; `--clean` |
| `DXS-NG-042` | `ng serve` didn't become ready (the message ends with the last ~40 lines of `<folder>/.dxs-serve.log`) | read those lines; extend `DXS_NG_SERVE_TIMEOUT`; re-run; `--clean` if it persists (on CLI ≤0.4.13 also caused by a relative folder argument — pass an absolute path) |
| `DXS-NG-047` | `push` datasource connection preflight failed (datasource missing on branch, or its `apiSettingName` not defined in branch settings) | regenerate the datasource against this branch; wire a connection in Studio; `--skip-connection-check` for mock-only dev |
| `DXS-NG-056` | `push` component reference preflight failed: a `manifest.componentRefs` entry has an unsupported `kind`, a duplicate `(name, module)`, an empty name, or names a component that does not exist in that module on the branch (runs even with `--skip-connection-check`) | fix `manifest.json` — `kind` ∈ `selector, grid, editor, form, card, list, widget` ([above](#componentrefs--embedding-another-component)), `module` = the target's owning module (omit for your own app); find it with `dxs configuration list <kind> -b <branch>`; then `dxs ng preview <folder> --refresh -b <branch>` and push again |
| `DXS-NG-048` | `pull` target folder already exists | `preview --refresh` to keep local work, or `pull --force` to take server truth |
| `DXS-NG-049` | `pull --force` refused/failed to overwrite (not a CAC working copy, or files still locked) | check the target path; close whatever holds files, retry |
| `DXS-NG-050` | agent-browser not installed | `npm i -g agent-browser && agent-browser install` |
| `DXS-NG-053` | agent-browser step timed out (raised only after the harness built) | `--clean`, re-run; then read `render.log` / `.dxs-serve.log` |
| `DXS-NG-055` | browser build missing/incompatible | `agent-browser install` |
| `DXS-NG-057` | two causes. **Compile failed:** this run's build marker was `Application bundle generation failed`; the message quotes the `✘ [ERROR]`/`NG…`/`TS…` lines. **No marker at all** before `DXS_NG_SERVE_TIMEOUT` elapsed: the rebuild never finished, so there is nothing to quote. Either way no screenshot was taken | with quoted lines: fix them (`NG8001` unresolved ref/tag, `NG8002` wrong binding, `TS2300` re-imported class, `TS2554` `refresh` arity), re-run `preview`. Without quoted lines: raise `DXS_NG_SERVE_TIMEOUT` (seconds) and re-run; `--clean` if it persists |
| `DXS-NG-020` | `data generate` refused to overwrite an existing `mocks/harness-mocks.json` (its default on every run after the first) | don't reach for `--force` by reflex — it also regenerates `mocks/harness-inputs.json`, silently resetting `"$container"` to the `"page"` default and discarding every input value you've filled in (a legal value, so nothing warns). Non-destructive: `-o <scratch>.json` to see the newly-discovered keys, then hand-merge just the new key(s) into your existing `harness-mocks.json`; reach for `--force` only when you also intend to redo `harness-inputs.json` |
| `DXS-NG-058` | `data generate` located the CAC's own generated component file but couldn't read it (locked, or not valid UTF-8) | re-materialize (`preview --refresh -b <branch>` or `pull`) and re-run `data generate` |
| `DXS-NG-052` | other agent-browser failure | `--clean`, re-run; report if reproducible |

**Session lifecycle (self-healing):** each preview runs agent-browser in a transient named session (`dxs-ng-preview-<port>`), torn down completely (daemon, Chrome tree, `~/.agent-browser/<session>.*` state files) after every run. The historical Windows named-session launch flake ("Chrome exited early … without writing DevToolsActivePort") is **auto-retried once** after tearing down the wedged session — you only see it if the retry also fails. `--clean` additionally reaps stale `dxs-ng-preview-*` state files left by crashed runs. Net effect: **a wedged preview is reset with `--clean`; manual killing of Chrome/daemon PIDs or hand-deleting `~/.agent-browser` files is never required** — if you find yourself needing that, it's a CLI regression to report (see [SKILL.md → CLI-first — no workarounds](../SKILL.md#cli-first--no-workarounds-hard-rule)).

**Disposal:** the warm dev server survives across previews by design (fast re-previews). When done, `dxs ng stop <folder>` tears down the server (identity-checked PID+image kill), the agent-browser session, and the lock file — idempotent, safe to call unconditionally. `--clean` is the same teardown followed by a fresh serve (reset); `pull --force` runs it implicitly before replacing the working copy. Manual lock-reading / `taskkill` is never required on a CLI that has `stop`.

**Remaining known gap:** leaked `agent-browser-chrome-*` temp profile dirs can still accumulate under `%LOCALAPPDATA%\Temp` — a toolchain gap to report, not to script around.

**Degraded-but-honest path when the browser step stays blocked (`DXS-NG-053`/`052`/`050`/`055` after `--clean`):** the visual loop is the acceptance test, but it is not the only gate — a `preview` that got past the build marker without `DXS-NG-057` proves the component compiles under `strictTemplates` (that's the step *before* the browser), `render.log` may still exist from the last successful capture, and `dxs ng push` still runs its two preflights and the server-side validator. If the user agrees to proceed without the screenshot, push, then say explicitly that the visual check was skipped and the rendered component must be eyeballed in Studio. Never present a push made this way as visually verified.

## Prerequisites

1. **A reachable Datex API for the target branch.** Harness codegen runs **server-side and is not environment-gated**: the deployed image installs Node and `codegen/node_modules` in its runtime stage so the API can run codegen on demand, so `create` / `pull` work against whichever Datex Application API the CLI is configured for, dev, qa or prod alike. (App **publish** is dev-gated — delegated to Azure DevOps outside Development — but that gate does not apply to these harness endpoints.)
2. **Authenticated** (`dxs auth status`).
3. **agent-browser** — the **unscoped** package: `npm install -g agent-browser` then `agent-browser install`. (Not `@anthropic-ai/agent-browser`.)
4. **`dxs` ≥ `0.6.0` for the embedding features this section documents** — check with `dxs --version`. **This version is not published yet** (the released version is `0.5.8`; `0.6.0` is decided but ships only once its own CLI plan lands and is released). Scope the gap correctly: embedding a component at all — `componentRefs`, the generated tags/classes, basic wiring — already works on the published CLI. What `0.6.0` adds is the `componentRefs` `kind` allow-list validation, the three new error codes (`DXS-NG-056`, `DXS-NG-057`, `DXS-NG-058`), and the `mocks/harness-inputs.json` fixture (including the `"$container"` widget/dashboard preview frame). On the published CLI: an unsupported `kind` is not caught locally, a compile error after a warm edit silently re-serves the last good screenshot with exit code `0` instead of raising `DXS-NG-057`, and there is no `"$container"` to preview a widget-destined CAC framed in its real 200px box (tab content and a page both render correctly without it — see [Authoring for a target](#authoring-for-a-target)).

## Timings (local, indicative)

| Phase | Cost |
|---|---|
| First `preview` after `create` | one-time `npm install` (minutes) + ~15–46s compile |
| Each later `preview` (warm) | ~10s |
| Edit → hot-reload (in-session) | ~4s |

Seconds-not-minutes after the one-time install — the light harness is what buys this.

## Common Patterns

### Data-driven visual from a computed getter

Body region holds the data + a computed value; the template renders it with `*ngFor` + style bindings (no chart lib needed for simple visuals):

```ts
//#region __COMPONENT_BODY__
bars = [ { label: 'Mon', value: 40 }, { label: 'Tue', value: 65 }, { label: 'Fri', value: 72 } ];
get total(): number { return this.bars.reduce((s, b) => s + b.value, 0); }
//#endregion __COMPONENT_BODY__
```

```html
<div class="bars">
  <div class="bar" *ngFor="let b of bars">
    <div class="fill" [style.height.%]="b.value"></div>
    <span>{{ b.label }}</span>
  </div>
</div>
<p>Total: {{ total }}</p>
```

### Reading real data via `$datasources`

**Create the datasource before you materialize the harness.** `$datasources.<ref>` resolves only for a real branch config — author it with `datasource-creator` (`dxs datasource generate` → `validate` → `dxs configuration upsert datasource`) **first**, then `dxs ng create`/`pull`, so the generated harness types the stub. `manifest.datasources` records the dependency; it never creates the datasource. (Added it after materializing? Re-materialize with `dxs ng pull` / `preview --refresh -b <branch>` and confirm it's listed in `angularapp/src/app/app.datasource.index.ts`.)

**Need the datasource's field shape for the row mapping? Use the CLI — never hand-parse the config JSON.** You must upsert before materializing anyway, so read the authoritative shape from the branch with `dxs report datasource-fields <ref> -b <branch>` (result type + `in_params` + flat field paths + collection nav-props). Validate the local generated file with `dxs datasource validate <file> -b <branch>` — exit **1** means it found errors (read `validation_errors` and fix; it is not a CLI malfunction) — and get its TypeScript type defs with `dxs datasource context <file> -b <branch>`. Do **not** reach for `jq`/`python` (or eyeball `outParams`/`queryOptionsObjectTypeDef`) to pull fields out of the JSON — that hand-parsing is a bad-experience workaround for commands that already exist. And after `dxs ng create`, the harness types `this.$datasources.<ref>` directly, so you often don't need a hand-written row interface at all — let the generated types drive the mapping.

Read it with **typed** access and keep the body clean — no cast, no embedded sample data, real empty/loading/error states. The body is spliced verbatim into the pushed config, so anything here ships to Studio:

```ts
//#region __COMPONENT_BODY__
rows: OrderRow[] = [];
loading = false;
error: string | null = null;

async ngOnInit() {
  if (this.inParams.orderId == null) { return; }   // real empty state — not fake data
  this.loading = true;
  try {
    const res = await this.$datasources.ds_orders.getList({ orderId: this.inParams.orderId });
    this.rows = res.result ?? [];                    // typed; in preview served from mocks
  } catch {
    this.error = 'Could not load orders.';
  } finally {
    this.loading = false;
  }
}
//#endregion __COMPONENT_BODY__
```

A missing datasource makes `this.$datasources.ds_orders` a **compile error** — that fail-fast is intended. Never cast it away (`$datasources as any`) or ship a fixture to hide it. Representative preview data goes in `mocks/harness-mocks.json` (seed with `dxs ng data generate`, then fill from a real dxs datasource/query) — transient, never pushed.

## Pre-Flight Checklist

The checklist lives in one place so it can't drift: run [../SKILL.md → Pre-Flight Checklist](../SKILL.md#pre-flight-checklist) before `push`. (Verification caveats — e.g. `dxs source explore configs`/`trace` not indexing type-36 — are in the parent skill's Common Mistakes table.)

## Cross-References

- [../SKILL.md](../SKILL.md) — the workflow and CLI lifecycle for this component type.
- [../../datex-studio-shared/branch-setup.md](../../datex-studio-shared/branch-setup.md) — branch selection (never assume a branch ID).
- [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md) — the `$`-globals injected into the component.
- [../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules (flows/datasources, not raw HTTP).
- [../../datasource-creator/references/datasources.md](../../datasource-creator/references/datasources.md) — authoring the datasources/flows a CAC reads.
- [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md) — reference-name / display-name rules.
- [../../datex-studio-shared/design-system/README.md](../../datex-studio-shared/design-system/README.md) — the Datex Studio App design system (vendored): tokens, class names, patterns; the per-target rules in [Authoring for a target](#authoring-for-a-target) point into `02-tokens.md`, `03-components.md`, `04-patterns.md`, `05-voice-and-copy.md`, `06-traps.md`.
- [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md) — the cross-component `moduleId` rule that `componentRefs[].module` follows, and how the wiring audit treats CAC references.
