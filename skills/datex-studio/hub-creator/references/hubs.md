# Hubs

Hubs mount grids, forms, editors, and custom Angular components (CACs) inside their tabs and dialogs — see also [`grids.md`](../../grid-creator/references/grids.md), [`forms.md`](../../form-creator/references/forms.md), [`editors.md`](../../editor-creator/references/editors.md), [`custom-angular-components.md`](../../custom-angular-component-creator/references/custom-angular-components.md).

A **hub** is a top-level UI container: a screen with input filters, grouping options, and one or more tabs that host grids or other UI components. Hubs are the primary way features surface themselves in the platform UI — each major workflow typically has a hub as its landing page.

## Purpose & When to Use

Use a hub when:

- The feature needs a **top-level screen** users navigate to directly.
- The UI is filter-driven — users choose scope (a project, a date range, a contract) and the tabbed content responds.
- Multiple related views of the same domain data share a filter set (tabs let the user switch between views without re-entering filters).

Don't use a hub for:

- **Detail/edit flows on a single record** — that's an editor ([`editors.md`](../../editor-creator/references/editors.md)) opened as a dialog, usually from a grid row click inside a hub tab.
- **Transient input collection that returns a payload** — that's a form ([`forms.md`](../../form-creator/references/forms.md)), also typically opened as a dialog.
- **Embedded views inside another screen** — hubs are top-level by convention; nested usage is rare.

## File Location & Naming

- File name: `<name>_hub-hub.json` (`referenceName` stem + suffix). The component lives on the branch — this is the naming convention, not a local `src/` path.
- Suffix: `-hub.json`
- `configurationTypeId`: `2`
- Naming: the component `referenceName` and filename stem both end with `_hub` (e.g. `invoicing_rules_hub-hub.json` → referenceName `invoicing_rules_hub`). See [`naming-conventions.md`](../../datex-studio-conventions/naming-conventions.md).
- Default package: `Utilities` unless otherwise specified; a hub belonging to a specific feature package (e.g. `Invoices`, `FootprintManager`) is set explicitly via whatever package-retargeting step the platform uses at import.
- Default access modifier: `public`.

## Minimal Valid Skeleton

Hubs are large in practice — the skeleton below shows the top-level shape only. A real hub populates `toolbar`, `filters`, `groupByOptions`, `tabs`, `flows`, and `onInitFlowConfig` substantially.

```json
{
  "configurationTypeId": 2,
  "id": 0,
  "referenceName": "<name>_hub",
  "title": "<Display title>",
  "description": "<≤100 chars>",
  "accessModifier": "public",
  "icon": null,
  "inParams": [
    "<any inbound filter defaults (e.g. projectId, billingContractId)>"
  ],
  "outParams": [],
  "vars": null,
  "events": [],

  "toolbar": ["<top-right buttons: refresh, manage split-button, settings, ...>"],
  "filters": ["<filter control definitions — selectors, date pickers, text boxes>"],
  "groupByOptions": ["<optional grouping toggles that re-shape tab content>"],
  "tabs": ["<one or more tabs, each mounting a grid or other component via configParameters>"],

  "flows": ["<local flows: on_load, on_filter_change, button click handlers>"],
  "onInitFlowConfig": {"flowId": "<flow reference>", "flowParameters": [...]},

  "baseConfiguration": null
}
```

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `configurationTypeId` | Component kind identifier | Always `2` for hubs |
| `id` | Component identity | Stable id; don't reuse across environments |
| `referenceName` | Code-facing handle | Snake_case with `_hub` suffix; matches filename stem |
| `title` | Display title | Shown in navigation and tab chrome |
| `description` | Searchable description | ≤ 100 chars (SQL column limit) |
| `accessModifier` | Visibility | Default `public` |
| `inParams` | Inbound filter/context values | Typically defaults for the hub's filters (e.g. a projectId passed in from a parent navigation) |
| `outParams` | Outbound values | Usually empty — hubs are terminal UI |
| `filters` | Filter controls | Each control binds to a state variable that tabs read; empty `[]` for hubs with no filters |
| `tabs` | Tab definitions | At least one tab; each references a grid or other component with a full `configParameters` contract |
| `onInitFlowConfig` | Load hook | Runs when the hub opens — typical home for initial-filter defaulting, context loading |

Optional but common:

- `toolbar` — action buttons at the hub level (refresh, export, manage-templates, debug, etc.).
- `widgets` — dashboard-style widget references (`WidgetDesignerReferenceConfig`) rendered in the hub's widget area, distinct from `tabs`. Used for at-a-glance summary cards above or alongside the tab content.
- `groupByOptions` — toggles that change how tab content groups/filters its rows.
- `flows` — local flows invoked by filter changes, button clicks, tab events.

## Runtime Globals

Hub-owned code strings (flows, button handlers, filter-change hooks) have access to the platform-wide globals ([`runtime-globals.md`](../../datex-studio-runtime/runtime-globals.md)) plus a hub-specific `$hub` context:

| Field | Purpose |
|---|---|
| `$hub.inParams` | Values passed to the hub at open time — e.g. a `projectId` scoping filter defaulted from parent navigation. |
| `$hub.filters.<id>.control` | The filter's rendered control. `.value` is read/write; writing updates the UI and propagates to tabs. Follow-up `.readOnly`, `.disabled`, `.hidden`, `.label`, `.styles.setStyle(...)` / `.styles.resetClasses()` mirror the common control surface. |
| `$hub.filtersets.<id>.hidden` | Hide / show a whole filter group (`filters[]` entry, not an individual field). Used for banner-style filter sets that toggle on warnings. |
| `$hub.toolbar.<id>.control` | Programmatic access to a toolbar button. `.readOnly`, `.hidden`, `.label`, `.icon` are the common handles during a click flow (e.g. `$hub.toolbar.save.control.readOnly = true` while work is in flight). |
| `$hub.tabs.<id>.hidden` | Hide a tab — useful for role-gated tabs. |
| `$hub.vars.<id>` | Hub-scoped mutable state. **Every var written in flow code must be declared in the hub's top-level `vars` array** — see [`component-wiring.md` → Component Variables Must Be Declared](../../component-wiring-check/references/component-wiring.md#component-variables-must-be-declared). |
| `$hub.refresh()` | Re-runs the hub's filter binding, causing every mounted tab to re-query. Call after state changes that should propagate into tab content. |
| `$hub.close()` | Closes the hub (used during the `on_init` access-gate pattern). |
| `$hub.<local_flow_name>(...)` | Hubs can invoke their own locally declared flows directly as `$hub.<referenceName>(...)`, passing any inParams. Used to factor shared logic (e.g. `$hub.refresh_engine_state()`) across handlers without round-tripping through `$flows`. |

UI-tier calling rule still applies: from hub code, invoke functions via `$flows.<Package>.<fn>` and open forms/editors via `$shell.<Package>.open<referenceName>Dialog(...)` — never call actions directly ([`calling-conventions.md`](../../datex-studio-runtime/calling-conventions.md)).

## Invocation Contract

Hubs are typically **entry points from platform navigation** rather than things other components reference. They don't get opened as dialogs and don't return values; the I/O surface is the filter bar plus any toolbar-driven side effects.

Outbound references — from a hub into grids (via tabs), selectors (via filter fields), and forms/editors (via dialog openers in click flows) — all obey the platform's cross-component rules:

- Use the target's package as `moduleId` ([`component-wiring.md` → Cross-Component References Use the Target's Module](../../component-wiring-check/references/component-wiring.md#cross-component-references-use-the-targets-module)).
- Match the target's `inParams` shape **exactly** in `configParameters` — every declared inParam appears (with explicit `null` / `""` on unused ones), and no extra entries beyond what the target declares ([`component-wiring.md` → Reference Contracts Include Every Target inParam](../../component-wiring-check/references/component-wiring.md#reference-contracts-include-every-target-inparam)). **Grid tabs are the most common trip-wire here** — a grid declaring `captureDate`, `projectIds`, `warehouseId`, `materialIds` (optional) needs all four entries in the tab's `configParameters`, and declaring a fifth like `fullTextSearch` that the grid doesn't actually expose is dead wiring — the tab silently fails to pass the value in.
- Tab `configParameters[].value` is a TypeScript expression ([`file-format.md` → Declarative String Values Are TypeScript Expressions](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions)). The usual binding is `"$hub.filters.<id>.control.value"`; unused params take `""`.

Opening a form from a toolbar/row handler uses the generated `$shell.<Package>.open<referenceName>Dialog(...)` opener and awaits the target form's `outParams`:

```ts
const result = await $shell.Acme.openwidget_option_formDialog('flyout', EModalSize.Standard);
if (result?.is_confirmed) { $hub.refresh(); }
```

See `$shell` under [`runtime-globals.md`](../../datex-studio-runtime/runtime-globals.md) for the full set of built-in and generated openers.

## Common Patterns

**Filter-driven tab content.** Declare shared scoping inputs (date, project, warehouse) as hub filters, then bind them into every tab's `configParameters` with `"$hub.filters.<id>.control.value"`. Tabs re-query automatically when filter values change; no explicit wiring in `flows`.

**Engine / schedule toggle on the toolbar.** A hub that owns a cron-scheduled engine typically exposes an on/off toolbar button. Source-of-truth the state from the schedule itself (`$flows.<Package>.get_<feature>_configuration_schedule_flow`), store the boolean in a declared `$hub.vars.engine_on`, and have the click flow call `set_<feature>_configuration_schedule_flow` then re-read. Keep the button's `label` / `icon` bound to the current state — don't maintain a parallel config flag.

**"Configure options" dialog opener.** Per-hub configuration forms are opened with a toolbar button whose click flow calls the generated `$shell.<Package>.open<form_referenceName>Dialog(...)`. Have the form set an `is_confirmed`-style outParam on save; the hub then `$hub.refresh()`-es only when the flag comes back truthy, so a cancelled dialog doesn't needlessly re-query.

**Access-gated `on_init`.** When a hub should be invisible to unauthorized users, run the permission check at the top of `on_init`, then call `$hub.close()` on deny. Role/capability-specific toolbar buttons get their `.hidden` flipped on the same code path before the hub renders.

**Reusing shared filter values across handlers.** When multiple click handlers need to read/write the same transient hub state (a schedule-state snapshot, derived labels), declare a local flow inside the hub (`refresh_engine_state`, `check_for_messages`, etc.) and invoke it via `$hub.<flow_name>()` from both `on_init` and the relevant handlers — keeps the logic single-sourced.

**Designing a hub filter and its tab's grid together.** Hub filters that scope a tab's content only work if the target grid actually declares matching `inParams`. Authoring a `projects` filter on the hub and binding it as `projectIds` on a tab's `configParameters` without the grid itself having a `projectIds` inParam is dead wiring — the value is silently dropped because there's no parameter on the other side for it to land on. When a hub filter exists to scope a specific tab's grid (rules grid scoped by `owner_ids` / `project_ids` / `warehouse_ids`; a documents grid scoped by `contract_id`), audit the grid's top-level `inParams` in the same edit and extend the grid to declare every id the hub wants to pass through. Flows inside the grid then read `$grid.inParams.<id>` when building the datasource call, so the datasource also needs the matching declaration. The rule of thumb: **every binding in a tab's `configParameters` must be named in the mounted grid's `inParams`** — otherwise either the grid binding is wrong or the grid is missing a declaration.

## Pre-Flight Checklist

1. **Top-level fields.** `configurationTypeId: 2`, `referenceName` ending in `_hub` and matching the filename stem, `description` non-empty and ≤ 100 chars, `accessModifier` set (default `public`).
2. **Tabs carry full `configParameters` contracts.** Every `inParam` of the mounted grid/component appears with its correct `id` / `type` / `isCollection` / `required`; unused inputs use `value: ""` or `value: null`. **No extra entries** — a `configParameter` whose `id` is absent from the grid's `inParams` is dead wiring; if the binding is needed, extend the grid in the same edit. `moduleId` on each `contentConfig` points at the target's package, not the hub's.
3. **Filter bindings.** Each filter field's `configId` / `moduleId` resolves to a real selector; every selector `configParameter` it declares gets an entry in the filter's `dropdownConfig.configParameters`, with `value: ""` for ones that don't apply. Filters that feed required grid inputs are marked `required: true` on the filter field and in the tab's `configParameters`.
4. **Var declarations.** Every `$hub.vars.<id>` written in flow code has a matching entry in the hub's top-level `vars` array ([`component-wiring.md` → Component Variables Must Be Declared](../../component-wiring-check/references/component-wiring.md#component-variables-must-be-declared)).
5. **Calling-tier compliance.** Any `$flows.<Package>.<fn>` invoked from hub code strings is a function (not an action); trigger actions by wrapping them in a function ([`calling-conventions.md`](../../datex-studio-runtime/calling-conventions.md)). Dialog openers use `$shell.<Package>.open<referenceName>Dialog(...)`.
6. **Toolbar / tab IDs are unique within the hub.** Flow code addresses them by `id` (`$hub.toolbar.save.control...`, `$hub.tabs.rules.hidden = ...`) — collisions silently overwrite.
7. **TypeScript-expression string fields.** `hubTitle`, `hubDescription`, any `value` / `tooltip` / `placeholder` / `label` slot on filter controls or toolbar buttons follows the three-encoding rule ([`file-format.md` → Declarative String Values Are TypeScript Expressions](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions)) — e.g. hub title wrapped in backticks: `` "`Widget overview`" ``.

## Cross-References

- [`runtime-globals.md`](../../datex-studio-runtime/runtime-globals.md) — platform-wide globals available inside hub code.
- [`calling-conventions.md`](../../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules.
- [`component-wiring.md`](../../component-wiring-check/references/component-wiring.md) — host reference contracts and var declarations.
- [`file-format.md`](../../datex-studio-conventions/file-format.md) — `configurationTypeId` table and editing rules.
- [`grids.md`](../../grid-creator/references/grids.md) — the component most commonly mounted inside hub tabs.
- [`forms.md`](../../form-creator/references/forms.md) / [`editors.md`](../../editor-creator/references/editors.md) — dialog components hubs open via row actions or toolbar buttons.
- [`selectors.md`](../../selector-creator/references/selectors.md) — the component backing hub filter dropdowns.

_The Minimal Valid Skeleton above is intentionally terse — a real hub's `toolbar` / `filters` / `tabs` / `flows` arrays grow substantially. Expand specific sections above (Runtime Globals, Invocation Contract, Common Patterns, Pre-Flight Checklist) for the patterns that fill those bodies out._
