# CLI Commands Reference

Detailed syntax for `dxs report` commands used during report authoring. SKILL.md references this file for verbose CLI examples — read it when you need exact flags and patterns.

## Table of Contents

- [Batch Operations](#batch-operations)
- [Tablix Creation](#tablix-creation)
- [Image Handling](#image-handling)
- [Table Cell & Column Management](#table-cell--column-management)
- [DataSet Field Management](#dataset-field-management)
- [Element Editing (set/move/remove)](#element-editing)
- [PageHeader & PageFooter](#pageheader--pagefooter)

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

Page headers/footers are not body elements — they live at the document root level and require direct JSON editing. See [json-structure.md](json-structure.md) for the full structure.

Common pattern — page numbers in footer:

```json
"PageFooter": {
    "Name": "PageFooter",
    "Height": "0.3in",
    "ReportItems": [{
        "Type": "textbox", "Name": "PageNumber",
        "Value": "=\"Page \" & Globals!PageNumber & \" of \" & Globals!TotalPages",
        "Style": { "FontSize": "9pt", "TextAlign": "Right" },
        "Left": "6.25in", "Top": "0.05in", "Width": "1.75in", "Height": "0.25in"
    }]
}
```

Place `PageFooter` and/or `PageHeader` as siblings of `Page` and `ReportSections` in the document JSON.

## Report Schema Commands

```bash
dxs report schema document    # full RDLX-JSON structure
dxs report schema items       # element types
dxs report schema item barcode  # specific element properties
dxs report schema expressions   # expression syntax
```
