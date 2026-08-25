# Datasources

Datasources are the platform's read-side components. A datasource describes **how to fetch data**, and callers invoke it uniformly via `$datasources.<Package>.<reference_name>.get({ ... })` regardless of how the datasource is authored internally.

## Two Orthogonal Axes

Every datasource is characterized by two independent axes:

### Axis 1 — Component Variant (execution tier)

| File suffix | Folder | Runs on | Component type ID |
|---|---|---|---|
| `-datasource.json` | `src/datasources/` | Platform backend (cloud, same tier as functions) | `6` |
| `-footprintDatasource.json` | `src/footprint-datasources/` | Footprint server (same tier as actions) | `19` |

Variant is chosen by **where** the datasource needs to run, which in turn is driven by **who needs to call it**. The execution-tier rule is symmetric: each caller can only reach datasources that run on its own tier.

- **Functions** (cloud backend) can only call `-datasource.json`. Calling `-footprintDatasource.json` from a function is **not allowed** — it's a cross-tier call.
- **Actions** (Footprint server) can only call `-footprintDatasource.json`. Calling `-datasource.json` from an action is **not allowed** — same cross-tier rule that prevents actions from calling functions.
- **Selectors** can only be backed by `-datasource.json` — FPDS is not a valid selector backing (hard platform rule, separate from the caller-tier rule).

Summary:

| Caller | `-datasource.json` | `-footprintDatasource.json` |
|---|---|---|
| Function | ✓ `$datasources.*.get({...})` | ✗ not allowed |
| Action | ✗ not allowed | ✓ `$datasources.*.get({...})` |
| Selector backing | ✓ required | ✗ not allowed |

**Package = folder location.** Neither variant carries a package field internally; the owning package is inferred from the feature folder the file lives in. Moving a datasource between packages is a file move, no internal edits.

### Axis 2 — Query Type (query mechanism)

| Type value | Mechanism |
|---|---|
| `"oDataQuery"` | Pure declarative OData query (`queryOptions`, `selects`, `filters`, `expands`, `orderBys`, ...). No embedded code. |
| `"flows"` | Embedded TypeScript in `getListFlow` / `getByKeysFlow` / `getFlow`. Used when the query needs branching, post-processing, or non-OData logic. |

Query type is chosen by **how** the data is fetched/computed. OData is preferred when the query is expressible as a single OData call; flow is used for everything else.

## All Four Combinations Exist

All four variant × type combinations are fully supported and canonicalized. The two axes are independent — the same query type inside different variants produces structurally identical files apart from a small set of delta fields.

| Variant × Type | Typical use | Authoring details |
|---|---|---|
| `-footprintDatasource.json` + OData | Most common; server-side OData lookups that actions call | [`odata-datasources.md`](odata-datasources.md) |
| `-datasource.json` + OData | OData lookup running in the cloud backend — required when an OData entity query backs a selector (selectors require `-datasource.json`) | [`odata-datasources.md`](odata-datasources.md) |
| `-datasource.json` + flow | Dropdown/grid datasources in the cloud backend (e.g. enum dropdowns with `formatKey` helpers); editor datasources with custom fetch logic | [`flow-datasources.md`](flow-datasources.md) |
| `-footprintDatasource.json` + flow | Flow logic that must run on the Footprint server (e.g. timezone conversions, action-tier helpers) | [`flow-datasources.md`](flow-datasources.md) |

### Structural Deltas Between Variants

For a given query type, the only cross-variant differences are:

| Query type | `-datasource.json` | `-footprintDatasource.json` |
|---|---|---|
| `oDataQuery` | `configurationTypeId: 6`, `apiSettingName: "FootprintApi"` | `configurationTypeId: 19`, `apiSettingName: "FootprintApi"` |
| `flows` | `configurationTypeId: 6`, `apiSettingName: null` | `configurationTypeId: 19`, `apiSettingName: "FootprintApi"` |

Everything else — field set, null-slot layout, `queryOptions` shape (OData), flow slot shape (`getListFlow`/`getByKeysFlow`/`getFlow`), `outParams` descriptors, `keyDef` — is identical across variants for a given query type. Author once against the canonical skeleton for the query type, then pick the `configurationTypeId` + `apiSettingName` for the component variant.

## Calling Convention

The **call syntax** is uniform across all callable combinations:

```
$datasources.<Package>.<reference_name>.get({ ... })
```

But **callability** is tier-restricted (see the matrix above). A function can only use this syntax against `-datasource.json` targets; an action can only use it against `-footprintDatasource.json` targets. Within the tier a caller can reach, the syntax hides the query type — a function calling a `-datasource.json` does not know whether it is OData-type or flow-type, and an action calling a `-footprintDatasource.json` likewise cannot distinguish them.

## Schema Pre-Flight Applies to OData-Type Datasources

Any datasource with `type: "oDataQuery"` — regardless of component variant — must have every entity name, property, navigation property, and key validated against the OData schema before authoring or editing. Delegate the lookups to the `schema-explorer` skill; do not load raw schema documents into the parent. The failure mode for a bad name is a silent, misleading import error. See [`odata-datasources.md`](odata-datasources.md#pre-flight-validate-against-schema) for the full checklist.

Flow-type datasources are not mechanically subject to this rule (there is no declarative OData tree to validate), but if their embedded TS issues OData calls, apply the same validation judgment to the names in the query strings.

## Parameter Descriptor Asymmetry — inParams Fat, outParams Slim

Across both component variants, an oDataQuery datasource's `outParams` must be exactly `[{"id": "result", "type": "object", "isCollection": <bool>, "objectTypeDef": [...]}]` — the slim result descriptor, with no `required` / `oneOf` / `isSecured` / `description` / other full-boilerplate keys. `inParams` are the opposite: they keep the full parameter descriptor used by functions and actions everywhere. Applying the fat descriptor to `outParams` fails at Studio import with `Cannot read properties of undefined (reading 'type')` — and `dxs configuration validate` does **not** catch it (validation and import are separate code paths), so a config that validates cleanly can still be rejected on import.

When generating datasource configs programmatically, use separate builders for inParams (fat) and outParams (slim) rather than one shared descriptor builder. See [`odata-datasources.md` → Result Type](odata-datasources.md#result-type) for the full descriptor rules.

## Selectors

Selectors (`-selector.json`, `configurationTypeId: 7`) must be backed by a `-datasource.json` — the query type inside it can be OData or flow, whichever fits. Never back a selector with a `-footprintDatasource.json`. The backing datasource must also satisfy `EDatasourceShape.collectionWithKeys` — a collection result plus a non-empty key definition — and, if it is flow-type, must implement both the `getListFlow` and `getByKeysFlow` slots. See [`../../selector-creator/references/selectors.md`](../../selector-creator/references/selectors.md) and [`compatibility-rules.md`](compatibility-rules.md).

## Datasource Compatibility & Consumer Suitability Rules

A consumer component only publishes if the datasource it references has the shape that consumer
requires (`EDatasourceShape`, evaluated by `DatasourceShapeRules.Satisfies()`):

- **`single`** — editors, forms, large number widget, both gauge widgets.
- **`collection`** — lists, calendars, pie chart widget.
- **`collectionWithKeys`** — **grids and selectors, unconditionally.** A grid needs a key whether or
  not it does inline editing: it calls `getList` for pages and `getByKeys` to refresh a row.
- **`any`** (a result exists) — report bindings.

Two traps worth knowing before you author either side:

- The gate reads the **reference snapshot on the consumer** (`datasourceConfig.configOutParameters`
  result entry + `datasourceConfig.datasourceKeyDef`), *not* `resultIsCollection` / `hasKey` on the
  target datasource. Those flags matter elsewhere — method generation and flow-slot validation.
- **Shape does not imply slots.** A single-result OData datasource has only `get`; flow datasources
  get one method per authored slot, with its own presence rules.

Full matrix (all eleven use cases), linked-datasource rules, flow-slot rules, and the
self-consistency validators that gate the datasource itself: [`compatibility-rules.md`](compatibility-rules.md).

## Embedded Datasources

Some UI component types carry a **private, embedded datasource inside their own JSON file** rather than referencing a separate standalone `-datasource.json`. The embedded block uses the exact same shape as a standalone flow datasource — `type: "flows"`, `configurationTypeId: 6`, full `getListFlow` / `getByKeysFlow` / `getFlow` slots, `outParams`, `keyDef` — but declares `accessModifier: "private"` so it isn't importable or callable from anywhere except the hosting component.

Two places this shows up:

- **Grids** — each grid embeds a paginated flow datasource (the `getListFlow` + `getByKeysFlow` pair) that backs the grid's rows. See [`../../grid-creator/references/grids.md`](../../grid-creator/references/grids.md).
- **Editors** — each editor embeds a single-result flow datasource (the `getFlow` slot) keyed by the entity id. See [`../../editor-creator/references/editors.md`](../../editor-creator/references/editors.md).

An embedded datasource is **not** a discoverable standalone component — no other caller can reach it via `$datasources.<Package>.<name>`. It exists purely to hydrate the hosting component's own `datasourceConfig`. When a query needs to be shared across multiple hosts, promote it to a standalone `-datasource.json` instead.
