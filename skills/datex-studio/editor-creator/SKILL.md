---
name: editor-creator
description: |
  Use when authoring or modifying a Datex Studio editor (configurationTypeId=4,
  *-editor.json suffix) on a branch — single-entity view/edit screen with
  embedded single-result datasource, onInit/onDataLoaded lifecycle, view/edit
  mode toggle, and save-button gating via onFormValidateFlowConfig. Triggers:
  "create an editor", "build a detail screen for X entity", "view/edit a
  single record", "add a field to xxx_editor", "add save/cancel buttons",
  "$editor.entity is undefined in onInit", "save button never enables".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - form-creator
  - grid-creator
  - datasource-creator
  - component-wiring-check
  - tailoring-overlay
  - type-definition-creator
  - requirements-gathering
  - post-edit-verification
  - component-validator
---

# Editor Creator

Author or modify a Datex Studio editor (configurationTypeId=4) on a branch — a single-entity view/edit screen that hydrates one record, binds fields 1:1 to its properties, toggles between read-only and edit mode, and persists changes through a wrapping function that calls a CRUD action.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/editors.md](references/editors.md) — Authoritative editor authoring reference: file shape, runtime globals, invocation contract, common patterns, pre-flight checklist
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and TypeScript-expression encoding rules
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_editor` suffix, filename stem matching, display-name rule
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — platform-injected globals available in editor code (`$editor`, `$flows`, `$shell`, `$utils`, ...)
- [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules (call functions, never actions; CRUD via `$apis.<Package>.FootprintApi.extendedActions.<action_name>`)
- [../form-creator/references/forms.md](../form-creator/references/forms.md) — sibling component for transient input collection (the editor-vs-form decision)
- [../grid-creator/references/grids.md](../grid-creator/references/grids.md) — typical host for editors via row-click / row-action flows
- [../datasource-creator/references/flow-datasources.md](../datasource-creator/references/flow-datasources.md) — single-result shape required for editor-backing datasources
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — host reference contracts, vars-must-be-declared rule, moduleId rule

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`form-creator`** / **`grid-creator`** skills — invoked when the requirement is actually transient input collection (form) or a multi-record list (grid), not a single-entity detail screen
- **`datasource-creator`** skill — invoked when the single-result flow datasource backing the editor needs to be authored as a standalone config (rare — the embedded private datasource is the usual shape)
- **`component-wiring-check`** skill — invoked to audit `configParameters` ↔ target `inParams` contracts on the editor's host (hub tab / grid row action / form) before push
- **`type-definition-creator`** skill — invoked when the editor's bound entity interface or a related type definition needs authoring or extension (e.g. adding a field to the schema that the editor must mirror with a new binding)
- **`tailoring-overlay`** skill — invoked when customer-specific extensions to the editor (added fields, modified bindings) need to live in a tailored overlay rather than the base config

## CLI Lifecycle

Editor authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs editor` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The type identifier in the CLI is **`editor`** (lowercase, matches `ConfigurationEndpoints.normalize_type` output), mapping to `configurationTypeId: 4`.

**Create a new editor:**

```bash
# 1. Build body.json from scratch (see references/editors.md → Minimal Valid Skeleton)
# 2. Validate (recommended)
dxs configuration validate editor -b <branchId> -D body.json
# 3. Create
dxs configuration upsert editor -b <branchId> -D body.json
```

**Edit an existing editor:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get editor <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard — see "Round-trip rule" below)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate (recommended)
dxs configuration validate editor -b <branchId> -D body.json
# 5. Push
dxs configuration upsert editor -b <branchId> -D body.json
```

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. The corrected sequence above (extract inner `.json` with `jq` before editing) is mandatory for any round-trip. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

Editors are dense — the body carries `toolbar`, `fieldsets`, `flows`, `datasourceConfig`, and `datasources` substantially populated, with a `code` field on every embedded flow. Surgical edits in this much JSON are error-prone; round-trip discipline (fetch → jq-extract → edit → validate → push) is non-negotiable.

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
[Phase 2: Editor vs Form vs Grid decision]
Consult references/editors.md → "Purpose & When to Use":
  - single hydrated entity, view/edit toggle, persist via CRUD -> editor
  - transient input collection, returns outParams, no entity -> form
  - multi-record tabular view -> grid
If form -> invoke `form-creator` instead and stop here.
If grid -> invoke `grid-creator` instead and stop here.
Create-only dialogs are usually forms, not editors.
        |
[Phase 3: Author editor body]
Build body.json:
  - File shape (configurationTypeId=4, *-editor.json suffix,
    referenceName ends _editor)
  - Embedded single-result private datasource in datasources[]
    (configurationTypeId=6, type=flows, accessModifier=private,
    getFlow populated; getListFlow/getByKeysFlow null;
    resultIsCollection=false; outParams[0].isCollection=false)
  - Flow shape: getFlow populated; getListFlow and getByKeysFlow null
    (editors call .get() — code left in getListFlow silently breaks hydration)
  - Entity shape mirrored: datasources[0].outParams[0].objectTypeDef
    == datasourceConfig.configOutParameters.result.objectTypeDef
  - onInitFlowConfig (pre-hydration; no $editor.entity reads)
    vs onDataLoadedFlowConfig (post-hydration; entity-derived defaults)
  - View/edit toggle via $editor.vars.edit_mode (declared in vars[])
  - Save branches on $editor.entity.isNew (crud_create vs crud_update)
  - onFormValidateFlowConfig gates $editor.toolbar.<save>.control.readOnly
  - EditorFields parity: every entity-interface field has a binding
    (stub with removed:true when UX isn't ready)
  - Invoke `datasource-creator` if a standalone datasource is missing
  - Invoke `component-wiring-check` to audit host's configParameters
        |
[Phase 4: Validate + push]
dxs configuration validate editor -b <branchId> -D body.json
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
dxs configuration upsert editor -b <branchId> -D body.json
   (upsert creates or updates by referenceName — one command for both)
        |
[Phase 5: Verify in Studio (optional)]
Open the editor as a dialog (from its host hub/grid); confirm
hydration, toggle into edit mode, save commits, cancel restores
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 1: Setup + Requirements

1. Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for branch and connection selection. **Never assume a branch ID** — ask the user to confirm, or run `dxs source branch list --all-repos --status feature` for selection.
2. Check whether a **requirements brief** already exists in the conversation context (produced by `requirements-gathering` or another calling skill).
   - **Brief exists** — use it. The brief should establish the entity being edited (and which key the host passes in), which fields are visible/editable, view-only-vs-edit-mode behavior, save semantics (which CRUD action persists changes), and whether the same editor handles create mode.
   - **No brief** — invoke the `requirements-gathering` skill first. Getting the entity shape and save semantics right up front avoids the dense round-trip that follows.

### Phase 2: Editor vs Form vs Grid decision

Consult [references/editors.md → Purpose & When to Use](references/editors.md#purpose--when-to-use) before authoring. The choice is not stylistic — editors, forms, and grids serve different roles and aren't interchangeable.

Pick an **editor** when:

- The user views or modifies a **single entity** identified by a key.
- Field-level inputs map 1:1 to properties of that entity.
- The UX wants a distinct view-mode (read-only) and edit-mode (inputs unlocked, save active) toggle.
- The flow persists changes through a CRUD action (`crud_create_entity` / `crud_update_entity`).

Pick a **form** instead when:

- The work is transient input collection that doesn't correspond to a stored record.
- The dialog returns `outParams` to the caller; nothing persists implicitly.
- The dialog is creation-only and no entity yet exists to hydrate.

Pick a **grid** instead when:

- The user views or operates on **multiple records** in a tabular layout.

If the answer is form, stop and invoke `form-creator`. If the answer is grid, stop and invoke `grid-creator`. Editors can handle create mode via `$editor.entity.isNew`, but that path is justified only when **the same component handles both create and edit for the same entity type** — pure create dialogs are usually a better fit for a form.

### Phase 3: Author editor body

Build `body.json` from the skeleton in [references/editors.md → Minimal Valid Skeleton](references/editors.md#minimal-valid-skeleton). Key points:

1. **File basics.** Per the **Pre-Flight Checklist** below + [../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md); see [references/editors.md → File Location & Naming](references/editors.md#file-location--naming) for the `-editor.json` file shape.

2. **Embedded single-result datasource.** Each editor embeds **exactly one** private, single-result flow datasource in `datasources[]`. Required shape: `configurationTypeId: 6`, `type: "flows"`, `accessModifier: "private"`, `getFlow` populated, `getListFlow: null`, `getByKeysFlow: null`, `resultIsCollection: false`, `outParams[0].isCollection: false`. A collection-returning datasource breaks the editor reference — `datasourceConfig.get({...})` can't hydrate `$editor.entity` from a list. See [references/editors.md → Embedded Private Datasource](references/editors.md#embedded-private-datasource-keyed-by-the-entity-id) and [../datasource-creator/references/flow-datasources.md → Single-Result Shape](../datasource-creator/references/flow-datasources.md#single-result-shape--getflow). If the editor needs to share a datasource with other components (rare), invoke `datasource-creator` to author a standalone version. The branch's server-side usage gate independently enforces this at contract-validation time — it blocks publish if the editor's datasource doesn't implement `get` on a single, non-collection result.

3. **Entity shape mirror.** `datasources[0].outParams[0].objectTypeDef` (the datasource side) must mirror `datasourceConfig.configOutParameters.result.objectTypeDef` (the editor's consumer side) field-for-field. Any entity-shape change touches **both places** in the same edit. The `datasourceKeyDef` on `datasourceConfig` matches the embedded datasource's `keyDef` exactly and matches the `inParams` shape the host passes.

4. **`onInitFlowConfig` vs `onDataLoadedFlowConfig`.** The single most common editor bug is flipping these. `onInit` fires **before** the datasource resolves — `$editor.entity` is **not yet populated**; reading it yields undefined. Use `onInit` for var setup, defaulting `edit_mode` on `isNew`, or logic independent of entity data. `onDataLoaded` fires **after** the entity hydrates — use it for entity-derived defaults, stashing pre-edit snapshots, and populating UI-only state from entity fields. See [references/editors.md → onInitFlowConfig vs onDataLoadedFlowConfig](references/editors.md#oninitflowconfig-vs-ondataloadedflowconfig).

5. **View/edit mode toggle.** Declare `edit_mode` in top-level `vars[]` (every `$editor.vars.<id>` written in flow code must be declared — see [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md)). Edit button visible when `!edit_mode`; Save + Cancel visible when `edit_mode`. Field `readOnly` bound to `!edit_mode` (or computed per-field when some stay locked). Cancel restores original entity values — re-call the datasource or stash pre-edit values in `$editor.vars` during `onDataLoaded`.

6. **Save branches on `$editor.entity.isNew`.** When new → `crud_create_entity` (or the equivalent create action wrapped in a function); when existing → `crud_update_entity`. Neither branch hardcoded. The UI-tier calling rule applies: editor code calls **functions** via `$flows.<Package>.<fn>`; the function wraps the CRUD action call as `$apis.<Package>.FootprintApi.extendedActions.<action_name>({...})`. See [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md).

7. **Save button gated by validation.** `onFormValidateFlowConfig` runs whenever any field changes. Compute `is_valid` from field values (often via `$utils.isDefinedTrimmed` for required strings), then set `$editor.toolbar.<save_button>.control.readOnly = !is_valid`. Optionally push per-field messages to `control.validationMessage`. See [references/editors.md → Save Button Gated by onFormValidateFlowConfig](references/editors.md#save-button-gated-by-onformvalidateflowconfig).

8. **EditorFields parity.** The platform auto-generates an `EditorFields` TypeScript type from the bound entity's interface. The editor must declare a `controlConfig`-bearing binding for **every** field on that interface — nested paths flatten with `__` (e.g. `replenishments.rules` → field id `replenishments__rules`). Missing a binding fails import. When the schema gains a field, the editor adds the binding in the same edit; a stub binding with `removed: true` is acceptable if real UX isn't ready. For array-of-object sub-trees, use the button + `$editor.vars.<var>` + `set_config`-merge pattern. See [references/editors.md → EditorFields Requires a Binding for Every Schema Field](references/editors.md#editorfields-requires-a-binding-for-every-schema-field) and the serialized-config-JSON section for the wrapper-entity case.

9. **TypeScript-expression encoding on every declarative-string slot.** Every `tooltip`, `placeholder`, `value`, `format`, button `label` (when bound to a var) is inlined verbatim into generated TS. Wrap display text in backticks (`` "`Manage rules…`" ``), wrap plain-string literals in TS quotes (`"'MM/DD/YYYY'"`), leave raw expressions unwrapped (`"$editor.vars.foo"`). An unwrapped tooltip like `"Manage rules."` compiles to bare TS tokens and breaks the build. See [../datex-studio-conventions/file-format.md → Declarative String Values Are TypeScript Expressions](../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions).

10. **No custom-enum FQNs in `vars` / `inParams` / `outParams`.** Editors can't resolve `$types.<Package>.e_<enum>` in param declarations — declare those fields as primitive (`string` for string-valued enums, `number` for numeric) and cast at usage inside flow code.

11. **`onCustomization*` slots stay `null`** unless customization hooks are explicitly needed — they're platform-extension points for tailored overlays (`tailoring-overlay`), not everyday editor wiring.

12. **Host contract audit.** The hub tab, grid row action, or form that opens this editor as a dialog must declare a full `configParameters` contract — every `inParam` the editor declares gets an entry on the host, including unused ones with `value: null`. Invoke `component-wiring-check` to audit reference contracts before push. See [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md).

### Phase 4: Validate + push

```bash
# Validate the body locally against the branch
dxs configuration validate editor -b <branchId> -D body.json

# For a new editor
dxs configuration upsert editor -b <branchId> -D body.json

# For modify-existing (round-trip — never skip the jq extract)
dxs configuration get editor <configId> -b <branchId> -O envelope.json
jq .json envelope.json > body.json
# ... edit body.json ...
dxs configuration upsert editor -b <branchId> -D body.json
```

Validation surfaces missing required fields, malformed parameter-descriptor shapes, `EditorFields` parity violations, and reference errors before push. It does **not** catch the `onInit`-vs-`onDataLoaded` flip, undeclared `$editor.vars.<id>` writes, or unwrapped TypeScript-expression slots — those are behavioral and only surface at runtime. Walk the [references/editors.md → Pre-Flight Checklist](references/editors.md#pre-flight-checklist) before push.

### Phase 5: Verify in Studio (optional)

Open the editor as a dialog through its normal invocation path (a hub tab toolbar button, a grid row action, or a form that chains into it):

- Hydration succeeds — `$editor.entity` is populated when `onDataLoaded` runs; fields display the loaded values.
- Edit-mode toggle works — Edit button flips `edit_mode = true`; Save + Cancel appear; fields become editable.
- Save commits — branches correctly on `$editor.entity.isNew`; the wrapping CRUD action succeeds; the dialog closes or flips back to read-only.
- Cancel restores original values — pre-edit snapshot survives (or the datasource re-fetches cleanly).
- For create mode (`isNew: true`), the embedded datasource synthesizes a blank entity; the save path takes the create branch.
- Save button stays disabled until `onFormValidateFlowConfig` reports `is_valid`.

If the running app isn't available, re-fetch the config (using the corrected `jq .json` extract pattern) and diff against `body.json` to confirm the push landed.

## Pre-Flight Checklist

Before push, walk the full checklist in [references/editors.md → Pre-Flight Checklist](references/editors.md#pre-flight-checklist). The fast version:

1. **File basics.** `configurationTypeId: 4`, suffix `-editor.json`, `referenceName` ends `_editor` — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
2. **Exactly one embedded datasource** — `accessModifier: "private"`, `type: "flows"`, single-result shape (`getFlow` populated; `getListFlow` + `getByKeysFlow` null; `resultIsCollection: false`; `outParams[0].isCollection: false`).
3. **Entity shape mirrored** — `datasourceConfig.configOutParameters.result.objectTypeDef` field-for-field matches `datasources[0].outParams[0].objectTypeDef`. `datasourceKeyDef` matches the embedded datasource's `keyDef` and the host's `inParams` shape.
4. **Init-hook split correct** — `onInitFlowConfig` does not read `$editor.entity`; entity-dependent defaults and pre-edit snapshots live in `onDataLoadedFlowConfig`.
5. **Save branches on `$editor.entity.isNew`** — `crud_create_entity` when new, `crud_update_entity` when existing. Neither branch hardcoded.
6. **`onFormValidateFlowConfig` gates `$editor.toolbar.<save>.control.readOnly`** on field validity.
7. **`$editor.vars` declared** — every var written in flow code (`edit_mode`, snapshots, in-progress arrays) is in top-level `vars[]`.
8. **EditorFields parity** — every entity-interface field has a binding (stub `removed: true` if UX isn't ready). Array-of-object sub-trees use the button + `$editor.vars` + `set_config`-merge pattern.
9. **Calling-tier compliance** — editor code calls functions via `$flows.<Package>.<fn>`; the function wraps CRUD actions via `$apis.<Package>.FootprintApi.extendedActions.<action_name>({...})`; no direct action calls from the editor.
10. **TypeScript-expression strings wrapped correctly** — display text in backticks; raw expressions unwrapped; plain literals quoted.
11. **`onCustomization*` slots `null`** unless customization is intentional.
12. **No `$types.<Package>.e_<enum>`** in `vars` / `inParams` / `outParams` — primitives only at the param layer; cast at usage.
13. **Host carries a full `configParameters` contract** — every inParam the editor declares has an entry; unused ones use `value: null`. Audit via `component-wiring-check`.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Reading `$editor.entity` inside `onInitFlowConfig` | Entity isn't hydrated yet — yields undefined. Move entity-derived defaults and pre-edit snapshots to `onDataLoadedFlowConfig`. |
| Embedded datasource returns a collection (`resultIsCollection: true` or `outParams[0].isCollection: true`) | Editor can't hydrate `$editor.entity` from a list. Switch to single-result shape — `getFlow` populated, `getListFlow`/`getByKeysFlow` null. |
| `datasources[0].outParams[0].objectTypeDef` and `datasourceConfig.configOutParameters.result.objectTypeDef` drift apart | Editor reference breaks at runtime. They mirror each other — any entity-shape change touches both. |
| Save path hardcoded to `crud_update_entity` (or `crud_create_entity`) | Breaks the other mode. Branch on `$editor.entity.isNew`. |
| `$editor.vars.edit_mode = true` written in flow code without declaring `edit_mode` in top-level `vars[]` | Var is undeclared — write fails silently or runtime error. Declare every var. |
| Missing field binding for a new schema field | `EditorFields` type error: `Property 'foo__bar' is missing... but required in type 'EditorFields'`. Add the binding in the same edit; stub with `removed: true` if UX isn't ready. |
| Mutating `$editor.entity.<field>` directly when the entity is a serialized-config wrapper | Type error — `entity` exposes the wrapper, not the parsed config. Parse via `JSON.parse($editor.entity.config)` in `set_state`; reassemble in `set_config`; post `$editor.vars.new_config` via the CRUD action. |
| Array-of-object sub-tree authored as a flat field binding | `id__path` flattening doesn't fit arrays. Use the button + `$editor.vars.<array_var>` + `set_config`-merge pattern (or a `codeBox` for power-user admin tooling). |
| Editor code calls an action directly | UI-tier rule: editor calls functions only. The function wraps the action via `$apis.<Package>.FootprintApi.extendedActions.<action_name>({...})`. |
| Unwrapped declarative-string slot (`"Manage rules."` instead of `` "`Manage rules.`" ``) | Inlined verbatim into generated TS — bare tokens break the build. Backticks for display text; quotes for plain literals; raw expressions unwrapped. |
| `$types.<Package>.e_<enum>` in `vars` / `inParams` / `outParams` | Custom-enum FQN doesn't resolve at the param layer. Declare as primitive (`string` / `number`); cast at usage inside flow code. |
| `datasourceConfig.configOutParameters` authored as an object keyed by param name (`{"result": {...}}`) | It is an **array of parameter descriptors** mirroring the embedded datasource's `outParams` — `[{"id":"result","type":"object","objectTypeDef":[...],"isCollection":false}]`. The object form fails validation with a raw `Cannot deserialize ... into type 'IList<VarConfig>'` dump that names no field. |
| Embedded datasource given a `moduleId` on `datasourceConfig` | An embedded (private) editor datasource carries **no `moduleId`**; `datasourceConfig` sets **`isOwned: true`** instead. With a `moduleId` the platform reports `Invalid contract. Referenced configuration <name> does not exist or has been renamed`, which points at the wrong problem entirely. |
| Embedded datasource missing `hasKey` / `hasResult` / `queryOptionsObjectTypeDef` | All three are required. `queryOptionsObjectTypeDef` repeats the **entity shape** (the same array as `outParams[0].objectTypeDef`) and is the fifth entity-shape typedef site — the one most often missed. Omitting it fails with the bare, undiagnostic message `Entity definition is required`. |
| Piping `dxs configuration get -O envelope.json` directly into `dxs configuration upsert -D envelope.json` | Silently destroys config content. Always `jq .json envelope.json > body.json` before editing. See "Round-trip rule" above. |
| `description` exceeds 100 chars | SQL column limit — push will fail validation. Tighten. |
| `referenceName` doesn't end in `_editor` or doesn't match filename stem | Import / lookup breaks. Snake_case, `_editor` suffix, filename stem matches. |
| `moduleId` on the host's reference set to the host's package instead of the editor's | Cross-component reference rule — `moduleId` is always the target's package. See `../component-wiring-check/references/component-wiring.md`. |

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
