# SSRS to NextGen Migration Guide

Reference for converting legacy SSRS (.rdl) reports to NextGen RDLX-JSON reports. The key insight: don't translate SQL to OData line-by-line. Understand what the original report accomplishes, then express that intent using OData's native capabilities.

## Mindset Shift

SSRS reports are built on SQL — stored procedures, views, joins, subqueries, and aggregations happen in the database. NextGen reports use OData REST APIs where the data model is different: navigation properties replace joins, `$expand` replaces `SELECT ... FROM ... JOIN`, and lambda operators replace subqueries.

**Don't:** Map each SQL `JOIN` to an OData call, translate `WHERE` clauses character-by-character, or replicate the exact query structure.

**Do:** Identify what data the report needs, find the OData entities that provide it, and use OData's strengths (navigation properties, server-side filtering, nested expands) to get there efficiently.

## Reading .rdl Files

SSRS `.rdl` files are XML. The key elements to extract:

| XML element | What to look for |
|-------------|-----------------|
| `<DataSets>` → `<DataSet>` | Each dataset's name and query |
| `<CommandText>` | The SQL query — `SELECT` columns map to report fields, `FROM`/`JOIN` tables map to OData entities |
| `<ReportParameters>` | Parameter names, types, and default values |
| `<DataSources>` | Connection info (usually not directly useful — you'll use OData connections instead) |
| `<Tablix>` / `<Table>` | Layout structure — column widths, grouping, headers/footers |
| `<Textbox>` | Field expressions and static labels |

### Extracting field requirements from SQL

Scan `<CommandText>` for:
1. **`SELECT` columns** — these become report fields. Map column names to OData entity properties via schema search.
2. **`FROM` / `JOIN` tables** — these identify the OData entities to explore. Table names often differ from OData entity set names (e.g., SQL `inv_inventoryTask` → OData `Tasks`).
3. **`WHERE` clauses** — these become `$filter` expressions. See mapping table below.
4. **`GROUP BY` / aggregates** — OData typically doesn't support server-side aggregation. Handle these in report expressions (`=Sum()`, `=Count()`, etc.) or use OData `$apply` if supported.
5. **Subqueries** — often replaceable with lambda operators. See [odata-patterns.md](odata-patterns.md).

## SQL → OData Structural Mapping

| SQL concept | OData equivalent | Notes |
|-------------|-----------------|-------|
| `SELECT col1, col2` | `$select=col1,col2` | Direct mapping |
| `JOIN ChildTable ON ...` | `$expand=ChildNav($select=...)` | Navigation property replaces join |
| `LEFT JOIN` | `$expand=NavProp($select=...)` | Expands return null if no related entity — same as LEFT JOIN |
| `WHERE col = value` | `$filter=col eq value` | See [odata-patterns.md](odata-patterns.md) for full mapping |
| `WHERE col LIKE 'prefix%'` | `$filter=startswith(col,'prefix')` | String functions replace LIKE |
| `NOT IN (SELECT ...)` | `not Collection/any(c: c/cond)` | Lambda operators replace subqueries |
| `GROUP BY` + `SUM()` | Report expression `=Sum(Fields!X.Value)` | Aggregation happens in the report, not the query |
| `ORDER BY` | `$orderby=col asc` | Direct mapping |
| `DISTINCT` | Usually unnecessary | OData entities are already distinct by key |
| Self-join | Separate datasource or `$expand` | Depends on the entity model |
| SQL View | Find equivalent OData entities | Views often combine multiple entities — decompose back to source entities |
| Stored procedure | OData query with `$filter`+`$expand` | Procedures have no OData equivalent — reconstruct the logic |

## Parameter Translation

### Report parameters

SSRS `<ReportParameters>` map to NextGen report params declared on `dxs report upload`:

```bash
--param WarehouseId:number \
--param ProjectId:number \
--param FromDate:date \
--param ToDate:date
```

### Parameter-populating datasources

**Usually unnecessary in NextGen.** Legacy SSRS reports often have separate SQL datasets for populating dropdown parameter lists (e.g., `SELECT DISTINCT warehouseId, warehouseName FROM warehouses`). In NextGen, the platform handles parameter UI — you typically only need datasources for the report's actual data, not for populating parameter dropdowns.

### Hard-coded IDs

SSRS design notes often reference SQL `WHERE` clauses with hard-coded IDs (e.g., `operationCodeId = 2`, `statusId = 2`). These IDs vary by customer environment. **Always verify by querying the lookup entity:**

```bash
# Verify OperationCode IDs match expected names
dxs odata execute -c <id> -q 'OperationCodes?$select=Id,Name&$orderby=Id&$top=50'

# Verify Status IDs
dxs odata execute -c <id> -q 'Statuses?$select=Id,Name&$orderby=Id&$top=20'
```

Consider filtering by name instead of ID for portability (e.g., `OperationCode/Name eq 'Receiving'`), though ID-based filters perform better.

## Layout Translation

**Adopt the Datex design language** when migrating — don't replicate SSRS styling. The original SSRS report may use different fonts, colors, row heights, and table borders. Apply the standards from [design-standards.md](design-standards.md): Arial font family, Datex color palette (Black, DimGray, LightGray, Gray, Purple #5B08B2), purple header borders instead of gray backgrounds, 0.375in row heights, and the field label-value pattern. The migrated report should look like a native Datex report, not a pixel-perfect copy of the SSRS original.

| SSRS concept | NextGen equivalent | Notes |
|-------------|-------------------|-------|
| Tablix | Tablix | Almost 1:1 — column widths, grouping, headers/footers all translate |
| Table | Tablix | Use Tablix for all new reports (Table is legacy) |
| Matrix (cross-tab) | Tablix with ColumnGroup | Tablix supports cross-tab via ColumnHierarchy groups |
| List | List | Direct mapping — repeating container |
| Subreport | Cross-dataset `First()` expressions | Use `=First(Fields!X.Value, "ds_other")` instead of subreports |
| Rectangle | Rectangle | Direct mapping — container element |
| Image (embedded) | Image with `--file` | `dxs report add image --file logo.png` |
| Chart | Not directly available | Use alternative visualization or external charting |
| Page header/footer | PageHeader/PageFooter | Same concept, different JSON structure — see [json-structure.md](json-structure.md) |

### Expression differences

| SSRS expression | NextGen equivalent |
|----------------|-------------------|
| `=Fields!Name.Value` | `=Fields!Name.Value` (same) |
| `=First(Fields!X.Value, "DataSet2")` | `=First(Fields!X.Value, "ds_other")` (same pattern) |
| `=IIf(condition, true, false)` | `=IIf(condition, true, false)` (same) |
| `=Format(value, "format")` | `=Format(value, "format")` (same) |
| `=Sum(Fields!X.Value)` | `=Sum(Fields!X.Value)` (same) |
| `=Code.CustomFunction()` | Not supported — use inline expressions or restructure |
| `=Globals!PageNumber` | `=Globals!PageNumber` (same) |

Most SSRS expressions work unchanged in NextGen. The main gap is custom VB.NET code blocks (`=Code.Function()`) — these need to be rewritten as inline expressions.

## Common Pitfalls

| Pitfall | How to avoid |
|---------|-------------|
| Translating SQL self-joins directly | Decompose: what data does each side of the join represent? Often two separate OData queries or a single query with `$expand` |
| Replicating SQL views as-is | Views often combine data from multiple entities. Trace back to the source entities and query them directly |
| Stored procedure datasources | No OData equivalent. Reconstruct the procedure's logic using `$filter`, `$expand`, and report expressions |
| Assuming entity/field names match SQL table/column names | SQL uses `inv_inventoryTask`, OData uses `Tasks`. Always `schema search` to find the correct entity name |
| Keeping separate "parameter list" datasources | NextGen platform handles parameter dropdowns. Only create datasources for actual report data |
| Hard-coding IDs from one environment | IDs vary by customer. Verify with lookup entity queries or use name-based filtering |
| Expecting `GROUP BY` in OData | Use report-level aggregation expressions (`=Sum()`, `=Count()`) instead |
| Custom VB.NET code blocks | Rewrite as inline expressions. `IIf()`, `Format()`, `Switch()` cover most use cases |
