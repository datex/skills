---
name: wizard-creator
description: |
  Use when authoring or modifying a Datex Studio wizard (configurationTypeId=13,
  *-wizard.json suffix, CLI type `wizard`) on a branch — a stepped dialog whose
  steps each host an existing grid, form or editor, with declarative navigation
  (next / nextCondition / nextAlt), per-step Next-button gating
  (nextButtonDisabledCondition) and on_init / on_finish flows that set the
  outParams a `$shell.<Package>.open<name>Dialog` opener receives. Owns the
  configOutParameters drift seam (a manual copy of each callee's outParams), the
  `// @ts-ignore` above `$wizard.close()` (IWizard has no close()), the `confirm`
  outParam convention, the unchecked step graph, the editor-step DOM-event
  workaround, and routing composed side-by-side dialogs to dashboard-creator.
  Triggers: "create a wizard", "multi-step dialog", "Next button stays disabled",
  "$wizard.steps outParams undefined", "Outdated contract. Type mismatch for
  output parameters", "Property 'close' does not exist on type 'IWizard'".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
  - grid-creator
  - form-creator
  - editor-creator
  - dashboard-creator
  - impact-analysis
---
# Wizard Creator

Author or modify a Datex Studio wizard (configurationTypeId=13) on a branch — a stepped dialog. A wizard owns no UI of its own: each **step** hosts an existing grid, form or editor, the wizard moves between steps declaratively, gates each step's Next button on what the hosted component has emitted, and assembles its `outParams` in a finish flow for the caller of the generated `$shell.<Package>.open<referenceName>Dialog(...)`.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/wizards.md](references/wizards.md) — Authoritative wizard reference: body and step shape, `IWizard`, navigation, the step contract (`configParameters` / `configOutParameters`), opener, patterns, pre-flight checklist, failure table
- [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) — the get → extract → edit → validate → upsert round-trip and its silent-wipe guard
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and the TypeScript-expression encoding rule (applies to `configParameters[].value`, `nextCondition`, `nextButtonDisabledCondition`, `repeatOver`)
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_wizard` suffix, sentence-case `title`
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — UI-tier globals available in wizard flows (`$wizard`, `$shell`, `$flows`, `$datasources`, `$utils`, ...)
- [../dashboard-creator/references/dashboards.md](../dashboard-creator/references/dashboards.md) — the composed-dialog alternative (wizard-vs-dashboard decision, replacing a wizard, shared-grid host sweep)
- [../grid-creator/references/grids.md](../grid-creator/references/grids.md), [../form-creator/references/forms.md](../form-creator/references/forms.md), [../editor-creator/references/editors.md](../editor-creator/references/editors.md) — the components a step hosts
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — `moduleId`, one-for-one `configParameters`, declared-vars rules every step follows

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`dashboard-creator`** skill — invoked instead when the need is side-by-side panels, an available-vs-selected selection, or a single-panel picker dialog (see Phase 1)
- **`grid-creator`** / **`form-creator`** / **`editor-creator`** skills — invoked to author or retrofit each hosted component (its params, and the `outParamsChange` emit the wizard depends on); `grid-validator` gates grids
- **`component-wiring-check`** skill — invoked to audit each step's `moduleId` / `configParameters` / `configOutParameters` contract and the opener's contract
- **`impact-analysis`** skill — invoked to find every other host of a shared grid/form whose params change

## CLI Lifecycle

Wizard authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs wizard` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The type identifier in the CLI is **`wizard`** (lowercase), mapping to `configurationTypeId: 13`.

**Create a new wizard:**

```bash
# 0. The hosted grids/forms/editors must already exist on the branch (validate resolves them)
# 1. Build body.json from scratch (see references/wizards.md → Minimal Valid Skeleton)
# 2. Validate — gates the push; exit 1 = errors found, not a broken CLI.
#    Catches contract drift ("Outdated contract …"), missing hook flows, $wizard type errors
dxs configuration validate wizard -b <branchId> -D body.json
# 3. Create (upsert creates or updates by referenceName)
dxs configuration upsert wizard -b <branchId> -D body.json
```

**Edit an existing wizard:**

```bash
# 1. Fetch by numeric id — note the envelope wrapper
dxs configuration get wizard <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate wizard -b <branchId> -D body.json
# 5. Push
dxs configuration upsert wizard -b <branchId> -D body.json
```

To see the exact `IWizard` the designer generates for a body (useful when a gate expression fails to type-check), run `dxs -O json configuration contexts wizard -b <branchId> -D body.json` and read only `.configuration_contexts.designerContexts[] | select(.id=="wizardContext") | .text` — never dump the multi-megabyte `appContext`.

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. Always `jq .json envelope.json > body.json` before editing. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md).

## Workflow

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ 1. Decide        │──▶│ 2. Callee        │──▶│ 3. Steps +       │──▶│ 4. Lifecycle     │
│ wizard vs        │   │ contracts        │   │ navigation +     │   │ flows +          │
│ dashboard/form   │   │ (get each callee)│   │ gating           │   │ outParams        │
└──────────────────┘   └──────────────────┘   └──────────────────┘   └────────┬─────────┘
                                                                              ▼
                       ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
                       │ 7. Host sweep +  │◀──│ 6. Opener        │◀──│ 5. Validate +    │
                       │ branch validate  │   │ (branch on       │   │ upsert           │
                       │                  │   │ confirm)         │   │                  │
                       └──────────────────┘   └──────────────────┘   └──────────────────┘
```

## Phase Details

### Phase 1: Decide the type

A wizard is for **stepped** work: step N needs step N-1's output, and the user advances with one button per step. Route elsewhere when:

- the user wants **side-by-side** panels (available vs selected grids, a live summary over a selection, collapsible sections) → **`dashboard-creator`**;
- it is one screen of inputs with validate-then-confirm → **`form-creator`**;
- it is one selection grid plus a confirm → a dialog dashboard is the better host for new work (shipped single-grid "selection wizards" are legacy).

### Phase 2: Read each callee's contract

For every step, fetch the hosted component (`dxs configuration get <grid|form|editor> <id> -b <branchId>`, extract `.json`) and note its `inParams` and `outParams` verbatim. These become the step's `configParameters` (one entry per inParam, `value: ""` when unbound) and `configOutParameters` (an exact copy of `outParams`; `null` when the callee has none). `configOutParameters` is a **manual redeclaration** — it alone types `$wizard.steps.<id>.outParams`, and any drift fails validate with `Outdated contract. Type mismatch for output parameters`, which names neither the step nor the parameter. Confirm each callee writes its outParams **and** calls `$grid.events.outParamsChange.emit()` / `$form.events.outParamsChange.emit()`; if not, retrofit it via its creator skill. Editor steps have no native outParams channel to the wizard — prefer a grid or form step (see the reference's DOM event bridge, last resort only).

### Phase 3: Steps, navigation, gating

1. Unique snake_case step ids; `contentType` (a string) `grid` / `form` / `editor` matching what `configId` really is — the designer also offers `footprintQueryManager`, which validate accepts but no shipped wizard uses.
2. Set `next` on every non-final step; branch with `nextCondition` (truthy → `next`, falsy → `nextAlt`). **Validate checks neither target** — walk the graph by hand.
3. Gate each step with `nextButtonDisabledCondition` (truthy = disabled), reading `$wizard.steps?.<id>?.outParams?.<x>` or declared `$wizard.vars`. It is the only gating hook; there are no per-step flows.
4. `nextButtonLabel` is plain text; set `"Finish"` / `"Confirm"` on the final step.
5. Leave `repeatOver` as `""` (its runtime behaviour is unverified; see the reference).

All declarative slots are TypeScript expressions ([encoding rule](../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions)) and are type-checked against `IWizard` by validate.

### Phase 4: Lifecycle flows and outParams

- `flows[]` holds embedded `configurationTypeId: 9` flows with no params; `onInitFlowConfig` / `onFinishFlowConfig` reference them by `flowId`.
- Callers that must tell finish from cancel get a `confirm: boolean` outParam: `on_init` sets it `false`, `on_finish` assembles the other outParams then sets it `true`. The final step's button runs `on_finish` and the dialog closes with `$wizard.outParams`.
- Declare every `$wizard.vars.<id>` in `vars[]`.
- To close early (failed init/validation), write `// @ts-ignore` directly above `$wizard.close();` — `IWizard` has no `close()`, so without it validate fails with `Property 'close' does not exist on type 'IWizard'`.

### Phase 5: Validate and upsert

Run `dxs configuration validate wizard`; fix every finding (see the reference's failure table), then `upsert`.

### Phase 6: Wire the opener

The opener is dialog-only and lives under the wizard's own package: `$shell.<Package>.open<referenceName>Dialog(inParams, mode?, size?) → Promise<outParams>` (snake_case preserved; the `inParams` argument disappears when the wizard declares none). Branch on the result: `if (!result?.confirm) { return; }`. The host component's `configParameters` contract follows `component-wiring-check`.

### Phase 7: Shared-callee sweep

If you changed a hosted grid/form's `inParams` or `outParams`, every other host (wizards, hubs, dashboards) is now stale, and a host that isn't on the branch's change list reports `Outdated contract …` **only at `dxs source branch validate`**. Find the hosts with `impact-analysis`, mirror the change into each, and run `dxs source branch validate`.

## Pre-Flight Checklist

Walk the full checklist in [references/wizards.md → Pre-Flight Checklist](references/wizards.md#pre-flight-checklist). The fast version:

1. **File basics.** `configurationTypeId: 13`, suffix `-wizard.json`, `referenceName` ends in `_wizard`, `title` a distinct sentence-case display name — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
2. **Right type** — genuinely stepped; side-by-side or single-picker dialogs go to `dashboard-creator`.
3. **Step graph** — every `next`/`nextAlt` names an existing step; only the final step lacks `next`.
4. **`configParameters`** — one per callee inParam, no extras, callee's `moduleId`.
5. **`configOutParameters`** — exact copy of the callee's `outParams` (`null` if none); hosted components emit `outParamsChange`.
6. **Gates** use `$wizard.steps?.<id>?.outParams?.<x>` and declared vars only.
7. **Hooks** — `flowId`s exist in `flows[]`; `confirm` false in init, true in finish; `// @ts-ignore` above every `$wizard.close()`.
8. **`description`** non-null, non-empty, ≤100 chars; validate before upsert; branch validate after changing a shared callee.

## Common Mistakes

The authoritative symptom → cause → fix table is in [references/wizards.md → Common Failure Modes](references/wizards.md#common-failure-modes). The gotchas that bite most often when authoring:

- **Treating `configOutParameters` as inherited** — it is a hand-kept copy; a callee change makes every wizard host fail `Outdated contract. Type mismatch for output parameters`, often only at branch validate.
- **`$wizard.close()` without `// @ts-ignore`** — fails validate; the typings omit `close()`.
- **Trusting validate on navigation** — dangling or cyclic `next` / `nextAlt` pass validate and break at runtime.
- **A gate that never opens** — the hosted component sets its outParams but never emits `outParamsChange`, or the gate reads an undeclared path.
- **No `confirm` outParam, or a caller that ignores it** — a cancelled wizard looks like an empty success.
- **Building a side-by-side selection as a wizard** — use a dashboard.
- **Upserting the envelope instead of the inner `.json`** — silently destroys config content; `jq .json envelope.json > body.json` first.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
