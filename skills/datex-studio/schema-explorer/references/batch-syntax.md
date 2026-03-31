# Schema Discovery Reference

Detailed reference for OData schema discovery using `dxs schema` commands.

## Batch Command Syntax

Use `schema batch` to combine multiple schema queries into single HTTP requests. The `--request` flag takes the same arguments as individual schema commands (minus the `schema` prefix):

```bash
--request 'search keyword'
--request 'describe-entity EntityName'
--request 'describe-relationships EntityName'
--request 'properties --entity-type Namespace.Type'
--request 'navigation-properties --entity-type Namespace.Type'
--request 'describe-properties Namespace.Type PropertyName'
--request 'describe-navigation-properties Namespace.Type NavPropertyName'
--request 'enums --search status'
--request 'entities --top 20'
--request 'entities --count'
```

### Command argument styles

Commands use **two different styles** — mixing them up causes batch failures:

| Style | Commands | Batch syntax |
|-------|----------|-------------|
| **Flag-based** (no positional args) | `entities`, `properties`, `navigation-properties`, `enums`, `actions`, `functions`, `complex-types`, `singletons`, `action-imports`, `function-imports` | `--request 'command --flag value'` |
| **Positional args** | `search`, `describe-entity`, `describe-relationships`, `describe-enum`, `describe-action`, `describe-function`, `describe-complex-type`, `describe-singleton`, `describe-action-import`, `describe-function-import`, `describe-properties`, `describe-navigation-properties` | `--request 'command Arg1 [Arg2]'` |

**`describe-entity` supports display flags in batch** — these control output size:
```bash
--request 'describe-entity Orders --compact --no-udf'
--request 'describe-entity Orders -N'                    # nav-only
--request 'describe-entity Orders -P --prop-top 20'      # first 20 scalar props
--request 'describe-entity Orders --select Id,Name,Status'
```

**`describe-relationships` supports `--depth` in batch:**
```bash
--request 'describe-relationships Orders --depth 2'
```

Common mistakes:
- `navigation-properties EntityName` — WRONG. Use `navigation-properties --entity-type Namespace.Type`
- `describe-navigation-properties EntityName` — WRONG, needs TWO positional args: `describe-navigation-properties Namespace.Type PropertyName`
- `properties --entity-type Warehouses` — WRONG. Needs full qualified type ID: `properties --entity-type Datex.FootPrint.Api.Warehouse`

## Command Selection Rule

**Single request → use the direct command. Multiple independent requests → combine into ONE batch.**

- `dxs schema search "keyword" -c <id>` — use when you only need one search
- `dxs schema describe-entity Orders -c <id> --compact --no-udf` — use for a single entity
- `dxs schema batch -c <id> --request '...' --request '...'` — use when you have 2+ independent operations

**Anti-pattern:** `dxs schema batch -c 1 --request 'search keyword'` — wrapping a single request in batch adds overhead for no benefit.

## What to Batch Together

| Good combinations | Why |
|-------------------|-----|
| ALL keyword searches | `search shipment` + `search order` + `search warehouse` — all independent, one HTTP call |
| ALL entity describes + relationships | `describe-entity Shipments` + `describe-relationships Shipments` + `describe-entity Orders` + ... — all independent |
| ALL related entity scans | Multiple `describe-entity --compact --no-udf` for every related entity you need |
| `search` + `describe-entity` | Search confirms the name, describe gets the structure — both needed before moving on |
| Multiple `properties --entity-type` | Scanning field names on related entities is fully independent |

## When NOT to Batch

- When you only have **one request** — use the direct command instead
- When the second request **depends on** the first result (e.g., you need the entity name from search before you can describe it — but if you can guess the entity set name from the search keyword, batch them)
- When output would be too large to parse effectively — batch results are concatenated

## Recommended Batch Pattern

```bash
# Batch 1: Search + describe main entity (compact) + relationships in one call
dxs schema batch -c <id> \
  --request 'search keyword' \
  --request 'describe-entity MainEntity --compact --no-udf' \
  --request 'describe-relationships MainEntity --depth 2'

# Batch 2: Describe related entities (compact) — field lists for $select
# Only include entities where you need the scalar field list
dxs schema batch -c <id> \
  --request 'describe-entity RelatedEntity1 --compact --no-udf' \
  --request 'describe-entity RelatedEntity2 --compact --no-udf' \
  --request 'describe-entity RelatedEntity3 --compact --no-udf'

# Batch 3 (if needed): Resolve enums found in steps 1-2
# Only after reviewing output — enum type IDs come from non-Edm.* property types
dxs schema batch -c <id> \
  --request 'describe-enum Namespace.SomeStatusEnum' \
  --request 'describe-enum Namespace.AnotherEnum'
```

Skip related entities already well-covered by `describe-relationships --depth 2` (which includes nested nav property names and target types). Only scan entities where you need exact field names for `$select`. Enum resolution (batch 3) depends on identifying non-`Edm.*` types from prior output — it cannot be combined with batch 2 unless you already know the enum type IDs.

## Individual Commands

Use when batch isn't practical:

```bash
# Find entities by keyword (returns entity_type with full qualified type ID)
dxs schema search "keyword" -c <connection_id>

# Describe main entity — always use --compact --no-udf for initial exploration
dxs schema describe-entity <EntityName> -c <connection_id> --compact --no-udf

# Describe with only nav properties (for planning $expand paths)
dxs schema describe-entity <EntityName> -c <connection_id> -N

# Describe with only specific fields (for targeted deep dive)
dxs schema describe-entity <EntityName> -c <connection_id> --select Id,Name,StatusId

# Quick-scan related entity field names (lightweight — just names + types)
dxs schema properties -c <id> --entity-type <Namespace.EntityType>

# List navigation properties for $expand paths (filter by entity type)
dxs schema navigation-properties -c <id> --entity-type <Namespace.EntityType>

# Explore all relationships for an entity set (depth 2 = include target relationships)
dxs schema describe-relationships <EntityName> -c <connection_id> --depth 2

# Get enum member values (use the type from a property's non-Edm.* type field)
dxs schema describe-enum <Namespace.EnumType> -c <connection_id>

# Describe a single navigation property (two positional args required)
dxs schema describe-navigation-properties <Namespace.EntityType> <NavPropertyName> -c <id>
```

## Key Rules

- Always check the `keys:` section — some entities have composite keys (no `Id` field)
- **Always use `--compact --no-udf` on `describe-entity`** — full output can be 50,000+ tokens; compact reduces to ~2,000
- **Use `properties --entity-type` for related entities** — much faster than `describe-entity` when you only need field names
- **Use `navigation-properties --entity-type` alongside `properties`** — gives you `$expand` paths for related entities
- **`--entity-type` requires the full qualified type ID** (e.g., `Datex.FootPrint.Api.Warehouse`), NOT the entity set name (`Warehouses`). Get it from `search` output's `entity_type` field
- `describe-properties` takes **one property name at a time** — not comma-separated. For bulk field discovery, use `properties --entity-type` or batch multiple `describe-properties` calls
- `describe-entity` does NOT support `--concise` — use `--compact` instead
- **Batch eliminates the "run sequentially" constraint** — unlike parallel tool calls (which abort siblings on failure), batch handles individual request failures gracefully and returns all results

## Anti-Patterns

| Anti-pattern | Better approach |
|--------------|----------------|
| Running `describe-entity` without `--compact` | Output can be 50,000+ tokens — use `--compact --no-udf` |
| Splitting independent requests across multiple batch calls | Combine ALL independent requests into ONE batch — each call is a roundtrip |
| Wrapping a single request in `schema batch` | Use the direct command (`dxs schema search`, `dxs schema describe-entity`, etc.) |
| 9+ sequential schema calls | Use `schema batch` — combine into 2-3 calls |
| Running `describe-entity` in parallel tool calls | Parallel tool calls abort siblings on failure — use `schema batch` instead |
| Using full `describe-entity` for every related entity | Use `describe-entity --compact --no-udf` (or batch them) for quick field name scans |
| Scanning related entities without checking $expand paths | Use `describe-relationships --depth 2` on the main entity first — covers nested nav properties. Only use `describe-entity --compact` for scalar field lists |
| Using entity set name in `--entity-type` | Needs full qualified type ID from `search` output's `entity_type` field |
| Trying comma-separated names in `describe-properties` | It takes one property at a time — use `properties --entity-type` or batch |
| Hardcoding enum filter values from examples | Use `describe-enum <type>` — property types that don't start with `Edm.` are enums/complex types |
