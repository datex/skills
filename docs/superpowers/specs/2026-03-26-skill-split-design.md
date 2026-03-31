# Skill Split Design: Report Creator into Focused Skills

## Summary

Split the monolithic `report-creator` skill into 5 focused skills in `skills/datex-studio/`. Two tiers: **utility skills** (consulted as reference material, also usable standalone) and **workflow skills** (produce artifacts, consume utility guidance).

## Architecture

### Two-tier model

| Tier | Skills | Behavior |
|------|--------|----------|
| **Utility** | `schema-explorer`, `odata-execution`, `devops-requirements` | Standalone-capable. Consulted by workflow skills via `REQUIRED BACKGROUND` references with inlined critical rules. Not entered via handoff chains. |
| **Workflow** | `datasource-creator`, `report-creator` | Produce artifacts (JSON configs, RDLX-JSON files). Inline key rules from utility dependencies. |

### Why not handoff chains

The superpowers-style linear chain (`A -> B -> C -> D`) doesn't fit this domain because:
- A report can have multiple datasources, each needing its own schema + query cycle
- Schema and OData are cross-cutting utilities used at multiple points by multiple skills
- The workflow is a loop (iterate per datasource), not a pipeline

Utility skills are **consulted repeatedly**, not "entered and exited."

### Dependency graph

```
                   schema-explorer (utility)
                  /        |         \
                 /         |          \
datasource-creator    report-creator   (standalone use)
                 \         |          /
                  \        |         /
                   odata-execution (utility)

devops-requirements (utility) ---> report-creator (and anything else)
```

### How utility skills are referenced

Each workflow skill inlines the critical rules from its utility dependencies and adds a `REQUIRED BACKGROUND` pointer. **"REQUIRED BACKGROUND" means:** the agent should invoke the referenced skill via the Skill tool to load its full guidance before proceeding with that phase of work. The inlined rules serve as a quick reminder — the full skill has the detailed reference material.

```markdown
## Schema Discovery

**REQUIRED BACKGROUND:** Read the `schema-explorer` skill for batch syntax and anti-patterns.

### Key rules (inlined)
- Use `schema batch` to combine 2-3 calls instead of 9+ sequential calls
- Use `properties --entity-type` for related entities (faster than `describe-entity`)
- Always check `keys:` for composite keys
```

## Directory Structure

```
skills/datex-studio/
├── schema-explorer/              # Utility skill
│   ├── SKILL.md
│   └── references/
│       └── batch-syntax.md       # Batch command syntax, argument styles, anti-patterns
│
├── odata-execution/              # Utility skill
│   ├── SKILL.md
│   └── references/
│       └── filter-patterns.md    # Lambda operators, string functions, SQL->OData mappings
│
├── devops-requirements/          # Utility skill
│   └── SKILL.md                  # Work item fetching, attachment handling, requirements brief
│
├── datasource-creator/           # Workflow skill
│   ├── SKILL.md
│   └── references/
│       └── parameter-strategies.md  # detect-params, linked DS, quoting, cascading params
│
└── report-creator/               # Workflow skill (slimmed down)
    ├── SKILL.md
    └── references/
        ├── json-structure.md      # RDLX-JSON document template, element formats, expressions
        ├── design-patterns.md     # Coordinate system, layout patterns (label, BOL, tabular), sizing
        ├── cli-commands.md        # dxs report batch/add tablix/add image/set/move/remove syntax
        ├── sample-data.md         # .data.json companion files for Studio preview
        └── ssrs-migration.md      # SSRS .rdl -> NextGen RDLX-JSON conversion guide
```

## Skill Definitions

### 1. schema-explorer (Utility)

**Trigger description:**
```
Use when exploring OData schema with dxs schema commands: searching entities,
describing entity structure, scanning properties, or building a field mapping
table for Datex Studio.
```

**Input:** Connection ID + search keywords

**Output:** `field-mapping.md` file with this structure:
```markdown
# Schema: <EntityName>

## Connection
- Connection ID: <id>
- Namespace: <namespace>

## Primary Entity
- Entity Set: <name>
- Entity Type: <namespace.type>
- Keys: <key fields and types>

## Fields

### Root Fields
| Field | Type | Notes |
|-------|------|-------|

### Navigation Properties
| Nav Property | Target Type | Cardinality | Key Fields |
|-------------|-------------|-------------|------------|

### Expanded Fields (via $expand)
| Path | Type | Source Entity |
|------|------|---------------|

## Composite Keys / Special Notes
```

**Content sources (from current report-creator):**
- SKILL.md Phase 2 (Schema Discovery + Field Mapping) — subagent prompt, batch strategy
- `references/schema-discovery.md` (entire file) -> `references/batch-syntax.md`
- `common-mistakes.md` "OData & Query Issues" rows related to schema (guessing entity names, sequential schema calls)

**Common mistakes (inlined):**
- Guessing entity names -> always `schema search` first
- Making 9+ sequential schema calls -> use `schema batch`
- Using `describe-entity` for every related entity -> use `properties --entity-type`

### 2. odata-execution (Utility)

**Trigger description:**
```
Use when building or testing OData queries with dxs odata execute: incremental
query development, verifying $select/$expand/$filter clauses, or diagnosing
query errors against a Footprint API connection.
```

**Input:** Connection ID + entity knowledge (from schema-explorer or conversation context)

**Output:** Verified OData query string (in conversation context, not a file)

**Content sources (from current report-creator):**
- SKILL.md Phase 4 (Query Building) — incremental build, parameterized queries, critical rules, push filtering server-side
- `references/odata-patterns.md` (entire file) -> `references/filter-patterns.md`
- `common-mistakes.md` "OData & Query Issues" rows related to queries ($expand without $select, double quotes, $top=1, Entity(0) 404)

**Common mistakes (inlined):**
- `$expand` without `$select` -> always include `$select=Field1,Field2`
- Double quotes for `$` values -> use single quotes
- Not using `$top=1` during testing -> large queries timeout
- Testing with `Entity(0)` and panicking at 404 -> 404 is expected, validate via `$top=1` first

### 3. devops-requirements (Utility)

**Trigger description:**
```
Use when extracting report or feature requirements from Azure DevOps work items
using dxs devops commands: fetching work items, reviewing relations, downloading
attachments, compiling a requirements brief.
```

**Input:** Work item ID or Azure DevOps URL

**Output:** Requirements brief (markdown, in context or saved to artifact directory)

**Content sources (from current report-creator):**
- SKILL.md Phase 1 "Requirements from DevOps work item" section
- `references/devops-requirements.md` (entire file) -> becomes the SKILL.md body

### 4. datasource-creator (Workflow)

**Trigger description:**
```
Use when creating Datex Studio datasources with dxs datasource commands:
generating OData or flow datasource configs, validating configs against a
branch, or upserting standalone datasources.
```

**Input:**
- Connection ID (required)
- Branch ID (required for validation and upsert)
- Mode: `standalone` or `owned` (must be established upfront)
- Datasource type: `OData` or `Flow`

**Output:**
- JSON config file (from `dxs datasource generate` or `generate-flow`)
- Standalone mode: also upserts to branch, verifies fields, discovers test data
- Owned mode: returns JSON file path + reference name (no upsert)

**Two datasource types:**

| Type | Generator | Input |
|------|-----------|-------|
| OData | `dxs datasource generate` | OData query + connection + api-setting-name |
| Flow | `dxs datasource generate-flow` | TypeScript code files + type-def YAML |

**Workflow:**
```
[determine type: OData or Flow]
        |
  +-----+-----+
  |            |
 OData       Flow
  |            |
 schema ->   write type-def YAML
 query ->    write flow TS code
 generate    generate-flow
  |            |
  +-----+------+
        |
  context (dxs datasource context - get type defs for expressions/code)
  validate (dxs datasource validate - against branch, BOTH modes)
        |
  +-----+-----+
  |            |
Standalone   Owned
  |            |
 upsert      return JSON file path
 fields       + ref name
 test data
 return ref
```

**Steps by mode:**

| Step | Standalone | Owned |
|------|-----------|-------|
| `dxs datasource generate` / `generate-flow` | Yes | Yes |
| `dxs datasource context` (type defs) | Yes | Yes |
| `dxs datasource validate` (against branch) | Yes | Yes |
| `dxs datasource upsert` (to branch) | Yes | No |
| `datasource-fields` (post-upsert verification) | Yes | No (deferred to after report upload) |
| Test data / `in_params` discovery | Yes | No (report-creator handles) |

**Content sources (from current report-creator):**
- SKILL.md Phase 5 (Datasource Upsert) — naming convention, parameter strategy, detect-params
- `references/datasource-commands.md` (entire file) -> `references/parameter-strategies.md`
- `common-mistakes.md` "Datasource Issues" rows (all 8 rows)
- CLAUDE.md datasource sections (generate, generate-flow, owned, param-filter, linked-param, flow datasources)

**Dependencies (REQUIRED BACKGROUND):**
- `schema-explorer` — for OData datasource entity discovery
- `odata-execution` — for query building and verification

**Naming convention (CRITICAL, inlined):**
The datasource reference name (`-r`), display title (`-t`), RDLX-JSON DataSet name, and `--owned`/`--use-datasource` alias must ALL be identical.

### 5. report-creator (Workflow, slimmed)

**Trigger description:**
```
Use when building or modifying Datex Studio reports with dxs report commands:
RDLX-JSON authoring, layout prototyping in Studio, report upload,
SSRS-to-NextGen migration.
```

**Input:**
- Branch ID
- Datasource JSON config file(s) (from datasource-creator)
- Field mapping table (from schema-explorer, via datasource-creator)

**Output:**
- `.rdlx-json` report file
- Uploaded to branch via `dxs report upload`
- Test parameters for user testing

**Phases retained:**
- Phase 1: Setup (branch, connection, artifact directory)
- Phase 3: Layout Prototype (dxs report create + batch + Studio live preview)
- Phase 6: Report Finalization (DataSet verification, expressions, validate)
- Phase 7: Deploy & Verify (upload, preview, test parameters)

**Phases removed (moved to other skills):**
- Phase 2: Schema Discovery -> `schema-explorer`
- Phase 4: Query Building -> `odata-execution`
- Phase 5: Datasource Upsert -> `datasource-creator`

**Dependencies (REQUIRED BACKGROUND):**
- `datasource-creator` — invoked N times (once per datasource the report needs)
- `schema-explorer` — for test data discovery at the end
- `odata-execution` — for finding real data to provide test `in_params`
- `devops-requirements` — when building from a DevOps work item

**References retained:**
- `json-structure.md` — RDLX-JSON document template, element formats, expressions
- `design-patterns.md` — Coordinate system, layout patterns, element sizing
- `cli-commands.md` — dxs report batch/add/set/move/remove syntax
- `sample-data.md` — .data.json companion files for Studio preview
- `ssrs-migration.md` — SSRS .rdl -> NextGen conversion guide

## Content Migration Map

### Files that move

| Source | Destination |
|--------|------------|
| `report-creator/references/schema-discovery.md` | `schema-explorer/references/batch-syntax.md` |
| `report-creator/references/odata-patterns.md` | `odata-execution/references/filter-patterns.md` |
| `report-creator/references/datasource-commands.md` | `datasource-creator/references/parameter-strategies.md` |
| `report-creator/references/devops-requirements.md` | `devops-requirements/SKILL.md` (becomes skill body) |

### Files that get deleted

| File | Reason |
|------|--------|
| `report-creator/references/common-mistakes.md` | Split across all 5 skills (inlined in each) |
| `~/.claude/skills/dxs-report-builder/` | User-level skill replaced by project-level skills |

### Files that stay in report-creator

| File | Content |
|------|---------|
| `references/json-structure.md` | RDLX-JSON document template, element formats, expression quick reference |
| `references/design-patterns.md` | Coordinate system, layout patterns (shipping label, GS1, BOL, tabular), element sizing |
| `references/cli-commands.md` | dxs report batch/add tablix/add image/set/move/remove/dataset syntax |
| `references/sample-data.md` | .data.json companion files for Studio live preview |
| `references/ssrs-migration.md` | SSRS .rdl -> NextGen RDLX-JSON conversion guide |

### Common mistakes distribution

| Current section | New home |
|-----------------|----------|
| "OData & Query Issues" - schema rows (guessing entity names, sequential calls) | `schema-explorer/SKILL.md` |
| "OData & Query Issues" - query rows ($expand/$select, quotes, $top=1, 404) | `odata-execution/SKILL.md` |
| "OData & Query Issues" - `--api-setting-name` row | `datasource-creator/SKILL.md` (datasource concern, not query) |
| "Datasource Issues" (all 8 rows) | `datasource-creator/SKILL.md` |
| "RDLX-JSON & Expression Issues" (all 12 rows) | `report-creator/SKILL.md` |
| "Layout & CLI Issues" (all 14 rows) | `report-creator/SKILL.md` |

## SKILL.md Sections (per skill)

Each SKILL.md follows this structure:

```markdown
---
name: <skill-name>
description: <trigger description>
---

# <Skill Name>

<One-line purpose>

## References
- [references/file.md](references/file.md) -- description

## Prerequisites / REQUIRED BACKGROUND
(for workflow skills only)

## Workflow
<steps, flow diagram>

## Commands
<dxs CLI commands used>

## Key Rules
<critical rules, inlined from dependencies where needed>

## Common Mistakes
<domain-specific mistakes table>
```
