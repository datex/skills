---
name: component-validator
description: |
  Use when auditing a Datex Studio component file before merge — final gate
  after authoring or modifying any component (action, function, grid, hub,
  form, editor, selector, storage, customType, backendTest, datasource).
  Generic dispatcher: reads the component file, picks the matching creator
  skill's rule set by file suffix, and runs the audit per those rules.
  Output is a structured punch-list (Blockers / Warnings / Nits). Triggers:
  "audit a component", "check it before merge", "final gate after authoring
  or modifying". For grid-specific gotchas (envelope shape, text-display
  coercion) use grid-validator instead.
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - action-creator
  - backend-test-creator
  - editor-creator
  - form-creator
  - grid-creator
  - hub-creator
  - selector-creator
  - storage-creator
  - tailoring-overlay
  - type-definition-creator
  - function-creator
  - datasource-creator
  - custom-angular-component-creator
  - component-wiring-check
---

# Component Validator

Audit a single Datex Studio component file against its type-specific authoring rules — the final read-only gate after a creator skill has finished writing or modifying a component, and before the change is upserted to the branch. This skill is a **generic dispatcher**: it reads the component file, picks the matching creator skill's reference document by file suffix, and runs the checklist from that document. It returns a structured punch-list (Blockers / Warnings / Nits) — never a rewrite.

> **See also:** `grid-validator` — grid files (`*-grid.json`) carry several gotchas the generic dispatcher does not catch (envelope-vs-body shape, text-display coercion, five-location invariant). For grids, prefer `grid-validator` and treat this skill as a fall-back if `grid-validator` is unavailable.
>
> **See also:** `component-wiring-check` — cross-component reference contracts (one component pointing at another). This validator only audits a single file in isolation; it flags obvious wiring drift it can see in that one file (e.g. a `configParameters` block that does not mirror the file's own `inParams`) but does not chase external references.
>
> **CAC note:** a Custom Angular Component (`configurationTypeId: 36`, a `dxs ng` working folder — `manifest.json` + `app.<ref>.component.ts` with `//#region __COMPONENT_TYPES__`/`__COMPONENT_BODY__`) is not a single-file JSON body, so this skill's suffix dispatch doesn't apply. Audit it per `custom-angular-component-creator`'s own Pre-Flight Checklist instead.

## References

- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table, single-line minified JSON rule, TypeScript-expression encoding
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — Suffix table, `referenceName` ↔ file-stem rule, snake_case vs camelCase guidance
- [../datex-studio-conventions/defaults.md](../datex-studio-conventions/defaults.md) — Default `accessModifier`, `description` length cap, default package rules
- Creator-skill reference documents (the rulebook this validator dispatches into; see suffix table in the Sub-agent block below)

## Dependencies

- **Creator skills** (`action-creator`, `function-creator`, `grid-creator`, `hub-creator`, `form-creator`, `editor-creator`, `selector-creator`, `storage-creator`, `type-definition-creator`, `backend-test-creator`, `datasource-creator`) — each one's `references/<type>.md` document is the rulebook this validator dispatches into by file suffix. Update them and this validator picks up the new rules automatically.
- **`custom-angular-component-creator`** skill — CAC (`configurationTypeId: 36`) working folders don't dispatch by suffix (see the CAC row in the Sub-agent table below); this validator instead points at that skill's own Pre-Flight Checklist as the rulebook.
- **`datex-studio-conventions`** skill — generic cross-cutting rules (file format, naming, defaults) that apply to **every** component regardless of suffix.
- **`datex-studio-shared`** / **`datex-studio-runtime`** skills — branch-setup primitives and platform-runtime globals referenced by the per-type rule docs.
- **`tailoring-overlay`** skill — overlay-specific shadow-marker rules invoked when the file is a tailored overlay variant rather than a base component.
- **`component-wiring-check`** skill — cross-component audit invoked when the punch-list surfaces wiring drift the parent wants to chase further.

## Workflow

This skill is typically invoked by a creator skill at the end of its authoring loop, or by the user directly with "audit this file before merge". The invocation pattern is a Task-tool sub-agent dispatch — give the prompt template in the `## Sub-agent` section below to the sub-agent along with the target file path.

### Invocation (orchestrator side)

1. **Identify the target body** — the component the parent has just authored or modified. The branch is the source of truth, so the target is one of: (a) the staged scratch `body.json` the creator skill is about to `dxs configuration upsert` (audit it pre-push), or (b) a fresh fetch from the branch — `dxs source explore config <referenceName> --branch <id>`, or `dxs configuration get <type> <id> -b <id> -O envelope.json && jq .json envelope.json > body.json`. Never audit a persistent local `src/` copy as if it were authoritative. Pass the sub-agent the path to that single scratch/fetched JSON file.
2. **Dispatch the sub-agent** — use the Task tool with the prompt template from the `## Sub-agent` section. The sub-agent has `Read`, `Grep`, `Glob` access; it does not edit.
3. **Apply the punch-list** — the sub-agent returns a markdown punch-list grouped by severity. Treat each finding as follows:
   - **Blockers** — must be fixed before upserting. Route the fix back to the matching creator skill.
   - **Warnings** — review and decide. May be deliberate; the sub-agent never assumes intent.
   - **Nits** — optional cleanup. Defer unless the parent is already touching that area.
4. **Re-validate after fixes** — if Blockers were fixed, run the validator again. The validator is cheap (one Read + one Grep through the rule doc) and should be the last step before the push.

### Scope discipline (validator's contract)

- The validator **reads**; it does not edit. The parent owns the fix.
- The validator returns a **punch-list**; it does not return a rewrite.
- The validator audits **one file**; it does not chase cross-component references (that is `component-wiring-check`'s territory).
- The validator does not load raw OData schema documents. If the file is a datasource that needs entity / property validation against the live schema, the validator recommends the parent invoke `schema-explorer` separately.
- The validator does not speculate about intent. If a rule violation could be deliberate, it is flagged as a Warning with a note, not as a Blocker.

## Sub-agent

The prompt template below is what the orchestrator passes to the Task-tool sub-agent dispatch. The sub-agent is read-only (`Read`, `Grep`, `Glob`).

---

You validate a single Datex Studio component file against its type's authoring rules. You do not edit files. You return a punch list.

### Workflow

1. **Identify the component type from the file's suffix and load the matching rule document.** The creator skill's `references/<type>.md` is the primary source; the cross-cutting conventions docs are always also in scope.

   | Suffix | Primary rule source (creator skill) |
   |---|---|
   | `*-footprintFlow.json` (action) | `../action-creator/references/actions.md` |
   | `*-flow.json` (function) | `../function-creator/references/functions.md` |
   | `*-grid.json` | **Use `grid-validator` instead** — it carries grid-specific gotchas this generic dispatcher does not. Fall back to `../grid-creator/references/grids.md` only if `grid-validator` is unavailable. |
   | `*-form.json` | `../form-creator/references/forms.md` |
   | `*-editor.json` | `../editor-creator/references/editors.md` |
   | `*-hub.json` | `../hub-creator/references/hubs.md` |
   | `*-storage.json` | `../storage-creator/references/storage.md` |
   | `*-selector.json` | `../selector-creator/references/selectors.md` |
   | `*-customType.json` | `../type-definition-creator/references/type-definitions.md` |
   | `*-backendTest.json` | `../backend-test-creator/references/backend-tests.md` |
   | `*-datasource.json` | `../datasource-creator/references/odata-datasources.md` (and `flow-datasources.md` if the body shape is flow-backed) |
   | `*-footprintDatasource.json` | `../datasource-creator/references/odata-datasources.md`, `../datasource-creator/references/flow-datasources.md` |
   | CAC working folder (`manifest.json` + `app.<ref>.component.ts` with `//#region __COMPONENT_TYPES__`/`__COMPONENT_BODY__`), `configurationTypeId: 36` | This file-suffix dispatch does not apply — a CAC is not a single JSON body. Audit per `../custom-angular-component-creator/SKILL.md`'s Pre-Flight Checklist and `../custom-angular-component-creator/references/custom-angular-components.md` instead of a suffix-matched rule doc. |

   If the suffix does not match anything in the table, reply `Cannot validate: unknown component suffix '<suffix>'. Supported: <list>.` and stop. If the file is recognized as a tailored overlay, also load `../tailoring-overlay/` rules.

2. **Read the target body in full.** Single file, one `Read`. This is the scratch JSON the parent staged for upsert (or just fetched from the branch with `jq .json`) — a throwaway temp file, not a persistent source-of-truth copy. The minified JSON envelope is the surface you will audit against the checklist.

3. **Read the matching rule document's Pre-Flight Checklist section.** That is your rulebook. Do not re-derive rules from memory — apply what is documented.

4. **Walk the checklist item-by-item.** For each issue, record:
   - **Severity** — `blocker` (silent runtime failure, import error, clear rule violation), `warning` (drift or inconsistency that may or may not bite), `nit` (style / naming / optional cleanup).
   - **Rule** — which checklist item it maps to.
   - **Location** — `<filename>:<line>` or JSON path (e.g. `inParams[0].objectTypeDef`).
   - **Evidence** — short quote or description.

5. **Always probe the universal cross-cutting failure modes** even if the type-specific checklist does not restate them. These are enumerated once in [`../datex-studio-conventions/universal-checklist.md`](../datex-studio-conventions/universal-checklist.md) — walk that list (description ≤ 100 chars, `accessModifier` set, `referenceName` ↔ stem, single-line minified JSON, correct `configurationTypeId`, snake_case new `inParams`/`outParams` ids, `id: 0` if net-new). For tailored overlay files, the shadow-marker rules in `../tailoring-overlay/` apply on top.

6. **Report.** Return a short markdown punch list grouped by severity, each item one or two lines. No preamble, no rewrites, no code suggestions beyond one-line pointers. If nothing is wrong, say `No issues found.`

### Scope Discipline

- You read. You do not edit.
- You return a punch list. You do not rewrite.
- You do not chase cross-component references — that is `component-wiring-check`'s territory. If a wiring issue is obvious from the single file (e.g. a `configParameters` block that does not match the file's own `inParams`), flag it as a warning and let the parent decide whether to delegate further.
- You do not load raw OData schema documents. If the component is a datasource that needs entity / property validation, recommend the parent invoke the `schema-explorer` skill separately.
- You do not speculate about intent. If a rule violation could be deliberate, flag as a warning with a note rather than a blocker.

### Output Format

```
## Blockers
- [`description`] is `null` (defaults.md requires non-empty).
- [`inParams[3].objectType`] references `Allocations.i_unknown_type` — type file not present in the package.

## Warnings
- [`outParams[0].id` = "alertList"] camelCase; new params should be snake_case.

## Nits
- [`title`] equals `referenceName`; a human-readable title is more discoverable in Datex Studio listings.
```

Omit any bucket that is empty. If all three buckets are empty, return `No issues found.`

## Bundled Save-Gate Hook (optional)

`scripts/validate-component.py` is a Claude Code PostToolUse hook enforcing the two cheapest floor checks (valid JSON, description present and ≤100 chars) at the harness level, blocking bad saves before any skill runs. Install per [`scripts/INSTALL.md`](scripts/INSTALL.md). The hook is a floor, not a replacement for this skill's audit.
