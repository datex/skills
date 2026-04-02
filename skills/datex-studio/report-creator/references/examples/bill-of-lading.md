# Platonic Ideal: Bill of Lading

> Derived from 25 RDLX-JSON reports across 21 customers.

## Definition

A Bill of Lading (BOL) is a full-page (8.5" x 11", portrait) shipping document that accompanies outbound freight. It identifies the shipper, consignee, carrier, and itemizes the goods being transported with quantities and weights. The canonical BOL is a continuous-section report driven by a header dataset for shipment-level data and a details dataset for line items, rendered at print time with hidden parameters that bind it to a specific order or shipment.

## Standard Layout Properties

| Property | Standard Value | Frequency |
|----------|---------------|-----------|
| Page Size | 8.5in x 11in | 25/25 (100%) |
| Orientation | Portrait | 24/25 (96%) |
| Layout Engine | ReportSections, Type: "Continuous" | 25/25 (100%) |
| Outer Margins | 0in (all sides) | 25/25 (100%) |
| Section Margins | 0.22in-1.0in (varies) | -- |
| DisplayType | Page | 25/25 (100%) |
| SizeType | Default | 25/25 (100%) |
| CollapseWhiteSpace | True | ~21/25 (84%) |
| PaperOrientation | Portrait | 24/25 (96%) |
| DataProvider | JSONEMBED | 25/25 (100%) |
| Section Width | 6.5in-8.0in (after margins) | -- |

**No report uses FixedPage layout.** All 25 use ContinuousSection with ReportSections.

## Parameters

| Parameter | Type | Hidden | Nullable | Frequency |
|-----------|------|--------|----------|-----------|
| `orderId` | Float | true | varies | 25/25 (100%) |
| `shipmentId` | Float | true | true | 22/25 (88%) |

Two reports substitute domain-specific IDs (`loadcontainerId`, `shippingContainerId`) for `shipmentId`. One report uses `orderId` alone.

## DataSet Architecture

BOL reports follow a consistent hierarchical dataset pattern. The datasets are JSONEMBED-backed with empty `jsondata` and a `Query` path expression.

### Universal Datasets

| Dataset | Query Pattern | Purpose | Frequency |
|---------|--------------|---------|-----------|
| **Header** | `$.Header.result` or `$.Header.result.*` | Shipment-level data: addresses, carrier, dates, references | 25/25 (100%) |
| **Details** / **Contents** | `$.Details.result` or `$dataset:Details/Contents` | Line-item data: materials, quantities, weights | 22/25 (88%) |

### Common Datasets

| Dataset | Query Pattern | Purpose | Frequency |
|---------|--------------|---------|-----------|
| Warehouse Contacts | `$dataset:Header/PreferredWarehouse_WarehousesContactsLookup` | Warehouse contact info | ~14/25 (56%) |
| Project Contacts | `$dataset:Header/Project_ProjectsContactsLookup` | Project/owner contact info | ~14/25 (56%) |
| Shipment Order Lookups | `$dataset:Header/ShipmentOrderLookups` | Cross-references between orders and shipments | ~12/25 (48%) |
| Pallets | `$.Pallets.result` or `$dataset:pallets/result` | Pallet counts, classes, weights | ~8/25 (32%) |

### Dataset Field Counts

Header datasets range from 22 to 95 fields. The median is ~35 fields. Detail/Contents datasets typically have 15-25 fields.

## Universal Header Fields

These fields (or semantic equivalents) appear in >90% of reports:

| Semantic Field | Common Names | Purpose |
|----------------|-------------|---------|
| Bill of Lading # | `BillOfLading`, `billOfLading`, `result_billOfLading` | Primary document identifier |
| Shipped Date | `ShippedDate`, `shippedDate`, `result_shipmentShippedDate` | Date goods left warehouse |
| Carrier Name | `Shipment.Carrier.Name`, `shipmentCarrierName`, `CarrierName` | Freight carrier |
| Trailer # | `Shipment.TrailerId`, `shipmentTrailer`, `TrailerId` | Trailer identifier |
| Seal # | `Shipment.SealId`, `shipmentSeal`, `SealId` | Seal identifier |
| Ship-To Address | `ShipToAddress.Line1`, `.City`, `.State`, `.PostalCode` | Consignee address block |
| Shipper/Owner Address | `OwnerAddress.Line1` or warehouse address fields | Origin address block |
| Owner/Account Name | `orderOwnerName`, `AccountName`, `Project_Owner_Name` | Shipper identity |
| Payment Terms | `ShipmentPaymentTerm`, `shipmentPaymentTerm` | Freight payment (Prepaid/Collect/3rd Party) |
| Shipment Lookup Code | `Shipment.LookupCode`, `shipment_lookupcode` | Shipment reference number |
| Owner Reference | `OrderOwnerReference`, `orderOwnerReference` | Customer PO or reference |

## Universal Detail/Line-Item Fields

| Semantic Field | Common Names | Purpose |
|----------------|-------------|---------|
| Material Code | `MaterialLookupCode`, `material_lookupcode` | SKU/item identifier |
| Material Description | `MaterialDescription`, `material_description` | Item description |
| Quantity / Amount | `Amount`, `PackagedAmount`, `packQuantity` | Units shipped |
| Net Weight | `NetWeight`, `net_weight` | Net weight per line |
| Gross Weight | `GrossWeight`, `gross_weight` | Gross weight per line |
| Lot Code | `LotLookupCode`, `lot_lookupcode` | Lot/batch identifier |
| License Plate Code | `LicensePlateLookupCode`, `licenseplate_lookupcode` | Pallet/LP identifier |

## Common Optional Fields (25-70%)

| Semantic Field | Frequency | Notes |
|----------------|-----------|-------|
| Warehouse Address | ~60% | Origin warehouse address block |
| Warehouse Phone/Contact | ~56% | Via WarehousesContactsLookup dataset |
| PRO Number | ~40% | Carrier tracking/PRO number |
| SCAC Code | ~35% | Standard Carrier Alpha Code |
| Vendor Lot / Expiration | ~30% | Lot-level vendor info and expiration dates |
| Pallet Count / Class | ~32% | Pallet quantity and freight class |
| NMFC Number | ~25% | National Motor Freight Classification |
| Shipment Notes | ~40% | Free-text notes on the shipment |
| Signature Line | ~30% | Driver/receiver signature capture |
| Container Size | ~25% | Container/trailer size |
| Temperature Disclaimer | ~25% | Red-text disclaimer about temperature requirements |

## Uncommon Features (<25%)

| Feature | Count | Notes |
|---------|-------|-------|
| Barcodes (UCCEAN128) | 1/25 | VICS-standard BOL with barcode encoding |
| Barcodes (Code128B) | 1/25 | Barcode on BOL number or shipment reference |
| Checkboxes | 1/25 | Freight class / hazmat checkboxes |
| Temperature Sensor SN | 1/25 | Cold-chain shipment with sensor serial number |
| Country of Origin (COO) | 1/25 | Material and lot-level COO tracking |
| Serial Weight Sheet | 1/25 | Per-serial weight breakdown across 4 column groups |
| Vessel/Voyage Info | 1/25 | Ocean freight: vessel name, voyage ID, steamship line |
| Route Number | 1/25 | Carrier route identifier |
| `loadcontainerId` param | 1/25 | Binds to load container instead of shipment |
| `shippingContainerId` param | 1/25 | Binds to shipping container instead of shipment |

## Repeating Container Distribution

| Container Type | Count | Percentage |
|----------------|-------|------------|
| Tablix | 16/25 | 64% |
| Table (legacy) | 8/25 | 32% |
| BandedList | 5/25 | 20% |
| Rectangle (manual layout) | 3/25 | 12% |

Many reports combine multiple container types (e.g., Tablix for summary + Table for line items). Tablix is the dominant modern choice. BandedList appears in both VICS-standard and simpler layouts.

## Barcode Distribution

| Symbology | Count | Percentage |
|-----------|-------|------------|
| None | 23/25 | 92% |
| UCCEAN128 | 1/25 | 4% |
| Code_128_B | 1/25 | 4% |

Barcodes are **not** a standard feature of BOL reports. They appear only in VICS-standard BOLs (UCCEAN128) and one customer-specific variant (Code128B). This contrasts with license plate labels where barcodes are universal.

## Expression Patterns

### Page Numbering (Universal)
```
="Page " & Globals!PageNumber & " of " & Globals!TotalPages
```

### Date Fallback (Common)
```
=IIF(Fields!ShippedDate.Value = "-", Globals!ExecutionTime, Fields!ShippedDate.Value)
```

### Header Field References via First() (Common)
```
=First(Fields!OwnerReference.Value, "Header")
=First(Fields!CarrierName.Value, "Header")
```

### Weight/Quantity Totals via Sum() (Common)
```
=Sum(Fields!NetWeight.Value)
=Sum(Fields!Amount.Value)
```

### Conditional Visibility (Common)
```
=IIF(Fields!SomeField.Value <> Nothing, true, false)
```

### String Concatenation for Addresses (Common)
```
=Fields!City.Value & ", " & Fields!State.Value & " " & Fields!PostalCode.Value
```

### Date Formatting
Format string: `dd-MMM-yy` or `MM/dd/yyyy` (varies by customer).

## Typography

| Usage | Font Size | Weight | Frequency |
|-------|-----------|--------|-----------|
| Report Title | 10-12pt | Bold | ~80% |
| Section Headers | 8-9pt | Bold | ~90% |
| Field Labels | 7-8pt | Bold | ~85% |
| Field Values | 7-8pt | Normal | ~95% |
| Fine Print / Disclaimers | 6pt | Normal | ~40% |
| Page Numbers | 7-8pt | Normal | ~90% |

No report specifies an explicit FontFamily -- all rely on the default renderer font. Font sizes cluster in the 6-12pt range, with 8pt being the most common body text size.

## Colors

| Color | Usage | Frequency |
|-------|-------|-----------|
| Black | Text, borders | 25/25 (100%) |
| White | Header backgrounds, contrast fills | ~15/25 (60%) |
| `#f44336` (Red) | Disclaimer / warning text | ~6/25 (24%) |

BOL reports are essentially monochrome documents. Red appears only for temperature disclaimers or warning notices.

## Functional Sub-Types

### 1. Standard Outbound BOL (20/25, 80%)
The dominant form. Bound to `orderId` + `shipmentId`, contains header + detail datasets, renders shipper/consignee/carrier info with a line-item table of materials and weights. File naming: `custom_outbound_bill_of_lading_report` or `custom_bill_of_lading_report`.

### 2. VICS BOL (2/25, 8%)
Industry-standard format (Voluntary Interindustry Commerce Solutions). Distinguished by:
- Flattened dataset structure (`flattenedShipments` top-level query)
- UCCEAN128 barcodes
- Strict field naming conventions (no nested objects)
- File naming: `vics_bol_report`

### 3. Container/Load BOL (2/25, 8%)
Bound to a container or load instead of an order/shipment. Uses `loadcontainerId` or `shippingContainerId` parameter. Focuses on container-level aggregation rather than order-level detail.

### 4. Warehouse Transfer BOL (1/25, 4%)
Simplified variant for inter-warehouse transfers rather than customer shipments. Fewer datasets (5 vs 8-10 typical), no project/customer contact lookups.

## Images

| Usage | Count | Percentage |
|-------|-------|------------|
| No images | 10/25 | 40% |
| 1 image (logo) | 10/25 | 40% |
| 2-4 images | 5/25 | 20% |

Images are typically embedded company logos or warehouse identification marks. They are not a defining feature of the BOL format.

## Section Margin Distribution

| Range | Count | Percentage | Notes |
|-------|-------|------------|-------|
| 0.22-0.25in | 10/25 | 40% | Minimal margins, maximizes print area |
| 0.5-0.75in | 5/25 | 20% | Moderate margins |
| 1.0-1.25in | 10/25 | 40% | Standard document margins |

There is no single "correct" margin -- the distribution is bimodal between minimal (0.22-0.25in) and standard (1.0in) margins.

## Anti-Patterns

These features are **absent** from the corpus and should not be added:

- **PageHeader / PageFooter sections** -- 0/25 reports use them; page numbers are placed inside the body
- **FixedPage layout** -- 0/25; all use ContinuousSection
- **Landscape orientation** -- 0/25 (1 report has a wider section width but still declares Portrait)
- **Subreports** -- 0/25; nested data is handled via dataset hierarchies
- **CodeModules / custom code** -- 0/25; all logic is in inline expressions
- **Charts or graphs** -- 0/25; BOLs are text-and-table documents
- **Multiple report sections** -- all use a single ContinuousSection

## Dataset Naming Conventions

Two naming schools exist across the corpus:

| Convention | Example | Frequency |
|------------|---------|-----------|
| **PascalCase** | `Header`, `Details`, `Details_Contents` | ~70% |
| **camelCase / snake_case** | `header`, `pallets_result`, `header_pallet_count` | ~30% |

Nested/child datasets use underscore-separated parent paths: `Header_ShipmentOrderLookups_Shipment_LicensePlates`.

Field naming within datasets mirrors the OData source: `PascalCase` for direct entity properties, dot-notation for expanded navigation properties (`Shipment.Carrier.Name`), and `result_` prefix for flattened/computed fields.

## Summary: What Makes a BOL a BOL

1. **8.5" x 11" portrait, continuous section** -- every single report
2. **Hidden orderId parameter** -- the universal entry point
3. **Header dataset** with shipper, consignee, carrier, and shipment references
4. **Detail/Contents dataset** with materials, quantities, and weights
5. **Address blocks** for ship-from and ship-to
6. **No barcodes** (unlike labels) -- this is a text-and-table document
7. **Monochrome** -- black text on white, with optional red for warnings
8. **Tablix or BandedList** for repeating line items
9. **Page numbering** via `Globals!PageNumber` / `Globals!TotalPages`
10. **No PageHeader/PageFooter** -- all content lives in the body
