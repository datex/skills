---
name: report-creator
description: |
  End-to-end workflow for building Datex Studio reports and labels: OData schema discovery, datasource creation, RDLX-JSON report authoring, and deployment. Use when asked to build/create/design/modify reports or labels, create or manage datasources, explore OData schema for report purposes, write or troubleshoot RDLX-JSON, or interact with `dxs report`/`dxs datasource`/`dxs schema` commands. Also use when building reports from Azure DevOps work items, migrating SSRS reports to NextGen, or extracting report requirements from DevOps tickets.

  Keywords: report, label, datasource, schema, OData, RDLX-JSON, barcode, shipping label, BOL, bill of lading, commercial invoice, dxs, ActiveReportsJS, preview, bounding box, devops, work item, requirement, SSRS, migration, ticket
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
- [references/json-structure.md](references/json-structure.md) — Document template, element JSON formats, expression quick reference
- [references/design-patterns.md](references/design-patterns.md) — Coordinate system, layout patterns, element sizing
- [references/schema-discovery.md](references/schema-discovery.md) — Batch syntax, individual commands, anti-patterns
- [references/sample-data.md](references/sample-data.md) — Companion `.data.json` files for live preview
- [references/datasource-commands.md](references/datasource-commands.md) — Parameter strategies, linked datasources, quoting, post-upsert verification
- [references/common-mistakes.md](references/common-mistakes.md) — Frequent pitfalls and fixes
- [references/devops-requirements.md](references/devops-requirements.md) — Extracting report requirements from Azure DevOps work items

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

**Step 1: Identify the active organization.**

```bash
dxs auth status
```

Note the `organization` and `organization_id` from the active identity.

**Step 2: List repositories for that organization.**

```bash
dxs source repo list --org <organization_id>
```

This returns only the org's repos (typically 3–10), not the full platform (hundreds).

**Step 3: List feature branches for each repo.**

```bash
dxs source branch list --repo <repo_id> --status feature -n 10
```

Repeat for each repo, or focus on the most relevant one (e.g., a "Reports" repo for report work).

**Step 4: Present results** using **AskUserQuestion** with options built from the output:
```
AskUserQuestion:
  question: "Which feature branch should we work with?"
  options:
    - label: "{id} - {repositoryName}"
      description: "{commitTitle} by {authorDisplayName}"
```

Include a "New branch" option if none of the existing branches are relevant. To create one:

```bash
dxs source branch create --repo <repo_id> --title "<title>" --description "<description>"
```

**Branch ID policy:** Never assume or reuse a branch ID from memory. Always ask.

> **Anti-pattern:** Do NOT use `dxs source branch list --all-repos` — it queries every repo across all organizations and returns thousands of results. Always scope to the active org's repos first.

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

**Finding a customer's connection:** If you need to find the API connection for a specific customer environment (e.g., to query their real data), use:

```bash
dxs organization connection list --search <term>
```

This searches connection names and URLs (case-insensitive). Customer URLs typically contain abbreviated names (e.g., `--search vcs` finds `https://vcsapi.footprintwms.com/`).

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
| 1 - Requirements | `requirements/` | Downloaded attachments and requirements brief (when sourced from DevOps) |

If the user declines, proceed normally — artifacts are optional and the workflow is unchanged.

### Requirements from DevOps work item (optional)

If the user references a DevOps work item (by ID, URL, or mention of "work item"/"requirement"/"ticket"), extract requirements before schema discovery. This step produces context that feeds into Phase 2's subagent prompt and Phase 3's layout design.

**Quick workflow:**
1. Fetch with `dxs devops workitem <ID> --full --expand All`
2. Review relations — present parent/children/attachments, ask which to explore
3. **Validate scope with user** — confirm which attachments and design notes are relevant before using them
4. Download user-confirmed attachments (`.rdlx-json`, `.rdl`, `.pdf`) to `<artifact_dir>/requirements/`
5. Compile a requirements brief: report purpose, field/data requirements, layout expectations, entity keywords

See [references/devops-requirements.md](references/devops-requirements.md) for the full extraction workflow, attachment decision table, and requirements brief template.

## Phase 2: Schema Discovery + Field Mapping (Subagent)

**Delegate to a subagent.** Schema exploration produces verbose output that bloats the main context window. Launch a single `Agent` (general-purpose) to handle both phases and return a concise field mapping table.

### Subagent prompt template

```
Explore OData schema and build a field mapping table for a report.

**Connection ID:** <connection_id>
**Report purpose:** <user's description of what the report shows>
**Requirements brief (from DevOps):** <paste requirements brief if available, otherwise omit>
**Key entities to explore:** <entity keywords from user or requirements brief, e.g., "shipments", "inventory tasks">

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

## Phase 3: Layout Prototype (Live in Studio)

**Build an actual RDLX-JSON report and preview it live in Datex Studio.** The prototype IS the report file — Phase 6 picks up where this phase leaves off. The user sees every change in real time.

### Step 1: Create a blank report

```bash
dxs report create <artifact_dir>/<report-name>.rdlx-json --page letter --margins 0.5in
```

Use `--page` for standard sizes (`letter`, `legal`, `a4`, `4x6`, `4x8`) or custom (`WxH`). Add `--landscape` for landscape orientation. `--margins` supports CSS-style shorthand: `0.5in` (all sides), `0.5in 0.25in` (top/bottom, left/right), or `0.5in 0.25in 0.75in 0.25in` (top, right, bottom, left).

### Step 2: Open in Studio

```bash
dxs studio open <artifact_dir>/<report-name>.rdlx-json
```

This opens the report in the Studio design canvas at `http://127.0.0.1:5051/design`. Every file change is reflected live.

**Prerequisite:** The user must have `dxs studio` running in another terminal. If the `open` command fails with "No studio server running", inform the user:
> Studio needs to be running for live preview. Start it with `dxs studio` in another terminal, then we'll continue.

### Step 3: Build layout incrementally with `dxs report batch`

Use `dxs report batch` to add elements in groups. Each operation is written individually so Studio shows updates in real time.

**Batch supports:** `add` (textbox, line, barcode, rectangle, image), `set`, `move`, and `remove`. Maximum 25 operations per batch.

**Batch does NOT support:** `move` on lines — lines use `StartPoint`/`EndPoint`, edit JSON directly.

**Input method — use `--ops-file`** to avoid shell escaping issues:

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

Alternative: `--ops -` (stdin heredoc) also avoids escaping. `--ops '<JSON>'` inline is fine for simple ops without `!` or `$`.

#### The `set` action

Use `set` within a batch to update styles and properties on existing elements:

```json
{"action": "set", "name": "title", "value": "Final", "font-size": "18pt", "color": "Navy"}
```

`set` accepts the same kebab-case style keys as `add` (`font-size`, `font-weight`, `color`, `background-color`, `text-align`, etc.) and item keys (`value`, `width`, `height`, etc.).

#### Build in sections using rectangle containers

Build the report in logical sections (max 25 ops per batch), verifying in Studio after each. **Wrap each section in a rectangle container** — this groups related elements so they can be moved, resized, and bordered as a unit.

**Pattern:** First `add rectangle` for the section, then `add` child elements with `"parent"`:

```json
[
  {"action": "add", "type": "rectangle", "name": "HeaderBox",
   "left": "0in", "top": "0in", "width": "10in", "height": "0.85in"},
  {"action": "add", "type": "textbox", "name": "Title", "value": "REPORT TITLE",
   "parent": "HeaderBox", "left": "0in", "top": "0in", "width": "3in", "height": "0.4in",
   "font-size": "20pt", "font-weight": "Bold"}
]
```

Child coordinates are **relative to the rectangle's top-left corner** (0,0). Moving the rectangle moves everything inside it automatically.

Recommended sections: Header, Info fields, Address blocks (ShipTo/BillTo), Table (self-contained — no rectangle needed), Footer.

#### Tables for collections

**Prefer Tablix for new reports.** Use `dxs report add tablix` for line items:

```bash
dxs report add tablix <file> --name Grid --left 0in --top 2.5in --width 7.5in --height 4in \
  --dataset ds_lines --columns '1in,3in,1.5in,1.5in' \
  --header-cell Item --header-cell Description --header-cell Qty --header-cell Weight \
  --detail-cell '=Fields!Item.Value' --detail-cell '=Fields!Desc.Value' \
  --detail-cell '=Fields!Qty.Value' --detail-cell '=Fields!Weight.Value' \
  --header-style "background-color:#f0f0f0;padding:2pt;vertical-align:Middle" \
  --detail-style "padding:2pt;vertical-align:Middle"
```

`--header-cell` and `--detail-cell` are repeated options — one per cell. `--header-style`/`--detail-style` set row-level defaults. Update individual cells with `dxs report table set-cell`. Add columns with `dxs report table add-column --shrink`.

**Footer rows** for totals are supported with `--footer-cell` and `--footer-style`:

```bash
dxs report add tablix <file> --name Orders --dataset ds_orders --columns '2in,1.5in,1.5in' \
  --header-cell Product --header-cell Qty --header-cell Total \
  --detail-cell '=Fields!Product.Value' --detail-cell '=Fields!Qty.Value' --detail-cell '=Fields!Total.Value' \
  --footer-cell 'Grand Total' --footer-cell '' --footer-cell '=Sum(Fields!Total.Value)' \
  --footer-style 'background-color:#f1f5f9;font-weight:Bold'
```

This generates the correct RowHierarchy: header (`KeepWithGroup: "After"`), detail (Group), footer (`KeepWithGroup: "Before"`). **Prefer footer rows over standalone textboxes for totals** — they stay anchored to the table and move correctly as the table grows with data.

See [references/json-structure.md](references/json-structure.md) for full Table, Tablix, and List element formats.

#### Lines in batch

Lines require `start-x`, `start-y`, `end-x`, `end-y` — NOT `left`/`top`/`width`/`height`:

```json
{"action": "add", "type": "line", "name": "Divider",
 "start-x": "0in", "start-y": "2in", "end-x": "7in", "end-y": "2in",
 "line-width": "1pt"}
```

#### Images

**Embedded images** (logos, static graphics) — embed the file directly in the report:

```bash
dxs report add image <file> --name CompanyLogo --file logo.png \
  --left 0in --top 0in --width 2in --height 0.5in
```

The CLI reads the file, base64-encodes it, and stores it in the report's `EmbeddedImages` array. `--file` auto-detects MIME type from extension (`.png`, `.jpg`, `.gif`, `.svg`, `.webp`). Max 5 MB.

**Database-bound images** (product photos, dynamic content from a dataset):

```bash
dxs report add image <file> --name ProductPhoto --source Database \
  --value '=Fields!ProductImage.Value' --mime-type image/png \
  --left 0in --top 0in --width 2in --height 2in
```

**Sizing options:** `FitProportional` (default, preserves aspect ratio), `Fit` (stretch to fill), `AutoSize` (original size), `Clip` (crop to bounds). Set with `--sizing`.

Both embedded and database-bound images render in `dxs report preview`. Database-bound images require the field value to be a data URI in the sample data file — use `dxs report data add-image` to encode image files into `.data.json` (see [references/sample-data.md](references/sample-data.md)).

### Step 4: Create sample data file

Create a companion `<report-name>.data.json` alongside the report for live preview data. Studio auto-discovers this file.

See [references/sample-data.md](references/sample-data.md) for the format. Key rules:
- Field names must match DataSet field **Names** (underscore notation, e.g., `Lines_Material_LookupCode`), not dot-notation DataField paths
- Include 3–5 representative rows per dataset with realistic values

### Step 5: Add DataSets to the report

**REQUIRED for Studio preview.** Without DataSet definitions, Studio shows "no matching DataSet in report" errors and field expressions render as raw text. Add DataSets immediately after creating the sample data file.

```bash
dxs report dataset add <file> --name ds_shipment \
  --field Id --field LookupCode --field Status \
  --field "Account.Name" \
  --field "OrderDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]"
```

This creates the DataSet with proper Name/DataField mapping (dots → underscores, date annotations stripped from Name), `CommandText = $.{name}.result.*`, and sensitivity properties.

Include ALL fields from `datasource-fields` output — not just the ones used in expressions. Phase 6 will verify against the actual datasource.

### Step 6: Verify with preview

```bash
dxs report preview <file> -o /tmp/preview.svg
```

Use `--bbox NAME[:COLOR]` to render colored bounding boxes around elements for visual debugging:

```bash
dxs report preview <file> --bbox Title:red --bbox LinesTable:blue -o /tmp/inspect.svg
```

### Feedback iteration loop

After building each section, ask the user:

> How's it looking in Studio? Any changes before we continue?

Use `dxs report batch` with `set`/`move`/`remove` ops for changes. Use `dxs report table set-cell` for individual table cells. Repeat until the user approves the layout.

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

- **`$top=1` always** during testing to avoid timeouts
- **Single quotes** for `-q` (prevents `$` shell expansion)
- **`$select` in `$expand`** is required on every expand clause
- **Semicolons** (`;`) inside parentheses for nested options, not `&`
- **400 on `$select`** means wrong field name — check `schema properties`, don't drop `$select`
- **Composite keys** — check `keys:` section; some entities have no `Id` field

**Artifact:** Save incremental query steps and final verified query to `04-query-building.md`.

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

The datasource **reference name** (`-r`), **display title** (`-t`), the RDLX-JSON **DataSet name**, and the `--owned-datasource` **alias** must ALL be identical:

```
-r ds_my_report -t "ds_my_report"              # upsert: -t = -r
DataSet.Name = "ds_my_report"                  # RDLX-JSON
--owned-datasource ds_my_report:ds_my_report   # upload: ref:alias both same
```

> **Note:** Use `--owned-datasource` (not `--use-datasource`) due to a CLI routing bug with `--use-datasource` on branches. Pair with `--owned-connection`, `--owned-query`, `--owned-title` — all four must have matching counts.

### Parameter strategy

| Need | Flag | Query syntax |
|------|------|-------------|
| Scope to one entity (detail/document) | `--param-keys` | `Entity(0)?$select=...` |
| Required filter params (report passes values) | `--detect-params` | Use `${$datasource.inParams.paramName}` in `$filter` |
| Optional UI list filtering | `--dynamic-filter PROP:TYPE` + `--dynamic-orderby PROP` | `Entity?$select=...` (no placeholders) |
| Map report param → datasource param | `--datasource-param 'paramName=$report.inParams.paramName'` | N/A (on `report upload`) |

After upsert, always verify with `datasource-fields` that fields and `in_params` are correct.

See [references/datasource-commands.md](references/datasource-commands.md) for `--detect-params` examples, linked datasources, quoting rules, reference naming, inspection, and test data discovery.

## Phase 6: Report Authoring

The `.rdlx-json` file already exists from Phase 3 with layout, elements, sample data, and DataSet definitions. This phase finalizes it: verify DataSets match the actual datasource fields (from `datasource-fields` output), refine expressions, and validate.

### Finalization checklist

1. **Verify DataSets** — Compare field Names/DataFields against `datasource-fields` output. Add missing fields with `dxs report dataset add-field`. Ensure `CommandText = $.{ds_name}.result.*` and all sensitivity properties are present.
2. **Refine expressions** — Update any placeholder values with final `=Fields!Name.Value` expressions. See [references/json-structure.md](references/json-structure.md) for expression quick reference.
3. **Validate:**
   ```bash
   dxs report validate my-report.rdlx-json
   ```

### Incremental CLI (edits to existing reports)

```bash
# Style and value changes
dxs report set file.rdlx-json ElementName --font-size 12pt --font-weight Bold

# Resize elements
dxs report set file.rdlx-json ElementName --width 3in --height 1in

# Reposition
dxs report move file.rdlx-json ElementName --left 1in --top 2in

# Remove
dxs report remove file.rdlx-json ElementName

# Add fields to existing datasets
dxs report dataset add-field <file> --dataset ds_shipment --field StoreNumber
dxs report dataset add-field <file> --dataset ds_shipment --field "Account.Name" --field "ShipDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]"
```

### Schema reference (when needed)

```bash
dxs report schema document    # full RDLX-JSON structure
dxs report schema items       # element types
dxs report schema item barcode  # specific element properties
dxs report schema expressions   # expression syntax
```

## Phase 7: Deploy & Verify

### Upload

```bash
dxs report upload my-report.rdlx-json --branch <id> --name "My Report" \
  --owned-datasource ds_my_report:ds_my_report \
  --owned-connection <connection_id> \
  --owned-query '<odata_query>' \
  --owned-title "ds_my_report" \
  --param id:number \
  --datasource-param 'paramName=$report.inParams.id'
```

Upload is **idempotent by reference name** — re-uploading updates the existing config. To create a separate copy, use a different `--name`.

### Preview

```bash
dxs report preview my-report.rdlx-json
dxs report preview my-report.rdlx-json --data my-report.data.json -o preview.svg
```

SVG is the default and most reliable format. The companion `.data.json` from Phase 3 can be used with `--data` for CLI preview.

### Verify

```bash
dxs report get <rep_reference> --branch <branch_id>
```

### Provide test parameters

If the datasource has `in_params`, output discovered test values as JSON so the user can test in Studio:

```
Test parameters for **Warehouse: Tampa, Project: TemplateOwner, March 2026** (203 records):

{
  "WarehouseId": 1,
  "ProjectId": 500571,
  "FromDate": "2026-03-01T00:00:00.000Z",
  "ToDate": "2026-03-12T00:00:00.000Z"
}
```

Always include: parameter names matching `in_params` exactly, human-readable context, and ISO 8601 format for dates.

**Artifact:** Save preview with `dxs report preview <report>.rdlx-json -o <artifact_dir>/<report-name>-preview.svg`.

## Troubleshooting

When debugging unexpected behavior, consult [references/common-mistakes.md](references/common-mistakes.md) for frequent pitfalls covering OData queries, datasource configuration, RDLX-JSON authoring, and CLI usage.
