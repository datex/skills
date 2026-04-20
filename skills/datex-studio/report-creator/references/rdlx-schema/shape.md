# RDLX-JSON — shape

Geometric report items: Shape, Line, Rectangle, Image.

## Definitions

### Image

Represents properties for an Image in a Report.

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for an image |
| `Value` | `string` |  | Location or the actual data of an image, depending on the value of the Source property. |
| `Type` | `"image"` | **Y** | Should be set to "image" |
| `Action` | → Action |  | An action (such as hyperlinks) that is associated with an Image. |
| `Source` | `string` |  | The type of source for an Image |
| `MIMEType` | `string` |  | The image format of an Image. Supported values are "image/jpeg", "image/gif", "image/png", and "image/svg+xml". |
| `ZIndex` | `number` |  | The stack order of an Image |
| `Visibility` | → Visibility |  | Whether an Image is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over an Image at preview time |
| `Bookmark` | `string` |  | The Id of an Image for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with an Image that appears in the Report Map and Table of Contents |
| `AccessibleDescription` | `string` |  |  |
| `Sizing` | `string` |  | The behavior of an Image if the actual image does not fit within the specified size of the image. |
| `HorizontalAlignment` | `"Center"` \| `"Left"` \| `"Right"` \| `=expr` |  | A value or expression indicating the horizontal alignment for the actual image within an Image report item. |
| `VerticalAlignment` | `"Top"` \| `"Middle"` \| `"Bottom"` \| `=expr` |  | A value or expression indicating the vertical alignment for the actual image within an Image report item. |
| `Left` | `string` |  | A value in Length units indicating the distance of an Image from the left of the image's container |
| `Top` | `string` |  | A value in Length units indicating the distance of an Image from the top of the image's container |
| `Width` | `string` |  | A value in Length units indicating the width of an Image |
| `Height` | `string` |  | A value in Length units indicating the height of an Image |
| `StyleName` | `string` |  |  |
| `ApplyExifOrientation` | → ThreeStateBoolean |  |  |
| `Style` | object |  | Represents style information for an Image. |

**Style properties:**

Includes **BorderOnlyStyle** properties.

---

### Line

Represents properties for a Line in a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a Line |
| `Type` | `"line"` | **Y** | Should be set to "line" |
| `ZIndex` | `number` |  | The stack order of a Line |
| `Visibility` | → Visibility |  | Whether a Line is hidden |
| `Bookmark` | `string` |  | The Id of a Line for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with a Line that appears in the Report Map and Table of Contents |
| `StartPoint` | object |  | Represents the start point of a line |
| `EndPoint` | object |  | Represents the end point of a line |
| `LineWidth` | `string` |  | A value or an expression that evaluates to the width of a Line The value or the expression result should be in Length units |
| `LineStyle` | `"Default"` \| `"None"` \| `"Dotted"` \| `"Dashed"` \| `"Solid"` \| `"Double"` \| `"DashDot"` \| `"DashDotDot"` \| `"Groove"` \| `"Ridge"` \| `"Inset"` \| `"WindowInset"` \| `"Outset"` \| `=expr` |  | Expression that evaluates to the style of a Line |
| `LineColor` | `string` |  | A value or an expression that evaluates to the color of a Line The value or the expression result should be either a cross-browser color name or to a hexadecimal color code, such as ```#face0d```. |
| `AccessibleDescription` | `string` |  |  |

**`StartPoint` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `X` | `string` |  | A value in Length units indicating the distance of the start point a line from the left of the line's container. |
| `Y` | `string` |  | A value in Length units indicating the distance of the start point of a line from the top of the line's container. |

**`EndPoint` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `X` | `string` |  | A value in Length units indicating the distance of the end point a line from the left of the line's container. |
| `Y` | `string` |  | A value in Length units indicating the distance of the end point a line from the top of the line's container. |

---

### Rectangle

Represents properties for a Container in a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a Rectangle |
| `Type` | `"rectangle"` | **Y** | Should be set to "rectangle" |
| `KeepTogether` | `boolean` |  | Whether the entire contents of a Container should be kept together on one Page if possible |
| `ZIndex` | `number` |  | The stack order of a Container |
| `Visibility` | → Visibility |  | Whether a Container is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over a Container at preview time |
| `Bookmark` | `string` |  | The Id of a Container for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with a Container that appears in the Report Map and Table of Contents |
| `ConsumeWhiteSpace` | `boolean` |  | Whether all whitespace in a Container should be consumed when contents grow |
| `PageBreak` | `string` |  | The location of a page breaks generated by a Container |
| `NewPage` | `string` |  |  |
| `ReportItems` | → ReportItem[] |  | A collection of report items that are contained within a Container |
| `RoundingRadius` | → RoundingRadius |  | The container's border radius. |
| `Overflow` | `string` |  | The container's behavior in case of it's content does not fit in. |
| `Left` | `string` |  | A value in Length units indicating the distance of a Container from the left of the container's container |
| `Top` | `string` |  | A value in Length units indicating the distance of a Container from the top of the container's container |
| `Width` | `string` |  | A value in Length units indicating the width of a Container |
| `Height` | `string` |  | A value in Length units indicating the height of a Container |
| `Style` | object |  | Represents style information for a Container |

**Style properties:**

Includes **BackgroundBorderStyle** properties.

---

### Shape

Represents properties for a Shape in a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a Shape |
| `Type` | `"shape"` | **Y** | Should be set to "shape" |
| `ZIndex` | `number` |  | The stack order of a Shape |
| `Visibility` | → Visibility |  | Whether a Shape is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over a Shape at preview time |
| `Bookmark` | `string` |  | The Id of a Shape for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with a Shape that appears in the Report Map and Table of Contents |
| `AccessibleDescription` | `string` |  |  |
| `RoundingRadius` | → RoundingRadius |  | The shape's border radius. |
| `ShapeStyle` | `"Rectangle"` \| `"RoundRect"` \| `"Ellipse"` \| `=expr` |  | The shape type. |
| `Left` | `string` |  | A value in Length units indicating the distance of a Shape from the left of the shape's container |
| `Top` | `string` |  | A value in Length units indicating the distance of a Shape from the top of the shape's container |
| `Width` | `string` |  | A value in Length units indicating the width of a Shape |
| `Height` | `string` |  | A value in Length units indicating the height of a Shape |
| `StyleName` | `string` |  |  |
| `Style` | object |  | Represents style information for a Shape |

**Style properties:**

Includes **BackgroundBorderStyle** properties.

---
