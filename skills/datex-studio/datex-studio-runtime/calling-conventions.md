# Calling Conventions

Which components can call which, and with what syntax. This is the authoritative reference for execution-tier rules and call-site wiring.

## Execution Tiers

The Datex Studio platform has three execution tiers:

- **Functions** (`-flow.json`) — execute in the cloud backend. Non-transactional.
- **Actions** (`-footprintFlow.json`) — execute server-side inside the Footprint runtime. Transactional; use for operations that require atomicity (CRUD, status updates). The transactional model has error-propagation consequences — see [actions.md → Error Handling](../action-creator/references/actions.md#error-handling).
- **UI components** (hubs, grids, forms, editors, selectors) — execute in the browser.

Datasources also run on one of the two server tiers: `-datasource.json` runs in the cloud backend (function-tier), `-footprintDatasource.json` runs on the Footprint server (action-tier). See [datasources.md](../datasource-creator/references/datasources.md) for the full taxonomy.

Storage (`-storage.json`) is function-tier only — accessed via `$db`. Actions cannot call `$db` directly; wrap storage reads/writes in a function and invoke that function via `$apis` from the action.

## Caller → Callee Matrix

### From a function

| Callee | Syntax |
|---|---|
| Action | `$apis.<Package>.FootprintApi.extendedActions.<action_name>({ ... })` |
| Function | `$flows.<Package>.<function_name>({ ... })` |
| `-datasource.json` | `$datasources.<Package>.<name>.get({ ... })` |
| `-footprintDatasource.json` | **Not allowed** — cross-tier call |
| `-storage.json` | `$db.<Package>.<storage_name>.<op>(...)` |

### From an action

| Callee | Syntax |
|---|---|
| Action | `$flows.<Package>.<action_name>({ ... })` |
| Function | **Not allowed** — actions cannot call functions |
| `-footprintDatasource.json` | `$datasources.<Package>.<name>.get({ ... })` |
| `-datasource.json` | **Not allowed** — cross-tier call |
| `-storage.json` | **Not allowed** — `$db` is function-tier only. Wrap the read/write in a function and call via `$apis`. |

### From a UI component

| Callee | Syntax |
|---|---|
| Function | `$flows.<Package>.<function_name>({ ... })` |
| Action | **Not allowed** — wrap in a function that calls the action via `$apis` |

**UI-tier rule.** UI components cannot invoke actions directly — they can only call functions. To trigger an action from a UI event, bind the event to a function and have the function call the action via `$apis.<Package>.FootprintApi.extendedActions.<action_name>({ ... })`. This keeps the transactional boundary inside the function/action layer and prevents the UI from holding open action transactions during user interaction.

## Execution-Tier Rule for Datasources

Each server-tier caller can only reach datasources that run on its own tier — functions ↔ `-datasource.json` (cloud backend), actions ↔ `-footprintDatasource.json` (Footprint server). Cross-tier datasource calls are not allowed in either direction. See [datasources.md](../datasource-creator/references/datasources.md) for the full taxonomy.

## CRUD Actions

Generic CRUD actions for entity manipulation. These are reference actions — do not modify them.

They live in the **Utilities** package. Call them via `$flows.Utilities.crud_*` (from actions) or `$apis.Utilities.FootprintApi.extendedActions.crud_*` (from functions).

- **Create**: `crud_create_entity` — `{ entity: string, properties: object }` → returns `{ result: { Id, ... } }`
- **Update**: `crud_update_entity` — `{ entity: string, keys: [{ name, value }], properties: object }` (PATCH)
- **Delete**: `crud_delete_entity` — `{ entity: string, keys: [{ name, value }] }`

Entity names use the OData collection name (e.g. `'Tasks'`, `'PickSlips'`, `'HardAllocations'`). Keys are typically `[{ name: 'Id', value: 123 }]`.

**There is no batch CRUD primitive.** Utilities exposes only the singular `crud_create_entity` / `crud_update_entity` / `crud_delete_entity` — creating or patching N entities is N dispatches by design. Per-line CRUD loops are a known platform cost, not a defect to "fix" by hunting for a bulk action that doesn't exist; when the volume hurts, restructure (fewer entities, server-side extended actions, or accept the loop).

## Dispatch Cost

Every `$flows` / `$apis...extendedActions` invocation is a **full dispatch** — serialization, routing, and a fresh execution scope — not an in-process function call. Guidance that follows from this (each observed as a real slowdown):

- **Inline pure-arithmetic helpers in hot loops.** A helper action that only computes (unit conversions, factor tables, rounding) costs a dispatch per call; invoked dozens of times per entity it dominates the runtime. Port the arithmetic bit-identically into the caller and keep the helper for low-frequency callers.
- **Batch lookups per data-set, not per item.** Collect the ids first, make one `in`-style query, index the result in a map — the pattern applies at every tier (see the grid `on_row_data_loaded` N+1 rule in [grids.md](../grid-creator/references/grids.md)).
- **Hoist row/iteration-invariant work** out of the loop — permission checks, config reads, and reference-data fetches rarely vary per item.
