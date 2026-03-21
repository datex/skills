---
name: report-creator
description: |
  End-to-end workflow for building Datex Studio reports and labels: OData schema discovery, datasource creation, RDLX-JSON report authoring, and deployment. Use when asked to build/create/design/modify reports or labels, create or manage datasources, explore OData schema for report purposes, write or troubleshoot RDLX-JSON, or interact with `dxs report`/`dxs datasource`/`dxs schema` commands.

  Keywords: report, label, datasource, schema, OData, RDLX-JSON, barcode, shipping label, BOL, bill of lading, commercial invoice, dxs, ActiveReportsJS, preview, bounding box
---

# Report Creator

End-to-end workflow for building datasources and reports using the `dxs` CLI. Reports render in ActiveReportsJS within Datex Studio.

**Key principle:** Plan before code. Build the field mapping table and layout prototype before writing final JSON.

**Prototyping and design:** This skill has its own visual prototyping workflow — `dxs report create` + `dxs report batch` + `dxs studio open` for live preview in a browser. Do NOT use external brainstorming visual companions, browser-based mockup tools, or other prototyping tools unless the user explicitly requests them. The Studio live preview IS the design tool.

**Authoring approach:**
- **Live prototyping** for new reports — create a blank `.rdlx-json`, build layout incrementally with `dxs report create` + `dxs report batch`, preview live in Studio
- **Incremental CLI** (`add`/`set`/`move`/`remove`/`batch`) for targeted edits to existing reports
- **Direct JSON** only for advanced structures not yet in the CLI (e.g., complex BandedList grouping, custom Tablix column/row hierarchies beyond simple header/detail)

**References:**
- [references/json-structure.md](references/json-structure.md) — Document template, element JSON formats
- [references/design-patterns.md](references/design-patterns.md) — Coordinate system, layout patterns, element sizing
- [references/schema-discovery.md](references/schema-discovery.md) — Batch syntax, individual commands, anti-patterns
- [references/sample-data.md](references/sample-data.md) — Companion `.data.json` files for live preview

## Workflow

1. **Setup** — Select branch + connection + artifact directory
2. **Schema Discovery + Field Mapping** — *(subagent)* Explore OData entities, build field mapping table
3. **Layout Prototype** — Create actual RDLX-JSON with `dxs report create` + `dxs report batch`, preview live in Studio with `dxs studio open`, iterate with user feedback

> **Planning boundary:** Phases 1–3 complete during planning (before `ExitPlanMode`). The prototype IS the report file — Phase 6 picks up where Phase 3 left off. Phases 4–7 execute after plan approval.

4. **Query Building** — Incremental OData query with `$top=1`
5. **Datasource Upsert** — Create datasource with params and linked refs
6. **Report Authoring** — Finalize RDLX-JSON (verify DataSets against datasource, refine layout from prototype), validate, upload
7. **Deploy & Verify** — Upload, preview, confirm

## Phase 1: Setup

### Select branch

```bash
dxs source branch list --all-repos --status feature -n 20
```

Present results using **AskUserQuestion** with options built from the output:
```
AskUserQuestion:
  question: "Which feature branch should we work with?"
  options:
    - label: "{id} - {repositoryName}"
      description: "{commitTitle} by {authorDisplayName}"
```

**Branch ID policy:** Never assume or reuse a branch ID from memory. Always ask.

### Select connection

```bash
dxs source branch settings <branch_id>
```

Present API connections using **AskUserQuestion** (skip if only one — just inform the user):
```
AskUserQuestion:
  question: "Which API connection should we use?"
  options:
    - label: "{name} ({apiConnectionName})"
      description: "ID: {apiConnectionId}"
```

Store both: the `apiConnectionId` (for `-c` flag) and the `name` (for `--api-setting-name`).

### Artifact collection (optional)

Ask the user if they want to save process artifacts to disk. Present the following:

> Would you like to save artifacts from the report-building process? This includes:
> - Schema exploration notes
> - OData query development
> - RDLX-JSON report file (created during prototyping)
> - Sample data file for live preview
> - Report preview image (.png)
>
> Suggested location: `./reports/<report-name>/`

If yes, create the artifact directory:

```bash
mkdir -p <artifact_dir>
```

**Artifact file convention:**

| Phase | Filename | Content |
|-------|----------|---------|
| 2 - Schema + Mapping | `01-schema-exploration.md` | Entity descriptions, field lists, relationships |
| 2 - Schema + Mapping | `02-field-mapping.md` | Field mapping table |
| 3 - Layout Prototype | `<report-name>.rdlx-json` | The report file (created here, refined in Phase 6) |
| 3 - Layout Prototype | `<report-name>.data.json` | Sample data for live Studio preview |
| 4 - Query Building | `04-query-building.md` | Incremental query steps and final verified query |
| 7 - Deploy & Verify | `<report-name>-preview.svg` | Preview image from `dxs report preview` |

If the user declines, proceed normally — artifacts are optional and the workflow is unchanged.

## Phases 2–3: Schema Discovery + Field Mapping (Subagent)

**Delegate to a subagent.** Schema exploration produces verbose output that bloats the main context window. Launch a single `Agent` (general-purpose) to handle both phases and return a concise field mapping table.

### Subagent prompt template

```
Explore OData schema and build a field mapping table for a report.

**Connection ID:** <connection_id>
**Report purpose:** <user's description of what the report shows>
**Key entities to explore:** <entity keywords from user, e.g., "shipments", "inventory tasks">

**Steps:**
1. Search for relevant entities using `dxs schema batch -c <id> --request 'search <keyword>'`
2. Describe the main entity and its relationships using batch commands
3. Scan related entity properties to find fields needed for the report
4. Build a field mapping table in this format:

| Report Field | OData Path | Source Entity | Notes |
|---|---|---|---|
| Invoice Number | LookupCode | InvoiceHeader | Root field |
| Customer Name | Account.Name | Account | $expand with $select |
| Line Number | Lines.LineNumber | InvoiceLine | Collection field |

**Rules:**
- Separate root fields from collection fields (collections need a separate DataSet)
- OData Path maps directly to $select and $expand clauses
- Report Field becomes the DataSet Field Name and DataField
- Use dot notation for expanded paths (e.g., Account.Name → $expand=Account($select=Name))
- Use `schema batch` to combine calls (2-3 batches typical, not 9+ sequential calls)

See references/schema-discovery.md for batch syntax and anti-patterns.

**Return:** The field mapping table, a summary of entities explored, and any notable relationships or composite keys found.
```

If artifacts are enabled, instruct the subagent to write `01-schema-exploration.md` and `02-field-mapping.md` to the artifact directory.

### After subagent returns

Review the field mapping table with the user. Confirm the fields cover the report's requirements before proceeding. The table drives everything downstream — OData query, DataSet fields, and `=Fields!` expressions.

See [references/schema-discovery.md](references/schema-discovery.md) for full batch syntax, individual commands, key rules, and anti-patterns.

## Phase 3: Layout Prototype (Live in Studio)

**Build an actual RDLX-JSON report and preview it live in Datex Studio.** The prototype IS the report file — Phase 6 picks up where this phase leaves off. The user sees every change in real time.

### Step 1: Create a blank report

```bash
dxs report create <artifact_dir>/<report-name>.rdlx-json --page letter --margins 0.5in
```

Use `--page` for standard sizes (`letter`, `legal`, `a4`, `4x6`, `4x8`) or custom (`WxH`). Add `--landscape` for landscape orientation. `Body.Height` is auto-calculated from page dimensions (`PageHeight - TopMargin - BottomMargin`).

### Step 2: Open in Studio

```bash
dxs studio open <artifact_dir>/<report-name>.rdlx-json
```

This opens the report in the Studio design canvas. The user sees the report at `http://127.0.0.1:5051/design`. Every file change is reflected live.

**Prerequisite:** The user must have `dxs studio` running in another terminal. If the `open` command fails with "No studio server running", inform the user:
> Studio needs to be running for live preview. Start it with `dxs studio` in another terminal, then we'll continue.

### Step 3: Build layout incrementally with `dxs report batch`

Use `dxs report batch` to add elements in groups. Each operation is written individually so Studio shows updates in real time.

**Batch supports:** `add` (textbox, line, barcode, rectangle), `set`, `move`, and `remove`. Maximum 25 operations per batch.

**Batch does NOT support:**
- `move` on lines — lines use `StartPoint`/`EndPoint`, edit JSON directly

Rectangle containers: use `--parent` to nest elements inside a rectangle (e.g., `dxs report add textbox ... --parent BoxName`). The `--parent` flag works on all `add` commands and in batch `add` ops (via `"parent": "BoxName"` key). See [references/json-structure.md](references/json-structure.md) for the container JSON structure.

#### Input methods (pick one)

**Preferred: `--ops-file`** — write JSON to a file, reference it. No shell escaping needed.

```bash
cat > /tmp/ops.json << 'OPEOF'
[
  {"action": "add", "type": "textbox", "name": "Title", "value": "PICK SLIP",
   "left": "0in", "top": "0in", "width": "3in", "height": "0.4in",
   "font-size": "20pt", "font-weight": "Bold"},
  {"action": "add", "type": "textbox", "name": "ValField", "value": "=Fields!LookupCode.Value",
   "left": "0in", "top": "0.4in", "width": "3in", "height": "0.3in", "font-size": "14pt"},
  {"action": "add", "type": "barcode", "name": "MyBarcode", "symbology": "Code128",
   "value": "=Fields!LookupCode.Value",
   "left": "5in", "top": "0in", "width": "2.5in", "height": "0.7in"}
]
OPEOF

dxs report batch <file> --ops-file /tmp/ops.json
```

**Alternative: `--ops -`** (stdin) — pipe or heredoc. Also avoids shell escaping.

```bash
dxs report batch <file> --ops - <<'BATCH'
[
  {"action": "add", "type": "textbox", "name": "Title", "value": "=Fields!Code.Value",
   "left": "0in", "top": "0in", "width": "4in", "height": "0.4in"}
]
BATCH
```

**Inline: `--ops '<JSON>'`** — fine for simple ops without `!` or `$`. Avoid for expressions.

#### The `set` action

Use `set` within a batch to update styles and properties on existing elements — no need to break out of the batch for `dxs report set`:

```json
{"action": "set", "name": "title", "value": "Final", "font-size": "18pt", "color": "Navy"}
```

`set` accepts the same kebab-case style keys as `add` (`font-size`, `font-weight`, `color`, `background-color`, `text-align`, etc.) and item keys (`value`, `width`, `height`, etc.).

#### Build in sections using rectangle containers

Build the report in logical sections (max 25 ops per batch), verifying in Studio after each. **Wrap each section in a rectangle container** — this groups related elements so they can be moved, resized, and bordered as a unit. Without rectangles, repositioning a section means moving every child element individually, which is tedious and error-prone (as we'd have to recalculate every coordinate).

**Pattern:** First `add rectangle` for the section, then `add` child elements with `--parent`:

```bash
# Create the header container
dxs report add rectangle <file> --name HeaderBox --left 0in --top 0in --width 10in --height 0.85in

# Add children inside it — coordinates are relative to the rectangle
dxs report batch <file> --ops-file /tmp/header-ops.json
# (where each op includes "parent": "HeaderBox")
```

In batch ops, nest elements via `"parent": "BoxName"`:
```json
{"action": "add", "type": "textbox", "name": "Title", "value": "REPORT TITLE",
 "parent": "HeaderBox", "left": "0in", "top": "0in", "width": "3in", "height": "0.4in",
 "font-size": "20pt", "font-weight": "Bold"}
```

Child coordinates are **relative to the rectangle's top-left corner** (0,0), not the page. This means moving the rectangle moves everything inside it automatically.

Recommended sections to wrap in rectangles:

1. **Header** (`HeaderBox`) — Title, document number, barcode, divider line
2. **Info fields** (`InfoBox`) — Label/value pairs in two-column layout
3. **Address block** (`ShipToBox`, `BillToBox`) — Ship-to or bill-to with concatenated address expression
4. **Table** — Use `dxs report add table` or `tablix` for collections (see below). Tables are already self-contained elements — no rectangle needed.
5. **Footer** (`FooterBox`) — Signature lines, page numbers, dates

#### Tables for collections

Use `dxs report add table` for line items — not fake textbox grids:

```bash
dxs report add table <file> --name LinesTable --left 0in --top 2.5in --width 7.5in \
  --dataset ds_lines --columns '0.5in,1.2in,2in,1in,1in,0.6in,0.6in,0.6in' \
  --header-cell Line --header-cell Item --header-cell Description \
  --header-cell Qty --header-cell Weight --header-cell Cube --header-cell Rate --header-cell Charge \
  --detail-cell '=Fields!Line.Value' --detail-cell '=Fields!Item.Value' \
  --detail-cell '=Fields!Description.Value' --detail-cell '=Fields!Qty.Value' \
  --detail-cell '=Fields!Weight.Value' --detail-cell '=Fields!Cube.Value' \
  --detail-cell '=Fields!Rate.Value' --detail-cell '=Fields!Charge.Value' \
  --header-style "background-color:#f0f0f0;padding:2pt" \
  --detail-style "padding:2pt" \
  --font-size 8pt --border-style Solid --border-width 0.5pt --border-color LightGray
```

`--header-cell` and `--detail-cell` are repeated options — one per cell. This handles expressions with commas (e.g., `=Format(x, "N2")`) correctly. Cell names follow the pattern `{TableName}_Hdr0`, `{TableName}_Det0`, etc.

`--header-style` and `--detail-style` set default styles for all cells in the row using semicolon-delimited CSS-like syntax. User styles override the built-in defaults (Bold for headers). Supported keys: `background-color`, `padding`, `padding-left`, `padding-right`, `padding-top`, `padding-bottom`, `font-size`, `font-weight`, `font-family`, `color`, `text-align`, `vertical-align`, `border-style`, `border-width`, `border-color`.

Update individual cells later with `dxs report table set-cell`.

**Prefer Tablix for new reports** — it's more flexible and the most-used data element in production:

```bash
dxs report add tablix <file> --name Grid --left 0in --top 2.5in --width 7.5in --height 4in \
  --dataset ds_lines --columns '1in,3in,1.5in,1.5in' \
  --header-cell Item --header-cell Description --header-cell Qty --header-cell Weight \
  --detail-cell '=Fields!Item.Value' --detail-cell '=Fields!Desc.Value' \
  --detail-cell '=Fields!Qty.Value' --detail-cell '=Fields!Weight.Value' \
  --header-style "background-color:#f0f0f0;padding:2pt;vertical-align:Middle" \
  --detail-style "padding:2pt;vertical-align:Middle"
```

#### Adding columns to existing tables

Use `dxs report table add-column` to insert a column without editing JSON directly:

```bash
dxs report table add-column <file> Grid \
  --width 0.6in \
  --position 0 \
  --header "Store #" \
  --detail '=Fields!StoreNumber.Value' \
  --shrink  # auto-shrink existing columns proportionally
```

After adding a column, remember to add the corresponding field to the dataset if it's new:

```bash
dxs report dataset add-field <file> --dataset ds_lines --field StoreNumber
```

See [references/json-structure.md](references/json-structure.md) for full Table, Tablix, and List element formats.

### Step 4: Create sample data file

Create a companion `<report-name>.data.json` alongside the report for live preview data. Studio auto-discovers this file.

See [references/sample-data.md](references/sample-data.md) for the format. Key rules:
- Field names in the data file must match DataSet field **Names** (underscore notation, e.g., `Lines_Material_LookupCode`), not the dot-notation DataField paths
- Include 3–5 representative rows per dataset with realistic values
- Include all datasets if the report has multiple (e.g., master + detail)

### Step 5: Add DataSets to the report

**REQUIRED for Studio preview.** Without DataSet definitions, Studio shows "no matching DataSet in report" errors and field expressions render as raw text. Add DataSets immediately after creating the sample data file — before asking the user for layout feedback.

Use `dxs report dataset add` to add each DataSet:

```bash
dxs report dataset add <file> --name ds_shipment \
  --field Id --field LookupCode --field Status \
  --field "Account.Name" \
  --field "OrderDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]"
```

This creates the DataSet with:
- **Name** = the dataset name used in `.data.json` and table `DataSetName`
- **CommandText** = `$.{name}.result.*` (auto-generated, or override with `--command-text`)
- **Fields** with proper Name/DataField mapping (dots → underscores, date annotations stripped from Name)
- **Sensitivity properties** (CaseSensitivity, KanatypeSensitivity, AccentSensitivity, WidthSensitivity = Auto)

Include ALL fields from `datasource-fields` output — not just the ones used in expressions.

Phase 6 will verify and finalize DataSets against the actual datasource fields — but the initial definitions must be present here for live preview to work.

### Step 6: Verify with preview

Generate a preview to verify expressions resolve correctly with sample data:

```bash
dxs report preview <file> -o /tmp/preview.svg
```

SVG is the default and most reliable format. PNG output requires the `cairosvg` Python package.

#### Bounding boxes for element inspection

Use `--bbox NAME[:COLOR]` to render colored bounding boxes around named elements. This helps identify the real dimensions and positions of report items from preview images:

```bash
# Single element with default green border
dxs report preview <file> --bbox Title

# Multiple elements with per-element colors
dxs report preview <file> --bbox Title:red --bbox LinesTable:blue --bbox ShipToBox:orange -o /tmp/inspect.svg
```

Color is optional per element — defaults to `#22c55e` (green). Accepts CSS color names or hex values. Useful for debugging layout issues, verifying element alignment, or confirming that elements are positioned where expected.

### Feedback iteration loop

After building each section, ask the user:

> How's it looking in Studio? Any changes before we continue?

If the user requests changes, use `dxs report batch` with `set`/`move`/`remove` ops. Use `dxs report table set-cell` to update individual table/tablix cells.

Repeat until the user approves the layout. Then proceed to Phase 4.

### Layout reference

- Coordinate system: `(0,0)` is top-left of content area (inside margins)
- Calculate content area: `content_width = PageWidth - LeftMargin - RightMargin`

See [references/design-patterns.md](references/design-patterns.md) for pattern examples (Shipping Label, GS1, BOL, Tabular Report) and element sizing tables.

## Phase 4: Query Building

Build incrementally — one expand at a time. **Always use `$top=1`** during testing.

```bash
# Step 1: Base entity with $select
dxs odata execute -c <id> -q 'Entity?$top=1&$select=Id,Field1,Field2'

# Step 2: Add one-to-one expands
dxs odata execute -c <id> -q 'Entity?$top=1&$select=Id,Field1&$expand=Account($select=Id,Name)'

# Step 3: Add collection expands
dxs odata execute -c <id> -q 'Entity?$top=1&$select=Id,Field1&$expand=Lines($select=Id,LineNumber;$expand=OrderLine($select=OrderId))'

# Step 4: Combine everything
```

### Parameterized queries (key segment)

For single-entity reports, use `Entity(0)` as placeholder. Validate with `Entity?$top=1` first — `Entity(0)` returns 404 (expected, no entity with ID 0).

### Critical rules

| Rule | Detail |
|------|--------|
| `$top=1` always | Use during testing to avoid timeouts |
| Single quotes | Always use `'...'` for `-q` (prevents `$` shell expansion) |
| `$select` in `$expand` | **Required** on every expand clause |
| Nested option separator | Semicolons (`;`) inside parentheses, not `&` |
| 400 on `$select` | Field name is wrong — check `schema properties`, don't drop `$select` |
| Composite keys | Check `keys:` — some entities have no `Id` field |

**Artifact:** Save incremental query steps and the final verified query to `04-query-building.md`.

## Phase 5: Datasource Upsert

```bash
dxs datasource upsert \
  -c <connection_id> \
  -q '<verified_odata_query>' \
  -r <reference_name> \
  -t "<reference_name>" \
  -d "<description>" \
  --api-setting-name <app_level_name> \
  --branch <branch_id>
```

### Naming convention (CRITICAL)

The datasource **reference name** (`-r`), **display title** (`-t`), the RDLX-JSON **DataSet name**, and the `--use-datasource` **alias** must ALL be identical. If they don't match, the report renders but shows no data.

```
-r ds_my_report -t "ds_my_report"          # upsert: -t = -r
DataSet.Name = "ds_my_report"              # RDLX-JSON
--use-datasource ds_my_report:ds_my_report  # upload: ref:alias both same
```

### Parameter strategy

| Need | Flag | Query syntax |
|------|------|-------------|
| Scope to one entity (detail/document) | `--param-keys` | `Entity(0)?$select=...` |
| Required filter params (report passes values) | `--detect-params` | Use `${$datasource.inParams.paramName}` in `$filter` |
| Optional UI list filtering | `--dynamic-filter PROP:TYPE` + `--dynamic-orderby PROP` | `Entity?$select=...` (no placeholders) |
| Map report param → datasource param | `--datasource-param 'paramName=$report.inParams.paramName'` | N/A (on `report upload`) |

### Required input parameters (`--detect-params`)

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
  --use-datasource ds_my_report:ds_my_report \
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

### Linked datasources

Target datasource **must exist** in the branch before referencing. Format:

- `oneToOne` / `oneToMany`: `name:type:target` (3-part, NO mergeBy)
- `oneToOneWithMerge`: `name:type:target:$entity.Field` (4-part)

### Quoting rules

**Single quotes required** for any value containing `$`:

- `-q '...$expand...'`
- `--linked '...$entity...'`
- `--custom-column '...$entity...'`
- `--datasource-param '...$report...'`

### Reference naming

Must be valid JS identifiers. Convention: `ds_` prefix. No hyphens, no leading digits.
Examples: `ds_shipment_bol`, `ds_orders`, `ds_inventory_summary`.

### Inspect fields after upsert

```bash
dxs report datasource-fields <ds_reference> --branch <branch_id>
```

**Check these in the output:**
1. **`in_params` names** — must match exactly in `--datasource-param` (don't assume `id`)
2. **`result_type`** — `single` vs `list` affects report layout
3. **`suggested_alias`** — ignore this; always use the reference name as the alias
4. **`collections`** — nav-property collections available for table sections
5. **Field paths** — exact dot-notation paths for expressions

### Deleting a datasource

Delete by reference name or by config ID:

```bash
dxs datasource delete ds_my_report --branch <branch_id>
dxs datasource delete --id 42 --branch <branch_id>
```

Use `--id` when reference-name lookup returns 404 (can happen on branches with component modules). Get the ID from `dxs datasource list`.

### Discover test data

After confirming the datasource is correctly configured, find real data the user can use to test the report. Query the entity **without** template literal params, using the base filter + `$top=5` + `$orderby` to find recent records:

```bash
# Find recent records with the key filter fields visible
dxs odata execute -c <id> -q 'Entity?$top=5&$filter=<base_filters>&$select=Id,<param_fields>&$expand=<readable_names>&$orderby=<date_field> desc'
```

Pick values from the results that produce a reasonable volume of data. Verify with `$count=true&$top=1`:

```bash
dxs odata execute -c <id> -q 'Entity?$count=true&$top=1&$filter=<full_filter_with_real_values>&$select=Id'
```

Save the discovered values — output them as JSON in Phase 7.

## Phase 6: Report Authoring

The `.rdlx-json` file already exists from Phase 3 prototyping with layout, elements, sample data, and DataSet definitions. This phase finalizes it for deployment: verify DataSets match the actual datasource fields (from `datasource-fields` output), refine expressions, and validate.

### Schema reference (when needed)

```bash
dxs report schema document    # full RDLX-JSON structure
dxs report schema items       # element types
dxs report schema item barcode  # specific element properties
dxs report schema expressions   # expression syntax
```

See [references/json-structure.md](references/json-structure.md) for full document template.

### DataSets structure (CRITICAL — must match datasource exactly)
   - DataProvider: `JSONEMBED`, ConnectString: `jsondata={}`
   - **DataSet Name** = datasource reference name (e.g., `ds_my_report`)
   - **CommandText** = `$.{ds_name}.result.*` (NOT `jpath=$.*`)
   - List **ALL fields** from `datasource-fields` output, not just fields used in expressions
   - Use underscore naming for dot-notation: Name `Account_Name`, DataField `Account.Name`
   - **Date fields** need type annotation: `"DataField": "MyDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]"`
   - Include sensitivity properties on the DataSet object:
     ```json
     "CaseSensitivity": "Auto",
     "KanatypeSensitivity": "Auto",
     "AccentSensitivity": "Auto",
     "WidthSensitivity": "Auto"
     ```

4. **Validate:**
   ```bash
   dxs report validate my-report.rdlx-json
   ```

### Do NOT use `scaffold`

The `scaffold` command generates incorrect line element format and only produces partial layouts. Write direct JSON instead.

### Incremental CLI (edits to existing reports)

Use `add`/`set`/`move`/`remove`/`batch` for targeted changes:

```bash
# Style and value changes
dxs report set file.rdlx-json ElementName --font-size 12pt --font-weight Bold

# Resize elements (--width and --height available on set)
dxs report set file.rdlx-json ElementName --width 3in --height 1in

# Reposition
dxs report move file.rdlx-json ElementName --left 1in --top 2in

# Remove
dxs report remove file.rdlx-json ElementName

# Batch operations
dxs report batch file.rdlx-json --ops-file /tmp/ops.json
```

#### Line elements in batch

Lines require `start-x`, `start-y`, `end-x`, `end-y` — NOT `left`/`top`/`width`/`height`:

```json
{"action": "add", "type": "line", "name": "Divider",
 "start-x": "0in", "start-y": "2in", "end-x": "7in", "end-y": "2in",
 "line-width": "1pt"}
```

Using position keys for lines will produce a warning. The SVG renderer requires endpoint coordinates.

#### Adding fields to existing datasets

```bash
dxs report dataset add-field <file> --dataset ds_shipment --field StoreNumber
dxs report dataset add-field <file> --dataset ds_shipment --field "Account.Name" --field "ShipDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]"
```

### Expression quick reference

```
=Fields!FieldName.Value                                    # Field reference
="Label: " & Fields!FieldName.Value                        # Concatenation
=IIf(Fields!X.Value <> "", Fields!X.Value, "N/A")          # Conditional
=Format(Fields!Date.Value, "MM/dd/yyyy")                   # Date format
=Format(Fields!Amount.Value, "N2")                         # Number with commas (1,234.50)
=Format(Fields!Price.Value, "C2")                          # Currency ($1,234.50)
=Format(Fields!Ratio.Value, "P1")                          # Percent (85.6%)
=Format(Fields!Seq.Value, "D5")                            # Zero-padded (00042)
=Sum(Fields!Amount.Value)                                  # Aggregate
=Now()                                                     # Current date/time
=Today()                                                   # Current date only
=Globals!ReportName                                        # Report name
=Globals!ExecutionTime                                     # Execution timestamp
=Globals!PageNumber & " of " & Globals!TotalPages          # Page numbers
```

**Common mistakes:** `Fields.Name.Value` (wrong — use `Fields!`), unbalanced parens in `IIf()`.

**Artifact:** The `.rdlx-json` file was created in Phase 3 at `<artifact_dir>/<report-name>.rdlx-json`. Edits happen in-place.

## Phase 7: Deploy & Verify

### Upload

```bash
dxs report upload my-report.rdlx-json --branch <id> --name "My Report" \
  --use-datasource ds_my_report:ds_my_report \
  --param id:number \
  --datasource-param 'paramName=$report.inParams.id'
```

- Upload is **idempotent by reference name** — re-uploading updates the existing config
- To create a separate copy, use a different `--name`

### Preview

```bash
dxs report preview my-report.rdlx-json
dxs report preview my-report.rdlx-json --data my-report.data.json -o preview.svg
```

SVG is the default and most reliable output format. PNG requires the `cairosvg` Python package.

**Preview capabilities:** The renderer supports `Format()` with numeric format strings (`N2`, `C2`, `P1`, `F2`, `D5`) and date formats, `Now()`, `Today()`, `IIf()`, string concatenation (`&`), `Globals!PageNumber`, `Globals!TotalPages`, `Globals!ReportName`, and `Globals!ExecutionTime`.

The companion `.data.json` file created in Phase 3 can be used for preview. Studio auto-discovers it for live preview; for CLI preview, pass it with `--data`.

Use `--bbox` to highlight specific elements for visual verification:

```bash
dxs report preview my-report.rdlx-json --bbox Title:red --bbox LinesTable:blue -o preview.svg
```

### Verify

```bash
dxs report get <rep_reference> --branch <branch_id>
```

### Provide test parameters

If the datasource has `in_params`, output the discovered test values as JSON so the user can test the report in Datex Studio. Include a brief description of what the values represent:

```
Test parameters for **Warehouse: Tampa, Project: TemplateOwner, March 2026** (203 records):

{
  "WarehouseId": 1,
  "ProjectId": 500571,
  "FromDate": "2026-03-01T00:00:00.000Z",
  "ToDate": "2026-03-12T00:00:00.000Z"
}
```

Always include: parameter names matching `in_params` exactly, human-readable context (names, date ranges, record count), and ISO 8601 format for dates.

**Artifact:** Save the preview image with `dxs report preview <report>.rdlx-json -o <artifact_dir>/<report-name>-preview.svg`.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using manager connection name as `--api-setting-name` | Use app-level `name` from `branch settings` |
| `$expand` without `$select` | Always include `$select=Field1,Field2` |
| Double quotes for `$` values | Use single quotes — shell expands `$` in double quotes |
| `$item` in expressions | Use `$entity` |
| `Fields.Name.Value` in expressions | Use `Fields!Name.Value` (exclamation mark) |
| Unbalanced parentheses in `IIf()` | Count your parens — each `IIf(` needs matching `)` |
| Linked target doesn't exist | Create targets first, verify with `datasource-fields` |
| Guessing entity names | Always `schema search` first |
| `mergeByValue` on `oneToOne` | Only `oneToOneWithMerge` gets 4th component |
| Hardcoded dates in filter | Use `${new Date(...).toISOString()}` for dynamic |
| `{Param}` instead of `${$datasource.inParams.Param}` in filter | `--detect-params` requires template literal syntax — simple `{curly braces}` are silently ignored |
| Using only `--dynamic-filter` for required params | Dynamic filters are optional UI filters — use `--detect-params` with template literals for required report params |
| Not verifying `in_params` after upsert | Always run `datasource-fields` and confirm `in_params` is populated, not empty |
| Assuming inParam name is `id` | Check `datasource-fields` output — might be `shipmentId`, `orderId`, etc. |
| Testing with `Entity(0)` and panicking at 404 | 404 is expected — validate structure via `$top=1` first |
| Not using `$top=1` during query testing | Large queries timeout — always limit during development |
| Making 9+ sequential schema calls | Use `schema batch` — combine into 2-3 calls |
| Using `dxs report scaffold` | Generates incorrect line format and partial layouts — use `dxs report create` + `dxs report batch` |
| Using textboxes to fake a table | Use `dxs report add table` for collections — real tables repeat rows per data record |
| Embedding sample data in `ConnectString` | Use a companion `<report>.data.json` file — Studio auto-discovers it |
| Data file as flat array `[{...}]` | Must use wrapper structure `{ "dataSets": { "ds_name": { "data": [...] } } }` — flat arrays cause "Cannot convert undefined or null to object" |
| Skipping DataSets during Phase 3 prototyping | Studio shows "no matching DataSet in report" and expressions render as raw text — add DataSet definitions in Phase 3 Step 5, not Phase 6 |
| Lines in batch using `left`/`top`/`width`/`height` | Lines need `start-x`/`start-y`/`end-x`/`end-y` — position keys produce a warning and the SVG renderer won't draw them correctly |
| `move`/`set` on lines without endpoint flags | Lines use `StartPoint`/`EndPoint`, not `Left`/`Top` — use `--start-x`, `--start-y`, `--end-x`, `--end-y` flags on `move` and `set` |
| Passing `--ops` with `!` or `$` directly in shell | Use `--ops-file /tmp/ops.json` or `--ops -` with a heredoc to avoid shell escaping |
| Datasource `-t` title differs from `-r` reference name | Title and reference must be identical (e.g., `-r ds_foo -t "ds_foo"`) |
| DataSet name differs from datasource reference | DataSet `Name`, datasource `-r`, `-t`, and `--use-datasource` alias must ALL match |
| `CommandText: "jpath=$.*"` | Must be `$.{ds_name}.result.*` — `jpath` syntax doesn't bind to datasource |
| Only listing used fields in DataSet | List ALL fields from `datasource-fields` output, not just fields in expressions |
| Missing date type annotation | Date DataFields need `[Date\|YYYY-MM-DDTHH:mm:ss.fffffff]` suffix |
| Missing sensitivity properties on DataSet | Include `CaseSensitivity`, `KanatypeSensitivity`, `AccentSensitivity`, `WidthSensitivity` |
| Adding section elements directly to the body without a rectangle container | Wrap each logical section (header, footer, info fields, address blocks) in a rectangle — without it, repositioning a section requires moving every child element individually |
| Using `--header`/`--detail` on `add tablix` | Deprecated — use `--header-cell`/`--detail-cell` instead (repeated options, one per cell) |
| Styling table cells one-by-one after creation | Use `--header-style`/`--detail-style` on `add tablix`/`add table` to set styles at creation time |
| Manually editing JSON to add a table column | Use `dxs report table add-column` — handles column def, header cell, detail cell, and hierarchy in one command |
| Manually editing JSON to add a dataset field | Use `dxs report dataset add-field --dataset NAME --field FIELD` |
| Using `dxs report set` without `--width`/`--height` for resizing | `report set` supports `--width` and `--height` directly |
