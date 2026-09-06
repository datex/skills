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

Selectors (`-selector.json`, `configurationTypeId: 7`) must be backed by a `-datasource.json` — the query type inside it can be OData or flow, whichever fits. Never back a selector with a `-footprintDatasource.json`. See [`../../selector-creator/references/selectors.md`](../../selector-creator/references/selectors.md) for the selector authoring spec.

## Embedded Datasources

Some UI component types carry a **private, embedded datasource inside their own JSON file** rather than referencing a separate standalone `-datasource.json`. The embedded block uses the exact same shape as a standalone flow datasource — `type: "flows"`, `configurationTypeId: 6`, full `getListFlow` / `getByKeysFlow` / `getFlow` slots, `outParams`, `keyDef` — but declares `accessModifier: "private"` so it isn't importable or callable from anywhere except the hosting component.

Four component types can hold one:

- **Grids** — a paginated flow datasource (the `getListFlow` + `getByKeysFlow` pair) backing the grid's rows. See [`../../grid-creator/references/grids.md`](../../grid-creator/references/grids.md).
- **Editors** — a single-result flow datasource (the `getFlow` slot) keyed by the entity id. See [`../../editor-creator/references/editors.md`](../../editor-creator/references/editors.md).
- **Forms** — optional; most forms are parameter-driven and carry `datasourceConfig: null`. See [`../../form-creator/references/forms.md`](../../form-creator/references/forms.md).
- **Reports** — a different mechanic: the owned datasource stays a separate standalone-shaped file registered in the report folder's manifest via `dxs report datasource add --owned FILE:ALIAS`, not a block spliced into the host JSON. See [`../../datex-studio-shared/report-authoring/deploy-patterns.md`](../../datex-studio-shared/report-authoring/deploy-patterns.md).

An embedded datasource is **not** a discoverable standalone component — no other caller can reach it via `$datasources.<Package>.<name>`. It exists purely to hydrate the hosting component's own `datasourceConfig`.

### Owned by Default

**When a grid, editor, form, or report needs a datasource, author it owned.** Reach for a standalone `-datasource.json` only when one of the override conditions below applies.

The default holds because an owned datasource keeps every entity-shape location inside one file — a row-shape edit touches one config instead of two, and the host's own validation catches drift immediately. It also prevents accidental reuse: a standalone datasource created for a single grid is indistinguishable from one meant to be shared, so the next author binds to it, and the row-shape edit that used to be local now breaks someone else's component.

Choose **standalone** when any of these is true:

- **A second consumer needs the same query.** Two components binding one datasource is exactly what standalone is for. Speculative reuse doesn't count — promote when the second consumer actually exists, since promoting later is a mechanical change and un-sharing later is not.
- **The consumer can't hold one.** Only grids, editors, forms, and reports have an owned-contract path. Selectors, lists, calendars, cards, dashboard widgets and every other consumer must reference a standalone datasource; marking their reference `isOwned: true` fails with `Invalid contract. '<id>' is marked as owned, but this component cannot hold owned configurations`.
- **A flow datasource calls it.** Flow code reaches its dependencies through `$datasources.<Package>.<name>`, which resolves only for standalone configs. A flow datasource may itself be owned, but every OData datasource it queries must be standalone on the branch.
- **It ships in a library package** for other applications to install — an embedded datasource isn't importable.

The mechanic differs by host even though the policy doesn't: grids, editors, and forms embed the block in their own `datasources[]` with `datasourceConfig.isOwned: true`, while reports keep the datasource as a separate file registered in the report folder's manifest. Both are "owned". See [Creating an Owned Datasource](#creating-an-owned-datasource) for the procedure.

### Resolving an Owned Reference — `isOwned` Alone Decides

`datasourceConfig.isOwned` is the **only** field that determines how the platform resolves the reference. All four host types gate on it identically:

- `isOwned: true` → resolved **by `referenceName` against the host's own `datasources[]`**. `moduleId` is never read on this path.
- `isOwned` absent or `false` → resolved **by `configId` + `moduleId` against other applications**.

Two consequences that trip authors up:

- **`moduleId` is not an alternative to `isOwned`.** They coexist. The canonical grid skeleton sets `configId`, `moduleId`, and `isOwned: true` together, and that is the shape the platform expects. Setting `moduleId` on an owned reference is inert, not an error.
- **A missing `isOwned: true` is the actual cause of the "referenced configuration does not exist" failure**, because the reference falls through to the cross-application path and can't find a private embedded datasource there. Removing `moduleId` does not fix it.

Three distinct messages come out of this area — read them as pointing at three different mistakes:

| Message | What it means | Fix |
|---|---|---|
| `Invalid contract. Referenced configuration <id> does not exist or has been renamed` | Took the **external** path: `isOwned` is absent/false and no other application exposes `<id>` under that `moduleId`. | Set `isOwned: true` (if the datasource is embedded), or correct `moduleId` (if it really is standalone elsewhere). |
| `Invalid contract. Referenced own configuration <id> does not exist or has been renamed` | Took the **owned** path correctly (note the word **own** — this is the only difference from the row above), but no entry in the host's `datasources[]` has `referenceName == configId`. | Fix the name mismatch — `datasourceConfig.configId` must equal the embedded datasource's `referenceName`. |
| `Invalid contract. '<id>' is marked as owned, but this component cannot hold owned configurations` | `isOwned: true` on a component type that has no owned-contract path (anything outside grid / editor / form / report). | Promote the datasource to standalone and reference it by `configId` + `moduleId`. |

**Tailoring caveat.** Although `moduleId` is inert for *validation* on an owned reference, it is load-bearing for *customization identity*: a tailoring overlay identifies a datasource reference by the `{configId, moduleId, isOwned}` triple, so adding or stripping `moduleId` on a tailored config re-classifies the reference as a new one and changes how the overlay merges. Keep whatever the round-trip produced — don't normalize the field either direction on a config with a `baseConfiguration`. (Distinct rule, easily conflated: an owned **`baseConfiguration`** — a tailoring base, not a datasource — *does* always carry a null `moduleId`.)

### Creating an Owned Datasource

Scaffold it with `dxs datasource generate-flow`, then splice the result into the host's `datasources[]`. Don't hand-author the block: the generator emits `queryOptionsObjectTypeDef` correctly, and that is the entity-shape site most often missed when writing one by hand.

This section covers grids, editors, and forms. **Reports use a different mechanic** — the owned datasource stays its own file, registered in the report folder's manifest; see [`../../datex-studio-shared/report-authoring/deploy-patterns.md`](../../datex-studio-shared/report-authoring/deploy-patterns.md).

**1 — Generate.** `--type-def` must be a top-level **list**; the intuitive `field: type` mapping fails with `DXS-DS-005: --type-def must contain a YAML/JSON list of type definitions, got dict`.

```yaml
# types.yaml
- id: id
  type: number
- id: shipment_number
  type: string
```

```bash
# Grid — paginated, keyed
dxs datasource generate-flow -r ds_x -t "ds_x" -d "<purpose>" \
  --type-def types.yaml --get-list-flow getList.ts --get-by-keys-flow getByKeys.ts \
  --collection --key id:number --branch <branchId> -o ds_x.json

# Editor / form — single-result
dxs datasource generate-flow -r ds_x -t "ds_x" -d "<purpose>" \
  --type-def types.yaml --get-flow get.ts \
  --single --branch <branchId> -o ds_x.json
```

**2 — Name it after the host's reference.** Set `referenceName` (and `title`) to the host's `datasourceConfig.configId`. This is the lookup key on the owned path; a mismatch fails with `Referenced own configuration <id> does not exist or has been renamed`.

**3 — For a grid only, add the `totalCount` out-param.** `generate-flow` derives `outParams` from `--type-def` — the *row* shape — so it never emits the second out-param a grid's paginated contract expects, even though the `getList` code returns one. Without it the host fails with `Outdated contract. Type mismatch for output parameters`.

```json
{ "id": "totalCount", "type": "number", "isCollection": false, "required": false, "objectType": null, "isSecured": false }
```

Editors and forms are single-result and need nothing here — `--single --get-flow` already produces the shape they require (`resultIsCollection: false`, `getFlow` populated, `getListFlow` / `getByKeysFlow` null, `outParams[0].isCollection: false`).

**4 — Apply the envelope delta.** The generated file carries 30 of the 32 fields an embedded block uses and nothing extra to strip. Set `accessModifier: "private"`, `hasResult: true`, `id: null`, `outputResultAsSingleObject: false`, and reorder to the canonical key order in [`../../grid-creator/references/grids.md` → Embedded Datasource Component-Identity Envelope](../../grid-creator/references/grids.md#embedded-datasource-component-identity-envelope). None of these is validation-gating — splices with and without them validate identically — but they keep diffs readable and round-trips stable, and `accessModifier: "private"` is what stops the datasource being callable from outside its host.

**5 — Splice and validate the host.** Put the block in the host's `datasources[]`, set `datasourceConfig.isOwned: true`, and mirror the entity shape across every location the host requires — five for a grid ([grids.md → Datasource Wiring](../../grid-creator/references/grids.md#datasource-wiring--five-places-must-stay-in-sync)), two for an editor.

```bash
dxs configuration validate grid -b <branchId> -D body.json   # or editor / form
```

**Validating the host is the gate.** `dxs datasource validate` takes a standalone file and cannot see an embedded block, so it has nothing to say about one. The host's validation is what reports the embedded datasource's own contract errors — both `Referenced own configuration …` and `Outdated contract. Type mismatch for output parameters` surface here, and nowhere else.
