---
name: report-creator
description: |
  Use when building or modifying Datex Studio reports with dxs report commands:
  RDLX-JSON authoring, layout prototyping in Studio, report upload,
  SSRS-to-NextGen migration.
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

## Dependencies

**REQUIRED BACKGROUND:** Before building a report, you will need:
- `datasource-creator` — to create datasource config(s) for the report
- `schema-explorer` — for test data discovery (finding real `in_params` values)
- `odata-execution` — for querying real data to provide test parameters
- `devops-requirements` — when building from a DevOps work item (optional)

## Workflow

**Planning boundary:** Phases 1-3 complete during planning (before `ExitPlanMode`). The prototype IS the report file — Phase 4 picks up where Phase 3 left off. Phases 4-5 execute after plan approval.

1. **Setup** — Select branch + connection + artifact directory
2. **Schema Discovery + Datasource Creation** — *(delegated to datasource-creator)*
3. **Layout Prototype** — Create actual RDLX-JSON with `dxs report create` + `dxs report batch`, preview live in Studio with `dxs studio open`, iterate with user feedback

---

4. **Report Finalization** — Verify DataSets against datasource, refine expressions, validate
5. **Deploy & Verify** — Upload, preview, confirm

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

### Requirements from DevOps work item (optional)

If the user references a DevOps work item, **REQUIRED BACKGROUND:** use the
`devops-requirements` skill to extract requirements before proceeding.

**For SSRS migrations:** If the work item includes `.rdl` files, see [references/ssrs-migration.md](references/ssrs-migration.md) for how to read them and translate SQL→OData.

## Phase 2: Schema Discovery + Datasource Creation

**REQUIRED BACKGROUND:** Use the `datasource-creator` skill for this phase.
It will invoke `schema-explorer` and `odata-execution` as needed.

For each datasource the report needs:
1. Invoke datasource-creator with mode = `owned` (preferred) or `standalone`
2. Datasource-creator handles schema discovery, query building, generation, and validation
3. Collect the JSON config file path and reference name

Repeat for each datasource needed by the report.

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

Include ALL fields from the field mapping table — not just the ones used in expressions. Phase 4 will verify against the actual datasource.

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

1. **Verify DataSets** — Compare field Names/DataFields against `datasource-fields` output. Add missing fields with `dxs report dataset add-field`. Ensure `CommandText = $.{ds_name}.result.*` and all sensitivity properties are present.
2. **Refine expressions** — Update any placeholder values with final `=Fields!Name.Value` expressions. See [references/json-structure.md](references/json-structure.md) for expression quick reference.
3. **Validate:**
   ```bash
   dxs report validate my-report.rdlx-json
   ```

For incremental edits to existing reports, see [references/cli-commands.md](references/cli-commands.md) for `set`/`move`/`remove`/`dataset add-field` syntax.

## Phase 5: Deploy & Verify

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
