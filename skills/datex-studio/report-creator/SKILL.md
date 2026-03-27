---
name: report-creator
description: |
  End-to-end workflow for building Datex Studio reports and labels: OData schema discovery, datasource creation, RDLX-JSON report authoring, and deployment. Use when asked to build/create/design/modify/edit/update reports or labels, create or manage datasources, explore OData schema for report purposes, write or troubleshoot RDLX-JSON, or interact with `dxs report`/`dxs datasource`/`dxs schema` commands. Also use when building reports from Azure DevOps work items, migrating SSRS reports to NextGen, or extracting report requirements from DevOps tickets.

  Keywords: report, label, datasource, schema, OData, RDLX-JSON, barcode, shipping label, BOL, bill of lading, commercial invoice, dxs, ActiveReportsJS, preview, bounding box, devops, work item, requirement, SSRS, migration, ticket, pick slip, packing slip, invoice, receiving report, activity report, inventory report, template, layout, column, parameter, filter
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
- [references/cli-commands.md](references/cli-commands.md) — Detailed CLI syntax: batch ops, tablix, images, datasets, set/move/remove
- [references/schema-discovery.md](references/schema-discovery.md) — Batch syntax, individual commands, anti-patterns
- [references/sample-data.md](references/sample-data.md) — Companion `.data.json` files for live preview
- [references/datasource-commands.md](references/datasource-commands.md) — Parameter strategies, linked datasources, quoting, post-upsert verification
- [references/odata-patterns.md](references/odata-patterns.md) — Server-side filtering: lambda operators, string functions, SQL→OData mapping
- [references/ssrs-migration.md](references/ssrs-migration.md) — Converting legacy SSRS (.rdl) reports to NextGen RDLX-JSON
- [references/common-mistakes.md](references/common-mistakes.md) — Frequent pitfalls and fixes
- [references/devops-requirements.md](references/devops-requirements.md) — Extracting report requirements from Azure DevOps work items

## Workflow

**Planning boundary:** Phases 1–3 complete during planning (before `ExitPlanMode`). The prototype IS the report file — Phase 6 picks up where Phase 3 left off. Phases 4–7 execute after plan approval.

1. **Setup** — Select branch + connection + artifact directory
2. **Schema Discovery + Field Mapping** — *(subagent)* Explore OData entities, build field mapping table
3. **Layout Prototype** — Create actual RDLX-JSON with `dxs report create` + `dxs report batch`, preview live in Studio with `dxs studio open`, iterate with user feedback

---

4. **Query Building** — Incremental OData query with `$top=1`
5. **Datasource Upsert** — Create datasource with params and linked refs
6. **Report Finalization** — Verify DataSets against datasource, refine expressions, validate
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

Present API connections using **AskUserQuestion** (skip if only one — just inform the user). Store both: the `apiConnectionId` (for `-c` flag) and the `name` (for `--api-setting-name`).

**Finding a customer's connection:** Use `dxs organization connection list --search <term>` to search connection names and URLs (case-insensitive).

### Artifact collection (optional)

Ask the user if they want to save process artifacts to disk (schema notes, queries, report file, sample data, preview images). Suggested location: `./reports/<report-name>/`.

If yes, create the artifact directory and use this naming convention:

| Filename | Content |
|----------|---------|
| `01-schema-exploration.md` | Entity descriptions, field lists, relationships |
| `02-field-mapping.md` | Field mapping table |
| `<report-name>.rdlx-json` | The report file (created in Phase 3, refined in Phase 6) |
| `<report-name>.data.json` | Sample data for live Studio preview |
| `04-query-building.md` | Incremental query steps and final verified query |
| `<report-name>-preview.svg` | Preview image from `dxs report preview` |
| `requirements/` | Downloaded attachments and requirements brief (DevOps) |

### Requirements from DevOps work item (optional)

If the user references a DevOps work item (by ID, URL, or mention of "work item"/"requirement"/"ticket"), extract requirements before schema discovery:

1. Fetch with `dxs devops workitem <ID> --full --expand All`
2. Review relations — present parent/children/attachments, ask which to explore
3. **Validate scope with user** — confirm which attachments and design notes are relevant
4. Download user-confirmed attachments to `<artifact_dir>/requirements/`
5. Compile a requirements brief: report purpose, field/data requirements, layout expectations, entity keywords

See [references/devops-requirements.md](references/devops-requirements.md) for the full extraction workflow, attachment decision table, and requirements brief template.

**For SSRS migrations:** If the work item includes `.rdl` files, see [references/ssrs-migration.md](references/ssrs-migration.md) for how to read them and translate SQL→OData.

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
- **Verify critical nav properties return data** — for key navigation properties (especially Address, Contact, Warehouse), run a `$top=1` OData query with the expand to confirm the nav property is populated, not just that it exists in the schema. Some entities have nav properties with NULL foreign keys (e.g., Warehouse.AddressId may be NULL). If a nav property returns empty, note the gap and suggest an alternate path (e.g., WarehousesContactsLookup → Contact → Address).
- **Test server-side collection filtering with lambda operators** — when a report needs to filter based on whether a collection is empty or contains matching items (e.g., "locations with no active license plates"), test OData `any()`/`all()` lambda operators before recommending client-side filtering. See references/odata-patterns.md for lambda syntax and examples.
- **Identify all filtering/exclusion rules** — extract every filtering requirement from the design notes (SQL WHERE clauses, business rules, exclusion criteria) and note which can be expressed as OData `$filter` clauses.

See references/schema-discovery.md for batch syntax and anti-patterns.

**Return:** The field mapping table, a summary of entities explored, any notable relationships or composite keys found, any nav properties that exist in the schema but returned empty data (with alternate paths if discovered), and a proposed `$filter` clause covering all identified filtering/exclusion rules (with test results confirming the filters work).
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

Use `--page` for standard sizes (`letter`, `legal`, `a4`, `4x6`, `4x8`) or custom (`WxH`). Add `--landscape` for landscape orientation. `--margins` supports CSS-style shorthand.

### Step 2: Open in Studio

```bash
dxs studio open <artifact_dir>/<report-name>.rdlx-json
```

This opens the report in the Studio design canvas at `http://127.0.0.1:5051/design`. Every file change is reflected live.

**Prerequisite:** The user must have `dxs studio` running in another terminal. If the `open` command fails with "No studio server running", inform the user:
> Studio needs to be running for live preview. Start it with `dxs studio` in another terminal, then we'll continue.

### Step 3: Build layout incrementally with `dxs report batch`

Use `dxs report batch` to add elements in groups. Write ops to a file and use `--ops-file` to avoid shell escaping issues. Maximum 25 operations per batch.

**Build in logical sections using rectangle containers.** Every major section (header, info fields, address blocks, footer) should be wrapped in a rectangle. Add the rectangle first, then add child elements with `"parent": "RectangleName"`. Child coordinates are relative to the rectangle's top-left corner (0,0), so moving the rectangle repositions everything inside it. This is important for layout iteration — without rectangles, repositioning a section means moving every element individually. See [references/cli-commands.md](references/cli-commands.md) for the batch pattern. Tables are self-contained and don't need a rectangle wrapper.

**Tables:** Use `dxs report add tablix` for line items with `--header-cell`, `--detail-cell`, `--footer-cell` (repeated options, one per cell) and `--header-style`/`--detail-style`/`--footer-style` for row-level defaults. Prefer footer rows over standalone textboxes for totals.

**Lines** use `start-x`/`start-y`/`end-x`/`end-y` in batch (not `left`/`top`/`width`/`height`). `move` does not work on lines — edit JSON directly.

**Images:** Use `dxs report add image --file logo.png` for embedded images, `--source Database --value '=Fields!X.Value'` for data-bound images. Database-bound images need data URIs in the sample data file — see [references/sample-data.md](references/sample-data.md).

**PageHeader/PageFooter:** These are document-root elements requiring direct JSON editing — see [references/json-structure.md](references/json-structure.md).

See [references/cli-commands.md](references/cli-commands.md) for detailed syntax and examples of all batch operations, tablix creation, image handling, and element editing.

### Step 4: Create sample data file

Create a companion `<report-name>.data.json` alongside the report. Studio auto-discovers this file.

**Scaffold from DataSets** — after adding DataSets (Step 5), generate a template:

```bash
dxs report data generate <report-name>.rdlx-json -o <report-name>.data.json
```

Then replace placeholders with realistic sample values — 3–5 rows per dataset. Field names must match DataSet field **Names** (underscore notation, e.g., `Lines_Material_LookupCode`), not dot-notation DataField paths.

See [references/sample-data.md](references/sample-data.md) for the full format and examples.

### Step 5: Add DataSets to the report

**REQUIRED for Studio preview.** Without DataSet definitions, Studio shows "no matching DataSet in report" errors and field expressions render as raw text.

```bash
dxs report dataset add <file> --name ds_shipment \
  --field Id --field LookupCode --field Status \
  --field "Account.Name" \
  --field "OrderDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]"
```

Include ALL fields from the field mapping table — not just the ones used in expressions. Phase 6 will verify against the actual datasource.

### Step 6: Verify with preview

```bash
dxs report preview <file> -o /tmp/preview.svg
dxs report preview <file> --bbox Title:red --bbox LinesTable:blue -o /tmp/inspect.svg
```

Use `--bbox NAME[:COLOR]` for visual debugging with colored bounding boxes.

### Feedback iteration loop

After building each section, ask the user how it looks in Studio. Use `dxs report batch` with `set`/`move`/`remove` ops for changes. Repeat until the user approves.

### Layout reference

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

### Push filtering server-side

Before accepting any client-side filtering approach, verify whether the logic can be expressed in `$filter`. OData supports lambda operators (`any()`/`all()`) for collection filtering, string functions (`startswith`, `endswith`, `contains`), and nested `$filter` in `$expand` — these often replace complex SQL subqueries and LIKE patterns cleanly.

See [references/odata-patterns.md](references/odata-patterns.md) for the full pattern reference with examples and SQL→OData mappings.

### Parameterized queries (key segment)

For single-entity reports, use `Entity(0)` as placeholder. Validate with `Entity?$top=1` first — `Entity(0)` returns 404 (expected, no entity with ID 0).

### SSRS migrations

When converting legacy SSRS reports, don't translate SQL→OData line-by-line. See [references/ssrs-migration.md](references/ssrs-migration.md) for the full guide covering SQL→OData structural mapping, parameter translation, hard-coded ID verification, and common pitfalls.

### Critical rules

- **`$top=1` always** during testing to avoid timeouts
- **Single quotes** for `-q` (prevents `$` shell expansion)
- **`%27`** for OData string literals in filters — literal single quotes break the generated TypeScript. Use `endswith(Name,%27-10%27)` not `endswith(Name,'-10')`. See [references/datasource-commands.md](references/datasource-commands.md) Quoting Rules.
- **`-Q` / `--query-file`** for complex queries — write query to a file via quoted heredoc, pass with `-Q`. See [references/datasource-commands.md](references/datasource-commands.md) for the pattern.
- **`$select` in `$expand`** is required on every expand clause — also enforced by `dxs datasource upsert`
- **Semicolons** (`;`) inside parentheses for nested options, not `&`
- **400 on `$select`** means wrong field name — check `schema properties`, don't drop `$select`
- **Composite keys** — check `keys:` section; some entities have no `Id` field

**Artifact:** Save incremental query steps and final verified query to `04-query-building.md`.

## Phase 5: Datasource Upsert

```bash
dxs datasource upsert \
  -c <connection_id> \
  -Q <query_file> \
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

## Phase 6: Report Finalization

The `.rdlx-json` file already exists from Phase 3 with layout, elements, sample data, and DataSet definitions. This phase finalizes it for deployment.

### Finalization checklist

1. **Verify DataSets** — Compare field Names/DataFields against `datasource-fields` output. Add missing fields with `dxs report dataset add-field`. Ensure `CommandText = $.{ds_name}.result.*` and all sensitivity properties are present.
2. **Refine expressions** — Update any placeholder values with final `=Fields!Name.Value` expressions. See [references/json-structure.md](references/json-structure.md) for expression quick reference.
3. **Validate:**
   ```bash
   dxs report validate my-report.rdlx-json
   ```

For incremental edits to existing reports, see [references/cli-commands.md](references/cli-commands.md) for `set`/`move`/`remove`/`dataset add-field` syntax.

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

SVG is the default and most reliable format.

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
