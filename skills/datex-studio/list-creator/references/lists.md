# Lists — Authoring Reference

Authoritative reference for Datex Studio **list** components (`configurationTypeId: 14`, CLI type `list`, `-list.json` suffix). A list renders a datasource's collection as a stack of repeated [cards](../../card-creator/references/cards.md) — one card per result row — with an optional top toolbar, filter fields, a built-in full-text search box, paging, and embedded flows. It is the card-based sibling of the [grid](../../grid-creator/references/grids.md): a grid renders rows as columns; a list renders each row through a card template. Lists bind their rows through a [datasource](../../datasource-creator/references/datasources.md) exactly like grids, and reference their item card and datasource through the [component-wiring](../../component-wiring-check/references/component-wiring.md) `configParameters` contract.

> Provenance: distilled from production components on a Footprint Manager package and the generated designer contexts, dxs 0.5.8.

## Purpose & When to Use

Pick a **list** when:

- Each item benefits from a **card** layout — header, body fields, a per-item action bar, status styling — rather than tabular columns.
- Items mutate themselves (the card calls a function, emits an event) and the collection should re-fetch: the **mutate → emit → refresh** loop.
- You need a browse/manage surface opened as a **dialog** or **navigated to** from a shell menu, hub, or another list — mobile task queues, attachments, saved-item managers.

Pick a **grid** instead when the data is tabular: sortable/filterable columns, multi-row selection, Excel export, inline cell editing. Pick a **calendar** when items are time-placed events. A list always pairs with a datasource (the rows) and a card (the item template); author them in that order — datasource → card → list.

## File Location & Naming

- `configurationTypeId: 14`; CLI type `list`.
- Conventional file name `<referenceName>-list.json`; `referenceName` snake_case, **ends in `_list`** ([../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md#component-naming-matrix)). It drives the generated `open<referenceName>Dialog` / `open<referenceName>` shell methods.
- `title` is user-facing (dialog title, view header): a sentence-case display name distinct from `referenceName` — every shipped list follows this ([../../datex-studio-conventions/naming-conventions.md → Display Names for User-Facing Components](../../datex-studio-conventions/naming-conventions.md#display-names-for-user-facing-components)).
- Defaults: package `Utilities`, `accessModifier: "public"`, `description` mandatory and ≤100 chars ([../../datex-studio-conventions/defaults.md](../../datex-studio-conventions/defaults.md)).

## Minimal Valid Skeleton

This shape passed `dxs configuration validate list` (dxs 0.5.8) with real datasource and card references substituted for the placeholders:

```json
{
  "pageSize": 50,
  "fullTextSearch": false,
  "topToolbar": [],
  "datasourceConfig": {
    "datasourceKeyDef": [ { "id": "<key_col>", "type": "string" } ],
    "configParameters": [
      { "parameter": { "id": "<ds_inparam>", "type": "string", "required": false, "isCollection": false }, "value": "$list.inParams.<id>" }
    ],
    "configOutParameters": [
      { "id": "result", "type": "object", "isCollection": true, "objectTypeDef": [ { "id": "<col>", "type": "string", "isCollection": false } ] }
    ],
    "configId": "<datasource_referenceName>",
    "moduleId": "Utilities"
  },
  "itemConfig": {
    "contentType": "card",
    "contentConfig": {
      "configParameters": [
        { "parameter": { "id": "<card_inparam>", "type": "string", "required": false, "isCollection": false }, "value": "$item.entity.<col>" }
      ],
      "configEvents": null,
      "configId": "<card_referenceName>",
      "moduleId": "Utilities"
    },
    "width": "100%",
    "height": "auto",
    "cardStyle": ""
  },
  "flows": [],
  "onInitFlowConfig": null,
  "configurationTypeId": 14,
  "id": 0,
  "referenceName": "example_items_list",
  "title": "Example items",
  "description": "Lists example items as cards.",
  "inParams": [ { "id": "<id>", "type": "string", "required": true, "isCollection": false } ],
  "accessModifier": "public"
}
```

Verified live (branch validation run): any key sent as explicit `null` (e.g. an unused
`itemConfig.contentConfig.configEvents`, a top-level `onInitFlowConfig`) is dropped by the server
on `upsert`/`get` — omit rather than null, since the round-trip body won't carry it either way.

## Required Top-Level Fields

Key presence across 25 shipped lists in brackets.

| Key | Required | Notes |
|---|---|---|
| `configurationTypeId` | yes | `14`. |
| `id`, `referenceName`, `title`, `accessModifier` | yes | Standard identity. |
| `description` | yes (convention) | Non-empty, ≤100 chars (missing on 3 shipped lists — do not copy). |
| `pageSize` | yes (25) | Integer — `null` fails validate (`Error converting value {null} to type 'System.Int32'`). Observed 5–200; 10 is the most common. |
| `fullTextSearch` | yes (25) | `true` shows the built-in search box (6 shipped lists); bind `$list.fullTextSearch` into the datasource. |
| `datasourceConfig` | yes (25) | Always carries `datasourceKeyDef`, `configParameters`, `configOutParameters`, `configId`, `moduleId`. `configParameters` mirror the datasource's `inParams` one-for-one; `configOutParameters` mirror its outParams (`result` collection). |
| `itemConfig` | yes (25) | `{contentType: "card", contentConfig: {configId, moduleId, configParameters, configOutParameters?, configEvents?, outParamsChangeFlowConfig?}, width, height, cardStyle}`. `contentType` must be `card` — `grid` / `form` fail with `Item content type <X> is not allowed`. `width` / `height` are CSS strings (`"100%"`, `"20%"`, `"400px"`, `"auto"`); `cardStyle` observed `"small-card"`, `""`, or absent. |
| `inParams` | yes (25) | Host-provided context; the opener passes these. |
| `flows` | usual (22) | Embedded flows: toolbar click handlers, card-event handlers, `on_init`, `on_data_loaded`. |
| `topToolbar` | usual (19, non-empty 16) | Button / separator items, same shape as card action items: `{id, type: "button", buttonConfig: {label, icon?, buttonDefaultStyleClass?, readOnly, disabled, splitButton, tooltip, buttons, clickFlowConfig: {flowId}}}`. |
| `filters` | optional (10, non-empty 6) | Field-wrapper entries `{id, label, required, controlConfig, widthType}` (observed `selectBox` with `dropdownConfig`, `textBox`, `checkBox`), read as `$list.filters.<id>.control.value` and bound into `datasourceConfig.configParameters`. |
| `vars` | optional (8) | Every `$list.vars.<id>` must be declared. |
| `onInitFlowConfig` | optional (6) | Runs **before** the datasource's automatic first load. |
| `onDataLoadedFlowConfig` | optional (3) | Runs after a load; `$list.items` is populated. |
| `icon` | optional (2) | Icon class for the view header (e.g. `"icon-ic_fluent_arrow_download_20_filled"`). |
| `outParams` | optional (1) | Values returned to a dialog opener (`$list.outParams.<id>`). |
| `toolbar`, `onIntervalFlowConfig`, `intervalSeconds` | rare | `toolbar` is never populated in shipped lists — use `topToolbar`. _TODO_ (runtime unverified): interval polling semantics (0 shipped uses). |

## Runtime Globals

List-tier flows (toolbar clicks, card-event handlers, `on_init`, `on_data_loaded`) see **`$list`**, typed by a generated `IList` whose members exist only for what the body declares:

```ts
interface IListItemEntity { /* the datasource's result columns, all optional */ }
interface IListItem { entity: IListItemEntity; }
interface IList {
  inParams: { ... };
  outParams: { ... };                              // only when outParams[] is declared
  vars: { ... };                                   // only when vars[] is declared
  fullTextSearch: string;                         // only when "fullTextSearch": true
  topToolbar: { <id>: IToolModel<IButtonModel> };  // only when topToolbar has items
  filters: { <id>: IFieldModel<ISelectBoxModel | ITextBoxModel | ...> };  // only when filters[] is declared
  items: IListItem[];
  refresh();
  close();
}
```

- `$list.refresh()` — re-run the datasource (the back half of mutate → emit → refresh). Never from `on_init` (see Common Patterns).
- `$list.close()` — close the list when hosted as a dialog.
- `$list.items[i].entity` — the loaded rows; assigning `$list.items[i].entity = {...}` patches one rendered item in place without a reload (shipped pattern).
- `$list.topToolbar.<id>.hidden` and `.control.{label, readOnly, disabled}` — typed; `hidden` is used by shipped lists. _TODO_ (runtime unverified): `control.readOnly` effect on a list toolbar button in Preview. No `as any` cast is needed once the button is declared.
- `$list.filters.<id>.control.value` — current filter value. Shipped lists bind it into `datasourceConfig.configParameters` with no change handler and rely on the list re-querying when a bound value changes; _TODO_ (runtime unverified).
- `$list.fullTextSearch` — current search-box text. Exists only when `"fullTextSearch": true`; with `false`, a binding to it fails validate (`Property 'fullTextSearch' does not exist on type 'IList'`) — bind the datasource's search param to `""` instead.
- `$event` — in a flow mapped from a card event via `configEvents`, the payload the card emitted.
- Item bindings: `itemConfig.contentConfig.configParameters` values bind with **`$item.entity.<col>`** (typed against `IListItemEntity`) plus `$list.inParams.*` and literals. The card itself runs in card tier — inside the card use `$card`, never `$list`.
- Also available: `$shell`, `$flows`, `$datasources`, `$frontendFlows`, `$utils`, `$settings`; UI-tier calling rules apply ([../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md)).

`$list.vars` / `outParams` / `filters` / `fullTextSearch` used without a declaration (or the flag) fail validate (`Property 'filters' does not exist on type 'IList'`). The generated typings come from `dxs configuration contexts list -b <branchId> -D body.json` (project `designerContexts[] | select(.id=="listContext") | .text`; never dump `appContext`).

## Invocation Contract

**Opening a list.** The shell generates two methods per list, package-scoped when the list is registered under a package — a top-level application list has no package segment and opens as `$shell.open<referenceName>Dialog(...)` ([../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md), `$shell` row):

```ts
// dialog — resolves when the dialog closes (with outParams when the list declares any)
await $shell.<Package>.open<referenceName>Dialog({ ...inParams }, 'modal' | 'flyout', EModalSize.Large);
// navigation — replaces or pushes the current shell view
$shell.<Package>.open<referenceName>({ ...inParams }, replaceCurrentView?);
```

`<Package>` is the **list's** package. The methods exist only once the list is on the branch — when one list opens another, upsert the callee first. A shell menu item can also host a list as a view.

**The two one-for-one mirrors** — validate enforces both (dxs 0.5.8):

| Mirror | Missing entry | Extra entry | Required param bound to `""` / absent |
|---|---|---|---|
| `datasourceConfig.configParameters` ↔ datasource `inParams` | `Outdated contract. Missing input parameter <id>` | `Outdated contract. Input parameter <id> does not exist or has been renamed` | `Missing binding for required input parameter <id>` |
| `itemConfig.contentConfig.configParameters` ↔ card `inParams` | same | same | same |

Optional params that the list does not bind stay in the array with `"value": ""` (shipped convention). Binding expressions are type-checked: `$item.entity.no_such_col` fails with `Property 'no_such_col' does not exist on type 'IListItemEntity'`. `configId` must name an existing component (`Invalid contract. Referenced configuration <x> does not exist or has been renamed`), and `moduleId` is the **target's** package.

**Card events.** `itemConfig.contentConfig.configEvents: [{eventConfig: {id, dataType?}, flowConfig: {flowId}}]` maps each card event to a list flow. Validate checks neither the event id against the card's `events[]` nor the flow against `flows[]` — mismatches are silent. A card that publishes `outParams` is wired with `configOutParameters` (mirroring the card's outParams) and `outParamsChangeFlowConfig: {flowId}`.

Audit with [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md).

## Common Patterns

### Mutate → emit → refresh

The card mutates through a function and emits a declared event; the list's handler calls `$list.refresh()`. The card stays ignorant of list rendering. When the card emits the changed row as its payload, the handler can patch in place instead:

```ts
// handle_change — mapped from the card's on_change event (dataType object)
const match = $list.items.find(i => i.entity.id === $event.id);
if (match) { match.entity = { ...$event }; } else { await $list.refresh(); }
```

### Open-as-dialog, refresh on return

```ts
await $shell.Utilities.openexample_shared_items_listDialog(
  { owner_ref: $list.inParams.owner_ref }, 'modal', EModalSize.Large);
await $list.refresh();
```

### Never `$list.refresh()` in `on_init` — rows duplicate

The datasource **auto-binds right after `on_init` completes**. A `refresh()` inside `on_init` fires a second load on top of the automatic one, and a list **appends** results across loads rather than replacing them — the visible symptom is duplicated rows (verified with a network capture showing two identical calls). If `on_init` must adjust what loads first, set the vars / inParams the datasource binding reads and let the automatic bind pick them up.

### Full-text search pushdown

Set `"fullTextSearch": true` (the `$list.fullTextSearch` member only exists then) and add a datasource `configParameter` `{ "parameter": { "id": "full_text_search", ... }, "value": "$list.fullTextSearch" }`; the datasource filters on the term.

### Filters into the datasource

Declare a filter field and bind its value: `"value": "$list.filters.status_filter.control.value ?? []"`. Reset a filter from a flow with `$list.filters.status_filter.control.value = null`.

### Constant-scope configParameter

Pin a parameter to a literal with a TS-expression `value`: strings quoted (`"'mine'"`), booleans and numbers bare (`"true"`). Lets two lists run the same datasource or card in different modes.

### Toolbar gating

`on_init` hides toolbar buttons from `inParams` or permissions: `$list.topToolbar.add_item.hidden = !$list.inParams.can_configure;`.

### Act on the loaded rows

`on_data_loaded` and toolbar flows can read `$list.items` (e.g. start a task with `$list.items[0]?.entity`); guard with optional chaining — the list may be empty.

The designer's list settings form (captured from the Studio designer (option lists), dxs 0.5.8) exposes only Reference ID, Description, Access modifier, Results per page (`pageSize`) and Interval (minutes); the item form exposes Item type (`card` only), Width, Height and Card style. So paging is `pageSize` and nothing else, and the designer has no empty-state text control: `_TODO_ (not exposed by the designer; runtime unverified)` — what a list shows when the datasource returns no rows.

The designer's Card style values are `""` (Regular), `small-card` (Small), `small-card-horizontal-fields` (Small / horizontal fields), `regular-card-horizontal-fields` (Regular / horizontal fields) and `simple-list-card` (Simple list).

## Pre-Flight Checklist

1. **File basics** — `configurationTypeId: 14`, `referenceName` ends in `_list`, `title` a distinct sentence-case display name, ids snake_case; universal checks ([../../datex-studio-conventions/universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)); `description` ≤100 chars.
2. **`pageSize`** is an integer; **`itemConfig.contentType`** is `"card"`.
3. **Datasource mirror** — `datasourceConfig.configParameters` cover the datasource's `inParams` exactly (unbound optional ones with `""`); `configOutParameters` match its outParams; `configId` / `moduleId` = the datasource's name and package.
4. **Card mirror** — `itemConfig.contentConfig.configParameters` cover the card's `inParams` exactly, bound with `$item.entity.<col>`; `configId` / `moduleId` = the card's name and package.
5. **Events** — every `configEvents` entry names an event declared on the card and a flow in `flows[]` (not validated).
6. **Every `clickFlowConfig.flowId`** on `topToolbar` names a flow in `flows[]`.
7. **List-tier code uses `$list`**; item bindings use `$item.entity`; `vars` / `filters` / `outParams` used are declared.
8. **No `$list.refresh()` in `on_init`.**
9. **Order** — datasource and card upserted before the list; a list opened by another component upserted before its opener.
10. **Declarative strings** (labels, tooltips, constant values) follow the TS-expression encoding ([../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions)).
11. **Validate clean** — `dxs configuration validate list -b <branchId> -D body.json`.

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| `Outdated contract. Missing input parameter <id>` | A datasource or card inParam has no `configParameters` entry | Add the entry (`"value": ""` when deliberately unbound). |
| `Outdated contract. Input parameter <id> does not exist or has been renamed` | Entry for an inParam the target no longer declares | Remove or rename the entry. |
| `Missing binding for required input parameter <id>` | Required target inParam left unbound | Bind it. |
| `Invalid contract. Referenced configuration <x> does not exist or has been renamed` | Card or datasource not on the branch yet, or wrong `configId` | Upsert the callee first; fix the name. |
| `Item content type Grid is not allowed` | `itemConfig.contentType` other than `card` | Use a card. |
| `Error converting value {null} to type 'System.Int32'` at `pageSize` | `pageSize: null` | Set an integer. |
| `Property 'filters' does not exist on type 'IList'` (or `vars` / `outParams` / `fullTextSearch`) | Using the member without declaring it (or with `"fullTextSearch": false`) | Declare it / set the flag, or bind `""`. |
| Rows appear twice on open | `$list.refresh()` in `on_init` | Remove it; let the automatic bind load. |
| Card button works but the list never refreshes | `configEvents` id or `flowId` mismatch (not validated) | Match the card's `events[].id` and a list flow. |
| Push wiped content | Upserted the envelope instead of the inner `.json` | `jq .json envelope.json > body.json` before editing. |

## Cross-References

- [../../card-creator/references/cards.md](../../card-creator/references/cards.md) — the item template: `ICard`, events, no-cross-flow rule.
- [../../datasource-creator/references/datasources.md](../../datasource-creator/references/datasources.md), [../../datasource-creator/references/flow-datasources.md](../../datasource-creator/references/flow-datasources.md) — the rows source.
- [../../grid-creator/references/grids.md](../../grid-creator/references/grids.md) — the tabular sibling (list-vs-grid decision).
- [../../calendar-creator/references/calendars.md](../../calendar-creator/references/calendars.md) — the other card host.
- [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md) — `configParameters` / `moduleId` rules.
- [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md), [../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md) — `$shell` openers, UI-tier rules.
- [../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md), [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md), [../../datex-studio-conventions/defaults.md](../../datex-studio-conventions/defaults.md).
- [../../datex-studio-shared/configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md) — get → extract `.json` → edit → validate → upsert.
