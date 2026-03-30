# Design Patterns & Layout Techniques

Reference for report/label layout patterns, sizing, and coordinate system. For official color palette, typography, and table styling rules, see [design-standards.md](design-standards.md).

## Coordinate System

**Body coordinates are content-area-relative.** `Left: 0in, Top: 0in` is the top-left corner of the printable area (inside margins), not the physical page edge.

```
Physical page (8.5in x 11in)
┌─────────────────────────────┐
│  margin                     │
│  ┌───────────────────────┐  │
│  │ (0,0) Content area    │  │  ← Body coordinates start here
│  │                       │  │
│  │  Content width =      │  │
│  │  PageWidth - L - R    │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

Content area dimensions:
- `content_width = PageWidth - LeftMargin - RightMargin`
- `content_height = PageHeight - TopMargin - BottomMargin`

## Grid Alignment

All element positions and sizes should snap to a **0.25-inch grid** (e.g., 0in, 0.25in, 0.5in, 0.75in, 1in). Set intermediate values like 0.375in manually when needed, but prefer 0.25in increments as the default. This ensures professional, consistent alignment across all report elements.

## Design Patterns

### Shipping Label (4x6)

Page: `--page 4x6 --margins 0.125in` (tight margins for thermal printers)

```
┌──────────────────────────────┐  4in x 6in, 0.125in margins
│  ║║║║ Tracking Barcode ║║║║  │  Content area: 3.75in x 5.75in
│                              │
│  FROM: Shipper Name          │  Static label + data-bound field
│        Shipper Address       │
│──────────────────────────────│  Divider line
│  TO:  CONSIGNEE NAME (big)   │  Larger font (12pt bold)
│       Consignee Address      │
│                              │
│  WT: 1,250 LBS  PCS: 12     │  Inline expressions with concat
│──────────────────────────────│
│  ROUTING:                    │
│  ║║║║ Routing Barcode ║║║║║  │
└──────────────────────────────┘
```

Key sizing:
- Barcodes: `3.5in x 0.75in` (Code128 needs width for readability)
- Static labels: `0.5in wide`, 7-8pt font
- Data fields: fill remaining width, 8-10pt font
- Consignee (destination): larger font (12pt bold) — this is what handlers read

### GS1 Logistic Label (4x6)

Standard logistics label following the GS1 Logistic Label Guideline. Used by major retailers for pallet-level shipping. Page: 4x6 portrait, 0.125in margins. Content area: 3.75in x 5.75in.

**Three zones (top → bottom per GS1 standard):**

| Zone | Top range | Content |
|------|-----------|---------|
| Transport | 0–0.85in | Ship From (left) \| Ship To (right) — side-by-side |
| Customer | 0.85–2.75in | Carrier info, GDC/DC grid, item details, case count |
| Supplier | 2.75–5.75in | Pallet type banner (optional), **SSCC-18 barcode** |

**SSCC-18 must be at the bottom.** This is a GS1 requirement — the barcode encoding the SSCC is always the lowest element on the label.

```
┌────────────────────┬────────────────────┐
│ Ship From:         │ Ship To:           │  Transport zone
│ Vendor Name        │ Walmart DC 6097    │  (side-by-side, vertical divider
│ Street Address     │ DC Address         │   at midpoint)
│ City, ST ZIP       │ City, ST ZIP       │
├────────────────────┴────────────────────┤
│ CARRIER                                 │  Customer zone
│ Carrier Name                            │
│ PRO: 583716429    B/L: BOL-2026-00847   │
├──────┬───────┬───────┬──────────────────┤
│ GDC# │ TYPE  │ DEPT  │ ORDER#           │  Grid row with
│ 6097 │ SA    │ 02    │ 5831290476       │  vertical dividers
├──────┴───────┴───────┴──────────────────┤
│ WMIT: 004910053                         │
│ # of cases: (48 cases)                  │
├─────────────────────────────────────────┤
│           MIXED PALLET                  │  Pallet type banner
├─────────────────────────────────────────┤  (data-driven, blank
│                                         │   for single-SKU)
│        ║║║║║║║ GS1-128 ║║║║║║║         │
│        SSCC-18 barcode (large)          │  Supplier zone
│     (00) 1 0036840 192837465 0          │  SSCC at bottom
└─────────────────────────────────────────┘
```

Key sizing:
- SSCC-18 barcode: `3.5in x 2.3in`, symbology `GS1_128`, Caption: true
- GDC# value: 16pt bold (large for quick warehouse identification)
- ORDER# value: 14pt bold
- Ship From/To: 8pt, side-by-side with vertical divider at `X = 1.875in`
- Pallet type banner: 18pt bold, centered, full width

**Label variants** — a single layout supports multiple pallet types via data:

| Variant | PalletType field | WMITNumber field | Banner shows |
|---------|-----------------|------------------|--------------|
| Single SKU | `""` (empty) | `"004910053"` | (blank) |
| Mixed pallet | `"MIXED PALLET"` | `"MIXED PALLET"` | **MIXED PALLET** |
| Pallet pull | `"PALLET PULL"` | `"004910053"` | **PALLET PULL** |

See "Data-Driven Label Variants" in Layout Techniques below.

### Bill of Lading (landscape letter)

Page: 11x8.5 landscape, 0.5in margins. Content area: 10in x 7.5in.

```
┌─────────────────────────────────────────────────────────────────────┐
│  BILL OF LADING (18pt bold)         BOL #: =BOLNumber              │
│                                     Date:  =ShipDate               │
│─────────────────────────────────────────────────────────────────────│
│  SHIPPER (FROM):         │  CONSIGNEE (TO):                        │
│  =ShipperName            │  =ConsigneeName                         │
│  =ShipperAddress         │  =ConsigneeAddress                      │
│                          │                                         │
│  CARRIER:                │  PRO NUMBER:    ║║║ PROBarcode ║║║║║║║  │
│  =CarrierName            │  =PRONumber                             │
│─────────────────────────────────────────────────────────────────────│
│  HU QTY │ PKG QTY │ WEIGHT │ DESCRIPTION    │ CLASS │ NMFC# │ DIM │
│─────────────────────────────────────────────────────────────────────│
│  (detail rows with grid lines every 0.3in)                         │
│─────────────────────────────────────────────────────────────────────│
│  TOTAL WEIGHT: =Total    TOTAL PIECES: =Total                      │
│  SPECIAL INSTRUCTIONS: =SpecialInstructions                        │
│  SHIPPER SIG: ___________    DRIVER SIG: ___________               │
└─────────────────────────────────────────────────────────────────────┘
```

Layout zones (top-to-bottom):

| Zone | Top range | Content |
|------|-----------|---------|
| Header | 0–0.7in | Title, BOL#, Date, divider |
| Parties | 0.8–1.9in | Shipper (left half) + Consignee (right half) |
| Carrier/PRO | 2.0–2.85in | Carrier (left) + PRO number & barcode (right) |
| Line items | 3.0–5.3in | Column headers + grid lines at 0.3in intervals |
| Footer | 5.3–6.5in | Totals, special instructions, signature lines |

Two-column layout: left half (0–5in), right half (5.25in–10in) with a 0.25in gutter.

### Tabular Activity Report (landscape letter)

Page: 11x8.5 landscape, 0.5in margins. Content area: 10in x 7.5in.

Used for activity logs, receiving reports, inventory movements — any report that is primarily a filtered table of records.

```
┌─────────────────────────────────────────────────────────────────────┐
│  REPORT TITLE (16pt bold, centered)                                 │
│  Warehouse: =Value       Project: =Value       Date Range: X - Y    │
│─────────────────────────────────────────────────────────────────────│
│  Col1    │ Col2   │ Col3   │ Col4        │ Col5  │ Col6 │ ...       │
│─────────────────────────────────────────────────────────────────────│
│  data    │ data   │ data   │ data        │ data  │ data │ ...       │
│  data    │ data   │ data   │ data        │ data  │ data │ ...       │
│  (repeating detail rows via Table element)                          │
│─────────────────────────────────────────────────────────────────────│
│  Page X of Y          Generated: MM/dd/yyyy HH:mm                   │
└─────────────────────────────────────────────────────────────────────┘
```

Layout zones:

| Zone | Top range | Content |
|------|-----------|---------|
| Header | 0–0.35in | Title (16pt bold, centered, full width) |
| Subtitle | 0.4–0.6in | Parameter labels (Warehouse, Project, Date Range) |
| Divider | 0.7in | Horizontal line |
| Table | 0.8in–7.0in | Table element with header + detail rows |
| Footer | 7.2in | Page number + generation timestamp (7pt, centered) |

Key sizing:
- Table header row: 0.375in height (0.25in compact), Bold, no background, 1.5pt bottom border in Datex Purple (`#5B08B2`), left-aligned with `PaddingLeft: 2pt`
- Detail rows: 0.375in height (0.25in compact), 0.25pt bottom border in `LightGray`
- Qty/numeric columns: right-aligned with `PaddingRight: 2pt`, use `FontFamily: Courier New` for decimal alignment
- Description column: `CanGrow: true` for long text
- Footer: 8pt, `Gray` (`#808080`), centered. Format: `Page X of Y` + `MM/dd/yyyy HH:mm` (no seconds)

Column width planning — total must equal content width (10in for landscape letter):

| Column type | Typical width |
|-------------|--------------|
| Date/time (MM/dd/yy HH:mm) | 1.0–1.2in |
| Lookup code (short ID) | 0.8–1.0in |
| Description (text) | 1.5–2.0in |
| Numeric (qty, amount) | 0.5–0.6in |
| Short code (UOM, status) | 0.4–0.5in |
| Name (person, location) | 1.0–1.2in |

## Table & Tablix Styling

See [design-standards.md](design-standards.md) for the full table standards including color palette and CLI style strings.

### Row sizing

| Row type | Height | Notes |
|----------|--------|-------|
| Header | 0.375in (0.25in compact) | Bold, bottom vertical-align |
| Detail | 0.375in (0.25in compact) | Center vertical-align |
| Footer/totals | 0.375in | Bold label with colon, normal value |

### Header styling

Table headers use a **1.5pt bottom border in Datex Purple (#5B08B2)** with **no background color**. Do not use gray backgrounds or zebra striping.

```
--header-style "font-weight:Bold;border-bottom-width:1.5pt;border-bottom-style:Solid;border-bottom-color:#5B08B2;padding:2pt;vertical-align:Bottom"
```

### Detail row styling

Detail rows use a **0.25pt bottom border in LightGray** for row separation. No vertical column borders.

```
--detail-style "padding:2pt;vertical-align:Middle;border-bottom-width:0.25pt;border-bottom-style:Solid;border-bottom-color:LightGray"
```

### Max columns

Limit tables to **7 columns** maximum. If more columns are needed, consider splitting into multiple tables or removing less-important columns.

### Cell padding

Always add padding to cells so content doesn't press against borders. Standard padding is `2pt` on all sides. Use `--header-style` and `--detail-style` at creation time to apply padding uniformly rather than styling cells individually.

### Vertical alignment

Header cells: `VerticalAlign: Bottom`. Detail cells: `VerticalAlign: Middle`. Set this in the row-level style.

### Column alignment by data type

Choose alignment based on what the column contains — the goal is scannability:

| Data type | Alignment | Font | Why |
|-----------|-----------|------|-----|
| Currency / money | Right | Courier New Bold | Decimal points line up for quick comparison |
| Quantities (integer counts) | Right | Courier New Bold | Numeric alignment aids scanning |
| Percentages, weights, dimensions | Right | Courier New Bold | Decimal alignment aids comparison |
| Text (names, descriptions, codes) | Left | Arial | Natural reading direction |
| Dates / timestamps | Left or Center | Arial | Center for short formats, left for long |
| Status / short codes (UOM, etc.) | Center | Arial | Short values look best centered in narrow columns |

Header cells should match the alignment of their detail cells so the label visually anchors to the data below it.

## Layout Techniques

### Side-by-Side (Two-Column) Sections

Split a section horizontally using a vertical divider line and positioning elements in left/right columns. Common for Ship From / Ship To address blocks.

```
Content width: 3.75in
Midpoint: 1.875in
Left column:  Left = 0.05in,  Width = 1.77in  (midpoint - 0.05in gutter - 0.05in padding)
Right column: Left = 1.925in, Width = 1.77in
```

```json
{ "Type": "line", "Name": "VDiv", "StartPoint": { "X": "1.875in", "Y": "0in" }, "EndPoint": { "X": "1.875in", "Y": "0.85in" }, "LineWidth": "1pt" },
{ "Type": "textbox", "Name": "LeftLabel",  "Left": "0.05in",  "Top": "0.05in", "Width": "1.77in", "Height": "0.15in", "Value": "Ship From:", "Style": { "FontSize": "7pt", "FontWeight": "Bold" } },
{ "Type": "textbox", "Name": "RightLabel", "Left": "1.925in", "Top": "0.05in", "Width": "1.77in", "Height": "0.15in", "Value": "Ship To:",   "Style": { "FontSize": "7pt", "FontWeight": "Bold" } }
```

For wider labels (e.g., 10in BOL content area), use a wider gutter:
- Left column: `0–4.875in`, Right column: `5.125in–10in` (0.25in gutter)

### Grid Rows with Vertical Dividers

For tabular data (GDC#, TYPE, DEPT, ORDER#), use multiple vertical divider lines spanning just the grid section's vertical range, with column header textboxes above value textboxes.

```json
{ "Type": "line", "Name": "VDivCol1", "StartPoint": { "X": "0.85in", "Y": "1.65in" }, "EndPoint": { "X": "0.85in", "Y": "2.2in" }, "LineWidth": "1pt" },
{ "Type": "line", "Name": "VDivCol2", "StartPoint": { "X": "1.5in",  "Y": "1.65in" }, "EndPoint": { "X": "1.5in",  "Y": "2.2in" }, "LineWidth": "1pt" },
{ "Type": "textbox", "Name": "Col1Header", "Left": "0.05in", "Top": "1.67in", "Width": "0.75in", "Height": "0.13in", "Value": "GDC#", "Style": { "FontSize": "7pt", "FontWeight": "Bold" } },
{ "Type": "textbox", "Name": "Col1Value",  "Left": "0.05in", "Top": "1.82in", "Width": "0.75in", "Height": "0.33in", "Value": "=Fields!GDCNumber.Value", "Style": { "FontSize": "16pt", "FontWeight": "Bold", "VerticalAlign": "Middle" } }
```

Vertical dividers only span from the top of the grid section to the bottom — they don't extend the full label height.

### Data-Driven Label Variants

Design one label layout that serves multiple variants by using data-bound fields for conditional content. Elements bound to empty fields render as blank space.

**Pattern:** Add a full-width banner textbox bound to a variant field. When the field has a value (e.g., `"MIXED PALLET"`), the banner renders prominently. When empty, the space is blank.

```json
{ "Type": "textbox", "Name": "PalletTypeBanner", "Left": "0in", "Top": "2.78in", "Width": "3.75in", "Height": "0.35in", "Value": "=Fields!PalletType.Value", "Style": { "FontSize": "18pt", "FontWeight": "Bold", "TextAlign": "Center", "VerticalAlign": "Middle" } }
```

This approach avoids maintaining separate label files for each variant. The same `.rdlx-json` file handles all cases — the data controls what's visible:

| Data value | Result |
|-----------|--------|
| `"MIXED PALLET"` | Bold 18pt centered banner |
| `"PALLET PULL"` | Bold 18pt centered banner |
| `""` (empty) | Blank space (no visual change) |

### Rectangle Containers for Section Grouping

Rectangles with `ReportItems` act as container elements — children use **relative coordinates** (0,0 = top-left of the rectangle). Moving or repositioning the rectangle moves all children automatically.

**Use cases:**
- Address blocks (Ship From, Ship To, Bill To) — border + label + data fields move as a unit
- Footer sections — signature lines, totals, legal text grouped together
- Info panels — any cluster of related elements that should maintain internal layout

**How it works:**
1. Create a rectangle with the desired position, size, and optional border
2. Add child elements inside `ReportItems` with coordinates relative to the rectangle
3. Child elements cannot extend outside the rectangle bounds

**Key notes:**
- Nest elements inside rectangles using `--parent`: `dxs report add textbox ... --parent BoxName` (also works in batch with `"parent": "BoxName"`)
- Shared borders come free — the rectangle's `Style.Border` visually groups the children
- Nesting rectangles is supported (containers within containers)

See [json-structure.md](json-structure.md) for the full Rectangle as Container JSON example.

### Changing Margins (Checklist)

Changing page margins affects multiple interdependent properties. Use this checklist to avoid missed updates:

1. **Top-level `Page` margins** — `TopMargin`, `BottomMargin`, `LeftMargin`, `RightMargin`
2. **Section-level `Page` margins** — must match top-level values
3. **Root `Width`** — `PageWidth - LeftMargin - RightMargin`
4. **Section `Width`** — same as root `Width`
5. **`Body.Height`** — `PageHeight - TopMargin - BottomMargin`
6. **Full-width line `EndPoint.X`** — update to new content width
7. **Full-width table `Width`** — update to new content width
8. **Right-aligned element `Left` values** — recalculate based on new content width
9. **Full-width rectangles/address blocks** — update `Width` to new content width

## Element Sizing Reference

### Barcodes

| Context | Width | Height | Symbology |
|---------|-------|--------|-----------|
| Tracking (full width) | 3.5in | 0.75in | Code128 |
| SSCC-18 pallet label | 3.5in | 2.0-2.4in | GS1_128 |
| GTIN-14 case code | 3.5in | 0.85in | ITF14 |
| PRO number (half page) | 3in | 0.75in | Code128 |
| Small label barcode | 2in | 0.5in | Code128 |
| QR code | 1.5in x 1.5in | — | QRCode |

### Text

| Role | Font | Size | Weight | Color | Height |
|------|------|------|--------|-------|--------|
| Heading 1 (document title) | Arial | 18pt | Bold | Black | 0.4in |
| Heading 2 (section title) | Arial | 14pt | Normal | DimGray | 0.3in |
| Field labels | Arial | 8pt | Normal | DimGray | 0.2in |
| Field values | Arial | 10pt | Normal | Black | 0.25in |
| Field values (identifying) | Arial | 10pt | Bold | Black | 0.25in |
| Destination name (labels) | Arial | 12pt | Bold | Black | 0.3in |
| Address blocks | Arial | 10pt | Normal | Black | 0.4-0.5in |
| Table header cells | Arial | 10pt | Bold | Black | 0.375in |
| Table detail cells | Arial | 10pt | Normal | Black | 0.375in |
| Numeric values (tables) | Courier New | 10pt | Bold | Black | 0.375in |
| Footer text | Arial | 8pt | Normal | Gray | 0.25in |

### Lines

- Full-width dividers: `width = content_width`, `height = 0in`
- Grid lines: same width, spaced 0.3in apart vertically
