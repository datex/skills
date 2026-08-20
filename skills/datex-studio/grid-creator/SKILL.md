---
name: grid-creator
description: |
  Use when authoring or modifying a Datex Studio grid (configurationTypeId=3,
  *-grid.json suffix) on a branch — the densest UI component. Owns the
  pre-author rows-source decision (owned vs standalone datasource, OData vs
  flow), the five-location dynamic-filter wiring rule, secondary enrichment
  datasources, imperative cell API, and the mandatory grid-validator gate
  after every edit. Triggers: "create a grid", "add a column to xxx grid",
  "make the grid filterable/sortable by X", "add a toolbar button", "add a
  filter", "enrich rows with extra data", "empty column", "dynamic filter
  contract mismatch", "grid renders blank", "tailored/custom grid variants",
  enrichment-datasource work.
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - datasource-creator
  - tailoring-overlay
  - component-wiring-check
  - form-creator
  - editor-creator
  - hub-creator
  - selector-creator
  - schema-explorer
  - grid-validator
  - requirements-gathering
  - post-edit-verification
  - component-validator
---

# Grid Creator

Author or modify a Datex Studio grid (configurationTypeId=3) on a branch — the platform's primary data-density component. Grids render tabular rows from a backing datasource with optional inline editing, selection, toolbars, dynamic filters and sorting, and per-row/per-cell interactions. They are typically mounted inside hub tabs, and they carry more cross-location invariants than any other component — the five-location entity-shape rule, the two-site dynamic filter/sort registration mirror, and the OData runtime `selects` location all live here.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/grids.md](references/grids.md) — Authoritative grid authoring reference: file shape, runtime globals, five-location rule, dynamic filters, secondary datasources, imperative cell API, pre-flight checklist
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and TypeScript-expression encoding rules
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_grid` suffix, filename stem matching, display-name rule
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — platform-injected globals available in grid code (`$grid`, `$row`, `$flows`, `$apis`, `$utils`, ...)
- [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules (call functions, never actions; CRUD via `$apis.<Package>.FootprintApi.extendedActions.<action_name>`)
- [../datasource-creator/references/datasources.md](../datasource-creator/references/datasources.md) — datasource taxonomy (variants × query types) for what backs the rows
- [../datasource-creator/references/flow-datasources.md](../datasource-creator/references/flow-datasources.md) — flow-type datasource shape (paginated `getListFlow` / `getByKeysFlow`) for grid-embedded datasources
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — host reference contracts, vars-must-be-declared rule, moduleId rule
- [../tailoring-overlay/references/tailoring.md](../tailoring-overlay/references/tailoring.md) — overlay model for tailored grid variants and secondary-datasource enrichment

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`schema-explorer`** skill — invoked **before** authoring any PascalCase-plural-named grid (or any grid whose rows look like an OData entity) to confirm whether an entity exists in the Footprint schema; a 5-second lookup is cheaper than rebuilding the grid against the wrong source
- **`datasource-creator`** skill — invoked when the grid needs a *standalone* datasource (shared across multiple consumers); grid-only datasources are authored as owned entries inside the grid's `datasources[]` array, not as separate files
- **`form-creator`** / **`editor-creator`** / **`selector-creator`** skills — invoked when the requirement is actually transient input collection (form), a single-entity view/edit screen (editor), or a dropdown/autocomplete (selector), not a tabular list
- **`hub-creator`** skill — invoked when the grid's host hub tab / button needs its `configParameters` contract set up to mount the grid
- **`component-wiring-check`** skill — invoked to audit `configParameters` ↔ target `inParams` contracts on both the grid's host (outer) and the grid's embedded datasource (inner) before push
- **`tailoring-overlay`** skill — invoked when authoring or maintaining a tailored grid variant (`baseConfiguration` + `onCustomization*FlowConfig`) or when secondary enrichment datasources come from the overlay
- **`grid-validator`** skill — **mandatory** invocation after every grid edit; re-runs the pre-flight checklist, catches five-location drift, partial lookupcode/id syncs, OData `selects` misses, and dynamic-filter registration mirror drift. Treat its blockers as must-fix.

## CLI Lifecycle

Grid authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs grid` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The type identifier in the CLI is **`grid`** (lowercase, matches `ConfigurationEndpoints.normalize_type` output), mapping to `configurationTypeId: 3`.

**Create a new grid:**

```bash
# 1. Build body.json from scratch (see references/grids.md → Minimal Valid Skeleton)
# 2. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate grid -b <branchId> -D body.json
# 3. Create
dxs configuration upsert grid -b <branchId> -D body.json
```

**Edit an existing grid:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get grid <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard — see "Round-trip rule" below)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate grid -b <branchId> -D body.json
# 5. Push
dxs configuration upsert grid -b <branchId> -D body.json
```

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. The corrected sequence above (extract inner `.json` with `jq` before editing) is mandatory for any round-trip. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

Grids carry `columns`, `datasourceConfig`, an embedded `datasources[]` array (each entry a full flow- or OData-type datasource with its own `getListFlow` / `getByKeysFlow` and entity-shape locations), `flows` / `rowFlows` (with a `code` string on every executeCodeConfig step), `topToolbar` / `toolbar` (polymorphic control descriptors), `filters`, and grid-level `inParams` / `outParams` / `vars` / `rowVars` schemas — round-trip discipline (fetch → jq-extract → edit → validate → push) is non-negotiable, and partial syncs that touch only some of the entity-shape locations are the single most common source of upload-time contract errors.

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
[Phase 2: Pre-author rows-source decision]
Consult references/grids.md → "Pre-Author Decision — What Backs the Rows?":
  - PascalCase-plural name -> invoke `schema-explorer` (mandatory)
    before defaulting to flow-type; if entity exists, build OData-backed
  - snake_case name -> check the branch for a storage config
    (`dxs source explore configs --type storage`) or treat as flow-type
  - ambiguous -> invoke `schema-explorer` first
Owned vs standalone:
  - grid-only datasource -> embedded entry in `datasources[]`
  - shared across consumers -> standalone (invoke `datasource-creator`)
If requirement is single-entity view/edit -> invoke `editor-creator` and stop.
If requirement is transient input collection -> invoke `form-creator` and stop.
If requirement is a dropdown/autocomplete -> invoke `selector-creator` and stop.
        |
[Phase 3: Author grid body]
Build body.json:
  - File shape (configurationTypeId=3, *-grid.json suffix,
    referenceName ends _grid, snake_case matches filename stem)
  - Five-location entity-shape rule (flow-type) or five+selects (OData);
    every entity field present at every site
  - Two-site dynamic filter/sort registration mirror (datasources[0] and
    datasourceConfig); per-column dynamicFilter/dynamicOrderBy/
    dynamicFilterType/dynamicFilterControl; no $filter/$orderby in any
    inParams or configParameters
  - Dynamic filter/sort is all-or-nothing — flow-type backings either
    fully wire (registrations + per-column + applyDynamicFilter/
    applyDynamicOrderBy in getListFlow) or fully disable
  - Toolbar items polymorphic — click handlers inside the type-specific
    config block (buttonConfig.clickFlowConfig.flowId), siblings null;
    destructive buttons get buttonDefaultStyleClass: "destructive";
    selection-gated buttons seed readOnly: true statically AND gate
    live in on_select_row
  - Secondary enrichment datasources owned in same datasources[] array;
    invoke from on_data_loaded; batch with Id in ${ids}; write via
    imperative cell API ($row.cells.<col>.displayControl.text / value)
  - Imperative cell API for post-load enrichment and change-guarded
    saves; empty declarative bindings are legitimate when value is
    populated imperatively — don't "fix" to $row.entity.<field>
  - Text display bindings coerce non-string entity fields at the bind
    site, not in the entity schema (entity type drives filter operators)
  - Every $grid.vars.<id> / $row.vars.<id> written in flow code is
    declared in top-level vars[] / rowVars[]
  - Embedded datasource carries the full component-identity envelope
    (referenceName matching datasourceConfig.configId, title, description,
    hasKey, hasResult, accessModifier, ...)
  - Invoke `schema-explorer` for OData entity / property / navigation
    property validation before authoring OData-backed grids
  - Invoke `component-wiring-check` to audit BOTH the outer host
    contract AND the inner grid → embedded-datasource contract
    (full_text_search and any inParam need explicit configParameters
    entries)
        |
[Phase 4: Validate + push]
dxs configuration validate grid -b <branchId> -D body.json
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
dxs configuration upsert grid -b <branchId> -D body.json
   (upsert creates or updates by referenceName — one command for both)
        |
[Phase 5: Validate with `grid-validator` (MANDATORY)]
Delegate to `grid-validator` with the grid's file path / configId.
It re-runs the full Pre-Flight Checklist, catches five-location drift,
partial lookupcode/id syncs, OData `selects` misses, and registration
mirror drift. Treat its blockers as must-fix.
        |
[invoke `post-edit-verification` for description/JSON/schema hygiene]
```

## Phase Details

### Phase 1: Setup + Requirements

1. Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for branch and connection selection. **Never assume a branch ID** — ask the user to confirm.
2. Check whether a **requirements brief** already exists in the conversation context (produced by `requirements-gathering` or another calling skill).
   - **Brief exists** — use it. The brief should establish the row entity (or aggregated row shape), which columns the grid renders, which fields are filterable/sortable, the host that mounts the grid, and any row-action / toolbar-action flows the user needs.
   - **No brief** — invoke the `requirements-gathering` skill first. Getting the row shape, filterability, and host mounting right up front avoids re-authoring the entity-shape locations and dynamic-filter registrations from scratch.

### Phase 2: Pre-author rows-source decision

Before authoring **any** grid, decide what feeds the rows. This decision determines the embedded datasource's `type` (`oDataQuery` vs `flows`) and changes the five-location rule. Get this wrong and you write the whole datasource against the wrong source. Consult [references/grids.md](references/grids.md) (datasource shape and the five-location rule) and the rows-source decision in Phase 2 below before authoring.

**Flow-datasource shape check:** a grid's rows datasource must be the keyed-collection shape —
`resultIsCollection: true` with **both** `getListFlow` and `getByKeysFlow` populated and a
non-empty `keyDef`. A flow datasource with only `getListFlow` cannot back a grid: single-row
refresh after actions calls `getByKeys`, which won't exist. Read suitability off the
implemented methods before wiring — see
[../datasource-creator/references/flow-datasources.md](../datasource-creator/references/flow-datasources.md)
→ "Reading suitability off an existing flow datasource". This isn't just a runtime risk —
the branch's server-side usage gate enforces it at contract-validation time and blocks
publish if the grid's datasource is missing `getList` or `getByKeys`.

The grid's name is the strongest hint:

- **PascalCase plural** (`TaskStatuses`, `Orders`, `Shipments`, `Warehouses`) — probably an OData entity in the Footprint schema. Invoke `schema-explorer` with `describe entity <Name>` (or `search <Name>`) **before** authoring. If it resolves, build an OData-backed grid against that entity. **Hard rule:** never default to a flow-type datasource for a PascalCase-plural name without first running `schema-explorer`.
- **snake_case** (`task_statuses`, `invoicing_rules`, `widget_options`) — probably a feature-owned storage component or a computed/aggregated source. Check the branch for a matching storage config (`dxs source explore configs --branch <id> --type storage --search <name>`), or treat as flow-type backed by feature code.
- **Ambiguous / unsure** — invoke `schema-explorer` first. A 5-second lookup is cheaper than rebuilding the grid after the user points out the entity exists.

If schema-explorer returns no match, fall back to a flow-type datasource — but document the choice in the grid's `description` or alongside the embedded datasource (so the next author doesn't repeat the lookup).

**Owned vs. standalone.** A datasource that exists only to feed this grid's rows is authored as an **owned entry inside the grid's `datasources[]` array**, not as a standalone `<name>-datasource` config of its own. Standalone datasources are for shared consumers (multiple grids / forms / editors / actions). A datasource whose sole purpose is this grid's row shape belongs inside the grid — it keeps the five-location rule local to one file and prevents accidental reuse that would later resist row-shape edits. Secondary enrichment datasources (see Phase 3) are also owned. If the requirement calls for a *shared* datasource, invoke `datasource-creator` instead.

**Wrong-component-type checks.** If the requirement is actually single-entity view/edit, invoke `editor-creator` instead and stop. If it's transient input collection (a dialog that returns `outParams`), invoke `form-creator` and stop. If it's a dropdown / autocomplete field, invoke `selector-creator` and stop. Grids are for tabular multi-record lists; the other three are not interchangeable substitutes.

### Phase 3: Author grid body

Build `body.json` from the skeleton in [references/grids.md → Minimal Valid Skeleton](references/grids.md#minimal-valid-skeleton). Key points:

1. **File basics.** `configurationTypeId: 3`. `referenceName` ends in `_grid` (e.g. `task_statuses_grid-grid.json` → `task_statuses_grid`). File suffix is `-grid.json` — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)). See [references/grids.md → File Shape at a Glance](references/grids.md#file-shape-at-a-glance) and [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md).

2. **Five-location entity-shape rule.** A grid-embedded flow datasource carries the row entity in **five** independent locations: `datasources[0].queryOptionsObjectTypeDef`, `datasources[0].outParams[result].objectTypeDef`, `datasources[0].getListFlow.outParams[result].objectTypeDef`, `datasources[0].getByKeysFlow.outParams[result].objectTypeDef`, and `datasourceConfig.configOutParameters[result].objectTypeDef`. Plus the `code` strings in `getListFlow` / `getByKeysFlow` that populate the new field. After any entity-shape edit, grep an unchanged neighbor field's id across the file — the new field must have a matching occurrence at each site. **OData-backed grids change the rule:** locations 3 and 4 are `null` and a sixth, runtime-only location becomes load-bearing — `datasources[0].queryOptions.selects` (and the appropriate `expands[].queryOptions.selects` for nested fields). Missing `selects` leaves the entity undefined at runtime even if every type-metadata location is correct. See [references/grids.md → Datasource Wiring — Five Places Must Stay in Sync](references/grids.md#datasource-wiring--five-places-must-stay-in-sync).

3. **Dynamic filters and sorting — four sites + column wiring.** Adding a filterable/sortable field involves: (a) the field exists in all five entity-shape locations above; (b) the field is registered identically in **both** `datasources[0].dynamicFilters` / `dynamicOrderBys` (embedded datasource side) and `datasourceConfig.dynamicFilters` / `dynamicOrderBys` (consumer side) — drift surfaces at import as `Outdated contract. Type mismatch for dynamic filtering/sorting`; (c) per-column `dynamicFilter` (dotted path), `dynamicOrderBy`, `dynamicFilterType` (inParam-shaped leaf type), `dynamicFilterControl` (`textBox` / `numberBox` / `dateBox`); (d) **never** declare `$filter` / `$orderby` in any `inParams` list and don't add them to `datasourceConfig.configParameters` — the platform auto-injects typed versions from the registrations; manual declarations collide. See [references/grids.md → Dynamic Filters and Sorting](references/grids.md#dynamic-filters-and-sorting).

4. **Dynamic filter/sort application is all-or-nothing.** For flow-type backings, the platform does not auto-apply `$filter` / `$orderby` to the row set. If you register filter/sort UI but don't apply the inputs in `getListFlow` code, the UI controls visibly do nothing — the bug state. The two acceptable end states are: (A) fully wired — registrations + per-column wiring + the canonical `applyDynamicFilter` / `applyDynamicOrderBy` helpers applied inside `getListFlow` against `($flow.inParams as any).$filter` and `($flow.inParams as any).$orderby`; or (B) fully disabled — no `dynamicFilters` / `dynamicOrderBys` registrations on either side, no per-column wiring. For OData-type backings, the platform translates registrations into the OData URL declaratively — state A is the default. See [references/grids.md → Application Is All-Or-Nothing](references/grids.md#application-is-all-or-nothing) and [Default In-Memory $filter / $orderby Application](references/grids.md#default-in-memory-filter--orderby-application) for the canonical helpers.

5. **Array-field caveat.** Collection fields (`isCollection: true`) can't be the direct target of `dynamicFilter` / `dynamicOrderBy`. Introduce a **scalar sidecar** field alongside (e.g. `accounts_display` = `accounts.join(', ')`); the column keeps its array-indexed display (`$row.entity.accounts[0]`); `dynamicFilter` targets the sidecar. Sidecars must appear in all five entity-shape locations and be populated in flow code. See [references/grids.md → Array-Field Caveat — Scalar Sidecar Pattern](references/grids.md#array-field-caveat--scalar-sidecar-pattern).

6. **Toolbar items are polymorphic.** Each `topToolbar` / `toolbar` entry's `type` selects which sibling `<type>Config` block the platform reads — `button` → `buttonConfig`, `selectBox` → `selectBoxConfig`, etc. All other sibling config blocks stay explicitly `null`. Separator entries have all configs null. **Click handlers live inside the type-specific config block** (`buttonConfig.clickFlowConfig.flowId`), not at the entry's top level. Three conventions every toolbar button should follow: (a) destructive actions carry `buttonDefaultStyleClass: "destructive"`; (b) selection-gated buttons init `readOnly: true` in `buttonConfig` (so they mount disabled before the first `on_select_row` event) AND have `on_select_row` toggle them live; (c) buttons with no useful tooltip set `tooltip: "''"` (the TS empty-string literal) to suppress the platform's display-label fallback. Dynamic tooltips route through a declared `$grid.vars.<name>` — direct flow-code assignment to `.tooltip` is a no-op. See [references/grids.md → Toolbar Items](references/grids.md#toolbar-items).

7. **Secondary (enrichment) datasources.** A grid's `datasources[]` array can carry additional datasources beyond the primary. Typical use: enrich each row with fields not in the primary entity (UDFs, external-system fields, foreign-key display resolutions). Invoke from `on_data_loaded` after `$grid.rows` has loaded, batch the query with `Id in ${ids}`, and write results via the [Imperative Cell API](references/grids.md#imperative-cell-api). Secondary datasources do **not** carry `dynamicFilters` / `dynamicOrderBys` — those drive the primary's filter UI only. They still follow the five-location rule for their own entity shape. Tailored grids use this pattern heavily — see [../tailoring-overlay/references/tailoring.md](../tailoring-overlay/references/tailoring.md).

8. **Imperative cell API.** Row and grid flows can mutate individual cells: `$row.cells.<col>.displayControl.text = "..."` (read-mode text), `$row.cells.<col>.displayControl.value = ...` (read-mode for checkBox / selectBox / etc.), `$row.cells.<col>.editControl.value = ...` (edit-mode), and the platform-managed `$row.cells.<col>.editControl.isChanged` boolean. Two idioms: post-load enrichment in `on_data_loaded` (columns whose value is populated imperatively keep empty `displayControl.<cfg>.value` strings — **don't "fix" to `$row.entity.<field>` unless the entity actually has the field**); change-guarded writes in `on_save_existing_row` (`if ($row.cells.<col>.editControl.isChanged) { payload.<X> = $row.cells.<col>.editControl.value; }` for minimal PATCH payloads). See [references/grids.md → Imperative Cell API](references/grids.md#imperative-cell-api) and [Empty Declarative Bindings Are Legitimate](references/grids.md#empty-declarative-bindings-are-legitimate).

9. **Text display bindings coerce non-string entity fields at the bind site.** `displayControl.textConfig.value` is typed `string`; binding `"$row.entity.<Id>"` when `<Id>` is `Edm.Int32` / boolean / date fails import with `Type '<number|boolean|...>' is not assignable to type 'string'`. Coerce at the bind site (`"$row.entity.Id?.toString()"`, `` "`${$row.entity.Id}`" ``, `"$row.entity.Active ? 'Yes' : 'No'"`, `"$utils.date.format($row.entity.CreatedSysDateTime, 'MM/DD/YYYY')"`), **not** in the entity schema — the entity's declared `type` drives dynamic filter/sort operator selection. See [references/grids.md → Text Display Bindings Need String Values](references/grids.md#text-display-bindings-need-string-values).

10. **Embedded datasource component-identity envelope.** An embedded `datasources[]` entry isn't just a query spec — it's a full datasource component with the same identity fields a standalone `-datasource.json` would carry. `datasources[0].referenceName` must match `datasourceConfig.configId` exactly (the lookup key); the entry also needs `title`, non-empty `description` ≤ 100 chars, `hasKey: true` for paginated/collection datasources, `hasResult: true`, `id: null` on net-new, `linkedDatasources: null`, `customColumns: null`, declared `inParams` / `outParams` / `vars` / `events`, and `accessModifier: "private"`. Missing the envelope reports as `Invalid contract. Referenced own configuration <name> does not exist or has been renamed` and cascades into `Cannot find name 'get' / 'getList' / 'inParams' / 'refresh'` TS errors (all fallout from the one unresolved reference). See [references/grids.md → Embedded Datasource Component-Identity Envelope](references/grids.md#embedded-datasource-component-identity-envelope).

11. **`fullTextSearch` and the inner `configParameters` contract.** `fullTextSearch` is non-nullable boolean. `true` mounts the built-in search box; its value arrives at the datasource as `$flow.inParams.full_text_search` **only** if you wire it via a `datasourceConfig.configParameters` entry whose `value` is `"$grid.fullTextSearch"`. There is no auto-wiring. Same rule for any other inParam declared on the embedded datasource — a declared inParam with no `configParameters` entry stays unbound at runtime, any filter that depends on it never fires, and the import flags a contract mismatch between the grid and its embedded datasource. See [references/grids.md → datasourceConfig.configParameters — Feeding Inputs to the Datasource](references/grids.md#datasourceconfigconfigparameters--feeding-inputs-to-the-datasource).

12. **`$grid.vars` / `$row.vars` declared.** Every `$grid.vars.<id>` written in flow code must be declared in the top-level `vars[]` array; every `$row.vars.<id>` in `rowVars[]`. Same property-descriptor shape as `inParams` / `outParams`. Missing declarations fail on import with `Property 'vars' does not exist on type 'IGrid'` (or `IRow`).

13. **Sibling `*Config` keys are explicitly null.** On every `displayControl`, `editControl`, toolbar entry, and filter entry, only the active sub-config is populated; the rest stay explicitly `null`. Match this convention for structural diffing — existing grid components keep all sibling slots present and null.

14. **Calling-tier compliance.** Grid code calls **functions** via `$flows.<Package>.<fn>`; the function wraps the CRUD action call as `$apis.<Package>.FootprintApi.extendedActions.<action_name>({...})`. The built-in `crud_create_entity` / `crud_update_entity` / `crud_delete_entity` from Utilities are the conventional persistence path. No direct action calls from grid code. See [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md).

15. **Mounting from a hub.** Hubs embed grids inside `tabs[].contentConfig` (when `contentType: "grid"`). The mount carries its own `configId` + `moduleId` — `moduleId` is the **grid's** package, not the hosting hub's feature folder. `configParameters` on the mount feed the grid's own `inParams` (every inParam the grid declares gets an entry on the host); `configEvents` subscribe to grid-emitted events. Invoke `component-wiring-check` to audit reference contracts on both sides — the outer host → grid contract AND the inner grid → embedded-datasource contract. See [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) and [references/grids.md → Mounting a Grid from a Hub](references/grids.md#mounting-a-grid-from-a-hub).

### Phase 4: Validate + push

```bash
# Validate the body locally against the branch. Exit 1 = validation found errors
# (read validation_errors, fix body.json, re-run) — not a broken CLI. Do not push on exit 1.
dxs configuration validate grid -b <branchId> -D body.json

# For a new grid
dxs configuration upsert grid -b <branchId> -D body.json

# For modify-existing (round-trip — never skip the jq extract)
dxs configuration get grid <configId> -b <branchId> -O envelope.json
jq .json envelope.json > body.json
# ... edit body.json ...
dxs configuration upsert grid -b <branchId> -D body.json
```

Validation surfaces missing required fields, malformed parameter-descriptor shapes, undefined flow-id references, and reference errors before push. It does **not** catch five-location drift, OData `selects` misses, dynamic-filter registration mirror drift between `datasources[0]` and `datasourceConfig`, partial lookupcode/id syncs, half-wired dynamic filter/sort (state C), unwrapped TypeScript-expression slots, or text display bindings that need coercion — those are structural or behavioral and only surface at upload-time validation or runtime. Walk the pre-flight checklist below before push, and always invoke `grid-validator` (Phase 5).

### Phase 5: Validate with `grid-validator` (MANDATORY)

Any grid edit — net-new, entity-shape change, filter/sort registration change, toolbar change, secondary-datasource change, or even a label tweak — **must** be followed by an invocation of the `grid-validator` subagent on the affected grid. Grids carry more silent-failure traps than any other component (the five-location rule, the two-site registration mirror, the OData `selects` sixth location, the partial-lookupcode/id syncs, the half-wired filter/sort bug state), and the generic `component-validator` doesn't know about them.

Delegate to the `grid-validator` subagent with the grid's file path or configId. It re-runs the full Pre-Flight Checklist, flags drift you may have missed (especially five-location drift), and returns a punch list — not a rewrite. Treat its blockers as must-fix before declaring the grid done. Skipping this step is how partial-sync errors reach upload-time validation.

If the running app is available, also open the grid through its normal mount path (the hub tab that hosts it) and confirm: row population from the backing datasource, column rendering (no empty columns where imperatively-enriched values were expected), filter / sort controls applying to the row set (state A, not state C), toolbar selection-gated buttons mounting disabled and enabling on first selection, and `$grid.events.outParamsChange.emit()` propagating to the host.

If the running app isn't available, re-fetch the config (using the corrected `jq .json` extract pattern) and diff against `body.json` to confirm the push landed.

## Pre-Flight Checklist

Before push, walk this pre-flight checklist (and invoke `grid-validator` for the deep grid-specific gate). The fast version:

1. **File name, suffix, `referenceName` agree.** `description` non-empty and ≤ 100 chars. `accessModifier` set.
2. **Grid-specific datasources are embedded, not standalone.** A standalone `<grid-specific-name>-datasource` config on the branch is a smell — promote to an owned entry inside the grid, or confirm another component actually consumes it.
3. **Embedded datasource carries the full component-identity envelope** — `referenceName` matches `datasourceConfig.configId`, `title`, `description`, `hasKey: true`, `hasResult: true`, `id: null` on net-new, `linkedDatasources: null`, `customColumns: null`, declared `inParams` / `outParams` / `vars` / `events`, `accessModifier: "private"`.
4. **Text display bindings coerce non-string entity fields** at the bind site. Coerce `Edm.Int32` with `?.toString()`, `boolean` with a ternary, `Date` via `$utils.date.format(...)` — never change the entity schema's declared `type` to satisfy a display binding.
5. **Five entity-shape locations in sync.** Grep a neighbor field's id; count of occurrences must match for the new field. For OData-backed grids, confirm `queryOptions.selects` includes the field (locations 3 and 4 are `null`); nested fields go in `expands[].queryOptions.selects`.
6. **Dynamic filter/sort wiring:** field in both registration sites (`datasources[0].dynamicFilters` *and* `datasourceConfig.dynamicFilters`); per-column `dynamicFilter` / `dynamicOrderBy` / `dynamicFilterType` / `dynamicFilterControl`; no `$filter` / `$orderby` in any `inParams` or `configParameters`.
7. **Dynamic filter/sort application is all-or-nothing.** For flow-type backings, either fully wired (registrations + per-column + applied in `getListFlow`) or fully disabled (registrations and per-column wiring removed). State C — UI controls registered but flow code doesn't apply them — is the bug state.
8. **Collection fields use a scalar sidecar** for filter/sort; the sidecar is populated in flow code and present in all five entity-shape locations.
9. **Toolbar click handlers are inside the type-specific config block**, not at the entry's top level. Sibling config blocks are explicitly `null`. Separator entries have all configs `null`.
10. **Destructive buttons carry `buttonDefaultStyleClass: "destructive"`; buttons with no tooltip use `tooltip: "''"`** (empty TS literal) so the platform doesn't fall back to the label. **Dynamic tooltips bind to a declared `$grid.vars.<name>`** — direct flow-code assignment to `.tooltip` is a no-op.
11. **`on_select_row` gates toolbar `readOnly`** for selection-dependent buttons (live toggling), **and those buttons also seed `readOnly: true` statically in `buttonConfig`** so they mount disabled before the first selection event fires.
12. **Cells populated imperatively have empty `displayControl.<cfg>.value`** — don't "fix" to `$row.entity.<field>` unless the entity actually has the field.
13. **Every `$grid.vars.<id>` and `$row.vars.<id>`** written in flow code is declared in the grid's top-level `vars[]` / `rowVars[]` arrays.
14. **Outer host contract.** Every inParam the grid declares has an entry on the host's `configParameters`; no extra entries for params the grid doesn't declare. `moduleId` on the host's reference is the grid's package, not the host's.
15. **Inner datasource contract.** The grid's own `datasourceConfig.configParameters` covers every inParam declared on the embedded datasource — including `full_text_search` when `fullTextSearch: true` (no auto-wiring; needs an explicit entry with `value: "$grid.fullTextSearch"`).
16. **`$grid.events.outParamsChange.emit()` fires** after any write to `$grid.outParams.*` the host subscribes to.
17. **Calling-tier compliance** — grid code calls functions via `$flows.<Package>.<fn>`; functions wrap CRUD actions via `$apis.<Package>.FootprintApi.extendedActions.<action_name>({...})`; no direct action calls from the grid.
18. **`grid-validator` invoked.** Mandatory — see closer below.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Adding a `_lookupcode` column but forgetting the `_id` companion in the five entity-shape locations | A storage column usually comes as a pair: `owner_id` (number) + `owner_lookupcode` (string). The numeric id still needs to appear in all five locations even when only the lookupcode has a visible column — otherwise `configOutParameters[result].objectTypeDef` and `outParams[result].objectTypeDef` diverge on the id's presence. Carry **every** new storage field into all five, not just the ones with visible columns. |
| Patching only 3 of 5 entity-shape locations | Easy to miss `getListFlow.outParams[result].objectTypeDef` and `getByKeysFlow.outParams[result].objectTypeDef` because they sit nested inside flow bodies that look like unrelated flow definitions. They aren't — they declare what the flow returns, and the datasource's own outParams pulls from them. |
| OData-backed grid: field added to `queryOptionsObjectTypeDef` and `configOutParameters` but missing from `queryOptions.selects` | The type metadata declares the field; `selects` is what actually retrieves it. Missing the sixth location leaves the entity undefined at runtime — the grid imports cleanly, renders an empty column, and may throw on first row render if a binding expression dereferences the undefined value. Add to `expands[].queryOptions.selects` for nested fields. |
| Dynamic filter UI registered but `getListFlow` doesn't apply `$filter` / `$orderby` (state C) | Either fully wire (apply `applyDynamicFilter` / `applyDynamicOrderBy` against `($flow.inParams as any).$filter` / `$orderby`) or fully disable (remove registrations and per-column wiring). Half-wired UI controls that do nothing are the bug state. |
| Drift between `datasources[0].dynamicFilters` and `datasourceConfig.dynamicFilters` | Import error: `Datasource <id>: Outdated contract. Type mismatch for dynamic filtering/sorting`. Both registration sites must be identical — update them in the same edit. |
| `$filter` / `$orderby` declared in `getListFlow.inParams` or in `datasourceConfig.configParameters` | The platform auto-injects typed versions from the registrations. Manual declarations collide. Remove them; cast with `($flow.inParams as any).$filter` at the application site. |
| `dynamicFilter` targets a collection field (`isCollection: true`) directly | Filter UI generates `equals "X"` clauses that don't apply cleanly to arrays. Introduce a scalar sidecar (`accounts_display` = `accounts.join(', ')`) and target the sidecar; carry the sidecar in all five entity-shape locations and populate it in flow code. |
| Toolbar entry's `clickFlowConfig` placed at the entry's top level | Click handlers live **inside** the type-specific config block (`buttonConfig.clickFlowConfig.flowId`). Top-level placement is silently ignored. |
| `displayControl.textConfig.value: "$row.entity.Id"` when `Id` is `Edm.Int32` | Import error: `Type 'number' is not assignable to type 'string'`. Coerce at the bind site (`"$row.entity.Id?.toString()"`) — **don't** change the entity's declared `type` to `string`, which corrupts dynamic filter/sort operator selection. |
| Imperatively-populated column "fixed" to `$row.entity.<field>` | The fix overwrites the imperative population on every render. Empty `displayControl.<cfg>.value` strings are legitimate for cells whose value comes from `on_data_loaded` enrichment. |
| Selection-gated toolbar button mounts enabled, can be clicked before any row is selected | The `on_row_selected` flow only fires *after* a selection change. Seed `readOnly: true` in `buttonConfig` statically AND gate it live in `on_select_row` — belt + suspenders. |
| Embedded `datasources[0].referenceName` doesn't match `datasourceConfig.configId` | Import error: `Invalid contract. Referenced own configuration <name> does not exist or has been renamed`, followed by a cascade of `Cannot find name 'get' / 'getList' / 'inParams' / 'refresh'` TS errors. Fix the identity envelope and the entire cascade disappears. |
| `fullTextSearch: true` and datasource declares `full_text_search` inParam but no `configParameters` entry on the grid | Search box mounts but the value never reaches the datasource. Add `{ parameter: { id: "full_text_search", ... }, value: "$grid.fullTextSearch" }` to `datasourceConfig.configParameters`. |
| `$grid.vars.<id> = ...` or `$row.vars.<id> = ...` in flow code with `vars: null` / `rowVars: null` | Import error: `Property 'vars' does not exist on type 'IGrid'` / `IRow`. Declare every var / rowVar in the top-level array with the same property-descriptor shape as inParams/outParams. |
| Flow code assigns to `$grid.topToolbar.<id>.buttonConfig.tooltip` (or column / filter `.tooltip`) and tooltip doesn't change | `.tooltip` is declarative-only. Declare `$grid.vars.<name>` (string), bind the slot to `"$grid.vars.<name>"`, and assign the var in flow code. |
| Hub mount's `moduleId` set to the hub's feature folder instead of the grid's package | Cross-component reference rule — `moduleId` is always the **target's** module. The grid lives where it's registered. See `../component-wiring-check/references/component-wiring.md`. |
| Sibling `*Config` slot dropped (e.g. only `textConfig` populated on a column's `displayControl`, other sub-configs missing) | Existing grids keep all sibling slots present and `null` for structural diffing. Match the convention. |
| `rowSizingType` / `columnSizingType` set to a non-member literal (`"fill"`, `"Fill"`) | Error: `Error converting value '...' to type 'System.Nullable\`1[...EGridColumnSizingType]'`. Members are camelCase: `"cellsWidth"`, `"headersWidth"`, `"fixedWidth"`, `"fitedWidth"` (note spelling), and `"default"`, `"relaxed"`, `"compact"` for `rowSizingType`. |
| `fullTextSearch` set to `null` or `{ enabled: true }` | The server expects a bare `System.Boolean`. Both shapes fail import. Use `true` or `false`. |
| Piping `dxs configuration get -O envelope.json` directly into `dxs configuration upsert -D envelope.json` | Silently destroys config content. Always `jq .json envelope.json > body.json` before editing. See "Round-trip rule" above. |
| `description` exceeds 100 chars | SQL column limit — push will fail validation. Tighten. |
| `referenceName` doesn't end in `_grid` or doesn't match filename stem | Import / lookup breaks. Snake_case, `_grid` suffix, filename stem matches. |
| Grid edit pushed without invoking `grid-validator` | The generic `component-validator` doesn't catch five-location drift, OData `selects` misses, dynamic-filter registration mirror drift, or partial lookupcode/id syncs. Always invoke `grid-validator` — it's mandatory. |

**After your edit, invoke `grid-validator` (mandatory — grids carry envelope/text-display gotchas the generic validator misses). For description/JSON/schema hygiene, also invoke `post-edit-verification`.**
