# RDLX-JSON — textbox

Text report items: Textbox, FormattedText, RichtextPara, RichtextHtml, and their sub-definitions (Paragraph, TextRun, etc.)

## Definitions

### FormattedText

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** |  |
| `Type` | `"formattedtext"` | **Y** |  |
| `ZIndex` | `number` |  |  |
| `Visibility` | → Visibility |  |  |
| `ToolTip` | `string` |  |  |
| `Bookmark` | `string` |  |  |
| `DataElementName` | `string` |  |  |
| `DataElementOutput` | → DataElementOutput |  |  |
| `Label` | `string` |  |  |
| `LayerName` | `string` |  |  |
| `CustomProperties` | object[] |  |  |
| `AccessibleDescription` | `string` |  |  |
| `EncodeMailMergeFields` | `boolean` |  |  |
| `Html` | `string` |  |  |
| `MailMergeFields` | object[] |  |  |
| `Left` | `string` |  |  |
| `Top` | `string` |  |  |
| `Width` | `string` |  |  |
| `Height` | `string` |  |  |
| `Style` | object |  |  |

**Style properties:**

Includes **BackgroundBorderStyle** properties.

---

### Paragraph

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `TextRuns` | → TextRun[] |  |  |
| `LeftIndent` | `string` |  |  |
| `RightIndent` | `string` |  |  |
| `HangingIndent` | `string` |  |  |
| `StyleName` | `string` |  |  |
| `ListStyle` | `string` |  |  |
| `ListLevel` | `number` |  |  |
| `ListItemIndex` | `number` |  |  |
| `SpaceBefore` | `string` |  |  |
| `SpaceAfter` | `string` |  |  |
| `ListStyleType` | `string` |  |  |
| `Style` | object |  |  |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `TextAlign` | `string` |  |  |
| `FontFamily` | `string` |  |  |
| `FontSize` | `string` |  |  |
| `FontStyle` | `string` |  |  |
| `FontWeight` | `string` |  |  |
| `Color` | `string` |  |  |
| `LineSpacing` | `string` |  |  |
| `BackgroundColor` | `string` |  |  |
| `TextDecoration` | `string` |  |  |

---

### Richtext

One of:

- → **RichtextPara**
- → **RichtextHtml**

---

### RichtextHtml

Represents properties for a RichText in a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a RichText |
| `Type` | `"richtext"` | **Y** | Should be set to "richtext" |
| `CanGrow` | `boolean` |  | Whether the height of a RichText can increase to match its contents |
| `KeepTogether` | `boolean` |  | Whether the entire contents of a RichText should be kept together on one Page if possible |
| `ZIndex` | `number` |  | The stack order of a RichText. |
| `Visibility` | → Visibility |  | Whether a RichText is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over a RichText at preview time |
| `Bookmark` | `string` |  | The Id of a RichText for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with a RichText that appears in the Report Map and Table of Contents |
| `Value` | `string` |  | A value or an expression that is displayed for a RichText. |
| `Left` | `string` |  | A value in Length units indicating the distance of a RichText from the left of the richtext's container |
| `Top` | `string` |  | A value in Length units indicating the distance of a RichText from the top of the richtext's container |
| `Width` | `string` |  | A value in Length units indicating the width of a RichText |
| `Height` | `string` |  | A value in Length units indicating the height of a RichText |
| `Style` | object |  | Represents style information for a RichText |

**Style properties:**

Includes **BoxStyle** properties.

Additional style properties:

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Color` | `string` |  | The foreground color of text within a RichText. Value: color string. |
| `FontFamily` | `string` |  | The name of the font family for text within a RichText. |
| `FontSize` | `string` |  | The font size for text within a RichText. Value: length string. |
| `FontStyle` | `"Default"` \| `"Normal"` \| `"Italic"` \| `=expr` |  | The font style for text within a RichText. |
| `FontWeight` | `"Default"` \| `"Normal"` \| `"Lighter"` \| `"Thin"` \| `"ExtraLight"` \| `"Light"` \| `"Medium"` \| `"SemiBold"` \| `"Bold"` \| `"ExtraBold"` \| `"Heavy"` \| `"Bolder"` \| `=expr` |  | The thickness of font for text within a RichText. |
| `VerticalAlign` | `"Default"` \| `"Top"` \| `"Middle"` \| `"Bottom"` \| `=expr` |  | The vertical alignment for the text within a richtext. |

---

### RichtextPara

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** |  |
| `Type` | `"richtext"` | **Y** |  |
| `CanGrow` | `boolean` |  |  |
| `DataElementStyle` | `string` |  |  |
| `KeepTogether` | `boolean` |  |  |
| `ZIndex` | `number` |  |  |
| `Visibility` | → Visibility |  |  |
| `ToolTip` | `string` |  |  |
| `Bookmark` | `string` |  |  |
| `DataElementName` | `string` |  |  |
| `DataElementOutput` | → DataElementOutput |  |  |
| `Label` | `string` |  |  |
| `LayerName` | `string` |  |  |
| `CustomProperties` | object[] |  |  |
| `Paragraphs` | → Paragraph[] |  |  |
| `Left` | `string` |  |  |
| `Top` | `string` |  |  |
| `Width` | `string` |  |  |
| `Height` | `string` |  |  |
| `Style` | object |  |  |

**Style properties:**

Includes **BoxStyle** properties.

Additional style properties:

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Color` | `string` |  |  |
| `FontFamily` | `string` |  |  |
| `FontSize` | `string` |  |  |
| `FontStyle` | `"Default"` \| `"Normal"` \| `"Italic"` \| `=expr` |  |  |
| `FontWeight` | `"Default"` \| `"Normal"` \| `"Lighter"` \| `"Thin"` \| `"ExtraLight"` \| `"Light"` \| `"Medium"` \| `"SemiBold"` \| `"Bold"` \| `"ExtraBold"` \| `"Heavy"` \| `"Bolder"` \| `=expr` |  |  |
| `LineHeight` | `string` |  |  |
| `VerticalAlign` | `"Default"` \| `"Top"` \| `"Middle"` \| `"Bottom"` \| `=expr` |  |  |

---

### TextRun

One of:

- → **TextRunText**
- → **TextRunImage**

---

### TextRunImage

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Type` | `"image"` | **Y** |  |
| `Value` | `string` |  |  |
| `Action` | → Action |  |  |
| `Source` | `string` |  |  |
| `MIMEType` | `string` |  |  |
| `ToolTip` | `string` |  |  |
| `Label` | `string` |  |  |
| `Width` | `string` |  |  |
| `Height` | `string` |  |  |

---

### TextRunText

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Type` | `"text"` | **Y** |  |
| `Value` | `string` |  |  |
| `Action` | → Action |  |  |
| `ToolTip` | `string` |  |  |
| `Label` | `string` |  |  |
| `StyleName` | `string` |  |  |
| `Style` | object |  |  |

**Style properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Subscript` | `string` |  |  |
| `Superscript` | `string` |  |  |
| `FontFamily` | `string` |  |  |
| `FontSize` | `string` |  |  |
| `FontStyle` | `string` |  |  |
| `FontWeight` | `string` |  |  |
| `Color` | `string` |  |  |
| `LineSpacing` | `string` |  |  |
| `BackgroundColor` | `string` |  |  |
| `TextDecoration` | `string` |  |  |

---

### Textbox

Represents properties for a Textbox in a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a Textbox |
| `Value` | `string` |  | A value or an expression that is displayed for a Textbox |
| `Type` | `"textbox"` | **Y** | Should be set to "textbox" |
| `Action` | → Action |  | An action (such as a hyperlink) associated with a Textbox |
| `CanGrow` | `boolean` |  | Whether the height of a Textbox can increase to accommodate its contents |
| `CanShrink` | `boolean` |  | Whether the height of a Textbox can decrease to match its contents |
| `KeepTogether` | `boolean` |  | Whether the entire contents of a Textbox should be kept together on one Page if possible |
| `ToggleImage` | object |  | Represents the initial state (+/-) of a toggle image if it is displayed as part of a Textbox |
| `UserSort` | → UserSort |  | An end-user sort configuration that is displayed as part of a Textbox within the UI. |
| `ZIndex` | `number` |  | The stack order of a textbox |
| `Visibility` | → Visibility |  | Whether a Textbox is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over a textbox at preview time |
| `Bookmark` | `string` |  | The Id of a textbox for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with a textbox that appears in the Report Map and Table of Contents |
| `Left` | `string` |  | A value in Length units indicating the distance of a Textbox from the left of the text box's container |
| `Top` | `string` |  | A value in Length units indicating the distance of a Textbox from the top of the text box's container |
| `Width` | `string` |  | A value in Length units indicating the width of a Textbox |
| `Height` | `string` |  | A value in Length units indicating the height of a Textbox |
| `StyleName` | `string` |  |  |
| `CustomCSSClasses` | `string` |  |  |
| `Style` | object |  | Represents style information for a Textbox |

**Style properties:**

Includes **FullTextStyle** properties.

Additional style properties:

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Angle` | `string` |  | Text rotation in degrees relative to the text baseline. The value or the expression result should be a number. |
| `CharacterSpacing` | `string` |  | The space between characters of text for a textbox. The value or the expression result should be in Length units |
| `HeadingLevel` | `string` |  | The position of a textbox content in the Table of Contents hierarchy. The value or the expression result should be a number. |
| `LineSpacing` | `string` |  | A value or an expression determining the height of a line of text for a textbox. Value: length string. |
| `MinCondenseRate` | `string` |  | The lower bound for the ratio of the decreased font size to the original one. The value or the expression result should be a percentage value, such as "50%" |
| `ShrinkToFit` | `string` |  | Whether a textbox can decrease the font size of its content to fit it into the report item's size |
| `TextJustify` | `"Auto"` \| `"Distribute"` \| `"DistributeAllLines"` \| `=expr` |  | Text arrangement for a textbox that has TextAlign set to "Justify" |
| `WrapMode` | `"NoWrap"` \| `"CharWrap"` \| `"WordWrap"` \| `=expr` |  | How words should break when reaching the end of a line for a textbox. |

**`ToggleImage` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `InitialState` | `string` | **Y** | A value or an expression initial state of a toggle image. If the value or expression result is true, then the toggle image is interpreted as expanded and displays a minus sign. If the value or expression result is false, then the toggle image is interpreted as collapsed and displays a plus sign. |

---
