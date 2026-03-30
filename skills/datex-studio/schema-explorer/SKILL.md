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

- [references/batch-syntax.md](references/batch-syntax.md) — Batch command syntax, argument styles, describe-entity flags, anti-patterns
- [references/subagent-template.md](references/subagent-template.md) — Subagent delegation prompt

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

   Search results include the full qualified `entity_type` for each match (e.g., `Datex.FootPrint.Api.Warehouse`). Save these — you'll need them for `--entity-type` flags in later steps.

2. **Describe main entity and relationships** — Use `--compact --no-udf` to keep output manageable (reduces a 50,000-token entity to ~2,000 tokens). Add `--depth 2` on relationships to explore one level deeper (e.g., `Shipment → ShipmentLine → Item`) in a single call:
   ```bash
   dxs schema batch -c <id> \
     --request 'describe-entity <EntityName> --compact --no-udf' \
     --request 'describe-relationships <EntityName> --depth 2'
   ```
   Use `--compact` for initial exploration. If you need full details on specific fields later, use `--select Field1,Field2` to describe only those properties.

3. **Scan related entity fields** — For each navigation property target you plan to `$expand`, use `describe-entity --compact --no-udf` to get field names and types in minimal form (~2 tokens per field vs ~8 with `properties`). Combine multiple related entities into a single batch:
   ```bash
   dxs schema batch -c <id> \
     --request 'describe-entity RelatedEntitySet1 --compact --no-udf' \
     --request 'describe-entity RelatedEntitySet2 --compact --no-udf' \
     --request 'describe-entity RelatedEntitySet3 --compact --no-udf'
   ```
   Skip this step for related entities already covered by `describe-relationships --depth 2` in step 2 — depth-2 output includes nested nav property names and target types. Only scan entities where you need the **scalar field list** for `$select` clauses.

   **When you only have the type ID** (e.g., `Datex.FootPrint.Api.Warehouse` from relationship output) and don't know the entity set name, use `properties --entity-type Namespace.Type` instead — it accepts the full qualified type directly. Use `navigation-properties --entity-type` alongside it if you also need `$expand` paths.

   **Note:** If you need `$expand` paths for a related entity (what can be expanded *from* it), those are in its `navigation_properties` output — `describe-entity --compact` includes both scalar properties and nav properties.

4. **Resolve enum values** — When a property's type doesn't start with `Edm.`, it's an enum or complex type. For enum-typed properties (e.g., `type: Datex.FootPrint.Api.Statuses`), use `describe-enum` with that type value to get the member names and numeric values:
   ```bash
   dxs schema batch -c <id> \
     --request 'describe-enum Datex.FootPrint.Api.Statuses' \
     --request 'describe-enum Datex.FootPrint.Api.OrderTypes'
   ```
   This tells you what filter values mean (e.g., `StatusId eq 1` → "Active").

5. **Verify expansion paths** — Invoke the `odata-execution` skill to confirm nav properties return data (`$top=1` + `$expand`). Some entities have nav properties with NULL foreign keys resulting in empty expansions.

   **What to verify:**
   - Deep paths (depth >= 2, e.g., `OrderLine.Material.Description`) — higher failure risk
   - Paths through nullable foreign keys (e.g., `ShipToContact` when `ShipToContactId` is nullable)
   - Collection-through-collection expansions (e.g., `ShipmentLines($expand=OrderLine(...))`)
   - Any path you are not confident about

   **Safe to skip:** Single-level expansions to lookup entities (Status, Type, Category patterns) where the foreign key is non-nullable. These are structurally guaranteed by the schema.

   Note gaps and suggest alternate query paths (e.g., querying the related entity directly with a filter). Also test lambda operators (`any()`/`all()`) if you need to filter within expanded collections.

6. **Build field mapping table** — Compile all discovered fields into the field mapping template, separating root fields from navigation properties and expanded fields.

## Subagent Usage

Schema exploration can generate significant output. Delegate to a subagent to keep the main context clean. See [references/subagent-template.md](references/subagent-template.md) for the prompt template.

Write output to the artifact directory:
- `01-schema-exploration.md` — raw schema discovery output
- `02-field-mapping.md` — completed field mapping table

## describe-entity Flags

`describe-entity` does NOT support `--concise`. See [references/batch-syntax.md](references/batch-syntax.md) for the full display flags table (`--compact`, `--no-udf`, `-P`, `-N`, `--prop-top`, `--select`). All flags work in batch: `--request 'describe-entity Orders --compact --no-udf'`

## Additional Rules

Rules already embedded in the workflow steps above are not repeated here. See [references/batch-syntax.md](references/batch-syntax.md) for the full anti-patterns table.

- Always check the `keys:` section — some entities have composite keys (no `Id` field)
- `describe-properties` takes **one property name at a time** — not comma-separated; for bulk discovery use `describe-entity --compact --no-udf` or batch multiple calls
- **Batch eliminates the "run sequentially" constraint** — unlike parallel tool calls (which abort siblings on failure), batch handles individual request failures gracefully
