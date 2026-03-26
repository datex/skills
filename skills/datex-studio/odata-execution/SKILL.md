---
name: odata-execution
description: |
  Use when building or testing OData queries with dxs odata execute: incremental
  query development, verifying $select/$expand/$filter clauses, or diagnosing
  query errors against a Footprint API connection.
---

# OData Execution

Build, test, and verify OData queries incrementally using `dxs odata execute`.

## References

- [references/filter-patterns.md](references/filter-patterns.md) — Lambda operators, string functions, SQL-to-OData mappings

## Input/Output Contract

**Input:** Connection ID + entity knowledge (field names, navigation properties — from schema-explorer or conversation context)

**Output:** Verified OData query string (in conversation context, not a file)

## Workflow — Incremental Query Building

Build queries one layer at a time. Large queries timeout, and adding one expand at a time isolates problems. A 400 on `$select` means the field name is wrong — check `schema properties`, don't drop `$select`.

### Step 1: Base entity with `$select`

Start with the root entity and only its scalar fields:

```bash
dxs odata execute -c <id> -q 'Entity?$top=1&$select=Id,Field1,Field2'
```

### Step 2: Add one-to-one expands

Add navigation properties that return a single related entity:

```bash
dxs odata execute -c <id> -q 'Entity?$top=1&$select=Id,Field1&$expand=Account($select=Id,Name),Status($select=Id,Name)'
```

### Step 3: Add collection expands with nested expands

Add navigation properties that return collections, including any nested expansions:

```bash
dxs odata execute -c <id> -q 'Entity?$top=1&$select=Id,Field1&$expand=Lines($select=Id,LineNumber;$expand=OrderLine($select=OrderId;$expand=Material($select=Id,Name)))'
```

### Step 4: Combine everything into the full query

Merge all verified layers into the final query. Only at this point should you remove `$top=1` (if appropriate for the use case).

## Push Filtering Server-Side

Before accepting client-side filtering, verify whether the logic can be expressed in `$filter`. OData supports lambda operators for collection filtering, string functions, and nested `$filter` in `$expand`. See [references/filter-patterns.md](references/filter-patterns.md) for the full pattern library.

## Parameterized Queries (Key Segment)

For single-entity queries, use key segment syntax: `Entity(0)`. The `0` is a placeholder. Validate query structure with `Entity?$top=1` first, then switch to `Entity(0)`.

`Entity(0)` returns 404 — this is expected (no entity with ID 0). Don't waste time re-testing.

```bash
# First: validate structure
dxs odata execute -c <id> -q 'Entity?$top=1&$select=Id,Field1&$expand=Status($select=Id,Name)'

# Then: switch to key segment
dxs odata execute -c <id> -q 'Entity(0)?$select=Id,Field1&$expand=Status($select=Id,Name)'
```

## Critical Rules

| Rule | Detail |
|------|--------|
| `$top=1` always | Use during testing to avoid timeouts |
| Single quotes | Always use `'...'` for `-q` (prevents `$` shell expansion) |
| `$select` in `$expand` | Required on every expand clause |
| Nested option separator | Semicolons (`;`) inside parentheses, not `&` |
| 400 on `$select` | Field name is wrong — check `schema properties`, don't drop `$select` |
| Composite keys | Check `keys:` — some entities have no `Id` field |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `$expand` without `$select` | Always include `$select=Field1,Field2` |
| Double quotes for `$` values | Use single quotes — shell expands `$` in double quotes |
| Not using `$top=1` during query testing | Large queries timeout — always limit during development |
| Testing with `Entity(0)` and panicking at 404 | 404 is expected — validate structure via `$top=1` first |
