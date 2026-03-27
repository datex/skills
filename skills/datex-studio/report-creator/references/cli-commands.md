# CLI Commands Reference

Detailed syntax for `dxs report` commands used during report authoring. SKILL.md references this file for verbose CLI examples — read it when you need exact flags and patterns.

## Table of Contents

- [Batch Operations](#batch-operations)
- [Tablix Creation](#tablix-creation)
- [Tablix Row Grouping](#tablix-row-grouping)
- [Tablix Add Row](#tablix-add-row)
- [Image Handling](#image-handling)
- [Table Cell & Column Management](#table-cell--column-management)
- [DataSet Field Management](#dataset-field-management)
- [Element Editing (set/move/remove)](#element-editing)
- [PageHeader & PageFooter](#pageheader--pagefooter)
- [Validation](#validation)

## Batch Operations

### Input methods

**`--ops-file` (recommended)** — avoids all shell escaping issues:

```bash
cat > /tmp/ops.json << 'OPEOF'
[
  {"action": "add", "type": "textbox", "name": "Title", "value": "PICK SLIP",
   "left": "0in", "top": "0in", "width": "3in", "height": "0.4in",
   "font-size": "20pt", "font-weight": "Bold"},
  {"action": "add", "type": "textbox", "name": "ValField", "value": "=Fields!LookupCode.Value",
   "left": "0in", "top": "0.4in", "width": "3in", "height": "0.3in", "font-size": "14pt"},
  {"action": "add", "type": "barcode", "name": "MyBarcode", "symbology": "Code128",
   "value": "=Fields!LookupCode.Value",
   "left": "5in", "top": "0in", "width": "2.5in", "height": "0.7in"}
]
OPEOF

dxs report batch <file> --ops-file /tmp/ops.json
```

**`--ops -` (stdin heredoc)** — also avoids escaping:

```bash
dxs report batch <file> --ops - << 'OPSEOF'
[
  {"action": "add", "type": "textbox", "name": "Title", "value": "REPORT",
   "left": "0in", "top": "0in", "width": "3in", "height": "0.4in"}
]
OPSEOF
```

**`--ops '<JSON>'` (inline)** — fine for simple ops without `!` or `$` characters.

### Supported actions

| Action | Purpose | Key fields |
|--------|---------|-----------|
| `add` | Add textbox, line, barcode, rectangle, image | `type`, `name`, `value`, position/size |
| `set` | Update styles/properties on existing element | `name`, plus any style/value keys |
| `move` | Reposition an element | `name`, `left`, `top` |
| `remove` | Delete an element | `name` |

Maximum 25 operations per batch.

**`move` does NOT work on lines** — lines use `StartPoint`/`EndPoint`. Edit line positions in JSON directly.

### The `set` action

```json
{"action": "set", "name": "title", "value": "Final Title", "font-size": "18pt", "color": "Navy"}
```

Accepts the same kebab-case style keys as `add`: `font-size`, `font-weight`, `color`, `background-color`, `text-align`, `vertical-align`, etc. Also accepts item keys: `value`, `width`, `height`.

**Border styles:** `border-style`, `border-width`, `border-color` (all sides), and directional variants: `border-top-style`, `border-bottom-width`, `border-left-color`, etc.

### Rectangle containers in batch

Nest child elements inside rectangles using the `"parent"` key:

```json
[
  {"action": "add", "type": "rectangle", "name": "HeaderBox",
   "left": "0in", "top": "0in", "width": "10in", "height": "0.85in"},
  {"action": "add", "type": "textbox", "name": "Title", "value": "REPORT TITLE",
   "parent": "HeaderBox", "left": "0in", "top": "0in", "width": "3in", "height": "0.4in",
   "font-size": "20pt", "font-weight": "Bold"}
]
```

Child coordinates are **relative to the rectangle's top-left corner** (0,0). Moving the rectangle moves everything inside it.

### PageHeader/PageFooter children in batch

Add items to an existing page header or footer using `"parent": "PageHeader"` or `"parent": "PageFooter"`. The page section must be created first via `dxs report add page-header`/`page-footer`.

```json
[
  {"action": "add", "type": "textbox", "name": "PageNum",
   "parent": "PageFooter", "left": "5in", "top": "0in",
   "width": "2.5in", "height": "0.25in",
   "value": "=\"Page \" & Globals!PageNumber & \" of \" & Globals!TotalPages",
   "text-align": "Right", "font-size": "8pt"}
]
```

### Lines in batch

Lines require `start-x`, `start-y`, `end-x`, `end-y` — NOT `left`/`top`/`width`/`height`:

```json
{"action": "add", "type": "line", "name": "Divider",
 "start-x": "0in", "start-y": "2in", "end-x": "7in", "end-y": "2in",
 "line-width": "1pt"}
```

## Tablix Creation

Use `dxs report add tablix` for line-item tables:

```bash
dxs report add tablix <file> --name Grid --left 0in --top 2.5in --width 7.5in --height 4in \
  --dataset ds_lines --columns '1in,3in,1.5in,1.5in' \
  --header-cell Item --header-cell Description --header-cell Qty --header-cell Weight \
  --detail-cell '=Fields!Item.Value' --detail-cell '=Fields!Desc.Value' \
  --detail-cell '=Fields!Qty.Value' --detail-cell '=Fields!Weight.Value' \
  --header-style "background-color:#f0f0f0;padding:2pt;vertical-align:Middle" \
  --detail-style "padding:2pt;vertical-align:Middle"
```

`--header-cell` and `--detail-cell` are repeated options — one per cell. `--header-style`/`--detail-style` set row-level defaults.

### Footer rows

```bash
dxs report add tablix <file> --name Orders --dataset ds_orders --columns '2in,1.5in,1.5in' \
  --header-cell Product --header-cell Qty --header-cell Total \
  --detail-cell '=Fields!Product.Value' --detail-cell '=Fields!Qty.Value' --detail-cell '=Fields!Total.Value' \
  --footer-cell 'Grand Total' --footer-cell '' --footer-cell '=Sum(Fields!Total.Value)' \
  --footer-style 'background-color:#f1f5f9;font-weight:Bold'
```

This generates the correct RowHierarchy: header (`KeepWithGroup: "After"`), detail (Group), footer (`KeepWithGroup: "Before"`). Prefer footer rows over standalone textboxes for totals — they stay anchored to the table.

### Post-creation cell edits

```bash
# Update a specific cell's value or style
dxs report table set-cell <file> --table Grid --row detail --col 2 --value '=Fields!NewDesc.Value'
dxs report table set-cell <file> --table Grid --row header --col 0 --font-weight Bold --background-color "#e0e0e0"

# Add a column (shrinks existing columns proportionally)
dxs report table add-column <file> --table Grid --shrink \
  --header-cell "New Col" --detail-cell '=Fields!NewField.Value'
```

## Tablix Row Grouping

### Grouping on creation (`--group-by`)

Add row grouping to a tablix at creation time. Groups are named with `NAME:EXPRESSION` format. Multiple `--group-by` flags create nested groups (outermost first).

```bash
dxs report add tablix <file> --name Grid --dataset ds_orders --columns '2in,3in,1in' \
  --header-cell Warehouse --header-cell Item --header-cell Qty \
  --detail-cell '=Fields!WarehouseName.Value' --detail-cell '=Fields!ItemName.Value' \
  --detail-cell '=Fields!Qty.Value' \
  --group-by 'wh:=Fields!WarehouseId.Value' \
  --group-header-cell 'wh:=Fields!WarehouseName.Value' \
  --group-header-cell 'wh:' --group-header-cell 'wh:' \
  --group-footer-cell 'wh:Subtotal' --group-footer-cell 'wh:' \
  --group-footer-cell 'wh:=Sum(Fields!Qty.Value)' \
  --footer-cell 'Grand Total' --footer-cell '' --footer-cell '=Sum(Fields!Qty.Value)' \
  --left 0in --top 0in --width 6in --height 3in
```

**Key flags:**

| Flag | Format | Purpose |
|------|--------|---------|
| `--group-by` | `NAME:EXPRESSION` | Define a named group (repeatable, outermost first) |
| `--group-header-cell` | `NAME:VALUE` | Group header cell value (repeat per column per group) |
| `--group-footer-cell` | `NAME:VALUE` | Group footer cell value (repeat per column per group) |
| `--group-header-style` | `NAME:STYLE` | CSS-like style string for group header cells |
| `--group-footer-style` | `NAME:STYLE` | CSS-like style string for group footer cells |
| `--group-header-colspan` | `NAME` | First group header cell spans all columns |
| `--group-footer-colspan` | `NAME` | First group footer cell spans all columns |

### ColSpan on group headers

Group headers commonly display a single banner spanning all columns. Use `--group-header-colspan` with a single `--group-header-cell`:

```bash
dxs report add tablix <file> --name Grid --dataset ds --columns '2in,3in,1in' \
  --header-cell Col1 --header-cell Col2 --header-cell Col3 \
  --detail-cell '=Fields!A.Value' --detail-cell '=Fields!B.Value' --detail-cell '=Fields!C.Value' \
  --group-by 'wh:=Fields!WarehouseId.Value' \
  --group-header-cell 'wh:=Fields!WarehouseName.Value' \
  --group-header-colspan wh \
  --left 0in --top 0in --width 6in --height 2in
```

### Nested multi-level groups

Repeat `--group-by` for nested hierarchy (outermost first):

```bash
dxs report add tablix <file> --name Grid --dataset ds --columns '2in,3in,1in' \
  --header-cell Region --header-cell Item --header-cell Qty \
  --detail-cell '=Fields!ItemName.Value' --detail-cell '=Fields!Desc.Value' \
  --detail-cell '=Fields!Qty.Value' \
  --group-by 'region:=Fields!Region.Value' \
  --group-by 'wh:=Fields!WarehouseId.Value' \
  --group-header-cell 'region:=Fields!RegionName.Value' \
  --group-header-cell 'region:' --group-header-cell 'region:' \
  --group-header-cell 'wh:=Fields!WarehouseName.Value' \
  --group-header-cell 'wh:' --group-header-cell 'wh:' \
  --left 0in --top 0in --width 6in --height 3in
```

This produces nested RowHierarchy: Region group → Warehouse group → Detail group. Body.Rows are ordered depth-first: table header, region header, warehouse header, detail, (footers in reverse).

### Sort expressions (`--sort`)

Sort detail rows within each group. Repeatable for multi-column sort:

```bash
dxs report add tablix <file> --name Grid --dataset ds --columns '2in,3in,1in' \
  --header-cell Name --header-cell Date --header-cell Total \
  --detail-cell '=Fields!Name.Value' --detail-cell '=Fields!Date.Value' \
  --detail-cell '=Fields!Total.Value' \
  --sort '=Fields!Name.Value:asc' \
  --sort '=Fields!Date.Value:desc' \
  --left 0in --top 0in --width 6in --height 2in
```

Format: `EXPRESSION:DIRECTION` where direction is `asc` or `desc` (case-insensitive). Sort expressions attach to the detail group and work with or without `--group-by`.

### Post-creation grouping (`tablix add-group`)

Add a group to an existing flat tablix:

```bash
dxs report tablix add-group <file> --tablix Grid \
  --name wh --expression '=Fields!WarehouseId.Value' \
  --header-cell '=Fields!WarehouseName.Value' \
  --header-cell '' --header-cell '' \
  --footer-cell Subtotal --footer-cell '' --footer-cell '=Sum(Fields!Qty.Value)' \
  --header-style 'background-color:#e0e0e0;font-weight:Bold'
```

This wraps the detail group in a new parent group and inserts header/footer rows at the correct positions. Flags:

| Flag | Purpose |
|------|---------|
| `--tablix` | Target tablix element name |
| `--name` | Group alias name |
| `--expression` | Group expression |
| `--header-cell` | Group header cell (repeat per column) |
| `--footer-cell` | Group footer cell (repeat per column) |
| `--header-style` | Header cell styles |
| `--footer-style` | Footer cell styles |
| `--header-colspan` | Header spans all columns |
| `--footer-colspan` | Footer spans all columns |

### Generated RowHierarchy structure

Without grouping (flat):
```json
"RowHierarchy": {
  "Members": [
    { "KeepWithGroup": "After", "IsStatic": true, "BodyIndex": 0 },
    { "Group": { "Name": "Grid_DetailGroup", "GroupExpressions": [] }, "BodyIndex": 1 },
    { "KeepWithGroup": "Before", "IsStatic": true, "BodyIndex": 2 }
  ]
}
```

With `--group-by 'wh:=Fields!WarehouseId.Value'` and group header/footer:
```json
"RowHierarchy": {
  "Members": [
    { "KeepWithGroup": "After", "IsStatic": true, "BodyIndex": 0 },
    {
      "Group": { "Name": "Grid_WhGroup", "GroupExpressions": ["=Fields!WarehouseId.Value"] },
      "BodyCount": 3,
      "Children": [
        { "KeepWithGroup": "After", "IsStatic": true, "BodyIndex": 1 },
        { "Group": { "Name": "Grid_DetailGroup", "GroupExpressions": [] }, "BodyIndex": 2 },
        { "KeepWithGroup": "Before", "IsStatic": true, "BodyIndex": 3 }
      ]
    },
    { "KeepWithGroup": "Before", "IsStatic": true, "BodyIndex": 4 }
  ]
}
```

## Tablix Add Row

Add rows to an existing tablix — either inside a group (header/footer) or at the table level. This keeps `Body.Rows` and `RowHierarchy` in sync automatically.

### Group header/footer rows

Add a row inside an existing group. `--group` takes the alias used when the group was created (e.g., `wh`). `--cell` is repeated once per column (positional, left-to-right). Cell count must match the number of tablix columns.

```bash
dxs report tablix add-row <file> --tablix Grid \
  --group wh --position header \
  --cell '=CountRows("Grid_WhGroup")' \
  --cell '' \
  --cell '=Format(Sum(Fields!Pct.Value), "0.00%")' \
  --cell-style 'font-size:9pt;font-weight:Bold;padding:4pt' \
  --height 0.28in
```

```bash
dxs report tablix add-row <file> --tablix Grid \
  --group wh --position footer \
  --cell 'Group Total' --cell '' \
  --cell '=Sum(Fields!Qty.Value)' \
  --height 0.25in
```

### Table-level rows

Add rows at the outermost level (outside all groups). No `--group` needed.

```bash
# Extra table header row
dxs report tablix add-row <file> --tablix Grid \
  --position table-header \
  --cell 'Supplemental Header' --cell '' --cell '' \
  --height 0.3in

# Grand total footer row
dxs report tablix add-row <file> --tablix Grid \
  --position table-footer \
  --cell 'Grand Total' --cell '' \
  --cell '=Sum(Fields!Qty.Value)' \
  --cell-style 'font-weight:Bold;background-color:#f1f5f9' \
  --height 0.25in
```

### Flags

| Flag | Purpose |
|------|---------|
| `--tablix` | Target tablix element name |
| `--position` | `header`, `footer` (group-level), `table-header`, `table-footer` (table-level) |
| `--group` | Group alias (required for `header`/`footer`, forbidden for `table-*`) |
| `--cell` | Cell value (repeat once per column, positional left-to-right) |
| `--cell-style` | CSS-like style string applied to all cells in the row |
| `--height` | Row height (default: `0.25in`) |

### Multiple rows

Call `add-row` multiple times to add multiple rows at the same position. New header rows are inserted after existing headers; new footer rows after existing footers:

```bash
# First group header row (original from --group-header-cell at creation)
# Second group header row (added via add-row)
dxs report tablix add-row <file> --tablix Grid --group wh --position header \
  --cell 'Row 1' --cell '' --cell ''

# Third group header row
dxs report tablix add-row <file> --tablix Grid --group wh --position header \
  --cell 'Row 2' --cell '' --cell ''
```

### Per-cell style refinement

`--cell-style` applies to all cells in the row. To style individual cells differently, use `batch set` afterward with the auto-generated cell names (pattern: `{Tablix}_{Group}_GHdr{N}_{Col}` for group headers, `{Tablix}_THdr{N}_{Col}` for table headers).

## Image Handling

### Embedded images (logos, static graphics)

```bash
dxs report add image <file> --name CompanyLogo --file logo.png \
  --left 0in --top 0in --width 2in --height 0.5in
```

The CLI reads the file, base64-encodes it, and stores it in `EmbeddedImages`. `--file` auto-detects MIME type from extension (`.png`, `.jpg`, `.gif`, `.svg`, `.webp`). Max 5 MB.

### Database-bound images (dynamic content from a dataset)

```bash
dxs report add image <file> --name ProductPhoto --source Database \
  --value '=Fields!ProductImage.Value' --mime-type image/png \
  --left 0in --top 0in --width 2in --height 2in
```

Database-bound images require the field value to be a data URI in the sample data file — use `dxs report data add-image` to encode image files into `.data.json` (see [sample-data.md](sample-data.md)).

### Sizing options

Set with `--sizing`:
- `FitProportional` (default) — preserves aspect ratio
- `Fit` — stretch to fill
- `AutoSize` — original size
- `Clip` — crop to bounds

## DataSet Field Management

### Add a dataset

```bash
dxs report dataset add <file> --name ds_shipment \
  --field Id --field LookupCode --field Status \
  --field "Account.Name" \
  --field "OrderDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]"
```

Creates the DataSet with proper Name/DataField mapping (dots → underscores, date annotations stripped from Name), `CommandText = $.{name}.result.*`, and sensitivity properties.

### Add fields to existing dataset

```bash
dxs report dataset add-field <file> --dataset ds_shipment --field StoreNumber
dxs report dataset add-field <file> --dataset ds_shipment --field "Account.Name" --field "ShipDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]"
```

## Element Editing

### Style and value changes

```bash
dxs report set <file> ElementName --font-size 12pt --font-weight Bold
dxs report set <file> ElementName --value "New Value" --color Navy
dxs report set <file> ElementName --width 3in --height 1in
```

### Reposition

```bash
dxs report move <file> ElementName --left 1in --top 2in
```

### Remove

```bash
dxs report remove <file> ElementName
```

## PageHeader & PageFooter

Page headers/footers live at the section level (not in the body). Use dedicated CLI commands to create them, then batch to add child elements.

### Create the container

```bash
dxs report add page-header <file> --height 0.5in
dxs report add page-footer <file> --height 0.3in
```

| Flag | Purpose |
|------|---------|
| `--height` | Section height (required) |
| `--no-first-page` | Don't print on the first page |
| `--no-last-page` | Don't print on the last page |

### Add items via batch

Once the container exists, add child elements using `"parent": "PageHeader"` or `"parent": "PageFooter"` in batch:

```bash
dxs report add page-footer <file> --height 0.3in

dxs report batch <file> --ops-file /tmp/footer-ops.json
```

```json
[
  {"action": "add", "type": "textbox", "name": "FooterLeft",
   "parent": "PageFooter", "left": "0in", "top": "0in",
   "width": "3in", "height": "0.25in",
   "value": "Confidential", "font-size": "8pt"},
  {"action": "add", "type": "textbox", "name": "PageNum",
   "parent": "PageFooter", "left": "5in", "top": "0in",
   "width": "2.5in", "height": "0.25in",
   "value": "=\"Page \" & Globals!PageNumber & \" of \" & Globals!TotalPages",
   "text-align": "Right", "font-size": "8pt"}
]
```

### Common patterns

**Page numbers (right-aligned footer):**

```bash
dxs report add page-footer <file> --height 0.3in

dxs report batch <file> --ops '[
  {"action": "add", "type": "textbox", "name": "PageNum",
   "parent": "PageFooter", "left": "5in", "top": "0.025in",
   "width": "2.5in", "height": "0.25in",
   "value": "=\"Page \" & Globals!PageNumber & \" of \" & Globals!TotalPages",
   "text-align": "Right", "font-size": "9pt"}
]'
```

**Report title header (skip first page):**

```bash
dxs report add page-header <file> --height 0.5in --no-first-page

dxs report batch <file> --ops '[
  {"action": "add", "type": "textbox", "name": "HeaderTitle",
   "parent": "PageHeader", "left": "0in", "top": "0.1in",
   "width": "4in", "height": "0.3in",
   "value": "Monthly Inventory Report",
   "font-size": "12pt", "font-weight": "Bold"}
]'
```

## Validation

### Static validation

Checks report structure, layout, and expressions without rendering:

```bash
dxs report validate bol.rdlx-json
```

Catches: duplicate element names, missing required properties (e.g., barcode Symbology, image Source), elements outside the page content area, invalid barcode symbologies, and malformed expressions.

### ARJS runtime validation

Loads the report through the ActiveReportsJS rendering engine to capture runtime errors and warnings that static validation cannot detect:

```bash
dxs report validate-arjs bol.rdlx-json
dxs report validate-arjs bol.rdlx-json --data sample.json
dxs report validate-arjs bol.rdlx-json --timeout 60
```

| Flag | Purpose |
|------|---------|
| `--data / -d` | Sample data JSON file; auto-discovers `<file>.data.json` if omitted |
| `--timeout` | Seconds to wait for ARJS rendering (default: 30) |

**Requires:**
- `agent-browser`: `npm install -g @anthropic-ai/agent-browser && agent-browser install`
- `@mescius/activereportsjs`: `npm install` (in `src/dxs/web/frontend/`)

**Catches:** expression evaluation errors (`=Fields!BadField.Value`), datasource binding failures, layout rendering errors, font loading failures, and ARJS internal warnings about unsupported features.

**Output includes:**
- `valid` — `true` if no errors (warnings don't affect validity)
- `page_count` — number of pages rendered
- `errors` — items with severity `error` (from ARJS errorHandler or browser console)
- `warnings` — items with severity `warn`
- `info` — items with severity `info` or `debug`

Each diagnostic item has `severity`, `message`, `details`, and `source` (`arjs` for ARJS errorHandler, `console` for browser console intercepts).

### When to use which

| Scenario | Command |
|----------|---------|
| Quick structural check (no browser needed) | `dxs report validate` |
| Verify expressions resolve correctly with sample data | `dxs report validate-arjs --data sample.json` |
| Debug rendering issues or missing fonts | `dxs report validate-arjs` |
| CI pipeline (fast, no external deps) | `dxs report validate` |
| Pre-upload sanity check (thorough) | Both — `validate` first, then `validate-arjs` |

## Report Schema Commands

```bash
dxs report schema document    # full RDLX-JSON structure
dxs report schema items       # element types
dxs report schema item barcode  # specific element properties
dxs report schema expressions   # expression syntax
```
