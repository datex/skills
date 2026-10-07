# Allocation strategy workflows (`Workflows`) and the LookupCode contract

> Verified live against the Footprint OData API and metadata.

## Shape

- Entity set **`Workflows`**: `Id` (`Edm.Guid`, key), `Name` (≤64), `LookupCode` (≤50, not null), `Description`,
  `IsActive`, `WorkflowDefinitionId` (`Edm.Int32`). Only navigation: `WorkflowDefinition`.
- **`WorkflowDefinitionId eq 21` = allocation strategy.** Every workflow a material's `AllocationStrategyWorkflowId`
  points at carries definition 21, and `Materials.ds_allocation_strategy_workflows_dd` filters on it. There is no
  type/category column on `Workflow` itself.
- **`Material.AllocationStrategyWorkflowId` is a GUID FK with no navigation property.** `$expand=AllocationStrategyWorkflow`
  is a 400 ("Could not find a property named 'AllocationStrategyWorkflow'"). Resolve it with a second query:
  `Workflows?$filter=Id in (<guid-1>,<guid-2>,...)` — quoted or unquoted GUID literals both work.

## `LookupCode` is the API contract, and it is only *usually* the GUID

- A workflow's `LookupCode` **defaults to its upper-cased GUID** on creation and is then renamed freely by admins
  to a short mnemonic code; some GUID-style codes are stored lower case. It is **not guaranteed unique** (a
  "backup" copy can share the code) and inactive rows keep theirs.
- Footprint APIs that take a workflow **code** — `CreateInventoryTransferLine.AllocationStrategyWorkflowCode`, persisted
  as `InventoryTransferLine.AllocationStrategyWorkflowCode` (50 chars) — want the **`LookupCode`, never the GUID id**.
  Sending `Material.AllocationStrategyWorkflowId` "works" only while the code still equals the GUID; it breaks the
  first time a renamed workflow is used. Pass the stored code verbatim (no `toUpperCase()` — mixed-case codes exist).
- Selector pattern: key the dropdown by `LookupCode` when the consumer stores the code; key by `Id` when it stores
  the GUID. Either way the selector is just a query against `Workflows` filtered to `WorkflowDefinitionId eq 21`.

## Inventory transfer behaviour worth knowing

- Inventory transfers **reject strategies that return manual allocation suggestions**: line `ErrorMessage` =
  `Allocation strategy [workflow:<code>] for inventory transfer returned manual allocation suggestions. Not supported
  for inventory transfers`, and both the transfer and the line go to `FailedToStart` (3). **No `Task` (op 139) or
  `FootPrintEvent` is written in that case** — the line's `ErrorMessage` is the only trace, so any "errors" UI must read
  it rather than only the event log.
- `StartInventoryTransfer` accepts a `FailedToStart` transfer and re-runs it (the lines are re-modified); "reprocess" is
  an API-level retry, not a status reset.
- `InventoryTransferStatuses` and `InventoryTransferLineStatuses` share the enum: 1 Created, 2 Transferring,
  3 FailedToStart, 4 FailedToFullyComplete, 5 Completed, 6 Cancelled, 7 WaitForSelection.
