# RDLX-JSON Document Structure

Full template and element formats for direct JSON authoring. Run `dxs report schema document` for the live reference.

## Document Template

```json
{
    "Name": "my-report",
    "Width": "<content_width>",
    "Page": {
        "PageWidth": "<page_width>",
        "PageHeight": "<page_height>",
        "TopMargin": "<margin>",
        "BottomMargin": "<margin>",
        "LeftMargin": "<margin>",
        "RightMargin": "<margin>",
        "Columns": 1,
        "ColumnSpacing": "0in",
        "PaperOrientation": "Portrait"
    },
    "ReportSections": [
        {
            "Type": "Continuous",
            "Name": "Section1",
            "Page": { "...same as top-level Page..." },
            "Width": "<content_width>",
            "Body": {
                "Height": "<content_height>",
                "ReportItems": [
                    { "...elements go here..." }
                ]
            }
        }
    ],
    "DataSources": [
        {
            "Name": "Datasource",
            "ConnectionProperties": {
                "DataProvider": "JSONEMBED",
                "ConnectString": "jsondata={}"
            }
        }
    ],
    "DataSets": [
        {
            "Name": "ds_my_report",
            "Fields": [
                { "Name": "Id", "DataField": "Id" },
                { "Name": "MyDate", "DataField": "MyDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]" },
                { "Name": "Account_Name", "DataField": "Account.Name" }
            ],
            "Query": {
                "DataSourceName": "Datasource",
                "CommandText": "$.ds_my_report.result.*"
            },
            "CaseSensitivity": "Auto",
            "KanatypeSensitivity": "Auto",
            "AccentSensitivity": "Auto",
            "WidthSensitivity": "Auto"
        }
    ],
    "ReportParameters": [],
    "CustomProperties": [
        { "Name": "DisplayType", "Value": "Page" },
        { "Name": "SizeType", "Value": "Default" }
    ],
    "Layers": [{ "Name": "default" }],
    "Version": "10.0.1"
}
```

## Element JSON Formats

**Textbox:**
```json
{ "Type": "textbox", "Name": "UniqueId", "Left": "0in", "Top": "0in", "Width": "2in", "Height": "0.25in", "Value": "=Fields!Name.Value", "CanGrow": true, "Style": { "FontSize": "10pt", "FontWeight": "Bold", "TextAlign": "Center", "VerticalAlign": "Middle" } }
```

**Barcode:**
```json
{ "Type": "barcode", "Name": "UniqueId", "Left": "0in", "Top": "0in", "Width": "3.5in", "Height": "0.75in", "Value": "=Fields!Code.Value", "Symbology": "GS1_128", "Caption": true }
```

**Line (horizontal divider):**
```json
{ "Type": "line", "Name": "UniqueId", "StartPoint": { "X": "0in", "Y": "1in" }, "EndPoint": { "X": "3.75in", "Y": "1in" }, "LineWidth": "2pt" }
```

**Line (vertical divider):**
```json
{ "Type": "line", "Name": "UniqueId", "StartPoint": { "X": "1.875in", "Y": "0in" }, "EndPoint": { "X": "1.875in", "Y": "1in" }, "LineWidth": "2pt" }
```

> **IMPORTANT — Line elements:** Lines use `StartPoint`/`EndPoint` with `X`/`Y` coordinates — NOT `Left`/`Top`/`Width`/`Height`. Line thickness is set via top-level `LineWidth` property — NOT inside `Style`. Using `Left`/`Top`/`Width`/`Height` on a line will silently map to (0,0)/(0,0).

**Rectangle:**
```json
{ "Type": "rectangle", "Name": "UniqueId", "Left": "0in", "Top": "0in", "Width": "3.75in", "Height": "0.5in", "Style": { "BackgroundColor": "White", "Border": { "Style": "Solid", "Width": "2pt", "Color": "Black" } } }
```

> **IMPORTANT — Border format:** Rectangles and textboxes use nested `Style.Border` objects — NOT flat `BorderStyle`/`BorderWidth` keys. The flat format is silently ignored.

**Rectangle as Container:**

Rectangles can contain child elements via `ReportItems`. Children use **relative coordinates** — `Left: 0in, Top: 0in` is the top-left of the rectangle, not the page. This makes rectangles ideal for grouping related elements (address blocks, footer sections) that move together.

```json
{
    "Type": "rectangle",
    "Name": "ShipFromBlock",
    "Left": "0in",
    "Top": "0.8in",
    "Width": "5in",
    "Height": "1in",
    "Style": { "Border": { "Style": "Solid", "Width": "1pt", "Color": "Black" } },
    "ReportItems": [
        { "Type": "textbox", "Name": "ShipFromLabel", "Left": "0.05in", "Top": "0.05in", "Width": "1in", "Height": "0.2in", "Value": "SHIPPER (FROM):", "Style": { "FontSize": "8pt", "FontWeight": "Bold" } },
        { "Type": "textbox", "Name": "ShipFromName", "Left": "0.05in", "Top": "0.25in", "Width": "4.9in", "Height": "0.2in", "Value": "=Fields!ShipperName.Value", "Style": { "FontSize": "9pt" } },
        { "Type": "textbox", "Name": "ShipFromAddr", "Left": "0.05in", "Top": "0.45in", "Width": "4.9in", "Height": "0.5in", "Value": "=Fields!ShipperAddress.Value", "CanGrow": true, "Style": { "FontSize": "9pt" } }
    ]
}
```

> **NOTE:** Use `--parent` to nest elements inside rectangles: `dxs report add textbox ... --parent BoxName`. In batch ops, use `"parent": "BoxName"` key. Moving the parent rectangle moves all children automatically.

**Image (embedded from file):**
```json
{ "Type": "image", "Name": "Logo", "Left": "0in", "Top": "0in", "Width": "2in", "Height": "0.5in", "Source": "Embedded", "Value": "Logo", "MIMEType": "image/png", "Sizing": "FitProportional" }
```
Use `dxs report add image <file> --name Logo --file logo.png` to embed — the CLI handles base64 encoding and `EmbeddedImages` array.

**Image (database-bound):**
```json
{ "Type": "image", "Name": "ProductPhoto", "Left": "0in", "Top": "0in", "Width": "2in", "Height": "2in", "Source": "Database", "Value": "=Fields!ProductImage.Value", "MIMEType": "image/png", "Sizing": "FitProportional" }
```

**Image (external URL):**
```json
{ "Type": "image", "Name": "ExternalImg", "Left": "0in", "Top": "0in", "Width": "2in", "Height": "1in", "Source": "External", "Value": "https://example.com/logo.png", "MIMEType": "image/png", "Sizing": "FitProportional" }
```

> Sizing options: `FitProportional` (default, aspect-preserving), `Fit` (stretch), `AutoSize` (original size), `Clip` (crop).

**Shape:**
```json
{ "Type": "shape", "Name": "UniqueId", "Left": "0in", "Top": "0in", "Width": "1in", "Height": "1in", "ShapeType": "Ellipse", "Style": { "BackgroundColor": "LightBlue", "Border": { "Style": "Solid", "Width": "1pt", "Color": "Black" } } }
```

> ShapeType options: Rectangle, RoundedRectangle, Ellipse, Triangle, Cross, Diamond, Pentagon, Hexagon, Star, Arrow.

## Table Element (for collections)

Use a Table element to render collection data (e.g., line items). Tables have header, detail, and optional footer rows.

```json
{
    "Type": "table",
    "Name": "LinesTable",
    "Left": "0in",
    "Top": "3.5in",
    "DataSetName": "LinesDataSet",
    "Header": {
        "TableRows": [{
            "Height": "0.25in",
            "TableCells": [
                { "Item": { "Type": "textbox", "Name": "HdrCol1", "Value": "Line #", "Style": { "FontWeight": "Bold", "FontSize": "8pt" } } },
                { "Item": { "Type": "textbox", "Name": "HdrCol2", "Value": "Description", "Style": { "FontWeight": "Bold", "FontSize": "8pt" } } }
            ]
        }]
    },
    "Details": {
        "TableRows": [{
            "Height": "0.25in",
            "TableCells": [
                { "Item": { "Type": "textbox", "Name": "Col1", "Value": "=Fields!LineNumber.Value" } },
                { "Item": { "Type": "textbox", "Name": "Col2", "Value": "=Fields!Description.Value" } }
            ]
        }]
    },
    "TableColumns": [
        { "Width": "1in" },
        { "Width": "4in" }
    ]
}
```

## Tablix Element (modern data grid)

Tablix is the most-used data element in production reports. It replaces Table for new reports — more flexible grouping, cross-tab support, and better ActiveReportsJS integration.

```json
{
    "Type": "tablix",
    "Name": "ItemsGrid",
    "Left": "0in",
    "Top": "3.5in",
    "DataSetName": "ds_items",
    "Body": {
        "Columns": ["1in", "4in", "1.5in"],
        "Rows": [
            {
                "Height": "0.25in",
                "Cells": [
                    { "Item": { "Type": "textbox", "Name": "HdrItem", "Value": "Item #", "Style": { "FontWeight": "Bold", "FontSize": "8pt", "BackgroundColor": "LightGray" } } },
                    { "Item": { "Type": "textbox", "Name": "HdrDesc", "Value": "Description", "Style": { "FontWeight": "Bold", "FontSize": "8pt", "BackgroundColor": "LightGray" } } },
                    { "Item": { "Type": "textbox", "Name": "HdrQty", "Value": "Qty", "Style": { "FontWeight": "Bold", "FontSize": "8pt", "BackgroundColor": "LightGray", "TextAlign": "Right" } } }
                ]
            },
            {
                "Height": "0.25in",
                "Cells": [
                    { "Item": { "Type": "textbox", "Name": "ColItem", "Value": "=Fields!ItemNumber.Value", "Style": { "FontSize": "8pt" } } },
                    { "Item": { "Type": "textbox", "Name": "ColDesc", "Value": "=Fields!Description.Value", "Style": { "FontSize": "8pt" } } },
                    { "Item": { "Type": "textbox", "Name": "ColQty", "Value": "=Fields!Quantity.Value", "Style": { "FontSize": "8pt", "TextAlign": "Right" } } }
                ]
            }
        ]
    },
    "ColumnHierarchy": {
        "Members": [
            { "BodyIndex": 0, "Group": null },
            { "BodyIndex": 1, "Group": null },
            { "BodyIndex": 2, "Group": null }
        ]
    },
    "RowHierarchy": {
        "Members": [
            { "KeepWithGroup": "After", "IsStatic": true, "BodyIndex": 0 },
            { "Group": { "Name": "DetailGroup", "GroupExpressions": ["=Fields!ItemNumber.Value"] }, "BodyIndex": 1 }
        ]
    }
}
```

> **Tablix vs Table:** Use Tablix for new reports. Table is a legacy element that still works but lacks grouping flexibility. The `RowHierarchy` controls which rows are static headers vs repeating detail rows — the first Member with `IsStatic: true` is the header, and the one with a `Group` repeats per data row. Each leaf member needs a `BodyIndex` (0-based row index). Group members with children use `Children` (not nested `Members`) and `BodyCount`.

## List Element (simple repeating container)

List repeats its `ReportItems` once per data row — useful for card layouts, repeating label sheets, or free-form repeating sections.

```json
{
    "Type": "list",
    "Name": "LabelList",
    "Left": "0in",
    "Top": "0in",
    "Width": "4in",
    "Height": "2in",
    "DataSetName": "ds_labels",
    "ReportItems": [
        { "Type": "textbox", "Name": "LabelName", "Left": "0.1in", "Top": "0.1in", "Width": "3.8in", "Height": "0.25in", "Value": "=Fields!Name.Value", "Style": { "FontSize": "12pt", "FontWeight": "Bold" } },
        { "Type": "barcode", "Name": "LabelBarcode", "Left": "0.1in", "Top": "0.5in", "Width": "3in", "Height": "0.75in", "Value": "=Fields!Code.Value", "Symbology": "Code128", "Caption": true }
    ]
}
```

> **Multi-column labels:** Set `RowsOrColumnsCount` to arrange items in multiple columns (e.g., 2-up or 3-up label sheets).

## PageHeader and PageFooter

Page headers and footers repeat on every page. They live at the **top-level** of the document JSON (siblings of `Page`, `ReportSections`, etc.) — NOT inside `Body.ReportItems`. There is no CLI command for these — add them via direct JSON editing.

**PageFooter with page numbers:**
```json
{
    "PageFooter": {
        "Name": "PageFooter",
        "Height": "0.3in",
        "ReportItems": [
            {
                "Type": "textbox",
                "Name": "PageNumber",
                "CanGrow": true,
                "KeepTogether": true,
                "Value": "=\"Page \" & Globals!PageNumber & \" of \" & Globals!TotalPages",
                "Style": {
                    "FontSize": "9pt",
                    "PaddingLeft": "2pt",
                    "PaddingRight": "2pt",
                    "PaddingTop": "2pt",
                    "PaddingBottom": "2pt",
                    "TextAlign": "Right"
                },
                "Left": "6.25in",
                "Top": "0.05in",
                "Width": "1.75in",
                "Height": "0.25in"
            }
        ]
    }
}
```

**PageHeader (repeating header):**
```json
{
    "PageHeader": {
        "Name": "PageHeader",
        "Height": "0.5in",
        "PrintOnFirstPage": true,
        "PrintOnLastPage": true,
        "ReportItems": [
            {
                "Type": "textbox",
                "Name": "HeaderTitle",
                "Value": "REPORT TITLE",
                "Style": { "FontSize": "10pt", "FontWeight": "Bold" },
                "Left": "0in",
                "Top": "0.1in",
                "Width": "4in",
                "Height": "0.3in"
            }
        ]
    }
}
```

> **Placement:** These go at the same level as `"Page": {...}` and `"ReportSections": [...]` in the document root. Elements inside use absolute coordinates relative to the header/footer area (0,0 = top-left of the header/footer). The `Height` property controls how much vertical space the header/footer reserves on each page.

## Authoring Tips

- **Width** at root and section level = content width (PageWidth - LeftMargin - RightMargin)
- **Body.Height** = content height (PageHeight - TopMargin - BottomMargin)
- **Body border** — to put a thick border around the entire label, set `Style.Border` on the Body object:
  ```json
  "Body": {
      "Height": "4.75in",
      "Style": { "Border": { "Style": "Solid", "Width": "3pt", "Color": "Black" } },
      "ReportItems": [ ... ]
  }
  ```
- **Section Page** repeats the top-level Page settings
- **DataSet Name** must match the datasource reference name (e.g., `ds_my_report`)
- **CommandText** must be `$.{ds_name}.result.*` — NOT `jpath=$.*`
- **DataSets.Fields**: list ALL fields from `datasource-fields` output (not just used ones); use underscore for dots (`Account.Name` → Name: `Account_Name`)
- **Date fields**: append `[Date|YYYY-MM-DDTHH:mm:ss.fffffff]` to the DataField value
- **Expressions** are clean JSON strings — no shell escaping needed
- Offset text 0.05in from border lines so content doesn't collide with dividers
- Use `dxs report validate` after writing to catch errors before upload

## Expression Quick Reference

```
=Fields!FieldName.Value                                    # Field reference
="Label: " & Fields!FieldName.Value                        # Concatenation
=IIf(Fields!X.Value <> "", Fields!X.Value, "N/A")          # Conditional
=Format(Fields!Date.Value, "MM/dd/yyyy")                   # Date format
=Format(Fields!Amount.Value, "N2")                         # Number with commas (1,234.50)
=Format(Fields!Price.Value, "C2")                          # Currency ($1,234.50)
=Format(Fields!Ratio.Value, "P1")                          # Percent (85.6%)
=Format(Fields!Seq.Value, "D5")                            # Zero-padded (00042)
=Sum(Fields!Amount.Value)                                  # Aggregate
=Now()                                                     # Current date/time
=Today()                                                   # Current date only
=Globals!ReportName                                        # Report name
=Globals!ExecutionTime                                     # Execution timestamp
=Globals!PageNumber & " of " & Globals!TotalPages          # Page numbers
```

**Common mistakes:** `Fields.Name.Value` (wrong — use `Fields!`), unbalanced parens in `IIf()`.
