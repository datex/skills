# Common Mistakes

Quick reference for frequent pitfalls. Check this when debugging unexpected behavior.

## OData & Query Issues

| Mistake | Fix |
|---------|-----|
| Using manager connection name as `--api-setting-name` | Use app-level `name` from `branch settings` |
| `$expand` without `$select` | Always include `$select=Field1,Field2` |
| Double quotes for `$` values | Use single quotes — shell expands `$` in double quotes |
| Guessing entity names | Always `schema search` first |
| Not using `$top=1` during query testing | Large queries timeout — always limit during development |
| Testing with `Entity(0)` and panicking at 404 | 404 is expected — validate structure via `$top=1` first |
| Making 9+ sequential schema calls | Use `schema batch` — combine into 2-3 calls |

## Datasource Issues

| Mistake | Fix |
|---------|-----|
| `{Param}` instead of `${$datasource.inParams.Param}` in filter | `--detect-params` requires template literal syntax — simple `{curly braces}` are silently ignored |
| Using only `--dynamic-filter` for required params | Dynamic filters are optional UI filters — use `--detect-params` with template literals for required report params |
| Not verifying `in_params` after upsert | Always run `datasource-fields` and confirm `in_params` is populated, not empty |
| Assuming inParam name is `id` | Check `datasource-fields` output — might be `shipmentId`, `orderId`, etc. |
| Datasource `-t` title differs from `-r` reference name | Title and reference must be identical (e.g., `-r ds_foo -t "ds_foo"`) |
| Linked target doesn't exist | Create targets first, verify with `datasource-fields` |
| `mergeByValue` on `oneToOne` | Only `oneToOneWithMerge` gets 4th component |
| Hardcoded dates in filter | Use `${new Date(...).toISOString()}` for dynamic |
| Single quotes in OData filter string literals (e.g., `endswith(Name,'-10')`) | Use `%27` URL encoding: `endswith(Name,%27-10%27)` — literal `'` breaks the generated TypeScript service file. See [datasource-commands.md](datasource-commands.md) Quoting Rules. |

## RDLX-JSON & Expression Issues

| Mistake | Fix |
|---------|-----|
| `$item` in expressions | Use `$entity` |
| `Fields.Name.Value` in expressions | Use `Fields!Name.Value` (exclamation mark) |
| Unbalanced parentheses in `IIf()` | Count your parens — each `IIf(` needs matching `)` |
| DataSet name differs from datasource reference | DataSet `Name`, datasource `-r`, `-t`, and `--owned-datasource` alias must ALL match |
| `CommandText: "jpath=$.*"` | Must be `$.{ds_name}.result.*` — `jpath` syntax doesn't bind to datasource |
| Only listing used fields in DataSet | List ALL fields from `datasource-fields` output, not just fields in expressions |
| Missing date type annotation | Date DataFields need `[Date\|YYYY-MM-DDTHH:mm:ss.fffffff]` suffix |
| Missing sensitivity properties on DataSet | Include `CaseSensitivity`, `KanatypeSensitivity`, `AccentSensitivity`, `WidthSensitivity` |
| Embedding sample data in `ConnectString` | Use a companion `<report>.data.json` file — Studio auto-discovers it |
| Data file as flat array `[{...}]` | Must use wrapper structure `{ "dataSets": { "ds_name": { "data": [...] } } }` |
| Skipping DataSets during Phase 3 prototyping | Studio shows "no matching DataSet in report" and expressions render as raw text |
| Using `=Fields!X.Value` on a textbox for a non-default dataset | Standalone textboxes resolve against the first DataSet by default. For fields from other datasets, use `=First(Fields!X.Value, "ds_other")` |

## Layout & CLI Issues

| Mistake | Fix |
|---------|-----|
| Lines in batch using `left`/`top`/`width`/`height` | Lines need `start-x`/`start-y`/`end-x`/`end-y` |
| `move`/`set` on lines without endpoint flags | Lines use `StartPoint`/`EndPoint` — use `--start-x`, `--start-y`, `--end-x`, `--end-y` |
| Passing `--ops` with `!` or `$` directly in shell | Use `--ops-file /tmp/ops.json` or `--ops -` with a heredoc |
| Using `dxs report scaffold` | Generates incorrect line format and partial layouts — use `dxs report create` + `dxs report batch` |
| Using textboxes to fake a table | Use `dxs report add table` for collections — real tables repeat rows per data record |
| Adding section elements directly to body without a rectangle | Wrap each logical section in a rectangle for easy repositioning |
| Using `--header`/`--detail` on `add tablix` | Deprecated — use `--header-cell`/`--detail-cell` (repeated options, one per cell) |
| Styling table cells one-by-one after creation | Use `--header-style`/`--detail-style` at creation time |
| Manually editing JSON to add a table column | Use `dxs report table add-column` |
| Manually editing JSON to add a dataset field | Use `dxs report dataset add-field --dataset NAME --field FIELD` |
| Using `dxs report set` without `--width`/`--height` for resizing | `report set` supports `--width` and `--height` directly |
| Using `--value` with a URL for embedded images | Use `--file logo.png` to embed — `--value` is for expressions or external URLs |
| Database-bound image field missing from sample data | Use `dxs report data add-image` to encode image files as data URIs in `.data.json` |
| Setting number format via `set`/`batch` | `format` is not yet a recognized key in `set`/`batch` — edit `"Format": "N2"` in JSON `Style` directly |
