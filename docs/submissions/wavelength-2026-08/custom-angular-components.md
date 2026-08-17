# Custom Angular Components

Custom angular components (configurationTypeId **36**) are the platform's newest UI component type: a free-form Angular component — class body, HTML template, and SCSS — embedded directly in a configuration. Unlike declarative UI components (hubs, grids, forms, editors), nothing is generated from schema: the author writes real Angular code and the platform compiles it into the app shell. Data access flows through the same `$datasources` surface as generated components. See [`../datex-studio-conventions/file-format.md`](../datex-studio-conventions/file-format.md) for the general file-format rules and [`../datasource-creator/references/datasources.md`](../datasource-creator/references/datasources.md) for the backing-datasource taxonomy.

## Purpose & When to Use

Dashboards, control centers, and bespoke visualizations that the declarative component set cannot express — multi-panel live views, custom SVG charts, mixed list/detail interactions, auto-refresh telemetry screens. Prefer a hub/grid/editor when the screen is fundamentally tabular or entity-CRUD-shaped; reach for a custom angular component when layout and interaction are the point. All data access still goes through datasources, so business logic belongs in flows/actions behind a datasource, not in the component.

## File Location & Naming

The branch is the source of truth; the conventional export layout:

- Path: `src/<Package>/custom-angular/<name>-customAngularComponent.json`
- Suffix: `-customAngularComponent.json`
- `referenceName`: snake_case, matches the filename stem. `title` is user-facing sentence case.
- Server-side type name: `customAngularComponent` (as reported by `dxs source changes`).

## Minimal Valid Skeleton

```json
{
  "code": {
    "componentTypes": "",
    "componentBody": "  someField: string = '';\n\n  async ngOnInit() {\n  }\n",
    "template": "<div class=\"component-root myns\">\n</div>\n",
    "styles": ".myns {\n}\n"
  },
  "configurationTypeId": 36,
  "id": 0,
  "referenceName": "<name>",
  "title": "<Sentence-case title>",
  "description": "<≤100 chars>",
  "inParams": [],
  "outParams": [],
  "vars": null,
  "events": null,
  "accessModifier": "public"
}
```

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `code.componentTypes` | _TODO_ (observed empty string `""` in the wild) | Keep `""` until its purpose is documented |
| `code.componentBody` | Angular **class body only** | Fields, getters, methods, `ngOnInit`/`ngAfterViewInit`/`ngOnDestroy`. **No** class wrapper, **no** `@Component` decorator, **no** `import` statements |
| `code.template` | Classic Angular HTML template | `*ngIf` / `*ngFor` / `[ngClass]` / `(click)` / `[ngModel]` — classic directives, no signals / new control flow |
| `code.styles` | SCSS | Namespace everything under one root class; consume platform CSS vars (`--cui-*`, `--color-*`, `--background*`) with fallbacks so theming/dark mode follow the app |
| `configurationTypeId` | Always `36` | |
| `id` | Component identity | `0` for a new component; Studio assigns the real id |
| `referenceName` | Code-facing handle | snake_case |
| `description` | Mandatory, ≤100 chars | Platform limit; imports are rejected silently above it |
| `inParams` | Injected as `this.inParams.<id>` | Fat parameter descriptors, snake_case ids |
| `outParams` | Observed `[]` | _TODO_: whether non-empty outParams are supported |
| `vars` / `events` | Observed `null` | _TODO_ |
| `accessModifier` | `public` per [defaults](../datex-studio-conventions/defaults.md) | |

**Line endings: all three code strings use LF (`\n`) — never CRLF.** This differs from many action/function code strings, which are CRLF in several packages.

## Platform-Integration Surface

What the component code can reach at runtime:

> Naming note: the in-house reference component `totenization_control_center` was forked, restyled, and renamed to **`totenization_control_center_angular`** on 2026-07-27 — the `_angular` component is now the canonical implementation. Dated citations below that use the old referenceName describe the same component pre-rename.

- **`this.$datasources.<Package>.<ds>.{get,getList,getByKeys}(...)`** — VERIFIED (production reference `outbound_command_center` uses it throughout). Returns the standard `{ result, totalCount }` shapes. This is the verified data path; to invoke an action from the UI, wrap it action → wrapper function → single-result flows-datasource and call the datasource's `.get({...})`.
- **`this.inParams.<id>`** — VERIFIED; inParams are injected onto the instance.
- **`this.$frontendFlows.Utilities.open_toaster_success_frontflow({ title })` / `open_toaster_error_frontflow({ title, message })`** — VERIFIED (user runtime-tested in `totenization_control_center`, 2026-07-21). Guard with optional chaining (`this.$frontendFlows?.Utilities?...`) and fall back to inline text if absent.
- Platform template elements **`<app-selector>`** (with `[displayWithFn]` / `[optionsFn]` promise-returning callbacks) and **`<app-datebox>`** — VERIFIED in the reference.
- **`this.$operations.<Pkg>.<Operation>.isAssignedToAll()`** — **VERIFIED** (2026-07-23: `totenization_control_center` Preview console logged the probe resolving a real boolean via `(this as any).$operations.Totes.Disable_Totenization_Management.isAssignedToAll()`). Semantics gotcha: `isAssignedToAll()` is true only when the operation is assigned to **every** role the current user holds — a user with one exempt role resolves false, which is the platform's disable-operation convention, not a bug. Keep the defensive shape regardless (try/catch fail-open, own package first, then scan `Object.keys(ops)` — registration package may differ from the component's package; access via `(this as any)` so a missing base-class typing cannot break the frontend build). The host-passed inParam (see Common Patterns) remains a valid authoritative override and composes with the probe (inParam wins when provided).
- **`this.$shell.<Pkg>.openConfirmationDialog(title, body, continueText, cancelText)` → `Promise<boolean>`** — ATTEMPTED WITH FALLBACK, pending runtime confirmation (`totenization_control_center`, 2026-07-22): accessed via `(this as any).$shell` with a `typeof fn === 'function'` guard; when the surface is absent or the call throws, the component falls back to a two-click confirm pattern and logs one `console.warn`. Do not rely on it as the only confirmation path until runtime-verified.
- **`this.$flows` / rest of `this.$shell` / `this.$settings` / `$utils`** — UNVERIFIED in this component type; no observed usage. Do not assume they exist until proven on a branch.
- Browser APIs (`setInterval`, `document.hidden`, `visibilitychange`) work as in any Angular component — clear timers and remove listeners in `ngOnDestroy`.

## Invocation Contract

**A custom angular component is opened exactly like any other component: through `$shell`.** VERIFIED 2026-08-17 by reading live consumers — the component type needs no special opener and no module wiring beyond the usual package reference.

| Form | Call | Use |
|---|---|---|
| Dialog / flyout | `await $shell.<Package>.open<referenceName>Dialog(payload, 'flyout' \| 'modal', EModalSize.<Size>)` | The component is a focused task opened over the current screen |
| Full view | `await $shell.<Package>.open<referenceName>(payload)` | The component replaces the current view |

Both forms follow the platform's usual `open<referenceName>` / `open<referenceName>Dialog` naming — the `referenceName` is spliced in verbatim, so `inventory_status_configuration` becomes `openinventory_status_configurationDialog`.

Observed consumers:

- `Waves.single_wave_hub` → `$shell.Totes.opentotenization_control_center_angular({ wave_id, warehouse_id })` (full view) and `$shell.FootprintManager.openwarehouse_command_center({ warehouseId, waveId })`
- `FootprintManager.sales_order_editor` → `$shell.Totes.opentotenization_control_center_angularDialog({ order_id, warehouse_id }, 'flyout', EModalSize.Xlarge)`
- `FootprintManager.awi_configurations_hub` / `awi_configurations_grid` → `$shell.Inventory.openinventory_status_configurationDialog({ config_id, filters_json }, 'flyout', EModalSize.Xlarge)`

Two constraints that follow from this, both worth knowing before you design the payload:

- **The caller must reference the component's package.** `$shell.<Package>` only carries components from packages the calling app references, and it resolves against the **published** release of that package — so a brand-new component does not appear to its consumers until the owning package publishes. Validation fails with `Property 'open<referenceName>Dialog' does not exist on type '{ … }'`, and the error usefully enumerates the sibling `open*` methods that *do* exist, which is how you confirm the package reference itself is fine and only the component is missing.
- **Keep inParams primitive.** Custom angular components are UI components, so the [UI-component enum FQN constraint](../type-definition-creator/references/type-definitions.md#ui-components-cannot-reference-custom-enums-in-vars--inparams--outparams) applies to their `inParams`. Objects and maps are best passed as JSON strings and parsed inside the component (`filters_json` above), which also keeps the calling dispatch code type-stable.

## Common Patterns

### Auto-refresh with stale-response guard

Keep a monotonically increasing `requestSeq`; capture `const seq = ++this.requestSeq` before each fetch and drop responses where `seq !== this.requestSeq`. Pause the `setInterval` tick while `document.hidden`, and refresh immediately on the `visibilitychange` listener when returning.

### UI-triggered mutations via a flows-datasource bridge

UI tier cannot call actions. Chain: action (server, transactional) → wrapper function (maps errors into a `reasons` collection) → single-result flows-datasource whose `getFlow` calls the wrapper. The component calls `this.$datasources.<Pkg>.<bridge_ds>.get({ op, ... })` and inspects `result.reasons*` for business refusals. Collections that must cross the bridge can ride as JSON strings (e.g. `task_ids_json`) to keep the datasource inParams primitive.

### Operation gating via a host-passed inParam (RECOMMENDED)

`$operations` injection is verified (2026-07-23), so the in-component probe is a legitimate primary path; the host-passed inParam remains valuable as an authoritative override and for hosts that want to decide gating centrally. Declare an optional boolean inParam (e.g. `management_disabled`) and treat a **strict boolean** value as authoritative, skipping the probe entirely; fall back to the `$operations` probe (own package first, then a cross-package scan) only when the host passed nothing. The host — a hub button flow or shell opener, where `$operations` IS a verified surface — computes `await $operations.<Pkg>.<Operation>.isAssignedToAll()` and passes the result in. This is platform-idiomatic (gating decided in verified tiers, UI only renders it) and degrades gracefully: no inParam + no injected surface = fail-open with a diagnostic `console.warn` that logs `typeof $operations` and its `Object.keys` so "not injected" is distinguishable from "injected but differently shaped". Reference implementation: `totenization_control_center_angular.checkOperationGate` (also defaults its gate flag to hidden-while-resolving so gated affordances never flash).

### Dangerous actions without dialogs

No dialog service is verified in this component type; use a two-click confirm (first click arms — button re-renders as "Confirm …?" — second click executes; any other interaction disarms).

## Pre-Flight Checklist

1. All three `code` strings use **LF** line endings — no `\r` anywhere in the file's code strings.
2. `componentBody` is a class body only: no `class`/decorator/imports; lifecycle hooks written as plain methods.
3. Template uses classic Angular syntax only (no `@if`/`@for`, no signals).
4. Styles are namespaced under a single root class and use platform CSS vars with fallbacks.
5. Every `this.$datasources.<Pkg>.<ds>` referenced exists on the target branch **before** the component lands (validate/upsert datasources first).
6. `description` non-empty and ≤100 chars; `accessModifier` set; inParams snake_case.
7. Timers/listeners created in `ngOnInit` are torn down in `ngOnDestroy`.
8. **dxs `configuration` sub-commands: NONE as of dxs 0.4.12** (re-probed 2026-08-17; unchanged since 0.4.7) — the CLI's `configuration types` whitelist still lists 29 names with no mapping to cti 36 (server name `customAngularComponent`), and `customangularcomponent` / `customangular` / `angularcomponent` all fail. `dxs configuration list` and `dxs source explore configs` also omit the type entirely, so a cti-36 component is invisible to every discovery command. Re-probe after CLI upgrades.
   **The browser is not required, though — `dxs api` reaches the type directly.** VERIFIED 2026-08-17 by creating `FootprintManager.entity_custom_fields` (id 10707315) on branch 93203 and reading it back byte-identical (all three code strings, LF preserved):

   | Operation | Call |
   |---|---|
   | List | `dxs api GET /applications/<branch>/customangularcomponentconfigurations --raw -O list.json` |
   | Read | `dxs api GET /applications/<branch>/customangularcomponentconfigurations/<id> --raw -O env.json` → body is at `.json`, same envelope as every other type |
   | Create | `dxs api POST /applications/<branch>/customangularcomponentconfigurations -D body.json --raw` → returns the created record with its assigned `id` |
   | Update | `dxs api PUT /applications/<branch>/customangularcomponentconfigurations/<id> -D body.json --raw` (lock first, as for any inherited config) |

   The endpoint segment is `customangularcomponentconfigurations` — the near-miss spellings (`customangularconfigurations`, `angularcomponentconfigurations`, `customcomponentconfigurations`) all return the SPA's `index.html` with a 200, so **check `content-type: application/json` before trusting a response**; an HTML body means the segment is wrong, not that the branch is empty.

   Because `dxs configuration validate` is still unavailable for this type, run the checks above as **explicit assertions in whatever builds the file** rather than trusting them: no `\r` in any of the three code strings, no `class` / `@Component` / `import` at the top level of `componentBody`, no `@if` / `@for` / `@switch` in the template, `description` ≤ 100 chars. Then confirm every `$datasources.*` and `$frontendFlows.*` the component names actually exists on the target branch (`dxs configuration list datasource -b <branch>`) — that is the check the missing validate would otherwise have caught first.
9. **Unverified control inputs are a build-time failure, not a runtime one.** Angular rejects a binding to an input a component does not declare (`Can't bind to 'disabled' since it isn't a known property of 'app-datebox'`), and that kills the whole Preview build. `[disabled]` is verified on `<app-selector>` but **not** on `<app-datebox>`. When a field can be read-only, render a plain text branch for the locked state (`*ngIf="isLocked(f)"`) instead of binding `[disabled]` on a platform element whose input list you have not confirmed.

## Cross-References

- [`../datasource-creator/references/flow-datasources.md`](../datasource-creator/references/flow-datasources.md) — the flows-datasource bridge shape used for UI-triggered mutations.
- [`../datex-studio-runtime/calling-conventions.md`](../datex-studio-runtime/calling-conventions.md) — UI-tier rule (UI cannot invoke actions directly).
- [`../datex-studio-conventions/defaults.md`](../datex-studio-conventions/defaults.md) — description/accessModifier defaults.
- Reference implementation: `src/SalesOrders/custom-angular/outbound_command_center-customAngularComponent.json` (id 9965353, SalesOrders branch 88904).
