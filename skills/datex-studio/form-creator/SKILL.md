---
name: form-creator
description: |
  Use when authoring or modifying a Datex Studio form (configurationTypeId=5,
  *-form.json suffix) on a branch — transient-input collector, dialog opener,
  and validate-then-confirm workflow host. Owns the TypeScript-expression
  encoding for declarative string slots, declarative vs imperative init
  separation, dialog opener pattern, and confirm-button gating. Triggers:
  "create a form", "add a field to xxx form", "open a dialog that collects X",
  "a confirmation dialog with inputs", "validate-then-confirm workflow",
  "declarative binding is not populating the field", "confirm button always
  disabled", "dialog outParams are undefined on cancel".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - editor-creator
  - embed-creator
  - grid-creator
  - selector-creator
  - hub-creator
  - component-wiring-check
  - type-definition-creator
  - requirements-gathering
  - post-edit-verification
  - component-validator
---

# Form Creator

Author or modify a Datex Studio form (configurationTypeId=5) on a branch — an input-collection component that gathers user data, optionally hosts a validate-then-action workflow, and hands a payload back to its caller via `outParams` when it closes. Forms are most commonly opened as modal/flyout dialogs from grids, hubs, and other forms.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/forms.md](references/forms.md) — Authoritative form authoring reference: file shape, runtime globals, invocation contract, common patterns, pre-flight checklist
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and TypeScript-expression encoding rules
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_form` suffix, filename stem matching, display-name rule
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — platform-injected globals available in form code (`$form`, `$flows`, `$shell`, `$utils`, ...)
- [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md) — UI-tier calling rules (call functions, never actions; CRUD via `$apis.<Package>.FootprintApi.extendedActions.<action_name>`)
- [../editor-creator/references/editors.md](../editor-creator/references/editors.md) — sibling component for entity-bound view/edit (the form-vs-editor decision)
- [../embed-creator/references/embeds.md](../embed-creator/references/embeds.md) — sibling; for iframe/URL/HTML-string rendering with no field controls (the form-vs-embed decision)
- [../grid-creator/references/grids.md](../grid-creator/references/grids.md) — typical host for forms via row-action / toolbar-button flows
- [../selector-creator/references/selectors.md](../selector-creator/references/selectors.md) — dropdown / autocomplete fields mount selectors
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — host reference contracts, vars-must-be-declared rule, moduleId rule

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`editor-creator`** / **`grid-creator`** skills — invoked when the requirement is actually a single-entity view/edit screen (editor) or a multi-record list (grid), not transient input collection
- **`selector-creator`** skill — invoked when a dropdown / autocomplete field on the form needs a backing selector that doesn't yet exist
- **`hub-creator`** skill — invoked when the form's host is a hub tab/button whose `configParameters` contract must be set up to open the form as a dialog
- **`component-wiring-check`** skill — invoked to audit `configParameters` ↔ target `inParams` contracts on the form's host (hub button / grid row action / parent form) before push
- **`type-definition-creator`** skill — invoked when the form's `inParams` / `outParams` / `vars` shapes reference an interface that needs authoring or extension

## CLI Lifecycle

Form authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs form` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The type identifier in the CLI is **`form`** (lowercase, matches `ConfigurationEndpoints.normalize_type` output), mapping to `configurationTypeId: 5`.

**Create a new form:**

```bash
# 1. Build body.json from scratch (see references/forms.md → Minimal Valid Skeleton)
# 2. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate form -b <branchId> -D body.json
# 3. Create
dxs configuration upsert form -b <branchId> -D body.json
```

**Edit an existing form:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get form <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard — see "Round-trip rule" below)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate form -b <branchId> -D body.json
# 5. Push
dxs configuration upsert form -b <branchId> -D body.json
```

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. The corrected sequence above (extract inner `.json` with `jq` before editing) is mandatory for any round-trip. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

Forms carry `toolbar`, `fieldsets` (with per-field `controlConfig` blocks), `flows` (with a `code` string on every executeCodeConfig step), and `inParams`/`outParams`/`vars` schemas — round-trip discipline (fetch → jq-extract → edit → validate → push) is non-negotiable.

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
[Phase 2: Form vs Editor vs Grid decision]
Consult references/forms.md → "Purpose & When to Use":
  - transient input collection, returns outParams, no entity -> form
  - single hydrated entity, view/edit toggle, persist via CRUD -> editor
  - multi-record tabular view -> grid
If editor -> invoke `editor-creator` instead and stop here.
If grid -> invoke `grid-creator` instead and stop here.
Create-only dialogs are usually forms, not editors.
        |
[Phase 3: Author form body]
Build body.json:
  - File shape (configurationTypeId=5, *-form.json suffix,
    referenceName ends _form, snake_case matches filename stem)
  - TypeScript-expression encoding on every declarative string slot
    (value, tooltip, placeholder, format): backticks for display text,
    TS quotes for plain literals, raw expressions unwrapped
  - Declarative vs imperative init — don't mix; if both are present
    they must read the same inParam path
  - Open form as dialog via $shell.<TargetPackage>.open<referenceName>Dialog
    (target's package, not the caller's; snake_case preserved)
  - Validate-then-gate-confirm via onFormValidateFlowConfig +
    formValidationFlows, not one-shot onInitFlowConfig assignments
  - Emit is_confirmed: boolean outParam if callers must distinguish
    confirm from cancel
  - Every $form.vars.<id> written in flow code is declared in vars[];
    every $form.<flowName>() call has a matching flow in flows[]
  - Sibling *Config keys explicitly null on every controlConfig
  - No $types.<Package>.e_<enum> in vars/inParams/outParams —
    primitives only at the param layer; cast at usage in flow code
  - Invoke `selector-creator` if a dropdown field needs a new selector
  - Invoke `component-wiring-check` to audit the host's configParameters
        |
[Phase 4: Validate + push]
dxs configuration validate form -b <branchId> -D body.json
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
dxs configuration upsert form -b <branchId> -D body.json
   (upsert creates or updates by referenceName — one command for both)
        |
[Phase 5: Verify in Studio (optional)]
Open the form as a dialog (from its host hub/grid/form);
confirm field hydration, validate-then-gate-confirm, confirm vs cancel
return shapes
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 1: Setup + Requirements

1. Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for branch and connection selection. **Never assume a branch ID** — ask the user to confirm.
2. Check whether a **requirements brief** already exists in the conversation context (produced by `requirements-gathering` or another calling skill).
   - **Brief exists** — use it. The brief should establish what inputs the form collects, the validity rules, what the caller does with the returned payload (which CRUD action — if any — runs on confirm), and how the form is opened (which host invokes the dialog).
   - **No brief** — invoke the `requirements-gathering` skill first. Getting the input shape, validity rules, and confirm-vs-cancel semantics right up front avoids re-authoring the validate-then-gate-confirm flow.

### Phase 2: Form vs Editor vs Grid decision

Consult [references/forms.md → Purpose & When to Use](references/forms.md#purpose--when-to-use) before authoring. The choice is not stylistic — forms, editors, and grids serve different roles and aren't interchangeable.

Pick a **form** when:

- The work is **transient input collection** that doesn't correspond to a stored record yet.
- The dialog returns `outParams` to the caller; nothing persists implicitly from the form itself.
- The dialog is creation-only and no entity yet exists to hydrate.
- The dialog presents a configuration prompt (a schedule, a set of options) and hands the value back to the caller.

Pick an **editor** instead when:

- The user views or modifies a **single entity** identified by a key.
- Field-level inputs map 1:1 to properties of that entity.
- The UX wants a distinct view-mode (read-only) and edit-mode (inputs unlocked, save active) toggle.
- The flow persists changes through a CRUD action; the dialog doesn't just return values.

Pick a **grid** instead when:

- The user views or operates on **multiple records** in a tabular layout.

If the answer is editor, stop and invoke `editor-creator`. If the answer is grid, stop and invoke `grid-creator`. Forms can call CRUD actions on confirm (the validate-then-action pattern), but that's still a form — there's no hydrated entity reference, just inputs collected and an action invoked.

### Phase 3: Author form body

Build `body.json` from the skeleton in [references/forms.md → Minimal Valid Skeleton](references/forms.md#minimal-valid-skeleton). Key points:

1. **File basics.** Per the **Pre-Flight Checklist** below + [../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md); see [references/forms.md → File Location & Naming](references/forms.md#file-location--naming) for the `-form.json` file shape.

2. **TypeScript-expression encoding on every declarative-string slot.** Every `value`, `tooltip`, `placeholder`, `format`, and button `label` (when bound to a var) inside `controlConfig` is inlined verbatim into generated TS. Wrap display text in backticks (`` "`Set schedule…`" ``), wrap plain-string literals in TS quotes (`"'MM/DD/YYYY'"`), leave raw expressions unwrapped (`"$form.inParams.foo"`). An unwrapped tooltip like `"Opens the dialog."` compiles to bare tokens and breaks the build — forms violate this rule the most often because of how many string slots controls expose. See [../datex-studio-conventions/file-format.md → Declarative String Values Are TypeScript Expressions](../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions).

3. **Dynamic tooltips route through a var.** Flow code can't assign directly to `$form.fields.x.control.tooltip` — it's a declarative-only slot. To change a tooltip at runtime, declare `$form.vars.<name>` (string), bind the field's `tooltip` to `"$form.vars.<name>"` as a raw TS expression, and assign the var in flow code. See [../datex-studio-conventions/file-format.md → Declarative String Values Are TypeScript Expressions](../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions) and [→ Dynamic Tooltip Values Go Through a Var](../datex-studio-conventions/file-format.md#dynamic-tooltip-values-go-through-a-var).

4. **Declarative vs imperative init — don't mix.** Two ways to seed a field from `inParams`: a **declarative binding** on the control's `value` field (e.g. `"$form.inParams.foo"`, evaluated at render time) or an **imperative assignment** inside `onInitFlowConfig` (`$form.fields.foo.control.value = $form.inParams.foo`, runs after init flow). Use declarative for one-shot init, imperative for conditional/async init. **Don't mix** — a declarative binding and an imperative assignment that read from *different inParam paths* is a silent bug: the declarative binding wins at render and the imperative assignment looks correct but has no effect. If both exist, they must read the same path, or one must go. See [references/forms.md → Receiving inParams inside a form](references/forms.md#receiving-inparams-inside-a-form).

5. **Opening as a dialog.** The dialog-open shell call is derived from the form's `referenceName`: `$shell.<TargetPackage>.open<referenceName>Dialog(inParams, 'modal' | 'flyout', EModalSize.<size>)`. `<TargetPackage>` is the **target form's** package — not the caller's feature folder, not `Utilities` by default. `<referenceName>` is the target form's `referenceName` with snake_case preserved (no camelCasing). The resolved value is the target's `outParams` object; cancel without `$form.close()`ing returns undefined outParam fields. See [references/forms.md → Opening a form as a dialog](references/forms.md#opening-a-form-as-a-dialog) and [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md).

6. **Validate-then-gate-confirm.** Multi-field validation lives in `formValidationFlows` (referenced by `onFormValidateFlowConfig`), not per-field `onValidationFlowConfig`. The flow runs on every field change, computes validity, and sets `$form.toolbar.confirm.control.readOnly`. One-shot assignments inside `onInitFlowConfig` go stale after user interaction — they're wrong for confirm-button gating. Field-level errors push onto `$validation.fieldErrors.<id>`. See [references/forms.md → Validate-then-gate-confirm](references/forms.md#validate-then-gate-confirm).

7. **Confirm-vs-cancel distinguishability.** The caller's `await openXxxDialog(...)` resolves to the target's `outParams` object — and cancellation without a `$form.close()` call leaves those fields `undefined`. If the caller must distinguish confirm from cancel, the target form **emits an explicit `is_confirmed: boolean` outParam** and the caller branches on it. Don't rely on truthy-checking individual outParam fields to detect cancel.

8. **`outParams` type contract matches every close path.** No `required: true` outParam may be written only on some branches — the type contract is what every close path must satisfy. If a confirm branch writes `outParams.value` but the cancel branch doesn't (because cancel doesn't call `$form.close()` at all), `value.required` stays `false`. See pre-flight checklist item 11 in [references/forms.md](references/forms.md#pre-flight-checklist).

9. **`$form.vars` declared + `$form.<flow>()` matches a real flow.** Every `$form.vars.<id>` written in flow code must be declared in the top-level `vars[]` array (`"vars": null` plus `$form.vars.x = ...` fails on import with `Property 'vars' does not exist on type 'IForm'`). Every `await $form.<flowName>()` call must match a real entry in `flows[]` (the platform auto-generates a method on `$form` for every flow's `referenceName`). A common variant: `formValidationFlows` calls `await $form.set_state()` but no `set_state` flow exists. Either define the missing flow or drop the validation hook. See [references/forms.md → `$form.vars` Requires Declaration; `$form.<flow>()` Requires the Flow](references/forms.md#formvars-requires-declaration-formflow-requires-the-flow).

10. **`inParams` / `outParams` / `vars` schema parity with flow code.** Every nested field the flow code reads/writes must appear in the corresponding top-level `objectTypeDef` with the same property descriptor shape across all three. Missing-field failures present as `Property 'X' does not exist on type {...}` at import. When you add a field to an object the flow code touches, add it to every relevant `objectTypeDef` (vars + inParams + outParams) **in the same edit**.

11. **Sibling `*Config` keys are explicitly null.** On every `controlConfig`, only the active sub-config (e.g. `textBoxConfig` on a `textBox` field) is populated; the rest (`buttonConfig`, `selectBoxConfig`, etc.) stay explicitly `null`. Match this convention for structural diffing — existing form components keep all sibling slots present and null.

12. **No custom-enum FQNs in `vars` / `inParams` / `outParams`.** Forms can't resolve `$types.<Package>.e_<enum>` in param declarations — declare those fields as primitive (`string` for string-valued enums, `number` for numeric) and cast at usage inside flow code.

13. **Calling-tier compliance.** Form code calls **functions** via `$flows.<Package>.<fn>`; the function wraps the CRUD action call as `$apis.<Package>.FootprintApi.extendedActions.<action_name>({...})`. No direct action calls from form code. See [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md).

14. **Host contract audit.** The hub button, grid row action, or form that opens this form as a dialog must declare a full `configParameters` contract — every `inParam` the form declares gets an entry on the host, including unused ones with `value: null`. Invoke `component-wiring-check` to audit reference contracts before push. See [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md).

15. **Datasource and linked-datasource shapes, if the form binds any.** Most forms are parameter-driven and carry `datasourceConfig: null` / `linkedDatasources: null`. If this one binds a datasource it must be **single-result** (`get`), the same requirement as an editor, and every `linkedDatasources` entry must match its link `type`. The server-side usage gate blocks publish on either mismatch. See [references/forms.md → Optional Datasource Wiring](references/forms.md#optional-datasource-wiring).

### Phase 4: Validate + push

```bash
# Validate the body locally against the branch. Exit 1 = validation found errors
# (read validation_errors, fix body.json, re-run) — not a broken CLI. Do not push on exit 1.
dxs configuration validate form -b <branchId> -D body.json

# For a new form
dxs configuration upsert form -b <branchId> -D body.json

# For modify-existing (round-trip — never skip the jq extract)
dxs configuration get form <configId> -b <branchId> -O envelope.json
jq .json envelope.json > body.json
# ... edit body.json ...
dxs configuration upsert form -b <branchId> -D body.json
```

Validation surfaces missing required fields, malformed parameter-descriptor shapes, undefined flow-id references, and reference errors before push. It does **not** catch the declarative-vs-imperative-init conflict, undeclared `$form.vars.<id>` writes, unwrapped TypeScript-expression slots, or confirm-button gating that lives in the wrong hook — those are behavioral and only surface at runtime. Walk the [references/forms.md → Pre-Flight Checklist](references/forms.md#pre-flight-checklist) before push.

### Phase 5: Verify in Studio (optional)

Open the form as a dialog through its normal invocation path (a hub toolbar button, a grid row action, or a parent form that chains into it):

- Field hydration succeeds — declarative bindings + imperative `onInitFlowConfig` assignments populate from the inParam paths the caller actually populates.
- The confirm button stays disabled until `onFormValidateFlowConfig` reports valid.
- Confirm closes the form and resolves the caller's `await openXxxDialog(...)` to the populated `outParams`.
- Cancel (X-out, ESC, explicit Cancel button) resolves the caller's promise with outParam fields `undefined` — and if the caller needs to distinguish confirm from cancel, an explicit `is_confirmed: boolean` outParam is emitted on confirm and the caller branches on it.
- Validation field errors render on the right fields (`$validation.fieldErrors.<id>.push(message)` lands on the named field).

If the running app isn't available, re-fetch the config (using the corrected `jq .json` extract pattern) and diff against `body.json` to confirm the push landed.

## Pre-Flight Checklist

Before push, walk the full checklist in [references/forms.md → Pre-Flight Checklist](references/forms.md#pre-flight-checklist). The fast version:

1. **File basics.** `configurationTypeId: 5`, suffix `-form.json`, `referenceName` ends `_form` — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
2. **Flow-id references resolve.** `onInitFlowConfig.flowId`, every `clickFlowConfig.flowId`, `uiValueChangeFlowConfig.flowId`, `onValidationFlowConfig.flowId`, `onFormValidateFlowConfig.flowId` — each must name a flow that exists in `flows[]`.
3. **TypeScript-expression strings wrapped correctly** — display text in backticks; raw expressions unwrapped; plain literals quoted. Dynamic tooltips route through a declared `$form.vars.<name>` (direct `.control.tooltip` assignment is a no-op).
4. **Declarative + imperative init don't conflict.** If a field has both a `value` binding and an `onInitFlowConfig` assignment, they read the same inParam path — otherwise the declarative wins silently.
5. **Confirm button gated via `formValidationFlows`**, not via one-shot `onInitFlowConfig` assignments.
6. **Dialog-open calls use the target form's package** for `<Package>` — not the caller's feature folder or `Utilities` by default. Not camelCased.
7. **`is_confirmed: boolean` outParam emitted** if the caller must distinguish confirm from cancel.
8. **`outParams` type contract matches every close path** — no `required: true` outParam written only conditionally.
9. **`$form.vars` declared** — every var written in flow code is in top-level `vars[]`.
10. **`$form.<flowName>()` calls resolve** — every called flow exists in `flows[]`. Either define the missing flow or drop the validation hook that references it.
11. **`vars` / `inParams` / `outParams` schema parity with flow code** — every nested field the flow code reads/writes appears in the corresponding `objectTypeDef` with matching property descriptors.
12. **Sibling `*Config` keys explicitly null** on every `controlConfig` — only the active one is populated.
13. **No `$types.<Package>.e_<enum>`** in `vars` / `inParams` / `outParams` — primitives only at the param layer; cast at usage.
14. **Calling-tier compliance** — form code calls functions via `$flows.<Package>.<fn>`; functions wrap CRUD actions via `$apis.<Package>.FootprintApi.extendedActions.<action_name>({...})`; no direct action calls from the form.
15. **Host carries a full `configParameters` contract** — every inParam the form declares has an entry on the host; unused ones use `value: null`. Audit via `component-wiring-check`.
16. **Datasource shapes gated** — if the form binds a `datasourceConfig` it is single-result, and every `linkedDatasources` entry matches its link `type`. Both block publish otherwise.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Unwrapped declarative-string slot (`"Opens the dialog."` instead of `` "`Opens the dialog.`" ``) | Inlined verbatim into generated TS — bare tokens break the build. Backticks for display text; quotes for plain literals; raw expressions unwrapped. |
| Flow code assigns to `$form.fields.x.control.tooltip` and tooltip doesn't change at runtime | `.control.tooltip` is declarative-only. Declare `$form.vars.<name>` (string), bind the field's `tooltip` to `"$form.vars.<name>"`, and assign the var in flow code. |
| Declarative `value: "$form.inParams.foo"` + `onInitFlowConfig` writes `$form.fields.x.control.value = $form.inParams.bar` | The declarative binding wins at render; the imperative assignment silently has no effect. Make them read the same path, or drop one. |
| Confirm-button readOnly gated via a one-shot assignment in `onInitFlowConfig` | Goes stale after the first field change. Move gating to `onFormValidateFlowConfig` + `formValidationFlows`. |
| Caller's `await openXxxDialog(...)` returns `undefined` outParams on cancel and code treats that as a confirm with empty values | Emit an explicit `is_confirmed: boolean` outParam from the target form and branch on it. |
| `$form.vars.x = ...` in flow code with `"vars": null` at top-level | Import error: `Property 'vars' does not exist on type 'IForm'`. Declare every var in `vars[]` with the same property-descriptor shape as inParams/outParams. |
| `await $form.set_state()` in flow code with no `set_state` flow in `flows[]` | Import error: `Property 'set_state' does not exist on type 'IForm'`. Either define the missing flow or drop the call (and the `formValidationFlows`/`onFormValidateFlowConfig` hook that contains it). |
| `outParams.value.required: true` but the cancel branch never calls `$form.close()` with `value` populated | The type contract must match every close path. Either drop `required: true` or guarantee `value` is written on every close. |
| Dialog-open call uses the caller's feature folder for `<Package>` (e.g. `$shell.MyFeature.openXFormDialog`) when the target form is registered under `Utilities` | `<Package>` is the **target form's** module, not the caller's. Read the target's declared module. |
| Dialog-open call camelCases the `referenceName` (`openMyFormDialog` for `referenceName: my_form`) | Snake_case is preserved — `$shell.<Package>.openmy_formDialog(...)`. |
| Sibling `*Config` slot dropped (e.g. only `textBoxConfig` populated, other sub-configs missing) | Existing forms keep all sibling slots present and `null` for structural diffing. Match the convention. |
| `$types.<Package>.e_<enum>` in `vars` / `inParams` / `outParams` | Custom-enum FQN doesn't resolve at the param layer. Declare as primitive (`string` / `number`); cast at usage inside flow code. |
| Form code calls an action directly | UI-tier rule: form calls functions only. The function wraps the action via `$apis.<Package>.FootprintApi.extendedActions.<action_name>({...})`. |
| Piping `dxs configuration get -O envelope.json` directly into `dxs configuration upsert -D envelope.json` | Silently destroys config content. Always `jq .json envelope.json > body.json` before editing. See "Round-trip rule" above. |
| `description` exceeds 100 chars | SQL column limit — push will fail validation. Tighten. |
| `referenceName` doesn't end in `_form` or doesn't match filename stem | Import / lookup breaks. Snake_case, `_form` suffix, filename stem matches. |
| `moduleId` on the host's reference set to the host's package instead of the form's | Cross-component reference rule — `moduleId` is always the target's package. See `../component-wiring-check/references/component-wiring.md`. |

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
