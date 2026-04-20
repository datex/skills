---
name: impact-analysis
description: |
  Use before modifying a config's contract (input/output parameters) or removing
  a config from a branch. Runs reverse-trace to find all callers, categorizes
  them, and presents a safety gate. Generic — works for any config type
  (functions, datasources, flows, reports, etc.).
---

# Impact Analysis

Assess the impact of modifying or removing a configuration on a Datex Studio branch. This skill analyzes dependencies only — it does not make changes.

## When to Use

- Before modifying input/output parameters of any config
- Before removing a config from a branch
- When a calling skill (e.g., `function-creator`, `datasource-creator`) needs to verify that a contract change is safe

## Workflow

### Step 1: Find callers

```bash
dxs source explore reverse-trace <reference_name> --branch <branch_id>
```

This returns all configs that reference the target. Use `--type <type>` to speed up lookup if the config type is known (e.g., `--type flow`, `--type datasource`).

### Step 2: Interpret results

Categorize referencing configs by type:
- **Flows / Functions** — call the target via `$flows.*`
- **Datasources** — reference via `$datasources.*`
- **Forms / Grids / Editors** — UI components that bind to the target
- **Reports** — reference via `$reports.*`

### Step 3: Decision gate

- **No callers found** — safe to proceed. Inform the calling skill/user.
- **Callers exist** — present the full list to the user with:
  - Each caller's reference name and type
  - What would break (e.g., "these 3 flows call fn_sum with 2 args — changing to 3 args will break them")
  - Ask for explicit confirmation before proceeding

### Step 4: Return to caller

Report the decision back to the calling skill:
- **Safe** — no callers, proceed with changes
- **Approved** — callers exist but user approved; the calling skill must update all affected callers as part of the change
- **Rejected** — user decided not to proceed

## Additional Commands

| Command | When to use |
|---------|------------|
| `dxs source explore trace <name> --branch <id>` | Understand what the target depends on (forward dependencies) |
| `dxs source explore graph <name> --branch <id>` | Visualize the full dependency chain (both directions) |

## Scope Boundaries

- This skill **analyzes only** — it never modifies configs
- The calling skill is responsible for updating affected callers
- Reference name changes are not covered — they require delete + recreate and should be flagged to the user as a manual operation
