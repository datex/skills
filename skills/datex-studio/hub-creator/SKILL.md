---
name: hub-creator
description: |
  Use when authoring a NEW Datex Studio hub configuration (configurationTypeId=2)
  on a branch — filter-driven container with tab grids, role-gated tabs, toolbar
  buttons. Owns the dead-wiring trap (hub filter -> tab configParameters -> grid
  inParams must stay in sync), filter-driven-tab pattern, and toolbar button
  wiring. Triggers: "create a hub", "add a tab to xxx_hub", "add a filter",
  "add a toolbar button to the hub", "role-gate a hub tab", "filter-driven tabs",
  "tab grid ignores filter value", "hub won't open", "dead wiring between hub
  filter and grid". For modifying an existing hub, see hub-editor.
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - component-wiring-check
  - grid-creator
  - selector-creator
  - form-creator
  - editor-creator
  - requirements-gathering
  - post-edit-verification
  - component-validator
---

# Hub Creator

Author a NEW Datex Studio hub configuration (configurationTypeId=2) on a branch — top-level UI containers with filters, grouping options, tabs that mount grids/editors/forms, toolbar buttons, and click flows.

> **See also:** `hub-editor` — modifying an EXISTING hub's toolbar/flows on a branch (this skill is for authoring NEW hubs).

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/hubs.md](references/hubs.md) — Authoritative hub authoring reference: file shape, runtime globals, invocation contract, common patterns, pre-flight checklist
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and TypeScript-expression encoding rules
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_hub` suffix, filename stem matching, display-name rule
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — platform-injected globals available in hub code (`$flows`, `$shell`, `$utils`, ...)
- [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules (call functions, never actions; dialog openers via `$shell`)
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — host reference contracts, vars-must-be-declared rule, moduleId rule

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`grid-creator`** / **`selector-creator`** / **`form-creator`** / **`editor-creator`** skills — invoked when a tab grid, filter-backing selector, or dialog form/editor referenced by the hub doesn't exist yet on the branch
- **`component-wiring-check`** skill — invoked to audit `configParameters` ↔ target `inParams` contracts before push (the dead-wiring trap)

## CLI Lifecycle

Hub authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs hub` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back.

**Create a new hub:**

```bash
# 1. Build body.json from scratch (see references/hubs.md → Minimal Valid Skeleton)
# 2. Validate (recommended)
dxs configuration validate hub -b <branchId> -D body.json
# 3. Create
dxs configuration upsert hub -b <branchId> -D body.json
```

**Edit an existing hub (only if scope creeps from "new" into "modify mid-authoring"):**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get hub <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard — see "Round-trip rule" below)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate (recommended)
dxs configuration validate hub -b <branchId> -D body.json
# 5. Push
dxs configuration upsert hub -b <branchId> -D body.json
```

For purely-modify workflows (toolbar/flows changes on an existing hub), stop here and switch to the `hub-editor` skill — it carries the toolbar/click-flow editing patterns and the role-gating recipes.

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. The corrected sequence above (extract inner `.json` with `jq` before editing) is mandatory for any round-trip. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]
  +-----+-----+
  |            |
 YES          NO -> invoke `requirements-gathering`
  |            |
  +-----+------+
        |
[Phase 2: Author hub body]
Decide what the hub IS:
  - which filters scope the experience
  - which tabs (grids / other components) mount inside it
  - role-gating, on_init access guard, hub-local flows
Consult references/hubs.md for file shape, $hub runtime,
required top-level fields, common patterns
        |
[Phase 3: Wire toolbar / flows]
Toolbar buttons + click flows; dialog openers via $shell
Audit dead-wiring trap (hub filter -> tab configParameters
-> grid inParams MUST stay in sync) — invoke
`component-wiring-check` if mounted grids/selectors
need extension
        |
[Phase 4: Validate + push]
dxs configuration validate hub -b <branchId> -D body.json
        |
   +----+----+
   |         |
  CREATE   MODIFY-EXISTING
   |         |
   |         use the corrected round-trip
   |         (get -O envelope -> jq .json -> body)
   |         |
   +----+----+
        |
        v
dxs configuration upsert hub -b <branchId> -D body.json
   (upsert creates or updates by referenceName — one command for both)
        |
[Phase 5: Verify in Studio (optional)]
Reload the hub in the running app; confirm filters render,
tabs query, toolbar buttons fire
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 1: Setup + Requirements

1. Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for branch and connection selection. **Never assume a branch ID** — ask the user to confirm, or run `dxs source branch list --all-repos --status feature` for selection.
2. Check whether a **requirements brief** already exists in the conversation context (produced by `requirements-gathering` or another calling skill).
   - **Brief exists** — use it. The brief provides intent (what the hub is for), the scoping filters users need, the tabs/grids that should mount inside, role-gating rules, and any toolbar actions.
   - **No brief** — invoke the `requirements-gathering` skill first. Hubs are top-level entry points; getting the filter set and tab layout right up front saves rework.

### Phase 2: Author hub body

Decide what the hub IS, then build `body.json`:

1. **File basics.** Per the **Pre-Flight Checklist** below + [../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md); see [references/hubs.md → File Location & Naming](references/hubs.md#file-location--naming) for the `-hub.json` file shape.
2. **Filters.** Each filter field's `configId` / `moduleId` must resolve to a real selector (`*-selector.json`). If the selector doesn't exist on the branch yet, invoke `selector-creator` first. Every selector `configParameter` gets an entry in the filter's `dropdownConfig.configParameters` (use `value: ""` for ones that don't apply).
3. **Tabs.** Every tab declares a `contentConfig` pointing at a grid (or other component) on the branch. If the target grid doesn't exist yet, invoke `grid-creator` first. The tab's `configParameters` array must mirror the target's `inParams` exactly — see the Phase 3 dead-wiring check.
4. **`vars` array.** Every `$hub.vars.<id>` written in hub flow code must be declared at the top-level `vars` array. See [references/hubs.md → Runtime Globals](references/hubs.md#runtime-globals) and [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md).
5. **`onInitFlowConfig`.** Common home for initial-filter defaulting, context loading, and the access-gated hub pattern (permission check → `$hub.close()` on deny). See [references/hubs.md → Common Patterns](references/hubs.md#common-patterns).
6. **TypeScript-expression encoding.** `hubTitle`, `hubDescription`, any `value` / `tooltip` / `placeholder` / `label` follows the three-encoding rule — display text wrapped in backticks: `` "`Widget overview`" ``. See [../datex-studio-conventions/file-format.md → Declarative String Values Are TypeScript Expressions](../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions).

### Phase 3: Wire toolbar / flows

1. **Toolbar buttons + click flows.** Each toolbar button entry has a `clickFlowConfig` pointing at a hub-local flow or an external function. From hub code, invoke functions via `$flows.<Package>.<fn>` and open forms/editors via `$shell.<Package>.open<referenceName>Dialog(...)`. **Never call actions directly** — wrap them in a function. See [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md) and [references/hubs.md → Common Patterns](references/hubs.md#common-patterns) for the engine-toggle, configure-options-dialog, access-gated `on_init`, and shared-local-flow patterns.
2. **Dead-wiring trap audit.** The single most common hub bug: a hub filter binds into a tab's `configParameters` for an id the mounted grid doesn't actually declare as an inParam. The binding looks wired but the grid never receives the value.

   The rule: **every binding in a tab's `configParameters` must be named in the mounted grid's `inParams`** — and every inParam the grid declares must have an entry in the tab's `configParameters` (unused entries use `value: ""` or `value: null`).

   When a hub filter exists to scope a specific tab's grid (e.g. a `projects` filter scoping a rules grid by `project_ids`, or a `contract` filter scoping a documents grid by `contract_id`), audit the mounted grid's top-level `inParams` in the same edit. If a binding is needed and the grid doesn't declare a matching inParam, **extend the grid in the same edit** (and the underlying datasource, since grid flows read `$grid.inParams.<id>` when building the datasource call).

   Invoke `component-wiring-check` to audit the full reference contract — moduleId, configParameters mirror, vars declared — before push. See [references/hubs.md → Invocation Contract](references/hubs.md#invocation-contract) and [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md).

3. **Toolbar / tab IDs are unique within the hub.** Flow code addresses them by `id` (`$hub.toolbar.save.control...`, `$hub.tabs.rules.hidden = ...`) — collisions silently overwrite.

### Phase 4: Validate + push

```bash
# Validate the body locally against the branch
dxs configuration validate hub -b <branchId> -D body.json

# For a new hub
dxs configuration upsert hub -b <branchId> -D body.json

# For modify-existing (round-trip — never skip the jq extract)
dxs configuration get hub <configId> -b <branchId> -O envelope.json
jq .json envelope.json > body.json
# ... edit body.json ...
dxs configuration upsert hub -b <branchId> -D body.json
```

Validation surfaces missing required fields, malformed `configParameters` shapes, and selector/grid reference errors before push. It does not catch the dead-wiring trap (configParameters whose `id` is absent from the mounted grid's `inParams`) — that's a contract concern between two components, audited via `component-wiring-check` and the Phase 3 rule above.

### Phase 5: Verify in Studio (optional)

Reload the hub in the running app:

- Filters render and the dropdowns populate (selectors wired correctly).
- Tabs query when filters change (the tab `configParameters` ↔ grid `inParams` contract holds).
- Toolbar buttons fire their click flows; dialog openers return; `$hub.refresh()` propagates state.
- Role-gated tabs hide for unauthorized users (access-gated `on_init` flow runs).

If the running app isn't available, re-fetch the config and diff against `body.json` (using the corrected `jq .json` extract pattern) to confirm the push landed.

## Pre-Flight Checklist

Before push, walk the full checklist in [references/hubs.md → Pre-Flight Checklist](references/hubs.md#pre-flight-checklist). The fast version:

1. File basics: `configurationTypeId: 2`, `referenceName` ends `_hub` — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
2. Tabs carry full `configParameters` contracts (mirrors the mounted grid's `inParams` exactly — no extras, no missing entries).
3. Filter bindings are contract-complete (selector references resolve; every selector configParameter has an entry).
4. Vars declared (every `$hub.vars.<id>` in flow code is in top-level `vars`).
5. Calling-tier compliance (functions via `$flows.<Package>.<fn>`; dialog openers via `$shell.<Package>.open<referenceName>Dialog(...)`; no direct action calls).
6. Toolbar/tab IDs are unique within the hub.
7. TypeScript-expression strings wrapped correctly; dynamic tooltips go through declared `$hub.vars.<name>`.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Tab `configParameters` binds an id the grid doesn't declare as an inParam | Dead wiring — the value is silently dropped. Either drop the binding, or extend the grid's `inParams` (and underlying datasource) in the same edit. See Phase 3. |
| Piping `dxs configuration get -O envelope.json` directly into `dxs configuration upsert -D envelope.json` | Silently destroys config content. Always `jq .json envelope.json > body.json` before editing. See "Round-trip rule" above. |
| Writing `$hub.vars.<id> = ...` in flow code without declaring `<id>` in the top-level `vars` array | The var is undeclared — write fails silently or runtime error. Declare every var. |
| Calling an action directly from hub code (`$flows.<Package>.<action_name>(...)`) | UI-tier rule: invoke functions only; wrap actions in a function. See `../datex-studio-runtime/calling-conventions.md`. |
| Assigning to a filter or toolbar button's `.control.tooltip` from flow code | No-op for dynamic tooltips — must bind to a declared `$hub.vars.<name>` instead. See `references/hubs.md → Pre-Flight Checklist` item 7. |
| `description` exceeds 100 chars | SQL column limit — push will fail validation. Tighten. |
| `referenceName` doesn't end in `_hub` or doesn't match filename stem | Import / lookup breaks. Snake_case, `_hub` suffix, filename stem matches. |
| Tab `moduleId` set to the hub's package instead of the mounted grid's | Cross-component reference rule — `moduleId` is always the target's package. See `../component-wiring-check/references/component-wiring.md`. |
| Two toolbar buttons (or two tabs) sharing the same `id` | Silent overwrite — flow code can only address one of them. Make IDs unique within the hub. |

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
