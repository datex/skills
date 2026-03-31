# DataSet Management Rules

## Adding DataSets

**REQUIRED for Studio preview.** Without DataSet definitions, Studio shows "no matching DataSet in report" errors and field expressions render as raw text.

```bash
dxs report dataset add <file> --name ds_shipment \
  --field Id --field LookupCode --field Status \
  --field "Account.Name" \
  --field "OrderDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]"
```

## Field Sourcing

Use the **field summary** from the datasource-creator's return as the primary source for field names -- it is extracted directly from the generated config's type definitions and is authoritative. Include **ALL fields**, not just the ones used in expressions. The field-mapping artifact provides additional human-readable context for layout decisions but should not be the primary source for DataSet field names.

## CommandText `.*` Suffix Rule

- **Single result, scalar fields:** `$.ds_name.result` (no `.*`)
- **Collection result (table/tablix):** `$.ds_name.result.*`
- **Collection within single result:** `$.ds_name.result.CollectionPath.*`

## Handling Collection Fields

Check the datasource-creator return for fields marked `[collection]`. These **cannot** be added as flat DataSet fields on a single-result DataSet -- they will silently render blank.

**Preferred approach: flow datasource.** If the datasource-creator return contains collections with fields needed in standalone textboxes, go back and rebuild that datasource as a flow. The flow code fetches the OData data and flattens collections into scalar fields. This is the production pattern used by all existing Datex Studio reports with complex navigation.

**Alternative: child datasets with CommandText deep paths.** If a flow rewrite is not feasible, create a separate DataSet that navigates into the collection:

```json
{
    "Name": "ds_shipment_OrderLookups",
    "Fields": [
        {"Name": "Order_OwnerReference", "DataField": "Order.OwnerReference"},
        {"Name": "Order_Account_Name", "DataField": "Order.Account.Name"}
    ],
    "Query": {
        "DataSourceName": "Datasource",
        "CommandText": "$.ds_shipment.result.OrderLookups.*"
    }
}
```

Then reference fields with `=First(Fields!Order_OwnerReference.Value, "ds_shipment_OrderLookups")` in standalone textboxes. For nested collections (collection within collection), chain the path: `$.ds_shipment.result.OrderLookups.*.Order.Addresses.*`.

## Cross-Dataset References

Use `=First(Fields!X.Value, "ds_other")` for fields from non-default datasets. Standalone textboxes resolve against the first DataSet by default.

## Date Type Annotation

Date DataFields need the `[Date|YYYY-MM-DDTHH:mm:ss.fffffff]` suffix:

```bash
--field "OrderDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]"
```

## Sensitivity Properties

Every DataSet must include these sensitivity properties: `CaseSensitivity`, `KanatypeSensitivity`, `AccentSensitivity`, `WidthSensitivity`.

## Adding Fields to Existing DataSets

```bash
dxs report dataset add-field <file> --dataset NAME --field FIELD
```
