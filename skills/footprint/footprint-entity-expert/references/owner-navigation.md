# Owner / Project Navigation

The path from any given Footprint entity to its **Owner** (the 3PL customer the inventory belongs to) varies by entity. Choosing the wrong path silently returns the wrong owner — or null — for cross-project records. This is one of the most common modeling mistakes in Footprint reports.

Owners and projects are the universal grouping dimensions for 3PL reporting. Almost every customer-facing report needs to filter, group, or label by owner, so getting the navigation right is foundational.

## The two dominant paths

```
LOT-RESIDENT path:    Lot → Material → Project → Owner
PROJECT-RESIDENT path: Project → Owner   (Project is on the entity directly)
```

Which path applies depends on whether the entity has a direct `Project` relationship or whether the project is only reachable through the inventory's lot.

## Path lookup by entity

| Entity | Path to Owner | Why |
|--------|---------------|-----|
| `ArchivedShippingLicensePlateContents` (ASLPC) | `Lot → Material → Project → Owner` | LP-content rows are inventory-resident; the project lives on the material, not the shipment |
| `LicensePlateContents` (live equivalent) | `Lot → Material → Project → Owner` | Same model as ASLPC |
| `Tasks` (any operation) | `Project → Owner` | Tasks have a direct `ProjectId` — at task time, the inventory's lot may not exist yet (e.g., receiving) |
| `Shipments` | `Order → Project → Owner` | Order-resident; the shipment's project comes through its order |
| `Orders` | `Project → Owner` | Direct |
| `Lots` | `Material → Project → Owner` | Material-resident |
| `Materials` | `Project → Owner` | Direct |
| `LicensePlates` (the LP itself, not its contents) | Mixed — depends on context. For a single-lot LP, `Lot → Material → Project → Owner`. For a mixed-lot LP, owner is row-level (per content row) — query through ASLPC / LicensePlateContents instead |

If you don't see the entity here, check `dxs schema entity <Name>` for whether it has a `ProjectId` (use `Project → Owner`) or only a `LotId` / `MaterialId` (use the full chain).

## Why ASLPC doesn't go through Shipment

A natural-but-wrong instinct: `ASLPC → LicensePlate → Shipment → Order → Project → Owner`. This works for **most** rows because the shipment's order is usually for the same owner as the inventory. It breaks when:

- The shipment carries inventory from multiple owners (consolidated outbound)
- The shipment was re-routed mid-process to a different order
- The order was edited after picking but the inventory was already allocated

In all these cases, the order's owner is no longer the right answer for that row's inventory. **The lot is the source of truth for whose inventory it is.** Walk the lot path.

The Shipment path is appropriate for *shipment-level* attributes (carrier, ship-to address, ship date) — just not for owner.

## Why Tasks doesn't go through Lot

Receiving Tasks fire **before the lot exists** in the system (lot creation happens at task close). At query time for a not-yet-completed task, `Lot` is null. Even for completed tasks, the Task-resident `ProjectId` is the canonical owner attribution — Footprint sets it when the task is created.

For non-receiving tasks (picking, replenishment, etc.), the Lot exists, but `Project → Owner` is still the right path because the task's project tracks any mid-flight reassignment that the lot's project might not.

## Filter syntax

OData lets you filter through the navigation chain:

```
# ASLPC: shipped inventory for owner 47
$filter=Lot/Material/Project/OwnerId eq 47

# Receiving Tasks: tasks for owner 47
$filter=Project/OwnerId eq 47

# Shipments: shipments for owner 47
$filter=Order/Project/OwnerId eq 47
```

For multi-owner reports, use `in`:

```
$filter=Lot/Material/Project/OwnerId in (47, 52, 61)
```

## Expand syntax

Expand the chain to surface the owner name in the row:

```
# ASLPC owner expansion
$expand=Lot($expand=Material($expand=Project($expand=Owner($select=Id,Name))))

# Tasks owner expansion
$expand=Project($expand=Owner($select=Id,Name))
```

Always `$select` the leaf to avoid pulling all of `Owner`'s properties (and its expansions of its own).

## Display in reports

When grouping a report by owner:

```
=Fields!Lot_Material_Project_Owner_Name.Value     // ASLPC dataset
=Fields!Project_Owner_Name.Value                  // Tasks dataset
```

The dot-notation in OData becomes underscores in the report DataSet field `Name`. See [../../datex-studio-shared/report-authoring/dataset-rules.md](../../../datex-studio/datex-studio-shared/report-authoring/dataset-rules.md) for the field-naming convention.

## Anti-patterns

| Anti-pattern | Symptom | Fix |
|--------------|---------|-----|
| Walking `Shipment → Order → Owner` for ASLPC | Cross-owner consolidations attribute to the order's owner, not the inventory's | Walk `Lot → Material → Project → Owner` |
| Walking `Lot → Material → Project → Owner` for receiving Tasks | Null owner on tasks where the lot doesn't exist yet | Walk `Project → Owner` |
| Hard-coding `Owner.Id` filter on the wrong navigation | Empty result set | Verify the path with this table |
| Leaving the chain expanded with no `$select` on Owner | Each row pulls all of Owner's properties (and Owner's expansions) — query bloat | `Owner($select=Id,Name)` |
| Treating `Project` and `Owner` as interchangeable | Multi-project owners (most owners have several projects) get aggregated incorrectly when grouping by Project | Decide which dimension the report needs and stick with it |
