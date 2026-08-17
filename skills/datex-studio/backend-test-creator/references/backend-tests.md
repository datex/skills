# Backend-Tests

Backend-tests are the platform's first-class **mocha test suite** component — a single suite per file, with the mocha lifecycle hooks (`before`, `after`, `beforeEach`, `afterEach`) modeled as flows, test cases modeled as a separate collection of flows, and suite-level variables carrying state between them. Use this doc when authoring or modifying `*-backendTest.json`. The operational companion is the `SKILL.md` that hosts this reference.

## Purpose & When to Use

Use a backend-test to exercise a flow or action with a deterministic set of cases — setup/teardown, per-case assertions, pass/fail reporting. The runner binds the suite's hook flows to mocha's `before` / `after` / `beforeEach` / `afterEach`, wraps each test case as an `it()`, and reports failures by surfacing the `Error.message` of anything a test case throws.

Before this component existed, engineers stuffed test suites into an action's `code` string with a hand-rolled runner. That pattern is retired: new test suites belong here, and existing action-as-test files should be refactored into backend-tests.

Don't reach for a backend-test when:

- You want a live smoke check against prod data — those are throwaway `$flows.*` calls from the shell, not a persisted component.
- The logic is a pure transform with no pass/fail concept — a helper function is the right home.

## File Location & Naming

- File name: `<referenceName>-backendTest.json` (`referenceName` stem + suffix). The component lives on the branch — this is the naming convention, not a local `src/` path.
- Suffix: `-backendTest.json`
- `configurationTypeId: 24`
- **Single-line minified JSON** (same convention as `-customType.json` — don't pretty-print; the platform exports in this shape and diffs stay readable only if we keep it)
- `referenceName` and `title` both equal the filename stem — e.g. `plan_allocation_test` → `plan_allocation_test-backendTest.json`
- `referenceName` conventionally ends in `_test` so the suite's intent is readable from the filename
- `description` — non-empty, ≤ 100 chars
- `accessModifier` — `"public"` by default
- `id` — numeric; `0` at author time for net-new files (the user/import assigns the real value)

## Minimal Valid Skeleton

A suite with one test case:

```json
{
  "flows": [
    { "id": null, "referenceName": "before_suite", "title": "before_suite", "description": null, "start": "step1", "nodes": [{"id":"step1","type":"step","stepConfig":{"type":"ExecuteCodeActivity","executeCodeConfig":{"code":"// runs once before any test case"}}}] },
    { "id": null, "referenceName": "after_suite",  "title": "after_suite",  "description": null, "start": "step1", "nodes": [{"id":"step1","type":"step","stepConfig":{"type":"ExecuteCodeActivity","executeCodeConfig":{"code":"// runs once after the suite"}}}] },
    { "id": null, "referenceName": "before_each",  "title": "before_each",  "description": null, "start": "step1", "nodes": [{"id":"step1","type":"step","stepConfig":{"type":"ExecuteCodeActivity","executeCodeConfig":{"code":"// runs before each test case"}}}] },
    { "id": null, "referenceName": "after_each",   "title": "after_each",   "description": null, "start": "step1", "nodes": [{"id":"step1","type":"step","stepConfig":{"type":"ExecuteCodeActivity","executeCodeConfig":{"code":"// runs after each test case"}}}] }
  ],
  "testCaseFlows": [
    { "id": null, "referenceName": "example_case", "title": "example_case", "description": null, "start": "step1", "nodes": [{"id":"step1","type":"step","stepConfig":{"type":"ExecuteCodeActivity","executeCodeConfig":{"code":"// Arrange\r\n\r\n// Act\r\n\r\n// Assert"}}}] }
  ],
  "beforeFlowConfig":     {"flowId": "before_suite"},
  "afterFlowConfig":      {"flowId": "after_suite"},
  "beforeEachFlowConfig": {"flowId": "before_each"},
  "afterEachFlowConfig":  {"flowId": "after_each"},
  "configurationTypeId": 24,
  "id": 0,
  "referenceName": "example_test",
  "title": "example_test",
  "description": "Example backend-test suite skeleton.",
  "inParams": null,
  "outParams": null,
  "vars": [],
  "events": null,
  "accessModifier": "public"
}
```

Shown pretty-printed for readability — the actual file should be minified to a single line.

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `configurationTypeId` | Component kind | Always `24` for backend-tests. |
| `id` | Component identity | `0` at author time; the user/import assigns the real value. |
| `referenceName` | Code-facing handle | Matches filename stem; snake_case; conventionally ends in `_test`. |
| `title` | Display label | Equals `referenceName`. |
| `description` | Searchable description | Non-empty, ≤ 100 chars (SQL column cap). |
| `accessModifier` | Visibility | `"public"` by default. |
| `flows` | Lifecycle hook flows | Exactly four, with referenceNames `before_suite` / `after_suite` / `before_each` / `after_each`. |
| `testCaseFlows` | Per-case flows | Each entry is wrapped as one mocha `it()`. |
| `beforeFlowConfig.flowId` | Binds the `before()` hook | Must equal a `flows[].referenceName`; use `"before_suite"`. |
| `afterFlowConfig.flowId` | Binds the `after()` hook | Use `"after_suite"`. |
| `beforeEachFlowConfig.flowId` | Binds the `beforeEach()` hook | Use `"before_each"`. |
| `afterEachFlowConfig.flowId` | Binds the `afterEach()` hook | Use `"after_each"`. |
| `vars` | Suite-level state carriers | Accessed via the `$test` runtime global (`$test.vars.<id>`) inside any hook or test-case code — distinct from `$flow`. See [`type-definitions.md` → Interfaces](../../type-definition-creator/references/type-definitions.md#interfaces) for the property-descriptor shape. |
| `inParams` / `outParams` | Suite-level I/O | Both `null`. Test cases don't receive input and don't return — pass/fail comes from thrown errors. |
| `events` | Event wiring | `null`. |

## Runtime Globals

Backend-tests execute at the **platform-backend tier** — the same tier as functions (`-flow.json`). The function-tier calling matrix applies. Inside any hook or test-case code string:

| Global | Purpose | Notes |
|---|---|---|
| `$test.vars.<id>` | Suite-level state declared in `vars[]` | The canonical backend-test global for shared state. **Distinct from `$flow.vars`** — writing `$flow.vars` in a backend-test hook/test-case will not resolve. |
| `$apis.<Package>.FootprintApi.extendedActions.<action_name>({ ... })` | Call an action | The only way to invoke an action from a backend-test. The action → action syntax `$flows.<Package>.<action_name>` does not work here because the test runs at the function tier, not the action tier. |
| `$flows.<Package>.<function_name>({ ... })` | Call another function | `$flows` at this tier reaches functions only. |
| `$datasources.<Package>.<name>.get({ ... })` | Datasource reads | Function-tier datasources (`-datasource.json`) only. Footprint-tier datasources (`-footprintDatasource.json`, FPDS) are **not** reachable — those are action-tier. |
| `$db.<Package>.<storage>` | Storage reads/writes | **NOT available** — Studio Validate rejects `$db` in backend-test code (`Cannot find name '$db'`, verified 2026-07-15) even though other function-tier services resolve. Route storage access through same-package `$flows`: the feature's real manage/verb flows for contract-level access, or a dedicated function-tier test-support shim for raw fixtures (precedent: `SalesOrders.oa_test_support_flow`; the validated `LaborManagement.task_control_engine_test` uses zero `$db`). The [`db.md`](../../db-query/references/db.md) rules apply inside the shim. |
| `$types`, `$utils` | Type helpers, utilities | Standard. |

There's **no assertion library loaded by default** — no `expect`, no `assert`, no chai, no sinon. Don't assume Node's built-in `assert` is exposed unless you can confirm it from the platform runtime docs. Assertions are hand-rolled helpers that throw on failure; stash them on `$test.vars` in `before_suite` and rehydrate as typed locals in each test case. See the operational SKILL.md → Suite-level helper pattern.

## Invocation Contract

How a suite is run, how the four hook flows bind, and how `testCaseFlows` dispatch are covered in the `backend-test-creator` SKILL.md workflow.

## Common Patterns

The action-as-test refactor and the suite-level helper pattern are covered in the `backend-test-creator` SKILL.md.

## Pre-Flight Checklist

The authoritative pre-flight checklist lives in the `backend-test-creator` SKILL.md that hosts this reference.

## Platform TODOs

Open gaps that backend-test authors hit today. Track here so they don't get lost:

- **Runtime interception of `$apis` / `$flows` / `$datasources` / `$db`.** No seam exists today for a test to stub these calls, so mocking a flow-under-test requires either a test-only wrapper flow or a `mock_data` input param on the production flow itself. The latter pollutes the production flow's contract forever and should never be used on new code. Until a runtime mock seam lands, the skill steers authors toward wrapper flows for new work and tolerates `mock_data` params only on code already shaped that way.
- **Assertion library.** The runtime loads no `chai` / `sinon` / `nock` by default. Tests either throw bare `Error` objects or define their own helpers in `before_suite`. A platform-shipped assertion helper library (installed once, available to every suite) would remove a lot of boilerplate.

## Cross-References

- [`file-format.md`](../../datex-studio-conventions/file-format.md) — `configurationTypeId` table; `\r\n` editing rule.
- [`runtime-globals.md`](../../datex-studio-runtime/runtime-globals.md) — function-tier globals available inside hook and test-case code strings.
- [`type-definitions.md`](../../type-definition-creator/references/type-definitions.md) — property-descriptor baseline shared with `vars[]`.
- [`actions.md`](../../action-creator/references/actions.md) — the historical pre-backend-test anti-pattern. Refactors flow from here to backend-tests.
