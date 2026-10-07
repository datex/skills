---
name: dashboard-creator
description: |
  Use when authoring or modifying a Datex Studio dashboard (configurationTypeId=35,
  *-dashboard.json suffix, CLI type `dashboard`) on a branch — a recursive section
  tree of side-by-side panels hosting tabs (embedded grids), fieldsets, and widgets,
  with built-in collapsible sections and a dialog contract (outParams +
  $dashboard.close() → codegen'd $shell open<name>Dialog returning a Promise). Owns
  the dual-grid selection pattern (available vs selected, one dual-mode grid embedded
  twice), the no-empty-sections and flattened-fields rules, the no-filters-array rule
  (filter context lives in fieldset fields), the wizard-vs-dashboard decision, and the
  shared-grid host-mirror sweep. Triggers: "create a dashboard", "side-by-side
  selection", "available and selected grids", "collapsible section", "$dashboard",
  "Section 'row_x' is empty", "Outdated contract. Missing input parameter after
  adding grid params", "dashboard filter bar".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
  - grid-creator
  - widget-creator
  - wizard-creator
  - form-creator
---
# Dashboard Creator

Author or modify a Datex Studio dashboard (configurationTypeId=35) on a branch — a multi-panel UI composition whose body is a recursive row/column tree of **sections**, each hosting tabs (embedded grids), a fieldset (form-style fields), or widgets, all sharing one set of dashboard `vars`. Because it declares `inParams`/`outParams` like any UI component, a dashboard can also be opened as a **dialog that returns a result**, which makes it the richer replacement for wizard-hosted selection flows.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/dashboards.md](references/dashboards.md) — Authoritative dashboard reference: section model, `$dashboard` API, dialog contract, dual-grid selection and quantity-grain patterns, host-mirror sweep, pre-flight checklist
- [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) — the get → extract → edit → validate → upsert round-trip and its silent-wipe guard
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and the TypeScript-expression encoding rule (applies to section `info`, field `value`/`tooltip`, `configParameters[].value`)
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_dashboard` suffix, sentence-case `title`
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — UI-tier globals available in dashboard flows (`$dashboard`, `$shell`, `$datasources`, `$utils`, ...)
- [../grid-creator/references/grids.md](../grid-creator/references/grids.md) — the grids a dashboard embeds (and retrofits for dual mode)
- [../widget-creator/references/widgets.md](../widget-creator/references/widgets.md) — the widget host contract for a widget section
- [../wizard-creator/references/wizards.md](../wizard-creator/references/wizards.md) — the adjacent stepped-dialog type (wizard-vs-dashboard decision)
- [../form-creator/references/forms.md](../form-creator/references/forms.md) — fieldset/field shape and the confirm/cancel dialog rule dashboards inherit
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — `moduleId`, one-for-one `configParameters`, declared-vars rules every embed follows

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`grid-creator`** skill — invoked to author or retrofit every grid the dashboard embeds (dual-mode params, emitted events); its `grid-validator` gate applies to those grids
- **`widget-creator`** skill — invoked when a section hosts a widget
- **`wizard-creator`** skill — invoked when the decision below lands on a stepped wizard instead
- **`form-creator`** skill — invoked when the need is plain transient input with no panel composition
- **`component-wiring-check`** skill — invoked to audit every embed's `moduleId`/`configParameters`/`configEvents` contract and every host of a shared grid

## CLI Lifecycle

Dashboard authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs dashboard` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The type identifier in the CLI is **`dashboard`** (lowercase), mapping to `configurationTypeId: 35` (registered from dxs 0.5.8; `get`, `validate`, `contexts` and `upsert` (create path) verified live).

**Create a new dashboard:**

```bash
# 1. Build body.json from scratch (see references/dashboards.md → Minimal Valid Skeleton)
# 2. Validate — gates the push; exit 1 = errors found, not a broken CLI.
#    Typechecks flow code against the generated IDashboard and lints structure (empty sections)
dxs configuration validate dashboard -b <branchId> -D body.json
# 3. Create (upsert creates or updates by referenceName)
dxs configuration upsert dashboard -b <branchId> -D body.json
```

**Edit an existing dashboard:**

```bash
# 1. Fetch by NUMERIC id — note the envelope wrapper
dxs configuration get dashboard <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate dashboard -b <branchId> -D body.json
# 5. Push
dxs configuration upsert dashboard -b <branchId> -D body.json
# 6. Branch gate — catches cross-host contract breaks a component validate cannot see
dxs source branch validate <branchId>
```

To discover the exact `$dashboard` surface for a body (sections, tabs, fields, toolbar, flows as typed members): `dxs -O json configuration contexts dashboard -b <branchId> -D body.json`, then read the `dashboardContext` designer context.

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content (sections, toolbar, flows, vars and outParams all saved empty). Always `jq .json envelope.json > body.json` before editing. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md). Older CLIs without the `dashboard` type need the raw-route fallback in [references/dashboards.md → CLI / Transport](references/dashboards.md#cli--transport).

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: Dashboard vs adjacent type]
  multiple coordinated panels / side-by-side grids / live summary -> dashboard
  ordered steps the user walks through (step N needs step N-1)     -> wizard-creator
  filter bar + tab strip over lists                                -> hub-creator
  plain transient input                                            -> form-creator
  single record view/edit                                          -> editor-creator
        |
[Phase 3: Author the callee grids first]
grid-creator: dual-mode params optional, emitted add/remove events,
legacy-host guard if the grid already has hosts -> grid-validator
        |
[Phase 4: Author the dashboard body]
section tree (no empty leaves) -> embeds with full configParameters mirrors
-> vars with inline objectTypeDefs -> flows -> toolbar -> dialog contract
        |
[Phase 5: Validate + push]
dxs configuration validate dashboard -b <branchId> -D body.json
dxs configuration upsert  dashboard -b <branchId> -D body.json
        |
[Phase 6: Host sweep + branch gate]
every host of any grid that gained inParams mirrors them -> dxs source branch validate
        |
[Phase 7: Hand over the runtime checklist (Preview is the user's)]
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 2: Dashboard vs adjacent type

Reach for a dashboard when the value is in the **composition** — two or more panels coordinating through shared vars (available vs selected grids, a summary fieldset above working grids, a control panel driving a grid). A **wizard** is the right type when the work is a sequence the user steps through and later steps depend on earlier ones; a dashboard has no step model. When a wizard exists only to host one selection grid plus a confirm, a dialog dashboard replaces it with free layout, collapsible panels, a live summary and a simpler contract. See [references/dashboards.md → Purpose & When to Use](references/dashboards.md#purpose--when-to-use).

### Phase 3: Author the callee grids first

The dashboard's `configParameters` mirror each embedded grid's `inParams` one-for-one, so the grids' contracts must be settled first. For the dual-grid selection pattern, one grid gains an **optional** mode param and the selection params, and emits add/remove events carrying full row snapshots. If that grid already has other hosts (wizards, hubs, other dashboards), keep its legacy behavior when the mode param is unbound. Gate every grid edit with `grid-validator`.

### Phase 4: Author the dashboard body

1. **File basics.** `configurationTypeId: 35`, file name `<referenceName>-dashboard.json`, `referenceName` ends `_dashboard`, `title` a distinct sentence-case display name. Plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)) — `description` non-null and ≤100 chars.
2. **Section tree.** Container rows (`hasSubsections: true`) split into child sections by `widthPercent`; every leaf carries `componentType` `tab`, `fieldset`, or `widget` and at least one item — an empty leaf fails validation. Collapse is declarative (`collapsible`/`expanded`), not scripted.
3. **Fields are flattened.** Fieldset fields are addressed as `$dashboard.fields.<id>`, never through `sections…fieldsets…`.
4. **No `filters[]`.** A dashboard has no hub-style filter bar; put filter context in fieldset fields and bind their values (via vars) into the embeds.
5. **Embeds.** Target's `moduleId`; `configParameters` mirror the target's `inParams` one-for-one (unbound = `""`); `configEvents` mirror the target's events with a handler flow for every wired `flowId`.
6. **Vars.** Declare every `$dashboard.vars.<id>` you write; object vars use inline `objectTypeDef` (UI components cannot use custom `$types`).
7. **Dialog contract.** `is_confirmed` outParam; confirm/cancel flows set outParams → `$dashboard.events.outParamsChange.emit()` → `$dashboard.close()`.

### Phase 6: Host sweep + branch gate

Adding inParams to a shared grid breaks every other host that embeds it with `Outdated contract. Missing input parameter <id>` — and that error surfaces **only at `dxs source branch validate`**, not at the grid's or the dashboard's own validate. Sweep every host (find them server-side with the `impact-analysis` skill) and add mirrored `configParameters` entries (value `""` when unbound) before the branch gate.

### Phase 7: Runtime checklist

Preview builds are the user's. Hand over: dialog round-trip (confirm and cancel both resolve the caller), collapse behavior, var-rebind refresh of both embeds, live summary updates, confirm gating on an empty selection.

## Pre-Flight Checklist

Walk the full checklist in [references/dashboards.md → Pre-Flight Checklist](references/dashboards.md#pre-flight-checklist). The fast version:

1. **File basics.** `configurationTypeId: 35`, `-dashboard.json`, `referenceName` ends `_dashboard`, sentence-case `title` — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
2. **No empty sections**; placeholders deleted.
3. **TS-expression slots encoded** (`info`/`tooltip`/`value`: `"''"`, not `""`).
4. **Every embed** has the target's `moduleId` and a one-for-one `configParameters` mirror; every wired event has a handler flow.
5. **Every written var is declared** (inline `objectTypeDef` for objects).
6. **Dialog dashboards** emit `outParamsChange` before `close()` and carry `is_confirmed`.
7. **`dxs configuration validate dashboard`** clean before `upsert`; **`dxs source branch validate`** clean after.
8. **Shared-grid host sweep** done for every grid that gained inParams.
9. **`description`** non-null, non-empty, ≤100 chars.

## Common Mistakes

The authoritative symptom → cause → fix list is in [references/dashboards.md → Common Failure Modes](references/dashboards.md#common-failure-modes). The gotchas that bite most often:

- **Leaving a placeholder section** — `Section '<ref>' is empty; add at least one tab, widget, or fieldset`.
- **Reaching a field through its section** (`$dashboard.sections.<row>.fieldsets…`) — the path does not exist; use `$dashboard.fields.<id>`.
- **Adding a `filters[]` array** expecting a hub filter bar — dashboards have none; use a fieldset.
- **Closing without `outParamsChange.emit()`**, or detecting cancel by truthy-checking a data outParam — use `is_confirmed`.
- **Adding grid inParams without the host sweep** — the break shows up only at `dxs source branch validate`.
- **Upserting the envelope instead of the inner `.json`** — silently wipes the dashboard; `jq .json envelope.json > body.json` first.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
