# Wizards — Authoring Reference

Authoritative reference for Datex Studio **wizard** components (`configurationTypeId: 13`, CLI type `wizard`, `-wizard.json` suffix). A wizard is a stepped dialog: an ordered set of **steps**, each hosting one existing grid, form or editor, with declarative navigation between steps, a per-step Next-button gate, and an optional finish flow that assembles the wizard's `outParams` for the opener. Peer docs: [grids](../../grid-creator/references/grids.md), [forms](../../form-creator/references/forms.md), [editors](../../editor-creator/references/editors.md), [dashboards](../../dashboard-creator/references/dashboards.md) (the composed-dialog alternative). Cross-cutting rules: [file-format](../../datex-studio-conventions/file-format.md), [naming-conventions](../../datex-studio-conventions/naming-conventions.md), [runtime-globals](../../datex-studio-runtime/runtime-globals.md), [component-wiring](../../component-wiring-check/references/component-wiring.md).

> Provenance: distilled from production components on a Footprint Manager package and the generated designer contexts, dxs 0.5.8. Statements marked "validate" were checked with `dxs configuration validate wizard` against probe bodies (verified live, dxs 0.5.8).

## Purpose & When to Use

Pick a **wizard** when the user must move through an **ordered sequence** of screens where a later screen depends on what an earlier one produced (enter quantities → pick inventory; create the record → add its contacts → add its owners), or when a single existing grid/form must be wrapped as a dialog that hands a result back.

| Need | Type |
|---|---|
| Ordered steps; step N's inputs come from step N-1's outputs; one Next/Finish button per step | **wizard** |
| Side-by-side panels with shared state (available vs selected grids, live summary, collapsible sections) | **dashboard** — [dashboard-creator](../../dashboard-creator/references/dashboards.md#dashboard-vs-adjacent-types) |
| One screen of transient inputs with validate-then-confirm | **form** — [form-creator](../../form-creator/references/forms.md) |
| Single-entity view/edit | **editor** — [editor-creator](../../editor-creator/references/editors.md) |

A wizard has **no layout of its own**: no toolbar, no fields, no events, no side-by-side panels. All UI lives in the hosted components. When a wizard would exist only to host one selection grid plus a confirm, a dialog dashboard is the richer host (see [Replacing a wizard](../../dashboard-creator/references/dashboards.md#replacing-a-wizard)).

## File Location & Naming

- File name: `<referenceName>-wizard.json` (a naming convention for any local copy; the branch is the system of record)
- Suffix: `-wizard.json`
- `configurationTypeId`: `13`; CLI type argument: `wizard`
- `referenceName` is snake_case and **ends in `_wizard`** (every shipped wizard does), e.g. `inventory_by_lot_selection_wizard`, `account_creation_wizard`.
- `title` is user-facing (dialog header): a distinct sentence-case phrase, never equal to `referenceName` — see [Display Names for User-Facing Components](../../datex-studio-conventions/naming-conventions.md#display-names-for-user-facing-components). Shipped title-case titles ("Inventory by Location Batch Move Wizard") are legacy, not a pattern.
- Step `id`s are snake_case TypeScript identifiers (`step1`, `step2_select_inventory`) — each becomes a property on `$wizard.steps`.
- `description` mandatory, non-empty, ≤100 chars. Default package and access per [defaults](../../datex-studio-conventions/defaults.md).

## Minimal Valid Skeleton

A two-step form → grid wizard with Next-button gating and the `confirm` outParam convention. The callees (`example_quantity_form`, returning `quantity`; `example_selection_grid`, taking `warehouse_id` + `quantity` and returning `selected_ids`) must already exist on the branch — validate resolves them (an unknown `configId` fails with `Invalid contract. Referenced configuration <id> does not exist or has been renamed`). Replace names, package and params with your own; copy each step's `configParameters`/`configOutParameters` from the callee's declared `inParams`/`outParams`.

```json
{
  "steps": [
    {
      "id": "step1",
      "title": "Enter quantity",
      "contentType": "form",
      "contentConfig": {
        "configParameters": [],
        "configOutParameters": [
          { "id": "quantity", "required": false, "type": "number", "isCollection": false, "isSecured": false }
        ],
        "configId": "example_quantity_form",
        "moduleId": "Utilities"
      },
      "repeatOver": "",
      "nextCondition": "",
      "next": "step2",
      "nextButtonLabel": "Next",
      "nextButtonDisabledCondition": "!$utils.isDefined($wizard.steps?.step1?.outParams?.quantity)"
    },
    {
      "id": "step2",
      "title": "Select lines",
      "contentType": "grid",
      "contentConfig": {
        "configParameters": [
          { "parameter": { "id": "warehouse_id", "required": true, "type": "number", "isCollection": false }, "value": "$wizard.inParams.warehouse_id" },
          { "parameter": { "id": "quantity", "required": false, "type": "number", "isCollection": false }, "value": "$wizard.steps?.step1?.outParams?.quantity" }
        ],
        "configOutParameters": [
          { "id": "selected_ids", "required": false, "type": "number", "isCollection": true, "isSecured": false }
        ],
        "configId": "example_selection_grid",
        "moduleId": "Utilities"
      },
      "repeatOver": "",
      "nextCondition": "",
      "nextButtonLabel": "Finish",
      "nextButtonDisabledCondition": "($wizard.steps?.step2?.outParams?.selected_ids ?? []).length === 0"
    }
  ],
  "flows": [
    {
      "enableProgressAndCancelation": false,
      "configurationTypeId": 9,
      "start": "step1",
      "nodes": [ { "id": "step1", "type": "step", "stepConfig": { "type": "ExecuteCodeActivity", "executeCodeConfig": { "code": "$wizard.outParams.confirm = false;" } } } ],
      "referenceName": "on_init",
      "title": "on_init",
      "accessModifier": "public"
    },
    {
      "enableProgressAndCancelation": false,
      "configurationTypeId": 9,
      "start": "step1",
      "nodes": [ { "id": "step1", "type": "step", "stepConfig": { "type": "ExecuteCodeActivity", "executeCodeConfig": { "code": "$wizard.outParams.selected_ids = $wizard.steps?.step2?.outParams?.selected_ids ?? [];\n$wizard.outParams.confirm = true;" } } } ],
      "referenceName": "on_finish",
      "title": "on_finish",
      "accessModifier": "public"
    }
  ],
  "onInitFlowConfig": { "flowId": "on_init" },
  "onFinishFlowConfig": { "flowId": "on_finish" },
  "configurationTypeId": 13,
  "id": 0,
  "referenceName": "example_line_selection_wizard",
  "title": "Select lines",
  "description": "Collects a quantity, then lets the user pick lines; returns the selected ids.",
  "inParams": [
    { "id": "warehouse_id", "required": true, "type": "number", "isCollection": false, "isSecured": false }
  ],
  "outParams": [
    { "id": "confirm", "required": false, "type": "boolean", "isCollection": false, "isSecured": false },
    { "id": "selected_ids", "required": false, "type": "number", "isCollection": true, "isSecured": false }
  ],
  "accessModifier": "public"
}
```

Smallest valid shape (validate): `steps` with one step holding `id`, `title`, `contentType`, `contentConfig{configId, moduleId}` plus identity fields. `flows`, `onInitFlowConfig`, `onFinishFlowConfig`, `outParams`, `vars` and the step keys `repeatOver`, `nextCondition`, `nextButtonDisabledCondition` are all optional to validate; shipped bodies carry the three step keys as `""`.

Verified live: once a step's `configOutParameters` matches the callee exactly (an omitted key, not `[]`, when the callee declares `outParams: null` — see [Invocation Contract](#invocation-contract) above), the rest of the body carries no null-valued keys and `get` after `upsert` returns keys byte-identical to what was sent (only `id` differs) — the same null-stripping/id-stamping behavior documented for other component types.

## Required Top-Level Fields

Top-level keys on the inner body (never the envelope). Observed across every shipped wizard: `steps, flows?, onInitFlowConfig?, onFinishFlowConfig?, inParams, outParams?, vars?` + identity tail. There is **no** `toolbar`, `events`, `fields` or layout key.

| Field | Purpose | Notes |
|---|---|---|
| `steps` | Ordered step list | At least one (`There should be at least one step` otherwise). Shape: [Step Keys](#step-keys). |
| `flows` | Embedded flows | `configurationTypeId: 9` bodies, **no params**, closing over `$wizard`. Any `referenceName` works (`finish_flow` ships); the hooks name them by `flowId`. |
| `onInitFlowConfig` | `{ "flowId": "<flow>" }` | Runs when the wizard opens. A `flowId` not in `flows[]` fails: `Missing 'Init flow' <id>`. |
| `onFinishFlowConfig` | `{ "flowId": "<flow>" }` | Runs from the final step's button. Missing flow fails: `Missing 'Finish flow' <id>`. Optional — one shipped form → grid wizard omits it and lets the grid do the work. |
| `inParams` | Opener → wizard | Becomes the first argument of the generated opener. When empty, the opener takes no inParams argument at all. |
| `outParams` | Wizard → opener | The opener's Promise resolves to this object. Declare `confirm: boolean` for any wizard whose caller must tell finish from cancel. |
| `vars` | Wizard-scoped state | Every `$wizard.vars.<id>` must be declared; with no `vars` the key is absent from `IWizard` and any use fails validate (`Property 'vars' does not exist on type 'IWizard'`). Same rule as [declared vars](../../component-wiring-check/references/component-wiring.md#component-variables-must-be-declared). |
| `configurationTypeId` | `13` | |
| `id`, `referenceName`, `title`, `description`, `accessModifier` | Identity | `id: 0` for new; `accessModifier: "public"`. |

### Step Keys

| Key | Meaning | Notes |
|---|---|---|
| `id` | Step handle | Unique; becomes `$wizard.steps.<id>`. Duplicate ids collapse the generated `steps` type and surface only as cascading `Property '<id>' does not exist` errors. |
| `title` | Step caption | Plain display text. |
| `contentType` | Hosted component kind | A **string**, never a numeric code. The designer offers four values — `"editor"`, `"form"`, `"grid"` and `"footprintQueryManager"` (labelled Editor, Form, Grid, Footprint Query Manager); captured from the Studio designer (option lists), dxs 0.5.8. Validate accepts all four, and rejects anything else — `list`, a bogus string and the number `17` all fail `Step content type <value> is not allowed`. Shipped bodies use only `grid`, `form` and `editor` (23 grid, 4 editor, 2 form — body counts, not codes). Validate does **not** check that `configId` is actually of this type. |
| `contentConfig` | Reference to the hosted component | `{ configId, moduleId, configParameters, configOutParameters, configEvents? }` — see [Invocation Contract](#invocation-contract). |
| `next` | Step id to go to | Set on every non-final step in shipped wizards. **Validate does not check the target exists** (a dangling or cyclic `next` passes). |
| `nextCondition` | TS expression | When non-empty: truthy → `next`, falsy → `nextAlt`. `""` = unconditional. One shipped use (`$wizard.vars.<flag>`). |
| `nextAlt` | Alternate step id | Taken when `nextCondition` is falsy. Not checked by validate either. |
| `nextButtonLabel` | Button caption | Plain text (`"Next"`, `"Finish"`, `"Confirm"`, `"Pick appointment"`); validate does not type-check it. Set it on the final step; shipped non-final steps sometimes omit it (default caption `_TODO_ (not exposed by the designer; runtime unverified)`). |
| `nextButtonDisabledCondition` | TS expression | Truthy → button disabled. The **only** gating hook. `""` = always enabled. |
| `repeatOver` | TS expression, typed `number` | `""` in every shipped step. Validate types it as a number (`'abc'` → `Type 'string' is not assignable to type 'number'`) and, once set, retypes that step's `outParams` as an **array** (`$wizard.steps.<id>.outParams` becomes `{…}[]`); `$index` (number) is in scope for declarative slots. Reading: repeat the step N times with `$index` the iteration. Runtime behaviour `_TODO_ (runtime unverified)`. |

`configParameters[].value`, `nextCondition`, `nextButtonDisabledCondition` and `repeatOver` are **TypeScript expressions** ([encoding rule](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions)) — and unlike most declarative slots, validate **type-checks them** against the generated `IWizard` (a misspelt outParam fails with `Property '<x>' does not exist on type …`).

## Runtime Globals

Generated from the body by the designer (`dxs configuration contexts wizard`). The root interface carries only what the body declares:

```ts
interface IWizard {
  inParams: { ... };          // only when inParams declared
  outParams: { ... };         // only when outParams declared
  vars: { ... };              // only when vars declared
  steps: {
    <stepId>?: { outParams: { ... } }   // typed from that step's configOutParameters
  };
}
```

**There is nothing else**: no `close()`, no `events`, no flow methods, no current-step accessor, no navigation API. Contexts:

- **Declarative slots** (`configParameters` values, `nextCondition`, `nextButtonDisabledCondition`, `repeatOver`): `$wizard`, `$index`, `$utils`. No `$shell`, `$flows` or `$datasources` — compute anything richer into `$wizard.vars` from a flow.
- **Flow code** (`flows[]`): `$wizard`, `$event` (`any`), plus the UI-tier globals `$shell`, `$flows`, `$datasources`, `$frontendFlows`, `$operations`, `$settings`, `$userSettings`, `$reports`, `$types`, `$context`, `$utils` ([runtime-globals](../../datex-studio-runtime/runtime-globals.md); UI-tier [calling rules](../../datex-studio-runtime/calling-conventions.md) apply). `$index` is **not** available in flows (`Cannot find name '$index'`).

### `$wizard.close()` — works, untyped

`IWizard` omits `close()`, so `$wizard.close();` fails validate with `Property 'close' does not exist on type 'IWizard'`. Shipped code closes early (failed init, failed validation) with:

```ts
// @ts-ignore  -- IWizard typings omit close(); platform defect
$wizard.close();
```

Validate passes with the `// @ts-ignore` line. That the call closes the dialog at runtime is what shipped wizards rely on; confirm in Preview `_TODO_ (runtime unverified)`. The ignore also hides any real type error on that line — keep it to the bare `$wizard.close();` statement.

### Optional chaining on `steps`

Every `steps.<id>` is typed optional, and a step's outParams are empty until the hosted component emits. Shipped code mixes `$wizard.steps.step1.outParams.x` and `$wizard?.steps?.step1?.outParams?.x`; both validate. Use the fully-optional form `$wizard.steps?.<id>?.outParams?.<x>` everywhere — gating expressions are evaluated before the step has produced anything.

## Invocation Contract

### Wizard → hosted component (each step)

`contentConfig` follows the same reference contract as any host ([component-wiring](../../component-wiring-check/references/component-wiring.md)):

- **`moduleId`** — the hosted component's own package.
- **`configParameters`** — one entry per callee `inParam`, `{ parameter: <callee's descriptor>, value: <TS expression> }`; unused ones keep the entry with `value: ""`. Validate enforces both directions: `Outdated contract. Missing input parameter <id>` and `Outdated contract. Input parameter <id> does not exist or has been renamed`.
- **`configOutParameters`** — a **manual redeclaration of the callee's `outParams`**. It is what types `$wizard.steps.<id>.outParams`; nothing is inherited from the callee. Validate (wizard-side) rejects any drift with `Outdated contract. Type mismatch for output parameters` — an omitted entry, an extra entry, a changed type, or `[]` where the callee has `outParams: null` (use `null`/omit then). The message names neither step nor parameter, so **diff each step against the callee's declared `outParams`** to find it. Entry order and the `required`/`isSecured` flags are not compared.
- **`configEvents`** — `[{ "eventConfig": { "id": "<event>" } }]`, seen once (`onInit` on a grid step, no handler key). Semantics `_TODO_ (not exposed by the designer; runtime unverified)`; do not author it.

**How data reaches the wizard.** The hosted component writes its outParams and emits the change; the wizard re-reads `$wizard.steps.<id>.outParams` and re-evaluates the gating expression:

```ts
// in the hosted grid (row/selection flow) or form (field uiValueChange flow)
$grid.outParams.selected_ids = ids;        // or $form.outParams.quantity = ...
$grid.events.outParamsChange.emit();       // or $form.events.outParamsChange.emit()
```

A step whose callee never emits leaves its outParams empty, so a gate on it never opens.

**Editor steps have no native channel.** No shipped wizard reads an editor step's outParams through `$wizard.steps`; even the one editor step that declares `configOutParameters` delivers its data another way (see [DOM event bridge](#dom-event-bridge-for-editor-steps-last-resort)). Whether an editor's `outParams` propagate natively is `_TODO_ (runtime unverified)`. Prefer a grid or form step whenever the wizard needs the step's result.

**Shared callees.** A grid hosted by a wizard is often also hosted by hubs and dashboards. Adding an inParam or outParam to that grid makes every wizard host stale — and a wizard is not on the branch's change list, so its `Outdated contract …` error appears **only at `dxs source branch validate`**, not at the grid's own validate. Find hosts server-side with the `impact-analysis` skill and mirror the change into each step's `configParameters`/`configOutParameters`.

### Opener → wizard

Codegen emits a **dialog-only** opener (no full-view `open<ref>` variant): `open` + `referenceName` (snake_case preserved) + `Dialog`, under the wizard's own package:

```ts
$shell.<Package>.open<referenceName>Dialog(
  inParams: { ... },            // omitted entirely when the wizard declares no inParams
  mode?: 'modal' | 'flyout',
  size?: EModalSize             // Small | Standard | Large | Xlarge
) => Promise<{ ...outParams }>
```

```ts
const result = await $shell.<Package>.openexample_line_selection_wizardDialog(
  { warehouse_id: warehouseId }, 'modal', EModalSize.Large);
if (!result?.confirm) { return; }          // cancelled or closed early
await $flows.<Package>.apply_selection_flow({ ids: result.selected_ids });
```

The host component that opens it carries the usual `configParameters` contract for a referenced component ([component-wiring](../../component-wiring-check/references/component-wiring.md#reference-contracts-include-every-target-inparam)).

## Navigation and Lifecycle

1. Open → `onInitFlowConfig` runs; the first step in `steps[]` renders.
2. The Next button is enabled while `nextButtonDisabledCondition` is falsy.
3. Clicking it moves to `next` (or `nextAlt` when `nextCondition` is falsy). A step with neither is the final step: its button runs `onFinishFlowConfig`, and the dialog closes with the current `$wizard.outParams` (no shipped finish flow calls `close()`).
4. No per-step hooks: there is no "on step entered/left" flow. Work that must happen between steps lives in the hosted components or in `on_finish`.

`_TODO_ (runtime unverified)`: whether a non-final step with no `next` falls through to array order (every shipped non-final step sets `next`), whether a Back button exists, the default button caption, and what the opener receives when `on_finish` throws (shipped finish flows catch and toast, or set `confirm = false`). `_TODO_ (not exposed by the designer; runtime unverified)`: help text for `repeatOver` — the designer's step form labels it only "Repeat" and takes a free expression.

## Common Patterns

### `confirm` outParam (finish vs cancel)

`on_init` sets `$wizard.outParams.confirm = false;`, `on_finish` sets it `true` after assembling the other outParams; the opener branches on `result?.confirm`. Closing the dialog any other way (header close, early `$wizard.close()`) leaves `false`, so callers never mistake a cancel for an empty result. The form equivalent is `is_confirmed` ([forms](../../form-creator/references/forms.md)); keep whichever name the existing callers already read.

### Gating on step output

```text
"nextButtonDisabledCondition": "!$utils.isDefined($wizard.steps?.step1?.outParams?.quantity)"
"nextButtonDisabledCondition": "!$wizard.steps?.step2?.outParams?.confirm"
```

The hosted grid/form owns the validity decision and emits a flag (`confirm`, `is_valid`) as an outParam; the wizard just gates on it.

### Double-submit guard on the finish button

Declare `vars: [{ "id": "disable_confirm", "type": "boolean", ... }]`; `on_init` sets it `false`; the final step's `nextButtonDisabledCondition` includes `$wizard.vars.disable_confirm || …`; `on_finish` sets it `true` first thing, before any awaited work.

### Selection wrapper (single grid step)

The commonest shipped wizard: one grid step labelled "Finish", `on_finish` copies `$wizard.steps?.step1?.outParams?.inventory` to `$wizard.outParams.inventory`. New work of this shape should be a dialog dashboard instead ([dashboards](../../dashboard-creator/references/dashboards.md#replacing-a-wizard)).

### Branching

```json
{ "id": "step2_properties", "nextCondition": "$wizard.vars.can_add_accessorials",
  "next": "step3_accessorials", "nextAlt": "step4_complete", "...": "..." }
```

Compute the flag into a declared var from a flow (declarative slots cannot call `$flows`).

### DOM event bridge for editor steps (last resort)

The shipped workaround for editor steps: `on_init` waits briefly, finds the wizard's host element by its generated tag (`<Package>-<referenceName>`) and listens for `CustomEvent`s the editor dispatches, copying `event.detail` into `$wizard.vars`:

```ts
await new Promise(r => setTimeout(r, 100));
const el = document.getElementsByTagName('<Package>-<referenceName>')[0];
el?.addEventListener('handle_output_changed', ((e: CustomEvent<any>) => {
  $wizard.vars.inventory = e?.detail;
}) as EventListener);
```

Fragile on every axis: relies on the generated element tag and a timing delay, bypasses `configOutParameters` typing and validate, couples the editor to one host, and breaks silently on rename or tailoring. Use it only when the step must be an editor and the data cannot be produced by a form/grid step; document the event names on both sides.

## Pre-Flight Checklist

1. **File basics** — `configurationTypeId: 13`, suffix `-wizard.json`, `referenceName` ends in `_wizard`, sentence-case `title` distinct from `referenceName`, `description` non-empty ≤100 chars, plus the [universal checks](../../datex-studio-conventions/universal-checklist.md).
2. **Right type** — the flow is genuinely stepped; side-by-side selection or a single-panel picker goes to [dashboard-creator](../../dashboard-creator/references/dashboards.md).
3. **Steps** — at least one; unique snake_case ids; `contentType` ∈ grid/form/editor (strings; `footprintQueryManager` is also offered by the designer but unobserved in production) and matching what `configId` really is (validate won't catch a mismatch).
4. **Navigation graph** — every `next`/`nextAlt` names an existing step id; exactly the intended final step(s) have no `next`; no unintended cycles. Validate checks none of this.
5. **`configParameters` parity** — one entry per callee `inParam`, no extras, `moduleId` = callee's package.
6. **`configOutParameters` parity** — byte-for-byte the callee's declared `outParams` (`null` when the callee has none). Diff it; the validate message won't say which step.
7. **Hosted components emit** — every step whose output the wizard reads writes its outParams and calls `events.outParamsChange.emit()`.
8. **Gating** — `nextButtonDisabledCondition` uses the fully-optional `$wizard.steps?.<id>?.outParams?.<x>` form and only declared outParams/vars.
9. **Lifecycle flows** — `onInitFlowConfig`/`onFinishFlowConfig` `flowId`s exist in `flows[]`; every `$wizard.vars.<id>` is declared; `confirm` is set `false` in init and `true` in finish when callers need it.
10. **`close()`** — every `$wizard.close();` sits directly under `// @ts-ignore`.
11. **Shared callees** — after changing a hosted grid/form's params, sweep its other hosts (`impact-analysis`) and run `dxs source branch validate`.
12. **Validate clean** — `dxs configuration validate wizard -b <branchId> -D body.json` before every upsert.

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| `Outdated contract. Type mismatch for output parameters` | A step's `configOutParameters` differs from the callee's `outParams` (missing/extra entry, type change, `[]` vs `null`) | Diff each step against the callee and copy its descriptors. |
| `Outdated contract. Missing input parameter <id>` (often only at branch validate) | Callee gained an inParam; this wizard step wasn't updated | Add the `configParameters` entry (`value: ""` if unbound); sweep other hosts. |
| `Outdated contract. Input parameter <id> does not exist or has been renamed` | Extra or renamed `configParameters` entry | Remove/rename to match the callee. |
| `Invalid contract. Referenced configuration <id> does not exist or has been renamed` | Wrong `configId`/`moduleId` | Point at the callee's real referenceName and package. |
| `Property 'close' does not exist on type 'IWizard'` | `$wizard.close()` without the ignore | Add `// @ts-ignore` on the line above. |
| `Property 'vars' does not exist on type 'IWizard'` | `$wizard.vars` used with no `vars[]` declared | Declare the var. |
| `Property '<x>' does not exist on type '{ … }'` in a gating expression | Reading an outParam the step's `configOutParameters` doesn't declare | Add it to `configOutParameters` (matching the callee) or fix the name. |
| `Missing 'Finish flow' <id>` / `Missing 'Init flow' <id>` | Hook names a flow not in `flows[]` | Fix the `flowId` or add the flow. |
| Next button never enables | Callee never emits `outParamsChange`, or gate reads an undeclared/misspelt path | Emit from the callee; check the gate expression. |
| Clicking Next does nothing / jumps oddly | `next`/`nextAlt` names a missing step or forms a cycle | Fix the step ids; validate won't flag it. |
| Caller treats a cancel as success | No `confirm` outParam, or caller doesn't branch on it | Add the `confirm` convention; `if (!result?.confirm) return;`. |
| Push wiped content | Upserted the envelope | `jq .json envelope.json > body.json` first ([round-trip](../../datex-studio-shared/configuration-roundtrip.md)). |

## Cross-References

- [../../dashboard-creator/references/dashboards.md](../../dashboard-creator/references/dashboards.md) — the composed-dialog alternative, the wizard-replacement recipe and the shared-grid host sweep.
- [../../grid-creator/references/grids.md](../../grid-creator/references/grids.md) — grids hosted as steps (outParams + `outParamsChange`).
- [../../form-creator/references/forms.md](../../form-creator/references/forms.md) — forms hosted as steps; the `is_confirmed` sibling of `confirm`.
- [../../editor-creator/references/editors.md](../../editor-creator/references/editors.md) — editors hosted as steps (no native outParams channel to the wizard).
- [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md) — `moduleId`, one-for-one `configParameters`, declared vars.
- [../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md) — cti table and the TS-expression encoding rule.
- [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md) — `_wizard` indicator and the display-name rule.
- [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md) and [../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md) — UI-tier globals and calling rules for wizard flows.
- [../../datex-studio-shared/configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md) — get → extract → validate → upsert.
