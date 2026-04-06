# Troubleshooting

## RDLX-JSON & Expression Issues

| Mistake | Fix |
|---------|-----|
| `$item` in expressions | Use `$entity` |
| `Fields.Name.Value` in expressions | Use `Fields!Name.Value` (exclamation mark) |
| Unbalanced parentheses in `IIf()` | Count your parens -- each `IIf(` needs matching `)` |
| DataSet name differs from datasource reference | DataSet `Name`, datasource `-r`, `-t`, and the `--owned FILE:ALIAS` alias must ALL match |
| `CommandText: "jpath=$.*"` | Must be `$.{ds_name}.result.*` -- `jpath` syntax doesn't bind to datasource |
| Only listing used fields in DataSet | List ALL fields from `datasource-fields` output, not just fields in expressions |
| Missing date type annotation | Date DataFields need `[Date\|YYYY-MM-DDTHH:mm:ss.fffffff]` suffix |
| Missing sensitivity properties on DataSet | Include `CaseSensitivity`, `KanatypeSensitivity`, `AccentSensitivity`, `WidthSensitivity` |
| Embedding sample data in `ConnectString` | Use a companion `<report>.data.json` file -- Studio auto-discovers it |
| Data file as flat array `[{...}]` | Must use wrapper structure `{ "dataSets": { "ds_name": { "data": [...] } } }` |
| Skipping DataSets during Phase 3 prototyping | Studio shows "no matching DataSet in report" and expressions render as raw text |
| Using `=Fields!X.Value` on a textbox for a non-default dataset | Standalone textboxes resolve against the first DataSet by default. For fields from other datasets, use `=First(Fields!X.Value, "ds_other")` |
| Adding collection-path fields as flat DataSet fields (e.g., `OrderLookups.Order.OwnerReference`) | Collection navigation properties (`isCollection: true` in the type def) silently resolve to blank in single-result DataSets. Use a flow datasource to flatten, or create child datasets with `CommandText: "$.ds.result.Collection.*"` and `First()` expressions |
| `CommandText: "$.ds.result"` for a collection datasource | Must be `$.ds.result.*` -- without `.*`, table/tablix gets no rows |
| `$dataset:ParentDs/CollectionField` on an OData datasource | `$dataset:` child datasets only work with flow datasources. For OData, use `CommandText: "$.ds.result.CollectionPath.*"` with `DataSourceName: "Datasource"` instead |

## Upload & Deployment Issues

| Mistake | Fix |
|---------|-----|
| `--datasource-param 'ds_header:shipmentId=$report.inParams.shipmentId'` (colon separator) | Use **dot notation**: `'ds_header.shipmentId=$report.inParams.shipmentId'`. Colon causes the entire `ds_header:shipmentId` to be treated as a single param name, creating type mismatch errors ("Type 'number' is not assignable to type 'string'") |
| Repeating identical `--datasource-param` across `datasource add` calls when all datasources share the same param name and expression | This is correct — each `datasource add` scopes the param to its alias. Alternatively, use dot-notation on a single call to bind multiple aliases at once |

## Layout & CLI Issues

| Mistake | Fix |
|---------|-----|
| Lines in batch using `left`/`top`/`width`/`height` | Lines need `start-x`/`start-y`/`end-x`/`end-y` |
| `move`/`set` on lines without endpoint flags | Lines use `StartPoint`/`EndPoint` -- use `--start-x`, `--start-y`, `--end-x`, `--end-y` |
| Passing `--ops` with `!` or `$` directly in shell | Use `--ops-file /tmp/ops.json` or `--ops -` with a heredoc |
| Using `dxs report scaffold` | Generates incorrect line format and partial layouts -- use `dxs report create` + `dxs report batch` |
| Using textboxes to fake a table | Use `dxs report add table` for collections -- real tables repeat rows per data record |
| Adding section elements directly to body without a rectangle | Wrap each logical section in a rectangle for easy repositioning |
| Using `--header`/`--detail` on `add tablix` | Deprecated -- use `--header-cell`/`--detail-cell` (repeated options, one per cell) |
| Styling table cells one-by-one after creation | Use `--header-style`/`--detail-style` at creation time |
| Manually editing JSON to add a table column | Use `dxs report table add-column` |
| Manually editing JSON to add a dataset field | Use `dxs report dataset add-field <file> --dataset NAME --field FIELD` |
| Using `dxs report set` without `--width`/`--height` for resizing | `report set` supports `--width` and `--height` directly |
| `dxs report batch` with more than 25 operations | Split into multiple batch calls of 25 or fewer -- group logically (e.g., repositioning in one batch, styling in another) |
| Using `--value` with a URL for embedded images | Use `--file logo.png` to embed -- `--value` is for expressions or external URLs |
| Database-bound image field missing from sample data | Use `dxs report data add-image` to encode image files as data URIs in `.data.json` |
| Setting number format via `set`/`batch` | `format` is not yet a recognized key in `set`/`batch` -- edit `"Format": "N2"` in JSON `Style` directly |
