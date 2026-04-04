---
name: report-creator
description: |
  Use when building NEW Datex Studio reports from scratch. This is the entry point
  for all new report work — it orchestrates requirements gathering, schema exploration,
  datasource creation, layout prototyping, and deployment as a single workflow.
  Trigger for: "create a report", "build a report", "report from work item",
  "report from requirements". For modifying EXISTING reports, use `report-editor`.
---

# Report Creator

Workflow for building and deploying RDLX-JSON reports using the `dxs` CLI. Reports render in ActiveReportsJS within Datex Studio.

**Key principle:** Plan before code. Build the layout prototype before writing final JSON.

**Prototyping and design:** This skill has its own visual prototyping workflow — `dxs report create` + `dxs report batch` + `dxs studio open` for live preview in a browser. Do NOT use external brainstorming visual companions, browser-based mockup tools, or other prototyping tools unless the user explicitly requests them. The Studio live preview IS the design tool.

**Authoring approach:**
- **Live prototyping** for new reports — create a blank `.rdlx-json`, build layout incrementally with `dxs report create` + `dxs report batch`, preview live in Studio
- **Incremental CLI** (`add`/`set`/`move`/`remove`/`batch`) for targeted edits during layout iteration
- **Direct JSON** only for advanced structures not yet in the CLI (e.g., complex BandedList grouping, custom Tablix column/row hierarchies beyond simple header/detail)

**References (shared):**
- [../shared/branch-setup.md](../shared/branch-setup.md) — Branch & connection selection
- [../shared/report-authoring/design-standards.md](../shared/report-authoring/design-standards.md) — **Datex design language:** color palette, typography, table styling, field label-value pattern, grid alignment, report categories
- [../shared/report-authoring/json-structure.md](../shared/report-authoring/json-structure.md) — Document template, element JSON formats, expression quick reference
- [../shared/report-authoring/design-patterns.md](../shared/report-authoring/design-patterns.md) — Coordinate system, layout patterns, element sizing
- [../shared/report-authoring/cli-commands.md](../shared/report-authoring/cli-commands.md) — Detailed CLI syntax: batch ops, tablix, images, datasets, set/move/remove
- [../shared/report-authoring/sample-data.md](../shared/report-authoring/sample-data.md) — Companion `.data.json` files for live preview
- [../shared/report-authoring/dataset-rules.md](../shared/report-authoring/dataset-rules.md) — DataSet management: CommandText rules, collection handling, date annotations
- [../shared/report-authoring/deploy-patterns.md](../shared/report-authoring/deploy-patterns.md) — Upload, preview, and verification patterns
- [../shared/report-authoring/troubleshooting.md](../shared/report-authoring/troubleshooting.md) — Common RDLX-JSON and CLI mistakes & fixes
- [../shared/studio-management.md](../shared/studio-management.md) — Studio lifecycle: check, start, cleanup

**References (creation-specific):**
- [references/ssrs-migration.md](references/ssrs-migration.md) — Converting legacy SSRS (.rdl) reports to NextGen RDLX-JSON
- [references/examples/](references/examples/) — **Platonic ideals:** canonical patterns for common report types, distilled from real-world corpus analysis

## Orchestration Model

**This skill is the top-level orchestrator for new report creation.** It invokes dependency skills in sequence with validation gates between phases. Do NOT invoke the dependency skills independently before this skill — this skill triggers them at the right time with the right context.

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

### Intent routing: create vs modify existing

If the user asks to **modify an existing report** on a branch (e.g., "add a column to the receiving report", "change the label on the BOL", "update the report on branch 64"), invoke the `report-editor` skill instead. Report-creator is for building new reports from scratch.

If the user says "modify" but the report does not exist yet on the branch, confirm with the user: "That report doesn't exist on this branch yet. Should I create it from scratch?" If yes, continue with report-creator.

**Planning boundary:** Phases 1-3 complete during planning (before `ExitPlanMode`). The prototype IS the report file — Phase 4 picks up where Phase 3 left off. Phases 4-5 execute after plan approval.

## Phase 1: Setup + Requirements

### Select branch

Follow [branch-setup.md](../shared/branch-setup.md) to identify the active organization, list repositories, select a feature branch, and discover API connections.

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

**Platonic ideals:** Check [references/examples/](references/examples/) for a canonical pattern matching the report type (e.g., license plate label, BOL, packing slip). These are distilled from corpus analysis of real-world reports and define the essential elements, common optional fields, layout properties, and structural archetypes. Use the platonic ideal to validate requirements completeness and guide layout decisions — it tells you what a typical report of this type looks like and what variations exist.

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
dxs report create <artifact_dir>/<report_name>_report --page letter --margins 0.5in
```

Use `--page` for standard sizes (`letter`, `legal`, `a4`, `4x6`, `4x8`) or custom (`WxH`). Add `--landscape` for landscape orientation. `--margins` supports CSS-style shorthand.

**Naming rule:** The folder name becomes the report's `referenceName`, which the Wavelength platform uses to generate TypeScript service classes. It **must be a valid JavaScript identifier** — letters, digits, underscores, `$` only. No hyphens, dots, or spaces. Use the `_report` suffix convention.

| Bad | Good | Why |
|-----|------|-----|
| `srs-bol` | `srs_bol_report` | Hyphens break TS class names |
| `srs-bol.rdlx-json` | `srs_bol_report` | Dots and extensions break TS imports |
| `my report` | `my_report` | Spaces are not valid in identifiers |

**Alias rule for owned datasources:** When adding owned datasources with `dxs report datasource add --owned FILE:ALIAS`, the **alias must match the datasource's `referenceName`** inside the JSON config file. The platform registers services by referenceName but the report references them by alias — a mismatch causes "property does not exist" TS errors. Example: if the config has `"referenceName": "ds_bol_header"`, use `--owned ds_bol_header.json:ds_bol_header`.

### Step 2: Open in Studio

```bash
dxs studio open <artifact_dir>/<report_name>_report/report.rdlx-json
```

This opens the report in the Studio design canvas at `http://127.0.0.1:5051/design`. Every file change is reflected live.

**Auto-manage Studio** per [../shared/studio-management.md](../shared/studio-management.md): check status, start in background if needed (with readiness verification), open the report, and clean up after Phase 5.

### Step 3: Build layout incrementally with `dxs report batch`

Use `dxs report batch` to add elements in groups. Write ops to a file and use `--ops-file` to avoid shell escaping issues. Maximum 25 operations per batch.

**Apply the Datex design language** from [../shared/report-authoring/design-standards.md](../shared/report-authoring/design-standards.md): set `FontFamily: Arial` on all text elements (use `Courier New` for numeric values and barcode captions), use the official color palette (Black, DimGray, LightGray, Gray, Datex Purple #5B08B2), style tables with purple header borders and LightGray row separators (no background colors), follow the field label-value pattern (8pt DimGray labels above 10pt Black values), and snap positions to the 0.25in grid.

**Build in logical sections using rectangle containers.** Every major section (header, info fields, address blocks, footer) should be wrapped in a rectangle. Add the rectangle first, then add child elements with `"parent": "RectangleName"`. Child coordinates are relative to the rectangle's top-left corner (0,0), so moving the rectangle repositions everything inside it. This is important for layout iteration — without rectangles, repositioning a section means moving every element individually. See [../shared/report-authoring/cli-commands.md](../shared/report-authoring/cli-commands.md) for the batch pattern. Tables are self-contained and don't need a rectangle wrapper.

**Tables:** Use `dxs report add tablix` for line items with `--header-cell`, `--detail-cell`, `--footer-cell` (repeated options, one per cell) and `--header-style`/`--detail-style`/`--footer-style` for row-level defaults. Prefer footer rows over standalone textboxes for totals.

**Lines** use `start-x`/`start-y`/`end-x`/`end-y` in batch (not `left`/`top`/`width`/`height`). `move` does not work on lines — edit JSON directly.

**Images:** Use `dxs report add image --file logo.png` for embedded images, `--source Database --value '=Fields!X.Value'` for data-bound images. Database-bound images need data URIs in the sample data file — see [../shared/report-authoring/sample-data.md](../shared/report-authoring/sample-data.md).

**PageHeader/PageFooter:** These are document-root elements requiring direct JSON editing — see [../shared/report-authoring/json-structure.md](../shared/report-authoring/json-structure.md).

See [../shared/report-authoring/cli-commands.md](../shared/report-authoring/cli-commands.md) for detailed syntax and examples of all batch operations, tablix creation, image handling, and element editing.

### Step 4: Create sample data file

Create a companion `<report-name>.data.json` alongside the report. Studio auto-discovers this file.

**Scaffold from DataSets** — after adding DataSets (Step 5), generate a template:

```bash
dxs report data generate <report-name>.rdlx-json -o <report-name>.data.json
```

Then replace placeholders with realistic sample values — 3-5 rows per dataset. Field names must match DataSet field **Names** (underscore notation, e.g., `Lines_Material_LookupCode`), not dot-notation DataField paths.

See [../shared/report-authoring/sample-data.md](../shared/report-authoring/sample-data.md) for the full format and examples.

### Step 5: Add DataSets to the report

**REQUIRED for Studio preview.** Without DataSet definitions, Studio shows "no matching DataSet in report" errors and field expressions render as raw text.

Follow [dataset-rules.md](../shared/report-authoring/dataset-rules.md) for DataSet creation, CommandText patterns, collection handling, date annotations, and sensitivity properties.

Use the **field summary** from the datasource-creator's return as the primary source for field names. Phase 4 will verify against the actual datasource.

### Step 6: Verify with preview

```bash
dxs report preview <file> -o /tmp/preview.svg
dxs report preview <file> --bbox Title:red --bbox LinesTable:blue -o /tmp/inspect.svg
```

Use `--bbox NAME[:COLOR]` for visual debugging with colored bounding boxes.

### Feedback iteration loop

After building each section, ask the user how it looks in Studio. Use `dxs report batch` with `set`/`move`/`remove` ops for changes. Repeat until the user approves.

### Layout reference

See [../shared/report-authoring/design-patterns.md](../shared/report-authoring/design-patterns.md) for pattern examples (Shipping Label, GS1, BOL, Tabular Report) and element sizing tables.

## Phase 4: Report Finalization

The `.rdlx-json` file already exists from Phase 3 with layout, elements, sample data, and DataSet definitions. This phase finalizes it for deployment.

### Finalization checklist

1. **Verify DataSets** — For **standalone** datasources: compare field Names/DataFields against `dxs report datasource-fields <ref> --branch <id>` output. For **owned** datasources: compare against the field summary from Phase 2 (datasource-fields is only available post-upload). Add missing fields with `dxs report dataset add-field`. Ensure `CommandText = $.{ds_name}.result.*` and all sensitivity properties are present.
2. **Refine expressions** — Update any placeholder values with final `=Fields!Name.Value` expressions. See [../shared/report-authoring/json-structure.md](../shared/report-authoring/json-structure.md) for expression quick reference.
3. **Validate:**
   ```bash
   dxs report validate my-report.rdlx-json
   ```

For incremental edits during finalization, see [../shared/report-authoring/cli-commands.md](../shared/report-authoring/cli-commands.md) for `set`/`move`/`remove`/`dataset add-field` syntax.

## Phase 5: Deploy & Verify

Follow [deploy-patterns.md](../shared/report-authoring/deploy-patterns.md) for upload (owned vs standalone), preview, verification, and test parameter discovery.

**Artifact:** Save preview with `dxs report preview <report>.rdlx-json -o <artifact_dir>/<report-name>-preview.svg`.

## Troubleshooting

See [troubleshooting.md](../shared/report-authoring/troubleshooting.md) for common RDLX-JSON expression issues and layout/CLI mistakes.
