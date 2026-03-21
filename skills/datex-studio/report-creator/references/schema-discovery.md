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
| **Flag-based** (no positional args) | `search`, `entities`, `properties`, `navigation-properties`, `enums` | `--request 'command --flag value'` |
| **Positional args** | `describe-entity`, `describe-relationships`, `describe-properties`, `describe-navigation-properties` | `--request 'command Arg1 Arg2'` |

Common mistakes:
- `navigation-properties EntityName` — WRONG. Use `navigation-properties --entity-type Namespace.Type`
- `describe-navigation-properties EntityName` — WRONG, needs TWO positional args: `describe-navigation-properties Namespace.Type PropertyName`

## What to Batch Together

| Good combinations | Why |
|-------------------|-----|
| `search` + `describe-entity` | Search confirms the name, describe gets the structure — both needed before moving on |
| Multiple `properties --entity-type` | Scanning field names on related entities is fully independent |
| `navigation-properties --entity-type` + `properties --entity-type` | Get both fields and $expand paths for related types in one call |
| `describe-entity` + `properties` | Describing a child entity while scanning related types |
| Multiple `describe-entity` calls | Avoids the sequential-only constraint of parallel tool calls |

## When NOT to Batch

- When the second request **depends on** the first result (e.g., you need the entity name from search before you can describe it — but if you can guess the entity set name from the search keyword, batch them)
- When output would be too large to parse effectively — batch results are concatenated

## Recommended Batch Pattern

```bash
# Batch 1: Search + describe main entity in one call
uv run dxs schema batch -c <id> \
  --request 'search keyword' \
  --request 'describe-entity MainEntity'

# Batch 2: Describe child entity + scan related entity properties
uv run dxs schema batch -c <id> \
  --request 'describe-entity ChildEntity' \
  --request 'properties --entity-type Namespace.RelatedType1' \
  --request 'properties --entity-type Namespace.RelatedType2' \
  --request 'properties --entity-type Namespace.RelatedType3'

# Batch 3: Remaining related entities (if any)
uv run dxs schema batch -c <id> \
  --request 'properties --entity-type Namespace.Type4' \
  --request 'properties --entity-type Namespace.Type5' \
  --request 'properties --entity-type Namespace.Type6'
```

## Individual Commands

Use when batch isn't practical:

```bash
# Find entities by keyword
uv run dxs schema search "keyword" -c <connection_id>

# Describe main entity (full structure — properties + nav props)
uv run dxs schema describe-entity <EntityName> -c <connection_id>

# Quick-scan related entity field names (lightweight — just names + types)
uv run dxs schema properties -c <id> --entity-type <Namespace.EntityType>

# List navigation properties for $expand paths (filter by entity type)
uv run dxs schema navigation-properties -c <id> --entity-type <Namespace.EntityType>

# Explore all relationships for an entity set
uv run dxs schema describe-relationships <EntityName> -c <connection_id>

# Describe a single navigation property (two positional args required)
uv run dxs schema describe-navigation-properties <Namespace.EntityType> <NavPropertyName> -c <id>
```

## Key Rules

- Always check the `keys:` section — some entities have composite keys (no `Id` field)
- **Use `properties --entity-type` for related entities** — much faster than `describe-entity` when you only need field names
- `describe-properties` takes **one property name at a time** — not comma-separated. For bulk field discovery, use `properties --entity-type` or batch multiple `describe-properties` calls
- `describe-entity` does NOT support `--concise` — don't try it
- **Batch eliminates the "run sequentially" constraint** — unlike parallel tool calls (which abort siblings on failure), batch handles individual request failures gracefully and returns all results

## Anti-Patterns

| Anti-pattern | Better approach |
|--------------|----------------|
| 9+ sequential schema calls | Use `schema batch` — combine into 2-3 calls |
| Running `describe-entity` in parallel tool calls | Parallel tool calls abort siblings on failure — use `schema batch` instead |
| Using `describe-entity` for every related entity | Use `properties --entity-type` (or batch them) for quick field name scans |
| Trying comma-separated names in `describe-properties` | It takes one property at a time — use `properties --entity-type` or batch |
