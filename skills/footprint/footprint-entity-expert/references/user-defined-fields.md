# User-Defined Fields (Custom Fields / UDFs)

A UDF is a real, physical column on the entity table, exposed as an ordinary OData property. It is
**not** a key/value side table — `Orders?$select=BoolTest&$filter=Id eq 423` reads it and a plain
`PATCH` on the entity writes it. Everything below is about telling which columns are UDFs and where
their human-facing metadata lives.

## Two sources, one authority

| Source | What it tells you | Authority for |
|---|---|---|
| `$metadata` — properties annotated `Datex.FootPrint.Api.IsUdf` = `true` | Which columns exist on this entity, and their Edm type | **Which fields exist and what type they are** |
| `UserDefinedFieldInfos` entity set | Label, description, display group, display order, read-only, visibility, option list | **Presentation only** |

**The annotation is the authority; the table only enriches.** The two sets overlap but neither
contains the other, so a UI driven by `UserDefinedFieldInfos` alone silently drops fields that
exist and hold data. Observed in one production dataset, on `Order` (48 IsUdf columns):

- 46 had a definition somewhere, **2 had none at all** — still real columns holding real values.
- Of the 46, only 26 were registered against `EntityName eq 'Order'`; **20 were registered only
  under `OrderClass-N` scopes.**
- 10 of the `Order`-scoped ones carried `DisplayVisible: false`.

Intersect the annotation list with the definition table **by column name** — never by scope — and
let the definition supply labels, grouping, ordering and visibility. Scope then filters (see below);
it must not be what you query by, or the 2 undefined columns vanish along with anything registered
under a scope name you did not think to ask for.

## Scope names: generic vs sub-category

`UserDefinedFieldInfos.EntityName` is a free-text scope label, not a foreign key. It comes in two
shapes, and they mean different things:

| Shape | Examples | Applies to |
|---|---|---|
| **Generic** | `Order`, `Material`, `Lot`, `Outbound shipment`, `ScaleTicket` | every record of the entity |
| **Sub-category** | `OrderClass-3`, `MaterialGroup-129`, `SurveyDefinition-36`, `OrderClass-3-OrderLine` | only records in that sub-category |

A sub-category scope is the entity's *category* table plus the category id. The observed prefixes
are `OrderClass`, `MaterialGroup` and `SurveyDefinition`; in one production dataset 218 of 246 distinct scope
names were parameterised. The shape is reliably detectable:

```ts
const isSubCategoryScope = (name: string) => /-\d+(-[a-z]+)?$/.test(name.toLowerCase());
```

**A sub-category field belongs to its sub-category only.** An `OrderClass-3` UDF is for orders whose
`OrderClassId` is 3 — even though its column and value live on the shared `Orders` table like every
other UDF. Showing it on a class-14 order is wrong. So:

- resolve the record's own sub-category (`Order.OrderClassId` → `OrderClass-{id}`,
  `Material.MaterialGroupId` → `MaterialGroup-{id}`) and treat only that one as in scope;
- treat every **generic** scope as in scope — that is what lets a caller pass nothing and still get
  a correct panel for entities whose definitions are not registered under the entity's own name;
- treat every **other** parameterised scope as out of scope.

**Derive the record's sub-category server-side — do not rely on the caller to pass it.**
Verified the hard way: a tailored grid opened the panel with no scope list, and because "pass
nothing" only auto-includes *generic* scopes, every `OrderClass-2-OrderLine` field silently
dropped. A correct implementation derives the record's own sub-category scopes itself: it parses
each candidate definition's parameterised `EntityName` (`{Category}-{id}` or
`{Category}-{id}-{Entity}`), reads `{Category}Id` from the record's own column when the entity
carries it, else from the first single-valued `$metadata` navigation whose target type carries it
(`OrderLine` → `Order` → `OrderClassId`), and treats matching scopes as in scope. Any
caller-passed entity-name override should still rank first — pass it for label-precedence
control, never as a correctness requirement.

Because the column is shared, an out-of-scope column can still hold a value (an order reclassified
after the field was set, an integration writing by column name). Surfacing those — and only those —
keeps the sub-category rule without letting data go invisible.

Two more traps:

- **Casing is not normalised.** In one production dataset, shipment columns resolve across `Shipment`,
  `Outbound shipment`, `Outbound Shipment`, `Inbound shipment` and `Inbound Shipment`
  simultaneously. Compare case-insensitively.
- **`UserDefinedFieldEntities` lists only the base names.** The `OrderClass-N` variants never appear
  there, so it cannot be used to enumerate an entity's sub-category scopes.
- **`$filter` AST size is capped at MaxNodeCount=100, and the per-clause node cost varies by server
  OData version.** A 25-clause `Name eq … or …` filter passed on one environment by a single node
  (~3 nodes/clause) and failed on another with "The node count limit of '100' has been exceeded"
  (~4–5 nodes/clause). Batch name lookups at ~10 clauses per request and parallelize the requests;
  UDF-heavy entities (Lot, Material, 180+ columns) hit this first.
- Column names are unique enough to look up by name, but not globally unique — the same name can be
  defined under an unrelated entity. Rank candidates (the record's own scopes → the entity's own
  name → any generic scope → anything else) rather than taking the first row back.

## `DisplayVisible` and `DisplayReadOnly` — honour both

Both come from the Footprint desktop client's field configuration, and both are worth honouring in
any UI that presents custom fields to an operator:

- **`DisplayVisible: false` → do not show the field.** These are overwhelmingly integration
  plumbing — status/error columns an integration writes and nobody hand-edits. In one production dataset 10 of
  `Order`'s 26 base-scope columns were flagged hidden. Note this means a hidden column can hold a
  value that the panel will not display; offer an explicit opt-in (an `include_hidden` style flag)
  rather than a permanent exception.
- **`DisplayReadOnly: true` → render the value, block the edit.** Rare but live (10 definitions in
  one production dataset, e.g. `Owner.Username`, `SerialNumber.Serial Number`).

Both flags live on the *definition*, so a column with no definition has neither — it is visible and
editable by default.

## Types

`UserDefinedFieldTypes` has four rows: `1 text`, `2 numeric`, `3 true or false`, `4 date and time`.
They map 1:1 onto the Edm type of the physical column:

| `UserDefinedFieldType.Name` | Edm type |
|---|---|
| `text` | `Edm.String` |
| `numeric` | `Edm.Decimal` |
| `true or false` | `Edm.Boolean` |
| `date and time` | `Edm.DateTimeOffset` |

**Prefer the Edm type.** It is what the `PATCH` accepts, it exists for columns with no definition,
and definitions can carry a `TypeId` that no longer resolves (a `TypeId: 5` with no matching row
was observed in the wild; `$expand=UserDefinedFieldType` then returns null).

Every UDF is nullable, so a boolean is genuinely three-state — `true` / `false` / never set. A
two-position control cannot express that; use an indeterminate checkbox or an explicit "not set".

## Option lists

`UserDefinedFieldInfos/UserDefinedFieldPossibleValues` (`{Id, UdfId, UdfValue}`) turns any UDF —
including a `text` one — into a dropdown. Empty collection means free entry. Since possible values
hang off the *definition*, a column with no definition never has them.

## Reading and writing

```
GET  {api}$metadata                                   -> IsUdf-annotated properties + Edm types
GET  {api}UserDefinedFieldInfos?$select=Id,Name,Label,Description,EntityName,TypeId,
       DisplayGroupName,DisplayOrder,DisplayReadOnly,DisplayVisible
       &$expand=UserDefinedFieldType($select=Name),UserDefinedFieldPossibleValues($select=UdfValue)
       &$filter=<Name eq '…' or …>                    -> chunk at ~25 names per request
GET  {api}<EntitySet>?$select=<udf names>&$filter=<keys>
```

Two traps on the value read:

- **Null properties are omitted from the JSON response.** An entity whose UDFs are all unset comes
  back as `{}`, not as a bag of nulls. Read with `record[name] ?? null`, and never infer "record not
  found" from an empty object — check that `value[]` itself is non-empty.
- **`$select` gets long.** `Material` and `Lot` carry 180+ UDF columns; naming them all builds a URL
  long enough to be refused. Past ~60 columns, drop `$select` and take the whole record.

Writes go through `$flows.Utilities.crud_batch_request_flow` with
`{ method: 'PATCH', set: '<EntitySet>', keys: [{name, value}], properties: { [udfName]: value } }`.
Coerce to the Edm type first — a numeric UDF sent as a string is rejected.

## Cross-references

- [`../../../datex-studio/datasource-creator/references/odata-datasources.md`](../../../datex-studio/datasource-creator/references/odata-datasources.md) — the metadata pre-flight every OData datasource owes.
