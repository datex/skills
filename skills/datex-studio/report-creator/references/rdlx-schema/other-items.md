# RDLX-JSON — other-items

Remaining report items: Subreport, Checkbox, Bullet, Sparkline, TableOfContents, InputFieldText, InputFieldCheckbox, OverflowPlaceholder, ContentPlaceHolder, PartItem.

## Definitions

### Bullet

Represents properties for a Bullet chart in a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a Bullet chart |
| `Value` | `string` |  |  |
| `Type` | `"bullet"` | **Y** | Should be set to "bullet" |
| `ZIndex` | `number` |  | The stack order of a Bullet chart |
| `Visibility` | → Visibility |  | Whether a Bullet chart is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over a Bullet chart at preview time |
| `Bookmark` | `string` |  | The Id of a Bullet chart for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with a Bullet chart that appears in the Report Map and Table of Contents |
| `AccessibleDescription` | `string` |  |  |
| `Orientation` | `string` |  | The orientation of a Bullet chart. |
| `LabelFormat` | `string` |  | A formatting code that is used when the numeric value in a Bullet chart label is formatted. Supported formats are - Standard Numeric Format Strings - Custom Numeric Format Strings - Standard Date and Time Format Strings - Custom Date and Time Format Strings |
| `LabelFontFamily` | `string` |  | The name of the font family for Bullet chart labels. |
| `LabelFontSize` | `string` |  | The font size for Bullet chart labels. Value: length string. |
| `LabelFontStyle` | `"Italic"` \| `"Bold"` \| `"Underline"` \| `"Regular"` \| `"Strikeout"` \| `=expr` |  | The font style for Bullet chart labels. |
| `LabelFontColor` | `string` |  | The foreground color of Bullet chart labels. Value: color string. |
| `ShowLabels` | `boolean` |  | Whether labels of Bullet chart are displayed. |
| `TargetShape` | `string` |  | The shape of the target value graphical representation. |
| `TargetLineColor` | `string` |  | The foreground of the target value's graphical representation. Value: color string. |
| `TargetLineWidth` | `string` |  | The border thickness of the target value's graphical representation. Value: length string. |
| `TickMarks` | `string` |  | The position of tick marks relative to an axis of a Bullet chart. |
| `TicksLineColor` | `string` |  | The foreground of tick marks of a Bullet chart. Value: color string. |
| `TicksLineWidth` | `string` |  | The border thickness of tick marks of a Bullet chart. Value: length string. |
| `ValueColor` | `string` |  | The foreground of the actual value's graphical representation. Value: color string. |
| `BestValue` | `string` |  | The upper value of a Bullet chart. |
| `Interval` | `string` |  | The interval between tick marks of a Bullet chart. |
| `Range1Boundary` | `string` |  | The first range of values in a Bullet chart. |
| `Range2Boundary` | `string` |  | The second range of values in a Bullet chart. |
| `TargetValue` | `string` |  | The target value of a Bullet chart. |
| `WorstValue` | `string` |  | The lower value of a Bullet chart. |
| `Left` | `string` |  | A value in Length units indicating the distance of a Bullet chart from the left of the chart's container |
| `Top` | `string` |  | A value in Length units indicating the distance of a Bullet chart from the top of the chart's container |
| `Width` | `string` |  | A value in Length units indicating the width of a Bullet chart. |
| `Height` | `string` |  | A value in Length units indicating the height of a Bullet chart. |

---

### Checkbox

Represents properties for a Checkbox in a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a Checkbox |
| `Type` | `"checkbox"` | **Y** | Should be set to "checkbox" |
| `Action` | → Action |  | An action (such as a hyperlink) associated with a CheckBox |
| `ZIndex` | `number` |  | The stack order of a checkbox |
| `Visibility` | → Visibility |  | Whether a Checkbox is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over a checkbox at preview time |
| `Bookmark` | `string` |  | The Id of a checkbox for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with a checkbox that appears in the Report Map and Table of Contents |
| `CheckAlignment` | `string` |  | The checked or unchecked box position relative to the report item bounds. |
| `Text` | `string` |  | The textual the content to be displayed in the checkbox. |
| `Checked` | `string` |  | Whether the box displayed along with the text is checked or unchecked |
| `Left` | `string` |  | A value in Length units indicating the distance of a Checkbox from the left of the checkbox's container |
| `Top` | `string` |  | A value in Length units indicating the distance of a Checkbox from the top of the checkbox's container |
| `Width` | `string` |  | A value in Length units indicating the width of a Checkbox |
| `Height` | `string` |  | A value in Length units indicating the height of a Checkbox |
| `StyleName` | `string` |  |  |
| `CustomCSSClasses` | `string` |  |  |
| `Style` | object |  | Represents style information for a Checkbox |

**Style properties:**

Includes **BoxStyle** properties.

Additional style properties:

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Color` | `string` |  | The foreground color of a Checkbox Value: color string. |
| `FontFamily` | `string` |  | The name of the font family for text within a Checkbox |
| `FontSize` | `string` |  | The font size for text in a Checkbox. Value: length string. |
| `FontStyle` | `"Default"` \| `"Normal"` \| `"Italic"` \| `=expr` |  | The font style for text in a Checkbox. |
| `FontWeight` | `"Default"` \| `"Normal"` \| `"Lighter"` \| `"Thin"` \| `"ExtraLight"` \| `"Light"` \| `"Medium"` \| `"SemiBold"` \| `"Bold"` \| `"ExtraBold"` \| `"Heavy"` \| `"Bolder"` \| `=expr` |  | The thickness of font for text within a Checkbox |
| `TextDecoration` | `"Default"` \| `"None"` \| `"Underline"` \| `"DoubleUnderline"` \| `"Overline"` \| `"LineThrough"` \| `=expr` |  | Text formatting for text in a Checkbox. |
| `WrapMode` | `"NoWrap"` \| `"CharWrap"` \| `"WordWrap"` \| `=expr` |  | How words should break when reaching the end of a line for a Checkbox. |

---

### ContentPlaceHolder

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** |  |
| `Type` | `"contentplaceholder"` | **Y** |  |
| `ZIndex` | `number` |  |  |
| `LayerName` | `string` |  |  |
| `CustomProperties` | object[] |  |  |
| `Text` | `string` |  |  |
| `ConsumeWhiteSpace` | `boolean` |  |  |
| `ReportItems` | → ReportItem[] |  |  |
| `Left` | `string` |  |  |
| `Top` | `string` |  |  |
| `Width` | `string` |  |  |
| `Height` | `string` |  |  |

---

### InputFieldCheckbox

Represents properties for a checkbox Input Field

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for an Input Field |
| `Type` | `"inputfield"` | **Y** | Should be set to "inputfield" |
| `ZIndex` | `number` |  | The stack order of an Input Field |
| `Visibility` | → Visibility |  | Whether an Input Field is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over an Input Field at preview time |
| `Bookmark` | `string` |  | The Id of an Input Field for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with an Input Field that appears in the Report Map and Table of Contents |
| `FieldName` | `string` |  | The name of a field in the fillable PDF form |
| `Readonly` | `boolean` |  | Whether a PDF document reader is allowed to modify the field's value. |
| `Required` | `boolean` |  | Whether a PDF document reader must provide the field's value. |
| `TabIndex` | `number` |  |  |
| `Checked` | `string` |  | Whether a Checkbox Input Field is initially checked. |
| `CheckStyle` | `string` |  | The style of the check mark for a CheckBox Input Field. |
| `CheckSize` | `string` |  | The size of the check mark for a Checkbox Input Field. Value: length string. |
| `Left` | `string` |  | A value in Length units indicating the distance of an Input Field from the left of the field's container |
| `Top` | `string` |  | A value in Length units indicating the distance of an Input Field from the top of the field's container |
| `Width` | `string` |  | A value in Length units indicating the width of an Input Field. |
| `Height` | `string` |  | A value in Length units indicating the height of an Input Field. |
| `Style` | object |  | Represents style information for an Input Field. |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `BackgroundColor` | `string` |  | The color of the background of a field in the fillable PDF form Value: color string. |
| `TextAlign` | `"Center"` \| `"General"` \| `"Left"` \| `"Right"` \| `"Justify"` \| `=expr` |  | The horizontal alignment for text within a field in the fillable PDF form. |
| `Color` | `string` |  | The foreground color of text within a field in the fillable PDF form. Value: color string. |
| `Border` | → BorderStyle |  | The default border properties for an Input Field. |
| `TopBorder` | → BorderStyle |  | The top border properties for an Input Field. |
| `RightBorder` | → BorderStyle |  | The right border properties for an Input Field. |
| `BottomBorder` | → BorderStyle |  | The bottom border properties for an Input Field. |
| `LeftBorder` | → BorderStyle |  | The left border properties for an Input Field. |

---

### InputFieldText

Represents properties for a text Input Field

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for an Input Field |
| `Type` | `"inputfield"` | **Y** | Should be set to "inputfield" |
| `ZIndex` | `number` |  | The stack order of an Input Field |
| `Visibility` | → Visibility |  | Whether an Input Field is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over an Input Field at preview time |
| `Bookmark` | `string` |  | The Id of an Input Field for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with an Input Field that appears in the Report Map and Table of Contents |
| `FieldName` | `string` |  | The name of an Input Field in the fillable PDF form |
| `Readonly` | `boolean` |  | Whether a PDF document reader is allowed to modify the field's value. |
| `Required` | `boolean` |  | Whether a PDF document reader must provide the field's value. |
| `TabIndex` | `number` |  |  |
| `Password` | `boolean` |  | Whether the fillable PDF form displays the field's value as a series of asterisks. |
| `Multiline` | `boolean` |  | Whether a multi-line value for a field is accepted. |
| `SpellCheck` | `boolean` |  | Whether the field's value is handled by spell-check. |
| `MaxLength` | `number` |  | The maximum allowed length of the field's value. |
| `Value` | `string` |  | The initial field's value. |
| `Left` | `string` |  | A value in Length units indicating the distance of an Input Field from the left of the field's container |
| `Top` | `string` |  | A value in Length units indicating the distance of an Input Field from the top of the field's container |
| `Width` | `string` |  | A value in Length units indicating the width of an Input Field. |
| `Height` | `string` |  | A value in Length units indicating the height of an Input Field. |
| `Style` | object |  | Represents style information for an Input Field. |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `BackgroundColor` | `string` |  | The color of the background of a field in the fillable PDF form Value: color string. |
| `Format` | `string` |  | A formatting code that is used when the numeric value of a field in the fillable PDF form is formatted. Supported formats are - Standard Numeric Format Strings - Custom Numeric Format Strings - Standard Date and Time Format Strings - Custom Date and Time Format Strings |
| `TextAlign` | `"Center"` \| `"General"` \| `"Left"` \| `"Right"` \| `"Justify"` \| `=expr` |  | The horizontal alignment for text within a field in the fillable PDF form. |
| `Color` | `string` |  | The foreground color of text within a field in the fillable PDF form. Value: color string. |
| `FontStyle` | `"Default"` \| `"Normal"` \| `"Italic"` \| `=expr` |  | The font style for text within a field in the fillable PDF form. |
| `FontFamily` | `string` |  | The name of the font family for text within a field in the fillable PDF form. |
| `FontSize` | `string` |  | The font size for text within a field in the fillable PDF form. Value: length string. |
| `FontWeight` | `"Default"` \| `"Normal"` \| `"Lighter"` \| `"Thin"` \| `"ExtraLight"` \| `"Light"` \| `"Medium"` \| `"SemiBold"` \| `"Bold"` \| `"ExtraBold"` \| `"Heavy"` \| `"Bolder"` \| `=expr` |  | The thickness of font for text within a field in the fillable PDF form. |
| `Border` | → BorderStyle |  | The default border properties for an Input Field. |
| `TopBorder` | → BorderStyle |  | The top border properties for an Input Field. |
| `RightBorder` | → BorderStyle |  | The right border properties for an Input Field. |
| `BottomBorder` | → BorderStyle |  | The bottom border properties for an Input Field. |
| `LeftBorder` | → BorderStyle |  | The left border properties for an Input Field. |

---

### OverflowPlaceholder

Represents properties for an Overflow Place Holder in a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for an Overflow Place Holder |
| `Left` | `string` |  | A value in Length units indicating the distance of an Overflow Place Holder from the left of its container |
| `Top` | `string` |  | A value in Length units indicating the distance of an Overflow Place Holder from the top of its container |
| `Type` | `"overflowplaceholder"` | **Y** | Should be set to "overflowplaceholder" |
| `Width` | `string` |  | A value in Length units indicating the width of an Overflow Place Holder. |
| `Height` | `string` |  | A value in Length units indicating the height of an Overflow Place Holder. |
| `OverflowName` | `string` |  | The name of the OverflowPlaceHolder that should be used in case of more data needs to be arranged. Check the Fixed Page Layout documentation for more information. |

---

### PartItem

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** |  |
| `Type` | `"partitem"` | **Y** |  |
| `ZIndex` | `number` |  |  |
| `Visibility` | → Visibility |  |  |
| `ToolTip` | `string` |  |  |
| `Bookmark` | `string` |  |  |
| `DataElementName` | `string` |  |  |
| `DataElementOutput` | → DataElementOutput |  |  |
| `Label` | `string` |  |  |
| `LayerName` | `string` |  |  |
| `CustomProperties` | object[] |  |  |
| `ReportPart` | `string` |  |  |
| `Library` | `string` |  |  |
| `Properties` | object[] |  |  |
| `Left` | `string` |  |  |
| `Top` | `string` |  |  |
| `Width` | `string` |  |  |
| `Height` | `string` |  |  |
| `FixedWidth` | `string` |  |  |
| `FixedHeight` | `string` |  |  |
| `OverflowName` | `string` |  |  |

---

### Sparkline

Represents properties for a Sparkline

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a Sparkline |
| `Type` | `"sparkline"` | **Y** | Should be set to "sparkline" |
| `ZIndex` | `number` |  | The stack order of a Sparkline |
| `Visibility` | → Visibility |  | Whether a Sparkline is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over a Sparkline at preview time |
| `Bookmark` | `string` |  | The Id of a Sparkline for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with a Sparkline that appears in the Report Map and Table of Contents |
| `SortExpressions` | → SortExpression[] |  | A collection of expressions by which to sort the data in a Sparkline. |
| `Filters` | → Filter[] |  | A collection of filters to be applied to the data for each row of a Sparkline |
| `Group` | → Grouping |  | Expressions by which to group the data in a Sparkline. |
| `DataSetName` | `string` |  | The name of the dataset to use to bind data to a Sparkline. |
| `LineWidth` | `string` |  | A value or an expression that evaluates to the line width for a sparkline of "Line" type. The value or the expression result should be in Length units |
| `LineColor` | `string` |  | Expression that evaluates to the line color for a sparkline of "Line" type. The value or the expression result should be either a cross-browser color name or to a hexadecimal color code, such as ```#face0d```. |
| `AccessibleDescription` | `string` |  |  |
| `FillColor` | `string` |  | Expression that evaluates to the background color of geometrical shapes within a sparkline of "Area", "Columns", "Whiskers", and "Stacked Columns" types. The value or the expression result should be either a cross-browser color name or to a hexadecimal color code, such as ```#face0d```. |
| `GradientStyle` | → SparklineGradientStyle |  | A value indicating the type of background gradient of geometrical shapes within a sparkline. |
| `GradientEndColor` | `string` |  | The end color for the background gradient of geometrical shapes within a sparkline of "Area", "Columns", "Whiskers", and "Stacked Columns" types. Value: color string. |
| `MarkerColor` | `string` |  | Expression that evaluates to the foreground color of a marker at the last point of a sparkline of "Line" type. The value or the expression result should be either a cross-browser color name or to a hexadecimal color code, such as ```#face0d```. |
| `MarkerVisibility` | `boolean` |  | Whether to display a marker at the last point of a sparkline of Line type. |
| `MaximumColumnWidth` | `string` |  | The maximum width of columns for a sparkline of "Columns" and "Whiskers" types. Value: length string. |
| `RangeFillColor` | `string` |  | Expression that evaluates to the background color of the range within a sparkline. The value or the expression result should be either a cross-browser color name or to a hexadecimal color code, such as ```#face0d```. |
| `RangeGradientStyle` | → SparklineGradientStyle |  | A value indicating the type of background gradient of the range within a sparkline. |
| `RangeGradientEndColor` | `string` |  | The end color for the background gradient of the range within a sparkline. Value: color string. |
| `RangeLowerBound` | `string` |  | The lower bound of the range for a sparkline. |
| `RangeUpperBound` | `string` |  | The upper bound of the range for a sparkline. |
| `RangeVisibility` | `boolean` |  | Whether to display a range of values for a sparkline. |
| `SparklineType` | `string` |  | The type of a Sparkline. |
| `SeriesValue` | `string` |  | An expression indicating the range of data values displayed in a sparkline. |
| `Left` | `string` |  | A value in Length units indicating the distance of a Sparkline from the left of the sparkline's container |
| `Top` | `string` |  | A value in Length units indicating the distance of a Sparkline from the top of the sparkline's container |
| `Width` | `string` |  | A value in Length units indicating the width of a Sparkline. |
| `Height` | `string` |  | A value in Length units indicating the height of a Sparkline. |

---

### SparklineGradientStyle

Represents the type of background gradient of a Sparkline.

Type: `string`

---

### Subreport

Represents properties for a Subreport in a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a Subreport |
| `ReportName` | `string` |  | Either the location of the report definition to use for the Subreport or the Id to be resolved by the custom resource locator |
| `Parameters` | object[] |  | The parameters to be evaluated and passed to the Subreport. |
| `Type` | `"subreport"` | **Y** | Should be set to "subreport" |
| `KeepTogether` | `boolean` |  | Whether the entire contents of a Subreport should be kept together on one Page if possible |
| `ZIndex` | `number` |  | The stack order of a Subreport |
| `Visibility` | → Visibility |  | Whether a Subreport is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over a Subreport at preview time |
| `Bookmark` | `string` |  | The Id of a Subreport for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with a Subreport that appears in the Report Map and Table of Contents |
| `NoRowsMessage` | `string` |  | Text to render instead of the subreport layout when no rows of data are available for a Subreport. |
| `Left` | `string` |  | A value in Length units indicating the distance of a Subreport from the left of the subreport's container |
| `Top` | `string` |  | A value in Length units indicating the distance of a Subreport from the top of the subreport's container |
| `Width` | `string` |  | A value in Length units indicating the width of a Subreport |
| `Height` | `string` |  | A value in Length units indicating the height of a Subreport |
| `Style` | object |  | Represents style information for a Subreport |

**Style properties:**

Includes **BorderOnlyStyle** properties.

Additional style properties:

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Color` | `string` |  | The foreground color of a NoRowsMessage Value: color string. |
| `Direction` | `"Default"` \| `"LTR"` \| `"RTL"` \| `=expr` |  | Whether text within a NoRowsMessage is written left-to-right or right-to-left. |
| `FontFamily` | `string` |  | The name of the font family for text within a NoRowsMessage |
| `FontSize` | `string` |  | The font size for text in a NoRowsMessage. Value: length string. |
| `FontStyle` | `"Default"` \| `"Normal"` \| `"Italic"` \| `=expr` |  | The font style for text in a NoRowsMessage. |
| `FontWeight` | `"Default"` \| `"Normal"` \| `"Lighter"` \| `"Thin"` \| `"ExtraLight"` \| `"Light"` \| `"Medium"` \| `"SemiBold"` \| `"Bold"` \| `"ExtraBold"` \| `"Heavy"` \| `"Bolder"` \| `=expr` |  | The thickness of font for text within a Checkbox |
| `Format` | `string` |  | A formatting code that is used when the numeric value in a NoRowsMessage is formatted. Supported formats are - Standard Numeric Format Strings - Custom Numeric Format Strings - Standard Date and Time Format Strings - Custom Date and Time Format Strings |
| `Language` | `string` |  | The default language to use for dates and number formatting within a NoRowsMessage. |
| `TextAlign` | `"Center"` \| `"General"` \| `"Left"` \| `"Right"` \| `"Justify"` \| `=expr` |  | The horizontal alignment for the text within NoRowsMessage. |
| `TextDecoration` | `"Default"` \| `"None"` \| `"Underline"` \| `"DoubleUnderline"` \| `"Overline"` \| `"LineThrough"` \| `=expr` |  | Text formatting for text in a NoRowsMessage. |
| `VerticalAlign` | `"Default"` \| `"Top"` \| `"Middle"` \| `"Bottom"` \| `=expr` |  | The vertical alignment for the text within NoRowsMessage. |
| `WritingMode` | `"lr-tb"` \| `"tb-rl"` \| `=expr` |  | Whether the textual content within a NoRowsMessage is laid out horizontally or vertically as well as the direction in which text moves. |

---

### TableOfContents

Represents properties for a Table of Contents in a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a Table of Contents |
| `Type` | `"tableofcontents"` | **Y** | Should be set to "tableofcontents" |
| `ZIndex` | `number` |  | The stack order of a Table of Contents |
| `Visibility` | → Visibility |  | Whether a Table of Contents is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over a Table of Contents at preview time |
| `Bookmark` | `string` |  | The Id of a Table of Contents for a Jump To Bookmark interactivity action. |
| `PageBreak` | `string` |  | The location of a page breaks generated by a Table of Contents |
| `NewPage` | `string` |  |  |
| `Levels` | → TableOfContentsLevel[] |  | A collection of levels in the hierarchy of a Table of Contents |
| `Left` | `string` |  | A value in Length units indicating the distance of a Table of Contents from the left of its container |
| `Top` | `string` |  | A value in Length units indicating the distance of a Table of Contents from the top of its container |
| `Width` | `string` |  | A value in Length units indicating the width of a Table of Contents |
| `Height` | `string` |  | A value in Length units indicating the height of a Table of Contents |
| `StyleName` | `string` |  |  |
| `Style` | object |  | Represents style information for a Table of Contents |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `BackgroundColor` | `string` |  | The color of the background of a Table of Contents Value: color string. |
| `MaxLevel` | `string` |  | The allowed depth of the levels hierarchy of a Table of Contents |
| `Border` | → BorderStyle |  | The default border properties for a Table of Contents |
| `TopBorder` | → BorderStyle |  | The top border properties for a Table of Contents |
| `RightBorder` | → BorderStyle |  | The right border properties for a Table of Contents |
| `BottomBorder` | → BorderStyle |  | The bottom border properties for a Table of Contents |
| `LeftBorder` | → BorderStyle |  | The left border properties for a Table of Contents |

---

### TableOfContentsLevel

Represents a level of the hierarchy in a Table of Contents

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `LevelName` | `string` |  | A unique identifier for a level in a Table of Contents. |
| `DisplayFillCharacters` | `boolean` |  | Whether a level should fill space between the text and the page number |
| `DisplayPageNumber` | `boolean` |  | Whether a level should display the page number |
| `StyleName` | `string` |  |  |
| `Style` | object |  | Represents style information for a level in a Table of Contents |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `BackgroundColor` | `string` |  | The color of the background of a level in a Table of Contents. Value: color string. |
| `TextDecoration` | `"Default"` \| `"None"` \| `"Underline"` \| `"DoubleUnderline"` \| `"Overline"` \| `"LineThrough"` \| `=expr` |  | Text formatting for text in a level in a Table of Contents. |
| `TextAlign` | `"Center"` \| `"General"` \| `"Left"` \| `"Right"` \| `"Justify"` \| `=expr` |  | The horizontal alignment for the text within a level in a Table of Contents. |
| `Color` | `string` |  | The foreground color of a the text within a level in a Table of Contents. Value: color string. |
| `TextIndent` | `string` |  | A value in Length units indicating the indetation of a level text. |
| `LeadingChar` | `string` |  | The character that should be used to fill the space between the text and the page number. |
| `PaddingLeft` | `string` |  | The padding between the left edge of a Table of Contents and a level's text. Value: length string. |
| `PaddingRight` | `string` |  | The padding between the right edge of a Table of Contents and a level's text. Value: length string. |
| `PaddingTop` | `string` |  | The padding between the top edge of a Table of Contents and a level's text. Value: length string. |
| `PaddingBottom` | `string` |  | The padding between the bottom edge of a Table of Contents and a level's text. Value: length string. |
| `FontStyle` | `"Default"` \| `"Normal"` \| `"Italic"` \| `=expr` |  | The font style for text within a level in a Table of Contents. |
| `FontFamily` | `string` |  | The name of the font family for text within within a level in a Table of Contents. |
| `FontSize` | `string` |  | The font size for textwithin within a level in a Table of Contents. Value: length string. |
| `FontWeight` | `"Default"` \| `"Normal"` \| `"Lighter"` \| `"Thin"` \| `"ExtraLight"` \| `"Light"` \| `"Medium"` \| `"SemiBold"` \| `"Bold"` \| `"ExtraBold"` \| `"Heavy"` \| `"Bolder"` \| `=expr` |  | The thickness of font for text within a level in a Table of Contents. |

---
