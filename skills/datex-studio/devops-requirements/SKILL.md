---
name: devops-requirements
description: |
  Use when extracting report or feature requirements from Azure DevOps work items
  using dxs devops commands: fetching work items, reviewing relations, downloading
  attachments, compiling a requirements brief.
---

# DevOps Requirements Extraction

Extract and compile actionable requirements from Azure DevOps work items into a structured requirements brief.

## Input / Output

- **Input:** Work item ID or Azure DevOps URL
- **Output:** Requirements brief (markdown — in context or saved to artifact directory)

## When to Use

This workflow applies when the user:
- Provides a work item ID or Azure DevOps URL
- Mentions building a report from a "requirement," "work item," or "ticket"
- Asks to migrate or recreate an existing report referenced in DevOps
- References an SSRS report that needs a NextGen equivalent

## Step 1: Fetch the Work Item

```bash
dxs devops workitem <ID> --full --expand All
```

`--full` prevents truncation of long fields. `--expand All` includes relations (parent, children, attachments).

**Key fields to extract:**

| Field | What it tells you |
|-------|-------------------|
| `title` | Report name and purpose |
| `description` | High-level requirements, often includes embedded screenshots of expected output |
| `design` | Detailed specs — SQL queries, column lists, business rules. This is often the richest source of field/data requirements |
| `relations.parent` | Broader project context (fetch if needed for background) |
| `relations.children` | Implementation sub-tasks — may contain additional specs |
| `relations.attachments` | Existing reports, sample output PDFs, BRDs |
| `tags` | Sprint/priority context |

The `description` and `design` fields are auto-converted from HTML to markdown. For long design fields, scan for SQL `SELECT` statements and column lists — these map directly to OData fields needed for schema discovery.

## Step 2: Review Relations

Present the work item's relations to the user:

```
This work item has:
- Parent: #218666
- Children: #218813
- Attachments: 4 files (ValleyWarehouseReceiptInvoice.rdlx-json, Order 96269-20250041 - Receiving report.pdf, ...)

Would you like me to fetch any of the child items for additional context?
```

To batch-fetch selected children:

```bash
dxs devops workitems <ID1>,<ID2> --description --discussions
```

`--description` includes full descriptions; `--discussions` includes comments/history. Up to 200 items per request.

Don't auto-traverse all children — ask the user which are relevant. Child items of type "Wavelength Component" often contain implementation details, while "Bug" or "Task" children may not be relevant to report design.

## Step 3: Validate Scope with the User

**Before downloading attachments or building a requirements brief, confirm with the user what to pay attention to.** Work items often accumulate attachments, comments, and design notes over time — some may be outdated, misattached, or for a different report entirely.

Present a summary and ask:

```
This work item has:
- Description: [1-sentence summary]
- Design field: [1-sentence summary — e.g., "SQL views for 3 datasets"]
- Attachments: [list filenames]
- Children: [list if any]

Which of these should I focus on for the report requirements?
Are any of the attachments not relevant to this report?
```

**Why this matters:** Work items may contain attachments from related but different reports, sample PDFs that don't match the current requirement, or design notes that were superseded. Using the wrong attachment as a layout reference can send the entire design down the wrong path. Always let the user confirm before treating any attachment as authoritative.

## Step 4: Download Attachments

List attachments:

```bash
dxs devops attachments <ID>
```

Download by index (faster) or filename:

```bash
dxs devops attachments <ID> --download 1 --out <artifact_dir>/requirements/report.rdlx-json
dxs devops attachments <ID> --download "Valley Cold HC BRD.pdf" --out <artifact_dir>/requirements/brd.pdf
```

**Which attachments to download** (after user confirms relevance):

| Extension | Action | Why |
|-----------|--------|-----|
| `.rdlx-json` | Download + read | Existing report — extract layout, DataSets, field mappings |
| `.rdl` | Download + read | SSRS source — extract SQL queries and field mappings for migration |
| `.pdf` | Download only | May or may not match the current report — ask user before using as layout reference |
| `.docx`, `.xlsx` | Download if BRD/spec | May contain detailed field lists or business rules |
| `.png`, `.jpg` | Skip | Usually embedded screenshots already visible in description |

For downloaded `.rdlx-json` files, use `dxs report inspect` to quickly understand the structure:

```bash
dxs report inspect <artifact_dir>/requirements/report.rdlx-json
```

For `.rdl` files (SSRS XML), scan for `<CommandText>` elements containing SQL — the `SELECT` columns and `FROM`/`JOIN` tables map to OData entities and fields.

**If PDF reading fails** (e.g., missing `poppler`): Note the files as "downloaded but unreadable" in the requirements brief and proceed with the work item's `description` and `design` fields, which usually contain the most actionable information. For `.pdf` sample output, ask the user to describe the expected layout verbally as a fallback. Always download PDFs to the artifact directory regardless — the user can review them manually.

## Step 5: Compile Requirements Brief

After gathering work item data and attachments, compile a requirements brief. This feeds into downstream skills (e.g., schema-explorer, datasource-creator, report-creator).

**Template:**

```markdown
## Requirements Brief

**Report:** [title from work item]
**Purpose:** [1-2 sentence summary from description]
**Work Item:** #[ID] ([state])

### Data Requirements
- **Primary entity:** [derived from SQL FROM clause or description]
- **Key fields:** [from SQL SELECT or design field]
- **Filters/parameters:** [from SQL WHERE or description]
- **Related entities:** [from SQL JOINs or $expand needs]

### Filtering & Exclusion Rules
- [Extract EVERY filtering rule from the design notes, SQL WHERE clauses, and business requirements]
- [For each rule, note the original SQL/description AND the proposed OData equivalent]
- [Flag rules involving collection checks (subqueries) — these likely need lambda operators: `any()`/`all()`]
- [Flag rules involving string patterns (LIKE) — these likely need `startswith`/`endswith`/`contains`]
- [Example: "Exclude -10 locations in zones 04-06" → `not (endswith(Name,'-10') and (startswith(Name,'04') or ...))` ]

### Layout Expectations
- **Page size:** [from existing report or description]
- **Orientation:** [portrait/landscape]
- **Key sections:** [header, detail grid, footer, etc.]
- **Special elements:** [barcodes, logos, multi-column layout]

### Entity Keywords for Schema Search
[List of OData entity search terms derived from SQL table names or description nouns]

### Reference Materials
- [List downloaded attachments and what each provides]
```

Save the brief to `<artifact_dir>/requirements/requirements-brief.md` if artifacts are enabled.

## Anti-patterns

- **Don't dump raw work item content into context** — summarize the description and design fields, extracting only the actionable parts (field lists, SQL, layout specs)
- **Don't auto-fetch the entire work item tree** — parent and children may be irrelevant; ask the user
- **Don't skip the design field** — it often contains the most detailed specs, including exact SQL queries that map to OData fields
- **Don't ignore existing .rdlx-json attachments** — they provide concrete field mappings and layout that accelerate schema discovery and prototyping
