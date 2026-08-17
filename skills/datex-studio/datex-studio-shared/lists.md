# Lists

A **list** (`configurationTypeId: 14`, `*-list.json`) renders a datasource's collection as a stack of repeated **card** items, with an optional top toolbar, full-text search box, and embedded flows. It is the card-based sibling of the grid: where a grid renders rows in a tabular control with column definitions, a list renders one [card](cards.md) per result row and is the right choice when each item needs a rich, non-tabular layout (action bars, multi-line bodies, per-item buttons). Lists bind their rows through a [datasource](../datasource-creator/references/datasources.md) (`flows` or `oData` variant) exactly like grids, and reference their item card and any dialogs through the standard [component-wiring](../component-wiring-check/references/component-wiring.md) `configParameters` contract.

This doc is a **stub** — sections 1–4 plus Runtime Globals, Invocation, Common Patterns, and the Pre-Flight Checklist are filled from shipped list components; deeper sections are marked `_TODO_`.

## Purpose & When to Use

Use a list when:

- Each item benefits from a **card** layout — header, body fields, and a per-item action bar — rather than tabular columns. (For tabular data with sortable/filterable columns, use a [grid](../grid-creator/references/grids.md).)
- You want the **report-card refresh pattern**: an item card mutates state through a flow, emits an event, and the list re-fetches itself.
- You are presenting a manage/browse surface opened as a **dialog** (`open<list>Dialog`) — e.g. a saved-filter-sets manager or a "shared sets" marketplace browser.

A list always pairs with: a datasource (the rows) and a card (the item template). It optionally adds a top toolbar of buttons and a built-in full-text search box.

## File Location & Naming

The branch is the source of truth (author via `dxs configuration` commands); the conventional export layout:

- Path: `src/lists/<name>-list.json`
- Suffix: `-list.json`
- `configurationTypeId`: `14`
- Naming: `referenceName` is snake_case and matches the filename stem (e.g. `filter_sets_list`). Default package `Utilities`, `accessModifier: public` (see [`defaults.md`](../datex-studio-conventions/defaults.md)). The user-facing `title` should be a human-readable label distinct from the `referenceName` (e.g. title "Shared filter sets" / referenceName `marketplace_filter_sets_list`).

## Minimal Valid Skeleton

```json
{
  "icon": null,
  "pageSize": 200,
  "toolbar": null,
  "topToolbar": [],
  "fullTextSearch": false,
  "filters": null,
  "datasourceConfig": {
    "datasourceKeyDef": [{ "id": "<key>", "type": "string", "isSecured": null }],
    "dynamicOrderBys": null,
    "dynamicFilters": null,
    "configParameters": [
      { "parameter": { "id": "<ds_inparam>", "type": "string", "required": false }, "value": "$list.inParams.<x>", "parsedValue": null }
    ],
    "configOutParameters": [ { "id": "result", "type": "object", "isCollection": true, "objectTypeDef": [] } ],
    "configEvents": null,
    "outParamsChangeFlowConfig": null,
    "configId": "<datasource_referenceName>",
    "moduleId": "Utilities",
    "isOwned": null
  },
  "itemConfig": {
    "contentType": "card",
    "contentConfig": {
      "configParameters": [
        { "parameter": { "id": "<card_inparam>", "type": "string", "required": false }, "value": "$item.entity.<field>", "parsedValue": null }
      ],
      "configOutParameters": null,
      "configEvents": [
        { "eventConfig": { "id": "<card_event>" }, "flowConfig": { "flowId": "<list_flow>", "flowParameters": null } }
      ],
      "outParamsChangeFlowConfig": null,
      "configId": "<card_referenceName>",
      "moduleId": "Utilities",
      "isOwned": null
    },
    "width": "100%",
    "height": "auto",
    "cardStyle": ""
  },
  "flows": [],
  "onInitFlowConfig": null,
  "onDataLoadedFlowConfig": null,
  "onIntervalFlowConfig": null,
  "intervalSeconds": null,
  "configurationTypeId": 14,
  "id": 0,
  "referenceName": "<name>_list",
  "title": "<Human Title>",
  "description": "<≤100 chars>",
  "inParams": [],
  "outParams": null,
  "vars": null,
  "events": null,
  "accessModifier": "public"
}
```

## Required Top-Level Fields

| Field | Purpose | Notes |
|---|---|---|
| `configurationTypeId` | Component-type discriminator | Must be `14`. |
| `referenceName` | Code-facing handle | Snake_case; matches filename stem. Drives the auto-generated `open<referenceName>Dialog` shell method. |
| `title` | User-facing label | Human-readable; distinct from `referenceName`. |
| `description` | Searchable description | Non-empty, ≤ 100 chars (Studio rejects longer imports). |
| `accessModifier` | Visibility | Default `public`. |
| `datasourceConfig` | Rows source binding | `configId` + `moduleId` point at the datasource; `configParameters` mirror its `inParams` **one-for-one**. |
| `itemConfig` | Per-row item template | `contentType: "card"`; `contentConfig.configId` + `moduleId` point at the card; its `configParameters` mirror the card's `inParams` one-for-one; `configEvents` map card events → list flows. |
| `inParams` | Host-provided context | e.g. `screen_ref`, `draft_id`; the parent passes these in the `open<list>Dialog(...)` call. |
| `flows` | Embedded list-tier flows | Toolbar click handlers (`on_click_*`) and card-event handlers (`handle_*`). |
| `topToolbar` | Toolbar buttons | Array of button items (or `[]`/`null`); each button's `clickFlowConfig.flowId` resolves to an embedded flow. |
| `fullTextSearch` | Built-in search box | When `true`, bind `$list.fullTextSearch` into a datasource `full_text_search` inParam via a `configParameter`. |

## Runtime Globals

List-tier flows (toolbar clicks, card-event handlers, `onInit`/`onDataLoaded`) expose **`$list`**:

- `$list.refresh()` — re-fetch the datasource (the back half of the report-card pattern).
- `$list.close()` — close the list when hosted as a dialog.
- `$list.inParams.<id>` — the host-provided context (e.g. `$list.inParams.screen_ref`).
- `$list.vars.<id>` — list-scoped vars (only if declared in top-level `vars`).
- `$list.fullTextSearch` — current value of the built-in search box (bind into a datasource configParameter).

Also available: `$shell` (`open<X>Dialog`, `openToaster`, `openConfirmationDialog`), `$flows`, `$utils`. **The item card runs in card tier, not list tier** — inside the card use `$card` / `$item.entity.<field>`, never `$list`. Item `configParameters` bind with `$item.entity.<field>`; the list's own `configParameters` bind with `$list.inParams.*` / `$list.fullTextSearch` / constants.

## Invocation Contract

- **Opened as a dialog** by a parent (hub/grid/list/card) via `$shell.<Module>.open<referenceName>Dialog(inParams, 'modal' | 'flyout', EModalSize.<Size>)`. The auto-generated method name is `open` + `referenceName` + `Dialog`; it exists only **after the list is uploaded to Studio** — so when one list opens another, upload the callee first.
- **`datasourceConfig.configParameters` mirror the datasource's `inParams` one-for-one** — a missing entry silently passes `undefined`; an extra entry references an inParam the datasource doesn't declare. (Dead-wiring trap; see [`component-wiring.md`](../component-wiring-check/references/component-wiring.md).)
- **`itemConfig.contentConfig.configParameters` mirror the card's `inParams` one-for-one** — same trap, one level deeper. An optional card inParam may be omitted (arrives `undefined`), but document the omission as deliberate.
- **`configEvents`** map each card event id (declared in the card's `events`) to a list flow `referenceName`.

## Common Patterns

### Report-card refresh

An item card performs a mutation through a flow, emits an event (e.g. `sets_changed`), and the list's matching handler calls `$list.refresh()`. Keeps the card stateless about list rendering and avoids manual row patching.

### Open-as-dialog + refresh-on-return

A toolbar button opens another component as a dialog, then refreshes so any change made inside is reflected:

```ts
await $shell.Utilities.openmarketplace_filter_sets_listDialog(
  { screen_ref: $list.inParams.screen_ref, draft_id: $list.inParams.draft_id }, 'modal', EModalSize.Large);
$list.refresh();
```

### Full-text search pushdown

Set `"fullTextSearch": true` and bind it into the datasource: a `configParameter` with `id: "full_text_search"` and `value: "$list.fullTextSearch"`. The datasource flow filters server-/flow-side on the term.

### Constant-scope configParameter

Pin a datasource/card parameter to a literal via a TS-expression `value`: string literals are **quoted** (`"value": "'marketplace'"`), booleans are **bare** (`"value": "true"`). Used e.g. to run the same datasource in different modes from two lists.

## Pre-Flight Checklist

1. `description` non-empty and ≤ 100 chars; `accessModifier: public`; `configurationTypeId: 14`; `referenceName` matches the filename stem; all ids snake_case.
2. `datasourceConfig.configParameters` mirror the datasource's `inParams` one-for-one (no missing, no extra); `configId` = datasource `referenceName`, `moduleId` = its package.
3. `itemConfig.contentConfig.configParameters` mirror the card's `inParams` one-for-one (dead-wiring trap); every `configEvents` entry maps an existing card event id to an existing list flow `referenceName`.
4. Every `topToolbar` button's `clickFlowConfig.flowId` resolves to an embedded flow `referenceName`.
5. List-tier flow code uses `$list` (not `$card`/`$item`); item bindings use `$item.entity.<field>`.
6. Constant `configParameter` values are valid TS expressions — string literals quoted (`'mine'`), booleans bare (`true`).
7. Declarative string slots (button tooltips/labels) follow the TS-expression encoding ([`file-format.md`](../datex-studio-conventions/file-format.md)).
8. If this list opens another via `open<X>Dialog`, the callee is uploaded to Studio **before** this list.

## Cross-References

- [`cards.md`](cards.md) — the item template a list renders (`itemConfig.contentType: "card"`); event/`$card` contract.
- [`datasources.md`](../datasource-creator/references/datasources.md) / [`flow-datasources.md`](../datasource-creator/references/flow-datasources.md) — the rows source; `configParameters` mirror its `inParams`.
- [`grids.md`](../grid-creator/references/grids.md) — the tabular sibling; choose grid for columns, list for cards.
- [`component-wiring.md`](../component-wiring-check/references/component-wiring.md) — the one-for-one `configParameters` / `moduleId` rules and the dead-wiring trap.
- [`file-format.md`](../datex-studio-conventions/file-format.md), [`naming-conventions.md`](../datex-studio-conventions/naming-conventions.md), [`defaults.md`](../datex-studio-conventions/defaults.md), [`runtime-globals.md`](../datex-studio-runtime/runtime-globals.md).

## _TODO_

- _Runtime Globals: confirm the full `$list` imperative surface (item selection, scroll/paging hooks, `$list.actionbar` vs `topToolbar`)._
- _Required fields: `pageSize` / `datasourceKeyDef` constraints; `onIntervalFlowConfig` polling semantics._
- _Common Patterns: `vars`-driven view toggles; empty-state rendering; `onDataLoadedFlowConfig` usage._
