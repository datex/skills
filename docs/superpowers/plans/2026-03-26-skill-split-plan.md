# Skill Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic report-creator skill into 5 focused skills with clear contracts and dependency references.

**Architecture:** Two-tier skill model — utility skills (schema-explorer, odata-execution, devops-requirements) consulted as references, and workflow skills (datasource-creator, report-creator) that produce artifacts. Utility skills are referenced via `REQUIRED BACKGROUND` directives with inlined critical rules.

**Tech Stack:** Markdown files (SKILL.md + references), git for version control

**Spec:** `docs/superpowers/specs/2026-03-26-skill-split-design.md`

**Source material:** All content comes from `skills/datex-studio/report-creator/SKILL.md` and its `references/` directory.

---

### Task 1: Create schema-explorer skill

**Files:**
- Create: `skills/datex-studio/schema-explorer/SKILL.md`
- Create: `skills/datex-studio/schema-explorer/references/batch-syntax.md`

**Content sources to read before writing:**
- `skills/datex-studio/report-creator/SKILL.md` lines 136-181 (Phase 2: Schema Discovery)
- `skills/datex-studio/report-creator/references/schema-discovery.md` (entire file)
- `skills/datex-studio/report-creator/references/common-mistakes.md` lines 6-16 (OData & Query Issues — schema rows only)

- [ ] **Step 1: Write `schema-explorer/SKILL.md`**

The SKILL.md must contain these sections in this order:

**Frontmatter:**
```yaml
---
name: schema-explorer
description: |
  Use when exploring OData schema with dxs schema commands: searching entities,
  describing entity structure, scanning properties, or building a field mapping
  table for Datex Studio.
---
```

**Body sections:**

1. **Title & purpose** — "OData schema discovery using `dxs schema` commands."

2. **References** — Link to `references/batch-syntax.md`

3. **Input/Output contract**
   - Input: Connection ID + search keywords
   - Output: `field-mapping.md` file (include the full template from the spec — the `# Schema: <EntityName>` structure with Root Fields, Navigation Properties, Expanded Fields tables, and Composite Keys section)

4. **Workflow** — Adapted from report-creator Phase 2:
   - Search for entities using `dxs schema batch`
   - Describe main entity and relationships using batch commands
   - Scan related entity properties for needed fields
   - Verify critical nav properties return data (run `$top=1` OData query to confirm — don't just trust the schema)
   - Test server-side collection filtering with lambda operators (`any()`/`all()`)
   - Identify all filtering/exclusion rules
   - Build field mapping table
   - Return: field mapping table, entity summary, empty nav properties with alternate paths, proposed `$filter` clause

5. **Subagent usage** — Include the subagent prompt template from report-creator Phase 2 (lines 142-175), but generalized: remove report-specific language, make it about "schema exploration for downstream consumption." The subagent should still write `01-schema-exploration.md` and `02-field-mapping.md` if an artifact directory is provided.

6. **Key rules** — From schema-discovery.md:
   - Always check `keys:` section for composite keys
   - Use `properties --entity-type` for related entities (faster than `describe-entity`)
   - `describe-properties` takes one property at a time
   - `describe-entity` does NOT support `--concise`
   - Batch eliminates the parallel tool call sequential constraint

7. **Common Mistakes** table — 3 rows from common-mistakes.md:
   - Guessing entity names → always `schema search` first
   - Making 9+ sequential schema calls → use `schema batch`
   - Using `describe-entity` for every related entity → use `properties --entity-type`

- [ ] **Step 2: Copy schema-discovery.md to batch-syntax.md**

```bash
cp skills/datex-studio/report-creator/references/schema-discovery.md \
   skills/datex-studio/schema-explorer/references/batch-syntax.md
```

The content stays identical — this is a straight copy (the source file will be deleted in Task 6).

- [ ] **Step 3: Verify**

Confirm:
- `schema-explorer/SKILL.md` exists with correct frontmatter `name: schema-explorer`
- `schema-explorer/references/batch-syntax.md` exists with batch command syntax
- SKILL.md links to `references/batch-syntax.md` correctly
- Field mapping template matches the spec
- No report-specific language leaked in (no mentions of "Phase 2", "report", "datasource")

- [ ] **Step 4: Commit**

```bash
git add skills/datex-studio/schema-explorer/
git commit -m "feat: create schema-explorer utility skill

Extract OData schema discovery into standalone skill with field mapping
output contract and batch syntax reference."
```

---

### Task 2: Create odata-execution skill

**Files:**
- Create: `skills/datex-studio/odata-execution/SKILL.md`
- Create: `skills/datex-studio/odata-execution/references/filter-patterns.md`

**Content sources to read before writing:**
- `skills/datex-studio/report-creator/SKILL.md` lines 266-306 (Phase 4: Query Building)
- `skills/datex-studio/report-creator/references/odata-patterns.md` (entire file)
- `skills/datex-studio/report-creator/references/common-mistakes.md` lines 6-16 (OData & Query Issues — query rows only)

- [ ] **Step 1: Write `odata-execution/SKILL.md`**

**Frontmatter:**
```yaml
---
name: odata-execution
description: |
  Use when building or testing OData queries with dxs odata execute: incremental
  query development, verifying $select/$expand/$filter clauses, or diagnosing
  query errors against a Footprint API connection.
---
```

**Body sections:**

1. **Title & purpose** — "Build, test, and verify OData queries incrementally using `dxs odata execute`."

2. **References** — Link to `references/filter-patterns.md`

3. **Input/Output contract**
   - Input: Connection ID + entity knowledge (field names, nav properties — from schema-explorer or conversation)
   - Output: Verified OData query string (in conversation context, not a file)

4. **Workflow — Incremental query building** — From report-creator Phase 4:
   - Step 1: Base entity with `$select` — `Entity?$top=1&$select=Id,Field1,Field2`
   - Step 2: Add one-to-one expands — `$expand=Account($select=Id,Name)`
   - Step 3: Add collection expands with nested expands
   - Step 4: Combine everything
   - Include the "Why incremental matters" rationale

5. **Push filtering server-side** — From report-creator Phase 4 lines 283-287. Reference `filter-patterns.md` for lambda operators, string functions, and SQL→OData mappings.

6. **Parameterized queries (key segment)** — From report-creator Phase 4 lines 289-291. `Entity(0)` placeholder, validate with `$top=1` first, 404 is expected.

7. **Critical rules** table — From report-creator Phase 4 lines 298-304:
   - `$top=1` always during testing
   - Single quotes for `-q`
   - `$select` in `$expand` required
   - Semicolons inside parentheses for nested options
   - 400 on `$select` means wrong field name
   - Composite keys — check `keys:`

8. **Common Mistakes** table — 4 rows:
   - `$expand` without `$select` → always include `$select=Field1,Field2`
   - Double quotes for `$` values → use single quotes
   - Not using `$top=1` during query testing → large queries timeout
   - Testing with `Entity(0)` and panicking at 404 → 404 is expected, validate via `$top=1` first

- [ ] **Step 2: Copy odata-patterns.md to filter-patterns.md**

```bash
cp skills/datex-studio/report-creator/references/odata-patterns.md \
   skills/datex-studio/odata-execution/references/filter-patterns.md
```

Straight copy — source deleted in Task 6.

- [ ] **Step 3: Verify**

Confirm:
- `odata-execution/SKILL.md` exists with correct frontmatter
- `odata-execution/references/filter-patterns.md` exists with lambda operators, string functions, SQL→OData
- No report-specific language (no "Phase 4", no "report")
- Critical rules table matches source

- [ ] **Step 4: Commit**

```bash
git add skills/datex-studio/odata-execution/
git commit -m "feat: create odata-execution utility skill

Extract OData query building and testing into standalone skill with
incremental build workflow and filter patterns reference."
```

---

### Task 3: Create devops-requirements skill

**Files:**
- Create: `skills/datex-studio/devops-requirements/SKILL.md`

**Content sources to read before writing:**
- `skills/datex-studio/report-creator/SKILL.md` lines 122-134 (Requirements from DevOps work item section)
- `skills/datex-studio/report-creator/references/devops-requirements.md` (entire file — this becomes the SKILL.md body)

- [ ] **Step 1: Write `devops-requirements/SKILL.md`**

**Frontmatter:**
```yaml
---
name: devops-requirements
description: |
  Use when extracting report or feature requirements from Azure DevOps work items
  using dxs devops commands: fetching work items, reviewing relations, downloading
  attachments, compiling a requirements brief.
---
```

**Body:** Take the entire content of `references/devops-requirements.md` and adapt it as the skill body. The structure is already well-organized (When to Use, Step 1-5, Anti-patterns). Changes needed:

1. Add a title: "# DevOps Requirements Extraction"
2. Add Input/Output contract:
   - Input: Work item ID or Azure DevOps URL
   - Output: Requirements brief (markdown — in context or saved to artifact directory)
3. The existing "When to Use" section becomes part of the trigger logic
4. Keep all 5 steps (Fetch, Review Relations, Validate Scope, Download Attachments, Compile Requirements Brief) exactly as they are
5. Keep the anti-patterns section
6. Generalize language: the current file says "feeds into Phase 2 schema discovery subagent and guides layout design in Phase 3" — replace with "feeds into downstream skills (e.g., schema-explorer, datasource-creator, report-creator)"

- [ ] **Step 2: Verify**

Confirm:
- `devops-requirements/SKILL.md` exists with correct frontmatter
- All 5 steps from the source are present
- Requirements brief template is included
- Attachment decision table is included
- Language is generalized (no "Phase 2", "Phase 3" references)
- Anti-patterns section is present

- [ ] **Step 3: Commit**

```bash
git add skills/datex-studio/devops-requirements/
git commit -m "feat: create devops-requirements utility skill

Extract Azure DevOps work item requirement extraction into standalone
skill with requirements brief template and attachment handling."
```

---

### Task 4: Create datasource-creator skill

**Files:**
- Create: `skills/datex-studio/datasource-creator/SKILL.md`
- Create: `skills/datex-studio/datasource-creator/references/parameter-strategies.md`

**Content sources to read before writing:**
- `skills/datex-studio/report-creator/SKILL.md` lines 308-344 (Phase 5: Datasource Upsert)
- `skills/datex-studio/report-creator/references/datasource-commands.md` (entire file)
- `skills/datex-studio/report-creator/references/common-mistakes.md` lines 17-28 (Datasource Issues)
- `skills/datex-studio/report-creator/references/common-mistakes.md` line 9 (`--api-setting-name` row)
- The project's `CLAUDE.md` datasource sections (for generate, generate-flow, owned, flow datasource details)

- [ ] **Step 1: Write `datasource-creator/SKILL.md`**

**Frontmatter:**
```yaml
---
name: datasource-creator
description: |
  Use when creating Datex Studio datasources with dxs datasource commands:
  generating OData or flow datasource configs, validating configs against a
  branch, or upserting standalone datasources.
---
```

**Body sections:**

1. **Title & purpose** — "Create OData or flow-based datasource configurations for Datex Studio."

2. **References** — Link to `references/parameter-strategies.md`

3. **Dependencies (REQUIRED BACKGROUND):**
   ```markdown
   **REQUIRED BACKGROUND:** Read the `schema-explorer` skill for OData entity discovery
   and the `odata-execution` skill for query building and verification.
   ```

4. **Input/Output contract**
   - Input: Connection ID, Branch ID, Mode (standalone/owned), Datasource type (OData/Flow)
   - Output: JSON config file. Standalone also upserts + verifies + finds test data. Owned just returns file path + ref name.
   - Include the steps-by-mode table from the spec

5. **Workflow** — Include the ASCII flow diagram from the spec showing:
   - Determine type (OData vs Flow)
   - OData path: schema → query → generate
   - Flow path: type-def YAML → TS code → generate-flow
   - Common path: context → validate
   - Branch: standalone (upsert/fields/test data) vs owned (return file)

6. **OData datasource generation** — From report-creator Phase 5:
   - `dxs datasource generate` command with all flags
   - From CLAUDE.md: `--param-keys`, `--detect-params`, `--dynamic-filter`, `--dynamic-orderby`, `--param-filter`, `--linked`, `--linked-param`, `--custom-column`, `--private`, `--query-file`

7. **Flow datasource generation** — From CLAUDE.md:
   - `dxs datasource generate-flow` command with all flags
   - Type definition YAML format
   - Required: at least one flow method + type-def
   - 512 KB file size limit

8. **Context command** — `dxs datasource context <file.json> --branch <id>` for both types

9. **Validation** — `dxs datasource validate <file.json> --branch <id>` for both modes

10. **Standalone completion** — upsert, datasource-fields verification, test data discovery (from datasource-commands.md "Discover Test Data" section)

11. **Naming convention (CRITICAL)** — From report-creator Phase 5 lines 321-329:
    - Reference name (`-r`), title (`-t`), DataSet name, and alias must ALL be identical
    - Reference naming rules: `ds_` prefix, valid JS identifiers, no hyphens

12. **Key rules (inlined from dependencies):**
    - From schema-explorer: use `schema batch`, check composite keys
    - From odata-execution: `$top=1` for testing, single quotes for `$`, `$select` in `$expand`

13. **Common Mistakes** table — 9 rows:
    - Using manager connection name as `--api-setting-name` → use app-level `name` from `branch settings`
    - `{Param}` instead of `${$datasource.inParams.Param}` → `--detect-params` requires template literal syntax
    - Using only `--dynamic-filter` for required params → use `--detect-params` with template literals
    - Not verifying `in_params` after upsert → always run `datasource-fields`
    - Assuming inParam name is `id` → check `datasource-fields` output
    - Datasource `-t` title differs from `-r` reference name → must be identical
    - Linked target doesn't exist → create targets first
    - `mergeByValue` on `oneToOne` → only `oneToOneWithMerge` gets 4th component
    - Hardcoded dates in filter → use `${new Date(...).toISOString()}`

- [ ] **Step 2: Copy datasource-commands.md to parameter-strategies.md**

```bash
cp skills/datex-studio/report-creator/references/datasource-commands.md \
   skills/datex-studio/datasource-creator/references/parameter-strategies.md
```

Straight copy — source deleted in Task 6.

- [ ] **Step 3: Verify**

Confirm:
- `datasource-creator/SKILL.md` exists with correct frontmatter
- `datasource-creator/references/parameter-strategies.md` exists
- Both OData and Flow datasource types are documented
- Standalone vs owned workflow is clearly branched
- Context and validate commands are documented for both modes
- REQUIRED BACKGROUND references point to `schema-explorer` and `odata-execution`
- Naming convention section is present and marked CRITICAL
- Common mistakes table has 9 rows
- No report-specific language (no "Phase 5")

- [ ] **Step 4: Commit**

```bash
git add skills/datex-studio/datasource-creator/
git commit -m "feat: create datasource-creator workflow skill

Extract datasource generation into standalone skill with OData/flow
types, standalone/owned modes, and parameter strategies reference."
```

---

### Task 5: Rewrite report-creator SKILL.md

**Files:**
- Modify: `skills/datex-studio/report-creator/SKILL.md`

**Content sources:**
- Current `skills/datex-studio/report-creator/SKILL.md` (read the whole file)
- `skills/datex-studio/report-creator/references/common-mistakes.md` lines 30-65 (RDLX-JSON + Layout sections)

- [ ] **Step 1: Read the current report-creator SKILL.md**

Read the full file to understand what stays and what gets replaced with REQUIRED BACKGROUND references.

- [ ] **Step 2: Rewrite SKILL.md**

**Frontmatter — update description:**
```yaml
---
name: report-creator
description: |
  Use when building or modifying Datex Studio reports with dxs report commands:
  RDLX-JSON authoring, layout prototyping in Studio, report upload,
  SSRS-to-NextGen migration.
---
```

**Key changes to the body:**

1. **Update the intro paragraph** — Remove "OData schema discovery, datasource creation" from the description. Focus on RDLX-JSON authoring and deployment.

2. **Update References section** — Remove links to:
   - `references/schema-discovery.md` (moved to schema-explorer)
   - `references/odata-patterns.md` (moved to odata-execution)
   - `references/datasource-commands.md` (moved to datasource-creator)
   - `references/devops-requirements.md` (moved to devops-requirements)
   - `references/common-mistakes.md` (split across skills)

   Keep links to:
   - `references/json-structure.md`
   - `references/design-patterns.md`
   - `references/cli-commands.md`
   - `references/sample-data.md`
   - `references/ssrs-migration.md`

3. **Add Dependencies section** after References:
   ```markdown
   ## Dependencies

   **REQUIRED BACKGROUND:** Before building a report, you will need:
   - `datasource-creator` — to create datasource config(s) for the report
   - `schema-explorer` — for test data discovery (finding real `in_params` values)
   - `odata-execution` — for querying real data to provide test parameters
   - `devops-requirements` — when building from a DevOps work item (optional)
   ```

4. **Update Workflow section** — The 7-phase list becomes:
   - Phase 1: Setup (keep as-is)
   - Phase 2: **Replace** entire Schema Discovery section with:
     ```markdown
     ## Phase 2: Schema Discovery + Datasource Creation

     **REQUIRED BACKGROUND:** Use the `datasource-creator` skill for this phase.
     It will invoke `schema-explorer` and `odata-execution` as needed.

     For each datasource the report needs:
     1. Invoke datasource-creator with mode = `owned` (preferred) or `standalone`
     2. Datasource-creator handles schema discovery, query building, generation, and validation
     3. Collect the JSON config file path and reference name

     Repeat for each datasource needed by the report.
     ```
   - Phase 3: Layout Prototype (keep as-is)
   - Phase 4: Query Building — **Remove entirely** (moved to odata-execution, invoked by datasource-creator)
   - Phase 5: Datasource Upsert — **Remove entirely** (moved to datasource-creator)
   - Phase 6: Report Finalization (keep as-is, renumber)
   - Phase 7: Deploy & Verify (keep as-is, renumber)

5. **Phase 1 changes:**
   - Remove the "Requirements from DevOps work item" section (lines 122-134). Replace with:
     ```markdown
     ### Requirements from DevOps work item (optional)

     If the user references a DevOps work item, **REQUIRED BACKGROUND:** use the
     `devops-requirements` skill to extract requirements before proceeding.
     ```
   - Remove the SSRS migration mention from Phase 1 (it stays in references/ssrs-migration.md, referenced from Phase 6 or the references list)

6. **Add Troubleshooting / Common Mistakes section** at the end with the RDLX-JSON + Layout mistakes (26 rows total from common-mistakes.md lines 30-65). Format as two tables: "RDLX-JSON & Expression Issues" and "Layout & CLI Issues".

7. **Renumber phases** — After removing Phases 4 and 5, the final phase list is:
   - Phase 1: Setup
   - Phase 2: Schema Discovery + Datasource Creation (REQUIRED BACKGROUND: datasource-creator)
   - Phase 3: Layout Prototype
   - Phase 4: Report Finalization (was Phase 6)
   - Phase 5: Deploy & Verify (was Phase 7)

- [ ] **Step 3: Verify**

Confirm:
- Frontmatter description no longer mentions schema, datasource, OData
- References section only links to the 5 retained reference files
- Dependencies section lists all 4 dependency skills
- Phase 2 delegates to datasource-creator (no inline schema/OData content)
- Phase 4 (Query Building) content is gone
- Phase 5 (Datasource Upsert) content is gone
- DevOps requirements section delegates to devops-requirements skill
- Common mistakes has RDLX-JSON + Layout rows only (no schema/OData/datasource rows)
- All internal cross-references still work (e.g., links to references/)

- [ ] **Step 4: Commit**

```bash
git add skills/datex-studio/report-creator/SKILL.md
git commit -m "refactor: slim report-creator to focus on RDLX-JSON authoring

Remove schema discovery, OData query building, datasource creation, and
DevOps requirements extraction. These are now separate skills referenced
via REQUIRED BACKGROUND directives."
```

---

### Task 6: Delete moved source files from report-creator

**Files:**
- Delete: `skills/datex-studio/report-creator/references/schema-discovery.md`
- Delete: `skills/datex-studio/report-creator/references/odata-patterns.md`
- Delete: `skills/datex-studio/report-creator/references/datasource-commands.md`
- Delete: `skills/datex-studio/report-creator/references/devops-requirements.md`
- Delete: `skills/datex-studio/report-creator/references/common-mistakes.md`

**Prerequisite:** Tasks 1-5 must be complete (content has been migrated to new skills).

- [ ] **Step 1: Delete the migrated files**

```bash
cd skills/datex-studio/report-creator/references/
git rm schema-discovery.md odata-patterns.md datasource-commands.md devops-requirements.md common-mistakes.md
```

- [ ] **Step 2: Verify remaining references/**

```bash
ls skills/datex-studio/report-creator/references/
```

Expected remaining files:
- `json-structure.md`
- `design-patterns.md`
- `cli-commands.md`
- `sample-data.md`
- `ssrs-migration.md`

- [ ] **Step 3: Verify no broken links in report-creator SKILL.md**

Grep for any remaining references to deleted files:

```bash
grep -E "schema-discovery|odata-patterns|datasource-commands|devops-requirements|common-mistakes" \
  skills/datex-studio/report-creator/SKILL.md
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove migrated reference files from report-creator

These files have been moved to their respective skills:
- schema-discovery.md -> schema-explorer/references/batch-syntax.md
- odata-patterns.md -> odata-execution/references/filter-patterns.md
- datasource-commands.md -> datasource-creator/references/parameter-strategies.md
- devops-requirements.md -> devops-requirements/SKILL.md
- common-mistakes.md -> split across all skills"
```

---

### Task 7: Delete user-level dxs-report-builder skill

**Files:**
- Delete: `~/.claude/skills/dxs-report-builder/skill.md`
- Delete: `~/.claude/skills/dxs-report-builder/` (directory)

- [ ] **Step 1: Delete the user-level skill**

```bash
rm -rf ~/.claude/skills/dxs-report-builder/
```

- [ ] **Step 2: Verify**

```bash
ls ~/.claude/skills/
```

Expected: `dxs-report-builder/` no longer listed. Other skills (like `second-opinion/`) should still be present.

- [ ] **Step 3: Commit** (if this directory is tracked — it may not be in a git repo)

The `~/.claude/skills/` directory is user-level and likely not in a git repo. No commit needed — just the deletion.
