---
name: action-creator
description: |
  Use when authoring or modifying a Datex Studio action (configurationTypeId=18,
  *-footprintFlow.json suffix) on a branch — server-tier transactional flow for
  CRUD, status updates, and any operation requiring atomicity. Owns the
  action-vs-function decision, the "Transaction must begin first" diagnostic
  (silent-swallow root cause), and the error-handling-is-load-bearing rule
  (transaction propagation). Triggers: "create an action", "write an
  xxx_action", "add a new action", "transactional flow", "CRUD action",
  "server-side action", "Transaction must begin first".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - function-creator
  - datasource-creator
  - component-wiring-check
  - backend-test-creator
  - impact-analysis
  - requirements-gathering
  - post-edit-verification
  - component-validator
---

# Action Creator

Author or modify a Datex Studio action (configurationTypeId=18) on a branch — server-side transactional flows that compose entity CRUD and other actions inside a single commit/rollback boundary. The UI never calls actions directly — a function wraps the action call as the UI → action bridge.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/actions.md](references/actions.md) — Authoritative action authoring reference: file shape, runtime globals, invocation contract, error-handling rules, pre-flight checklist
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and TypeScript-expression encoding rules
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_action` indicator vs `-footprintFlow.json` file suffix (asymmetric naming)
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — platform-injected globals available in action code (`$flow`, `$flows`, `$datasources`, `$api`, ...)
- [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md) — full caller→callee tier matrix (UI cannot call actions directly; actions cannot call functions)
- [../function-creator/references/functions.md](../function-creator/references/functions.md) — the non-transactional counterpart and UI bridge
- [../datasource-creator/references/datasources.md](../datasource-creator/references/datasources.md) — action-tier datasource targets (`-footprintDatasource.json`)
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — caller `configParameters` contracts that apply to action callers

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`function-creator`** skill — invoked when a wrapping UI function (the UI→action bridge) doesn't exist yet, or when the requirement is actually non-transactional (action-vs-function decision tips toward function)
- **`datasource-creator`** skill — invoked when the action needs a `-footprintDatasource.json` (FPDS) that doesn't exist on the branch yet
- **`component-wiring-check`** skill — invoked to audit `configParameters` ↔ target `inParams` contracts on action callers before push
- **`backend-test-creator`** skill — invoked when authoring a mocha test suite to cover the action (the correct alternative to abusing an action as an ad-hoc test harness)
- **`impact-analysis`** skill — invoked when modifying `inParams` / `outParams` of an existing action (signature break detection)

## CLI Lifecycle

Action authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs action` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The type identifier in the CLI is **`footprintflow`** (lowercase, matches `ConfigurationEndpoints.normalize_type` output), not `footprintFlow`.

**Create a new action:**

```bash
# 1. Build body.json from scratch (see references/actions.md → Minimal Valid Skeleton)
# 2. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate footprintflow -b <branchId> -D body.json
# 3. Create
dxs configuration upsert footprintflow -b <branchId> -D body.json
```

**Edit an existing action:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get footprintflow <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard — see "Round-trip rule" below)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI
dxs configuration validate footprintflow -b <branchId> -D body.json
# 5. Push
dxs configuration upsert footprintflow -b <branchId> -D body.json
```

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. The corrected sequence above (extract inner `.json` with `jq` before editing) is mandatory for any round-trip. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

This rule has extra teeth for actions because action JSON carries TWO `code` fields — the runtime field that Datex Studio executes is `nodes[0].stepConfig.executeCodeConfig.code`; the top-level `action['code']` is a denormalized mirror. Writing to one without the other is invisible to grep but breaks the runtime. See [references/actions.md → Pre-Flight Checklist item 5](references/actions.md#pre-flight-checklist).

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
[Phase 2: Action vs Function decision]
Consult references/actions.md → "Purpose & When to Use":
  - transactional / entity CRUD / FPDS access -> action
  - pure read/transform / UI-facing / no atomicity -> function
If function -> invoke `function-creator` instead and stop here.
If action but UI needs to invoke it -> the UI calls a function
that wraps the action; invoke `function-creator` for the wrapper
in addition to authoring this action.
        |
[Phase 3: Author action body]
Build body.json:
  - File shape (configurationTypeId=18, apiSettingName=FootprintApi,
    referenceName ends _action, file suffix -footprintFlow.json)
  - Step graph (ExecuteCodeActivity in nodes[0])
  - inParams/outParams with FULL fat parameter-descriptor boilerplate
  - code string with \r\n line endings inside the JSON
  - Error handling: every try/catch either format-and-rethrows
    or is REMOVED. Bare swallows leave the transaction unresolved
    and surface elsewhere as "Transaction must begin first".
  - $datasources.* targets FPDS only; no $db; no $apis
  - Invoke `datasource-creator` if an FPDS dependency is missing
  - Invoke `component-wiring-check` to audit callers' configParameters
        |
[Phase 4: Validate + push]
dxs configuration validate footprintflow -b <branchId> -D body.json
        |
   +----+----+
   |         |
  CREATE   MODIFY-EXISTING
   |         |
   |         use the corrected round-trip
   |         (get -O envelope -> jq .json -> body)
   |         |
   |         if inParams/outParams changed:
   |           invoke `impact-analysis`
   |         |
   +----+----+
        |
        v
dxs configuration upsert footprintflow -b <branchId> -D body.json
   (upsert creates or updates by referenceName — one command for both)
        |
[Phase 5: Verify in Studio (optional)]
Exercise the action via its wrapping function (or via a
backend-test-creator mocha suite). Watch for delayed
"Transaction must begin first" symptoms in unrelated flows
— that's the silent-swallow signature.
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 1: Setup + Requirements

1. Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for branch and connection selection. **Never assume a branch ID** — ask the user to confirm.
2. Check whether a **requirements brief** already exists in the conversation context (produced by `requirements-gathering` or another calling skill).
   - **Brief exists** — use it. The brief should establish atomicity needs (does the operation need to roll back as a unit?), the entities/datasources touched, and how the action will be invoked (function wrapper, another action, backend test).
   - **No brief** — invoke the `requirements-gathering` skill first. The atomicity question is load-bearing for the next phase's action-vs-function decision.

### Phase 2: Action vs Function decision

Consult [references/actions.md → Purpose & When to Use](references/actions.md#purpose--when-to-use) before authoring. The choice is not stylistic — actions and functions live on different tiers and have non-interchangeable runtime capabilities.

Pick an **action** when:

- The work must be atomic (entity writes that either all commit or all roll back).
- The logic composes other actions or entity CRUD.
- The code needs access to `-footprintDatasource.json` (FPDS) datasources — those are action-tier only.

Pick a **function** instead when:

- The work is a pure read/transform.
- The caller is UI (UI can't reach actions directly — see [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md)).
- No transactional boundary is needed.

If the answer is "function," stop and invoke `function-creator`. If the answer is "action but the UI needs to trigger it," you still need a function — the UI calls the function, the function calls the action via `$apis.<Package>.FootprintApi.extendedActions.<action_name>({ ... })`. Author the action here and invoke `function-creator` for the wrapper.

### Phase 3: Author action body

Build `body.json` from the skeleton in [references/actions.md → Minimal Valid Skeleton](references/actions.md#minimal-valid-skeleton). Key points:

1. **File basics.** `configurationTypeId: 18`. `apiSettingName: "FootprintApi"`. `referenceName` ends in `_action` (e.g. `update_task_status_action`). **Asymmetric naming**: the file suffix is `-footprintFlow.json` (not `-action.json`); the `_action` indicator lives only in `referenceName` — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)). See [references/actions.md → File Location & Naming](references/actions.md#file-location--naming) and [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md).

2. **`inParams` / `outParams` boilerplate.** Every entry uses the full fat parameter-descriptor — 14 fields, no shortcuts. Missing fields are a common import reject. See the [Minimal Valid Skeleton](references/actions.md#minimal-valid-skeleton) for the exact shape.

3. **The `code` string.** Step graph is typically a single `ExecuteCodeActivity` in `nodes[0]`. Inside the JSON, line endings are escaped as `\\r\\n` (decode to `\r\n`). Prefer Python `json.load`/`json.dump` over raw string replacement when editing the embedded code.

4. **Action JSON has TWO `code` fields; only the nested one runs.** The runtime field is `nodes[0].stepConfig.executeCodeConfig.code`. The top-level `action['code']` is a denormalized mirror — writing to it alone is invisible to the runtime, but the file still looks correct to `json.load` and grep. When repacking, write to BOTH fields and assert they match. See [references/actions.md → Pre-Flight Checklist item 5](references/actions.md#pre-flight-checklist).

5. **Error handling is load-bearing.** Actions run inside a transaction. **A silently swallowed error leaves the transaction unresolved**, and the next unrelated action invocation surfaces the misleading `"Transaction must begin first"`. This is the single most common action bug.

   The rule:
   - **Don't catch unless the catch adds value.** A `try/catch` that only swallows or bare-rethrows is strictly worse than no `try/catch` — delete it and let the exception propagate.
   - **When you do catch, format-and-rethrow.** Catch only to enrich the message with what was being attempted and which key/id was involved, then `throw new Error(...)`.

   ```ts
   // Good — enriches with context and rethrows
   try {
     await $flows.Utilities.crud_update_entity({ entity: 'Tasks', keys, properties });
   } catch (e) {
     throw new Error(`Failed to update task ${keys[0].value}: ${e.message}`);
   }

   // Bad — swallows; transaction never closes; next action throws "Transaction must begin first"
   try { await $flows.Utilities.crud_update_entity(...); } catch (e) { /* nothing */ }

   // Bad — pointless rewrap; just delete the try/catch
   try { await $flows.Utilities.crud_update_entity(...); } catch (e) { throw e; }
   ```

   When diagnosing a `"Transaction must begin first"` error, **the bug is almost never in the action that threw it** — it's in a prior action that swallowed an error on a different code path. Enumerate the feature's actions on the branch (via `impact-analysis` / `dxs source explore`) and inspect each for bare `catch` blocks as the first diagnostic step.

6. **Tier compliance inside the `code` string.** `$flows.<Package>.<action_name>` to call another action. `$datasources.<Package>.<name>.get({...})` only against FPDS (`-footprintDatasource.json`) — calling a `-datasource.json` from an action is a cross-tier violation. `$db` is **not** available in actions (function-tier only). `$apis` is rarely used from actions (that's the function→action direction). See [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) and [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md).

7. **If an FPDS dependency is missing**, invoke `datasource-creator` to add it before pushing the action.

8. **Caller contract audit.** Every caller of this action must declare a full `configParameters` contract — every inParam this action declares gets an entry on the caller, including unused ones with `value: null`. Invoke `component-wiring-check` to audit reference contracts before push. See [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md).

### Phase 4: Validate + push

```bash
# Validate the body locally against the branch. Exit 1 = validation found errors
# (read validation_errors, fix body.json, re-run) — not a broken CLI. Do not push on exit 1.
dxs configuration validate footprintflow -b <branchId> -D body.json

# For a new action
dxs configuration upsert footprintflow -b <branchId> -D body.json

# For modify-existing (round-trip — never skip the jq extract)
dxs configuration get footprintflow <configId> -b <branchId> -O envelope.json
jq .json envelope.json > body.json
# ... edit body.json ...
dxs configuration upsert footprintflow -b <branchId> -D body.json
```

If `inParams` / `outParams` are changing on an existing action, invoke the `impact-analysis` skill before push to surface every caller; reconcile each one (functions, other actions, backend tests) in the same edit pass or get explicit user approval for a breaking change.

Validation surfaces missing required fields, malformed parameter-descriptor shapes, and reference errors before push. It does **not** catch the silent-swallow / `"Transaction must begin first"` class — that's behavioral and only surfaces at runtime. Walk the [references/actions.md → Pre-Flight Checklist](references/actions.md#pre-flight-checklist) before push, the no-silent-swallow `try/catch` item especially.

### Phase 5: Verify in Studio (optional)

Exercise the action through its normal invocation path:

- **Via a wrapping function** (UI bridge) — open the screen that triggers the function and confirm the action commits / rolls back as designed.
- **Via another action** — call from the orchestrating action's flow and verify the composite transaction succeeds or rolls back atomically.
- **Via a mocha suite** — author one with `backend-test-creator`. This is the correct alternative to abusing an action as an ad-hoc test harness.

Watch downstream flows for **delayed `"Transaction must begin first"`** symptoms in unrelated places — that's the silent-swallow signature. If you see it, return to Phase 3 step 5 and audit `try/catch` blocks in the action you just edited (and any actions it composes).

If the running app isn't available, re-fetch the config (using the corrected `jq .json` extract pattern) and diff against `body.json` to confirm the push landed.

## Pre-Flight Checklist

Before push, walk the full checklist in [references/actions.md → Pre-Flight Checklist](references/actions.md#pre-flight-checklist). The fast version:

1. **Asymmetric naming.** File suffix is `-footprintFlow.json`. `referenceName` ends `_action`. They diverge — don't normalize them.
2. **Top-level constants.** `configurationTypeId: 18`, `apiSettingName: "FootprintApi"`, `description` non-empty ≤ 100 chars, `accessModifier` set.
3. **Every `inParams`/`outParams` entry uses the full fat parameter-descriptor boilerplate** — 14 fields, no shortcuts.
4. **`code` line endings are `\r\n`** inside the decoded string (JSON layer escapes to `\\r\\n`).
5. **Both `code` fields written and matching** — top-level mirror and `nodes[0].stepConfig.executeCodeConfig.code` must agree; only the nested one runs.
6. **All `$datasources.*` calls target FPDS** (`-footprintDatasource.json`). No `$db.*` (function-tier only).
7. **Every `try/catch` either format-and-rethrows or is removed.** No silent swallows, no bare `throw e`. This is the single most important rule.
8. **Callers declare a full `configParameters` contract** — every inParam this action declares gets an entry on the caller, including unused ones with `value: null`. Audit via `component-wiring-check`.

## Common Mistakes

| Mistake | Fix |
|---|---|
| `try/catch` that swallows the error or bare-rethrows | Delete the block. The transaction stays open; next unrelated action throws `"Transaction must begin first"`. Catch only to format-and-rethrow with context. |
| Diagnosing `"Transaction must begin first"` by reading the action that threw it | The bug is almost always upstream — a prior action swallowed on a different code path. Use `impact-analysis` to enumerate the feature's actions on the branch, then inspect each for bare `catch` blocks. |
| File named `*-action.json` instead of `*-footprintFlow.json` | Asymmetric naming: the `_action` indicator is in `referenceName` only; the file suffix stays `-footprintFlow.json`. |
| Calling a `-datasource.json` from action code via `$datasources` | Cross-tier violation. Action-tier only sees `-footprintDatasource.json` (FPDS). Use `datasource-creator` to add an FPDS variant if needed. |
| Calling `$db.*` from action code | `$db` is function-tier only. Move the read into a function and call the function from the wrapping function instead. |
| Writing only the top-level `action['code']` mirror without updating `nodes[0].stepConfig.executeCodeConfig.code` | Invisible to the runtime — the runtime executes the nested field. Write both; assert they match. |
| UI flow trying to call an action directly | UI cannot call actions. Author a function that wraps the action and have the UI call the function. Invoke `function-creator` for the wrapper. |
| Piping `dxs configuration get -O envelope.json` directly into `dxs configuration upsert -D envelope.json` | Silently destroys config content. Always `jq .json envelope.json > body.json` before editing. See "Round-trip rule" above. |
| Shortcut `inParams`/`outParams` descriptors (omitting `objectTypeDef`, `isCollection`, etc.) | Import reject — the parameter-descriptor boilerplate is 14 fields and unforgiving. Use the full shape from the skeleton. |
| `description` exceeds 100 chars | SQL column limit — push will fail validation. Tighten. |
| Changing `inParams`/`outParams` on an existing action without checking callers | Breaks every caller silently or noisily. Invoke `impact-analysis` first; reconcile callers in the same edit. |

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
