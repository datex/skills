---
name: schema-explorer
description: |
  Use when exploring OData schema with dxs schema commands: searching entities,
  describing entity structure, scanning properties, or building a field mapping
  table for Datex Studio.
---

# Schema Explorer

OData schema discovery using `dxs schema` commands.

## References

- [references/batch-syntax.md](references/batch-syntax.md) — Batch command syntax, argument styles, anti-patterns

## Input/Output Contract

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

## Workflow

1. **Search for entities** — Use `dxs schema batch -c <id> --request 'search <keyword>'` to find entity sets matching your keywords. If you can guess the entity set name from the keyword, combine the search with a describe in the same batch.

2. **Describe main entity and relationships** — Use batch commands to get the full entity structure and its relationships:
   ```bash
   dxs schema batch -c <id> \
     --request 'describe-entity <EntityName>' \
     --request 'describe-relationships <EntityName>'
   ```

3. **Scan related entity properties** — For each navigation property target type, use `properties --entity-type` to get field names quickly:
   ```bash
   dxs schema batch -c <id> \
     --request 'properties --entity-type Namespace.RelatedType1' \
     --request 'properties --entity-type Namespace.RelatedType2' \
     --request 'properties --entity-type Namespace.RelatedType3'
   ```

4. **Verify critical nav properties return data** — Run a `$top=1` OData query with the `$expand` to confirm the navigation property is actually populated, not just that it exists in the schema. Some entities have nav properties with NULL foreign keys, resulting in empty expansions:
   ```bash
   dxs odata execute -c <id> -q '<EntitySet>?$top=1&$expand=<NavProperty>($select=Id)&$select=Id'
   ```
   If the expansion returns empty results, note the gap and suggest alternate paths (e.g., querying the related entity directly with a filter).

5. **Test server-side collection filtering** — When you need to filter within expanded collections, test lambda operators (`any()`/`all()`) against the server:
   ```bash
   dxs odata execute -c <id> -q '<EntitySet>?$filter=<NavProp>/any(x: x/Status eq 1)&$top=1&$select=Id'
   ```

6. **Identify filtering/exclusion rules** — Determine which fields support filtering, which enum values map to which statuses, and any exclusion criteria needed.

7. **Build field mapping table** — Compile all discovered fields into the field mapping template, separating root fields from navigation properties and expanded fields.

## Subagent Usage

Schema exploration can generate significant output. Delegate to a subagent to keep the main context clean.

**Subagent prompt template:**

```
You are exploring an OData schema. Your job is to discover and document the entity structure.

**Input:**
- Connection ID: <connection_id>
- Search keywords: <keywords>

**Steps:**
1. Search for entities matching the keywords using `dxs schema batch`
2. Describe the main entity and its relationships
3. Scan related entity properties for needed fields
4. Build a field mapping table

**Rules:**
- Separate root fields from collection fields
- Use dot notation for expanded paths (e.g., `Status.Name`)
- Use `schema batch` to minimize round trips (2-3 batches typical)
- Verify critical nav properties return data with a `$top=1` OData query

**Artifact directory (if provided):** <artifact_dir>
- Write `01-schema-exploration.md` with raw schema discovery output
- Write `02-field-mapping.md` with the completed field mapping table

**Return:**
- Field mapping table (using the template from the Schema Explorer skill)
- Entity summary (entity set, type, keys, namespace)
- Empty nav properties with alternate paths (if any)
- Proposed `$filter` clause for common query patterns
```

## Key Rules

- Always check the `keys:` section — some entities have composite keys (no `Id` field)
- **Use `properties --entity-type` for related entities** — much faster than `describe-entity` when you only need field names
- `describe-properties` takes **one property name at a time** — not comma-separated
- `describe-entity` does NOT support `--concise`
- **Batch eliminates the "run sequentially" constraint** — unlike parallel tool calls (which abort siblings on failure), batch handles individual request failures gracefully

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Guessing entity names | Always `schema search` first |
| Making 9+ sequential schema calls | Use `schema batch` — combine into 2-3 calls |
| Using `describe-entity` for every related entity | Use `properties --entity-type` (or batch them) for quick field name scans |
