# RDLX-JSON — report-structure

Report structure, layout, data, parameters, and shared definitions (Visibility, BorderStyle, Action, Filter, etc.)

## Style Profiles

Many report items have a `Style` object. To reduce repetition, these docs reference named profiles:

**FullTextStyle:**
  BackgroundColor (color), BackgroundImage (→ BackgroundImage),
  Border / TopBorder / RightBorder / BottomBorder / LeftBorder (→ BorderStyle),
  PaddingLeft / PaddingRight / PaddingTop / PaddingBottom (length),
  Color (color), FontFamily, FontSize, FontStyle (`Normal` | `Italic`),
  FontWeight (`Normal` | `Thin` | `ExtraLight` | `Light` | `Medium` | `SemiBold` | `Bold` | `ExtraBold` | `Heavy`),
  TextDecoration (`None` | `Underline` | `DoubleUnderline` | `Overline` | `LineThrough`),
  TextAlign (`Left` | `Center` | `Right` | `Justify` | `General`),
  VerticalAlign (`Top` | `Middle` | `Bottom` | `Default`),
  Format (string), Direction (`LTR` | `RTL`), WritingMode (`lr-tb` | `tb-rl`), Language (string).
  All accept `=expression`.

**TextStyle:**
  Like FullTextStyle but without Format, VerticalAlign, Direction, WritingMode, Language.

**BoxStyle:**
  BackgroundColor, BackgroundImage, Border/Top/Right/Bottom/LeftBorder, Padding (Left/Right/Top/Bottom).
  No text formatting properties.

**BorderOnlyStyle:**
  Border/Top/Right/Bottom/LeftBorder, Padding (Left/Right/Top/Bottom).
  No background or text properties.

**BackgroundBorderStyle:**
  BackgroundColor, BackgroundImage, Border/Top/Right/Bottom/LeftBorder.
  No padding or text properties.

**BackgroundOnlyStyle:**
  BackgroundColor, BackgroundImage, Border/Top/Right/Bottom/LeftBorder.
  Same as BackgroundBorderStyle.

## Report Item Types

The `ReportItem` union includes these types (each documented in its own file):

- **Textbox** → `textbox.md`
- **Checkbox** → `other-items.md`
- **List** → `list.md`
- **Table** → `table.md`
- **Tablix** → `tablix.md`
- **Line** → `shape.md`
- **Rectangle** → `shape.md`
- **BandedList** → `banded-list.md`
- **Subreport** → `other-items.md`
- **Shape** → `shape.md`
- **TableOfContents** → `other-items.md`
- **Barcode** → `barcode.md`
- **Chart** → `chart.md`
- **DvChart** → `dvchart.md`
- **Image** → `shape.md`
- **Bullet** → `other-items.md`
- **FormattedText** → `textbox.md`
- **InputFieldText** → `other-items.md`
- **InputFieldCheckbox** → `other-items.md`
- **Sparkline** → `other-items.md`
- **RichtextPara** → `textbox.md`
- **RichtextHtml** → `textbox.md`
- **OverflowPlaceholder** → `other-items.md`
- **PartItem** → `other-items.md`
- **ContentPlaceHolder** → `other-items.md`

## Definitions

### Action

Represents a hyperlink, bookmark link, or drillthrough action that is associated with a report item.

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Hyperlink` | `string` |  | A hyperlink that is viewed by clicking the containing report item for this action |
| `Drillthrough` | object |  | Indicates a drillthrough report to be executed and viewed by clicking the containing report item for this action. |
| `BookmarkLink` | `string` |  | The ID of the bookmark that is located in a report to go to when the containing report item for this action is clicked |
| `ApplyParameters` | object |  | An apply parameters action information. |

**`Drillthrough` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `ReportName` | `string` |  | The ID of the Report to use as a drillthrough report. The value could be a path to the report template file, or an ID that is resolved by the custom resource locator |
| `Parameters` | object[] |  | Indicates the parameters to be passed to a drillthrough report |

**`ApplyParameters` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Parameters` | → ApplyParameterStep[] |  | Parameters collection to be applied within this action. |

---

### ApplyParameterStep

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | The name of the parameter to be affected. |
| `Value` | `string` |  | Parameter value for "Set" and "Toggle" types. |
| `Type` | `string` |  | Parameter update type. |

---

### BackgroundImage

Represents the background images for a report item.

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Source` | `string` |  | The type of source that is associated with a background image |
| `Value` | `string` |  | Either the location or the actual data of a background image, depending on the value of the BackgroundImage.Source |
| `MIMEType` | `string` |  | The image format of a background image. Supported values are "image/jpeg", "image/gif", "image/png", and "image/svg+xml". |
| `BackgroundRepeat` | `"Repeat"` \| `"NoRepeat"` \| `"RepeatX"` \| `"RepeatY"` \| `=expr` |  | How a background image fills the available space within its container. |

---

### Body

Represents the structure and layout information for the body of a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Height` | `string` |  | The height of the body of a report in Length units |
| `ReportItems` | → ReportItem[] |  | The collection of report items contained in the body of a report |
| `Style` | object |  | Represents appearance information for the body of a report |

**Style properties:**

Includes **BackgroundBorderStyle** properties.

---

### BorderStyle

Represents appearance properties for a border for a report item

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Color` | `string` |  | Expression that evaluates to the color of a border |
| `Style` | `string` |  | Expression that evaluates to the style of a border |
| `Width` | `string` |  | Expression that evaluates to the width of a border |

---

### ConnectionProperties

Represents information about how to connect to a data source

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `ConnectString` | `string` |  | The information necessary to connect to a data source |

---

### DataElementOutput

Type: `string`

---

### DataSet

Represents information about a set of data to be used as a part of a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a DataSet |
| `Filters` | → Filter[] |  | A set of filters to apply to each row in a DataSet |
| `Fields` | → Field[] |  | A set of fields to include in a DataSet |
| `Query` | → Query |  | The query information that is necessary to retrieve data from a data source |

---

### DataSetReference

Represent the DataSet to use to obtain a list of values and, optionally, labels for the valid values or the default value of a report parameter

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `DataSetName` | `string` | **Y** | The name of the DataSet that is being referenced |
| `ValueField` | `string` | **Y** | The name of the field in the referenced DataSet from which values are retrieved to populate the values of a parameter’s valid values or default value |
| `LabelField` | `string` |  | The name of the field in the referenced DataSet from which values are retrieved to populate the labels of a parameter’s valid values |

---

### DataSource

Represents information about a data source

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` |  | A unique identifier for a data source |
| `ConnectionProperties` | → ConnectionProperties |  | Information about how to connect to a data source |

---

### DefaultValue

Represents the default values for a report parameter

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Values` | `string`[] |  | The default values to use for a report parameter |
| `DataSetReference` | → DataSetReference |  | The DataSet reference to use to obtain the default value or values for a report parameter |

---

### DocumentMap

Represents the structure and layout information for a report map

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Source` | `string` |  | Which items are included in the report map |
| `NumberingStyle` | `string` |  | The marker of an item in the report map |
| `Levels` | `string`[] |  | Indicates the marker of items for individual hierarchy levels in the report map |

---

### EmbeddedImage

Represent an image that is embedded within a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` |  | A unique identifier for an embedded image |
| `ImageData` | `string` |  | Image data in base64 format for an embedded image |
| `MIMEType` | `string` |  | The image format of an embedded image Supported values are "image/jpeg", "image/gif", "image/png", and "image/svg+xml" |

---

### Field

Represents information about a DataSet field

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a field |
| `Value` | `string` |  | A value or an expression that evaluates to a value for this field |
| `DataField` | `string` |  | The name of the field that is returned by the DataSet query |

---

### Filter

Represents a filter to apply to rows of data within a DataSet, a group, or a data region

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `FilterExpression` | `string` | **Y** | An expression that is evaluated for each instance of a group, or for each row of data that is associated with a DataSet, a group, or a data region. This expression is then compared to the value of the FilterValues element by using the Operator. Failed comparisons result in the row or instance being filtered out of its containing group, dataset, or data region. |
| `Operator` | → FilterOperator | **Y** | An operator to use to compare the values of FilterExpression and FilterValues |
| `FilterValues` | `string`[] | **Y** | The values to compare to a FilterExpression |

---

### FilterOperator

Represents the opeator to use to compare the values of Filer.FilterExpression and Filter.FilterValues

Type: `string`

---

### FixedPageSection

Represents the structure and layout information for a page of a fixed layout report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `ReportItems` | → ReportItem[] |  | The collection of report items contained in a fixed page |
| `ThrowIfPlaceHoldersEmpty` | `boolean` |  |  |
| `Visibility` | → Visibility |  |  |
| `Width` | `string` |  |  |
| `Height` | `string` |  |  |
| `LeftMargin` | `string` |  |  |
| `RightMargin` | `string` |  |  |
| `TopMargin` | `string` |  |  |
| `BottomMargin` | `string` |  |  |
| `PaperOrientation` | `string` |  |  |
| `CustomProperties` | object[] |  |  |
| `Style` | object |  | Represents appearance information for a fixed page |

**Style properties:**

Includes **BackgroundBorderStyle** properties.

---

### Grouping

Represents information about data categorization

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` |  | A unique identifier for a grouping |
| `DocumentMapLabel` | `string` |  | An expression indicating the text of a link to the instance of grouping in the Report Map |
| `GroupExpressions` | `string`[] |  | The collection of expressions by which to group the data in a grouping. |
| `PageBreak` | `string` |  | The location of page breaks generated by instances of a grouping. |
| `PageBreakDisabled` | `string` |  | An expression that evaluates to a value indicating whether the page break option should be ignored |
| `NewPage` | `string` |  |  |
| `Filters` | → Filter[] |  | A collection of filters to be applied to the data for each instance of a grouping |
| `ParentGroup` | `string` |  | An expression that identifies the parent group in a recursive hierarchy |
| `NewSection` | `boolean` |  | Whether each instance of a grouping has its page numbering. |
| `Enabled` | `string` |  |  |

---

### InputField

Represents the input control for fillable PDF forms.

One of:

- → **InputFieldText**
- → **InputFieldCheckbox**

---

### Layer

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** |  |
| `DesignerLock` | `boolean` |  |  |
| `DesignerTransparency` | `number` |  |  |
| `DesignerVisible` | `boolean` |  |  |
| `DesignerDataFieldVisible` | `boolean` |  |  |
| `TargetDevice` | `string` |  |  |

---

### Page

Represents the structure and layout information of report pages

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `PageWidth` | `string` |  | The width for rendering in Length units |
| `PageHeight` | `string` |  | The height for rendering in Length units |
| `RightMargin` | `string` |  | The width of the right margin of a page in Length units |
| `LeftMargin` | `string` |  | The width of the left margin of a page in Length units |
| `TopMargin` | `string` |  | The width of the top margin of a page in Length units |
| `BottomMargin` | `string` |  | The width of the bottom margin of a page in Length units |
| `Columns` | `number` |  | The default number of columns used to render a report |
| `ColumnSpacing` | `string` |  | The spacing between each column for a multi-column rendering of a report in Length units |
| `PaperOrientation` | `string` |  |  |

---

### PageSection

Represents the structure and layout information for the page header or page footer

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Height` | `string` |  | The height of a page section in Length units |
| `ReportItems` | → ReportItem[] |  | The collection of report items contained in a page section |
| `PrintOnFirstPage` | `boolean` |  | The value indicating whether the page header or page footer is shown on the first rendered page in a report |
| `PrintOnLastPage` | `boolean` |  | The value indicating whether the page header or page footer is shown on the last rendered page in a report |
| `CustomProperties` | object[] |  |  |
| `Style` | object |  | Represents appearance information for a page section |

**Style properties:**

Includes **BackgroundBorderStyle** properties.

---

### ParameterValue

Represents a value/label pair for a report parameter's valid values

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Value` | `string` |  | The value for a report parameter |
| `Label` | `string` |  | The text to use to describe the report parameter value to display in a parameter drop-down at runtime |

---

### ParameterValuesOrder

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Condition` | `string` |  |  |
| `Direction` | `string` |  |  |

---

### Query

Represents the information that is necessary to execute and retrieve data for a DataSet

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `DataSourceName` | `string` | **Y** | The name of a data source against which to execute a query |
| `CommandText` | `string` |  | The query to execute to obtain data for a DataSet |

---

### Report

Represents a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `PageHeader` | → PageSection |  | Properties for the header of report pages. |
| `Body` | → Body |  | Properties for the body of report pages. |
| `PageFooter` | → PageSection |  | Properties for the footer of report pages. |
| `FixedPage` | object |  | Represents properties for a fixed page layout. |
| `Themes` | `string`[] |  | A collection of themes available for a report |
| `ReportSections` | → ReportSection[] |  |  |
| `Name` | `string` |  | A unique identifier for a Report |
| `Description` | `string` |  | The description of a Report |
| `Author` | `string` |  | The author of a Report |
| `Page` | → Page |  | The structure and layout information of report pages. |
| `Width` | `string` |  | A value in Length units indicating the width of the body of a report. |
| `Language` | `string` |  | The default language to use for dates and number formatting within a report. |
| `ConsumeContainerWhitespace` | `boolean` |  | Whether all whitespace in a report should be consumed when contents grow |
| `DocumentMap` | → DocumentMap |  | Properties for the map of a report. |
| `ReportParameters` | → ReportParameter[] |  | A collection of parameters of a report. |
| `DataSources` | → DataSource[] |  | A collection of data sources of a report. |
| `DataSets` | → DataSet[] |  | A collection of data sets of a report. |
| `EmbeddedImages` | → EmbeddedImage[] |  | A collection of embedded images of a report. |
| `LayoutOrder` | `string` |  | The pages order layout ('Z' or 'N'). |
| `StartPageNumber` | `number` |  | The number of the first page for page numbering of a report. |
| `ThemeUri` | `string` |  | The location of a report theme |
| `Classes` | object[] |  |  |
| `CodeModules` | `string`[] |  |  |
| `ReportParts` | object[] |  |  |
| `Libraries` | object[] |  |  |
| `Version` | `"10.0.7"` |  |  |
| `EmbeddedStylesheets` | → Stylesheet[] |  |  |
| `Stylesheet` | object |  |  |

**`FixedPage` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Pages` | → FixedPageSection[] |  | A collection of pages in a fixed page layout. |
| `Group` | → Grouping |  | The expressions by which to group the data in a fixed page layout. |
| `DataSetName` | `string` |  | The name of the dataset to use to bind data to a fixed page layout. |
| `Filters` | → Filter[] |  | A collection of filters to be applied to the data for each row of a fixed page layout. |
| `SortExpressions` | → SortExpression[] |  | A collection of expressions that are applied to the filtered data of a fixed page layout to order the data. |

**`Stylesheet` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Source` | `string` |  |  |
| `Value` | `string` |  |  |

---

### ReportParameter

Represents information about a parameter to a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a report parameter |
| `DataType` | `string` | **Y** | The data type of a report parameter |
| `Hidden` | `boolean` |  | Whether a report parameter is not displayed to the user at runtime |
| `Multiline` | `boolean` |  | Whether the input control for a report parameter value allows multiple lines |
| `AllowBlank` | `boolean` |  | A value indicating whether an empty string is allowed as a value for a report parameter |
| `DefaultValue` | → DefaultValue |  | The default value or values to use for a report parameter if values are not provided by the user |
| `MultiValue` | `boolean` |  | Whether a report parameter can take a set of values rather than a single value |
| `EnableEmptyArray` | → ThreeStateBoolean |  | Specifies whether this parameter can have an empty array as its value. This setting is only available for multi-valued parameters |
| `Nullable` | `boolean` |  | Whether the value of a report parameter can be null |
| `Prompt` | `string` |  | The text or an [expression] to use when prompting the user to provide the value or values for a report parameter |
| `SelectAllValue` | `string` |  | The text that appears for the "Select All" option for the input of a multi-value report parameter |
| `ValidValues` | → ValidValues |  | The possible values that can be used for the a report parameter |
| `DisplayFormat` | `string` |  | The date and time format |

---

### ReportSection

One of:


**Variant: Type=`"Continuous"`**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** |  |
| `Type` | `"Continuous"` | **Y** |  |
| `Visibility` | → Visibility |  |  |
| `DataElementName` | `string` |  |  |
| `DataElementOutput` | → DataElementOutput |  |  |
| `Width` | `string` |  |  |
| `Body` | → Body |  |  |
| `DisplayName` | `string` |  | The section displayed name |
| `PageHeader` | → PageSection |  |  |
| `PageFooter` | → PageSection |  |  |
| `Page` | → Page |  |  |
| `Label` | `string` |  | A label to identify a report section for the document map. |
| `CustomProperties` | object[] |  |  |


**Variant: Type=`"FixedPage"`**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** |  |
| `Type` | `"FixedPage"` | **Y** |  |
| `Visibility` | → Visibility |  |  |
| `DataElementName` | `string` |  |  |
| `DataElementOutput` | → DataElementOutput |  |  |
| `Width` | `string` |  |  |
| `DisplayName` | `string` |  | The section displayed name |
| `FixedPage` | object |  |  |
| `Page` | → Page |  |  |
| `Label` | `string` |  | A label to identify a report section for the document map. |
| `CustomProperties` | object[] |  |  |

**`FixedPage` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Pages` | → FixedPageSection[] |  |  |
| `Group` | → Grouping |  |  |
| `DataSetName` | `string` |  |  |
| `Filters` | → Filter[] |  |  |
| `SortExpressions` | → SortExpression[] |  |  |
| `DataElementName` | `string` |  |  |
| `DataElementOutput` | → DataElementOutput |  |  |


---

### RoundingRadius

Represents the border radius of a container

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Default` | `string` |  | A value in Length units indicating the default border radius of a container |
| `TopLeft` | `string` |  | A value in Length units indicating the top left border radius of a container |
| `TopRight` | `string` |  | A value in Length units indicating the top right border radius of a container |
| `BottomLeft` | `string` |  | A value in Length units indicating the bottom left border radius of a container |
| `BottomRight` | `string` |  | A value in Length units indicating the bottom right border radius of a container |

---

### SideStyle

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Color` | `string` |  |  |
| `Style` | `string` |  |  |
| `Width` | `string` |  |  |

---

### SortExpression

Represents an expression used in sorting

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Value` | `string` |  | An expression that results in a data by which to order |
| `Direction` | `string` |  | The sort order. |

---

### StyleProperties

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Border` | → BorderStyle |  |  |
| `TopBorder` | → BorderStyle |  |  |
| `RightBorder` | → BorderStyle |  |  |
| `BottomBorder` | → BorderStyle |  |  |
| `LeftBorder` | → BorderStyle |  |  |
| `BackgroundColor` | `string` |  |  |
| `BackgroundImage` | → BackgroundImage |  |  |
| `FontStyle` | `"Default"` \| `"Normal"` \| `"Italic"` \| `=expr` |  |  |
| `FontFamily` | `string` |  |  |
| `FontSize` | `string` |  |  |
| `FontWeight` | `"Default"` \| `"Normal"` \| `"Lighter"` \| `"Thin"` \| `"ExtraLight"` \| `"Light"` \| `"Medium"` \| `"SemiBold"` \| `"Bold"` \| `"ExtraBold"` \| `"Heavy"` \| `"Bolder"` \| `=expr` |  |  |
| `LineSpacing` | `string` |  |  |
| `CharacterSpacing` | `string` |  |  |
| `Format` | `string` |  |  |
| `TextDecoration` | `"Default"` \| `"None"` \| `"Underline"` \| `"DoubleUnderline"` \| `"Overline"` \| `"LineThrough"` \| `=expr` |  |  |
| `TextAlign` | `"Center"` \| `"General"` \| `"Left"` \| `"Right"` \| `"Justify"` \| `=expr` |  |  |
| `VerticalAlign` | `"Default"` \| `"Top"` \| `"Middle"` \| `"Bottom"` \| `=expr` |  |  |
| `Color` | `string` |  |  |
| `PaddingLeft` | `string` |  |  |
| `PaddingRight` | `string` |  |  |
| `PaddingTop` | `string` |  |  |
| `PaddingBottom` | `string` |  |  |
| `Direction` | `"Default"` \| `"LTR"` \| `"RTL"` \| `=expr` |  |  |
| `Language` | `string` |  |  |
| `Calendar` | `"Default"` \| `"Gregorian"` \| `"GregorianArabic"` \| `"GregorianMiddleEastFrench"` \| `"GregorianTransliteratedEnglish"` \| `"GregorianTransliteratedFrench"` \| `"GregorianUSEnglish"` \| `"Hebrew"` \| `"Hijri"` \| `"Japanese"` \| `"Korean"` \| `"Taiwan"` \| `"ThaiBuddhist"` \| `=expr` |  |  |
| `NumeralLanguage` | `string` |  |  |
| `NumeralVariant` | `string` |  |  |
| `UnicodeBiDi` | `"Normal"` \| `"Embed"` \| `"BidiOverride"` \| `=expr` |  |  |
| `UprightInVerticalText` | `"None"` \| `"Digits"` \| `"DigitsAndLatinLetters"` \| `=expr` |  |  |
| `TextIndent` | `string` |  |  |
| `LeadingChar` | `string` |  |  |
| `MaxLevel` | `string` |  |  |
| `HeadingLevel` | `string` |  |  |
| `ShrinkToFit` | `string` |  |  |
| `TextJustify` | `"Auto"` \| `"Distribute"` \| `"DistributeAllLines"` \| `=expr` |  |  |
| `Angle` | `string` |  |  |
| `MinCondenseRate` | `string` |  |  |
| `DisplayFillCharacters` | `string` |  |  |
| `DisplayPageNumber` | `string` |  |  |

---

### Stylesheet

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** |  |
| `Styles` | → StylesheetStyle[] | **Y** |  |

---

### StylesheetStyle

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** |  |
| `Properties` | → StyleProperties |  |  |
| `Parent` | `string` |  |  |

---

### ThreeStateBoolean

Type: `string`

---

### UserSort

Represents information about an end-user sort control that is displayed as part of a Textbox in a rendering of a Report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `SortExpression` | `string` | **Y** | An expression on which to sort |
| `SortExpressionScope` | `string` |  | The name of the scope (data region or Group) in which to evaluate the SortExpression. |
| `SortTarget` | `string` |  | The name of a data region, Group, or DataSet to which to apply the sort |

---

### ValidValues

Represents possible values for a report parameter and for populating UI selection lists for users to select a parameter value

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `ParameterValues` | → ParameterValue[] |  | The list of values and, optionally, labels for use in value validation and for populating the UI for the report parameter |
| `DataSetReference` | → DataSetReference |  | The fields from a dataset to use to obtain a list of values and, optionally, labels for use in value validation and for populating the UI for the report parameter |
| `OrderBy` | → ParameterValuesOrder |  | Get or set the order of values ​​or labels to use when validating values ​​and to populate the user interface for a report parameter. |

---

### Visibility

Represents properties to determine whether a report item is displayed in a rendered report.

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Hidden` | `string` |  | An expression indicating whether a report item is initially hidden |
| `ToggleItem` | `string` |  | The name of a Textbox that is used to hide or unhide the containing report item |

---
