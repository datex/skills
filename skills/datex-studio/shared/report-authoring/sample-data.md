# Sample Data for Reports

When designing a report, create a companion `<report>.data.json` file alongside the report file. This provides sample data for previewing and validating the report layout.

## File Convention

Place the data file next to the report with the same base name:

```
my-report.rdlx-json       ← report definition
my-report.data.json        ← sample data (auto-discovered by Studio)
```

## Quick Start: Scaffold from DataSets

After adding DataSets to the report, generate a template data file automatically:

```bash
dxs report data generate my-report.rdlx-json -o my-report.data.json
```

This reads DataSet definitions and creates a `.data.json` with one row per dataset using placeholder values (0 for numbers, `""` for strings, ISO dates for DateTimeOffset fields). Replace the placeholders with realistic values — 3–5 rows per dataset for a good preview.

Use `--force` to overwrite an existing data file.

## Format

```json
{
    "dataSets": {
        "DataSetName": {
            "data": [
                { "Field1": "value", "Field2": 123, "Field3": true },
                { "Field1": "other", "Field2": 456, "Field3": false }
            ]
        }
    }
}
```

Each key under `dataSets` must match a DataSet `Name` in the report's RDLX-JSON. Mismatched names will trigger warnings in the design canvas.

## Optional Schema

You can include an explicit schema to declare field types rather than relying on inference from the first data row:

```json
{
    "dataSets": {
        "Orders": {
            "schema": {
                "type": "object",
                "properties": {
                    "Id": { "type": "number" },
                    "OrderDate": { "type": "string", "format": "date" },
                    "Total": { "type": "number" }
                }
            },
            "data": [
                { "Id": 1, "OrderDate": "2026-01-15", "Total": 250.00 }
            ]
        }
    }
}
```

## Field Name Matching

**Field names in the data file must match the DataSet field `Name` values** (underscore notation), NOT the dot-notation `DataField` paths.

Example: If the DataSet has:
```json
{ "Name": "Account_Name", "DataField": "Account.Name" }
```

The data file uses the `Name`:
```json
{ "Account_Name": "Acme Corp" }
```

## Guidelines

- Include 3–5 representative rows per dataset — enough to verify layout, not more
- Use realistic values that exercise formatting (decimals, long strings, dates, nulls/empty strings)
- If the report has multiple datasets (e.g., a master dataset and a linked detail dataset), include all of them
- Field names are case-sensitive and must match the report's DataSet field definitions exactly
- To preview the report with this data from the CLI: `dxs report preview <report>.rdlx-json --data <report>.data.json`

## Images in Sample Data

For database-bound images (e.g., product photos, dynamic logos), encode image files into the data file using `dxs report data add-image`:

```bash
# Add logo to first row of ds_header
dxs report data add-image <report>.data.json \
  --dataset ds_header --field LogoImage --file logo.png

# Add product photo to a specific row (0-indexed)
dxs report data add-image <report>.data.json \
  --dataset ds_products --field ProductImage --file widget.jpg --row 2
```

The image is stored as a data URI (`data:image/png;base64,...`) in the specified field. The preview renderer resolves these automatically when the report has a database-bound image with `=Fields!LogoImage.Value`.

**Note:** This is only needed for **database-bound** images (`Source: "Database"`). Embedded images (`Source: "Embedded"`, added via `dxs report add image --file`) are stored in the report itself and don't need sample data entries.

## Example: Pick Slip with Master + Detail

```json
{
    "dataSets": {
        "ds_pick_slip": {
            "data": [
                {
                    "LookupCode": "PS-00451",
                    "CreatedDateTime": "2026-03-15T08:30:00.0000000",
                    "Warehouse_Name": "Tampa",
                    "Project_Name": "Acme Corp",
                    "Status_Name": "In Progress",
                    "Order_LookupCode": "ORD-10234",
                    "Priority_Name": "High",
                    "ShipToAddress_AttentionOf": "John Smith",
                    "ShipToAddress_Line1": "1234 Industrial Pkwy",
                    "ShipToAddress_City": "Tampa",
                    "ShipToAddress_State": "FL",
                    "ShipToAddress_PostalCode": "33610"
                }
            ]
        },
        "ds_pick_slip_lines": {
            "data": [
                {
                    "Lines_LineNumber": 1,
                    "Lines_Material_LookupCode": "SKU-A100",
                    "Lines_Material_Description": "Widget Assembly Kit",
                    "Lines_Lot_LookupCode": "LOT-2026-031",
                    "Lines_Location_Name": "A-01-01",
                    "Lines_ExpectedPackagedAmount": 10,
                    "Lines_ActualPackagedAmount": 0,
                    "Lines_ExpectedPackagedPack_Name": "EA"
                },
                {
                    "Lines_LineNumber": 2,
                    "Lines_Material_LookupCode": "SKU-B200",
                    "Lines_Material_Description": "Bracket Set - Steel",
                    "Lines_Lot_LookupCode": "LOT-2026-028",
                    "Lines_Location_Name": "B-03-02",
                    "Lines_ExpectedPackagedAmount": 25,
                    "Lines_ActualPackagedAmount": 0,
                    "Lines_ExpectedPackagedPack_Name": "EA"
                },
                {
                    "Lines_LineNumber": 3,
                    "Lines_Material_LookupCode": "SKU-C350",
                    "Lines_Material_Description": "Packing Tape 3in Clear",
                    "Lines_Lot_LookupCode": "",
                    "Lines_Location_Name": "C-12-05",
                    "Lines_ExpectedPackagedAmount": 4,
                    "Lines_ActualPackagedAmount": 0,
                    "Lines_ExpectedPackagedPack_Name": "CS"
                }
            ]
        }
    }
}
```
