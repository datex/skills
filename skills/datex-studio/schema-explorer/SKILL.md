---
name: schema-explorer
description: |
  Use when exploring OData schema with dxs schema commands: searching entities,
  describing entity structure, scanning properties, checking which columns are
  indexed before filtering, or building a field mapping table for Datex Studio.
---

# Schema Explorer

OData schema discovery using `dxs schema` commands.

## References

- [references/batch-syntax.md](references/batch-syntax.md) — Batch command syntax, argument styles, describe-entity flags, anti-patterns
- [references/subagent-template.md](references/subagent-template.md) — Subagent delegation prompt

## Footprint connections — check the entity-expert skill first

If the connection is a `FootPrintApi` connection (Footprint WMS data — Tasks, Shipments, ArchivedShippingLicensePlateContents, LicensePlate, Lot, Material, etc.), check the `footprint-entity-expert` skill **before** exploring schema. It captures navigation chains, business-rule filters, and weight calculations that aren't visible in OData metadata — and tells you which entity actually backs a given business concept (e.g., "shipped inventory" → ASLPC, not Shipments). Skip this for non-Footprint connections.

## Resolving the Connection

Schema commands require a connection ID (`-c <id>`). The user may or may not provide one explicitly.

**If the user provides a connection ID or name** — use it directly. Examples: "use connection 9", "use the Prod connection".

**If the user says something like "in Prod" or "on the Demo environment"** — find the matching FootprintApi connection:
1. `dxs auth status` — get the authenticated organization ID
2. `dxs organization connection list --org <org_id>` — list all connections
3. Filter to `apiConnectionTypeName: FootPrintApi` and match the name

**If the user doesn't specify a connection at all** — list the available FootprintApi connections and ask which one to use:
1. `dxs auth status` — get the org ID
2. `dxs organization connection list --org <org_id>` — list connections
3. Show the user just the FootprintApi connections (filter out MongoDB, AMQP, SFTP, etc.) and ask them to pick one

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
- **Scope every list command.** `entities`, `actions`, `properties` and `indexes` return the whole model when given no filter — on a real connection that is tens to hundreds of KB per call, and `indexes` is the largest of them. Narrow with `--entity-set` / `--entity-type` / `--search` / `--covering`, or page with `-n` and `--skip`. When all you need is the size, use `--count`.

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

   **Address gaps explicitly.** If the user asked about a concept (e.g., "success/failure", "late orders", "priority") and the schema has no direct field for it, say so in the field mapping. Explaining what *doesn't* exist is as valuable as documenting what does — it saves the user from searching for something that isn't there, and lets them decide on a workaround (derived calculation, external lookup, etc.).

## Index Awareness

The metadata reports the physical database indexes behind each entity set. Check them whenever the
schema you are mapping will be filtered or sorted on a large entity set — an unindexed predicate is
the usual cause of a datasource that times out in production but looks fine on a small dev dataset.

`describe-entity` already returns the entity set's indexes at no extra HTTP call, so if you ran
step 2 you have them. Reach for the `indexes` command only for cross-entity questions:

```bash
dxs schema batch -c <id> \
  --request 'indexes --entity-set Shipments' \
  --request 'indexes --covering ModifiedSysDateTime'
```

`--covering COLUMN` is shorthand for `Columns/any(c: c/Name eq 'COLUMN')` — "is this column indexed
anywhere?" without hand-writing the lambda.

**Reading the output — three traps:**

- **`key_ordinal` must be `1`** for a filter on that column alone to seek. An index on
  `(StatusId, AccountId)` does not help a filter on `AccountId` by itself.
- **`is_included: true` is not filterable.** The column rides along to satisfy a `$select` without a
  lookup; filtering on it alone still scans.
- **No indexes reported means unknown, not none.** An explicit empty result — `indexes: []` on
  `describe-entity` or an empty `indexes` list, both carrying an `index_hint` — means the metadata is
  silent about that entity set, not that its storage has none. Entity sets in this state are always
  read-only in the API, but several look like ordinary keyed tables, so an index probably exists and
  just is not reported. Do not conclude a filter there scans — or seeks. Say "no index information"
  in the mapping.

**How much an empty `--covering` result proves depends on whether you scoped it.** Scoped with
`--entity-set`, it is definitive: a column that does not exist on that entity type fails with
`DXS-SCHEMA-014` instead of coming back empty, so empty means "not indexed" and nothing else.
Unscoped, there is no entity type to validate the name against — the column is either unindexed
everywhere *or* misspelled, and the result cannot tell you which. A model-wide `--covering` is fine
for "where is this column indexed?", but the moment the answer decides a `$filter`, re-run it
scoped:

```bash
dxs schema indexes -c <id> --entity-set Shipments --covering ModifiedSysDateTime
```

Read the `index_hint` on any empty result — it names which of the three cases you hit (definitively
not indexed / silent entity set / unattributable model-wide miss) instead of leaving you to infer it.

When an intended filter column has no leading-column index, say so in the field mapping table
alongside the field. That is a real constraint on the datasource design, not a footnote.

**A guarded filter can vanish, taking the index with it.** Every way `dxs datasource generate`
parameterizes a filter wraps the predicate in a `$utils.isDefined()` guard, so an absent parameter at
runtime drops it — and the query you just index-checked becomes a full scan of the very table you
were protecting. `--detect-params` is **not** an escape hatch: it applies the same guard, stamps the
param `required: false`, and because the generator treats the whole `$filter` as one unit, an absent
value there drops the static predicates alongside it. No generate flag emits a required, unguarded
filter.

So an index check on a parameterized filter is only as good as the binding behind it. Report the
scoping parameter alongside the index finding, and hand off to `datasource-creator`, which carries
the two ways to close the gap (patch `required: true` into the generated JSON, or enforce the bound
in the consuming component).

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
