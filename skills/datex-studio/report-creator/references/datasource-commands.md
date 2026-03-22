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
