---
name: shell-editor
description: |
  Use when editing a package's Datex Studio shell singleton (configurationTypeId=1,
  CLI type `shell`, fixed referenceName `shell`) on a branch — the app chrome:
  logo, home view, left navigation `menubar`, top `toolbar`, embedded flows, and
  the `on_init` boot flow that runs on every app mount including Preview. Owns
  the singleton rule (one per package, edit in place; delete and re-create only from a saved body), the
  menu-item union (view item / one-level submenu / toolbar-only flow item), the
  allowed `viewType` set, cross-package `moduleId` + full `configParameters`
  wiring with string values, the `$workspace` (IShell) runtime surface, role-gated
  navigation, and the try/catch-everything rule for `on_init`. Triggers: "add a
  menu item", "add a submenu", "change the home page", "shell on_init",
  "$workspace", "Menu item view type is not allowed", "Submenu item should have a
  view type defined", "Outdated contract. Missing input parameter" on the shell.
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - hub-creator
  - grid-creator
  - form-creator
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
---
# Shell Editor

Edit a package's **shell** singleton (configurationTypeId=1) on a branch — the application chrome that hosts navigation (`menubar`), toolbar buttons (`toolbar`), the home view, the logo, embedded flows, and the `on_init` boot flow. Every package already has exactly one, with the fixed `referenceName: "shell"`; this skill only ever **edits** it. The views it links to are authored by their own creator skills; the shell only references them.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/shell.md](references/shell.md) — Authoritative reference: body shape, menu-item union and placement rules, `viewType` table, `$workspace` runtime surface, `on_init` lifecycle, chrome behaviour, patterns, pre-flight checklist
- [../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md) — Shared lifecycle for every auto-provisioned singleton: own-row discovery, `readonly`, write path, edit in place, delete and re-create only from a saved body
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — `moduleId` and `configParameters` contract rules for every `viewConfig`
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — UI-tier globals (`$shell`, `$operations`, `$flows`, `$frontendFlows`), `$flows` runtime shape
- [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) — envelope vs inner `.json` body, validate exit codes
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and the TypeScript-expression encoding rule (applies to `configParameters[].value`)

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`hub-creator`** / **`grid-creator`** / **`form-creator`** skills — invoked when the view a new menu or toolbar item should open doesn't exist yet (author it first; the shell only references it)
- **`component-wiring-check`** skill — invoked to audit every new or changed `viewConfig` (`moduleId` = target's package, `configParameters` mirrors every target inParam) before the write

## CLI Lifecycle

`shell` is a regular CLI type (verified live, dxs 0.5.8) — the generic `dxs configuration` round-trip applies. There is **no create step**: the platform provisions one shell per package. `configuration list` returns the own row plus one row per dependency package, commonly `readonly: true`; that flag is not reliable evidence either way (see Rule 2) — the own row is the one with `applicationId == branchId` and `isExternal == false`. Full detail in [../datex-studio-shared/singleton-config-lifecycle.md](../datex-studio-shared/singleton-config-lifecycle.md).

**Edit the singleton:**

```bash
# 0. Quick read-only look at the branch's own shell (body at .shell.json)
dxs -O json source branch shell <branchId> | jq '.shell.json | {home, menubar: [.menubar[].id], toolbar: [.toolbar[]?.id]}'
# 1. Find the own row (dependency packages' rows are listed too)
dxs -O json configuration list shell -b <branchId> \
  | jq '.configurations[] | select(.applicationId == <branchId> and .isExternal == false)'
# 2+3. Fetch AND extract the inner body in one command — a bare referenceName resolves to the
#      branch's own row; never keep the envelope (it embeds the appConfig body, secrets included)
dxs -O json configuration get shell shell -b <branchId> | jq '.configuration.json' > body.json
# 4. Edit body.json (menubar / toolbar / home / flows)
# 5. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate shell -b <branchId> -D body.json
# 6. Write — path A upsert, falling back to B (lock + update <ownId>) then C (Studio designer)
dxs configuration upsert shell -b <branchId> -D body.json
# 7. Re-fetch the own row, confirm the edit landed, confirm no lock is left held
```

Rows commonly report `readonly: true`, but that flag does **not** block a CLI write (verified live — path A/`upsert` succeeded first try on the own row); `upsert` by a reference name the branch also inherits from every referenced package is a known resolution trap. Use the ordered write paths in [singleton-config-lifecycle.md → Rule 5](../datex-studio-shared/singleton-config-lifecycle.md#rule-5--the-write-path-under-readonly-true) — never `create`, never `--allow-external` — rather than guessing.

### Round-trip rule (critical)

Never pipe an envelope into a write — it silently destroys configuration content. Extract the inner body at fetch time (`jq '.configuration.json'` on stdout, `jq .json` on an `-O` file), and never print or keep a singleton envelope: it embeds a full copy of the package's appConfig ([singleton-config-lifecycle.md → Rule 4](../datex-studio-shared/singleton-config-lifecycle.md#rule-4--the-envelope-hazard-secrets)). See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: Locate + fetch the own row]
list shell -> own row (applicationId == branchId, isExternal == false)
get shell shell | jq '.configuration.json' > body.json
Asked to "create a shell"?  -> refuse; one already exists, edit it
        |
[Phase 3: Targets exist?]
Each view to link exists in its package?  ── NO ─> invoke hub-creator /
                                                    grid-creator / form-creator
        |
[Phase 4: Edit the item tree]
  navigation entry    -> view item in menubar (or a one-level submenu)
  toolbar action      -> flow item (toolbar only) + embedded flow in flows[]
  toolbar flyout      -> view item in toolbar + flyoutSize
  viewConfig: moduleId = target's package; configParameters mirror EVERY target inParam
        |
[Phase 5: on_init (if touched)]
every step in try/catch; identity via a backend function
        |
[Phase 6: Validate + write]
invoke `component-wiring-check` on the changed viewConfigs
dxs configuration validate shell -b <branchId> -D body.json
write per singleton-config-lifecycle.md
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 4: Edit the item tree

Three item kinds ([references/shell.md → Menu item union](references/shell.md#menu-item-union)):

- **View item** `{id, icon, label, viewType, viewConfig{configId, moduleId, configParameters?}}` — anywhere.
- **Submenu** `{id, icon, label, hasSubmenu: true, menubar[]}` — top level of `menubar` or `toolbar`; **one level deep** (a submenu inside a submenu fails validate).
- **Flow item** `{id, icon, label, flowConfig{flowId}}` — **toolbar and toolbar submenus only**; in `menubar` it fails `Menu item should have a view type defined`.

`viewType` must be one the shell allows and must match the target's real type — `hub|grid|form|list|editor|customAngularComponent` are proven in production; `dashboard|calendar|embed|codeEditor|visualization` pass validate but are runtime-unverified; `wizard|widget|card|selector|report|footprintQueryManager` are rejected. A mobile application's designer offers only `form|editor|grid|list|embed|customAngularComponent`. A toolbar view item's `flyoutSize` is 1 = Small, 2 = Standard, 3 = Large, 4 = Xlarge (validate does not range-check it). Validate resolves `configId` inside `moduleId` but never checks that its type matches `viewType`.

**Wiring.** `moduleId` is the **target's** package — routinely not the shell's own. `configParameters` must carry an entry for **every** target inParam, optional ones included, or validate fails `Outdated contract. Missing input parameter <id>`. Each entry copies the target's parameter descriptor and sets `value` to a **string** (`""` unset, `"false"`, JSON-encoded objects). Every item needs a unique snake_case `id` — a missing id breaks the generated `IShell` type, a duplicate fails `Duplicate identifier`.

A toolbar flow item's `flowId` must name an embedded flow in `flows[]` (a full cti-9 body); validate does **not** catch a dangling flow id.

### Phase 5: `on_init`

`onInitFlowConfig{flowId: "on_init"}` binds a browser-tier flow that runs on **every app mount, including Preview builds**; branches created after the change is committed to the package's main line inherit it. A throw there can break app mount for every user, so wrap **every** step in its own `try/catch`:

```ts
try { $workspace.title = $context.app.name + ' ' + $context.env.name; }
catch (e) { console.error('shell on_init: title', e); }

try { $workspace.menubar.<id>.hidden = await $operations.<Package>.<Disable_X>.isAssignedToAll(); }
catch (e) { console.error('shell on_init: menu gating', e); }
```

`$workspace` is the shell itself (typed `IShell`: `menubar.<id>.hidden`, `toolbar.<id>.hidden`, `title`, `subtitle`, `logo`, `addScript`, every embedded flow as `$workspace.<flow>()`); `$shell` is the dialog service. There is no user-identity global — a backend function derives it (`$apis.<Pkg>.FootprintApi.GetCurrentUserInfo`). Renaming an item id renames its `$workspace` accessor: re-check every shell flow.

## Pre-Flight Checklist

Walk the full checklist in [references/shell.md → Pre-Flight Checklist](references/shell.md#pre-flight-checklist). The fast version:

1. **Own row only** — `applicationId == branchId`, `isExternal == false`; edit the shell in place; delete and re-create only from a saved body, never a second one.
2. **Fixed identity** — `referenceName: "shell"`, `configurationTypeId: 1` — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
3. **`home` present** (`Home view is required` otherwise), no `id`.
4. **Placement** — flow items toolbar-only; submenus one level; ids unique snake_case.
5. **`viewType`** allowed and equal to the target's real type.
6. **Wiring** — `moduleId` = target's package; `configParameters` mirror every target inParam; values are strings — audit via `component-wiring-check`.
7. **`flowId`s resolve** to `flows[]` entries (validate won't tell you).
8. **`on_init`** — every step in try/catch.
9. **`description`** non-null, non-empty, ≤100 chars.

## Common Mistakes

The authoritative detail is in [references/shell.md](references/shell.md). The gotchas that bite most often:

- **Creating a shell** — the platform provisions exactly one per package; edit the own row.
- **Editing a dependency's row** — check `applicationId` and `isExternal` before fetching by id.
- **A flow item in `menubar`** — `Menu item should have a view type defined`; actions go on the toolbar.
- **Nesting a submenu in a submenu** — `Submenu item should have a view type defined`.
- **`moduleId` set to the shell's package for a target in another package** — `Invalid contract. Referenced configuration … does not exist or has been renamed`.
- **Skipping optional target inParams in `configParameters`** — `Outdated contract. Missing input parameter <id>`.
- **Non-string `configParameters[].value`** — every observed value is a string (`""`, `"false"`, JSON-encoded objects); keep it that way.
- **An uncaught throw in `on_init`** — can break app mount for every user, Preview included.
- **Upserting the envelope instead of the inner `.json`** — silently destroys config content; extract `.configuration.json` at fetch time.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
