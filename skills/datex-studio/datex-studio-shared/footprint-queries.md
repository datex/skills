# Footprint Queries (configurationTypeId 29/30/31)

> Stub reference doc — no component-creator skill exists for these types yet. See [`datex-studio-conventions/file-format.md`](../datex-studio-conventions/file-format.md) for the cti table and the "documented gap" note. Covers three related types: FootprintQuery (29, CLI type `footprintquery`), FootprintQueryFilterForm (30, nested only — no CLI type name), and FootprintQueryManager (31, CLI type `footprintquerymanager`).

**Rollout in progress — do not author a FootprintQuery (29) from this doc.** As of this writing only two instances exist anywhere in the organization, both named `testing_*` and both created shortly before this doc was written — this is a type mid-rollout, not yet a stable authoring target. FootprintQueryManager (31) is further along (one real, non-test instance in production use) and is documented in more depth below for that reason.

## Purpose & When to Use

A **FootprintQuery** (29) is a datasource-like component: an OData query bound to a platform-registered query *definition* rather than hand-authored `$select`/`$expand`/`$filter` clauses — the query's shape comes from `queryDefinitionId`/`queryDefinitionName`, and the component layers dynamic filters and custom columns on top. A **FootprintQueryFilterForm** (30) is its nested filter-UI sub-object (`filterForm`), not an independently addressable component — there is no `dxs configuration` CLI type for it; it only ever appears embedded inside a FootprintQuery body. A **FootprintQueryManager** (31) is a standalone UI component — a dialog that lets a user pick from the registered queries available to the current application and author/save named filters against one of them, independent of any single FootprintQuery instance.

Use a FootprintQuery when a grid/list/report needs to run against a query the platform (not this application) defines and versions centrally. Use a FootprintQueryManager when the UI needs to let an end user create/edit/select a saved filter against one of those registered queries — e.g. as a "manage my saved views" dialog.

Given the rollout status, treat both types as **not yet ready to build against** for new work; this doc exists so the shape is on record for when rollout completes.

## File Location & Naming

- FootprintQuery (29): CLI type `footprintquery`; file suffix unconfirmed (no stable instance to observe a conventional export name from) — `_TODO_ (rollout in progress)`.
- FootprintQueryFilterForm (30): no CLI type, no standalone file — it is the `filterForm` key nested inside a FootprintQuery body. Not independently nameable.
- FootprintQueryManager (31): CLI type `footprintquerymanager`; file suffix unconfirmed — `_TODO_ (only one real instance observed, suffix not independently confirmed)`.
- Standard platform defaults apply where observed: package `Utilities`/host package, `accessModifier: "public"`, `description` non-empty ≤100 chars.

## Minimal Valid Skeleton

### FootprintQuery (29) — shape only, do not author yet

Field names below are from the research digest's shape inventory of the two `testing_*` instances, not independently re-verified by this doc's author (per the rollout-in-progress guidance, those instances were deliberately not fetched for this pass):

```json
{
  "configurationTypeId": 29,
  "id": 0,
  "referenceName": "example_footprint_query",
  "title": "example_footprint_query",
  "description": "One-line purpose under 100 chars.",
  "queryDefinitionId": 0,
  "queryDefinitionName": "",
  "queryGUID": "",
  "apiSettingName": "",
  "paths": [],
  "queryInParams": [],
  "queryOutParams": [],
  "queryOptions": {},
  "dynamicFilters": [],
  "customColumns": [
    { "name": "example_column", "type": "string", "value": "$entity.ExampleProperty" }
  ],
  "filterForm": {
    "configurationTypeId": 30,
    "controlsForFixed": [],
    "controlsForAdditional": [],
    "controlsForFilter": [],
    "onInitFlow": null
  },
  "onInitFlow": null,
  "keyDef": [],
  "hasKey": false,
  "resultIsCollection": true,
  "outputResultAsFlattenExpands": false,
  "accessModifier": "public"
}
```

### FootprintQueryManager (31) — confirmed from a live instance

Top-level key order and shape as observed, genericized:

```json
{
  "toolbar": [],
  "references": [],
  "queryTitle": "$queryManager.inParams.title?.toString()",
  "filterGetFlowReference": { "configId": "<get_filters_flow>", "moduleId": "<Package>" },
  "filterCreateFlowReference": { "configId": "<create_filter_flow>", "moduleId": "<Package>" },
  "filterUpdateFlowReference": { "configId": "<update_filter_flow>", "moduleId": "<Package>" },
  "flows": [],
  "onInitFlowConfig": { "flowId": "on_init" },
  "onQueryChangeFlowConfig": { "flowId": "on_query_change" },
  "onFilterChangeFlowConfig": { "flowId": "on_filter_change" },
  "configurationTypeId": 31,
  "id": 0,
  "referenceName": "example_query_manager",
  "title": "Configure query filters",
  "inParams": [
    { "id": "query_id", "required": false, "type": "string", "isCollection": false, "isSecured": false },
    { "id": "filter_id", "required": false, "type": "number", "isCollection": false, "isSecured": false },
    { "id": "definition_id", "required": false, "type": "number", "isCollection": false, "isSecured": false },
    { "id": "title", "required": true, "type": "string", "isCollection": false, "isSecured": false }
  ],
  "outParams": [
    { "id": "query_id", "required": false, "type": "string", "isCollection": false, "isSecured": false },
    { "id": "filter_id", "required": false, "type": "number", "isCollection": false, "isSecured": false },
    { "id": "has_result", "required": false, "type": "boolean", "isCollection": false, "isSecured": false }
  ],
  "vars": [
    { "id": "is_changed", "type": "boolean", "isCollection": false, "isSecured": false },
    { "id": "filter_id", "type": "number", "isCollection": false, "isSecured": false }
  ],
  "accessModifier": "public"
}
```

## Required Top-Level Fields

### FootprintQuery (29) / nested FootprintQueryFilterForm (30)

| Field | Purpose | Notes |
|---|---|---|
| `queryDefinitionId` / `queryDefinitionName` | Binds to the platform-registered query definition | The definition, not this component, owns the underlying OData shape |
| `queryGUID` | Stable identifier for the bound definition | `_TODO_ (rollout in progress — relationship to `queryDefinitionId` not independently confirmed)` |
| `apiSettingName` | Which API/connection setting the query executes against | |
| `paths` | `_TODO_ (rollout in progress)` | |
| `queryInParams` / `queryOutParams` | Parameters passed into / read out of the bound query definition | Separate from the component's own `inParams`/`outParams` if any — `_TODO_` whether this type has both |
| `queryOptions` | `_TODO_ (rollout in progress)` | |
| `dynamicFilters` | Runtime-adjustable filter clauses on top of the definition's base query | Analogous in spirit to a grid's dynamic filters — not independently confirmed to share the same contract |
| `customColumns[]` | Computed columns added on top of the raw result | `{name, type, value}` where `value` is a TS expression string against `$entity.<Prop>` (see the declarative-string-is-a-TS-expression rule in [`file-format.md`](../datex-studio-conventions/file-format.md)) |
| `filterForm` | Nested FootprintQueryFilterForm (cti 30) object | `{configurationTypeId: 30, controlsForFixed, controlsForAdditional, controlsForFilter, onInitFlow}` — three separate control lists (fixed vs. user-addable-additional vs. filter-only); the distinction between them is `_TODO_ (rollout in progress)` |
| `onInitFlow` | Component-level init flow, separate from the nested form's own `onInitFlow` | |
| `keyDef` / `hasKey` | Declares the result's key column(s), if any | |
| `resultIsCollection` | Whether the query returns one row or a collection | |
| `outputResultAsFlattenExpands` | Whether expanded nav properties are flattened into the result shape | Same-named concern as OData datasources flattening expands |

### FootprintQueryManager (31)

| Field | Purpose | Notes |
|---|---|---|
| `toolbar` | Toolbar buttons | Same shape as hub/grid toolbars |
| `references` | Observed empty (`[]`) on the one live instance | Purpose `_TODO_` |
| `queryTitle` | Dialog title, a TS expression string | Observed value: `` $queryManager.inParams.title?.toString() `` |
| `filterGetFlowReference` / `filterCreateFlowReference` / `filterUpdateFlowReference` | `{configId, moduleId}` pointers to external flows (functions) that back `initFilter`/`createFilter`/`updateFilter` | These are the persistence layer — the manager itself holds no storage, it calls out to package flows |
| `onInitFlowConfig` / `onQueryChangeFlowConfig` / `onFilterChangeFlowConfig` | `{flowId}` pointers into `flows[]` | Fired on load, on query selection change, and on filter validity/content change respectively |
| `flows` | Embedded flow definitions (cti 9 nodes) | |
| `inParams` | Caller-supplied inputs | Observed: `query_id?`, `filter_id?`, `definition_id?`, `title` (required) |
| `outParams` | Caller-readable outputs | Observed: `query_id?`, `filter_id?`, `has_result?` |
| `vars` | Component-local state | Observed: `is_changed?: boolean`, `filter_id?: number` |
| `accessModifier` | Visibility | `public` |

## Runtime Globals

### FootprintQueryManager — `$queryManager`, confirmed from the live instance's generated context

```typescript
interface IFootprintQueryManager {
  title: string;
  inParams: { query_id?: string, filter_id?: number, definition_id?: number, title: string };
  outParams: { query_id?: string, filter_id?: number, has_result?: boolean };
  vars: { is_changed?: boolean, filter_id?: number };

  events: {
    outParamsChange: { emit: () => void }
  };

  toolbar: { /* one IToolModel<IButtonModel> entry per toolbar button id */ };

  on_init(event?: any): Promise<any>;
  on_query_change(event?: any): Promise<any>;
  on_filter_change(event?: any): Promise<any>;
  on_save(event?: any): Promise<any>;
  on_close(event?: any): Promise<any>;

  queries: {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly referenceName: string;
    readonly definitionId: number;
    readonly packageName: string;
    readonly packageUniqueIdentifier: string;
    readonly packageVersion: string;
    name: string;        // mutable — defaults to title, can be overwritten in on_init to customize display
    disabled: boolean;   // mutable — greys the entry out without hiding it
    active: boolean;     // mutable — hides the entry entirely when false
  }[];

  get selectedQueryId(): string;
  get isFilterValid(): boolean;

  initFilter(queryId: string, filterId: number | null): Promise<void>;
  createFilter(): Promise<number>;
  updateFilter(filterId: number): Promise<void>;

  close();
}
```

`queries[]` is pre-populated with every query definition the hosting application references — `on_init` is the place to narrow that list (by `definitionId`, by cross-checking an "active" set via a package flow, etc.), not a place to fetch it from scratch. `name`, `disabled`, and `active` are the three per-entry knobs `on_init` is expected to mutate; the rest of the entry is read-only.

### FootprintQuery (29) / FootprintQueryFilterForm (30)

`_TODO_ (rollout in progress — no production instance to inspect a generated context from; the two `testing_*` instances were deliberately not fetched for this doc given the "do not author yet" guidance)`.

## Invocation Contract

- A FootprintQueryManager is opened like any dialog-style component — standard `inParams` in, `outParams` out, with `close()` as the dismissal method. Its `title` inParam is required; the rest are optional filters on which queries/filters are pre-selected.
- The three `filter*FlowReference` fields are the manager's *only* persistence path — they point at caller-supplied, module-qualified flows (functions), not at a built-in storage mechanism. Wiring a FootprintQueryManager into a package therefore requires those three flows to exist first, matching the `{configId, moduleId}` contract described in [`component-wiring-check/references/component-wiring.md`](../component-wiring-check/references/component-wiring.md).
- A FootprintQuery's relationship to a hosting grid/list/report (is it referenced the way a datasource is, or does it stand fully alone?) is `_TODO_ (rollout in progress)`.

## Common Patterns

### Closing the dialog with a result — `on_save`

Observed verbatim pattern (toolbar button disables itself, shows a spinner, calls `createFilter`/`updateFilter` depending on whether a `filter_id` was supplied, flags the result, emits the change event, then closes):

```typescript
try {
  $queryManager.toolbar.tool1.control.readOnly = true;
  $queryManager.toolbar.tool2.control.readOnly = true;

  if (!$utils.isDefined($queryManager.inParams.filter_id)) {
    const filter_id = await $queryManager.createFilter();
    $queryManager.outParams.filter_id = filter_id;
    $queryManager.outParams.query_id = $queryManager.selectedQueryId;
  } else {
    await $queryManager.updateFilter($queryManager.inParams.filter_id);
    $queryManager.outParams.filter_id = $queryManager.inParams.filter_id;
    $queryManager.outParams.query_id = $queryManager.selectedQueryId;
  }

  $queryManager.outParams.has_result = true;
  $queryManager.events.outParamsChange.emit();
  $queryManager.close();
} catch (error) {
  $queryManager.toolbar.tool1.control.readOnly = false;
  $queryManager.toolbar.tool2.control.readOnly = false;
  const errorMessage = $utils.isDefined(error?.error?.error) ? error?.error?.error.message : error.message;
  await $shell.<Pkg>.openErrorDialog('Error', errorMessage);
}
```

The runtime close pattern on a plain cancel (`on_close`) is a single line: `$queryManager.close();` — no outParams are set, so the caller's promise resolves without a result.

### Narrowing visible queries by definition, in `on_init`

```typescript
if ($utils.isDefined($queryManager.inParams.definition_id)) {
  for (const q of $queryManager.queries) {
    if (q.definitionId !== $queryManager.inParams.definition_id) {
      q.active = false; // hide entries for other definitions
    }
  }
}
```

### Gating the save button on filter validity, in `on_filter_change`

```typescript
if ($queryManager.isFilterValid) {
  $queryManager.toolbar.tool1.control.readOnly = false;
} else {
  $queryManager.toolbar.tool1.control.readOnly = true;
}
```

## Pre-Flight Checklist

1. **Do not author a FootprintQuery (29) for real work** until rollout completes — confirm with the platform team / check whether more than two (non-`testing_*`) instances exist before relying on this doc's FootprintQuery section.
2. For a FootprintQueryManager: the three `filter*FlowReference` flows must exist and be module-qualified correctly before wiring the manager in — see [`component-wiring-check/references/component-wiring.md`](../component-wiring-check/references/component-wiring.md).
3. Gate the save/close toolbar button on `$queryManager.isFilterValid`, not just on required-field presence — the observed instance treats filter validity as the authoritative gate (see Common Patterns).
4. Standard tail sanity: non-empty `description` ≤100 chars where present, `accessModifier` set — see [`datex-studio-conventions/universal-checklist.md`](../datex-studio-conventions/universal-checklist.md).
5. `validate <clitype>` before `upsert <clitype>` as with every configuration type — see [`configuration-roundtrip.md`](configuration-roundtrip.md).

## Cross-References

- [`datex-studio-conventions/file-format.md`](../datex-studio-conventions/file-format.md) — cti table and the "documented gap" note covering these types.
- [`datex-studio-shared/visualization.md`](visualization.md) — sibling stub doc for the other roadmap type with no creator skill yet.
- [`component-wiring-check/references/component-wiring.md`](../component-wiring-check/references/component-wiring.md) — cross-component reference rules applicable to the `filter*FlowReference` contract.
- [`configuration-roundtrip.md`](configuration-roundtrip.md) — the canonical `get → extract → edit → validate → upsert` round-trip these types still follow where addressable by CLI.

---
Distilled from one production FootprintQueryManager component on a Footprint Manager package and its generated designer context, dxs 0.5.8.
