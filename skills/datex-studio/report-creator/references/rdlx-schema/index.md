# RDLX-JSON Schema Reference

Split schema reference for ActiveReportsJS RDLX-JSON report definitions.
Start with `report-structure.md` for the overall report, then load item-specific files as needed.

## Files

| File | Description |
| --- | --- |
| `banded-list.md` | BandedList report item and sub-definitions (BandedListHeader, BandedListFooter, BandedListGroup). |
| `barcode.md` | Barcode report item and all barcode-type option definitions. |
| `chart.md` | Chart report item (classic) and sub-definitions (ChartAxis, ChartPlot, ChartPlotConfig, Overlay, etc.) |
| `dvchart.md` | DvChart (data-visualization chart) report item and all DvChart*/DVOverlay* sub-definitions. |
| `list.md` | List report item (data-bound repeating container). |
| `other-items.md` | Remaining report items: Subreport, Checkbox, Bullet, Sparkline, TableOfContents, InputFieldText, InputFieldCheckbox, OverflowPlaceholder, ContentPlaceHolder, PartItem. |
| `report-structure.md` | Report structure, layout, data, parameters, and shared definitions (Visibility, BorderStyle, Action, Filter, etc.) |
| `shape.md` | Geometric report items: Shape, Line, Rectangle, Image. |
| `table.md` | Table report item and sub-definitions (TableRow, TableCell, TableColumn, TableGroup, TableHeader, TableFooter, etc.) |
| `tablix.md` | Tablix (matrix/crosstab) report item and sub-definitions (TablixBody, TablixHierarchy, TablixMember, TablixGrouping, etc.) |
| `textbox.md` | Text report items: Textbox, FormattedText, RichtextPara, RichtextHtml, and their sub-definitions (Paragraph, TextRun, etc.) |

## Report Item → File Lookup

| Item Type | File |
| --- | --- |
| Textbox | `textbox.md` |
| Checkbox | `other-items.md` |
| List | `list.md` |
| Table | `table.md` |
| Tablix | `tablix.md` |
| Line | `shape.md` |
| Rectangle | `shape.md` |
| BandedList | `banded-list.md` |
| Subreport | `other-items.md` |
| Shape | `shape.md` |
| TableOfContents | `other-items.md` |
| Barcode | `barcode.md` |
| Chart | `chart.md` |
| DvChart | `dvchart.md` |
| Image | `shape.md` |
| Bullet | `other-items.md` |
| FormattedText | `textbox.md` |
| InputFieldText | `other-items.md` |
| InputFieldCheckbox | `other-items.md` |
| Sparkline | `other-items.md` |
| RichtextPara | `textbox.md` |
| RichtextHtml | `textbox.md` |
| OverflowPlaceholder | `other-items.md` |
| PartItem | `other-items.md` |
| ContentPlaceHolder | `other-items.md` |