# Footprint Workflows (`-footprintWorkflow.json`)

A **footprintWorkflow** is a Studio component that fills a **workflow slot** the Footprint server
already knows about. Footprint ships a fixed catalogue of extension points — allocation strategy,
outbound processing strategy, cartonization strategy, and so on — each identified by a
`workflowDefinitionId` and a `workflowGUID`. Server-side operations (`$api.Orders.ProcessSalesOrder`,
hard-allocation, wave release) dispatch to whichever workflow is registered for the slot. Authoring
one is how platform behaviour is replaced without touching Footprint itself.

Unlike every other component type, **you do not invent the contract** — the slot defines it. The
component declares `workflowDefinitionId`, `workflowGUID` and an `inParams` list whose shape the
server dictates, and the code inside runs **action-tier** (Footprint server), so all the rules in
[`calling-conventions.md`](../datex-studio-runtime/calling-conventions.md) for actions apply
unchanged: no `$db`, no functions, no cloud-tier datasources.

In practice a footprintWorkflow should be a **shim**. Put the behaviour in ordinary actions and let
the workflow map the platform's input onto them — see [Common Patterns](#common-patterns).

## Purpose & When to Use

Use a footprintWorkflow when Footprint itself will invoke your code — when the trigger is a server
operation rather than a UI event, a schedule, or another flow. Choose it over:

- an **action** ([`actions.md`](../action-creator/references/actions.md)) when the caller is the
  Footprint server dispatching to a registered slot rather than your own code;
- a **function** when the work must run inside the Footprint runtime's transaction.

If nothing in the Footprint catalogue dispatches to it, it is not a footprintWorkflow.

## File Location & Naming

The branch is the source of truth — author via `dxs configuration` commands and mirror locally.

- Path: `src/<Package>/workflows/<name>-footprintWorkflow.json`
- Suffix: `-footprintWorkflow.json`
- `dxs` type name: **`footprintworkflow`** (all lowercase; `dxs configuration types` lists the set)
- Naming: snake_case `referenceName` matching the filename stem, usually `<slot>_workflow`
  (`allocation_strategy`, `outbound_processing_strategy_workflow`). `title` is the operator-facing
  label and follows the sentence-case rule in
  [`naming-conventions.md`](../datex-studio-conventions/naming-conventions.md).

## Minimal Valid Skeleton

```json
{
  "apiSettingName": "FootprintApi",
  "workflowDefinitionId": 31,
  "workflowDefinitionName": "Outbound Processing Strategy",
  "workflowGUID": "e94f2ac4-5f1e-4d70-bb4e-da96cb5fef3d",
  "configurationTypeId": 23,
  "start": "step1",
  "nodes": [
    {
      "id": "step1",
      "type": "step",
      "stepConfig": {
        "type": "ExecuteCodeActivity",
        "executeCodeConfig": { "code": "" },
        "next": null,
        "error": null
      },
      "decisionConfig": null
    }
  ],
  "id": 0,
  "referenceName": "<name>",
  "title": "<Sentence case label>",
  "description": "<= 256 chars",
  "inParams": [
    {
      "id": "Input",
      "required": true,
      "type": "object",
      "objectType": "FootPrintWorkflow.<Slot>InputBaseWL"
    }
  ],
  "outParams": null,
  "accessModifier": "public"
}
```

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `workflowDefinitionId` | Which Footprint slot this fills | Server-assigned; copy from an existing registration. `21` = Allocation Strategy, `31` = Outbound Processing Strategy |
| `workflowDefinitionName` | Product-facing slot name | Must match the catalogue entry |
| `workflowGUID` | The code callers pass | This is the value that reaches `ProcessingStrategyWorkflowCode` / `AllocationStrategyWorkflowId`. **Never invent one** — reusing the legacy GUID is what makes the replacement drop-in |
| `configurationTypeId` | Component type discriminator | Always `23` for footprintWorkflow (contrast `18` footprintFlow, `22` customType, `19` footprintDatasource) |
| `apiSettingName` | API binding | `"FootprintApi"` |
| `start` / `nodes` | Flow graph | One `ExecuteCodeActivity` node is the norm — see [Common Patterns](#common-patterns) |
| `inParams` | Platform-supplied input | Shape is dictated by the slot. Typically a single `Input` of `objectType` `FootPrintWorkflow.<Slot>InputBaseWL` |
| `outParams` | Platform-consumed output | Some slots require one (allocation returns `HardAllocationResponse`); many are pure side-effecting and use `null` |
| `description` | Searchable description | **Hard cap 256 characters** — see the gotcha below |
| `accessModifier` | Visibility | `public`; see [`defaults.md`](../datex-studio-conventions/defaults.md) |

### `description` is capped at 256 characters

Exceeding it fails the save with `DXS-API-500` / `Microsoft.EntityFrameworkCore.DbUpdateException` —
an error that names nothing and looks like the "large component fails to save" platform bug. Verified
by bisection on 2026-08-13: 256 saves, 257 fails, reproducibly. The cap applies to **every**
configuration type, not just workflows. `validate` does **not** catch it — only the save does, and a
failed save can remove the component from the branch. Check the length before pushing.

## Runtime Globals

Action-tier globals, with two differences from an ordinary action:

| Global | Availability |
|---|---|
| `$flow.inParams` | The slot's input — usually just `Input`. **Only what the component declares in `inParams` exists** |
| `$flow.outParams` | Exists **only** if the component declares `outParams`; otherwise `$flow.outParams` is a compile error |
| `$flows.<Package>.<action>` | Other actions — the normal way to do the real work |
| `$api.<EntitySet>.<Operation>` | Footprint OData operations (`$api.Orders.ProcessSalesOrder`, `$api.Shipments.CreateSalesOrderShipment`) |
| `$utils.http.get` | Direct OData reads |
| `$datasources.<Package>.<fpds>` | `-footprintDatasource.json` only |
| `$types.FootPrintWorkflow.*` | The slot's own enums and complex types |
| `$db`, `$flows.<fn>` (functions), `-datasource.json` | **Not available** — action tier |
| `$shell`, `$frontendFlows` | **Not available** — server-side, there is no browser |

## Invocation Contract

You never call a footprintWorkflow from your own code. Footprint calls it, and the binding is the
**GUID**, passed by whoever triggers the operation:

```typescript
await $api.Orders.ProcessSalesOrder({
    OrderId: order.Id,
    ProcessingStrategyWorkflowCode: '<workflowGUID>'
});
```

`src/Waves/actions/process_orders_action-footprintFlow.json` is the live example. The GUID usually
arrives from configuration (`OutboundProcessingStrategy.ProcessingStrategyWorkflowId`), not a literal.

### Discovering the input shape

`FootPrintWorkflow.*` types are **workflow-runtime types**. They are not in `metadata.xml` and not
reachable through `dxs schema` — that covers the OData model only. Enumerate them against the Studio
compiler instead: write a probe body, run `dxs configuration validate footprintworkflow`, and read
the type errors.

```typescript
// Lists every member: TS names the missing properties of the Record.
const m: Record<keyof typeof $flow.inParams.Input, number> = {};
const n: Record<keyof typeof $flow.inParams.Input.ProcessingBehavior, number> = {};

// Narrow a big namespace with a template-literal Extract:
type FPW = typeof $types.FootPrintWorkflow;
const x: Record<Extract<keyof FPW, `Outbound${string}`>, number> = {};

// Probe a member's type by assigning it somewhere wrong:
const t: number = $flow.inParams.Input.Context;   // "Type 'boolean' is not assignable..." names it
```

Plain member access (`input.Foo`) also works and often yields a `Did you mean 'Bar'?` suggestion, but
the `Record<keyof …>` form enumerates everything in one pass. `validate` is free and touches nothing
on the branch.

## Common Patterns

### Shim to an action (the default)

Keep the workflow thin: map the platform input, delegate, map the response back. The behaviour then
lives in a component that is independently testable, callable from other flows, and reviewable as
ordinary code.

```typescript
const input = $flow.inParams.Input;

const response = await $flows.Allocations.plan_allocation_action({
    context: input.Context as any,
    request: { material_id: input.HardAllocationRequest.Quantity.MaterialId, /* … */ }
});

$flow.outParams.HardAllocationResponse = { /* map back */ };
```

`src/Allocations/workflows/allocation_strategy-footprintWorkflow.json` and
`src/FootprintWorkflowsManager/workflows/outbound_processing_strategy_workflow-footprintWorkflow.json`
both follow this shape.

### Plan / execute split

For anything that writes, put reads and decisions in a `plan_*` action and writes in an `execute_*`
action that calls it. The workflow calls only the executor. Planning stays runnable on its own for
dry runs and tests, and the transactional boundary sits on the executor.

### `DEBUG` block for local iteration

A footprintWorkflow cannot be invoked except by the server, so authors stub the input to iterate:

```typescript
const DEBUG = false;
const input = !DEBUG ? $flow.inParams.Input : { Context: /* … */, ShipmentLineId: 143848 };
```

Ship it as `false`. It is a development affordance, not a feature flag.

### Version-gate contract changes

Slot contracts shift between Footprint releases. Gate the new member rather than assuming it:

```typescript
const check = await $flows.Utilities.check_footprint_version_action({ minimumVersion: '25.02.28' });
if (check?.meetsMinimumVersion) { request.CartonizationStrategyWorkflowCode = code; }
```

## Pre-Flight Checklist

1. **`workflowGUID` and `workflowDefinitionId` copied from the real slot**, never invented — a
   replacement is drop-in only if the GUID matches what callers already pass.
2. **`configurationTypeId` is `23`.** See [`file-format.md`](../datex-studio-conventions/file-format.md).
3. **`description` ≤ 256 characters** — the save fails with an unnamed `DbUpdateException` otherwise,
   and `validate` will not warn you.
4. **Input shape enumerated against the compiler**, not assumed from a legacy definition or a
   similarly-named slot. Use the `Record<keyof …>` probe above.
5. **Declare `outParams` only if the slot consumes them** — and remember `$flow.outParams` does not
   exist unless declared.
6. **No `$db`, no function calls, no `-datasource.json`, no `$shell`** — this is action tier.
7. **Behaviour lives in actions**, not in the workflow body.
8. **Create via `dxs configuration create footprintworkflow`** (lowercase type name), validate before
   every upsert, and mirror the body to `src/<Package>/workflows/`.
9. **A `DEBUG` stub, if present, ships as `false`.**

## Cross-References

- [`calling-conventions.md`](../datex-studio-runtime/calling-conventions.md) — action-tier rules and the CRUD actions
- [`actions.md`](../action-creator/references/actions.md) — the component the workflow should delegate to
- [`runtime-globals.md`](../datex-studio-runtime/runtime-globals.md) — `$flows`, `$api`, `$utils`, `$types`
- [`file-format.md`](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and file layout
- [`configuration-roundtrip.md`](configuration-roundtrip.md) — the dxs get → extract → validate → upsert loop
