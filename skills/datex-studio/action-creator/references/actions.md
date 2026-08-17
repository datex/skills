# Actions

See also [`functions.md`](../../function-creator/references/functions.md) for the non-transactional counterpart.

An **action** is a server-side, **transactional** flow that executes inside the Footprint runtime. Actions are the platform's unit of atomic work — entity CRUD, status transitions, and any operation that must either fully succeed or fully roll back.

## Purpose & When to Use

Use an action when:

- The operation must be **transactional** (atomic success/rollback).
- The operation performs CRUD on entities, or composes other actions into a larger transaction.
- The logic needs to run server-side inside the Footprint runtime (e.g. needs access to the Footprint-server datasources `-footprintDatasource.json`).

Don't use an action when:

- The work is a pure read/transform with no transactional boundary — use a function ([`functions.md`](../../function-creator/references/functions.md)).
- The operation is invoked from UI and doesn't need atomicity — keep the logic in a function. UI cannot call actions directly anyway (see [`calling-conventions.md`](../../datex-studio-runtime/calling-conventions.md)).

## File Location & Naming

- File name: `<name>_action-footprintFlow.json` (`referenceName` stem + suffix). The component lives on the branch — this is the naming convention, not a local `src/` path.
- Suffix: `-footprintFlow.json`
- Top-level `configurationTypeId`: `18`
- **Asymmetric naming**: the `_action` indicator lives in the component `referenceName` inside the JSON; the **file suffix stays `-footprintFlow.json`** (not `-action.json`). This is the one naming case where indicator and file suffix diverge. See [`naming-conventions.md`](../../datex-studio-conventions/naming-conventions.md).
- Default package: `Utilities` unless otherwise specified.
- Default access modifier: `public`.

## Minimal Valid Skeleton

```json
{
  "configurationTypeId": 18,
  "apiSettingName": "FootprintApi",
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
  "id": 0,
  "referenceName": "<name>_action",
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

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `configurationTypeId` | Component kind identifier | Always `18` for actions |
| `apiSettingName` | API-layer binding | Always `"FootprintApi"` for actions — they run on the Footprint server |
| `start` | Entry-node id | References an `id` inside `nodes[]` |
| `nodes` | Step graph | Typically one `ExecuteCodeActivity` step containing the full `code` string; more complex actions use multi-step graphs |
| `code` | Denormalized top-level mirror of the code body | Exported action JSON carries the code **twice**: the field the runtime executes is `nodes[0].stepConfig.executeCodeConfig.code`; the top-level `code` is a duplicate the runtime ignores. Writing only the top-level field leaves the config looking correct to `json.load` and grep while the runtime keeps running the old code. When editing programmatically, write both and assert they match. |
| `id` | Component identity | Stable id; don't reuse across environments |
| `referenceName` | Code-facing handle | Snake_case with `_action` suffix — inside the JSON only, not the filename |
| `description` | Searchable description | ≤ 100 chars (SQL column limit) |
| `accessModifier` | Visibility | Default `public` |
| `inParams` / `outParams` | I/O contract | Full parameter-descriptor boilerplate per entry |

Callable from:

| Caller | Syntax |
|---|---|
| Function | `$apis.<Package>.FootprintApi.extendedActions.<action_name>({ ... })` |
| Action | `$flows.<Package>.<action_name>({ ... })` |
| UI | **Not allowed** — wrap the action in a function that the UI calls |

Actions **cannot call functions** (wrong direction across the action/function tier boundary).

## Runtime Globals

Within an action's `code` string:
- `$flow.inParams` / `$flow.outParams` — the I/O contract declared at the top level.
- `$flows.<Package>.<action_name>` — call other actions.
- `$apis.<Package>...` — not used from within actions (that's the function→action direction).
- `$datasources.<Package>.<name>.get({...})` — reaches `-footprintDatasource.json` targets only; calling a `-datasource.json` from an action is a cross-tier violation.
- `$api` — built-in native actions across packages (distinct from `$apis`, which is package-scoped).
- `$types`, `$utils` — as usual.

See [`runtime-globals.md`](../../datex-studio-runtime/runtime-globals.md) for the full list.

## Invocation Contract

Every caller of an action supplies the full inParams shape — including entries for unused params with `value: null`, per [`component-wiring.md` → Reference Contracts Include Every Target inParam](../../component-wiring-check/references/component-wiring.md#reference-contracts-include-every-target-inparam).

## Common Patterns

Recurring action shapes: CRUD composition via `crud_*` actions, error-on-undefined input guards, collection-aware guards via `$utils.isDefined`, and multi-step transactional workflows. See the `action-creator` SKILL.md workflow for worked examples; the Error Handling section below is the load-bearing one.

**Batch-create via nested navigation properties (deep insert).** `crud_create_entity` creates one entity per call, with a single batching exception: a call can create a parent entity **and** its related children/grandchildren in one shot when those relationships exist as collection navigation properties on the parent. Example shape:

```ts
await $flows.Utilities.crud_create_entity({
  entity: 'ShippingContainers',
  properties: {
    ...containerScalars,
    ShipmentLinesForExpectedShippingContainer: [{ ...line1 }, { ...line2 }]
  }
});
```

creates the container and N child lines in one call. The same nesting works at multiple levels (e.g. `Tasks` → nested `HardAllocations` → each with nested `Details`). Deep insert goes through ordinary (non-contained) collection navigation properties — the schema does not need `ContainsTarget="true"`. The navigation property name must match the OData schema exactly; names sometimes carry FK-specific suffixes (`ShipmentLinesForExpectedShippingContainer`, not `ShipmentLines`) — confirm via the `schema-explorer` skill.

Two hard limits to design around: there is **no flat multi-row bulk insert** — `crud_create_entity` does not accept an array of unrelated records, so batch-create patterns must be modeled around parent→children navigation chains, not flat arrays. And `crud_delete_entity` is strictly one-at-a-time — no bulk-delete primitive exists; high-volume deletes must loop, or prefer soft-delete / mark-and-sweep designs. See [`calling-conventions.md` → CRUD Actions](../../datex-studio-runtime/calling-conventions.md#crud-actions) for the generic CRUD contract.

## Error Handling

Actions run inside a Footprint transaction. The runtime commits or rolls back based on whether the action's `code` throws — so **any error caught inside an action body must be rethrown**. Silently swallowing an error leaves the transaction unresolved, and the next attempt to use a transactional context throws the misleading `"Transaction must begin first"`. The symptom typically appears far from the real bug: on the *next* unrelated action invocation, not inside the action that swallowed the error.

Rules:

- **Don't catch unless the catch does something useful.** If a `try/catch` block only swallows the error or rethrows it unchanged, remove the block entirely — let the exception propagate naturally.
- **When you do catch, format and rethrow.** The canonical pattern is catching only to enrich the error with context (what was being done, which key/id was involved), then throwing a new `Error` with the enriched message.
- **Never let an error terminate silently inside an action.** Missing rethrows are the most common cause of `"Transaction must begin first"` surfacing elsewhere.

Good — format-and-rethrow:

```ts
try {
  await $flows.Utilities.crud_update_entity({ entity: 'Tasks', keys, properties });
} catch (e) {
  throw new Error(`Failed to update task ${keys[0].value}: ${e.message}`);
}
```

Bad — swallows the error, transaction left unresolved:

```ts
try {
  await $flows.Utilities.crud_update_entity({ entity: 'Tasks', keys, properties });
} catch (e) {
  // nothing useful happens here — error never reaches the caller,
  // transaction stays open, next action invocation throws
  // "Transaction must begin first"
}
```

Also bad — pointless rewrap that adds no context (just delete the try/catch):

```ts
try {
  await $flows.Utilities.crud_update_entity(...);
} catch (e) {
  throw e;
}
```

## Pre-Flight Checklist

Walk this before push (the `action-creator` SKILL.md carries the authoritative copy):

1. Top-level fields: `configurationTypeId: 18`, `apiSettingName: "FootprintApi"`, `referenceName` ending in `_action`, `description` non-null and ≤ 100 chars, `accessModifier` set.
2. File suffix is `-footprintFlow.json`, not `-action.json` (asymmetric naming rule).
3. `code` string line endings are `\r\n` inside the decoded string (the JSON layer escapes them as `\\r\\n`). Preserve existing escaping when editing — prefer Python `json.load`/`json.dump` over raw string replacement.
4. Every `inParams`/`outParams` entry uses the full fat parameter-descriptor boilerplate.
5. Both `code` fields written and matching — the runtime executes only `nodes[0].stepConfig.executeCodeConfig.code`; the top-level `code` is a mirror that must agree with it (see Required Top-Level Fields).
6. All `$datasources.*` calls target `-footprintDatasource.json` (same tier); no cross-tier calls.
7. Any callers of this action include a full `configParameters` contract.
8. Every `try/catch` either adds value (formats and rethrows) or is removed. No silent swallows — they leave the transaction unresolved and surface later as `"Transaction must begin first"`.

## Cross-References

- [`calling-conventions.md`](../../datex-studio-runtime/calling-conventions.md) — caller→callee matrix and tier rules.
- [`file-format.md`](../../datex-studio-conventions/file-format.md) — `configurationTypeId` table, JSON file locations and editing rules.
- [`naming-conventions.md`](../../datex-studio-conventions/naming-conventions.md) — `_action` indicator vs file suffix.
- [`functions.md`](../../function-creator/references/functions.md) — non-transactional counterpart; UI entry points wrap action calls in functions.
- [`datasources.md`](../../datasource-creator/references/datasources.md) — action-tier datasource targets (`-footprintDatasource.json`).
