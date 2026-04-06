# Pick Slip — Corpus Analysis

> **34 reports** from **16 customers**: BRK (4), BSC (2), CAG (2), CCC (1), COM (1), COW (2), CSW (5), Datex (4), ECS (1), FRI (2), JCS (1), MLC (2), NOR (1), PIL (1), TPM (3), VET (2)

## Definition

A **pick slip** is a full-page warehouse document that directs pick operations for outbound orders or waves. It lists materials to be picked, their source locations and license plates, quantities, lot codes, and packaging — along with order/shipment header information (ship-to address, carrier, dates, FOB). The physical format is letter-size paper (8.5" x 11"), almost always rendered in landscape orientation, with one page per order or pick slip within a wave. A barcode (UCCEAN128 or Code128) typically appears in the header for scanner-driven workflows. Weight summaries (net and gross) appear in a footer section.

## Standard Layout Properties

| Property | Value | Frequency |
|----------|-------|-----------|
| **Main page size** | 8.5in x 11in | 34/34 (100%) |
| **Section orientation** | Landscape (11in x 8.5in) | 27/34 (79%) |
| **Main page margins** | 0in all sides | 34/34 (100%) |
| **Section margins** | 0.25in top/bottom, 0.1in left, 0in right | Most common; varies |
| **Layout engine** | ContinuousSection (ReportSections) | 31/34 (91%) |
| **FixedPage** | Used in 3 BRK Reports variants | 3/34 (9%) |
| **Primary repeating container** | List grouped by Order_Id or PickSlip_LookupCode, PageBreak: "Between" | 22/34 (65%) |
| **Data provider** | JSONEMBED (jsondata={}) | 34/34 (100%) |
| **Title font** | 24pt (bold implied) | 30/34 (88%) |
| **Detail font** | 9pt | 30/34 (88%) |
| **Barcode font** | Courier New 8pt | 25/34 (74%) |
| **DisplayType** | "Page" | 34/34 (100%) |
| **SizeType** | "Default" | 34/34 (100%) |
| **PaperOrientation** | "Portrait" | 34/34 (100%) |
| **CollapseWhiteSpace** | "True" | 31/34 (91%) |

## Parameters

| Pattern | Example Names | Type | Frequency |
|---------|--------------|------|-----------|
| **Single order ID** | `orderId` | Float, Hidden | 22/34 (65%) |
| **Single wave ID** | `waveId` | Float, Hidden | 2/34 (6%) |
| **Multi-value wave IDs** | `waveIds` | Float, Hidden, MultiValue | 7/34 (21%) |
| **Multi-value order IDs** | `order_ids` | Float, Hidden, MultiValue | 2/34 (6%) |
| **Dual parameter (order + wave)** | `orderId` + `waveId` (both Nullable) | Float, Hidden | 2/34 (6%) — ECS, JCS |
| **Container/shipment IDs** | `wave_id` + `shippingcontainer_id` + `shipment_id` | Float, Hidden, Nullable | 2/34 (6%) — VET only |

All parameters are **Float** type and **Hidden: true**. No report exposes parameters to the user at render time.

## DataSet Conventions

### Primary DataSet Naming

| DataSet Name | Frequency | Notes |
|--------------|-----------|-------|
| **PickSlip** | 22/34 (65%) | Dominant convention for standard pick slips |
| **PickSlipDetail** | 4/34 (12%) | Used when header/detail split into separate datasets |
| **PickSlip_result** | 1/34 (3%) | JCS wrapper pattern |
| **Data** / **Data_data** | 1/34 (3%) | ECS uses generic naming |
| **Header** | 1/34 (3%) | NOR uses this name |
| **Owner** + **ShipTo** + **PickSlipHeader** + **PickSlipDetail** | 4/34 (12%) | Multi-dataset pattern (CCC, COW x2, PIL) |
| **data** | 2/34 (6%) | VET label reports |
| **pick_tasks** | 1/34 (3%) | BRK serialized (3-level hierarchy) |

### Dataset Count Per Report

| Count | Frequency | Pattern |
|-------|-----------|---------|
| **1 dataset** | 16/34 (47%) | Single `PickSlip` dataset with all fields |
| **2 datasets** | 6/34 (18%) | Primary + one sub-dataset |
| **3-4 datasets** | 4/34 (12%) | Primary + related lookups |
| **5-8 datasets** | 8/34 (24%) | Multi-dataset: Owner, ShipTo, Header, Detail + sub-datasets |

### Universal DataSet Fields (present in >90% of reports with PickSlip dataset)

| Semantic Field | Common Names | Purpose |
|----------------|-------------|---------|
| **Material lookup code** | `Material_LookupCode`, `OrderLine_Material_LookupCode`, `materialLookupCode` | Item identifier |
| **Material description** | `Material_Description`, `OrderLine_Material_Description`, `materialDescription` | Item name |
| **Expected quantity** | `ExpectedPackagedAmount`, `orderLineAmount` | Pick quantity |
| **Pack/UOM name** | `ExpectedPackagedPack_ShortName`, `ExpectedPackagedPack_Name`, `packagingName` | Unit of measure |
| **Lot code** | `Lot_LookupCode`, `lotCode` | Lot/batch identifier |
| **Source location** | `ExpectedSourceLocation_Name`, `Location`, `location` | Pick-from location |
| **Source license plate** | `ExpectedSourceLicensePlate_LookupCode`, `licensePlateLookupCode` | Pick-from LP |
| **Order lookup code** | `Order_LookupCode`, `OrderNumber` | Order identifier |
| **Shipment lookup code** | `Shipment_LookupCode`, `ShipmentNumber` | Shipment identifier |
| **Pick slip lookup code** | `PickSlip_LookupCode` | Pick slip identifier |
| **Order ID** | `Order_Id`, `OrderId` | Order FK (grouping key) |
| **Shipment wave ID** | `Shipment_WaveId`, `WaveId` | Wave FK |
| **Net weight** | `MaterialWeights_Weight`, `weight` | Per-unit net weight |
| **Shipping weight** | `MaterialWeights_ShippingWeight`, `shippingWeight` | Per-unit gross weight |

### Common DataSet Fields (25-70% of reports)

| Semantic Field | Common Names | Frequency |
|----------------|-------------|-----------|
| **Order created date** | `Order_CreatedSysDateTime`, `OrderDate` | ~20/34 (59%) |
| **Expected ship date** | `Shipment_ExpectedDate` | ~20/34 (59%) |
| **Shipped date** | `Shipment_ShippedDate` | ~18/34 (53%) |
| **Carrier name** | `Shipment_Carrier_Name`, `Carrier` | ~20/34 (59%) |
| **Ship-to address** | `OrderAddress_*` (FirstName, LastName, Line1, Line2, City, State, PostalCode, Country) | ~18/34 (53%) |
| **Owner address** | `OwnerAddress_*` or Owner dataset with contact lookup | ~15/34 (44%) |
| **Project/owner name** | `Order_Project_Owner_Name`, `Project_Owner_Name` | ~18/34 (53%) |
| **Order line notes** | `OrderLine_Notes`, `OrderLine_Marks` | ~18/34 (53%) |
| **Order line number** | `OrderLine_LineNumber` | ~18/34 (53%) |
| **Warehouse name** | `Shipment_Wave_Warehouse_Name` | ~14/34 (41%) |
| **Account name** | `Shipment_Account_Name`, `Order_Account_Name` | ~12/34 (35%) |
| **FOB location** | `Shipment_FobLocation`, `fob` | ~8/34 (24%) |
| **Serial number** | `OrderLine_SerialNumber_LookupCode`, `Serial` | ~6/34 (18%) |

## Barcode Symbology Distribution

| Symbology | Count | Customers |
|-----------|-------|-----------|
| **UCCEAN128** | 14/34 (41%) | BRK/Footprint, CAG/wave, CCC, COM, COW (x2), Datex/outbound, Datex/wave (x2), FRI (x2), PIL, VET (x2) |
| **Code_128auto** | 12/34 (35%) | BRK/Reports (x3), BSC/standard, CAG/orderId, CSW/case-pick (x2), ECS, JCS (x2), MLC (x2) |
| **Code_128_B** | 1/34 (3%) | NOR |
| **No barcode** | 7/34 (21%) | BSC/consolidated, CSW/pick-slips (x3), TPM (x3) |

**Pattern:** UCCEAN128 and Code_128auto are both common and functionally interchangeable for warehouse scanning. Reports without barcodes tend to be simpler consolidated views or the TPM customer's reports (which rely on other identification). The barcode value is almost always `=Fields!PickSlip_LookupCode.Value` or `=Fields!Shipment_WaveId.Value`.

## Universal Expressions

These calculation patterns appear in virtually every pick slip:

```
# Net weight total (weight per unit * quantity)
=sum(Fields!MaterialWeights_Weight.Value * Fields!ExpectedPackagedAmount.Value)

# Gross/shipping weight total
=sum(Fields!MaterialWeights_ShippingWeight.Value * Fields!ExpectedPackagedAmount.Value)

# Total quantity
=Sum(Fields!ExpectedPackagedAmount.Value)

# Today's date (print date)
=Today()

# Location fallback (LP location if available, else direct location)
=IIF(Fields!ExpectedSourceLicensePlate_Location_Name.Value Is Null,
     Fields!ExpectedSourceLocation_Name.Value,
     Fields!ExpectedSourceLicensePlate_Location_Name.Value)

# Ship-to name concatenation
=Fields!OrderAddress_FirstName.Value & "  " & Fields!OrderAddress_LastName.Value
```

## Common Optional Expressions (25-70%)

| Expression Pattern | Frequency | Purpose |
|-------------------|-----------|---------|
| `=Fields!Order_Id.Value` (group expr) | 22/34 (65%) | Page-break grouping by order |
| `="Page " & Globals!PageNumber & " of " & Globals!TotalPages` | 8/34 (24%) | Page numbering |
| `=First(Fields!*.Value, "DataSetName")` | 10/34 (29%) | Cross-dataset field reference |
| `=Fields!Shipment_LookupCode.Value` (barcode value) | 8/34 (24%) | Shipment barcode |
| SWITCH/IIF for status text | 2/34 (6%) | ECS status mapping |

## Colors

| Color | Usage | Frequency |
|-------|-------|-----------|
| **No explicit colors** | Default black-on-white | 27/34 (79%) |
| **#ffcc80** (light orange) | Accent background on header cells | 3/34 (9%) — BRK Reports only |
| **PaleTurquoise** | Table header row background | 1/34 (3%) — BSC consolidated |
| **#e6e6e6** (light gray) | Table cell background | 1/34 (3%) — CAG orderId |

**Anti-pattern:** Color is rare. 79% of reports use no explicit colors at all. Pick slips are functional warehouse documents — color adds no value and wastes toner.

## Special Features

| Feature | Count | Customers |
|---------|-------|-----------|
| **Embedded logo image** | 5/34 (15%) | BRK/Reports (x3), BSC (x2) |
| **CodeModules** (System.Drawing + Datex.Foundation.Reporting.Barcodes) | 3/34 (9%) | ECS, JCS, NOR |
| **PageHeader section** | 3/34 (9%) | BSC (x2), NOR |
| **Multi-level nested datasets** ($dataset: syntax) | 5/34 (15%) | BRK/serialized, NOR, PIL, CCC, COW |
| **BandedList repeating container** | 2/34 (6%) | VET only |
| **Base64-encoded image** (Database source) | 1/34 (3%) | VET/pick_and_shipping |
| **Signature/payment containers** | 2/34 (6%) | BRK/signature, BRK/base |
| **DocumentMap** | 2/34 (6%) | NOR, PIL |
| **Dual parameter (orderId + waveId)** | 2/34 (6%) | ECS, JCS |
| **Username tracking** (printed_by dataset) | 2/34 (6%) | BRK/serialized, BRK/signature |

**Anti-patterns** (features that zero or near-zero reports use):
- **PageFooter**: 0/34 — no report uses a page footer section
- **Subreports**: 0/34 — all data is handled via datasets, not subreport references
- **Chart/Sparkline**: 0/34 — pick slips are text/table documents only
- **FixedPage as primary layout**: 3/34 (9%) — only BRK Reports; all others use ContinuousSection
- **Explicit font family declarations**: ~3/34 — most rely on defaults; only ECS (Tahoma), BRK (Courier New for barcodes) are explicit

## Functional Sub-Types

### 1. Order-Based Pick Slip (by orderId)

The most common variant. Takes a single order ID, groups pick tasks by order, prints one page per order with full header (ship-to, carrier, dates) and detail lines (material, location, LP, qty, lot, weight).

**Reports:** CAG/orderId, CCC, COW (x2), CSW/orderId, Datex/SalesOrders, FRI/orderId, MLC/orderId, NOR, PIL, TPM/FP_Cloud, TPM/Reports/orderId — **~14/34 (41%)**

### 2. Wave-Based Pick Slip (by waveId)

Takes one or more wave IDs. Still groups by Order_Id internally (one page per order within the wave), but the entry point is the wave. Dataset fields are identical to order-based variants.

**Reports:** BRK/Footprint, CSW/waveId, Datex/Waves/wave, FRI/waveId, MLC/waveId, TPM/Reports/waveId — **~7/34 (21%)**

### 3. Consolidated Pick Slip (by wave)

A summary view that groups by wave rather than by order. Focuses on location/material/qty for efficient batch picking. Fewer fields, simpler layout, sometimes without ship-to address detail.

**Reports:** BSC/consolidated, CAG/wave_consolidated, Datex/Waves/consolidated — **3/34 (9%)**

### 4. Shipment-Grouped Pick Slip

Groups by ShipmentNumber rather than Order_Id. The shipment is the primary organizational unit. Often includes nested contact lookups for project owner and account.

**Reports:** BSC/standard, ECS, JCS — **3/34 (9%)**

### 5. Warehouse Transfer Pick Slip

Similar to order-based but for outbound warehouse transfers rather than sales orders. Uses the same field structure but with transfer-specific context.

**Reports:** Datex/WarehouseTransfers/outbound — **1/34 (3%)**

### 6. Case Pick Label

Small-format label (6in x 4in landscape) for case-level picking. Features a large barcode (shipping container ID) and large-font container lookup code. Minimal detail — just container identification for affixing to cases.

**Reports:** CSW/case_pick_label, CSW/case_pick_label_orderid — **2/34 (6%)**

### 7. Pick + Shipping Label (Combo)

Small-format (5in x 6in) label that combines pick information with shipping container details. Uses BandedList instead of List/Table. VET-specific, includes base64-encoded images and multi-section layout.

**Reports:** VET/pick_and_shipping, VET/pick_label — **2/34 (6%)**

### 8. Serialized Pick Slip

Detailed pick slip with multi-level nested datasets (pick_tasks -> Details -> LicensePlateMaterial). Tracks serial numbers, assays, brands at the license plate/material level. Most complex dataset structure in the corpus.

**Reports:** BRK/serialized — **1/34 (3%)**

### 9. Signature Pick Slip

Full pick slip with additional signature, payment, and address container sections. Includes username tracking ("printed by"), accent coloring (#ffcc80), and embedded logo. Designed for paper sign-off workflows.

**Reports:** BRK/signature, BRK/base — **2/34 (6%)**

## Page Size Distribution

| Page Size (Section) | Count | Percentage |
|---------------------|-------|------------|
| **11in x 8.5in** (Landscape) | 27/34 | 79% |
| **8.5in x 11in** (Portrait) | 3/34 | 9% |
| **5in x 6in** (Small label) | 2/34 | 6% |
| **6in x 4in** (Case label) | 2/34 | 6% |

## Repeating Container Distribution

| Container Type | Count | Percentage |
|----------------|-------|------------|
| **List** (with page break grouping) | 22/34 | 65% |
| **Table** (as primary repeater) | 5/34 | 15% |
| **Tablix** (as primary repeater) | 3/34 | 9% |
| **BandedList** | 2/34 | 6% |
| **Table inside FixedPage** | 2/34 | 6% |

## Report Complexity Tiers

| Tier | DataSet Count | Field Count | Reports | Percentage |
|------|--------------|-------------|---------|------------|
| **Simple** | 1-2 datasets, <25 fields | Consolidated, labels | 9/34 | 26% |
| **Standard** | 1-2 datasets, 40-65 fields | Most order/wave pick slips | 17/34 | 50% |
| **Complex** | 3-8 datasets, 60+ fields | Multi-dataset with lookups | 8/34 | 24% |

## Summary

The canonical pick slip is a **landscape ContinuousSection report** on **letter paper** with **zero main-page margins**, driven by a **List grouped by Order_Id** with page breaks between orders. It has a **single PickSlip dataset** with 40-65 JSONEMBED fields, a **UCCEAN128 or Code_128auto barcode** showing the pick slip lookup code, **24pt title**, **9pt detail text**, and **weight summation expressions** in the footer. It takes a single **hidden Float parameter** (orderId or waveIds). It uses **no colors**, **no images**, **no page footer**, and **no subreports**.
