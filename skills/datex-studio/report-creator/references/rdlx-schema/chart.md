# RDLX-JSON — chart

Chart report item (classic) and sub-definitions (ChartAxis, ChartPlot, ChartPlotConfig, Overlay, etc.)

## Definitions

### Chart

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** |  |
| `Type` | `"chart"` | **Y** |  |
| `ZIndex` | `number` |  |  |
| `Visibility` | → Visibility |  |  |
| `ToolTip` | `string` |  |  |
| `Bookmark` | `string` |  |  |
| `DataElementName` | `string` |  |  |
| `DataElementOutput` | → DataElementOutput |  |  |
| `Label` | `string` |  |  |
| `LayerName` | `string` |  |  |
| `CustomProperties` | object[] |  |  |
| `PageBreak` | `string` |  |  |
| `NewPage` | `string` |  |  |
| `Filters` | → Filter[] |  |  |
| `NewSection` | `boolean` |  |  |
| `NoRowsMessage` | `string` |  |  |
| `DataSetName` | `string` |  |  |
| `DataSetParameters` | object[] |  |  |
| `PageName` | `string` |  |  |
| `Header` | → ChartHeaderFooter |  |  |
| `Footer` | → ChartHeaderFooter |  |  |
| `AccessibleDescription` | `string` |  |  |
| `Bar` | object |  |  |
| `Palette` | → DvChartPalette |  |  |
| `CustomPalette` | `string`[] |  |  |
| `PlotArea` | → ChartPlotArea |  |  |
| `Plots` | → ChartPlot[] |  |  |
| `Left` | `string` |  |  |
| `Top` | `string` |  |  |
| `Width` | `string` |  |  |
| `Height` | `string` |  |  |
| `Style` | object |  |  |

**Style properties:**

Includes **FullTextStyle** properties.

Additional style properties:

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `BackgroundGradientEndColor` | `string` |  |  |
| `BackgroundGradientType` | `"None"` \| `"LeftRight"` \| `"TopBottom"` \| `"Center"` \| `"DiagonalLeft"` \| `"DiagonalRight"` \| `"HorizontalCenter"` \| `"VerticalCenter"` \| `=expr` |  |  |
| `Calendar` | `"Default"` \| `"Gregorian"` \| `"GregorianArabic"` \| `"GregorianMiddleEastFrench"` \| `"GregorianTransliteratedEnglish"` \| `"GregorianTransliteratedFrench"` \| `"GregorianUSEnglish"` \| `"Hebrew"` \| `"Hijri"` \| `"Japanese"` \| `"Korean"` \| `"Taiwan"` \| `"ThaiBuddhist"` \| `=expr` |  |  |
| `LineHeight` | `string` |  |  |
| `NumeralLanguage` | `string` |  |  |
| `NumeralVariant` | `string` |  |  |
| `UnicodeBiDi` | `"Normal"` \| `"Embed"` \| `"BidiOverride"` \| `=expr` |  |  |
| `UprightInVerticalText` | `"None"` \| `"Digits"` \| `"DigitsAndLatinLetters"` \| `=expr` |  |  |

**`Bar` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `BottomWidth` | `number` |  |  |
| `NeckHeight` | `number` |  |  |
| `Overlap` | `number` |  |  |
| `TopWidth` | `number` |  |  |
| `Width` | `number` |  |  |

---

### ChartAxis

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `AxisLine` | `boolean` |  |  |
| `AxisType` | `string` |  |  |
| `DateMode` | `string` |  |  |
| `Format` | `string` |  |  |
| `LabelAngle` | `number` |  |  |
| `Labels` | `boolean` |  |  |
| `LabelStyle` | → DvChartAxisLabelStyle |  |  |
| `LineStyle` | object |  |  |
| `LogBase` | `number` |  |  |
| `MajorGrid` | `boolean` |  |  |
| `MajorGridStyle` | object |  |  |
| `MajorTicks` | `string` |  |  |
| `MajorTickSize` | `string` |  |  |
| `MajorTickStyle` | object |  |  |
| `MajorUnit` | `string` |  |  |
| `Max` | `string` |  |  |
| `Min` | `string` |  |  |
| `MinorGrid` | `boolean` |  |  |
| `MinorGridStyle` | object |  |  |
| `MinorTicks` | `string` |  |  |
| `MinorTickSize` | `string` |  |  |
| `MinorTickStyle` | object |  |  |
| `MinorUnit` | `string` |  |  |
| `Origin` | `string` |  |  |
| `OverlappingLabels` | `string` |  |  |
| `Plots` | `string`[] |  |  |
| `Position` | `string` |  |  |
| `Reversed` | `boolean` |  |  |
| `Scale` | `string` |  |  |
| `TextStyle` | → DvChartAxisTextStyle |  |  |
| `Title` | `string` |  |  |
| `TitleStyle` | → DvChartAxisTextStyle |  |  |
| `MaxHeight` | `number` |  |  |
| `MaxWidth` | `number` |  |  |
| `Width` | `number` |  |  |
| `Height` | `number` |  |  |
| `LabelRowCount` | `number` |  |  |
| `LabelLayout` | `string` |  |  |
| `Style` | object |  |  |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |

**`LineStyle` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |

**`MajorGridStyle` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |

**`MajorTickStyle` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |

**`MinorGridStyle` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |

**`MinorTickStyle` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |

---

### ChartAxisLabelStyle

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `WritingMode` | `"lr-tb"` \| `"tb-rl"` \| `=expr` |  |  |
| `PaddingLeft` | `string` |  |  |
| `PaddingRight` | `string` |  |  |
| `PaddingTop` | `string` |  |  |
| `PaddingBottom` | `string` |  |  |
| `TextDecoration` | `"Default"` \| `"None"` \| `"Underline"` \| `"DoubleUnderline"` \| `"Overline"` \| `"LineThrough"` \| `=expr` |  |  |
| `Color` | `string` |  |  |
| `FontStyle` | `"Default"` \| `"Normal"` \| `"Italic"` \| `=expr` |  |  |
| `FontFamily` | `string` |  |  |
| `FontSize` | `string` |  |  |
| `FontWeight` | `"Default"` \| `"Normal"` \| `"Lighter"` \| `"Thin"` \| `"ExtraLight"` \| `"Light"` \| `"Medium"` \| `"SemiBold"` \| `"Bold"` \| `"ExtraBold"` \| `"Heavy"` \| `"Bolder"` \| `=expr` |  |  |

---

### ChartAxisTextStyle

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `PaddingLeft` | `string` |  |  |
| `PaddingRight` | `string` |  |  |
| `PaddingTop` | `string` |  |  |
| `PaddingBottom` | `string` |  |  |
| `TextDecoration` | `"Default"` \| `"None"` \| `"Underline"` \| `"DoubleUnderline"` \| `"Overline"` \| `"LineThrough"` \| `=expr` |  |  |
| `Color` | `string` |  |  |
| `FontStyle` | `"Default"` \| `"Normal"` \| `"Italic"` \| `=expr` |  |  |
| `FontFamily` | `string` |  |  |
| `FontSize` | `string` |  |  |
| `FontWeight` | `"Default"` \| `"Normal"` \| `"Lighter"` \| `"Thin"` \| `"ExtraLight"` \| `"Light"` \| `"Medium"` \| `"SemiBold"` \| `"Bold"` \| `"ExtraBold"` \| `"Heavy"` \| `"Bolder"` \| `=expr` |  |  |

---

### ChartCategoryGroupingItem

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Grouping` | → Grouping |  |  |
| `Sorting` | → SortExpression[] |  |  |
| `Label` | `string` |  |  |

---

### ChartColorLegendSeries

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Field` | `string` |  |  |
| `Action` | → Action |  |  |
| `MaxHeight` | `number` |  |  |
| `MaxWidth` | `number` |  |  |
| `Title` | `string` |  |  |
| `Hidden` | `boolean` |  |  |
| `Orientation` | `string` |  |  |
| `Position` | `string` |  |  |
| `TextStyle` | → DvChartTextStyle |  |  |
| `TitleStyle` | → DvChartTextStyle |  |  |
| `Mode` | `string` |  |  |
| `Style` | object |  |  |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |
| `BackgroundColor` | `string` |  |  |
| `PaddingLeft` | `string` |  |  |
| `PaddingRight` | `string` |  |  |
| `PaddingTop` | `string` |  |  |
| `PaddingBottom` | `string` |  |  |

---

### ChartDataSeriesItem

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` |  |  |
| `Values` | object[] |  |  |
| `Label` | object |  |  |
| `ToolTip` | object |  |  |
| `Marker` | object |  |  |
| `Opacity` | `number` |  |  |
| `DataElementOutput` | → DataElementOutput |  |  |
| `DataElementName` | `string` |  |  |
| `Action` | → Action |  |  |
| `Style` | object |  |  |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |
| `BackgroundColor` | `string` |  |  |

**`Label` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Value` | `string` |  |  |
| `Offset` | `number` |  |  |
| `Style` | object |  |  |
| `TextPosition` | `string` |  |  |
| `LinePosition` | `string` |  |  |
| `ConnectingLineStyle` | object |  |  |

**`ToolTip` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Value` | `string` |  |  |
| `Format` | `string` |  |  |

**`Marker` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Opacity` | `number` |  |  |
| `BorderOpacity` | `number` |  |  |
| `Size` | `number` |  |  |
| `Visible` | `boolean` |  |  |
| `Shape` | `string` |  |  |
| `Style` | object |  |  |

---

### ChartHeaderFooter

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Title` | `string` |  |  |
| `Height` | `string` |  |  |
| `HAlign` | `string` |  |  |
| `VAlign` | `string` |  |  |
| `Style` | object |  |  |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |
| `BackgroundColor` | `string` |  |  |
| `PaddingLeft` | `string` |  |  |
| `PaddingRight` | `string` |  |  |
| `PaddingTop` | `string` |  |  |
| `PaddingBottom` | `string` |  |  |
| `TextDecoration` | `"Default"` \| `"None"` \| `"Underline"` \| `"DoubleUnderline"` \| `"Overline"` \| `"LineThrough"` \| `=expr` |  |  |
| `Color` | `string` |  |  |
| `FontStyle` | `"Default"` \| `"Normal"` \| `"Italic"` \| `=expr` |  |  |
| `FontFamily` | `string` |  |  |
| `FontSize` | `string` |  |  |
| `FontWeight` | `"Default"` \| `"Normal"` \| `"Lighter"` \| `"Thin"` \| `"ExtraLight"` \| `"Light"` \| `"Medium"` \| `"SemiBold"` \| `"Bold"` \| `"ExtraBold"` \| `"Heavy"` \| `"Bolder"` \| `=expr` |  |  |

---

### ChartPalette

Type: `string`

---

### ChartPlot

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` |  |  |
| `PlotType` | `string` |  |  |
| `Config` | → ChartPlotConfig |  |  |
| `SeriesGroupings` | → ChartSeriesGroupingItem[] |  |  |
| `CategoryGroupings` | → ChartCategoryGroupingItem[] |  |  |
| `DataSeries` | → ChartDataSeriesItem[] |  |  |
| `ColorSeries` | → ChartColorLegendSeries |  |  |
| `SizeSeries` | → ChartSizeLegendSeries |  |  |
| `ShapeSeries` | → ChartShapeLegendSeries |  |  |

---

### ChartPlotArea

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Axes` | → ChartAxis[] |  |  |
| `Style` | object |  |  |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |
| `BackgroundColor` | `string` |  |  |
| `PaddingLeft` | `string` |  |  |
| `PaddingRight` | `string` |  |  |
| `PaddingTop` | `string` |  |  |
| `PaddingBottom` | `string` |  |  |

---

### ChartPlotConfig

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `AxisMode` | `string` |  |  |
| `Bar` | object |  |  |
| `BarLines` | `boolean` |  |  |
| `BarLineStyle` | object |  |  |
| `ClippingMode` | `string` |  |  |
| `CustomLabels` | → DvPlotCustomLabel[] |  |  |
| `InnerRadius` | `number` |  |  |
| `LineAspect` | `string` |  |  |
| `Offset` | `number` |  |  |
| `Overlays` | → DVOverlay[] |  |  |
| `Pointers` | → DvPlotPointer[] |  |  |
| `ShowNulls` | `string` |  |  |
| `StartAngle` | `number` |  |  |
| `SwapAxes` | `boolean` |  |  |
| `Sweep` | `number` |  |  |
| `SeriesArrangement` | `string` |  |  |
| `OverlappingLabels` | `string` |  |  |

**`Bar` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `BottomWidth` | `number` |  |  |
| `NeckHeight` | `number` |  |  |
| `Overlap` | `number` |  |  |
| `TopWidth` | `number` |  |  |
| `Width` | `number` |  |  |

**`BarLineStyle` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Color` | `string` |  |  |
| `Style` | `"Default"` \| `"None"` \| `"Dotted"` \| `"Dashed"` \| `"Solid"` \| `"Double"` \| `"DashDot"` \| `"DashDotDot"` \| `"Groove"` \| `"Ridge"` \| `"Inset"` \| `"WindowInset"` \| `"Outset"` \| `=expr` |  |  |
| `Width` | `string` |  |  |

---

### ChartSeriesGroupingItem

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Grouping` | → Grouping |  |  |
| `Sorting` | → SortExpression[] |  |  |

---

### ChartShapeLegendSeries

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `MaxHeight` | `number` |  |  |
| `MaxWidth` | `number` |  |  |
| `Title` | `string` |  |  |
| `IconColor` | `string` |  |  |
| `Hidden` | `boolean` |  |  |
| `Orientation` | `string` |  |  |
| `Position` | `string` |  |  |
| `TextStyle` | → DvChartTextStyle |  |  |
| `TitleStyle` | → DvChartTextStyle |  |  |
| `Field` | `string` |  |  |
| `Action` | → Action |  |  |
| `Mode` | `string` |  |  |
| `Style` | object |  |  |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |
| `BackgroundColor` | `string` |  |  |
| `PaddingLeft` | `string` |  |  |
| `PaddingRight` | `string` |  |  |
| `PaddingTop` | `string` |  |  |
| `PaddingBottom` | `string` |  |  |

---

### ChartSizeLegendSeries

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `MaxHeight` | `number` |  |  |
| `MaxWidth` | `number` |  |  |
| `Title` | `string` |  |  |
| `IconColor` | `string` |  |  |
| `RangeOptions` | object[] |  |  |
| `Hidden` | `boolean` |  |  |
| `Orientation` | `string` |  |  |
| `Position` | `string` |  |  |
| `TextStyle` | → DvChartTextStyle |  |  |
| `TitleStyle` | → DvChartTextStyle |  |  |
| `Field` | `string` |  |  |
| `Action` | → Action |  |  |
| `Mode` | `string` |  |  |
| `Style` | object |  |  |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |
| `BackgroundColor` | `string` |  |  |
| `PaddingLeft` | `string` |  |  |
| `PaddingRight` | `string` |  |  |
| `PaddingTop` | `string` |  |  |
| `PaddingBottom` | `string` |  |  |

---

### Overlay

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` |  |  |
| `OverlayType` | → DVOverlayType |  |  |
| `Display` | `string` |  |  |
| `Field` | `string` |  |  |
| `DetailLevel` | `string` |  |  |
| `LegendLabel` | `string` |  |  |
| `Value` | `string` |  |  |
| `Axis` | `string` |  |  |
| `AggregateType` | → DVOverlayAggregateType |  |  |
| `Start` | `number` |  |  |
| `End` | `number` |  |  |
| `Order` | `number` |  |  |
| `Period` | `number` |  |  |
| `ForwardForecastPeriod` | `number` |  |  |
| `BackwardForecastPeriod` | `number` |  |  |
| `Intercept` | `number` |  |  |
| `Style` | object |  |  |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |
| `BackgroundColor` | `string` |  |  |

---

### OverlayAggregateType

Type: `string`

---

### OverlayType

Type: `string`

---

### PlotCustomLabel

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Text` | `string` |  |  |
| `OffsetX` | `string` |  |  |
| `OffsetY` | `string` |  |  |
| `Style` | object |  |  |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `FontStyle` | `"Default"` \| `"Normal"` \| `"Italic"` \| `=expr` |  |  |
| `FontFamily` | `string` |  |  |
| `FontSize` | `string` |  |  |
| `FontWeight` | `"Default"` \| `"Normal"` \| `"Lighter"` \| `"Thin"` \| `"ExtraLight"` \| `"Light"` \| `"Medium"` \| `"SemiBold"` \| `"Bold"` \| `"ExtraBold"` \| `"Heavy"` \| `"Bolder"` \| `=expr` |  |  |
| `TextDecoration` | `"Default"` \| `"None"` \| `"Underline"` \| `"DoubleUnderline"` \| `"Overline"` \| `"LineThrough"` \| `=expr` |  |  |
| `Color` | `string` |  |  |
| `WritingMode` | `"lr-tb"` \| `"tb-rl"` \| `=expr` |  |  |

---

### PlotPointer

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `NeedleWidth` | `string` |  |  |
| `NeedlePinWidth` | `string` |  |  |
| `End` | `string` |  |  |
| `Style` | object |  |  |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `BackgroundColor` | `string` |  |  |

---
