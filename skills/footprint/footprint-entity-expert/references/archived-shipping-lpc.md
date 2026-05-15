# ArchivedShippingLicensePlateContents (ASLPC)

The OData entity that holds historical shipped inventory at the **lot × license-plate** grain. This is the entity to use for any shipping-history report, billing-by-volume query, or analytics over what was shipped during a date range. It is the OData equivalent of the legacy SQL `ShippingActivityRaw` view.

## When to use ASLPC vs other entities

| Need | Use |
|------|-----|
| Historical shipped volume by date range / warehouse / owner | **ASLPC** |
| Live, in-progress, or pre-ship shipment data | `Shipments` + `ShipmentLines` (not ASLPC) |
| Carrier or freight-class rollups for a finished shipment | ASLPC + `LicensePlate.Shipment.Carrier` expansion |
| Inventory currently on-hand | `LicensePlateContents` (the live, non-archived equivalent) |

ASLPC is **append-only history** — once a shipment ships, its contents are written here and don't change. Use it for anything that needs to be stable across re-queries.

## Grain

One ASLPC row = one (lot, license plate) pairing on a shipped LP. A single LP that contained multiple lots produces multiple ASLPC rows. A single lot spread across multiple LPs produces multiple ASLPC rows. **This affects pallet counting** (see "Deduping pallets" below).

## Key fields

| Field | Meaning |
|-------|---------|
| `Id` | Row primary key |
| `LotId` / `Lot` | The lot this row represents (one of possibly many on the LP) |
| `LicensePlateId` / `LicensePlate` | The shipped LP |
| `Amount` | Per-lot packaged quantity on this LP (units, in the lot's pack) |
| `PackagedId` | The packaging FK — used to match against `Material.PackagingLookups[].PackagingId` for fixed-weight calc |

## Filter / scope fields

These live on the **parent shipment**, not on ASLPC itself — always reach them through `LicensePlate.Shipment.*`:

| Filter | Path |
|--------|------|
| Date range | `LicensePlate/Shipment/ShippedDate ge {from} and LicensePlate/Shipment/ShippedDate le {to}` |
| Warehouse | `LicensePlate/Shipment/ActualWarehouseId eq {warehouseId}` |
| Carrier | `LicensePlate/Shipment/CarrierId eq {carrierId}` |
| Order | `LicensePlate/Shipment/OrderId eq {orderId}` |

**Never** filter ASLPC on `WarehouseId` or `ShippedDate` directly — those properties don't exist on the row, only on the navigated shipment.

## Required `$expand`

Most ASLPC queries need this expand block as a baseline:

```
$expand=
  Lot($expand=
    Material($expand=
      Project($expand=Owner),
      PackagingLookups
    )
  ),
  LicensePlate($expand=
    SerialNumbers,
    Shipment
  )
```

| Why each is needed | |
|--------------------|---|
| `Lot.Material.Project.Owner` | Owner / project navigation — see [owner-navigation.md](owner-navigation.md). The owner does NOT live on `Shipment.Order`; it travels through the lot. |
| `Lot.Material.PackagingLookups` | Fixed-weight calc needs the packaging table to convert `Amount` → weight |
| `Lot.Material.IsFixedWeight` | Branches the weight calculation — see [weight-and-units.md](weight-and-units.md) |
| `LicensePlate.SerialNumbers` | Catch-weight calc reads per-serial weights here (filtered by LotId) |
| `LicensePlate.Shipment` | Date and warehouse filters live on the shipment |

Trim the `$select` down to what the report actually uses — the expand chains are deep and pulling all fields is expensive.

## Weight calculation

ASLPC weight depends on `Material.IsFixedWeight`:

- **Fixed weight:** weight = `PackagingLookups.Weight × Amount`, matching `PackagingLookups.PackagingId === ASLPC.PackagedId`
- **Catch weight:** sum `LicensePlate.SerialNumbers.NetWeight` filtered by `SerialNumbers.LotId === ASLPC.LotId`

The LotId filter on serial numbers is critical — an LP with serials from multiple lots will otherwise double-count. See [weight-and-units.md](weight-and-units.md) for the full formulas, gross-weight variants, and worked examples.

> **Don't use `LicensePlate.NetWeight` / `LicensePlate.GrossWeight` directly for per-lot totals.** Those are LP-level rollups. They're correct for whole-LP totals only. For per-lot or per-owner aggregations, you must compute from packaging or serials.

## Deduping pallets

`Set<LicensePlateId>.size` — one LP can produce multiple ASLPC rows (one per lot it contained). When counting pallets, dedupe by `LicensePlateId` before counting.

```typescript
const palletCount = new Set(rows.map(r => r.LicensePlateId)).size;
```

Don't `count(*)` on ASLPC and call it a pallet count — you'll over-count mixed-lot LPs.

## Volume considerations

ASLPC over a multi-week range at a busy warehouse easily exceeds 5,000 rows — **paginate**. The standalone OData datasource needs a `skip` inParam and the flow must loop. See [../../../datex-studio/shared/flow-code-patterns.md#odata-pagination--the-5000-record-cap](../../../datex-studio/shared/flow-code-patterns.md#odata-pagination--the-5000-record-cap).

## Worked query

A weekly-shipping-summary query at warehouse 12, owner 47, for the first week of May:

```
ArchivedShippingLicensePlateContents
?$select=Id,LotId,LicensePlateId,Amount,PackagedId
&$expand=
  Lot($select=Id;$expand=
    Material($select=Id,LookupCode,IsFixedWeight;$expand=
      Project($select=Id,Name;$expand=Owner($select=Id,Name)),
      PackagingLookups($select=PackagingId,Weight,ShippingWeight)
    )
  ),
  LicensePlate($select=Id;$expand=
    SerialNumbers($select=LotId,NetWeight,GrossWeight),
    Shipment($select=Id,ShippedDate,ActualWarehouseId)
  )
&$filter=
  LicensePlate/Shipment/ActualWarehouseId eq 12
  and LicensePlate/Shipment/ShippedDate ge 2026-05-01T00:00:00Z
  and LicensePlate/Shipment/ShippedDate le 2026-05-07T23:59:59Z
  and Lot/Material/Project/OwnerId eq 47
&$top=5000
&$skip=${$datasource.inParams.skip}
&$orderby=Id
```

Run through `dxs odata execute -c <id> -q '...'` first with `$top=1` to validate the shape, then in the standalone datasource with `--detect-params` and `$top=5000`.

## Anti-patterns

| Anti-pattern | Symptom | Fix |
|--------------|---------|-----|
| Filtering ASLPC by `WarehouseId` directly | Empty results | Filter via `LicensePlate/Shipment/ActualWarehouseId` |
| Walking `Shipment → Order → Owner` for owner | Wrong owner (or null) for cross-project shipments | Walk `Lot → Material → Project → Owner` instead |
| Counting rows for pallet count | Mixed-lot LPs counted multiple times | Dedupe by `LicensePlateId` |
| Using `LicensePlate.NetWeight` for per-lot totals | Whole-LP weight attributed to first lot only | Compute per-lot from packaging (fixed) or filtered serials (catch) |
| Skipping pagination on date-range queries | Silent truncation at 5,000 rows | See pagination link above |
| Not unwrapping `.result` from `$datasources.*.getList()` | Empty array when iterating | `const rows = resp.result ?? []` |
