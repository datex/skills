---
name: backend-test-creator
description: |
  Use when authoring or modifying a Datex Studio backend test
  (configurationTypeId=24, *-backendTest.json suffix) on a branch — mocha
  test suite with four hook flows (before_suite/after_suite/before_each/
  after_each) and a testCaseFlows array. Owns the action-as-test refactor
  pattern and the missing runtime-mock seam as Platform TODO. Triggers:
  "create a backend test", "create an xxx_test", "add a test suite",
  "mocha test suite", "add a test case to xxx_test", "modify a backend
  test", "refactor xxx_action into a backend test", "backend test won't
  run", "before_suite never fires", "suite hooks not firing".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - action-creator
  - type-definition-creator
  - db-query
  - impact-analysis
  - requirements-gathering
  - post-edit-verification
  - component-validator
---

# Backend-Test Creator

Author or modify a Datex Studio backend test (configurationTypeId=24) on a branch — a mocha test suite with four lifecycle hooks (`before_suite` / `after_suite` / `before_each` / `after_each`), a `testCaseFlows[]` array (each entry wrapped as one mocha `it()`), and suite-level state on the `$test` runtime global. Backend tests run at the function tier; actions are reached through the `FootprintApi.extendedActions` bridge.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/backend-tests.md](references/backend-tests.md) — Authoritative backend-test reference: file shape, hook semantics, runtime globals, mocking-strategy tiers, Platform TODOs
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table, `-backendTest.json` suffix, single-line-minified-JSON convention, `\r\n` editing rule
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_test` suffix, filename stem matching, `referenceName` == `title` rule
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — function-tier globals (`$test`, `$flows`, `$apis`, `$datasources`, ...) available inside hook and test-case code strings — **but NOT `$db`** (see tier-compliance rule below)
- [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md) — function-tier calling matrix; the `FootprintApi.extendedActions` bridge for invoking actions
- [../action-creator/references/actions.md](../action-creator/references/actions.md) — the action component; backend-tests replace the historical action-as-test anti-pattern
- [../type-definition-creator/references/type-definitions.md](../type-definition-creator/references/type-definitions.md) — property-descriptor baseline shared with `vars[]` entries
- [../db-query/references/db.md](../db-query/references/db.md) — `$db` predicates and patches for the **function-tier test-support shim** a suite calls for raw storage fixtures (`$db` itself does not resolve inside test-case code)

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`action-creator`** / **`function-creator`** skills — invoked when the flow-under-test or a test-only wrapper flow doesn't exist yet on the branch
- **`type-definition-creator`** skill — invoked when a `vars[]` entry references an interface or union that isn't on the branch yet
- **`impact-analysis`** skill — invoked when refactoring an action-as-test out of an action (delete the action only after confirming nothing else calls it) or when modifying a test-only wrapper's signature

## CLI Lifecycle

Backend-test authoring goes through `dxs configuration` — the generic CRUD primitive over every platform configuration type. There is no `dxs backendtest` subcommand and no field-level patching; you build (or fetch + extract) the whole JSON body, edit it, and push the whole thing back. The type identifier in the CLI is **`backendtest`** (lowercase, matches `ConfigurationEndpoints.normalize_type` output), not `backendTest`.

**Create a new backend test:**

```bash
# 1. Build body.json from scratch (see references/backend-tests.md → Minimal Valid Skeleton)
# 2. Validate (recommended)
dxs configuration validate backendtest -b <branchId> -D body.json
# 3. Create
dxs configuration upsert backendtest -b <branchId> -D body.json
```

**Edit an existing backend test:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get backendtest <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard — see "Round-trip rule" below)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate (recommended)
dxs configuration validate backendtest -b <branchId> -D body.json
# 5. Push
dxs configuration upsert backendtest -b <branchId> -D body.json
```

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. The corrected sequence above (extract inner `.json` with `jq` before editing) is mandatory for any round-trip. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md) for the canonical round-trip and the underlying bug.

Backend-test JSON is **single-line minified** (same convention as `-customType.json`) — don't pretty-print on push. If you pretty-print locally for editing, re-minify before `dxs configuration upsert`. Inside the `code` strings, line endings are `\r\n` (escaped to `\\r\\n` in the JSON layer); prefer Python `json.load` / `json.dump` over raw string substitution when editing the embedded code.

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
[Phase 2: Decide test scope]
Consult references/backend-tests.md → "Purpose & When to Use"
and "Test Case Layout":
  - test suite with deterministic cases -> backend-test
  - pure transform, no pass/fail -> helper function, stop here
  - live smoke check -> throwaway $flows.* call, stop here
Pick layout: one-flow-per-test (≤ ~25 cases) vs
one-flow-per-category (≥ ~30 cases); ambiguous 25-30 -> ask user
Action-as-test refactor? -> plan to delete the source action
after the suite lands; invoke `impact-analysis` before delete
        |
[Phase 3: Author test body]
Build body.json:
  - File shape (configurationTypeId=24, suffix -backendTest.json,
    single-line minified, referenceName==title, _test stem)
  - Four hook flows: before_suite / after_suite / before_each /
    after_each (referenceNames EXACT — renaming silently unbinds)
  - testCaseFlows[]: one flow per test (or per category)
  - $test.vars seeded in before_suite; never $flow.vars
  - Actions reached via $apis.<Package>.FootprintApi
    .extendedActions.<action_name>(...) — NOT $flows.*
  - Assertions hand-rolled (no chai/sinon/assert at runtime);
    throw Error(message) with input context in the message
  - Mocking strategy: prefer test-only wrapper flow; tolerate
    mock_data param only on code already shaped that way; flag
    runtime-mock seam as Platform TODO in before_suite comments
  - Invoke `action-creator` / `function-creator` if the
    flow-under-test or wrapper doesn't exist yet
        |
[Phase 4: Validate + push]
dxs configuration validate backendtest -b <branchId> -D body.json
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
dxs configuration upsert backendtest -b <branchId> -D body.json
   (upsert creates or updates by referenceName — one command for both)
        |
[Phase 5: Run the suite (optional)]
Trigger the mocha runner against the suite on the branch.
Watch for: hook never fires (referenceName drift), test code in
flows[] instead of testCaseFlows[] (silently ignored),
vacuously-passing "no X" assertions against fields the code no
longer produces.
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 1: Setup + Requirements

1. Follow [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) for branch and connection selection. **Never assume a branch ID** — ask the user to confirm.
2. Check whether a **requirements brief** already exists in the conversation context (produced by `requirements-gathering` or another calling skill).
   - **Brief exists** — use it. For a backend test the brief should identify the flow or action under test, the deterministic cases that establish coverage, the fixtures/mocks needed, and whether the work is a net-new suite or a refactor of an existing action-as-test.
   - **No brief** — invoke the `requirements-gathering` skill first. The "is this really a test suite, or just a smoke check?" question is load-bearing for Phase 2.

### Phase 2: Decide test scope

Consult [references/backend-tests.md → Purpose & When to Use](references/backend-tests.md#purpose--when-to-use) before authoring.

Pick a **backend test** when the work is a test suite — exercising a flow or action with multiple cases, baseline invariants, setup/teardown, and pass/fail reporting.

- **Never author a new action-as-test.** Before this component existed, engineers crammed test suites into an action's `code` string with a hand-rolled runner. That pattern is finished. When you encounter one (filename usually starts with `test_` or ends with `_test_action`), plan to **refactor it into a backend test** — author the new suite here, then delete the source action only after invoking the `impact-analysis` skill to confirm nothing else calls it.
- **Prefer a helper function over a backend test** when the logic is a pure transform with no notion of pass/fail — functions don't cost you a mocha runner you won't use.
- **Don't use backend tests as a smoke-check harness** for live data. They're for deterministic suites. If you need "does this flow return anything sensible against prod?", that's a manual `$flows.*` call from a throwaway action, not a backend test.

**Pick the test-case layout** from [references/backend-tests.md → Minimal Valid Skeleton](references/backend-tests.md#minimal-valid-skeleton):

1. **One flow per logical test** — most idiomatic mocha shape. Use when the suite has ≤ ~25 cases, or when individual failures need to be filterable in mocha output.
2. **One flow per category, iterating its cases internally** — the `code` string defines an array of case objects and loops over them. Use when one-flow-per-test would explode past ~30, or when cases in a category share enough setup to be worth colocating. A reasonable shape is ~15–20 categories with ~2–5 cases each.

Ask the user when the projected count lands in the ambiguous 25–30 band, or when they signal they want the new suite to match the granularity of existing suites in the feature.

### Phase 3: Author test body

Build `body.json` from the skeleton in [references/backend-tests.md → Minimal Valid Skeleton](references/backend-tests.md#minimal-valid-skeleton). Key points:

1. **File basics.** Per the **Pre-Flight Checklist** below + [../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md); see [references/backend-tests.md → File Location & Naming](references/backend-tests.md#file-location--naming) for the `-backendTest.json` file shape (and the `_test` stem rule).

2. **Exactly four hook flows in `flows[]`.** ReferenceNames are `before_suite` / `after_suite` / `before_each` / `after_each` — **exact spelling, no variants**. The root-level `beforeFlowConfig.flowId` / `afterFlowConfig.flowId` / `beforeEachFlowConfig.flowId` / `afterEachFlowConfig.flowId` resolves to one of those four flows **by `referenceName`** (not numeric id). If a hook flow's referenceName is `beforeSuite` or `setup`, the runner silently doesn't bind it — the hook never fires and the user assumes it worked.

   | `referenceName` | Mocha hook | Typical content |
   |---|---|---|
   | `before_suite` | `before()` | Seed suite-level state on `$test.vars`: assertion helpers, mock builders, expensive one-time fixtures. |
   | `after_suite` | `after()` | Release anything `before_suite` persisted. Usually empty. |
   | `before_each` | `beforeEach()` | Reset per-test state (counters, scratch collections) so cases don't leak into each other. |
   | `after_each` | `afterEach()` | Per-test cleanup. Usually empty. |

3. **Test cases belong in `testCaseFlows[]`.** Each entry is a flow whose single step's `executeCodeConfig.code` is the body of one `it()`. The flow's `referenceName` becomes the test name in mocha output. **Anything in `flows[]` outside the four hooks is silently ignored by the runner** — a common silent-failure for newcomers who put test cases in the wrong array. Default scaffold for each test-case `code` is the Arrange / Act / Assert template:

   ```
   // Arrange

   // Act

   // Assert
   ```

4. **`vars[]` is the suite-level state mechanism**, accessed via the **`$test` runtime global** (`$test.vars.<id>`) from any hook or test-case code. Backend-tests have their own runtime global distinct from `$flow` — the runner populates `$test` for every hook and test-case execution, and `$test.vars` persists across the entire suite lifecycle (before_suite → before_each + case + after_each loop → after_suite). Each var is a property descriptor with the same shape as an interface property — see [../type-definition-creator/references/type-definitions.md](../type-definition-creator/references/type-definitions.md). Functions stored on vars must be typed as `object` (there's no `function` primitive in the descriptor schema).

5. **Tier compliance inside the `code` string.** Backend tests run at the **function tier**, so the function-tier calling matrix applies:

   - `$test.vars.<id>` — suite-level state declared in `vars[]`. Replaces `$flow.vars` — writing `$flow.vars` inside a backend test will not resolve.
   - `$apis.<Package>.FootprintApi.extendedActions.<action_name>({ ... })` — call an action. **The only way to invoke an action from a backend test.** The action → action syntax `$flows.<Package>.<action_name>` does **not** work here.
   - `$flows.<Package>.<function_name>({ ... })` — call another function. `$flows` at this tier reaches functions only.
   - `$datasources.<Package>.<name>.get({ ... })` — function-tier datasources (`-datasource.json`) only. FPDS (`-footprintDatasource.json`) are **not** reachable.
   - `$db.<Package>.<storage>` — **NOT available.** Studio Validate rejects `$db` inside backend-test hook/test-case code with `Cannot find name '$db'` (verified 2026-07-15 — a suite whose June-era flows used `$db` failed on its first upload), even though other function-tier services resolve. Storage access must ride same-package `$flows`: prefer the feature's real manage/verb flows when the test exercises the contract anyway; for raw fixture access (legacy-row inserts, column-state assertions, purges) add a small function-tier test-support shim and call it from the test (shipped precedents: `LaborManagement.task_control_engine_test` uses zero `$db`; `SalesOrders.oa_test_support_flow` is the shim pattern). The [../db-query/references/db.md](../db-query/references/db.md) rules apply *inside the shim*.

   See [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) and [../datex-studio-runtime/calling-conventions.md](../datex-studio-runtime/calling-conventions.md).

6. **Throw-on-failure is the assertion contract.** There is **no assertion library loaded by default** — no `expect`, no `assert`, no chai, no sinon. A test case passes if its code returns cleanly and fails if it throws. The runner surfaces the `Error.message` in mocha output, so invest in the message — "Expected 3 allocations, got 2 (lotIds = [1, 2])" is worth ten times "assertion failed."

   Define helpers once in `before_suite` and stash them on `$test.vars`:

   ```ts
   // before_suite code
   $test.vars.assertEquals = (description, expected, actual) => {
     if (JSON.stringify(expected) !== JSON.stringify(actual)) {
       throw new Error(`${description}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
     }
   };

   $test.vars.buildMockData = (overrides) => { /* ... */ };
   ```

   Each test case reuses them. Calling the action-under-test goes through the `FootprintApi.extendedActions` bridge:

   ```ts
   // test case code
   const input = { context: 9, request: {...}, mock_data: $test.vars.buildMockData({...}) };
   const output = await $apis.Allocations.FootprintApi.extendedActions.plan_inventory_consumption_action(input);

   $test.vars.assertEquals('result count', 2, output.result.length);
   $test.vars.assertEquals('first lot id', 1, output.result[0].lot_id);
   ```

7. **Error piping inside test cases.** When a test case calls a flow that itself throws, mocha will surface that error. That's usually what you want — don't wrap the call in a try/catch unless you're converting a specific failure mode into a clearer assertion error. If you do catch, always rethrow with added context (`throw new Error(\`calling plan_inventory_consumption_action with context=9 failed: ${e.message}\`)`) — swallowed errors in test cases are indistinguishable from "the code ran" in mocha output, which is the worst possible false-pass.

   Hooks have the same rule with an extra wrinkle: a throw inside a hook aborts the suite (mocha's default). If you need a non-fatal failure, swallow inside the hook and record it on `$test.vars` for a later test case to surface.

8. **Mocking strategy.** There's a platform gap here: **no runtime seam exists today** for intercepting `$apis` / `$flows` / `$datasources` / `$db` calls from a test. That means a backend test can't stub a FootprintApi response the way `sinon` or `nock` would. The only way to feed canned data to a flow under test is to plumb it in. Three tiers, best to worst:

   1. **Runtime interception of FootprintApi / `$flows`** — *Not available today.* This is where the platform should head. Flag as a Platform TODO in `before_suite` comments — see [references/backend-tests.md → Platform TODOs](references/backend-tests.md#platform-todos).
   2. **Test-only wrapper flow.** Write a flow that accepts the mock shape explicitly and calls the production flow with its real contract. Tests call the wrapper; production code calls the real flow. **This is the right choice for new work.** Invoke `function-creator` to author the wrapper.
   3. **`mock_data` param on the production flow.** Pre-existing actions sometimes carry this — pollutes the production contract forever. Treat it as a **last resort**, acceptable only on code already shaped that way. **Never add a `mock_data` param to a new production flow.** If the only way to test a new flow is to pre-wire it for mocks, push back and build the test-only wrapper in (2) instead.

9. **Action-as-test refactor.** If you're converting an action-as-test (filename usually starts with `test_` or ends with `_test_action`) into a backend test:

   a. Author the new `*-backendTest.json` suite first; copy the test cases out of the action's `code` string into individual `testCaseFlows[]` entries (rewrite hand-rolled iteration into mocha cases; the runner handles the loop).
   b. Move suite-level helpers from the action's setup block into `before_suite`, stashing them on `$test.vars`.
   c. Rewrite any `$flows.<Package>.<action>(...)` calls to `$apis.<Package>.FootprintApi.extendedActions.<action>(...)` — tier change from action to function.
   d. Push the new suite and verify it runs (Phase 5).
   e. Before deleting the source action, **invoke the `impact-analysis` skill** to confirm nothing else calls it. The action may be a fake-test on the surface but a real caller somewhere may have started leaning on it for production work — don't find out by removal.

### Phase 4: Validate + push

```bash
# Validate the body locally against the branch
dxs configuration validate backendtest -b <branchId> -D body.json

# For a new backend test
dxs configuration upsert backendtest -b <branchId> -D body.json

# For modify-existing (round-trip — never skip the jq extract)
dxs configuration get backendtest <configId> -b <branchId> -O envelope.json
jq .json envelope.json > body.json
# ... edit body.json ...
dxs configuration upsert backendtest -b <branchId> -D body.json
```

Validation surfaces missing required fields, malformed property-descriptor shapes in `vars[]`, and reference errors before push. It does **not** catch silent-binding failures (a hook flow with the wrong `referenceName`), test code put in `flows[]` instead of `testCaseFlows[]`, or vacuously-passing assertions — those are runtime concerns, audited via the Phase 5 verification and the [references/backend-tests.md → Pre-Flight Checklist](#pre-flight-checklist) below.

### Phase 5: Run the suite (optional)

If the platform exposes a way to trigger the mocha runner against the suite on the branch (a Studio button, a CLI subcommand, or a manual `$flows.*` call to a known test entry-point), run it and confirm:

- The four hooks actually fire (a renamed hook like `beforeSuite` silently never binds; the test cases run but the setup is missing).
- Every test case shows up in mocha output as its own `it()` (or per-category, depending on the layout chosen in Phase 2). Anything in `flows[]` outside the four hooks is silently ignored — if a test case is "missing" from output, that's the cause.
- No vacuously-passing "no X" assertions — if a test asserts `(result.foo ?? []).length === 0` against an output that no longer has `foo`, it'll pass through every regression. Audit by also asserting presence of the field on a positive control.

If runner access isn't available, re-fetch the config (using the corrected `jq .json` extract pattern) and diff against `body.json` to confirm the push landed; the four hook bindings and the `testCaseFlows[]` layout should match what you authored.

## Pre-Flight Checklist

Before push, walk the full checklist in [references/backend-tests.md](references/backend-tests.md). The fast version:

1. **File basics.** Suffix `-backendTest.json`, `configurationTypeId: 24`, `referenceName` ends in `_test` — plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)).
2. **Exactly four hook flows** in `flows[]` with referenceNames `before_suite` / `after_suite` / `before_each` / `after_each`. Each root-level `beforeFlowConfig.flowId` / `afterFlowConfig.flowId` / `beforeEachFlowConfig.flowId` / `afterEachFlowConfig.flowId` resolves by referenceName to one of them. A mis-named hook silently never fires.
3. **Test cases belong in `testCaseFlows[]`, not `flows[]`.** Anything in `flows[]` outside the four hooks is silently ignored by the runner.
4. **`vars[]` descriptors are complete.** Every var carries `id`, `type`, `isCollection`, `objectType`, `isSecured`; required vars add `required: true`; unions carry `oneOf`; constants carry `isConstant: true` + `constantValue`.
5. **`code` string line endings are `\r\n`.** Inside the decoded string (the JSON layer escapes to `\\r\\n`). Edit via Python `json.load` / `json.dump` — raw text substitution corrupts the escaping.
6. **No `expect` / chai / sinon assumption.** Throw on failure. Hand-rolled assertion helpers live on `$test.vars` and are defined in `before_suite`.
7. **No new `mock_data` params on production flows.** If the suite needs mocks, prefer a test-only wrapper flow. A `mock_data` param is acceptable only on code that already has one; flag it in the suite's `before_suite` comments with a link to the Platform TODO on runtime interception.
8. **Test case layout follows the decision rule** from Phase 2: one-flow-per-test under ~25 cases, one-flow-per-category above ~30, ambiguous in between.
9. **Assertion messages carry the inputs.** `assertEquals('allocation order', [1, 2], order)` reports the context; `assertEquals('x', expected, actual)` does not.
10. **No vacuously-passing "no X" assertions.** A test that asserts `(result.foo ?? []).length === 0` against an output that no longer has `foo` evaluates to `0 === 0` forever. Verify the field path is still live (positive control) before relying on absence checks.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Hook flow named `beforeSuite` / `setup` / `before` instead of `before_suite` | Silent unbind — the runner resolves `beforeFlowConfig.flowId` by `referenceName`; a mismatch means the hook never fires, but no error is raised. Use the exact names `before_suite` / `after_suite` / `before_each` / `after_each`. |
| Test cases placed in `flows[]` instead of `testCaseFlows[]` | The runner only wraps `testCaseFlows[]` as mocha `it()`s. Anything else in `flows[]` outside the four hooks is silently ignored. |
| Calling an action via `$flows.<Package>.<action_name>(...)` from a test case | Backend tests run at the function tier; that syntax is action→action only. Use `$apis.<Package>.FootprintApi.extendedActions.<action_name>({ ... })` instead. |
| Using `$flow.vars` instead of `$test.vars` in hook or test-case code | Backend tests have a dedicated runtime global. `$flow` doesn't resolve. Replace every reference with `$test.vars.<id>`. |
| Assuming `expect`, `chai`, `sinon`, or Node's built-in `assert` is available | None are loaded by default. Hand-roll helpers in `before_suite` that `throw new Error(...)` on failure; stash them on `$test.vars`. |
| Adding a `mock_data` param to a new production flow so a backend test can mock it | Pollutes the production flow's contract forever. Build a test-only wrapper flow instead (invoke `function-creator`). `mock_data` params are tolerated only on code already shaped that way; new code never adds one. |
| Swallowing an error inside a test case to "keep the suite running" | Indistinguishable from a pass in mocha output — the worst kind of false pass. Rethrow with context if you catch. |
| Pretty-printing the JSON before push | Backend-test files are **single-line minified** by platform convention (same as `-customType.json`). Re-minify before `dxs configuration upsert`. |
| Piping `dxs configuration get -O envelope.json` directly into `dxs configuration upsert -D envelope.json` | Silently destroys config content. Always `jq .json envelope.json > body.json` before editing. See "Round-trip rule" above. |
| Deleting an action-as-test before checking callers | The action may have been used for more than its self-test role. Invoke `impact-analysis` before delete. |
| Asserting `(result.foo ?? []).length === 0` against output that no longer has `foo` | Vacuously passes through every regression. Add a positive control that asserts `foo` exists on a known-good case, or assert expected values directly instead of absence. |
| `description` exceeds 100 chars | SQL column limit — push will fail validation. Tighten. |
| `referenceName` ≠ `title`, or filename stem doesn't match `referenceName` | Lookup / mocha output mislabel. Three names line up by convention: filename stem == `referenceName` == `title`, all ending in `_test`. |

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
