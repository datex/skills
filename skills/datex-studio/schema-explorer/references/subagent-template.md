# Schema Explorer Subagent Template

Copy this prompt when delegating schema exploration to a subagent:

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
- Always use `--compact --no-udf` on `describe-entity` to keep output manageable
- Use `--depth 2` on `describe-relationships` to explore nested relationships
- `--entity-type` requires full qualified type ID (e.g., `Datex.FootPrint.Api.Warehouse`), NOT entity set name — get it from `search` output's `entity_type` field
- For related entities, prefer `describe-entity <EntitySet> --compact --no-udf` (returns both scalar and nav properties). When you only have the type ID from relationship output (not the entity set name), use `properties --entity-type Namespace.Type` + `navigation-properties --entity-type` as fallback
- When a property type doesn't start with `Edm.`, use `describe-enum <type>` to get enum member values
- Verify critical nav properties return data with a `$top=1` OData query

**Artifact directory (if provided):** <artifact_dir>
- Write `01-schema-exploration.md` with raw schema discovery output
- Write `02-field-mapping.md` with the completed field mapping table

**Caller hints (optional):** <caller_hints_placeholder>
If provided, tailor the output focus:
- "datasource query building" → prioritize exact field names for $select/$expand, key fields, in_params candidates
- "report field mapping" → include human-readable context, relationship tree, layout-relevant notes
- "general exploration" → full field mapping with all columns
If no hints provided, produce the full field mapping with all columns.
</caller_hints_placeholder>

**Return:**
- Field mapping table (using the template from the Schema Explorer skill)
- Entity summary (entity set, type, keys, namespace)
- Empty nav properties with alternate paths (if any)
- Proposed `$filter` clause for common query patterns
```
