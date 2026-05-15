# Datex Design Standards for Print Reports

Official design language for Datex print reports. Source: [Datex University Design Guidelines](https://design.datexuniversity.com/Content/Guidelines/Print_reports.htm). All report layouts should follow these standards unless the user explicitly requests otherwise.

**Key principle:** Reports are used primarily as a means of printing information for labeling or documentation — NOT for data visualization. Use grids, lists, and calendars in the app for data visualization instead.

## Report Categories

Every report falls into one of four categories. Classify during requirements gathering — the category drives layout decisions.

| Category | Examples | Design Priorities |
|----------|---------|-------------------|
| **Labels** | LP label, pallet label | High visibility, large bold text, scannable barcodes, tight margins (0.125in), consistent repeatable layout. Avoid graphics that interfere with scanning. |
| **Official Documentation** | Invoice, BOL | Branded, external-facing, potentially legally compliant. Standard margins (0.5in), company logo, professional layout. |
| **Work Detail** | Pick slip, task sheet | Prioritize key work info, minimize distractions. Only essential fields — reduce clutter. |
| **Inventory/Operations** | Receiving report, activity log | Broad data comparison, detailed tables. Note: these are good candidates for replacement by app components (grids, lists). |

## Color Palette

Use color sparingly. The official palette uses Web Colors names plus one brand color:

| Color | CSS/Web Name | Hex | Usage |
|-------|-------------|-----|-------|
| Black | `Black` | `#000000` | Body text, field values, H1 headings |
| DimGray | `DimGray` | `#696969` | H2 headings, field labels (8pt) |
| LightGray | `LightGray` | `#D3D3D3` | Table row borders (0.25pt), group container borders (0.25pt) |
| Gray | `Gray` | `#808080` | Footer text (page count, timestamps) |
| Datex Purple | — | `#5B08B2` | Table header bottom border only (1.5pt) |

**Rule:** Avoid color unless there is a good reason to use it. Do not use background colors on table headers.

## Typography

| Element | Font | Size | Weight | Color | Notes |
|---------|------|------|--------|-------|-------|
| Heading 1 | Arial | 18pt | Bold | Black | Sentence case, center vertical-align |
| Heading 2 | Arial | 14pt | Normal | DimGray | Sentence case, center vertical-align |
| Body text | Arial | 10pt | Normal | Black | Sentence case |
| Field labels | Arial | 8pt | Normal | DimGray | Above value, bottom vertical-align, no colon |
| Field values | Arial | 10pt | Normal | Black | Below label, top vertical-align. Bold only for identifying/important info |
| Table header cells | Arial | 10pt | Bold | Black | Matches detail cell alignment |
| Table detail cells | Arial | 10pt | Normal | Black | — |
| Numbers (in tables) | Courier New | 10pt | Bold | Black | Monospace for decimal alignment |
| Barcode captions | Courier New | — | Normal | Black | — |
| Footer text | Arial | 8pt | Normal | Gray | Page count, execution timestamp |

**General rules:** Use increased kerning for visibility. Maintain sufficient leading between lines. Use bold sparingly — only for identifying/important information.

## Grid Alignment

All element positions should snap to a **0.25-inch grid**. Set intermediate values (e.g., 0.375in) manually when needed, but prefer 0.25in increments for Top, Left, Width, and Height.

## Margins & Spacing

| Context | Value |
|---------|-------|
| Page margins (standard reports) | 0.5in |
| Page margins (labels) | Exception — typically 0.125in for thermal printers |
| Text padding (all elements) | 2pt |
| Group container borders | 0.25pt LightGray |
| Spacing rule | Larger spaces between elements with larger differences in content |

## Table Standards

| Property | Value |
|----------|-------|
| Max columns | 7 per table |
| Header font | Bold, same size as detail cells |
| Header border | 1.5pt bottom border, Datex Purple (#5B08B2) |
| Header background | None (no background color) |
| Header vertical-align | Bottom |
| Row height | 0.375in standard, 0.25in compact |
| Row vertical-align | Center |
| Row borders | 0.25pt bottom border, LightGray |
| Column borders | None (no vertical dividers between columns) |
| Zebra striping | Not used — use row border lines instead |
| Text alignment | Left for text, right for numeric comparison columns |
| Related columns | Place adjacent for quick information scanning |
| Column width | Prioritize fitting max header/cell text, prevent line wrap |
| Conditional formatting | Use sparingly (bold, red) for important data only |

**Header alignment rule:** Header cells should match the alignment of their detail cells so the label visually anchors to the data below it.

### Totals

- Place totals **underneath** the table (footer row or standalone)
- Label: Bold, 10pt, with colon (e.g., `Total Weight:`)
- Value: Normal, 10pt

### Table styling in CLI

```
--header-style "font-weight:Bold;border-bottom-width:1.5pt;border-bottom-style:Solid;border-bottom-color:#5B08B2;padding:2pt;vertical-align:Bottom"
--detail-style "padding:2pt;vertical-align:Middle;border-bottom-width:0.25pt;border-bottom-style:Solid;border-bottom-color:LightGray"
```

## Field Label-Value Pattern

The standard pattern for displaying a label with its data value:

```
┌─────────────────────┐
│ Field Name           │  ← 8pt Normal DimGray, bottom vertical-align, no colon
│ Field Value          │  ← 10pt Normal Black (Bold if identifying), top vertical-align
└─────────────────────┘
```

**Label rules:**
- Position: above the value
- Font: Arial, 8pt, Normal weight
- Color: DimGray
- Vertical-align: Bottom
- Padding: 2pt left, 0 otherwise
- No colon after label text

**Value rules:**
- Position: below the label
- Font: Arial, 10pt, Normal weight (Bold only for identifying/important information)
- Color: Black
- Vertical-align: Top
- Padding: 2pt

**Grouped data containers:**
- Wrap related label-value pairs in a rectangle with 0.25pt LightGray border
- Single-label group: bold 10pt label with colon if left of values, no colon if above
- Multi-label group: each label above its value, DimGray 8pt, no colons

### JSON example

```json
[
  {"Type": "textbox", "Name": "LblShipFrom", "Left": "0in", "Top": "0in", "Width": "2in", "Height": "0.2in",
   "Value": "Ship From", "Style": {"FontFamily": "Arial", "FontSize": "8pt", "Color": "DimGray", "VerticalAlign": "Bottom", "PaddingLeft": "2pt"}},
  {"Type": "textbox", "Name": "ValShipFrom", "Left": "0in", "Top": "0.2in", "Width": "2in", "Height": "0.25in",
   "Value": "=Fields!ShipperName.Value", "Style": {"FontFamily": "Arial", "FontSize": "10pt", "FontWeight": "Bold", "Color": "Black", "VerticalAlign": "Top", "PaddingLeft": "2pt", "PaddingRight": "2pt", "PaddingTop": "2pt", "PaddingBottom": "2pt"}}
]
```

## Footer Standards

Every report footer should include:

| Element | Format |
|---------|--------|
| Page count | `Page X of Y` |
| Execution timestamp | `MM/dd/yyyy HH:mm` — **do not include seconds**. Consider whether time is necessary at all. |
| Logo | Optional. If used, once per page only. |

**Styling:** All footer text in Gray (`#808080`), Arial 8pt Normal.

### Footer expression examples

```
="Page " & Globals!PageNumber & " of " & Globals!TotalPages
=Format(Globals!ExecutionTime, "MM/dd/yyyy HH:mm")
```

## Header Standards

- Document title (H1: Arial 18pt Bold)
- Logo if required (once per page only, embedded image)
- Do not crowd the header — prioritize title and key identifiers

## Applying These Standards

**During layout prototyping:**

1. Set FontFamily on all textbox elements — `Arial` for text, `Courier New` for numbers/barcodes
2. Use the color palette — no arbitrary hex values
3. Build tables with `--header-style` and `--detail-style` from the CLI examples above
4. Follow the field label-value pattern for all info sections
5. Snap positions to the 0.25in grid
6. Add a PageFooter with page count and timestamp (no seconds)

**During requirements gathering:**
Classify the report into one of the four categories. This drives margin choices, density, branding level, and whether the report is a good candidate for an app component instead.
