# Datasource Compatibility & Suitability Rules

When is a datasource usable by a given consumer, and what must be internally self-consistent for it
to publish. Three **independent** mechanisms are at work here, and conflating them is the most common
authoring failure — each reads different fields, at a different site:

| # | Mechanism | Reads | Fails when |
|---|---|---|---|
| 1 | **Consumer usage gate** — `ValidateDatasourceReferences` / `ValidateLinkedDatasourceReferences` | the **reference snapshot stored on the consumer** (`configOutParameters`, `datasourceKeyDef`) | publishing the *consumer* |
| 2 | **Datasource self-consistency** — `validateFlowSlots`, `validateQueryOptionsShape`, `validateOutputsContract` | the **datasource's own** fields | publishing the *datasource* |
| 3 | **Method availability** — derived (OData) or authored (flows) | `type`, `resultIsCollection`, `hasKey`, flow slots | at codegen or runtime, mostly unvalidated |

Commit is ungated by design — an invalid datasource commits fine. All of the below blocks **publish**.

---

## 1. The usage gate reads the reference snapshot, not the datasource

This is the single most important thing to get right when authoring a consumer. The gate never
loads the target datasource; it evaluates the snapshot the consumer carries:

```csharp
var resultParam  = reference.configOutParameters?.FirstOrDefault(t => t.id == "result");
var isCollection = resultParam.isCollection == true;      // absent/null == SINGLE
var hasKeys      = reference.datasourceKeyDef?.Count > 0;
```

So when authoring a grid, what must be right is:

```json
"datasourceConfig": {
  "configId": "...",
  "configOutParameters": [ { "id": "result", "type": "object", "isCollection": true, "objectTypeDef": [ ... ] } ],
  "datasourceKeyDef": [ { "id": "Id", "type": "number" } ]
}
```

- `resultIsCollection` and `hasKey` on the **target** are irrelevant *to this gate*. They matter at
  different sites (§5, §6) — which is why a datasource that visibly has a key can still produce
  *"it has no key definition"* on its consumer: the consumer's `datasourceKeyDef` snapshot is empty.
- A stale snapshot cannot hide a problem: the separate **"Outdated contract"** check reports
  divergence between snapshot and target first, with the same remedy (refresh the reference).
- `hasResult` means **exactly one** outParam with `id: "result"`. Two `result` entries makes
  `hasResult` **false** — the config is treated as broken, not as having a result.
- **Absent `isCollection` means single.** This is the loose reading, and it matches codegen's own
  truthiness (`{{#if ...isCollection}}[]{{/if}}`), so `null`, `false` and omitted are equivalent
  everywhere in this document.
- An **unpicked** reference (no `configId`) is skipped, not reported. Whether a reference is
  *required* stays the consumer's own rule.

---

## 2. Shape taxonomy (`EDatasourceShape`)

`DatasourceShapeRules.Satisfies()` states every requirement over exactly three primitives:

| Shape | Predicate |
|---|---|
| `any` | `hasResult` |
| `single` | `hasResult && resultIsCollection != true` |
| `collection` | `hasResult && resultIsCollection == true` |
| `collectionWithKeys` | `hasResult && resultIsCollection == true && hasKeys` |

**A shape says nothing about flow slots or methods.** Slot rules are §5; do not read a slot
requirement out of a shape requirement. The same predicates back the studio's picker endpoints
(`forEditor`, `forGrid`, `forSelector`, …), so the picker and the gate cannot drift on the *rule* —
only on the *input* (picker reads the target's stamped flags, gate reads the snapshot), which is how
a legacy datasource can be offered in the picker and then rejected at publish.

---

## 3. Consumer suitability matrix

Complete — all eleven `EDatasourceUseCase` entries. Every row is publish-blocking on the consumer.

| Consumer | Use case | Required shape |
|---|---|---|
| Editor (`-editor.json`) | `editor` | `single` |
| Form (`-form.json`) | `form` | `single` |
| Large number widget | `widgetLargeNumber` | `single` |
| Linear gauge widget | `widgetLinearGauge` | `single` |
| Radial gauge widget | `widgetRadialGauge` | `single` |
| List | `list` | `collection` |
| Calendar (day view) | `calendar` | `collection` |
| Pie chart widget | `widgetPieChart` | `collection` |
| **Grid** (`-grid.json`) | `grid` | **`collectionWithKeys`** |
| **Selector** (`-selector.json`) | `selector` | **`collectionWithKeys`** |
| Report binding | `report` | `any` |

Notes that matter when authoring:

- **Grid is `collectionWithKeys` unconditionally.** There is no conditional on inline editing, row
  refresh or "keyed rows" — a keyless collection datasource is rejected for *any* grid. (Grid calls
  `getList` for pages and `getByKeys` to refresh a single row.)
- **List and calendar are `collection`, not `collectionWithKeys`.** They call `getList` and never
  `getByKeys`, so demanding a `keyDef` of them would reject datasources they use perfectly well.
- **The gauges are `single`** — the same requirement as the large number widget. The studio's
  "Datasource usability" panel has no gauge block, so this doc is the only place that states it.
- **Calendar fires the gate three times** — day view `columnsConfig`, `eventsConfig` and
  `unscheduledEventsConfig` each carry their own `datasourceConfig`.
- **Report is `any`** because a report binds the datasource's *main* method rather than a
  system-derived one; its only requirement is that a result exists. This is also why a report
  cannot paginate.
- Image widgets are not gated (no use case).
- There are no creator skills in this library for list, calendar, widget or report components — the
  rows are here because the gate applies to them regardless of how the config was authored.

**Error messages** (useful for recognizing which rule fired):

| Condition | Message |
|---|---|
| no `result` in snapshot | `Datasource '<id>' cannot be used by <consumer>: it does not return a result.` |
| `single` wanted, collection given | `… its result is a collection.` |
| `collection`/`collectionWithKeys` wanted, single given | `… its result is not a collection.` |
| `collectionWithKeys` wanted, no keys | `… it has no key definition, so getByKeys cannot resolve a row. …` |

### Tier restrictions are a separate mechanism

Function → `-datasource.json` only, action → `-footprintDatasource.json` only, selector → never
FPDS. These are **not** shape rules and are not enforced by this gate (flows are not in
`EDatasourceUseCase` at all). See [`datasources.md`](datasources.md). Both mechanisms can reject the
same config for different reasons; cite the right one.

---

## 4. Linked datasources

`linkedDatasources[]` is gated by `ValidateLinkedDatasourceReferences` on the **link type**, reading
the same reference snapshot (`configOutParameters` / `datasourceKeyDef`). It runs on the shared base
`validate()`, so it also covers links on owned datasources and on FPDS / footprint queries.

| `EDSLinkedType` | Studio label | Required shape of the target | Runtime call |
|---|---|---|---|
| `oneToOne` | expand to single property | `single` | `get()` per parent row |
| `oneToMany` | expand to collection property | `collection` | `getList()` per parent row |
| `oneToOneWithMerge` | expand to single property with match | `collectionWithKeys` | one `getByKeys()`, results mapped back |

A link with no `datasourceConfig` at all is reported as *"Linked datasource '<name>' is missing its
datasource reference"* — contract collection skips such entries, so without this check it would
publish silently. A link whose target has no `result` is reported on its own, so it is not misread
as a shape mismatch.

---

## 5. Method and slot availability

### OData (`type: "oDataQuery"`) — methods are derived, never authored

| Method | Emitted when |
|---|---|
| `get` | always (given non-empty `outParams`) |
| `getList` | `resultIsCollection == true` |
| `getByKeys` | `resultIsCollection == true` **and** `hasKey == true` |

Consequence worth internalizing: **a single-result OData datasource has only `get`.** There are no
flow slots on an OData datasource — `getFlow`/`getListFlow`/`getByKeysFlow` stay `null`.

`keyDef` is derived from the path metadata (or from `queryOptions.applyKeyDef` when `apply` contains
groupby/aggregate, because groupby reshapes the entity and the original metadata keys may not
survive). Codegen assumes **every key is among the selects** ("all keys are required to be
selected"), and §6 requires every select to appear in the entity definition — so each `keyDef` entry
must appear in `queryOptions.selects` *and* in `queryOptionsObjectTypeDef`.

### Flows (`type: "flows"`) — one method per authored slot

`validateFlowSlots()` (publish-blocking, on the datasource) demands **presence**:

| State | Required slots |
|---|---|
| `resultIsCollection: false` | `getFlow` |
| `resultIsCollection: true` | `getListFlow`, plus `getByKeysFlow` when `hasKey == true` |
| `resultIsCollection` unset | none — *"Use in ... is required"* is reported instead |

Messages: `'Get' flow is required when the result is a single object` /
`'Get list' flow is required when the result is a collection` /
`'Get by keys' flow is required when the datasource has a key definition`.

**Stray slots are NOT validated.** The studio's `clearUnusedFlows()` nulls the unused ones and you
should match it, but a leftover slot is not a validation error — codegen emits a method from any
slot that is present, and it generally works. Do not report a stray slot as an error.

**One stray slot is genuinely dangerous and nothing catches it:** `getByKeysFlow` present with
`keyDef` null/empty. Codegen's `getSysInParamsKeys` (`generators/common.ts`) dereferences
`datasourceKeyDef.length` with **no null guard** and throws during generation. The .NET copy
null-coalesces, so backend validation and context building pass — the failure surfaces only at
codegen. Same hazard on the OData side inside `TransformAs_list_by_keys`, but that path is only
reached when `hasKey` is true.

`onInitFlow` is `null` unless explicit initialization logic is needed. It is the only flow that runs
against the `$datasource` context; `getFlow`/`getListFlow`/`getByKeysFlow` run against `$flow`.

---

## 6. Datasource self-consistency (publish-blocking, on the datasource itself)

Both of these run inside `BaseDatasourceDesignerConfig.validate()`. In the studio they never fire,
because the designer regenerates the derived state on every save; a **hand-authored or CLI-authored**
config must reproduce that output exactly. These are the two rules most likely to block a
first-attempt datasource.

### `validateQueryOptionsShape` — OData only

An exact **bijection, per level, in both directions**, between `queryOptions` and
`queryOptionsObjectTypeDef`:

| Direction | Pairing | Error |
|---|---|---|
| select → def | every `selects[].property` ↔ a **non-`object`** entry with the same `id` | `Selected property '<path>' is missing from the entity definition` |
| def → select | every non-`object` entry ↔ a select | `Entity definition property '<path>' has no matching select in the query options` |
| expand → def | every `expands[].property` ↔ an **`object`** entry with the same `id` | `Expanded property '<path>' is missing from the entity definition` |
| def → expand | every `object` entry ↔ an expand | `Entity definition property '<path>' has no matching expand in the query options` |

Then it **recurses**: `expand.queryOptions` against `def.objectTypeDef`, with dotted paths in the
messages. Entries with an empty `id` and selects/expands with an empty `property` are ignored.

**Skipped entirely** for a level whose `queryOptions.apply` contains any non-`filter` transformation
(groupby/aggregate) — those reshape the entity, the designer disables `$select`/`$expand`, and the
type def reflects the apply output instead. `apply` with only `filter` transformations does **not**
skip the check.

### `validateOutputsContract` — both query types

Compares the **whole** stored `outParams` list against what the studio's `buildOutputs()` would
produce. One error for the whole list:

> `Output parameters do not match the entity definition, linked datasources and custom columns. Open the datasource in Studio and save it to refresh them.`

The recipe, in order:

1. `result` = `{ id: "result", type: "object", isCollection: <resultIsCollection>, objectTypeDef: clone(queryOptionsObjectTypeDef) }`
2. Only if that `objectTypeDef` is non-null:
   - per-expand `queryOptions.outputResultAsSingleObject: true` → that property's `isCollection: false` (recursive through nested expands);
   - if `outputResultAsFlattenExpands: true` → **every** remaining collection expand → `isCollection: false` (recursive);
   - **append** one entry per `linkedDatasources[]`: `{ id: <link.name>, type: "object", isCollection: false for oneToOneWithMerge else the target's result isCollection, objectTypeDef: clone(target result objectTypeDef) }`;
   - **append** one entry per `customColumns[]`: `{ id: <column.name>, type: <column.type>, isCollection: <column.isCollection> }`.
3. `+ { id: "totalCount", type: "number", isCollection: false }` **iff** `type == "oDataQuery"` **and**
   `queryOptions.count == true`. A **flow** datasource with `totalCount` in its `outParams` fails —
   `totalCount` belongs to the derived `getList` *method* params, not to the datasource's `outParams`.

How the comparison actually works (`TypeConfigEquals` / `BaseTypeConfigEquals`):

- Matching is **by `id`, order-insensitive**, but **set-equal in both directions** — a missing or
  extra entry fails, reordering does not.
- Compared: `id`, `type`, `objectType`, and truthy-normalized `isCollection`, `isSecured`,
  `isConstant`, `constantValue`. **`required` is not compared.**
- `objectTypeDef: null` and `objectTypeDef: []` are **not** equal. If `queryOptionsObjectTypeDef` is
  null then `result.objectTypeDef` must be null too — and step 2 is skipped entirely, so linked
  datasources and custom columns are *not* appended in that state.
- Duplicate `id`s anywhere in the tree make the comparison meaningless, so the check bails out; the
  duplicates are reported by their own validator instead. Same bail-out when a linked datasource has
  no usable `result` snapshot (reported by §4).
- `isSecured` is designer-authored state that lives only inside the stored `outParams`. For
  `oDataQuery` the expected outputs **inherit** the secured paths from the actual ones before
  comparing, so securing a property does not by itself trip this check.

### Other checks in the same `validate()`

- OData: `paths` must be non-empty — *"Set of entities is required"*.
- Flows: `resultIsCollection` must be set (*"Use in ... is required"*) and `queryOptionsObjectTypeDef`
  must be non-empty (*"Entity definition is required"*).
- `dynamicOrderBys[].property` must resolve to a real path in `queryOptionsObjectTypeDef`;
  `dynamicFilters` are validated recursively for existence **and** exact type match.
- `blob` is excluded from `queryOptionsObjectTypeDef` (and from `inParams`/`vars` on the footprint
  variants).
- Duplicate identities and invalid tombstones are reported separately — a `removed: true` entry
  outside a customization is corruption.
- A flow-type datasource cannot be a customization: *"Flow-based datasources cannot be customized."*

---

## 7. Footprint variants

The §3 matrix applies to `-datasource.json` only.

- **`-footprintDatasource.json`** is not offered to any component picker — its controller exposes
  only `ForConnection` and `hasCyclicalReference`, and its designer sets `canUseInComponents: false`.
  It is reached by actions, via `$datasources.*`. Do **not** apply grid/selector/editor shape rules
  to an FPDS. What *does* apply: §4 (linked datasources), §5 (flow slots) and §6 (self-consistency).
- **Footprint queries** additionally require `resultIsCollection: true` (*"Query should return list
  of entities."*), a `queryGUID`, a `filterForm`, and a `getQuery` method — for flow type that means
  a `getQueryFlow`. Their only slot is `getQueryFlow`, so the §5 `get`/`getList`/`getByKeys` slot
  rules are explicitly **not** applied (`validateFlowSlots` is overridden to return nothing). Their
  `inParams` are restricted to non-collection, non-constant `number`/`string`/`date`/`boolean`.

---

## 8. Parity requirements

- **System in-params are platform-generated, never authored:** `$top`, `$skip` (always on `getList`),
  `$orderby` (when `dynamicOrderBys` exist), `$filter` (when `dynamicFilters` exist), `$keys`
  (always on `getByKeys`). Three copies of the generator exist — backend
  (`DatasourceDesignerConfig.cs`), studio (`datasource-designer/common.ts`) and codegen
  (`generators/common.ts`) — and they must stay identical. Never hand-write these into a flow's
  `inParams`; `buildFlowsInOutParams()` fills them in.
- **`$keys` shape** follows `keyDef`: a single simple key yields a scalar collection param; a
  composite or dotted key (`"Owner.Id"`) yields `type: "object"` with a nested `objectTypeDef`.
- **`getByKeys` must round-trip whatever `getList` produced.** Any label or value transformation
  applied in `getListFlow` (e.g. a `formatKey` helper) must be applied identically in
  `getByKeysFlow`, or a saved selection resolves to a corrupted label on reload. This is a real
  authoring hazard and is not validated anywhere.
