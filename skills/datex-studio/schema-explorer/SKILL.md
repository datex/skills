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
| Path | Type | Source Entity | Binding |
|------|------|---------------|---------|

Mark the **Binding** column:
- `flat` — field is reachable through single navigation properties; safe for flat DataSet fields
- `⚠ collection` — path crosses a collection navigation property (1:N cardinality); requires flow datasource flattening or child dataset with `CommandText` deep path. Will silently render blank if added as a flat DataSet field.

## Composite Keys / Special Notes
```

## Command Selection Rule

**Single request → use the direct command. Multiple independent requests → combine into ONE batch.**

- If you only need one operation (e.g., one search, one describe), use the direct command — don't wrap it in `dxs schema batch` with a single `--request`.
- If you need 2+ independent operations, combine ALL of them into a single `dxs schema batch` call. Don't split independent requests across multiple batch calls — each call is a separate HTTP roundtrip.
- Only split into a second call when results from the first call determine what to query next.

## Workflow

1. **Search for entities** — Combine ALL keyword searches into one batch:
   ```bash
   dxs schema batch -c <id> \
     --request 'search shipment' \
     --request 'search order' \
     --request 'search warehouse' \
     --request 'search carrier'
   ```
   If you can guess entity set names, combine searches with describes in the same batch. Search results include the full qualified `entity_type` (e.g., `Datex.FootPrint.Api.Warehouse`) — save these for `--entity-type` flags in later steps.

   For a single keyword, use the direct command: `dxs schema search "keyword" -c <id>`.

2. **Describe entities and relationships** — Combine ALL entity descriptions and relationship exploration into one batch. Use `--compact --no-udf` on describe-entity and `--depth 2` on relationships:
   ```bash
   dxs schema batch -c <id> \
     --request 'describe-entity Shipments --compact --no-udf' \
     --request 'describe-relationships Shipments --depth 2' \
     --request 'describe-entity Orders --compact --no-udf' \
     --request 'describe-relationships Orders --depth 2' \
     --request 'describe-entity ShipmentLines --compact --no-udf' \
     --request 'describe-relationships ShipmentLines --depth 2'
   ```
   Use `--compact` for initial exploration. If you need full details on specific fields later, use `--select Field1,Field2` to describe only those properties.

3. **Scan related entity fields** — Combine ALL related entity scans into one batch. For each navigation property target you plan to `$expand`, use `describe-entity --compact --no-udf`:
   ```bash
   dxs schema batch -c <id> \
     --request 'describe-entity Materials --compact --no-udf' \
     --request 'describe-entity Lots --compact --no-udf' \
     --request 'describe-entity Addresses --compact --no-udf' \
     --request 'describe-entity Contacts --compact --no-udf' \
     --request 'describe-entity Warehouses --compact --no-udf' \
     --request 'describe-relationships Warehouses --depth 2'
   ```
   Skip entities already covered by `describe-relationships --depth 2` in step 2 — depth-2 output includes nested nav property names and target types. Only scan entities where you need the **scalar field list** for `$select` clauses.

   **When you only have the type ID** (e.g., `Datex.FootPrint.Api.Warehouse` from relationship output) and don't know the entity set name, use `properties --entity-type Namespace.Type` instead — it accepts the full qualified type directly. Use `navigation-properties --entity-type` alongside it if you also need `$expand` paths.

   **Note:** If you need `$expand` paths for a related entity (what can be expanded *from* it), those are in its `navigation_properties` output — `describe-entity --compact` includes both scalar properties and nav properties.

4. **Resolve enum values** — When a property's type doesn't start with `Edm.`, it's an enum or complex type. Combine all enum lookups into one batch (or use a single direct command if only one):
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
