---
name: selector-creator
description: |
  Use when authoring or modifying a Datex Studio selector (configurationTypeId=7,
  *-selector.json suffix) on a branch — datasource-backed dropdown / autocomplete
  control. Owns the hard component-variant rule (backing must be a -datasource.json,
  never a -footprintDatasource.json), the sort-by-display-label rule, and the
  three-piece full-text-search contract (getList filter + getByKeys keyset +
  full-text param). Triggers: "create a dropdown", "create an xxx_dd selector",
  "autocomplete for entity X", "enum dropdown", "dropdown is empty", "full-text
  search doesn't filter the dropdown", "selector backing-datasource is wrong
  variant".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - datasource-creator
  - type-definition-creator
  - form-creator
  - hub-creator
  - component-wiring-check
  - schema-explorer
  - requirements-gathering
  - post-edit-verification
  - component-validator
---

# Selector Creator

Author or modify a Datex Studio selector (configurationTypeId=7) on a branch — the platform's dropdown / autocomplete control. Selectors define an option list backed by a datasource, a display-label expression over each option, and a built-in full-text search box that forwards typed input into the backing datasource. They mount inside form fields, hub filter dropdowns, and grid filter cells; they don't render standalone.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/selectors.md](references/selectors.md) — Authoritative selector authoring reference: component-variant rule, file shape, datasource wiring, full-text search three-piece contract, getList ↔ getByKeys parity
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and TypeScript-expression encoding rules
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_dd` suffix convention, filename stem matching, display-name rule
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — platform-injected globals available in selector code (`$selector`, `$option`, `$flows`, `$utils`, ...)
- [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules (call functions, never actions)
- [../datasource-creator/references/datasources.md](../datasource-creator/references/datasources.md) — datasource taxonomy (component variant `-datasource.json` vs FPDS `-footprintDatasource.json`)
- [../datasource-creator/references/flow-datasources.md](../datasource-creator/references/flow-datasources.md) — flow-type datasource shape (enum dropdowns, computed option sets)
- [../datasource-creator/references/odata-datasources.md](../datasource-creator/references/odata-datasources.md) — OData-type datasource shape (entity-backed dropdowns)
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — caller-contract rules, moduleId rule
- [../form-creator/references/forms.md](../form-creator/references/forms.md) — typical mounting site (form fields)
- [../hub-creator/references/hubs.md](../hub-creator/references/hubs.md) — typical mounting site (hub filter dropdowns)

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`datasource-creator`** skill — invoked when the selector needs a new backing datasource (any selector that doesn't already have a `-datasource.json` to wrap). Reminder: the backing must be a `-datasource.json`, never a `-footprintDatasource.json`
- **`schema-explorer`** skill — invoked **before** authoring an OData-backed selector to confirm the entity, the display-label field, and any filter fields exist in the Footprint schema
- **`form-creator`** / **`hub-creator`** skills — invoked when the selector's host (form field or hub filter dropdown) needs its `configParameters` contract set up to mount the selector
- **`component-wiring-check`** skill — invoked to audit `configParameters` ↔ target `inParams` contracts on both the selector's host (outer) and the selector's backing datasource (inner) before push, especially the `full_text_search` wiring
- **`type-definition-creator`** skill — invoked when the selector's option entity shape needs a new or extended interface (rare; most selectors mirror an existing datasource's `outParams`)

## CLI Lifecycle

Selector authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs selector` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The type identifier in the CLI is **`selector`** (lowercase, matches `ConfigurationEndpoints.normalize_type` output), mapping to `configurationTypeId: 7`.

**Create a new selector:**

```bash
# 1. Build body.json from scratch (see references/selectors.md → Datasource-Backed Selector)
# 2. Validate (recommended)
dxs configuration validate selector -b <branchId> -D body.json
# 3. Create
dxs configuration upsert selector -b <branchId> -D body.json
```

**Edit an existing selector:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get selector <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard — see "Round-trip rule" below)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate (recommended)
dxs configuration validate selector -b <branchId> -D body.json
# 5. Push
dxs configuration upsert selector -b <branchId> -D body.json
```

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. The corrected sequence above (extract inner `.json` with `jq` before editing) is mandatory for any round-trip. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

Selectors are leaner than grids or forms — the body is mostly `datasourceConfig` (with `configId`, `moduleId`, `datasourceKeyDef`, `configParameters`, `configOutParameters`), a `text` display-label expression, a string `top`, and the component-identity envelope. The full-text-search wiring spans the selector and its backing datasource — round-trip discipline (fetch → jq-extract → edit → validate → push) applies to both.

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
[Phase 2: Decide selector shape + backing source]
Consult references/selectors.md:
  - datasource-backed dropdown (most common) — wraps an existing or new
    `-datasource.json` (flow-type or OData-type query inside)
  - autocomplete — same shape; the dropdown's built-in full-text search
    box plus the three-piece contract makes it an autocomplete
  - enum dropdown — flow-type backing iterating $types.<Package>.<enum>
    with formatKey helpers, getList/getByKeys parity required
Backing-datasource source:
  - existing `-datasource.json` -> wrap it; verify keyDef/outParams; flow-type
    backing must be the keyed-collection shape (getListFlow + getByKeysFlow
    populated, non-empty keyDef) — getList-only cannot resolve selected labels
  - existing `-footprintDatasource.json` (FPDS) -> NOT ALLOWED as backing;
    wrap the FPDS in a flow-type `-datasource.json` that calls through,
    or invoke `datasource-creator` for a fresh one
  - no datasource yet -> invoke `datasource-creator`; for OData-backed
    options invoke `schema-explorer` first to confirm the entity
        |
[Phase 3: Author selector body]
Build body.json:
  - File shape (configurationTypeId=7, *-selector.json suffix,
    referenceName typically ends _dd, snake_case matches filename stem)
  - Hard component-variant rule — datasourceConfig.configId points to a
    `-datasource.json` (configurationTypeId=6), NEVER a
    `-footprintDatasource.json` (configurationTypeId=19); query type
    inside the backing is unconstrained (flows or oDataQuery)
  - Key wiring — datasourceKeyDef mirrors the datasource's keyDef;
    configId + moduleId resolve to the backing; moduleId is the
    DATASOURCE's package, not the selector's caller
  - configOutParameters mirrors the datasource's outParams shape with
    full property-descriptor boilerplate on every objectTypeDef entry
  - text — display-label expression on $option.entity.<DisplayField>
  - top — STRING ("25"), not a number
  - Sort by display label — when authoring the backing datasource for
    this selector, sort by the field referenced in text (OData orderBys
    or in-code sort for flow-type)
  - Full-text-search three-piece contract (when backing exists solely
    for this selector): (1) backing declares full_text_search inParam
    (string, required: false); (2) backing applies conditional
    contains-filter on the display-label field gated on
    $utils.isDefined; (3) selector wires $selector.fullTextSearch into
    the datasource's full_text_search via configParameters
  - getList ↔ getByKeys parity — if getListFlow applies a Key transform
    (formatKey, etc.), getByKeysFlow MUST apply the identical transform
    (duplicate the helper definitions inside both code bodies — flows
    don't share scope)
  - No $types.<Package>.e_<enum> in vars/inParams/outParams — primitives
    only at the param layer; cast at usage in flow code
  - Sibling *Config keys explicitly null
  - Invoke `schema-explorer` for OData entity / display-label / filter
    field validation before authoring OData-backed selectors
  - Invoke `component-wiring-check` to audit BOTH the outer host
    contract (form field / hub filter / grid filter cell) AND the inner
    selector → datasource contract (every declared backing inParam,
    including full_text_search, needs an explicit configParameters
    entry)
        |
[Phase 4: Validate + push]
dxs configuration validate selector -b <branchId> -D body.json
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
dxs configuration upsert selector -b <branchId> -D body.json
   (upsert creates or updates by referenceName — one command for both)
        |
[Phase 5: Verify in Studio (optional)]
Open the selector through its normal mount (form field / hub filter);
confirm option population, alphabetized order by display label,
full-text-search filtering live as you type, saved-selection re-hydration
shows the same display label getList showed (getByKeys parity)
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 1: Setup + Requirements

1. Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for branch and connection selection. **Never assume a branch ID** — ask the user to confirm, or run `dxs source branch list --all-repos --status feature` for selection.
2. Check whether a **requirements brief** already exists in the conversation context (produced by `requirements-gathering` or another calling skill).
   - **Brief exists** — use it. The brief should establish what the dropdown represents (an entity, an enum, a computed list), the display label users see, the underlying Key/Value the saved selection persists, where the selector mounts (form field / hub filter / grid filter cell), and whether autocomplete behavior is required.
   - **No brief** — invoke the `requirements-gathering` skill first. Getting the display label, the saved Key, and the mount site right up front avoids re-authoring `text`, `datasourceKeyDef`, and the host's `configParameters`.

### Phase 2: Decide selector shape + backing source

Consult [references/selectors.md](references/selectors.md) before authoring. Two decisions feed in.

**Selector shape.** Three common shapes:

- **Datasource-backed dropdown** — the canonical shape. Wraps an existing or new `-datasource.json` and renders its `outParams` as options. Display label via `text: "$option.entity.<DisplayField>"`.
- **Autocomplete** — same shape as the datasource-backed dropdown; what makes it an autocomplete is the dropdown's built-in full-text search box plus the three-piece contract (see [references/selectors.md → Full-Text Search Wiring](references/selectors.md#full-text-search-wiring--selector-backing-datasources)) so typed characters filter the option set live.
- **Enum dropdown** — a flow-type backing datasource iterates `$types.<Package>.<enum>` and emits `{ Key, Value }` rows; `formatKey` / `capitalize` helpers shape the display label. Requires getList ↔ getByKeys parity (see [references/selectors.md → getList ↔ getByKeys Key Transformation Parity](references/selectors.md#getlist--getbykeys-key-transformation-parity)).

**Backing source.** Where does the option set come from?

- **Existing `-datasource.json`** — wrap it. Verify `keyDef` and `outParams` shape; the selector's `datasourceKeyDef` and `configOutParameters` must mirror them. The branch's server-side usage gate blocks publish if the backing datasource doesn't implement `getList` and `getByKeys` — the same keyed-collection shape this section requires.
- **Existing `-footprintDatasource.json` (FPDS)** — **not allowed as the selector's backing**. Hard platform rule. Wrap the FPDS in a flow-type `-datasource.json` that calls through, or invoke `datasource-creator` for a fresh datasource that returns the same shape.
- **No datasource yet** — invoke `datasource-creator`. For an OData-backed datasource, invoke `schema-explorer` first to confirm the entity, the display-label field, and any filter fields exist in the Footprint schema.

### Phase 3: Author selector body

Build `body.json` from the skeleton in [references/selectors.md → Datasource-Backed Selector](references/selectors.md#datasource-backed-selector). Key points:

1. **File basics.** Per the **Pre-Flight Checklist** below + [../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md); see [references/selectors.md → Datasource-Backed Selector](references/selectors.md#datasource-backed-selector) for the `-selector.json` file shape. The `_dd` dropdown indicator on `referenceName` is the selector-specific naming cue.

2. **The component-variant hard rule.** `datasourceConfig.configId` + `moduleId` must resolve to a `-datasource.json` (`configurationTypeId: 6`), **never** a `-footprintDatasource.json` (FPDS, `configurationTypeId: 19`). This is a hard platform rule with no exceptions. The **query type** inside the backing is unconstrained — flow-type (`type: "flows"`, used for enum dropdowns and computed lists) or OData-type (`type: "oDataQuery"`, used when options come from a database entity). Put plainly: selectors care about the **component variant**, not the **query type**. If an FPDS already exposes the data you need, wrap it in a flow-type `-datasource.json` that calls through — don't point the selector at the FPDS directly. See [references/selectors.md → Backing Datasource Variant — Hard Rule](references/selectors.md#backing-datasource-variant--hard-rule).

3. **Key wiring.** `datasourceConfig.configId` + `moduleId` identify the backing datasource; `moduleId` is the **datasource's** package, not the selector's caller. `datasourceConfig.datasourceKeyDef` mirrors the datasource's `keyDef` (same id, same type) — drift here breaks saved-selection re-hydration through `getByKeys`. `datasourceConfig.configParameters` wires selector inputs (e.g. `$selector.fullTextSearch`) into datasource inParams. `datasourceConfig.configOutParameters` mirrors the datasource's `outParams` shape — use the same `objectTypeDef` entries with full parameter-descriptor boilerplate. See [references/selectors.md → Key Points](references/selectors.md#key-points).

4. **`text` is the display-label expression.** Typically `"$option.entity.<DisplayField>"` (e.g. `"$option.entity.Name"`, `"$option.entity.Key"`). It runs once per option as the dropdown renders the list. For enum dropdowns whose backing emits `{ Key, Value }` rows shaped by `formatKey`, the canonical display is `"$option.entity.Key"`.

5. **`top` is a string, not a number.** `"25"` controls how many items the dropdown shows. JSON-numeric `25` fails import — the platform's parameter slot expects the TS-expression string literal.

6. **Sort by display label.** When you're authoring the backing datasource **specifically** for this selector, sort results by the field referenced in `text`. For OData-type backings, add an `orderBys` entry on the field; for flow-type backings, sort the array in code before returning. A `task_status_dd` selector displaying `Name` should have its datasource order by `Name` ascending — the user sees alphabetized options immediately, not insertion-order or whatever the database returned. See [references/selectors.md → Key Points](references/selectors.md#key-points).

7. **Full-text-search three-piece contract.** Applies when the backing datasource exists **specifically to back this selector**. Standalone datasources used by other flows/actions are not subject. Three coupled requirements — missing any one makes the dropdown's built-in search feel broken:
   1. **Backing datasource declares `full_text_search` as an inParam** — exactly that id, `type: "string"`, `required: false`.
   2. **Backing datasource applies a conditional contains-filter on the display-label field** (the field referenced by `text`), gated on `$utils.isDefined($datasource.inParams.full_text_search)` so empty input disables the filter. OData-type: the canonical `contains(<LabelField>, ${$utils.odata.formatString(...)})` shape with `hasCondition: true` and the condition expression. Flow-type: guard inside `getListFlow` code with `if ($utils.isDefined($flow.inParams.full_text_search)) { rows = rows.filter(r => r.<LabelField>.toLowerCase().includes((... as string).toLowerCase())); }`.
   3. **Selector wires `$selector.fullTextSearch` into the datasource's `full_text_search` input** via a `datasourceConfig.configParameters` entry whose `value` is `"$selector.fullTextSearch"`.
   
   Combined with `top: "25"` and "sort by display label", this is the baseline autocomplete behavior. Skipping pieces makes the dropdown feel unresponsive as users type. See [references/selectors.md → Full-Text Search Wiring](references/selectors.md#full-text-search-wiring--selector-backing-datasources).

8. **`getListFlow` ↔ `getByKeysFlow` Key transformation parity.** The platform calls `getListFlow` to populate the dropdown when the user opens it, and `getByKeysFlow` to re-hydrate the displayable record for a previously-saved Value. If `getListFlow` applies a Key transformation (e.g. `formatKey` turning `ParentOfTarget` → `Parent of target`, or any other label massaging), `getByKeysFlow` **must apply the identical transformation** — otherwise the saved selection round-trips through `getByKeys`, returns the raw enum id, and the dropdown control shows `ParentOfTarget` while editing and `Parent of target` after reload. The `formatKey` / `capitalize` helper functions live as nested function declarations inside each flow's `code` body — duplicate the same definitions in both flows; the platform compiles each flow independently and they don't share scope. OData-type backings rarely hit this (their `getByKeys` is auto-generated from `keyDef` and selects raw columns), but if the OData query options include computed columns or column-aliasing, the projection used at list-time must match the projection used at key-lookup time. See [references/selectors.md → getList ↔ getByKeys Key Transformation Parity](references/selectors.md#getlist--getbykeys-key-transformation-parity).

9. **No custom-enum FQNs in `vars` / `inParams` / `outParams`.** Selectors can't resolve `$types.<Package>.e_<enum>` in param declarations — declare those fields as primitive (`string` for string-valued enums, `number` for numeric) and cast at usage inside flow code. This bites enum-backed selectors most because the backing's `outParams.result.objectTypeDef[Value]` is the place authors most want to type as the enum.

10. **Sibling `*Config` keys are explicitly null.** `customOptionsConfig`, `actionConfig`, `onInitFlowConfig`, and all the other inactive sub-configs stay explicitly `null` on a standard datasource-backed selector. Match this convention for structural diffing — existing selector components keep all sibling slots present and null.

11. **Calling-tier compliance.** Selector code (`onInitFlowConfig`, any `flows[]` entries) calls **functions** via `$flows.<Package>.<fn>`; the function wraps any CRUD action call as `$apis.<Package>.FootprintApi.extendedActions.<action_name>({...})`. No direct action calls from selector code. See [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md).

12. **Host contract audit.** Every host that mounts this selector (form field, hub filter dropdown, grid filter cell) declares a full `configParameters` contract — every `inParam` the selector declares gets an entry on the host, including unused ones with `value: null`. Invoke `component-wiring-check` to audit reference contracts on both sides — the outer host → selector contract AND the inner selector → backing-datasource contract (every backing inParam the selector reads, including `full_text_search`, needs an explicit `configParameters` entry on the selector with no auto-wiring). See [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md).

### Phase 4: Validate + push

```bash
# Validate the body locally against the branch
dxs configuration validate selector -b <branchId> -D body.json

# For a new selector
dxs configuration upsert selector -b <branchId> -D body.json

# For modify-existing (round-trip — never skip the jq extract)
dxs configuration get selector <configId> -b <branchId> -O envelope.json
jq .json envelope.json > body.json
# ... edit body.json ...
dxs configuration upsert selector -b <branchId> -D body.json
```

Validation surfaces missing required fields, malformed parameter-descriptor shapes, undefined flow-id references, and reference errors before push. It does **not** catch the component-variant rule (a selector pointed at a `-footprintDatasource.json` will pass schema validation and fail at upload time or runtime), the unsorted-options bug, the half-wired full-text-search contract, or getList ↔ getByKeys Key transformation drift — those are behavioral and only surface at upload-time validation or runtime in the dropdown. Walk the pre-flight checklist embedded below before push.

### Phase 5: Verify in Studio (optional)

Open the selector through its normal mount (a form field, a hub filter dropdown, a grid filter cell) and confirm:

- Options populate from the backing datasource — not empty, not raw enum ids when `formatKey` should have run, not duplicated.
- Options arrive alphabetized by the display-label field (the field referenced by `text`), confirming the backing's `orderBys` / in-code sort landed.
- Typing into the search box filters the option set live — confirming all three pieces of the full-text-search contract are wired (datasource declares the inParam, applies the conditional filter, selector wires `$selector.fullTextSearch` through `configParameters`).
- Save a selection, close the form/dialog, reopen — the saved Value re-hydrates and renders with the **same** display label `getListFlow` would have shown (confirming `getByKeysFlow` Key parity).
- The mount's `moduleId` resolves the selector — no `Referenced configuration <name> does not exist` errors in the import log.

If the running app isn't available, re-fetch the config (using the corrected `jq .json` extract pattern) and diff against `body.json` to confirm the push landed.

## Pre-Flight Checklist

Before push, walk this pre-flight checklist. The fast version:

1. **Component variant.** Backing is a `-datasource.json` (`configurationTypeId: 6`), **not** a `-footprintDatasource.json` (`configurationTypeId: 19`). Query type inside can be either flows or oDataQuery.
2. **File basics.** Suffix `-selector.json`; `configurationTypeId: 7`; `referenceName` typically ends `_dd` — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
3. **Datasource wiring contract.** `configId` + `moduleId` resolve to a real datasource (`moduleId` = datasource's package). `datasourceKeyDef` mirrors the datasource's `keyDef`. `configOutParameters` mirrors `outParams` with full param-descriptor boilerplate.
4. **Display expression.** `text` references a real field on `$option.entity.<field>`.
5. **`top` is a string** (`"25"`), not a number.
6. **Datasource sorts by the display-label field** (OData `orderBys` or flow-code sort) — alphabetized options out of the box.
7. **Full-text-search fully wired when the backing datasource exists solely for this selector.** Three pieces: backing declares `full_text_search` inParam (string, `required: false`); backing applies a conditional contains-filter on the display-label field gated on `$utils.isDefined`; selector wires `$selector.fullTextSearch` into the backing's `full_text_search` via `configParameters`.
8. **`getListFlow` ↔ `getByKeysFlow` Key transformation parity.** If `getListFlow` applies a Key transform (`formatKey`, etc.), `getByKeysFlow` applies the identical transform. Helper functions (`formatKey`, `capitalize`) duplicated inside both `code` bodies — flows compile independently.
9. **No `$types.<Package>.e_<enum>`** in `vars` / `inParams` / `outParams` — primitives only at the param layer; cast at usage inside flow code.
10. **Sibling `*Config` keys explicitly null** — `customOptionsConfig`, `actionConfig`, `onInitFlowConfig`, etc., stay `null` on a standard datasource-backed selector.
11. **Calling-tier compliance** — selector code calls functions via `$flows.<Package>.<fn>`; functions wrap CRUD actions via `$apis.<Package>.FootprintApi.extendedActions.<action_name>({...})`; no direct action calls from the selector.
12. **Host carries a full `configParameters` contract** — every inParam the selector declares has an entry on the host (form field / hub filter / grid filter cell); unused ones use `value: null`. Audit via `component-wiring-check`.
13. **Inner datasource contract.** The selector's own `datasourceConfig.configParameters` covers every inParam declared on the backing datasource — **including `full_text_search`** (no auto-wiring; needs an explicit entry with `value: "$selector.fullTextSearch"`).

## Common Mistakes

| Mistake | Fix |
|---|---|
| Selector pointed at a `-footprintDatasource.json` (FPDS, `configurationTypeId: 19`) | Hard platform rule: backing must be a `-datasource.json` (`configurationTypeId: 6`). If an FPDS has the data, wrap it in a flow-type `-datasource.json` that calls through; don't point the selector at the FPDS. |
| Confusing component variant with query type — assuming "OData dropdown means FPDS backing" | Selectors care about the **component variant**, not the **query type**. OData-backed dropdowns are perfectly fine — but the OData query lives inside a `-datasource.json` (`type: "oDataQuery"`), not an FPDS. |
| `top: 25` (JSON number) instead of `top: "25"` (TS-expression string) | The slot expects a string literal. Numeric `25` fails import. Always quote. |
| `text: "$option.entity.<field>"` where `<field>` doesn't exist on the datasource's `outParams` | `text` runs against `$option.entity` — the option row shape comes from the datasource's `outParams[result].objectTypeDef`. Pick a field that's actually present; or add the field to the datasource. |
| Backing datasource returns options in insertion order; users complain dropdown is "random" | Add `orderBys` (OData) or sort in code (flow-type) on the display-label field. Users expect alphabetized options. |
| `fullTextSearch` mounts but typed characters don't filter the option set | Three-piece contract is half-wired. Confirm: (1) backing declares `full_text_search` inParam; (2) backing applies the conditional filter on the display-label field; (3) selector's `datasourceConfig.configParameters` has the `full_text_search` entry with `value: "$selector.fullTextSearch"`. No auto-wiring on any piece. |
| `getListFlow` uses `formatKey(key)` for the Key projection but `getByKeysFlow` returns the raw camelCase enum id | Saved selection round-trips and renders raw while the dropdown options show the formatted version. Duplicate the identical `formatKey` expression (and helper function definitions) inside `getByKeysFlow.code` — flows compile independently and don't share scope. |
| `$types.<Package>.e_<enum>` referenced in the selector's `vars` / `inParams` / `outParams` | UI components can't resolve custom-enum FQNs at the param layer. Declare as primitive (`string` for string-valued enums, `number` for numeric) and cast at usage inside flow code. |
| `datasourceKeyDef` diverges from the backing's `keyDef` (different id or different type) | Saved-selection re-hydration through `getByKeysFlow` fails or returns the wrong record. The two `keyDef`s must mirror exactly. |
| `configOutParameters` strips the descriptor boilerplate down to just `{id, type}` | The platform expects the full property-descriptor shape (`required`, `description`, `oneOf`, `fromBaseConfiguration`, `objectTypeDef`, `objectType`, `isCollection`, `isSecured`, `isConstant`, `constantValue`) on every entry. Use the same shape the backing's `outParams` carries. |
| `moduleId` on the selector's `datasourceConfig` set to the selector's package instead of the datasource's | Cross-component reference rule — `moduleId` is always the **target's** package. The datasource lives where it's registered. See `../component-wiring-check/references/component-wiring.md`. |
| Selector's own `vars` / `inParams` / `outParams` fields written in flow code without top-level declaration | Import error: `Property 'vars' does not exist on type 'ISelector'`. Declare every var / inParam / outParam in the corresponding top-level array with the standard property-descriptor shape. |
| Sibling `*Config` slot dropped (e.g. only `datasourceConfig` populated, `customOptionsConfig` / `actionConfig` / `onInitFlowConfig` missing entirely) | Existing selectors keep all sibling slots present and `null` for structural diffing. Match the convention. |
| Selector code calls an action directly | UI-tier rule: selector calls functions only. The function wraps the action via `$apis.<Package>.FootprintApi.extendedActions.<action_name>({...})`. |
| Piping `dxs configuration get -O envelope.json` directly into `dxs configuration upsert -D envelope.json` | Silently destroys config content. Always `jq .json envelope.json > body.json` before editing. See "Round-trip rule" above. |
| `description` exceeds 100 chars | SQL column limit — push will fail validation. Tighten. |
| `referenceName` doesn't end in `_dd` (when the selector is a dropdown indicator) or doesn't match filename stem | Convention drift breaks lookups and downstream callers expecting the `_dd` suffix. Snake_case, `_dd` suffix where applicable, filename stem matches. |

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
