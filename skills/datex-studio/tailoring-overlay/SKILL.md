---
name: tailoring-overlay
description: |
  Use when extending an existing core-library Datex Studio component (most
  commonly a grid) via the baseConfiguration overlay mechanism, or flattening
  a tailored overlay into a standalone custom_ variant. Owns the three
  provenance variants (core / tailored_ / custom_), the three moving parts
  of a tailored overlay, the flatten-to-custom 12-step recipe, and
  enrichment-datasource patterns alongside the tailored grid. Triggers:
  "tailor xxx grid", "add a customer-specific column to xxx", "override the
  base's on_save flow", "flatten this tailored grid into a custom one",
  "enrich a core grid with extra fields", "Outdated contract errors between
  a tailored overlay and its base".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - grid-creator
  - datasource-creator
  - component-wiring-check
  - schema-explorer
  - requirements-gathering
  - post-edit-verification
  - component-validator
  - grid-validator
---

# Tailoring Overlay

Extend an existing core-library Datex Studio component (most commonly a grid, but the model applies analogously to forms, editors, and hubs) via the `baseConfiguration` overlay mechanism, or flatten a tailored overlay into a standalone `custom_<base>` variant. A tailored component references a base via `baseConfiguration`, inherits its full contract, and layers targeted overrides on top — new columns, new flows, customization hooks against existing flows, additional secondary datasources, suppressed items. The overlay tracks the base as it evolves; flattening collapses the overlay into a fully authoritative copy when the customer's needs have diverged enough that the inheritance no longer pays for itself.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/tailoring.md](references/tailoring.md) — Authoritative tailoring reference: provenance variants, anatomy of a tailored component (`baseConfiguration`, `fromBaseConfiguration: true` shadow marker, `onCustomization<Slot>FlowConfig` hook pairs, `removed: true` suppression), secondary enrichment datasources, the 12-step flatten-to-custom recipe, pre-flight checklist
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and TypeScript-expression encoding rules (tailoring is not its own type — the type identifier is whatever the tailored component is, most commonly `grid`)
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `tailored_` / `custom_` prefix rules; `tailored_<base>_grid` naming
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — platform-injected globals available in tailored flow code (`$grid`, `$row`, `$flows`, `$apis`, `$utils`, ...) — identical to the base's tier
- [../grid-creator/references/grids.md](../grid-creator/references/grids.md) — grid authoring reference (the most common tailored component type) — five-location rule, imperative cell API, embedded datasource envelope
- [../datasource-creator/references/flow-datasources.md](../datasource-creator/references/flow-datasources.md) — flow-type datasource shape for tailored secondary (`tailored_ds_<base>`) enrichment datasources
- [../datasource-creator/references/odata-datasources.md](../datasource-creator/references/odata-datasources.md) — schema pre-flight applies when flattening to a custom that newly authorizes OData fields
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — vars-must-be-declared rule applies to tailored flow code and to flattened custom flows

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`grid-creator`** skill — invoked when the tailored component is a grid; the grid authoring rules (file shape, five-location rule, imperative cell API, embedded datasource envelope) apply identically to tailored grids
- **`datasource-creator`** skill — invoked when a tailored overlay's secondary enrichment datasource is large enough to deserve its own standalone file, or when consolidating a secondary into the primary during flatten (the five-location rule still applies)
- **`schema-explorer`** skill — invoked when the flatten step newly authorizes OData fields against the Footprint schema (OData schema pre-flight in step 10 of the flatten recipe)
- **`component-wiring-check`** skill — invoked to audit reference contracts and the vars-must-be-declared rule on the tailored overlay (and again on the flattened custom)
- **`grid-validator`** skill — **mandatory** invocation after every tailored-grid edit (and after flattening to a custom grid); re-runs the grid pre-flight checklist, catches five-location drift, secondary-datasource wiring misses, and the partial-lookupcode/id syncs that survive flatten
- **`component-validator`** skill — invoked for non-grid tailored components (forms, editors, hubs) where `grid-validator` doesn't apply

## CLI Lifecycle

Tailoring is not its own configuration type — a tailored overlay is itself an instance of whatever the base is (most commonly a grid). The CLI surface is the same as the base's: `dxs configuration get` / `dxs configuration upsert <type>` against the tailored variant's referenceName. The type identifier passed to `dxs configuration` is whatever matches `ConfigurationEndpoints.normalize_type` output for the base — `grid` (mapping to `configurationTypeId: 3`) in the typical case; analogously `form`, `editor`, or `hub` for the less common cases.

**Create a new tailored overlay (grid example):**

```bash
# 1. Fetch the base body to identify referenceName / moduleId / columns / flows / datasources / inParams / outParams (read-only — used as source material for shadow copies)
dxs configuration get grid <base_referenceName> -b <branchId> -O base-envelope.json
jq .json base-envelope.json > base.json
# 2. Build body.json for the tailored overlay from scratch (see references/tailoring.md → Pre-Flight Checklist — Authoring a Tailored Overlay)
#    - referenceName = tailored_<base_name>_grid
#    - baseConfiguration = { configId: <base_referenceName>, moduleId: <base_package>, isOwned: null }
#    - every inherited element carries fromBaseConfiguration: true (shadow copies; must match base exactly)
#    - new elements carry fromBaseConfiguration: null
#    - onCustomization<Slot>FlowConfig + ...ExecutionBehaviorType paired
# 3. Validate (recommended)
dxs configuration validate grid -b <branchId> -D body.json
# 4. Create
dxs configuration upsert grid -b <branchId> -D body.json
```

**Edit an existing tailored overlay:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get grid <tailored_referenceName> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard — see "Round-trip rule" below)
jq .json envelope.json > body.json
# 3. Edit body.json (respect shadow-copy rules — do not hand-edit fromBaseConfiguration: true elements)
# 4. Validate (recommended)
dxs configuration validate grid -b <branchId> -D body.json
# 5. Push
dxs configuration upsert grid -b <branchId> -D body.json
```

**Flatten a tailored overlay into a standalone custom (grid example):**

```bash
# 1. Fetch the tailored overlay body
dxs configuration get grid <tailored_referenceName> -b <branchId> -O envelope.json
jq .json envelope.json > body.json
# 2. Walk the 12-step recipe in references/tailoring.md → Conversion Recipe: Flattening a Tailored Component
#    - rename to custom_<base>; drop baseConfiguration; flip every fromBaseConfiguration: true -> null;
#      cut every removed: true entry; collapse onCustomization* hooks per behavior;
#      consolidate datasources; resolve overlapping columns; etc.
# 3. Validate (recommended)
dxs configuration validate grid -b <branchId> -D body.json
# 4. Create the custom (the flattened body is a brand-new component)
dxs configuration upsert grid -b <branchId> -D body.json
# 5. Decide whether to keep or remove the original tailored overlay (often the custom replaces it)
```

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. The corrected sequence above (extract inner `.json` with `jq` before editing) is mandatory for any round-trip. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

Tailored bodies carry every slot the base carries — `columns`, `datasourceConfig`, embedded `datasources[]`, `flows` / `rowFlows`, `topToolbar` / `toolbar`, `filters`, `inParams` / `outParams` / `vars` / `rowVars` — plus the three tailoring-specific moving parts (`baseConfiguration`, the `fromBaseConfiguration: true` shadow markers, the `onCustomization<Slot>FlowConfig` hook pairs, and `removed: true` suppression flags). Round-trip discipline (fetch → jq-extract → edit → validate → push) is non-negotiable, and shadow drift between the overlay and its base surfaces at import as "Outdated contract" errors — the single most common tailoring failure mode.

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
[Phase 2: Decide overlay vs flatten]
Consult references/tailoring.md → Provenance Variants and When to Flatten:
  - core base + customer-specific tweaks tracking base evolution
    -> author a tailored overlay (Phase 3)
  - existing tailored overlay whose base evolution is no longer
    relevant, or whose maintenance burden outweighs the benefit
    -> flatten to standalone custom (Phase 5)
  - net-new customer-specific component with no base relationship
    -> stop; this is a from-scratch custom; invoke `grid-creator`
    (or form-/editor-/hub-creator) directly
        |
[Phase 3: Author tailored overlay]
Build body.json:
  - referenceName = tailored_<base_name>_grid (analog for form/editor/hub)
  - baseConfiguration = { configId, moduleId, isOwned: null } pointing at
    the core base; moduleId is the BASE's package, not the overlay's
  - Every inherited element copied with fromBaseConfiguration: true
    (top-level params, columns, toolbar entries, flows, rowFlows, primary
    datasource and its nested shape, dynamicFilters, configParameters);
    shadow copies must match the base exactly — drift surfaces as
    "Outdated contract" at import
  - New elements (columns, toolbar buttons, flows) authored with
    fromBaseConfiguration: null
  - The three moving parts:
    * fromBaseConfiguration: true vs null — shadow vs new
    * onCustomization<Slot>FlowConfig + ...ExecutionBehaviorType
      (before / after / replace) — hook pair; placeholder behavior on
      null configs keeps the pair contractually shaped
    * removed: true — suppress an inherited entry without deleting
      the shadow
  - Secondary (enrichment) datasource: tailored_ds_<base> embedded
    alongside the inherited primary in datasources[]; invoke from
    an `after` customization on on_data_loaded; batch-fetch by Id;
    populate via Imperative Cell API; tailored-specific columns
    carry empty declarative bindings (the one legitimate case)
  - Vars / rowVars: every $grid.vars.<id> / $row.vars.<id> the
    tailored flows write is declared at the overlay's top-level
    vars[] / rowVars[]
  - Invoke `component-wiring-check` to audit the tailored overlay's
    reference contracts
        |
[Phase 4: Validate + push]
dxs configuration validate <type> -b <branchId> -D body.json
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
dxs configuration upsert <type> -b <branchId> -D body.json
   (upsert creates or updates by referenceName — one command for both)
        |
[Phase 5: (Optional) Flatten to standalone custom]
When the decision in Phase 2 was "flatten" (or you've reached the
point where the overlay no longer pays for itself), walk the
12-step recipe in references/tailoring.md:
  1. Rename to custom_<base>; rename file; update embedded ids
  2. Drop baseConfiguration -> null
  3. Unshadow everything: flip every fromBaseConfiguration: true -> null
  4. Cut every removed: true entry from JSON
  5. Collapse onCustomization* hooks into the base slot per behavior;
     null out onCustomization* fields; delete merged tailored_* flows
  6. Consolidate datasources (preferred: merge secondary into primary;
     touch queryOptions.selects AND all five type-metadata locations
     AND dynamicFilters / dynamicOrderBys on BOTH sites) OR keep as
     custom_ds_<base> if it queries a different entity set
  7. Resolve overlapping columns (drop base's, rename tailored to
     canonical id, update $row.cells.<col> references)
  8. Update imperative populations — empty declarative bindings
     replaced with $row.entity.<field> where the field is now
     authoritative on the custom
  9. Repackage — update $shell.<Package>.* / $types.<Package>.* /
     $flows.<Package>.* to the custom's package
 10. OData schema pre-flight via `schema-explorer` for newly-
     authoritative OData field additions
 11. Re-declare vars / rowVars at the custom's top level
 12. Verify descriptions <= 100 chars
        |
[Validate with `grid-validator` (mandatory for tailored grids and
flattened custom grids) — generic `component-validator` for non-grid
tailored components]
        |
[invoke `post-edit-verification` for description/JSON/schema hygiene]
```

## Phase Details

### Phase 1: Setup + Requirements

1. Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for branch and connection selection. **Never assume a branch ID** — ask the user to confirm, or run `dxs source branch list --all-repos --status feature` for selection.
2. Check whether a **requirements brief** already exists in the conversation context (produced by `requirements-gathering` or another calling skill).
   - **Brief exists** — use it. The brief should establish the **base component** being tailored (its `referenceName`, package, what it does), the **customer-specific tweaks** needed (new columns / fields, new toolbar actions, base flows to hook with `before` / `after` / `replace` behavior, base elements to suppress), any **fields not in the base datasource's select list** that drive the need for a secondary enrichment datasource, and whether the goal is **author an overlay** or **flatten an existing overlay into a custom**.
   - **No brief** — invoke the `requirements-gathering` skill first. Getting the tailored vs custom decision right up front avoids re-authoring the file from scratch when the customer's actual needs diverge enough from the base that flattening is the better path.

### Phase 2: Decide overlay vs flatten

Consult [references/tailoring.md → Provenance Variants](references/tailoring.md#provenance-variants) and [Conversion Recipe: Flattening a Tailored Component](references/tailoring.md#conversion-recipe-flattening-a-tailored-component) before authoring. The decision drives whether you're writing an overlay or collapsing one.

**Author a tailored overlay** when:

- A core base exists with the bulk of the behavior you need.
- Customer-specific tweaks are limited in scope: a few new columns, a new toolbar action, a `before` / `after` hook on a base flow, a suppressed inherited entry, an enrichment datasource for fields not in the base's select list.
- The base is actively evolving and the customer benefits from inheriting ongoing improvements automatically.

**Flatten a tailored overlay into a standalone custom** when:

- The customer's needs have diverged enough that little of the base's behavior survives the overrides.
- The base is deprecated, replaced, or otherwise no longer evolving in a direction the customer cares about.
- The maintenance burden of the overlay (tracking base drift, keeping shadows in sync, debugging "Outdated contract" errors) outweighs the benefit of automatic base updates.

**Stop and use a different skill** when:

- The component being authored is genuinely net-new with no base relationship — invoke `grid-creator` (or `form-creator` / `editor-creator` / `hub-creator`) directly. The `custom_` prefix is reserved for overlays that have been flattened *or* customer-specific components that intentionally signal "no upstream"; it's not a default naming convention for every from-scratch component.
- The change being made to the base is generic enough that it should land on the base itself — propose the change against the core package rather than overlaying.

### Phase 3: Author tailored overlay

Build `body.json` from the steps in [references/tailoring.md → Pre-Flight Checklist — Authoring a Tailored Overlay](references/tailoring.md#pre-flight-checklist--authoring-a-tailored-overlay). Key points:

1. **Read the base body first.** Identify its `referenceName`, `moduleId` (package), columns, flows, datasources, inParams, outParams. The base body is read-only — never edit it as part of tailoring. Fetching via `dxs configuration get <type> <base_referenceName>` and extracting the inner `.json` gives you the source material for shadow copies.

2. **Filename and `referenceName`.** Filename matches the pattern `tailored_<base_name>_<type>-<type>.json` (e.g. `tailored_contact_addresses_grid-grid.json` for a grid). `referenceName` is the snake_case form ending in the type suffix (`tailored_contact_addresses_grid`). The package may be different from the base's — cross-package overlay is supported. See [references/tailoring.md → Provenance Variants](references/tailoring.md#provenance-variants).

3. **`baseConfiguration` points at the base.** Top-level field, present and non-null. `configId` = base's `referenceName`. `moduleId` = base's package (the package the base lives in, **not** the overlay's package). `isOwned: null` for the cross-referenced base case. Setting `moduleId` to the overlay's package is one of the most common authoring mistakes — the platform resolves the base by `{ moduleId, configId }` and a wrong package silently fails to find the base. See [references/tailoring.md → `baseConfiguration` — pointer to the base](references/tailoring.md#baseconfiguration--pointer-to-the-base).

4. **Shadow copies carry `fromBaseConfiguration: true`.** Every inherited element — top-level `inParams[]` / `outParams[]`, `columns[]`, `topToolbar[]` (and nested `buttonConfig`), `flows[]` / `rowFlows[]`, `datasources[]`, `datasources[0].queryOptionsObjectTypeDef[]`, `datasources[0].outParams[].objectTypeDef[]`, `datasources[0].inParams[]`, `datasources[0].dynamicFilters[]`, `datasources[0].configParameters[].parameter` — carries `fromBaseConfiguration: true`. **Shadow content must match the base exactly.** Drift at import surfaces as "Outdated contract" errors against the entity shape or against the base's contract. Don't hand-edit shadow content; re-pull from the base if the base has changed since you copied. See [references/tailoring.md → `fromBaseConfiguration: true` — the shadow marker](references/tailoring.md#frombaseconfiguration-true--the-shadow-marker).

5. **New elements carry `fromBaseConfiguration: null`.** Tailored columns, new toolbar buttons, new flows / rowFlows authored fresh on the overlay take `null` here. Flipping `true` → `null` wholesale is the flatten step, not a normal authoring action.

6. **Customization hook pairs.** For each base flow slot you want to hook (`onInitFlowConfig`, `onDataLoadedFlowConfig`, `onSelectionChangedFlowConfig`, `onInitNewRowFlowConfig`, `onSaveNewRowFlowConfig`, `onSaveExistingRowFlowConfig`, `onRowDataLoadedFlowConfig`, `onExcelImportFlowConfig`, `onExcelExportFlowConfig` — analogous on forms/editors/hubs), populate the matching `onCustomization<Slot>FlowConfig` with `{ flowId, flowParameters }` pointing at a flow in your overlay's `flows[]` / `rowFlows[]` (conventionally named `tailored_<slot>`), and set `onCustomization<Slot>FlowConfigExecutionBehaviorType` to `before` / `after` / `replace`. The `...ExecutionBehaviorType` field is present even when the config is null — it carries a placeholder (typically `"after"`) so the pair is always contractually shaped. Buttons carry their own pair: `buttonConfig.clickFlowConfig` (base-defined) and `buttonConfig.onCustomizationClickFlowConfig`. See [references/tailoring.md → `onCustomization<Slot>FlowConfig` + `...ExecutionBehaviorType` — the hook pair](references/tailoring.md#oncustomizationslotflowconfig--executionbehaviortype--the-hook-pair).

7. **`removed: true` suppresses without deleting.** Applied to an inherited (`fromBaseConfiguration: true`) entry to suppress it at runtime while preserving the shadow. Appears on toolbar entries (and nested `buttonConfig`), and is shaped identically across collections where supported. **Don't delete the suppressed entry from the JSON** — the platform needs the shadow to reconcile against the base. See [references/tailoring.md → `removed: true` — suppression flag](references/tailoring.md#removed-true--suppression-flag).

8. **Secondary (enrichment) datasource — the standard pattern.** When you need fields not in the base datasource's `select` list (UDFs, external-system fields, FK display resolutions), embed a `tailored_ds_<base>` datasource in the overlay's `datasources[]` array alongside the inherited primary (`fromBaseConfiguration: true`). Then in an `after` customization on `on_data_loaded`, batch-fetch by `Id in ${ids}` against the secondary and write enrichment into each row via the [Imperative Cell API](../grid-creator/references/grids.md#imperative-cell-api). Tailored-specific columns carry **empty `value` strings** in their declarative `displayControl` / `editControl` configs — they're populated imperatively. This is one of the legitimate cases for empty declarative bindings; don't "fix" them to `$row.entity.<field>`. See [references/tailoring.md → Secondary (Enrichment) Datasources](references/tailoring.md#secondary-enrichment-datasources).

9. **Vars / rowVars declared.** Any `$grid.vars.<id>` / `$row.vars.<id>` your tailored flows write must be declared at the overlay's top-level `vars[]` / `rowVars[]` arrays. The base may declare some vars; new ones the overlay writes are authored fresh with `fromBaseConfiguration: null`. See [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md).

10. **Invoke `component-wiring-check`.** Audit the overlay's reference contracts and the vars-must-be-declared rule before push. If the tailored component is a grid, also confirm the inner grid → embedded-datasource contract on any new secondary datasource.

### Phase 4: Validate + push

```bash
# Validate the body locally against the branch (type identifier matches the tailored component's base type — `grid` in the typical case)
dxs configuration validate grid -b <branchId> -D body.json

# For a new tailored overlay
dxs configuration upsert grid -b <branchId> -D body.json

# For modify-existing (round-trip — never skip the jq extract)
dxs configuration get grid <tailored_referenceName> -b <branchId> -O envelope.json
jq .json envelope.json > body.json
# ... edit body.json ...
dxs configuration upsert grid -b <branchId> -D body.json
```

Validation surfaces missing required fields, malformed parameter-descriptor shapes, undefined flow-id references, and base-resolution errors before push. It does **not** catch shadow drift between the overlay and the base (which surfaces at import as "Outdated contract"), unpaired `onCustomization<Slot>FlowConfig` / `...ExecutionBehaviorType` configs, secondary-datasource five-location drift, partial lookupcode/id syncs on tailored columns, or `removed: true` entries accidentally deleted from the JSON. Walk the [references/tailoring.md → Pre-Flight Checklist](references/tailoring.md#pre-flight-checklist--authoring-a-tailored-overlay) before push and always invoke `grid-validator` (for tailored grids) or `component-validator` (for non-grid tailored components).

### Phase 5: (Optional) Flatten to standalone custom

Flattening collapses the overlay into an authoritative copy. It is mechanical once every tailoring surface is recognized, but it touches the whole file — plan the 12 steps explicitly so nothing gets skipped. Walk the recipe top-to-bottom in [references/tailoring.md → Conversion Recipe: Flattening a Tailored Component](references/tailoring.md#conversion-recipe-flattening-a-tailored-component). Summary:

1. **Rename.** `referenceName` → `custom_<base>`; rename the file; update embedded ids (`tailored_ds_<base>` → `custom_ds_<base>`, `tailored_on_<slot>` → `custom_on_<slot>` or merge-into-existing).
2. **Drop `baseConfiguration`.** Set to `null`.
3. **Unshadow everything.** Flip every `fromBaseConfiguration: true` → `null` across the file. All elements become authoritative.
4. **Cut suppressed items.** Drop every entry with `removed: true` from the JSON (no base to suppress against).
5. **Collapse the customization hooks.** For each populated `onCustomization<Slot>FlowConfig` pair, merge the tailored flow into the base slot per its behavior (`before` prepend, `after` append, `replace` overwrite). Null out every `onCustomization*` field. Delete the freestanding `tailored_*` flow from `flows[]` / `rowFlows[]` once its body is merged (unless still called by another flow).
6. **Consolidate datasources.** Preferred: merge the secondary's fields into the primary. Touch **all** of these — missing any causes silent failures: `datasources[0].queryOptions.selects` (the OData `$select` clause — the runtime data shape; without this entry, the field is `undefined` on `$row.entity` even if every type-metadata location is correct; nested → `expands[].queryOptions.selects`); all five type-metadata locations per [grids.md → Datasource Wiring — Five Places Must Stay in Sync](../grid-creator/references/grids.md#datasource-wiring--five-places-must-stay-in-sync); `datasources[0].dynamicFilters` / `dynamicOrderBys` and `datasourceConfig.dynamicFilters` / `dynamicOrderBys` if the merged field is filterable/sortable. Then delete the secondary entirely and strip the post-load enrichment calls. Alternative: keep the secondary as `custom_ds_<base>` when it queries a different entity set or can't be folded into a single query.
7. **Resolve overlapping columns.** If tailoring added a parallel column (`tailored_country` overriding the inherited `country`), drop the base's column and rename the tailored one to the canonical id. Update every `$row.cells.<col>` reference in flow code.
8. **Update imperative populations.** Cells now source-bound: replace empty declarative `value` with `$row.entity.<field>`; strip matching `row.cells.<col>.displayControl.text = ...` lines from `on_data_loaded`. Cells still needing imperative population (FK display resolution, computed text) stay.
9. **Repackage.** Custom components often live in the tailoring's package, not the base's. Update cross-component references (`$shell.<Package>.*`, `$types.<Package>.*`, `$flows.<Package>.*`) to match.
10. **OData schema pre-flight.** Newly-authoritative OData field additions trigger schema pre-flight via the `schema-explorer` skill — see [`odata-datasources.md` → Pre-Flight](../datasource-creator/references/odata-datasources.md#pre-flight-validate-against-schema). UDF fields queryable via OData but absent from the exported schema are acceptable; document them in the change notes.
11. **Re-declare vars / rowVars.** Any `$grid.vars.<id>` / `$row.vars.<id>` touched by flattened flows must be declared at the custom's top-level `vars[]` / `rowVars[]`. On the overlay they may have been implicitly inherited; on the standalone they must be explicit.
12. **Verify descriptions ≤ 100 chars.**

Once the recipe is complete, the custom component has no `baseConfiguration`, no `fromBaseConfiguration: true` markers, no `onCustomization*` values, and no `removed` flags — it's indistinguishable in shape from a from-scratch custom grid (or form / editor / hub). Then push as a brand-new component (`dxs configuration upsert <type> -b <branchId> -D body.json`); the flattened body is a net-new create, not an update of the overlay's id.

## Pre-Flight Checklist

Before push, walk the full checklist in [references/tailoring.md → Pre-Flight Checklist — Authoring a Tailored Overlay](references/tailoring.md#pre-flight-checklist--authoring-a-tailored-overlay) (and, for flatten, [Conversion Recipe](references/tailoring.md#conversion-recipe-flattening-a-tailored-component) top-to-bottom). The fast version:

**Authoring a tailored overlay:**

1. **`baseConfiguration` is set** with `configId` = base's `referenceName`, `moduleId` = **base's** package (not the overlay's), `isOwned: null`.
2. **Every inherited element carries `fromBaseConfiguration: true`** — top-level params, columns, toolbar entries, flows, rowFlows, primary datasource, nested entity shape, dynamic filters/orderbys, configParameters.
3. **New elements carry `fromBaseConfiguration: null`**.
4. **Customization hooks are paired correctly.** Every hook with a non-null `onCustomization<Slot>FlowConfig` has a matching populated `...ExecutionBehaviorType`; the referenced flow exists in `flows[]` / `rowFlows[]`.
5. **Shadows match the base exactly.** If the base has drifted since you copied, re-pull shadows — drift at import surfaces as "Outdated contract".
6. **Vars / rowVars declared.** Every `$grid.vars.<id>` / `$row.vars.<id>` your tailored flows write has a top-level declaration on the overlay.
7. **Enrichment columns carry empty declarative bindings** when populated imperatively from a secondary datasource. Don't "fix" them to `$row.entity.<field>`.
8. **`removed: true` preserves the shadow** — don't delete suppressed entries from the JSON.

**Flattening to custom:**

1. `baseConfiguration` → `null`; `referenceName` → `custom_<base>`; file renamed.
2. Every `fromBaseConfiguration: true` → `null`.
3. Every `removed: true` entry dropped from JSON.
4. Every `onCustomization<Slot>FlowConfig` pair collapsed into the base slot per its behavior; `onCustomization*` fields all null.
5. Secondary datasources merged (or retained as `custom_ds_<base>` with references updated).
6. For OData-merged fields: `queryOptions.selects` updated (and `expands[].queryOptions.selects` for nested), plus all five type-metadata locations. This is the single most common silent-failure after flattening.
7. Overlapping columns resolved; all `$row.cells.<col>` references updated.
8. Imperative populations now source-bound where appropriate; empty declarative bindings replaced with `$row.entity.<field>`.
9. Vars / rowVars re-declared at the custom's top level.
10. Cross-component references (`$shell.<Package>.*`, `$types.<Package>.*`, `$flows.<Package>.*`) updated to the custom's package.
11. OData schema pre-flight completed; UDF absences documented.
12. Descriptions ≤ 100 chars.

## Common Mistakes

| Mistake | Fix |
|---|---|
| `baseConfiguration.moduleId` set to the overlay's package instead of the base's | The platform resolves the base by `{ moduleId, configId }`. Wrong package silently fails to find the base, the overlay can't reconcile shadows, and import explodes. `moduleId` is always the **base's** package; cross-package overlay is supported via this exact field. |
| Hand-editing the content of a `fromBaseConfiguration: true` shadow | The base owns the definition. Shadow drift surfaces at import as "Outdated contract" errors. If the base has changed, re-pull the shadow from the base; don't hand-edit. |
| `onCustomization<Slot>FlowConfig` populated but `...ExecutionBehaviorType` left at its default placeholder, or the reverse | The pair is always contractually present, but only non-null configs fire. Populate both together: set the config to `{ flowId, flowParameters }` AND set the behavior to `before` / `after` / `replace` based on intent. |
| Tailored flow referenced from `onCustomization<Slot>FlowConfig` doesn't exist in the overlay's `flows[]` / `rowFlows[]` | Validation catches some cases; runtime catches the rest. Author the tailored flow with `fromBaseConfiguration: null` in the appropriate `flows[]` / `rowFlows[]` array before populating the hook. |
| Deleting an inherited entry from JSON instead of setting `removed: true` | The shadow must remain for the platform to reconcile against the base. Delete → "Outdated contract" because the base still declares it. Suppress with `removed: true` to keep the shadow and hide the entry at runtime. |
| New tailored column "fixed" to `$row.entity.<field>` when populated imperatively from a secondary datasource | The empty declarative `value` is intentional — the cell is populated by the `after` customization on `on_data_loaded`. The "fix" overwrites the imperative population on every render. See [grids.md → Empty Declarative Bindings Are Legitimate](../grid-creator/references/grids.md#empty-declarative-bindings-are-legitimate). |
| Secondary enrichment datasource omitted; tailored column shows empty values | The standard pattern is `datasources[]` carries both the inherited primary (with `fromBaseConfiguration: true`) and the new `tailored_ds_<base>` (with `fromBaseConfiguration: null`). Without the secondary, there's nothing to fetch the extra fields from. |
| `$grid.vars.<id> = ...` or `$row.vars.<id> = ...` in tailored flow code with no declaration on the overlay | Import error: `Property 'vars' does not exist on type 'IGrid'` / `IRow`. Declare every var / rowVar the overlay's tailored flows write at the top-level `vars[]` / `rowVars[]`. Inheritance from the base does not extend to vars the overlay introduces. |
| Flattening: missed `queryOptions.selects` when consolidating a secondary into the primary (OData backings) | Silent failure — type metadata says the field exists, runtime data doesn't include it. `$row.entity.<field>` is `undefined`. Add the field to `datasources[0].queryOptions.selects` (or the appropriate `expands[].queryOptions.selects` for nested) **in addition to** the five type-metadata locations. This is the single most common flatten failure. |
| Flattening: `fromBaseConfiguration: true` left in place on some elements | The custom is supposed to be authoritative end-to-end. Any remaining `fromBaseConfiguration: true` means the platform still tries to resolve against a base — but `baseConfiguration` is `null`, so resolution fails. Flip every occurrence to `null` in one sweep. |
| Flattening: forgot to delete the `tailored_*` flow whose body was merged into the base slot | The flow is now dead code; references to it from elsewhere in the file may also be stale. Delete the freestanding entry from `flows[]` / `rowFlows[]` once its body has been merged. (Keep only if still being called as a helper.) |
| Flattening: vars / rowVars inherited from base not re-declared on the custom | The overlay may have implicitly inherited some vars from the base. On a standalone custom, every var/rowVar must be declared explicitly. Walk every `$grid.vars.<id>` / `$row.vars.<id>` reference in the flattened flow code and verify each has a top-level declaration. |
| Treated `custom_<base>` as a default naming convention for from-scratch components | The `custom_` prefix signals "the result of flattening a tailored overlay" *or* "intentionally signals no upstream relationship". For genuinely net-new components with no base history, the conventional name doesn't carry the `custom_` prefix. Don't reach for `custom_` as the default. |
| Piping `dxs configuration get -O envelope.json` directly into `dxs configuration upsert -D envelope.json` | Silently destroys config content. Always `jq .json envelope.json > body.json` before editing. See "Round-trip rule" above. |
| `description` exceeds 100 chars on the overlay or the flattened custom | SQL column limit — push will fail validation. Tighten. |
| Tailored grid edit pushed without invoking `grid-validator` | The generic `component-validator` doesn't catch five-location drift on the secondary datasource, OData `selects` misses, dynamic-filter registration mirror drift, or partial lookupcode/id syncs on tailored columns. Always invoke `grid-validator` for tailored grids — it's mandatory. |

**After your edit, invoke `post-edit-verification` for description/JSON/schema hygiene. If you tailored a grid, also invoke `grid-validator` (mandatory — grids carry envelope/text-display gotchas). For non-grid tailored components, invoke `component-validator`.**
