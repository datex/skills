# Functions

See also [`actions.md`](../../action-creator/references/actions.md) for the transactional counterpart.

A **function** is a non-transactional flow that executes in the platform's cloud backend. Functions handle reads, computations, orchestration, and — crucially — are the **only** callable entry point for UI code into the action layer (UI cannot call actions directly, so a function wraps the call).

## Purpose & When to Use

Use a function when:

- The logic is a **read or pure computation** — no transactional boundary required.
- The work is the **UI → action bridge**: a UI event needs to invoke an action, so a function wraps the action call via `$apis`.
- The orchestration composes several reads, calls, or datasource queries and returns a shaped result.

Don't use a function when:

- The operation must be atomic / transactional — use an action ([`actions.md`](../../action-creator/references/actions.md)).
- You need Footprint-server datasources — functions can only reach `-datasource.json`, not `-footprintDatasource.json`. See [`datasources.md`](../../datasource-creator/references/datasources.md).

## File Location & Naming

- File name: `<name>_flow-flow.json` (`referenceName` stem + suffix). The component lives on the branch — this is the naming convention, not a local `src/` path.
- Suffix: `-flow.json`
- Top-level `configurationTypeId`: `9` (shared with embedded flow step nodes — the file suffix is the distinguisher)
- Naming: the component `referenceName` and filename stem both end with `_flow` (e.g. `format_schedule_flow-flow.json` → referenceName `format_schedule_flow`). See [`naming-conventions.md`](../../datex-studio-conventions/naming-conventions.md).
- Default package: `Utilities` unless otherwise specified.
- Default access modifier: `public`.

## Minimal Valid Skeleton

```json
{
  "configurationTypeId": 9,
  "start": "step1",
  "nodes": [
    {
      "id": "step1",
      "type": "step",
      "stepConfig": {
        "type": "ExecuteCodeActivity",
        "executeCodeConfig": {
          "code": "<TypeScript code string — uses \\r\\n line endings inside the JSON>"
        },
        "next": null,
        "error": null
      },
      "decisionConfig": null
    }
  ],
  "fromBaseConfiguration": null,
  "enableProgressAndCancelation": false,
  "id": 0,
  "referenceName": "<name>_flow",
  "title": "<title>",
  "description": "<≤100 chars>",
  "inParams": ["<parameter descriptors with full boilerplate>"],
  "outParams": ["<parameter descriptors with full boilerplate>"],
  "vars": null,
  "events": null,
  "accessModifier": "public"
}
```

Each entry in `inParams` / `outParams` uses the full fat parameter-descriptor boilerplate:

```json
{"id": "<name>", "required": <bool|null>, "description": null, "oneOf": null, "fromBaseConfiguration": null, "type": "<string|number|boolean|date|object>", "objectTypeDef": null, "objectType": null, "isCollection": <bool>, "isSecured": null, "isConstant": null, "constantValue": null}
```

Note the absence of `apiSettingName` — functions run in the cloud backend, not behind the Footprint API.

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `configurationTypeId` | Component kind identifier | `9` at top level for function files — same id as embedded step nodes; file suffix `-flow.json` distinguishes a top-level function from a step node |
| `start` | Entry-node id | References an `id` inside `nodes[]` |
| `nodes` | Step graph | Typically one `ExecuteCodeActivity` step |
| `id` | Component identity | Stable id |
| `referenceName` | Code-facing handle | Snake_case, ends with `_flow`; matches the filename stem |
| `description` | Searchable description | ≤ 100 chars |
| `accessModifier` | Visibility | Default `public` |
| `inParams` / `outParams` | I/O contract | Full parameter-descriptor boilerplate per entry |
| `enableProgressAndCancelation` | Whether the flow supports progress / cancellation | Usually `false` |

Callable from:

| Caller | Syntax |
|---|---|
| UI | `$flows.<Package>.<function_name>({ ... })` |
| Function | `$flows.<Package>.<function_name>({ ... })` |
| Action | **Not allowed** — actions cannot call functions |

Functions **call actions** via `$apis.<Package>.FootprintApi.extendedActions.<action_name>({ ... })`. This is the UI → action bridge.

## Runtime Globals

Within a function's `code` string:
- `$flow.inParams` / `$flow.outParams` — the declared I/O contract.
- `$flows.<Package>.<function_name>` — call other functions.
- `$apis.<Package>.FootprintApi.extendedActions.<action_name>` — call actions.
- `$api.<Package>.<NativeAction>` — built-in native actions across packages.
- `$datasources.<Package>.<name>.get({...})` — reaches `-datasource.json` targets only (cloud backend tier). Cross-tier calls to `-footprintDatasource.json` are not allowed.
- `$types`, `$utils` — as usual.

See [`runtime-globals.md`](../../datex-studio-runtime/runtime-globals.md) for the full list.

## Invocation Contract

Every caller of a function includes every declared `inParam` — unused ones with `value: null`, per [`component-wiring.md` → Reference Contracts Include Every Target inParam](../../component-wiring-check/references/component-wiring.md#reference-contracts-include-every-target-inparam).

## Common Patterns

Recurring function shapes: the UI → action wrapper pattern (a function fronts an action call), composition over several datasource reads, `$utils.isDefined` / `isDefinedTrimmed` input guards, and enum-driven branching on `$types.<Package>.<enum>` values. See the `function-creator` SKILL.md workflow for worked examples.

## Pre-Flight Checklist

Walk this before push (the `function-creator` SKILL.md carries the authoritative copy):

1. Top-level fields: `configurationTypeId: 9`, `referenceName` ending in `_flow`, `description` non-null and ≤ 100 chars, `accessModifier` set.
2. File suffix is `-flow.json` (distinguishes top-level function from embedded flow step).
3. `code` string line endings are `\r\n` inside the decoded string (the JSON layer escapes them as `\\r\\n`). Preserve existing escaping when editing — prefer Python `json.load`/`json.dump`.
4. Every `inParams`/`outParams` entry uses the full fat parameter-descriptor boilerplate.
5. All `$datasources.*` calls target `-datasource.json` (same tier); no cross-tier calls to `-footprintDatasource.json`.
6. Any callers of this function include a full `configParameters` contract.

## Cross-References

- [`calling-conventions.md`](../../datex-studio-runtime/calling-conventions.md) — caller→callee matrix and tier rules.
- [`file-format.md`](../../datex-studio-conventions/file-format.md) — `configurationTypeId` table, JSON file locations and editing rules.
- [`actions.md`](../../action-creator/references/actions.md) — transactional counterpart; UI → action bridging lives in functions that wrap `$apis` calls.
- [`datasources.md`](../../datasource-creator/references/datasources.md) — function-tier datasource targets (`-datasource.json`).
