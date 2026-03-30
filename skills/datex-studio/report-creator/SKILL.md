---
name: report-creator
description: |
  Use when building or modifying Datex Studio reports. This is the entry point
  for all report work — it orchestrates requirements gathering, schema exploration,
  datasource creation, layout prototyping, and deployment as a single workflow.
  Trigger for: "create a report", "build a report", "report from work item",
  "report from requirements", "modify a report", "migrate a report".
---

# Report Creator

Workflow for building and deploying RDLX-JSON reports using the `dxs` CLI. Reports render in ActiveReportsJS within Datex Studio.

**Key principle:** Plan before code. Build the layout prototype before writing final JSON.

**Prototyping and design:** This skill has its own visual prototyping workflow — `dxs report create` + `dxs report batch` + `dxs studio open` for live preview in a browser. Do NOT use external brainstorming visual companions, browser-based mockup tools, or other prototyping tools unless the user explicitly requests them. The Studio live preview IS the design tool.

**Authoring approach:**
- **Live prototyping** for new reports — create a blank `.rdlx-json`, build layout incrementally with `dxs report create` + `dxs report batch`, preview live in Studio
- **Incremental CLI** (`add`/`set`/`move`/`remove`/`batch`) for targeted edits to existing reports
- **Direct JSON** only for advanced structures not yet in the CLI (e.g., complex BandedList grouping, custom Tablix column/row hierarchies beyond simple header/detail)

**References:**
- [references/json-structure.md](references/json-structure.md) — Document template, element JSON formats, expression quick reference
- [references/design-patterns.md](references/design-patterns.md) — Coordinate system, layout patterns, element sizing
- [references/cli-commands.md](references/cli-commands.md) — Detailed CLI syntax: batch ops, tablix, images, datasets, set/move/remove
- [references/sample-data.md](references/sample-data.md) — Companion `.data.json` files for live preview
- [references/ssrs-migration.md](references/ssrs-migration.md) — Converting legacy SSRS (.rdl) reports to NextGen RDLX-JSON

## Orchestration Model

**This skill is the top-level orchestrator for all report work.** It invokes dependency skills in sequence with validation gates between phases. Do NOT invoke the dependency skills independently before this skill — this skill triggers them at the right time with the right context.

```
report-creator (this skill — orchestrates everything)
  │
  ├── Phase 1: Setup + Requirements
  │     ├── Select branch + connection
  │     └── Invoke `requirements-gathering` skill (routes to right source)
  │           ├── DevOps work item → invokes `devops-requirements` skill
  │           ├── Mockup/screenshot → visual analysis
  │           ├── User conversation → structured Q&A
  │           ├── Existing report (.rdl, .rdlx-json) → extract structure
  │           └── Document/spec → extract fields and layout
  │     Output: standardized requirements brief
  │
  ├── Phase 2: Schema Discovery + Datasource Creation
  │     ├── Invoke `schema-explorer` (via `datasource-creator`) for EVERY entity
  │     ├── Invoke `datasource-creator` for EVERY datasource
  │     ├── Invoke `odata-execution` to verify queries
  │     │
  │     ├── ▶ COVERAGE GATE: requirements brief vs datasource fields
  │     │   For EVERY field in the requirements brief:
  │     │   - Is it mapped to an OData path? If not, why?
  │     │   - Is it included in a datasource config? If not, why?
  │     │   - Does it need a calculated expression? Document it.
  │     │   Present gap report to user. Do NOT proceed until gaps are
  │     │   resolved or explicitly accepted.
  │     │
  │     └── Output: validated datasource configs + field coverage report
  │
  ├── Phase 3: Layout Prototype (live in Studio)
  │     ├── Create report + open in Studio
  │     ├── Build sections incrementally with user feedback
  │     ├── Add DataSets + sample data
  │     └── Output: working .rdlx-json with sample data preview
  │
  ├── Phase 4: Report Finalization
  │     └── Verify DataSets, refine expressions, validate
  │
  └── Phase 5: Deploy & Verify
        └── Upload, preview with real data, provide test parameters
```

**Planning boundary:** Phases 1-3 complete during planning (before `ExitPlanMode`). The prototype IS the report file — Phase 4 picks up where Phase 3 left off. Phases 4-5 execute after plan approval.

## Phase 1: Setup + Requirements

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

This returns only the org's repos (typically 3-10), not the full platform (hundreds).

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
| `<report-name>.rdlx-json` | The report file (created in Phase 3, refined in Phase 4) |
| `<report-name>.data.json` | Sample data for live Studio preview |
| `04-query-building.md` | Incremental query steps and final verified query |
| `<report-name>-preview.svg` | Preview image from `dxs report preview` |
| `requirements/` | Downloaded attachments and requirements brief (DevOps) |

### Requirements gathering

<HARD-GATE>
You MUST gather and document requirements BEFORE schema exploration or datasource creation. Do NOT skip this step, even if the user says "just build it" or provides a vague description. Requirements drive everything downstream — skipping this step causes field mapping errors, missing data, and layout rework.
</HARD-GATE>

**Invoke the `requirements-gathering` skill.** It handles routing to the right source (DevOps work item, mockup, conversation, document, existing report) and produces a standardized requirements brief with:
- Field list with semantic roles (what each field means, not just its name)
- Layout expectations
- Business rules and calculated fields
- Parameters

The requirements brief is the input to Phase 2 (schema exploration + datasource creation) and the coverage gate that follows it.

**For SSRS migrations:** If the source includes `.rdl` files, also see [references/ssrs-migration.md](references/ssrs-migration.md) for how to read them and translate SQL→OData.

## Phase 2: Schema Discovery + Datasource Creation

<HARD-GATE>
You MUST invoke the `datasource-creator` skill for EVERY datasource in this phase. Do NOT skip this step, even if:
- You found existing examples or templates that show the exact data model
- The user asked for a flow datasource (flow datasources aggregate data from OData queries — the underlying entities still need schema validation)
- You think you already know the entity structure from prior exploration

Examples and templates are hypotheses. Schema exploration against the CURRENT connection is the validation. Entity availability, property names, types, and relationships vary between connections.
</HARD-GATE>

For each datasource the report needs:
1. Invoke `datasource-creator` skill with mode = `owned` (preferred) or `standalone`
2. Datasource-creator invokes `schema-explorer` and `odata-execution` to validate entities and properties against the live connection
3. For flow datasources: schema exploration identifies the OData entities and fields the flow code will query, then the type definition is built from validated schema — not from examples
4. Collect the return summary: JSON config file path, reference name, result type, in_params, and **field summary** (used in Phase 3 Step 5 for DataSet creation)

Repeat for each datasource needed by the report.

### Coverage gate: requirements vs datasource fields

<HARD-GATE>
After ALL datasources are created, verify coverage against the requirements brief. Do NOT proceed to Phase 3 until this gate passes or the user explicitly accepts gaps.
</HARD-GATE>

For **every field** in the requirements brief:

| Check | Action if failed |
|-------|------------------|
| Field has an OData path in the schema mapping | Investigate: is the entity missing? Is the path too deep? Propose a linked or flow datasource. |
| Field is included in a datasource config | Add it — the datasource may need regeneration with additional `$select`/`$expand` paths. |
| Field requires a calculation (e.g., `tareWeight = GrossWeight - NetWeight`) | Document the expression for Phase 3. Note fields needed as inputs. |
| Field has no OData equivalent (e.g., SQL function, custom view) | Propose a flow datasource, or flag as a known gap for user decision. |

Present the coverage report to the user:

```
### Coverage Report: Requirements → Datasources

✅ Covered (N fields): [list]
⚠️ Calculated (N fields): [field → expression]
❌ Not available (N fields): [field → reason + proposed solution]

Proceed to layout? [Y / resolve gaps first]
```

This gate catches errors like:
- Shipper mapped to wrong entity (Account instead of Owner)
- Line-item fields omitted from datasource (tareWeight, packUOM)
- Deep navigation paths skipped without alternatives (Owner address)

## Phase 3: Layout Prototype (Live in Studio)

**Build an actual RDLX-JSON report and preview it live in Datex Studio.** The prototype IS the report file — Phase 4 picks up where this phase leaves off. The user sees every change in real time.

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

Then replace placeholders with realistic sample values — 3-5 rows per dataset. Field names must match DataSet field **Names** (underscore notation, e.g., `Lines_Material_LookupCode`), not dot-notation DataField paths.

See [references/sample-data.md](references/sample-data.md) for the full format and examples.

### Step 5: Add DataSets to the report

**REQUIRED for Studio preview.** Without DataSet definitions, Studio shows "no matching DataSet in report" errors and field expressions render as raw text.

```bash
dxs report dataset add <file> --name ds_shipment \
  --field Id --field LookupCode --field Status \
  --field "Account.Name" \
  --field "OrderDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]"
```

Use the **field summary** from the datasource-creator's return as the primary source for field names — it is extracted directly from the generated config's type definitions and is authoritative. Include ALL fields, not just the ones used in expressions. The field-mapping artifact provides additional human-readable context for layout decisions but should not be the primary source for DataSet field names.

Phase 4 will verify against the actual datasource (standalone) or the config JSON (owned).

**Handling collection fields in DataSets:**

Check the datasource-creator return for fields marked `[collection]`. These **cannot** be added as flat DataSet fields on a single-result DataSet — they will silently render blank.

**Preferred approach: flow datasource.** If the datasource-creator return contains collections with fields needed in standalone textboxes, go back to Phase 2 and rebuild that datasource as a flow. The flow code fetches the OData data and flattens collections into scalar fields. This is the production pattern used by all existing Datex Studio reports with complex navigation.

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

**CommandText `.*` suffix rule:**
- Single result, scalar fields: `$.ds_name.result` (no `.*`)
- Collection result (table/tablix): `$.ds_name.result.*`
- Collection within single result: `$.ds_name.result.CollectionPath.*`

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

## Phase 4: Report Finalization

The `.rdlx-json` file already exists from Phase 3 with layout, elements, sample data, and DataSet definitions. This phase finalizes it for deployment.

### Finalization checklist

1. **Verify DataSets** — For **standalone** datasources: compare field Names/DataFields against `dxs report datasource-fields <ref> --branch <id>` output. For **owned** datasources: compare against the field summary from Phase 2 (datasource-fields is only available post-upload). Add missing fields with `dxs report dataset add-field`. Ensure `CommandText = $.{ds_name}.result.*` and all sensitivity properties are present.
2. **Refine expressions** — Update any placeholder values with final `=Fields!Name.Value` expressions. See [references/json-structure.md](references/json-structure.md) for expression quick reference.
3. **Validate:**
   ```bash
   dxs report validate my-report.rdlx-json
   ```

For incremental edits to existing reports, see [references/cli-commands.md](references/cli-commands.md) for `set`/`move`/`remove`/`dataset add-field` syntax.

## Phase 5: Deploy & Verify

### Upload

```bash
# Owned datasource (embedded from config file generated by dxs datasource generate)
dxs report upload my-report.rdlx-json --branch <id> --name "My Report" \
  --owned ds_my_report.json:ds_my_report \
  --param id:number \
  --datasource-param 'paramName=$report.inParams.id'

# Standalone datasource (already upserted to the branch)
dxs report upload my-report.rdlx-json --branch <id> --name "My Report" \
  --use-datasource ds_my_report:ds_my_report \
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

### RDLX-JSON & Expression Issues

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

### Layout & CLI Issues

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
