# RDLX-JSON — barcode

Barcode report item and all barcode-type option definitions.

## Definitions

### Barcode

Represents properties for a Barcode in a report

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Name` | `string` | **Y** | A unique identifier for a List |
| `Value` | `string` |  | A value or an expression that is displayed for a Barcode |
| `Type` | `"barcode"` | **Y** | Should be set to "barcode" |
| `ZIndex` | `number` |  | The stack order of a Barcode |
| `Visibility` | → Visibility |  | Whether a Barcode is hidden |
| `ToolTip` | `string` |  | The text displayed when a report reader hovers over a Barcode at preview time |
| `Bookmark` | `string` |  | The Id of a Barcode for a Jump To Bookmark interactivity action. |
| `Label` | `string` |  | The text associated with a Barcode that appears in the Report Map and Table of Contents |
| `AccessibleDescription` | `string` |  |  |
| `InvalidBarcodeText` | `string` |  | A value an expression indicating the text that shows in case a Barcode's value is invalid. |
| `Symbology` | `string` |  | The Barcode type. Supported values are |
| `CheckSum` | `boolean` |  | Whether a barcode requires a checksum. |
| `BarHeight` | `string` |  | A value in Length units indicating the height of the barcode's bars. |
| `CaptionGrouping` | `boolean` |  | Whether to add spaces between groups of characters in the caption to make long numbers easier to read. |
| `CaptionLocation` | `string` |  | The vertical alignment of the caption in a Barcode. |
| `AztecOptions` | → BarcodeAztecOptions |  |  |
| `Code49Options` | → BarcodeCode49Options |  | Options for a Code49 barcode |
| `DataMatrixOptions` | → BarcodeDataMatrixOptions |  | Options for a DataMatrix barcode |
| `Gs1CompositeOptions` | → BarcodeGs1CompositeOptions |  | Options for a GC1QRCode barcode |
| `NarrowBarWidth` | `string` |  | A value in Length units indicating the width of the narrowest part of the barcode. |
| `NWRation` | `number` |  | The multiple of the ratio between the narrow and wide bars in symbologies that contain bars in only two widths. |
| `Pdf417Options` | → BarcodePdf417Options |  | Options for a Pdf417 barcode |
| `QrCodeOptions` | → BarcodeQrCodeOptions |  | Options for a QRCode barcode |
| `QuietZone` | object |  | An area of blank space on each side of a barcode that tells the scanner where the symbology starts and stops. |
| `Rotation` | `string` |  | The amount of rotation to use for the barcode. Supported values are |
| `Left` | `string` |  | A value in Length units indicating the distance of a Barcode from the left of the barcode's container |
| `Top` | `string` |  | A value in Length units indicating the distance of a Barcode from the top of the barcode's container |
| `Width` | `string` |  | A value in Length units indicating the width of a Barcode |
| `Height` | `string` |  | A value in Length units indicating the height of a Barcode |
| `Style` | object |  | Represents style information for a Barcode |

**Style properties:**

Includes **BorderOnlyStyle** properties.

Additional style properties:

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `BackgroundColor` | `string` |  | The color of the background of a Barcode Value: color string. |
| `Color` | `string` |  | The foreground color of the caption in a Barcode Value: color string. |
| `FontFamily` | `string` |  | The name of the font family for the caption in a Barcode. |
| `FontSize` | `string` |  | The font size for the caption in a Barcode. Value: length string. |
| `FontStyle` | `"Default"` \| `"Normal"` \| `"Italic"` \| `=expr` |  | The font style for the caption in a Barcode. |
| `FontWeight` | `"Default"` \| `"Normal"` \| `"Lighter"` \| `"Thin"` \| `"ExtraLight"` \| `"Light"` \| `"Medium"` \| `"SemiBold"` \| `"Bold"` \| `"ExtraBold"` \| `"Heavy"` \| `"Bolder"` \| `=expr` |  | The thickness of font for the caption in a Barcode. |
| `Format` | `string` |  | A formatting code that is used when the numeric value in a Barcode caption is formatted. Supported formats are - Standard Numeric Format Strings - Custom Numeric Format Strings - Standard Date and Time Format Strings - Custom Date and Time Format Strings |
| `TextAlign` | `"Center"` \| `"General"` \| `"Left"` \| `"Right"` \| `"Justify"` \| `=expr` |  | The horizontal alignment for the caption in a Barcode |
| `TextDecoration` | `"Default"` \| `"None"` \| `"Underline"` \| `"DoubleUnderline"` \| `"Overline"` \| `"LineThrough"` \| `=expr` |  | Text formatting for the caption in a Barcode. |

**`QuietZone` properties:**

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Left` | `string` |  |  |
| `Right` | `string` |  |  |
| `Top` | `string` |  |  |
| `Bottom` | `string` |  |  |

---

### BarcodeAztecOptions

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `ErrorCorrection` | `number` |  | Percentage of "check digits" in barcode body. Typically is between 5% and 95%, default is 33% |
| `Layers` | `number` |  | Barcode layers count. More layers - more data can be encoded. Can be from 1 to 32. 0 is auto. Values from -1 to -4 means 1 to 4 layers with compressed mode. |
| `Encoding` | `string` |  |  |

---

### BarcodeCode49Options

Represents options of a Code49 Barcode

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Grouping` | `boolean` |  | Whether to use grouping for the Code49 barcode. |
| `GroupNumber` | `number` |  | A value between 0 and 8 indicating for the Code49 barcode grouping. |

---

### BarcodeDataMatrixOptions

Represents options of a DataMatrix Barcode

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `EccMode` | `string` |  |  |
| `Ecc200SymbolSize` | `string` |  |  |
| `Ecc200EncodingMode` | `string` |  |  |
| `Ecc000_140SymbolSize` | `string` |  |  |
| `StructuredAppend` | `boolean` |  |  |
| `StructureNumber` | `number` |  |  |
| `FileIdentifier` | `number` |  |  |
| `Encoding` | `string` |  |  |

---

### BarcodeEan128Fnc1Options

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Resolution` | `number` |  |  |
| `ModuleSize` | `number` |  |  |
| `BarAdjust` | `number` |  |  |

---

### BarcodeGs1CompositeOptions

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `CompositeType` | `string` |  |  |
| `Value` | `string` |  |  |

---

### BarcodeMaxiCodeOptions

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Mode` | `string` |  |  |

---

### BarcodeMicroPdf417Options

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `CompactionMode` | `string` |  |  |
| `Version` | `string` |  |  |
| `SegmentIndex` | `number` |  |  |
| `SegmentCount` | `number` |  |  |
| `FileID` | `number` |  |  |

---

### BarcodeMicroQrCodeOptions

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Version` | `string` |  |  |
| `ErrorLevel` | `string` |  |  |
| `Mask` | `string` |  |  |
| `Encoding` | `string` |  |  |

---

### BarcodePdf417Options

Represents options for a Pdf417 Barcode.

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Columns` | `number` |  |  |
| `Rows` | `number` |  |  |
| `ErrorCorrectionLevel` | `string` |  |  |
| `Pdf417Type` | `string` |  |  |

---

### BarcodeQrCodeOptions

Represents options for a QRCodeBarcode.

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Connection` | `boolean` |  |  |
| `ConnectionNumber` | `number` |  |  |
| `Version` | `number` |  |  |
| `ErrorLevel` | `string` |  |  |
| `Mask` | `string` |  |  |
| `Model` | `string` |  |  |
| `Encoding` | `string` |  |  |

---

### BarcodeRssExpandedStacked

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `RowCount` | `number` |  |  |

---

### BarcodeSupplementOptions

| Property | Type | Req | Description |
| --- | --- | --- | --- |
| `Value` | `string` |  |  |
| `BarHeight` | `string` |  |  |
| `CaptionLocation` | `string` |  |  |
| `Spacing` | `string` |  |  |

---
