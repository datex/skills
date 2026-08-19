# Receiving Tasks (`Tasks` filtered to op=2)

For receiving-activity reports — units received, pallets put away, weight in, dock-to-stock — the source entity is `Tasks` filtered to **`OperationCodeId eq 2`** (the receiving operation). This is the OData equivalent of historic SQL "ReceivingActivityRaw" views.

## Why filter on `OperationCodeId`

`Tasks` is the union of every operation in the warehouse — receiving, picking, replenishment, putaway, cycle counts, etc. Without a filter, a receiving query will return everything and aggregate to the wrong totals.

| Operation | `OperationCodeId` |
|-----------|------------------|
| Receiving | **2** |
| Other operations | various — `dxs schema entity OperationCode` to enumerate, or query `OperationCodes?$select=Id,Name` against the live connection |

If a customer adds custom operation types, the IDs above 2 may shift on that connection — verify with `OperationCodes?$select=Id,Name` rather than hardcoding. The receiving op = 2 is universal across Footprint installations as far as known, but other op codes have customer variation.

## Order class exclusions (commonly needed)

A bare receiving query usually pulls in records from order classes that aren't "real" receiving for reporting purposes — internal transfers and replenishment-style movements. **Common exclusions** are order class IDs `3`, `27`, and `29` (internal transfers, replenishment-type operations).

```
$filter=OperationCodeId eq 2 and Order/OrderClassId ne 3 and Order/OrderClassId ne 27 and Order/OrderClassId ne 29
```

These IDs are **commonly applicable but customer-verifiable**: they reflect Footprint's standard order class taxonomy, but customers may add or repurpose IDs in that range. Before shipping a report, verify with the customer (or by querying `OrderClasses?$select=Id,Name`) that those three IDs are the right exclusions for their operation.

## Key fields

| Field | Meaning |
|-------|---------|
| `Id` | Task primary key |
| `OperationCodeId` | Operation type — filter to `2` for receiving |
| `ActualPackagedAmount` | Units actually received (the report total) |
| `ExpectedPackagedAmount` | Units expected — useful for fill-rate / variance reports |
| `NetWeight` / `GrossWeight` | Task-level weights (already aggregated by Footprint at task close) |
| `ActualTargetLicensePlateId` | The LP the task put inventory onto — use `Set<...>.size` for pallet counts |
| `CreatedDateTime` / `CompletedDateTime` | Timing — use `CompletedDateTime` for "when received," `CreatedDateTime` for "when work started" |

## Required `$expand`

A typical receiving query needs:

```
$expand=
  Project($select=Id,Name;$expand=Owner($select=Id,Name)),
  Order($select=Id,LookupCode,OrderClassId)
```

| Why | |
|-----|---|
| `Project.Owner` | Owner grouping. Receiving Tasks reach the owner via `Project.Owner` (NOT through Lot like ASLPC does — Tasks are pre-putaway, the lot may not be created yet) |
| `Order.OrderClassId` | Required for the exclusion filter above |
| `Order.LookupCode` | Useful for displaying the source order on the report |

For pallet/SKU detail, also expand `ActualTargetLicensePlate` and the lot/material as needed:

```
ActualTargetLicensePlate($select=Id,LookupCode),
Material($select=Id,LookupCode,Description)
```

See [owner-navigation.md](owner-navigation.md) for the contrast between Tasks-style owner nav and ASLPC-style owner nav — they diverge.

## Pallet counting

Same dedupe pattern as ASLPC, but on `ActualTargetLicensePlateId`:

```typescript
const palletsReceived = new Set(
  rows.map(r => r.ActualTargetLicensePlateId).filter(Boolean)
).size;
```

The `.filter(Boolean)` matters — some receiving tasks don't produce a target LP (e.g., loose-pick receiving), and `null` would pollute the set.

## Volume considerations

Receiving Tasks at a busy warehouse can exceed 5,000 rows in a single day for a multi-warehouse or multi-week query. **Paginate** — see [../../datex-studio-shared/flow-code-patterns.md#odata-pagination--the-5000-record-cap](../../../datex-studio/datex-studio-shared/flow-code-patterns.md#odata-pagination--the-5000-record-cap).

## Worked query

A weekly receiving-summary at warehouse 12, owner 47, excluding the standard order classes:

```
Tasks
?$select=Id,OperationCodeId,ActualPackagedAmount,NetWeight,GrossWeight,ActualTargetLicensePlateId,CompletedDateTime
&$expand=
  Project($select=Id,Name;$expand=Owner($select=Id,Name)),
  Order($select=Id,LookupCode,OrderClassId)
&$filter=
  OperationCodeId eq 2
  and Order/OrderClassId ne 3
  and Order/OrderClassId ne 27
  and Order/OrderClassId ne 29
  and ActualWarehouseId eq 12
  and Project/OwnerId eq 47
  and CompletedDateTime ge 2026-05-01T00:00:00Z
  and CompletedDateTime le 2026-05-07T23:59:59Z
&$top=5000
&$skip=${$datasource.inParams.skip}
&$orderby=Id
```

The warehouse filter (`ActualWarehouseId`) lives on the Task itself — unlike ASLPC, you don't need to navigate to a parent shipment.

## Anti-patterns

| Anti-pattern | Symptom | Fix |
|--------------|---------|-----|
| Querying `Tasks` without `OperationCodeId` filter | Aggregates include picking/putaway/cycle-count tasks | Always include `OperationCodeId eq 2` for receiving |
| Hardcoding op=2 for non-receiving operations | Wrong op | Verify the operation's ID with `OperationCodes?$select=Id,Name` |
| Skipping the order-class exclusion | Internal transfers inflate "received" totals | Exclude order classes 3, 27, 29 (verify per-customer) |
| Walking `Lot → Material → Project → Owner` for receiving owner | Lot may not exist yet at time of receiving — null owner | Walk `Project → Owner` directly on the Task |
| `count(*)` for pallet count | Tasks without a target LP get counted as zero pallets via `null` IDs | Dedupe `ActualTargetLicensePlateId` and filter `Boolean` |
| Using `CreatedDateTime` for "when received" | Reflects when work was queued, not completed | Use `CompletedDateTime` for receiving completion |
