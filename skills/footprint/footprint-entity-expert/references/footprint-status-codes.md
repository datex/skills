# Footprint Status & Operation Codes

Confirmed numeric enum values for the Footprint domain columns that drive order/wave/shipment state logic. The OData metadata (via `dxs schema` / the schema-explorer skill) gives the column *shape* (e.g. `StatusId : Edm.Int32`) but not the *meaning* of each integer — that's captured here. These codes are cross-feature: allocation, wave planning, sales orders, and substatus engines all key on them.

> Source of truth: confirmed with the product owner and corroborated by production usage — wave-release gating whitelists, license-plate-move completion op-code lists, and order-substatus state machines all key on these exact values.

## `Order.OrderStatusId`

| Id | Meaning | Notes |
|---|---|---|
| 1 | Created | |
| 2 | Processing | The static resting state after Created — **not** a transient/in-flight state (contrast Wave 6). |
| 4 | Completed | |
| 8 | Cancelled | |
| 2048 | Approval required | Used by the "Approval required" substatus; flag-style value outside the 1/2/4/8 progression. |
| 4096 | Rejected | Order rejected during approval; the order editor offers an "Undo rejected" (`revert_order`) action. |

## `Shipment.StatusId`

| Id | Meaning | Notes |
|---|---|---|
| 1 | Created | Not yet released to the floor. |
| 2 | Released | Released for fulfillment; pre-pick. |
| 4 | Executing | **Flips from 2→4 the moment the shipment's first picking task completes.** |
| 8 | Completed | |
| 16 | Cancelled | |

## `Wave.StatusId`

| Id | Meaning | Notes |
|---|---|---|
| 1 | Created | |
| 2 | Processed | Settled; ready to release. |
| 3 | Released | Picking tasks released (except those still gated behind incomplete replenishment/batch — see below). |
| 4 | Completed | Waves complete after picking; loading can still be outstanding. |
| 5 | Cancelled | A wave can be cancelled while its order/shipments are not. |
| 6 | Processing | **Transient in-flight** — the wave is actively releasing picking tasks. Distinct from Order "Processing" (2), which is static. |

## `Task.StatusId`

| Id | Meaning |
|---|---|
| 1 | Released |
| 2 | Completed |
| 3 | Cancelled |
| 4 | Planned |

"Open" (work remaining) = `StatusId in (1,4)`. Note `3` (Cancelled) is **not** "open" and **not**
"completed" — filters that key only on 1/2/4 silently ignore cancelled tasks.

## `OperationCodeId`

| Id | Operation | |
|---|---|---|
| 5 | LicensePlateMove | |
| 8 | Pick | |
| 23 | Manual allocation | |
| 29 | Pick (full license plate) | inferred — sales-order state engines treat op 29 as a pick alongside op 8 |
| 24 | Load | created already-Completed(2) — see lifecycle note |
| 39 | Batch Move | parent ✓ |
| 44 | Pick Drop | |
| 57 | Replenishment | parent ✓ |
| 94 | Replenishment License Plate Move | parent ✓ |
| 144 | Batch LicensePlate Move | parent ✓ |
| 153 | CLP Replenishment | parent ✓ |
| 154 | CLP Batch Moves | parent ✓ |

**Parent / gating whitelist** = `{39, 57, 144, 94, 153, 154}` (the `parent ✓` rows). When a picking task
is a chained child of one of these, it stays **Planned(4)** until the parent reaches **Completed(2)**,
then flips to **Released(1)**. See lifecycle note below.

## Fulfillment lifecycle notes (the mechanics behind the codes)

- **Replenishment-gated picking.** Under a **Released(3)** wave, a picking task (op 8) can still be at
  **Planned(4)** because it is a chained child (`Task.ChainHead` = parent task Id) of an incomplete
  Replenishment/Batch-Move parent in the gating whitelist. Wave release keeps the child
  Planned until the parent is Completed(2). A child may also release immediately if it has no such
  parent. A pick is **never** Released while its wave is unreleased.
- **`ChainHead` is a scalar, not a navigation.** There is no OData nav from a child task to its parent
  task, and replenishment/batch parents are **not** reachable under `Shipment/Tasks` (they attach to
  the wave via PickSlip). So "this shipment's picking is blocked pending replenishment" can only be
  inferred from the picking tasks' own StatusId — e.g. "an op-8 at Planned(4) with no op-8 at
  Released(1) or Completed(2)."
- **Shipment status flip.** A shipment moves Released(2) → Executing(4) when its first picking task
  Completes(2) — so any shipment with a completed pick should read as Executing.
- **Load tasks are born completed.** `LoadLicensePlate` creates the op-24 task
  already at Completed(2) — an open (Released/Planned) load task never exists, so "loading in
  progress" is not observable from task status. "Shipment fully loaded" is a per-LP correlation, not
  a status: every active (non-archived) shipping LP on the shipment has a completed op-24 task whose
  `ActualSourceLicensePlateId` equals the LP's Id — the join a loading-status datasource must use.
  Comparing op-24 task *counts* to LP counts is NOT equivalent: duplicate load tasks on one LP
  can mask another LP that was never loaded. There is also no "Loaded" `Shipment.StatusId` — the
  shipment sits at Executing(4) throughout loading until `CompleteSalesOrderShipment` moves it to 8.
- **Wave 6 vs Order 2.** Both surface as "Processing" in UIs but mean opposite things: Wave 6 is
  actively in-flight (don't advertise release/process actions against it); Order 2 is the steady
  resting state.

## Task free-form payload fields: `Result` and `Notes`

`Task.Result` is declared in the OData metadata as a plain `<Property Name="Result" Type="Edm.String" />` — unbounded MaxLength, nullable, **no XML/JSON content-type annotation**. The "Result is XML" convention is runtime/UI behavior, not a schema constraint: the field can store any serialization format (XML, JSON, plain text).

- When choosing a serialization format for `Task.Result`, ask "what reads this — do downstream consumers parse it as XML?" If the Task UI in play renders `Result` as parsed XML, XML wins (`$utils.buildXml` makes the conversion trivial); if consumers just show the raw string, JSON is simpler.
- Unbounded `Edm.String` means no truncation worries for moderate payloads, but be mindful of database row-size implications for very large structured payloads (thousands of entries).
- `Task.Notes` is the shorter free-text sibling used for brief annotations — fine for one-line summaries; use `Result` for the structured payload.
