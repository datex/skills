# Datasource Commands Reference

Detailed reference for `dxs datasource` commands, parameter strategies, and post-upsert verification.

## Required Input Parameters (`--detect-params`)

When a report must pass parameters (e.g., warehouse, project, date range) to the datasource query, use **template literal syntax** in the `$filter` and add `--detect-params`:

```bash
dxs datasource upsert \
  -c <id> \
  -q 'Tasks?$select=Id,Name&$filter=WarehouseId eq ${$datasource.inParams.WarehouseId} and ProjectId eq ${$datasource.inParams.ProjectId} and CompletedDateTime ge ${$datasource.inParams.FromDate} and CompletedDateTime le ${$datasource.inParams.ToDate}' \
  -r ds_my_report \
  -t "ds_my_report" \
  -d "Description" \
  --api-setting-name FootPrintAPI \
  --branch <id> \
  --detect-params
```

Then on `report upload`, declare matching report params and pipe them down:

```bash
dxs report upload report.rdlx-json --branch <id> --name "My Report" \
  --owned-datasource ds_my_report:ds_my_report \
  --owned-connection <connection_id> \
  --owned-query '<odata_query>' \
  --owned-title "ds_my_report" \
  --param WarehouseId:number \
  --param ProjectId:number \
  --param FromDate:date \
  --param ToDate:date \
  --datasource-param 'WarehouseId=$report.inParams.WarehouseId' \
  --datasource-param 'ProjectId=$report.inParams.ProjectId' \
  --datasource-param 'FromDate=$report.inParams.FromDate' \
  --datasource-param 'ToDate=$report.inParams.ToDate'
```

**CRITICAL:** The placeholder syntax is `${$datasource.inParams.paramName}` — NOT `{paramName}`. Simple curly braces are **not detected** by `--detect-params`.

After upsert, always verify with `datasource-fields` that `in_params` is populated (not empty).

## Linked Datasources

Target datasource **must exist** in the branch before referencing. Format:

- `oneToOne` / `oneToMany`: `name:type:target` (3-part, NO mergeBy)
- `oneToOneWithMerge`: `name:type:target:$entity.Field` (4-part)

## Quoting Rules

**Single quotes required** for any value containing `$`:

- `-q '...$expand...'`
- `--linked '...$entity...'`
- `--custom-column '...$entity...'`
- `--datasource-param '...$report...'`

## Reference Naming

Must be valid JS identifiers. Convention: `ds_` prefix. No hyphens, no leading digits.
Examples: `ds_shipment_bol`, `ds_orders`, `ds_inventory_summary`.

## Inspect Fields After Upsert

```bash
dxs report datasource-fields <ds_reference> --branch <branch_id>
```

**Check these in the output:**
1. **`in_params` names** — must match exactly in `--datasource-param` (don't assume `id`)
2. **`result_type`** — `single` vs `list` affects report layout
3. **`suggested_alias`** — ignore this; always use the reference name as the alias
4. **`collections`** — nav-property collections available for table sections
5. **Field paths** — exact dot-notation paths for expressions

## Deleting a Datasource

Delete by reference name or by config ID:

```bash
dxs datasource delete ds_my_report --branch <branch_id>
dxs datasource delete --id 42 --branch <branch_id>
```

Use `--id` when reference-name lookup returns 404 (can happen on branches with component modules). Get the ID from `dxs datasource list`.

## Cascading Datasource Parameters

When a report has multiple datasources and one datasource's parameter depends on data from another, you need a cascading parameter strategy. This is common in document-style reports where a header entity (e.g., Invoice) links to detail entities (e.g., Tasks) through intermediate keys (e.g., ShipmentId).

**The problem:** `--datasource-param` only maps report-level params to datasource params. It cannot wire one datasource's output field as another datasource's input parameter.

**Pattern: Cross-dataset expressions instead of cascading params**

When possible, avoid cascading datasources entirely. Instead, expand enough data in one datasource and use cross-dataset `First()` expressions to pull values into the report:

```
=First(Fields!BillingRecords_BillingTask_Shipment_TrailerId.Value, "ds_lines")
```

This approach works well when the "cascading" data is available through OData `$expand` on an existing datasource. The ds_lines query expands through BillingRecords → BillingTask → Shipment, making shipment fields available without a separate datasource.

**When true cascading is unavoidable:** If a datasource needs a parameter that can only be obtained at runtime from another datasource (e.g., ds_receipt_details needs `ShipmentId` that comes from the first datasource's data), consider:

1. **Expand the scope of an existing datasource** to include the bridging field, then use cross-dataset expressions in the report
2. **Use report-level parameters** and have the calling context (e.g., Invoice Editor) pass all needed IDs
3. **Use the `--linked` flag** on `dxs datasource upsert` to formally declare inter-datasource dependencies (format: `name:type:target` — see Linked Datasources section above)

**Example architecture — Invoice with Receipt Details:**
```
Report param: invoiceId
├── ds_header:  Invoices(0)                     ← param-keys (invoiceId)
├── ds_lines:   InvoiceLines?$filter=InvoiceId eq ${..invoiceId}
│               └── $expand=BillingRecords(...Shipment...Warehouse...)
│                   (provides ShipmentId, WarehouseId via cross-dataset First())
├── ds_receipt: Tasks?$filter=ShipmentId eq ${..shipmentId}
│               (needs cascading ShipmentId — linked to ds_lines)
└── ds_owner:   OwnersContactsLookup?$filter=OwnerId eq ${..ownerId}
                (needs cascading OwnerId — linked to ds_header)
```

## Discover Test Data

After confirming the datasource is correctly configured, find real data the user can test with. Query the entity **without** template literal params, using the base filter + `$top=5` + `$orderby` to find recent records:

```bash
# Find recent records with the key filter fields visible
dxs odata execute -c <id> -q 'Entity?$top=5&$filter=<base_filters>&$select=Id,<param_fields>&$expand=<readable_names>&$orderby=<date_field> desc'
```

Pick values from the results that produce a reasonable volume of data. Verify with `$count=true&$top=1`:

```bash
dxs odata execute -c <id> -q 'Entity?$count=true&$top=1&$filter=<full_filter_with_real_values>&$select=Id'
```

Save the discovered values — output them as JSON in Phase 7.
