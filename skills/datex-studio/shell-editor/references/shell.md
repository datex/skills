# Shell — Editing Reference

Authoritative reference for the Datex Studio **shell** singleton (`configurationTypeId: 1`, CLI type `shell`, fixed `referenceName: "shell"`). The shell is a package's application chrome: the logo, the home view, the left navigation (`menubar`), the top-right `toolbar`, a set of embedded flows, and the `on_init` boot flow that runs when the app mounts. It is one of the auto-provisioned singletons: the shared lifecycle (find the own row, edit in place; delete and re-create only from a saved body) lives in [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md); this doc covers only what is specific to the shell.

> Distilled from production components on a Footprint Manager package and the generated designer contexts, dxs 0.5.8.

## Purpose & When to Use

Edit the shell when the work is about **getting to** a component rather than the component itself:

- add, regroup, rename, or role-gate a navigation entry (`menubar`);
- add a toolbar button that opens a flyout view or runs a flow (`toolbar`);
- change the home view or the logo;
- run something once per app mount — register context, mount listeners, set the window title, hide navigation the user's roles don't allow (`on_init`).

The components the shell opens (hubs, grids, forms, lists, …) are authored with their own creator skills ([`hub-creator`](../../hub-creator/SKILL.md), [`grid-creator`](../../grid-creator/SKILL.md), [`form-creator`](../../form-creator/SKILL.md)); the shell only references them.

## File Location & Naming

- `configurationTypeId: 1`; CLI type argument **`shell`**.
- `referenceName` is **always `"shell"`**; `title` is the package name (observed on every sampled shell). One instance per package.
- Conventional file name `shell-shell.json` — a naming convention only; the branch is the system of record.
- Edited in place (delete and re-create only from a saved body, never a second instance) — see [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md).
- `dxs source branch shell <branchId>` prints the branch's **own** shell (body at `.shell.json`) — a quick read-only view without the `list` step.
- Menu/toolbar item `id`s are snake_case; `label`s are sentence-case display text. Toolbar icons conventionally carry `label: " "` (a single space).

## Minimal Valid Skeleton

The smallest body that validates — a home view and nothing else (`<home_hub>` must exist in `<Package>`, and the shell must carry a `configParameters` entry for each of its `inParams`; see Invocation Contract):

```json
{
  "logo": "assets/img/<logo>.svg",
  "subtitle": null,
  "home": { "icon": "icon-ic_fluent_home_20_regular", "label": "Home", "viewType": "hub",
            "viewConfig": { "configId": "<home_hub>", "moduleId": "<Package>" } },
  "menubar": [],
  "toolbar": null,
  "flows": null,
  "onInitFlowConfig": null,
  "configurationTypeId": 1,
  "id": "<own row id>",
  "referenceName": "shell",
  "title": "<Package>",
  "description": "<≤100 chars>",
  "inParams": null, "outParams": null, "vars": null, "events": null,
  "accessModifier": "public"
}
```

A working shape with one submenu of two views, a toolbar flow button, and a hardened `on_init` (validates clean against a real package):

```json
{
  "logo": "assets/img/<logo>.svg",
  "subtitle": null,
  "home": { "icon": "icon-ic_fluent_home_20_regular", "label": "Home", "viewType": "hub",
            "viewConfig": { "configId": "<home_hub>", "moduleId": "<Package>" } },
  "menubar": [
    { "id": "inbound", "icon": "icon-ic_fluent_arrow_download_20_regular", "label": "Inbound", "hasSubmenu": true,
      "menubar": [
        { "id": "inbound_orders", "icon": "icon-ic_fluent_box_20_regular", "label": "Inbound orders", "viewType": "hub",
          "viewConfig": { "configId": "inbound_orders_hub", "moduleId": "<Package>" } },
        { "id": "returns", "icon": "icon-ic_fluent_arrow_undo_20_regular", "label": "Returns", "viewType": "hub",
          "viewConfig": { "configId": "returns_hub", "moduleId": "<Package>" } }
      ] }
  ],
  "toolbar": [
    { "id": "help", "icon": "icon-ic_fluent_question_circle_20_regular", "label": " ", "flowConfig": { "flowId": "on_click_help" } }
  ],
  "flows": [
    { "enableProgressAndCancelation": false, "configurationTypeId": 9, "start": "step1",
      "nodes": [ { "id": "step1", "type": "step", "decisionConfig": null,
        "stepConfig": { "type": "ExecuteCodeActivity", "next": null, "error": null,
          "executeCodeConfig": { "code": "try {\n    $workspace.title = $context.app.name + ' ' + $context.env.name;\n} catch (e) {\n    console.error('shell on_init: title', e);\n}" } } } ],
      "id": null, "referenceName": "on_init", "title": "on_init", "description": "Runs once when the app shell mounts.",
      "inParams": null, "outParams": null, "vars": null, "events": null, "accessModifier": "public" },
    { "...": "on_click_help — same embedded-flow shape" }
  ],
  "onInitFlowConfig": { "flowId": "on_init" },
  "configurationTypeId": 1, "id": "<own row id>", "referenceName": "shell", "title": "<Package>",
  "description": "<≤100 chars>", "inParams": null, "outParams": null, "vars": null, "events": null, "accessModifier": "public"
}
```

Fetched bodies normalize every menu item to the full key set (`id, icon, label, viewType, viewConfig, flowConfig, flyoutSize, hasSubmenu, menubar`, unused ones `null`) and every `viewConfig` to `configParameters, configOutParameters, configEvents, outParamsChangeFlowConfig, configId, moduleId, isOwned`; leave the nulls as fetched.

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `logo` | App logo asset path | String path; the only static branding key besides `subtitle` |
| `subtitle` | Header subtitle | `null` on every sampled shell; also settable at runtime (`$workspace.subtitle`) |
| `home` | Landing view | **Required** — omitting it fails with `Home view is required` / `Home view type is required`. Shape `{icon, label, viewType, viewConfig}`, **no `id`**. `_TODO_`: home shape variants beyond a view item |
| `menubar` | Left navigation | Array of view items and submenus (below); `[]` is valid |
| `toolbar` | Top-right buttons | Optional array of view items, flow items, and submenus |
| `flows` | Embedded flows | Optional array of full cti-9 flow bodies; referenced by `referenceName` from `flowConfig.flowId` / `onInitFlowConfig.flowId`, callable in code as `$workspace.<flow>()` |
| `onInitFlowConfig` | Boot flow binding | `{ flowId: "on_init" }` or `null` |
| `configurationTypeId` | Type | `1` |
| `id` / `referenceName` / `title` | Identity | Own row id; `"shell"`; package name |
| `description` | Searchable description | `validate` accepts `null` here, but keep it non-empty ≤100 per the universal checklist |
| `accessModifier` | Visibility | `"public"` |
| `inParams` / `outParams` / `vars` / `events` | Unused tail | `null` |

### Menu item union

| Kind | Shape | Allowed in |
|---|---|---|
| **View item** | `{id, icon, label, viewType, viewConfig{configId, moduleId, configParameters?, configOutParameters?}, flyoutSize?}` | `menubar`, menubar submenus, `toolbar`, toolbar submenus |
| **Submenu** | `{id, icon, label, hasSubmenu: true, menubar[]}` | `menubar` and `toolbar` top level only |
| **Flow item** | `{id, icon, label, flowConfig{flowId}}` | **`toolbar` and toolbar submenus only** |

Placement rules enforced by `validate` (verified live, dxs 0.5.8):

- A flow item in `menubar` fails `Menu item should have a view type defined`; inside a menubar submenu it fails `Submenu item should have a view type defined`. Navigation entries are views; actions belong on the toolbar.
- Submenus nest **one level**: a submenu inside a submenu fails `Submenu item should have a view type defined` / `… should have a view defined`.
- Every item needs an `id`, unique among its siblings. A missing `id` breaks the generated `IShell` type (a cascade of `Property or signature expected` / `Cannot find name` errors); a duplicate fails `Duplicate identifier '<id>'`.
- `flyoutSize` (toolbar view items without a flow) is a number: `1` = Small, `2` = Standard, `3` = Large, `4` = Xlarge (captured from the Studio designer (option lists), dxs 0.5.8). The designer shows it only for a toolbar view item and requires it there; `2` and `3` are the values observed in production. `validate` does not range-check it — `5` also validates clean — so stay within 1–4.

### `viewType`

| Value | Status |
|---|---|
| `hub`, `grid`, `form`, `list`, `editor`, `customAngularComponent` | Observed in production shells |
| `dashboard`, `calendar`, `embed`, `codeEditor`, `visualization` | Offered by the designer and accepted by `validate`; rendering from the shell `_TODO_ (runtime unverified)` |
| `wizard`, `widget`, `card`, `selector`, `report`, `footprintQueryManager` | Rejected: `Menu item view type <Type> is not allowed` (probed with `wizard`, `report` and `footprintQueryManager`) |

The designer's view-type dropdown depends on the application type (captured from the Studio designer (option lists), dxs 0.5.8):

| Application | `viewType` values offered |
|---|---|
| Desktop | `calendar`, `codeEditor`, `customAngularComponent`, `dashboard`, `editor`, `embed`, `form`, `grid`, `hub`, `list`, `visualization` (labelled Calendar, Code Editor, Custom Angular, Dashboard, Editor, Embedded content, Form, Grid, Hub, List, Visualization) |
| Mobile | `form`, `editor`, `grid`, `list`, `embed`, `customAngularComponent` only |

Switching a menu item between a submenu, a view and a flow in the designer clears `viewType` and `viewConfig`; a flow item has `flowConfig` and no view.

`validate` resolves `viewConfig.configId` by name within `moduleId` (`Invalid contract. Referenced configuration <id> does not exist or has been renamed` when absent) but does **not** check that the target's type matches `viewType` — a hub's referenceName under `viewType: "dashboard"` passes. Match them yourself.

## Runtime Globals

Shell flows are UI-tier (browser) code. Verified by validate probes against the generated contexts:

- **`$workspace`** is the shell itself, typed `IShell`: `menubar.<id>.hidden`, `menubar.<id>.menubar.<childId>.hidden`, `toolbar.<id>.hidden` (and nested toolbar submenus), `title`, `subtitle`, `logo`, `addScript(EmbedScriptType.Inline | EmbedScriptType.External, data)`, and every embedded flow as `$workspace.<flow>()`. The typed surface is generated from the body's item ids, so a rename in the body renames the accessor.
- **`$shell`** inside shell code is the dialog/navigation service (`IShellService`) — not the shell component. Open views with `$shell.<Package>.open<referenceName>Dialog(...)`; package scoping per [runtime-globals.md → `$shell` Package Scoping](../../datex-studio-runtime/runtime-globals.md#shell-package-scoping--cross-package-dialogs).
- **`$context`** — execution context: `app.name`, `env.name`, `org`, `package` (used to build the window title).
- **`$operations.<Package>.<Op>.isAssignedToAll()` / `.isAssignedToAny()`** — role checks for gating navigation ([runtime-globals.md](../../datex-studio-runtime/runtime-globals.md) reference table).
- **`$flows`**, **`$frontendFlows`**, **`$utils`**, browser globals (`window`, `globalThis`) — standard UI-tier set per [runtime-globals.md](../../datex-studio-runtime/runtime-globals.md) and [calling-conventions.md](../../datex-studio-runtime/calling-conventions.md).
- Assigning an item's `icon` at runtime is done in shipped code through an index write (`$workspace.toolbar.<id>['icon'] = '…'`) because `icon` is not on the typed surface; `_TODO_ (runtime unverified)` as a supported API.

**Caller identity**: no user-identity global exists at the UI tier, but backend functions invoked from the shell run under the **caller's** authentication — derive it server-side: `const info = await $apis.<Pkg>.FootprintApi.GetCurrentUserInfo({}); info.UserName` inside the function, with the shell passing nothing user-specific.

### `$flows` runtime shape (verified live in Preview)

- `Object.keys($flows.<Module>)` enumerates **`_`-prefixed snake_case backing fields** (e.g. `_some_flow`) — not callable (`is not a function`).
- The **callable** is the un-prefixed referenceName, a non-enumerable prototype accessor. Dynamic dispatch: enumerate, strip the leading underscore(s), `typeof === 'function'` check, invoke. See [runtime-globals.md → `$flows` Runtime Shape](../../datex-studio-runtime/runtime-globals.md#flows-runtime-shape--dynamic-dispatch).
- A function call from a Preview build is an **XMLHttpRequest** (Angular `HttpClient`, not `fetch`) to `.../preview/<branchId>/<guid>/0/api/<Module>/unsecure/functions/<referenceName>` — the flow name is in the URL path, not the body. An `on_init` interceptor that wants to observe these calls must patch `window.XMLHttpRequest` before any flow executes.
- The Preview URL carries the branch id (`/preview/<branchId>/...`) — usable for per-branch attribution when no user identity is available.
- Storage rows written from Preview carry an automatic `appId` field (the application definition id); the implicit storage `id` appears as `_id` in raw Mongo.

## Invocation Contract

The shell is never opened by another component; it references others.

- **`moduleId` is the target's package**, routinely a different package from the shell's own (a shell commonly links hubs and grids from several packages). Wrong module → `Invalid contract. Referenced configuration <id> does not exist or has been renamed`. Rule: [component-wiring.md → Cross-Component References Use the Target's Module](../../component-wiring-check/references/component-wiring.md#cross-component-references-use-the-targets-module).
- **`configParameters` mirrors every target `inParam`**, optional ones included — a missing entry fails `Outdated contract. Missing input parameter <id>`. Rule: [component-wiring.md → Reference Contracts Include Every Target inParam](../../component-wiring-check/references/component-wiring.md#reference-contracts-include-every-target-inparam). Each entry is `{ parameter: {<full descriptor copied from the target inParam>}, value: "<string>" }`.
- **`configParameters[].value` is always a string**: `""` for not set, `"false"` / `"true"` for booleans, JSON-encoded text for objects (`"{\"string_1\": \"Transaction id\"}"`). It is an expression string per [file-format.md → Declarative String Values Are TypeScript Expressions](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions).
- **`flowConfig.flowId` / `onInitFlowConfig.flowId` name a flow in `flows[]`** by `referenceName`. `validate` does **not** catch a dangling flow id (verified live) — check it yourself.
- **`on_init` lifecycle**: a browser-tier flow that runs on app mount, **including Preview builds**. Branches created after the shell change is committed to the package's main line inherit it, so previewing any such branch fires that `on_init`.
- Editing a target's `inParams` later makes the shell's mirror stale — sweep the shell along with the target's other hosts (`component-wiring-check`).

## Shell Chrome Behavior

Derived by inspecting a built platform bundle (minified Angular), not from any dxs-exposed contract — treat class/method/tag names as **version-pinned**; re-verify after a platform upgrade before relying on them:

- The chrome's "refresh" (clicking the active breadcrumb) re-activates the crumb, which calls the hosted component's own `refresh()` — the same method flow code calls as `$grid.refresh()` / `$hub.refresh()`. There is no separate shell refresh API.
- The blade close button renders only when the navigation ("crumb") depth is **≥ 2** — the first view opened in a session has no close affordance, by design.
- A dialog-hosted component gets no breadcrumb entry, and the dialog wrapper has no refresh hook — a dialog's refresh can only be the hosted component's own refresh control.
- Dialogs ignore Escape: only the wrapper's close button closes one ([runtime-globals.md → `$shell` Dialogs Ignore Escape](../../datex-studio-runtime/runtime-globals.md#shell-dialogs-ignore-escape)).
- The app shell's host element is tagged `wavelength-ui-shell` in the observed bundle — a DOM-query anchor for browser automation against the running app, not a stable platform API.

## Common Patterns

### Harden `on_init`

A boot failure must never break app mount. Wrap **every** independent step in its own `try/catch`, so one failing registration doesn't skip the rest:

```ts
try { await $frontendFlows.<Package>.<mount_listeners_frontflow>({}); }
catch (e) { console.error('shell on_init: listeners', e); }

try { $workspace.title = $context.app.name + ' ' + $context.env.name; }
catch (e) { console.error('shell on_init: title', e); }

try { await $flows.<Package>.<register_session_flow>({}); }          // backend; derives caller identity server-side
catch (e) { console.error('shell on_init: session', e); }
```

### Role-gated navigation

Hide first, then reveal what the user's roles allow — so a slow or failed check leaves the entry hidden rather than flashing. `Disable_*` operations gate with `isAssignedToAll()` (hide when every role carries it); `Enable_*` operations with `isAssignedToAny()`:

```ts
try {
  $workspace.menubar.inbound.hidden = true;
  $workspace.menubar.inbound.hidden = await $operations.<Package>.Disable_Navigation_Inbound.isAssignedToAll();
  $workspace.menubar.settings.menubar.<feature>.hidden =
    !(await $operations.<Package>.Enable_<Feature>.isAssignedToAny());
} catch (e) { console.error('shell on_init: menu gating', e); }
```

Shipped gating code evaluates parents first and leaves the children of a hidden parent untouched. Declare the `Disable_*` / `Enable_*` operation itself with [`authorization-editor`](../../authorization-editor/references/authorization.md) — this pattern only reads operations already registered there.

### Toolbar flow button

A toolbar item with `flowConfig{flowId}` runs an embedded flow — open a flyout view, inject a third-party widget (`$workspace.addScript(EmbedScriptType.Inline, scriptText)`), or call another shell flow (`$workspace.<flow>()`). For a plain "open this view" button prefer a **view item** with `flyoutSize` instead of a flow.

### Preview telemetry bootstrap

`on_init` logs a session-start event through a backend function, then optionally installs a fail-safe XHR interceptor to observe backend function calls (see `$flows` runtime shape above). Every step inside try/catch.

## Pre-Flight Checklist

1. **Own row only** — `applicationId == branchId`, `isExternal == false`; edit the shell in place; delete and re-create only from a saved body, never a second one ([../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md)).
2. **Fixed identity** — `referenceName: "shell"`, `configurationTypeId: 1`, `title` unchanged; `description` non-empty ≤100 — plus the universal checks ([../../datex-studio-conventions/universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)).
3. **`home` present**, no `id`.
4. **Item placement** — flow items only on the toolbar; submenus one level deep; menubar submenu children are views.
5. **Ids** — every item has a snake_case `id`, unique among siblings; renaming an id renames its `$workspace` accessor, so grep `on_init` and the other shell flows for the old name.
6. **`viewType` matches the target's actual type** and is on the allowed list; `validate` checks neither the match nor runtime support for the unobserved values.
7. **`moduleId` = the target's package**; **`configParameters` mirror every target inParam** with string `value`s.
8. **Every `flowId` resolves** to a `flows[]` entry (not checked by `validate`).
9. **`on_init` hardened** — every step in try/catch; caller identity derived in a backend function.
10. **Validate before the write** — `dxs configuration validate shell`; exit 1 = findings, not a broken CLI.

## Cross-References

- [../../datex-studio-shared/singleton-config-lifecycle.md](../../datex-studio-shared/singleton-config-lifecycle.md) — own-row discovery, `readonly`, write path, never-create rule
- [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md) — `moduleId` and `configParameters` contract rules for every `viewConfig`
- [../../hub-creator/references/hubs.md](../../hub-creator/references/hubs.md), [../../grid-creator/references/grids.md](../../grid-creator/references/grids.md), [../../form-creator/references/forms.md](../../form-creator/references/forms.md) — the usual navigation targets
- [../../custom-angular-component-creator/SKILL.md](../../custom-angular-component-creator/SKILL.md) — `customAngularComponent` targets
- [../../dashboard-creator/references/dashboards.md](../../dashboard-creator/references/dashboards.md) — `dashboard` targets
- [../../authorization-editor/references/authorization.md](../../authorization-editor/references/authorization.md) — declaring the `Disable_*` / `Enable_*` operations read by role-gated navigation
- [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md) — UI-tier globals, `$operations`, `$shell` scoping and Escape behaviour, `$flows` shape
- [../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md) — UI → function tier rules
- [../../datex-studio-shared/frontend-flows.md](../../datex-studio-shared/frontend-flows.md) — frontend flow semantics (listeners, DOM side effects)
- [../../datex-studio-shared/configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md) — envelope / inner-body rule, validate exit codes
