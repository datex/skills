---
name: report-editor
description: |
  Use when modifying EXISTING Datex Studio reports on a branch. Handles label/style
  changes, field rearrangement, adding/removing columns, datasource modifications,
  and adding new data sections. Trigger for: "edit a report", "modify a report",
  "change the label", "add a column", "update the report on branch X",
  "fix the report layout". For creating NEW reports from scratch, use `report-creator`.
---

# Report Editor

Workflow for modifying existing RDLX-JSON reports on a Datex Studio branch using the `dxs` CLI.

**Key principle:** Understand before modifying. Download and inspect the current report before making any changes.

**Authoring approach:**
- **Incremental CLI** (`set`/`move`/`remove`/`batch`/`table add-column`/`dataset add-field`) for all modifications
- **Direct JSON** only for structures the CLI cannot handle (PageHeader/PageFooter, complex Tablix grouping)
- **Never recreate from scratch** -- work with the existing file

## References (shared)

- [../shared/branch-setup.md](../shared/branch-setup.md) -- Branch & connection selection
- [../shared/studio-management.md](../shared/studio-management.md) -- Studio lifecycle: check, start, cleanup
- [../shared/report-authoring/design-standards.md](../shared/report-authoring/design-standards.md) -- Datex design language: color palette, typography, table styling, field label-value pattern, grid alignment, report categories
- [../shared/report-authoring/design-patterns.md](../shared/report-authoring/design-patterns.md) -- Coordinate system, layout patterns, element sizing
- [../shared/report-authoring/json-structure.md](../shared/report-authoring/json-structure.md) -- RDLX-JSON format: document template, element JSON formats, expression quick reference
- [../shared/report-authoring/cli-commands.md](../shared/report-authoring/cli-commands.md) -- CLI syntax: batch ops, tablix, images, datasets, set/move/remove, validation
- [../shared/report-authoring/sample-data.md](../shared/report-authoring/sample-data.md) -- Sample data format for live preview
- [../shared/report-authoring/dataset-rules.md](../shared/report-authoring/dataset-rules.md) -- DataSet management: CommandText rules, collection handling, date annotations, sensitivity properties
- [../shared/report-authoring/deploy-patterns.md](../shared/report-authoring/deploy-patterns.md) -- Upload, preview, and verification patterns
- [../shared/report-authoring/troubleshooting.md](../shared/report-authoring/troubleshooting.md) -- Common RDLX-JSON and CLI mistakes & fixes

## Dependencies

`datasource-creator` and `schema-explorer` are invoked ONLY when needed (Categories 4-5). They are not required for layout-only edits (Categories 1-3).

## Orchestration Model

```
report-editor (this skill)
  |
  +-- Phase 1: Download & Inspect
  |     +-- Select branch + find report (branch-setup.md)
  |     +-- Download report folder (RDLX-JSON + datasources + manifest)
  |     +-- Inspect layout + DataSets + datasource fields
  |     +-- Output: report folder + structural understanding
  |
  +-- Phase 2: Triage -- Determine Change Depth
  |     +-- Classify user's request into category 1-5
  |     +-- Check DataSet fields vs datasource fields
  |     +-- Output: modification plan with category + steps
  |
  +-- Phase 3: Modify (conditional paths by category)
  |     +-- Cat 1-2: Layout-only --> set/move/remove/batch on folder/report.rdlx-json
  |     +-- Cat 3: Add from existing DataSet field --> table add-column
  |     +-- Cat 4: Datasource gap --> datasource-creator --> datasource add --> DataSet --> layout
  |     +-- Cat 5: New section --> schema-explorer --> datasource-creator --> datasource add --> DataSet --> layout
  |
  +-- Phase 4: Deploy & Verify (deploy-patterns.md)
  |     +-- assemble folder --> wrapper JSON
  |     +-- upload wrapper JSON
```

## Phase 1: Download & Inspect

### Select branch and find report

Follow [branch-setup.md](../shared/branch-setup.md) for branch/connection selection.

Then list reports on the branch:

```bash
dxs report list --branch <branch_id>
```

Present reports to the user if the target is ambiguous. If the user named a specific report, match it against the list.

### Download the report folder

```bash
# Auto-names folder from reference name
dxs report download --branch <branch_id> --reference-name <reference_name>

# Or specify folder path explicitly
dxs report download <folder_path> --branch <branch_id> --reference-name <reference_name>
```

This creates a **report folder** containing:
- `report.rdlx-json` -- the RDLX-JSON layout (editing commands target this)
- `manifest.json` -- all binding metadata (datasources, params, datasource-params, access modifier)
- `ds_*.json` -- one file per owned datasource config (extracted from the wrapper)

The manifest preserves all datasource bindings, parameter mappings, and metadata. No manual extraction or flag reconstruction needed for re-upload.

### Inspect the report folder

Check the manifest to understand datasource bindings:

```bash
dxs report datasource list <folder>/
```

Inspect the layout:

```bash
dxs report inspect <folder>/report.rdlx-json
```

Also read the RDLX-JSON directly to understand DataSets, element hierarchy, and expressions.

### Visual layout inspection

Use `--bbox` to generate a preview with colored bounding boxes — helpful for understanding element positions before modifying:

```bash
dxs report preview <file.rdlx-json> --bbox ElementName:red --bbox AnotherElement:blue -o /tmp/inspect.svg
```

### Inspect current layout

```bash
dxs report inspect <file.rdlx-json>
```

This shows every element with type, name, position, size, value/expression, and DataSet bindings. Also read the file directly to understand:
- DataSets (names, fields, CommandText patterns)
- Element hierarchy (rectangles containing children)
- Expressions used
- Page settings (size, margins, orientation)

### Identify available datasource fields

For EACH datasource used by the report (check `dxs report datasource list <folder>/` to see them):

```bash
# For standalone datasources
dxs report datasource-fields <datasource_ref> --branch <branch_id>

# For owned datasources
dxs report datasource-fields <datasource_ref> --branch <branch_id> --report <report_ref>
```

This gives you the complete field list, `in_params`, result type, and collections. **This is the triage gate** -- in Phase 2, you will check whether requested fields are already available here.

### Report not found

If `dxs report list` does not return the target report:
1. Inform the user: "That report was not found on branch X."
2. Ask: "Would you like to create it from scratch?"
3. If yes, invoke the `report-creator` skill.

## Phase 2: Triage -- Determine Change Depth

Classify each requested change into one of five categories. Different categories require different workflows.

### Change Categories

| Category | Examples | What's Needed | Dependency Skills |
|----------|----------|---------------|-------------------|
| **1. Label/Style** | "Change 'SHIPPER' to 'FROM'", "Make header blue", "Increase font size" | `set`/`batch` only | None |
| **2. Rearrangement** | "Swap columns 2 and 3", "Move address block down", "Remove the footer" | `move`/`remove`/`set` | None |
| **3. Add column (field in DataSet)** | "Add the Status column" where Status IS in the DataSet | `table add-column` + layout | None |
| **4a. Add field (in datasource, missing from DataSet)** | "Add Material Description" where the field IS in the datasource output but NOT in the DataSet | `dataset add-field` + layout | None |
| **4b. Add field (datasource gap)** | "Add Material Description" where the field is NOT in the datasource `$select`/`$expand` | Datasource regeneration + `dataset add-field` + layout | `datasource-creator` |
| **5. New data section** | "Add a line items table" where no suitable datasource exists | Full: `schema-explorer` + `datasource-creator` + DataSet + layout | `schema-explorer` + `datasource-creator` |

### Decision Tree

```
User request
  |
  +-- Does the change involve data fields?
  |   +-- NO --> Is it positional/structural (move, swap, remove)?
  |   |   +-- YES --> Category 2 (rearrangement)
  |   |   +-- NO  --> Category 1 (label/style)
  |   |         --> Proceed to Phase 3
  |   |
  |   +-- YES --> Does the needed field exist in a report DataSet?
  |       +-- YES --> Category 3 (add column/element from existing DataSet field)
  |       |         --> Proceed to Phase 3
  |       |
  |       +-- NO --> Is the field in the datasource output? (from datasource-fields)
  |           +-- YES --> Category 4a (field in datasource, missing from DataSet)
  |           |         --> Add to DataSet, then layout
  |           |
  |           +-- NO --> Is the field reachable from the datasource's entity?
  |               |     (just missing from $select/$expand)
  |               |
  |               +-- YES --> Category 4b (datasource needs regeneration)
  |               |         --> Modify datasource --> re-upsert --> DataSet --> layout
  |               |
  |               +-- NO --> Category 5 (entirely new data requirement)
  |                         --> schema-explorer --> datasource-creator --> DataSet --> layout
```

### Present the triage result

<HARD-GATE>
Before proceeding to Phase 3, present the classification to the user and get approval. Do NOT start modifying the report without user confirmation of the plan.
</HARD-GATE>

```
### Modification Plan

**Requested change:** [user's request]
**Category:** [1-5] -- [description]

**Steps:**
1. [what will happen]
2. [what will happen]
...

**Impact:** [layout-only / DataSet change / datasource modification / new datasource]

Proceed?
```

## Phase 3: Modify

### Open in Studio for live preview

For ANY change that involves layout (Categories 1-3, or layout portions of Categories 4-5), ensure Studio is running and the report is open for live preview BEFORE making modifications.

**Auto-manage Studio** per [../shared/studio-management.md](../shared/studio-management.md): check status, start in background if needed (with readiness verification), open the report, and clean up after Phase 4.

### Category 1-2: Layout-only changes

Use CLI commands per [cli-commands.md](../shared/report-authoring/cli-commands.md):

```bash
# Change a label
dxs report set <file> ElementName --value "New Label Text"

# Change styling
dxs report set <file> ElementName --font-size 12pt --color Navy --font-weight Bold

# Move an element
dxs report move <file> ElementName --left 1in --top 2in

# Resize an element
dxs report set <file> ElementName --width 3in --height 1in

# Remove an element
dxs report remove <file> ElementName

# Batch operations (for multiple changes)
cat > /tmp/ops.json << 'OPEOF'
[
  {"action": "set", "name": "Title", "value": "New Title", "font-size": "18pt"},
  {"action": "set", "name": "SubTitle", "color": "DimGray"},
  {"action": "move", "name": "AddressBlock", "left": "0in", "top": "1.5in"},
  {"action": "remove", "name": "OldElement"}
]
OPEOF

dxs report batch <file> --ops-file /tmp/ops.json
```

**Batch limit: maximum 25 operations per call.** If you have more than 25 operations, split them into multiple batch calls. Group logically (e.g., first batch for repositioning, second for styling and new elements).

Apply [design-standards.md](../shared/report-authoring/design-standards.md) for any new or modified elements: Arial font family, official color palette, 0.25in grid alignment.

**Lines require special handling.** Lines use `StartPoint`/`EndPoint` with `start-x`/`start-y`/`end-x`/`end-y` -- NOT `left`/`top`/`width`/`height`. The `move` command does not work on lines. Edit line positions in JSON directly or use batch `set` with endpoint flags.

### Category 3: Add column from existing DataSet field

The field already exists in a DataSet -- just add the column to the table:

```bash
dxs report table add-column <file> --table <TablixName> --shrink \
  --header-cell "New Header" \
  --detail-cell '=Fields!ExistingField.Value' \
  --header-style 'font-family:Arial;font-size:10pt;font-weight:Bold;border-bottom-width:1.5pt;border-bottom-style:Solid;border-bottom-color:#5B08B2;padding:2pt;vertical-align:Bottom' \
  --detail-style 'font-family:Arial;font-size:10pt;padding:2pt;vertical-align:Middle;border-bottom-width:0.25pt;border-bottom-style:Solid;border-bottom-color:LightGray'
```

The `--shrink` flag proportionally reduces existing column widths to make room for the new column while keeping total table width unchanged.

For non-table elements (standalone textboxes), use `dxs report batch` with an `add` action to place the new field in the layout.

Apply Datex design standards for the new column -- match the styling of existing columns in the table.

### Category 4a: Field in datasource, missing from DataSet

The field is available in the datasource output but was not included in the report's DataSet definition. Add it:

```bash
dxs report dataset add-field <file> --dataset <DataSetName> --field "New.Field.Path"
```

Follow [dataset-rules.md](../shared/report-authoring/dataset-rules.md) for:
- Date annotations: append `[Date|YYYY-MM-DDTHH:mm:ss.fffffff]` to date fields
- Collection handling: collection fields cannot be added as flat DataSet fields on a single-result DataSet
- CommandText: verify the DataSet's CommandText pattern is correct for the result type

Then add the layout element (column or textbox) referencing the new field. If the report has a companion `.data.json`, update it with sample values for the new field.

### Category 4b: Datasource needs regeneration

The field exists on the OData entity but is not in the datasource's `$select` or `$expand`. The datasource config must be updated.

**For standalone OData datasources:**

1. Get the current datasource config: `dxs datasource get <ref> --branch <id>`
2. Identify the missing field path (e.g., needs `Material/Description` in `$expand`)
3. Invoke `datasource-creator` to regenerate with the updated query
4. `dxs datasource upsert` to update the branch
5. Add field to DataSet with `dxs report dataset add-field`
6. Add the layout element

**For owned OData datasources:**

1. The current config is already in the report folder (extracted during download as `ds_*.json`)
2. Invoke `datasource-creator` to regenerate with the updated query
3. Replace in folder: `dxs report datasource remove <folder> <alias>` then `dxs report datasource add <folder> --owned <new_ds.json>:<alias>`
4. Add field to DataSet with `dxs report dataset add-field`
5. Add the layout element

**For flow datasources:**

1. Check if the needed field is in one of the flow's source OData datasources
2. If yes: update the flow code to include the field in the return type, update the type definition YAML
3. If no: may need to update the source OData datasource first, then the flow code
4. Regenerate with `dxs datasource generate-flow`
5. Re-upsert (standalone) or replace in folder: `dxs report datasource remove/add` (owned)
6. Add field to DataSet + layout

### Category 5: New data section

A new section requires data from an entity or relationship not covered by any existing datasource.

1. **Gather requirements** for the new section (what data, what layout). A brief conversation usually suffices -- only invoke `requirements-gathering` if the section is complex.
2. **Invoke `schema-explorer`** to find the right OData entity and fields
3. **Invoke `datasource-creator`** to create the datasource config, then `dxs report datasource add <folder> --owned <file>:<alias>` (owned preferred, standalone if shared)
4. **Add DataSet** per [dataset-rules.md](../shared/report-authoring/dataset-rules.md) -- use the field summary from datasource-creator as the primary source for field names, include ALL fields
5. **Build layout** (rectangle container, textboxes, or tablix) using `dxs report batch`
6. **Create/update sample data** per [sample-data.md](../shared/report-authoring/sample-data.md) if needed for preview

For DataSet creation:

```bash
dxs report dataset add <file> --name ds_new_section \
  --field Id --field LookupCode --field Status \
  --field "Account.Name" \
  --field "OrderDate[Date|YYYY-MM-DDTHH:mm:ss.fffffff]"
```

For building the layout section, use a rectangle container for grouping:

```bash
cat > /tmp/new-section-ops.json << 'OPEOF'
[
  {"action": "add", "type": "rectangle", "name": "NewSectionBox",
   "left": "0in", "top": "4in", "width": "7.5in", "height": "2in"},
  {"action": "add", "type": "textbox", "name": "NewSectionTitle",
   "parent": "NewSectionBox", "left": "0in", "top": "0in",
   "width": "7.5in", "height": "0.3in",
   "value": "Section Title", "font-size": "14pt", "color": "DimGray"}
]
OPEOF

dxs report batch <file> --ops-file /tmp/new-section-ops.json
```

For tables, use `dxs report add tablix` -- see [cli-commands.md](../shared/report-authoring/cli-commands.md) for full syntax including grouping, footer rows, and sort expressions.

### Feedback iteration

After each modification, ask the user how it looks in Studio. Use `set`/`move`/`remove` for adjustments. Repeat until approved.

<HARD-GATE>
Do NOT proceed to Phase 4 (assemble/upload) until the user has confirmed the layout looks good in Studio. Ask explicitly: "How does it look in Studio? Ready to upload, or any adjustments needed?"
</HARD-GATE>

## Phase 4: Deploy & Verify

### Assemble and upload

The report folder already has everything needed — the manifest preserves all datasource bindings, parameters, and metadata from the download. No flag reconstruction needed.

```bash
# Assemble folder into wrapper JSON
dxs report assemble <folder>/ -o <reference_name>.json

# Upload wrapper to branch
dxs report upload <reference_name>.json --branch <branch_id>
```

If you added or removed datasources during Phase 3, those changes are already reflected in the manifest via `dxs report datasource add/remove`.

Follow [deploy-patterns.md](../shared/report-authoring/deploy-patterns.md) for additional upload patterns and verification.

### Verify

```bash
dxs report get <reference_name> --branch <branch_id>
```

Confirm the report is on the branch with the expected structure, datasource bindings, and parameters.

### Test parameter discovery

If the datasource has `in_params`, follow [deploy-patterns.md](../shared/report-authoring/deploy-patterns.md) to discover real test values and output them as JSON for the user to test in Studio.


## Troubleshooting

See [troubleshooting.md](../shared/report-authoring/troubleshooting.md) for common RDLX-JSON expression issues and layout/CLI mistakes.

### Editor-Specific Issues

| Mistake | Fix |
|---------|-----|
| Modifying report without downloading first | Always `dxs report download` to get the current version -- editing a stale local file loses other changes |
| Adding a field to DataSet but not updating sample data | Studio preview shows blank for the new field -- update `.data.json` with sample values |
| Assuming the datasource has the field without checking | Always run `datasource-fields` to verify -- the field may not be in the `$select` |
| Changing a field expression but not the DataSet field | If you rename a DataField path, the DataSet field must also be updated to match |
| Removing a datasource field that is still referenced | Check all expressions in the report for `Fields!RemovedField.Value` before removing |
| Adding collection-path fields as flat DataSet fields | Collection navigation properties silently resolve to blank in single-result DataSets -- use a flow datasource to flatten, or create child datasets with `CommandText: "$.ds.result.Collection.*"` |
