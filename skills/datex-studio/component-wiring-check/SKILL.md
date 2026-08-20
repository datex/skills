---
name: component-wiring-check
description: |
  Use when auditing cross-component reference contracts on a Datex Studio
  branch — verify that hubs, grids, forms, editors, selectors, and their
  referenced peers wire together correctly. Catalogs three silent-failure
  traps: wrong Module/moduleId, mismatched configParameters (missing
  declared inParam, extra unsupported entry, value-binding to undeclared
  var), and component variables used in flow code but undeclared in the
  top-level vars array. Triggers: "wire xxx into yyy", "audit the
  reference contracts", "fix the Module / moduleId", "fix the
  configParameters mismatch", "declare a hub/form/editor/grid var",
  silent-failure dropdowns/filters/dialogs.
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - tailoring-overlay
  - grid-creator
  - hub-creator
  - form-creator
  - editor-creator
  - selector-creator
  - post-edit-verification
  - component-validator
---

# Component Wiring Check

Audit cross-component reference contracts on a Datex Studio branch — verify that one component's reference to another (a hub tab mounting a grid, a hub filter pointing at a selector, a grid's `datasourceConfig` pointing at a datasource, a selector backed by a datasource, a form opened via `$shell.<Package>.open<referenceName>Dialog`) is contract-complete. This is a **read-only audit skill**: it reads configs, reports findings, and routes fixes to the matching creator skill. It never mutates configs on the branch.

> **See also:** the creator skills (`hub-creator`, `grid-creator`, `form-creator`, `editor-creator`, `selector-creator`) — each owns the round-trip + push step for fixes the audit surfaces.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/component-wiring.md](references/component-wiring.md) — Authoritative wiring-rule reference: the three silent-failure traps, `moduleId` rule, `configParameters` ↔ `inParams` mirror, `vars` / `rowVars` declaration rule
- [../datex-studio-conventions/defaults.md](../datex-studio-conventions/defaults.md) — Default package for *new* components (not for references to existing ones — important not to confuse the two)
- [../tailoring-overlay/](../tailoring-overlay/) — Overlay-specific shadow-marker rules (the "outdated contract at import" symptom is a separate tailoring concern)

## Dependencies

- **`grid-creator`** / **`hub-creator`** / **`form-creator`** / **`editor-creator`** / **`selector-creator`** skills — invoked downstream when this audit surfaces a fix to apply (this skill reports findings; the creator skill carries the round-trip + push)
- **`tailoring-overlay`** skill — invoked when the symptom is "outdated contract" on a tailored overlay rather than a wiring drift on the base component
- **`post-edit-verification`** / **`component-validator`** skills — invoked after fixes land, by the creator skill that applied them (not by this audit directly)

## CLI Lifecycle

Component-wiring audits are **read-only** — they fetch configs and inspect contracts, but they never push changes. There is no `dxs componentwiringcheck` subcommand; the audit uses the generic `dxs configuration get` / `list` primitives to pull the components it needs to compare.

**Fetch a single component for inspection:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get <type> <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (same envelope-vs-body distinction as the creator skills)
jq .json envelope.json > body.json
# 3. Inspect — read inParams, configParameters, moduleId, vars, rowVars
```

**Discover candidates on the branch:**

```bash
# List configs of a given type — filter to the components you want to audit
dxs configuration list <type> -b <branchId>
```

Fixes the audit surfaces are applied by the matching creator skill (`hub-creator`, `grid-creator`, etc.), which owns the round-trip rule (`get -O envelope.json` → `jq .json` → edit → `upsert`). This skill does not call `dxs configuration upsert` — if you find yourself reaching for it, hand off to the creator skill instead.

## Workflow

```
[Phase 1: Setup + target components]
Follow branch-setup.md for branch/connection selection
        |
Identify the reference under audit:
  - referencing component (the caller — hub, grid, form, ...)
  - target component (the callee — grid, selector, datasource, form, ...)
  - the reference site (hub filter, hub tab, grid datasourceConfig,
    selector datasource, dialog opener)
        |
[Phase 2: Audit reference contracts]
Walk the three silent-failure traps (see references/component-wiring.md):
  1. moduleId matches the target's package?
  2. configParameters mirrors target inParams one-to-one
     (no missing, no extras)?
  3. vars / rowVars declares every $<component>.vars.<id> /
     $row.vars.<id> used in flow code?
Cross-check tailored overlays separately (see tailoring-overlay)
        |
[Phase 3: Report findings]
For each trap that fires, surface:
  - what's broken (target id / inParam / var)
  - which component file owns the fix (caller vs callee)
  - which creator skill applies it
NO `dxs configuration upsert` from this skill — defer to the
creator skill that owns the component being edited
        |
[Phase 4: Re-audit (optional, after fixes land)]
Re-fetch the same configs and walk the three traps again.
Clean run = no findings.
```

## Phase Details

### Phase 1: Setup + target components

1. Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for branch and connection selection. **Never assume a branch ID** — ask the user to confirm.
2. **Identify the reference site.** A wiring audit is always about a specific pair (or chain) of components. Establish:
   - **Referencing component** (the caller): the hub that mounts a grid, the grid whose `datasourceConfig` points at a datasource, the selector whose datasource backs the dropdown, the action that opens a form via `$shell.<Package>.open<referenceName>Dialog(...)`.
   - **Target component** (the callee): the grid, selector, datasource, form, or editor on the receiving end of the reference.
   - **Reference site**: hub filter (→ selector), hub tab `contentConfig` (→ grid or other component), grid `datasourceConfig` (→ datasource), selector `datasourceConfig` (→ datasource), action-tier dialog opener (→ form/editor).
3. **Fetch both components** with `dxs configuration get <type> <configId> -b <branchId> -O envelope.json` and extract `body.json` via `jq .json` for each. The audit reads the bodies; no edits flow from this skill.

### Phase 2: Audit reference contracts

Walk the three traps in order. Each is fully specified in [references/component-wiring.md](references/component-wiring.md); the summary below is the audit checklist.

1. **`moduleId` matches the target's package.** On every reference site, the `moduleId` field is the package the **target** lives in — not the caller's package, not the feature folder name. Open the target component file's package declaration directly (or ask the user if it isn't obvious). Do not infer from feature folder names or from the `Utilities` default for new components — that default applies to *new* components, not to references to existing ones. See [references/component-wiring.md → Cross-Component References Use the Target's Module](references/component-wiring.md#cross-component-references-use-the-targets-module).

2. **`configParameters` mirrors target `inParams` one-to-one.** Diff the two arrays:
   - **For each entry in the target's `inParams`**, confirm `configParameters` on the reference has a matching entry (same `id` / `type` / `isCollection`). Unused params stay in the contract with explicit `value: null` / `""`. Missing entries silently surface as undefined inputs at runtime — empty dropdowns, misfiltered lists.
   - **For each entry in `configParameters`**, confirm the target's `inParams` declares that `id`. Extra entries are **dead wiring** — the value is silently dropped, the caller thinks data is flowing through, the target never sees it. This is the more dangerous direction. The rule applies regardless of `required: true/false` on the target inParam.

   When the target's shape doesn't match what the caller needs (e.g. a hub wants to scope a grid by `project_ids` but the grid doesn't declare that inParam yet), **extend the target** rather than adding phantom entries to the caller. See [references/component-wiring.md → Reference Contracts Include Every Target inParam](references/component-wiring.md#reference-contracts-include-every-target-inparam).

3. **Vars / rowVars declared.** For each `$<component>.vars.<id>` (`$form.vars`, `$hub.vars`, `$editor.vars`, `$grid.vars`) read or written in flow code, confirm a matching entry exists in the component's top-level `vars[]` array. For grids, additionally confirm every `$row.vars.<id>` used inside row flows (`on_save_new_row`, `on_save_existing_row`, etc.) has a matching entry in the grid's `rowVars[]`. Both arrays use the inParam-shaped descriptor. See [references/component-wiring.md → Component Variables Must Be Declared](references/component-wiring.md#component-variables-must-be-declared).

4. **Tailored overlays are a separate concern.** If the symptom is "outdated contract at import" rather than runtime drift, the cause is shadow-marker drift on a tailored overlay, not a wiring drift on the base component. Hand off to the `tailoring-overlay` skill.

### Phase 3: Report findings

For each trap that fires, write up a finding that pairs the broken contract with the fix-owner:

| Trap | What to report | Fix-owner skill |
|---|---|---|
| `moduleId` mismatch | Caller component + reference site + observed `moduleId` + target's actual package | The creator skill for the caller (the *reference* lives on the caller side) |
| Missing `configParameters` entry | Caller component + reference site + target inParam id missing from the mirror | The creator skill for the caller |
| Extra `configParameters` entry | Caller component + reference site + extra id + decision: drop the entry on the caller, or extend the target's `inParams` | If dropping: creator skill for the caller. If extending: creator skill for the target. |
| Undeclared `vars` / `rowVars` | Component + var id observed in flow code + missing declaration in `vars[]` / `rowVars[]` | The creator skill for the component that owns the flow code |

**This skill does not push fixes.** Surface the findings, point at the creator skill that owns each fix, and stop. The creator skill carries the round-trip rule (`dxs configuration get -O envelope.json` → `jq .json envelope.json > body.json` → edit → `dxs configuration upsert`); applying fixes from inside the audit skill bypasses that contract and risks silently destroying configuration content.

### Phase 4: Re-audit (optional)

After fixes land, re-fetch the same components (`dxs configuration get <type> <configId> -b <branchId> -O envelope.json`, extract via `jq .json`) and walk the three traps a second time. A clean run = no findings. Re-audit is cheap; do it whenever a fix touches more than one component file or when the original audit surfaced more than two findings — drift can recur in the same edit if the caller and target weren't updated atomically.

## Silent-Failure Symptoms — Diagnostic Index

When a user reports a symptom rather than a known broken contract, this table maps the symptom back to the trap to audit first. See [references/component-wiring.md](references/component-wiring.md) for the underlying mechanics.

| Symptom | Likely cause |
|---|---|
| Dropdown is empty | Selector's backing datasource got an undefined input (missing `configParameters` entry at the mount site) |
| Dropdown shows the wrong options | Selector got wrong value for a real inParam (binding expression wrong, or extra `configParameters` entry shadowing the real one) |
| Grid filter doesn't filter | Hub filter value isn't reaching the grid (extra `configParameters` entry; grid doesn't declare the inParam) |
| Hub filter doesn't propagate into a tab | Either tab `configParameters` is missing the entry or the grid is missing the inParam |
| Dialog won't open | `$shell.<Package>.open<referenceName>Dialog` uses the wrong package (not the target form's package) |
| Component resolves but behaves oddly | `moduleId` on the reference is wrong |
| Var is undefined in flow code | Missing declaration in top-level `vars[]` (or `rowVars[]` for grid row flows) |
| "Outdated contract" at import | Tailored overlay shadow has drifted from its base — hand off to `tailoring-overlay` |

## Pre-Flight Checklist

Walk this when auditing a cross-component reference. The full checklist lives in [references/component-wiring.md](references/component-wiring.md); the fast version:

1. **`moduleId` matches the target's package** — confirmed by reading the target component file or asking the user. Not inferred from the feature folder or the `Utilities` new-component default.
2. **`configParameters` is a one-to-one match against the target's `inParams`** — every inParam has an entry (unused ones with `value: null` / `""`); no extra entries.
3. **If the target is out of sync with what the caller needs**, the fix extends the target in the same edit rather than adding phantom entries to the caller. The caller's `configParameters` must only ever describe what the target actually accepts.
4. **Every `$<component>.vars.<id>`** written in flow code is declared in the component's top-level `vars[]` array.
5. **Grid `rowVars[]`** declares every `$row.vars.<id>` read or written by row flows.
6. **Dialog openers use the target form's package** — `$shell.<TargetPackage>.open<referenceName>Dialog(...)`, with `<referenceName>` in snake_case (no camelCasing).

## Common Mistakes

| Mistake | Fix |
|---|---|
| `moduleId` set to the caller's package instead of the target's | Read the target component file's package declaration directly, or ask the user. Not the feature folder. Not the `Utilities` default. |
| `moduleId` inferred from a feature folder name | Feature folders mix packages — a hub in `FootprintManager` can sit alongside a selector in `Carriers`. Package is a per-component property, not a folder property. |
| Tab `configParameters` binds an id the grid doesn't declare as an inParam | Dead wiring — silently dropped at runtime. Either drop the binding, or extend the grid's `inParams` (and underlying datasource) in the same edit via `grid-creator`. |
| Caller `configParameters` missing an entry for an inParam the target declares | Target resolves an undefined input silently — empty dropdown / misfiltered list. Add the entry; use `value: null` / `""` if the caller doesn't intend to bind it. |
| Writing `$form.vars.<id> = ...` (or `$hub.vars.*` / `$editor.vars.*` / `$grid.vars.*`) without declaring `<id>` in top-level `vars[]` | Var off the typed surface — imports don't enforce its shape, downstream code can't rely on it. Declare every var. |
| Writing `$row.vars.<id>` in a grid row flow without declaring `<id>` in `rowVars[]` | Same trap, row-scoped variant. Declare in `rowVars[]` (same descriptor shape as `vars[]`). |
| Dialog opener uses the caller's package instead of the target form's | `$shell.<Package>.open<referenceName>Dialog(...)` — `<Package>` is the form's package, `<referenceName>` is snake_case. |
| Applying a fix from inside this audit skill instead of the matching creator skill | This skill is read-only — it audits, it doesn't mutate. Route fixes to `hub-creator` / `grid-creator` / `form-creator` / `editor-creator` / `selector-creator`. Those skills own the round-trip rule for safe push. |
| Confusing "outdated contract at import" with a wiring drift | That symptom is a tailored-overlay shadow-marker drift, not a runtime wiring trap. Hand off to `tailoring-overlay`. |

**After your audit produces findings, route each finding to the matching creator skill (`grid-creator`, `hub-creator`, etc.) to apply the fix. Re-invoke this skill after fixes land for a clean-run verification.**
