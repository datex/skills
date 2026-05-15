# Weight Calculations: Fixed vs Catch Weight

Footprint materials fall into two weight regimes. Almost every total-weight calculation has to branch on which regime the material is in, and the wrong formula silently produces wrong totals.

## The two regimes

| Regime | `Material.IsFixedWeight` | What it means |
|--------|--------------------------|---------------|
| **Fixed weight** | `true` | The material has a known, constant per-unit weight defined in its packaging. Examples: cases of canned goods, bagged consumer products. Weight is computed: `weight per unit × units shipped`. |
| **Catch weight** | `false` | Each physical unit has its own weight, captured as the actual item is processed. Examples: meat, produce, custom-cut products. Weight is read off captured serial-number records. |

Treating a catch-weight item as fixed (or vice versa) doesn't error — it produces wrong totals.

## Fixed-weight calculation

Each row's weight comes from the **packaging table** on the material:

```
weight = Material.PackagingLookups[match].Weight × Amount
```

Where `match` is the entry in `PackagingLookups` whose `PackagingId` equals the row's `PackagedId`. (Materials can have multiple packagings — case, pallet, individual unit — and each has its own per-unit weight.)

**Fields needed:**

| Source | Field |
|--------|-------|
| Row | `Amount` (units shipped/received), `PackagedId` (which packaging) |
| Material expand | `Material.IsFixedWeight`, `Material.PackagingLookups($select=PackagingId,Weight,ShippingWeight)` |

**Net vs gross:**

```
netWeight   = match.Weight × Amount
grossWeight = match.ShippingWeight × Amount
```

`Weight` is the product weight; `ShippingWeight` includes packaging materials. Use whichever the report needs — many shipping reports want gross.

```typescript
const match = row.Lot.Material.PackagingLookups
    .find(p => p.PackagingId === row.PackagedId);
const net = (match?.Weight ?? 0) * row.Amount;
```

If no packaging match is found (`match === undefined`), that's a data problem — the material was shipped in a packaging that isn't registered. Either treat as zero (and surface the gap in a separate "missing packaging" report), or fall back to a per-unit default — the right answer is customer-specific.

## Catch-weight calculation

Each row's weight comes from the **serial numbers** on the LP, **filtered to this row's lot**:

```
weight = sum(LicensePlate.SerialNumbers where LotId === row.LotId of NetWeight)
```

The lot filter is non-negotiable. An LP that contains serials from multiple lots will otherwise contribute every serial's weight to every row, multiplying totals by the number of lots on the LP.

**Fields needed:**

| Source | Field |
|--------|-------|
| Row | `LotId` |
| LP expand | `LicensePlate.SerialNumbers($select=LotId,NetWeight,GrossWeight)` |

```typescript
const serials = row.LicensePlate.SerialNumbers
    .filter(s => s.LotId === row.LotId);
const net = serials.reduce((sum, s) => sum + (s.NetWeight ?? 0), 0);
const gross = serials.reduce((sum, s) => sum + (s.GrossWeight ?? 0), 0);
```

## The combined function

A complete per-row weight function for ASLPC (or any LP-content row that branches on IsFixedWeight):

```typescript
function calcWeight(row: ASLPCRow): { net: number; gross: number } {
    const material = row.Lot.Material;
    if (material.IsFixedWeight) {
        const match = material.PackagingLookups
            .find(p => p.PackagingId === row.PackagedId);
        return {
            net:   (match?.Weight        ?? 0) * row.Amount,
            gross: (match?.ShippingWeight ?? 0) * row.Amount,
        };
    } else {
        const serials = row.LicensePlate.SerialNumbers
            .filter(s => s.LotId === row.LotId);
        return {
            net:   serials.reduce((s, x) => s + (x.NetWeight   ?? 0), 0),
            gross: serials.reduce((s, x) => s + (x.GrossWeight ?? 0), 0),
        };
    }
}
```

Aggregate across rows by summing what this function returns.

## When NOT to compute weight per row

Some entities pre-compute weights. Use them directly when present:

| Entity | Pre-computed weight field | Notes |
|--------|---------------------------|-------|
| `LicensePlate` | `NetWeight`, `GrossWeight` | LP-level rollup. Correct for whole-LP totals; wrong for per-lot allocations on mixed-lot LPs. |
| `Tasks` (any operation) | `NetWeight`, `GrossWeight` | Task-level rollup, computed by Footprint at task close. Use directly for receiving/picking task weight totals — no branching needed. |
| `Shipments` | aggregate fields | Shipment-level rollups. Use for shipment-summary, not for per-line totals. |

Rule of thumb: **if you're aggregating a flat list of tasks, use the task's own weight fields. If you're aggregating LP contents at the lot level, branch on `IsFixedWeight` and compute.**

## Anti-patterns

| Anti-pattern | Symptom | Fix |
|--------------|---------|-----|
| Always using `LicensePlate.NetWeight` | Mixed-lot LPs over-attribute weight to the first lot | Branch and compute per-lot |
| Skipping the LotId filter on serial numbers | Catch-weight totals multiplied by the number of lots on the LP | `serials.filter(s => s.LotId === row.LotId)` |
| Forgetting to expand `PackagingLookups` | Match returns undefined for every row → all fixed-weight totals are 0 | Add `Material($expand=PackagingLookups($select=PackagingId,Weight,ShippingWeight))` |
| Forgetting to expand `SerialNumbers` | Catch-weight totals are 0 | Add `LicensePlate($expand=SerialNumbers($select=LotId,NetWeight,GrossWeight))` |
| Using `Weight` when the report wants gross (or vice versa) | Off by packaging tare | `Weight` = net (product), `ShippingWeight` = gross (with packaging) |
| Branching on `Material.WeightType` or similar guess | Field doesn't exist | The flag is `IsFixedWeight` (boolean) on `Material` |
