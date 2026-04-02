# License Plate Label

## The Platonic Ideal

This guide was created by examining 28 real world License Plate Label reports.

A License Plate Label is a **4x6 inch thermal label** (portrait or landscape depending on printer orientation) with **zero margins**, printed one-per-page using a `BandedList` repeating container. It contains exactly two essential elements:

1. **A Code 128 barcode** encoding the LP LookupCode — spans ~4in wide, ~1.5-2in tall, 8pt Courier New font for the check-digit caption
2. **A large human-readable LP number** — the same LookupCode in 36pt SemiBold/Bold, centered, full-width

That barcode+text pairing is the defining characteristic. Every single label report in the corpus has it. Parameters are always `Hidden: true` (Float type for IDs). No report uses a PageHeader or PageFooter — all content is in the label body.

### Standard Layout Properties

| Property | Value |
|----------|-------|
| Page size | 4in x 6in (portrait) or 6in x 4in (landscape) |
| Margins | 0in all sides |
| DisplayType | Page |
| SizeType | Default |
| CollapseWhiteSpace | True |
| DataSet name | `LicensePlates` (most common convention) |
| Primary field | `LookupCode` |
| Barcode symbology | `Code_128auto` (14/28) or `Code_128_A` (5/28) |
| Barcode font | Courier New, 8pt |
| LP text font | 36pt SemiBold or Bold, centered |

## Common Optional Elements (~25-40% of reports)

A "detailed" LP label adds a secondary information grid below the barcode, typically in a 2-column layout at 9pt font:

| Field | Expression Pattern | Frequency |
|-------|-------------------|-----------|
| Order # | `Fields!OrderLookupCode.Value` | 11/28 (39%) |
| Material code | `Fields!MaterialLookupCode.Value` | 10/28 (36%) |
| Expiration date | `Format(Fields!ExpirationDate.Value, "MM/dd/yyyy")` | 9/28 (32%) |
| Project code | `Fields!ProjectLookupCode.Value` | 8/28 (29%) |
| Lot code | `Fields!LotLookupCode.Value` | 7/28 (25%) |
| Quantity + UOM | `Fields!TotalPackagedAmount.Value & " " & Fields!Packaging.Value` | 7/28 (25%) |
| Manufacture date | `Format(Fields!ManufactureDate.Value, "MM/dd/yyyy")` | 5-7/28 |
| Vendor lot | `Fields!VendorLotLookupCode.Value` | 5/28 |

## Uncommon Features (1-3 reports each)

| Feature | Count | Notes |
|---------|-------|-------|
| Customer logo/image | 5 | One customer uses a logo on a standard 4x6 label |
| Spanish language labels | 3 | Field labels in Spanish, Times New Roman font, Code39x barcode, dd/MM/yy date format |
| UCCEAN128 (GS1-128) barcode | 2 | GS1-compliant format for retail/pharma |
| Ti/Hi pallet configuration | 2 | Retail/grocery warehouse requirement |
| Receipt date | 2 | Date product was received into warehouse |
| Owner/Account info | 1 | Shows owner lookup code and name on label |
| DEA number | 1 | Pharmaceutical controlled substance indicator |
| "Reprinted License Plate" indicator | 1 | Static text marking reprint labels |
| IIF prefix switching (PALLET vs CASE) | 1 | Dynamic container type label based on parameter |
| numberOfCopies parameter | 2 | Controls print copy count |
| Flow datasource | 2 | camelCase fields, `labels` sub-array |
| ArchivedShippingLP sub-dataset | 3 | Handles shipped/archived LP contents |
| CodeModules (legacy barcode assembly) | 3 | Legacy custom barcode DLLs |
| Full-page pallet placard | 1 | 8.3x10.8in, ship-to address, content tablix with line items — no barcode |
| Tabular inventory report | 1 | 11x8.5 landscape data table, 15 columns, no barcode — not really a "label" |
| 3x4in ultra-dense format | 1 | 12+ fields on a tiny rotated label, hardcoded company name |

## Two Functional Sub-Types

### Reprint Labels (~18/28)

Look up existing LP records by ID and print their barcode + details. Parameter: `license_plate_ids` or `licensePlateId`.

### Generator Labels (~6/28)

Generate sequential LP numbers from a seed. Parameters: `prefix`, `quantity`/`lp_count`, `length`. DataSet comes from a seed-number generator datasource, not an LP entity lookup.

## Structural Archetypes

- **FixedPage** (16/28): Single page template with `BandedList` or `tblLicensePlates` table for repetition
- **ContinuousSection** (12/28): `ReportSections` with explicit `PageWidth`/`PageHeight` and `BandedList`/`List` container

Both produce identical output — the choice is a matter of authoring era/style.

## Barcode Symbology Distribution

| Symbology | Count |
|-----------|-------|
| Code_128auto | 14 |
| Code_128_A | 5 |
| Code_128_B | 1 |
| Code39x | 3 |
| UCCEAN128 | 2 |

Code 128 (all variants) appears in 20/28 reports — the near-universal choice.

## Page Size Distribution

| Dimensions | Count | Notes |
|------------|-------|-------|
| 4x6 in (portrait) | 10 | Standard thermal label stock |
| 6x4 in (landscape) | 12 | Same stock, rotated for printer |

22/28 reports (79%) use the canonical 4x6 / 6x4 label size.
