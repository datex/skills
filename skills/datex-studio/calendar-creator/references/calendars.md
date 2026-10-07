# Calendars — Authoring Reference

Authoritative reference for Datex Studio **calendar** components (`configurationTypeId: 12`, CLI type `calendar`, `-calendar.json` suffix). A calendar is a resource-scheduling **day view**: a paged set of **columns** (doors, lines, locations — any datasource rows) crossed with an hour grid, with **events** placed into the column/time slot they match and rendered through a referenced **card**. An optional **unscheduled** side list holds events with no column yet. Drag/drop and click handlers are inline flows.

Calendars share the grid family's top level (filters, top toolbar, embedded flows, lifecycle hooks — see [../../grid-creator/references/grids.md](../../grid-creator/references/grids.md)) and lean on [../../card-creator/references/cards.md](../../card-creator/references/cards.md) for event rendering, [../../datasource-creator/references/datasources.md](../../datasource-creator/references/datasources.md) for the three row sources, and the cross-cutting rules in [../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md), [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md), and [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md).

> Provenance: distilled from production components on a Footprint Manager package and the generated designer contexts, dxs 0.5.8. The calendar type is rare (two owned instances org-wide); every shape rule below was re-checked with `dxs configuration validate calendar` and `dxs configuration contexts calendar`. Behaviour that needs a Preview run is marked `_TODO_ (runtime unverified)`.

## Purpose & When to Use

Pick a **calendar** when the requirement is "show time-boxed records laid out per resource for one day, and let the user create (click an empty slot) or reschedule (drag) them." Typical: dock appointments per door, production orders per line.

Pick something else when:

- The records have no time span or no resource axis → a **grid** ([../../grid-creator/SKILL.md](../../grid-creator/SKILL.md)) or a **list** of cards.
- You need week or month layouts → not authorable today (see `type` below).
- You only need to edit one record → an **editor**; open it from the calendar's click flow.

A calendar is a page component: it is mounted as a hub tab (`contentType: "calendar"`) or opened through `$shell` (see [Invocation Contract](#invocation-contract)).

## File Location & Naming

- File name: `<referenceName>-calendar.json` — a naming convention for scratch bodies; the branch is the system of record (`dxs configuration get|validate|upsert calendar`).
- `configurationTypeId: 12`; CLI type `calendar`.
- `referenceName` ends in **`_calendar`** and matches the filename stem (e.g. `dock_appointments_calendar`).
- `title` is user-facing (dialog/page heading and `$calendar.title`): a distinct, sentence-case noun phrase, never byte-identical to `referenceName` (see [../../datex-studio-conventions/naming-conventions.md → Display Names for User-Facing Components](../../datex-studio-conventions/naming-conventions.md#display-names-for-user-facing-components)). One production calendar ships with `title == referenceName` — a violation, not a pattern.
- `description` mandatory, non-empty, ≤100 chars. Validate does **not** enforce it (an empty description validates clean) — the limit is the platform column cap.
- Provenance prefixes (`custom_`, `tailored_`) per the naming conventions.

## Minimal Valid Skeleton

Day view, card-rendered events, a date filter driving a day window, no unscheduled list, no click/drop handlers. This exact shape (with real datasource/card references substituted) validates clean.

```json
{
  "type": "day",
  "dayViewConfig": {
    "columnsConfig": {
      "pageSize": 6,
      "datasourceConfig": {
        "datasourceKeyDef": [ { "id": "Id", "type": "number", "isSecured": false } ],
        "configParameters": [
          { "parameter": { "id": "<every_columns_ds_inparam>", "required": false, "type": "number", "isCollection": true }, "value": "null" }
        ],
        "configOutParameters": [ "<copied in full from the columns datasource>" ],
        "configId": "ds_<columns>",
        "moduleId": "<ColumnsDatasourcePackage>"
      },
      "text": "`${$column.Name}`",
      "nextPageText": "'Next doors'",
      "previousPageText": "'Previous doors'",
      "currentPageInfoText": "'Showing doors'"
    },
    "eventsConfig": {
      "datasourceConfig": {
        "datasourceKeyDef": [ { "id": "Id", "type": "number", "isSecured": false } ],
        "configParameters": [
          { "parameter": { "id": "start_date", "required": true, "type": "date", "isCollection": false, "isSecured": false }, "value": "$calendar.vars.start_date" },
          { "parameter": { "id": "end_date", "required": true, "type": "date", "isCollection": false, "isSecured": false }, "value": "$calendar.vars.end_date" }
        ],
        "configOutParameters": [ "<copied in full from the events datasource>" ],
        "configId": "ds_<events>",
        "moduleId": "<EventsDatasourcePackage>"
      },
      "start": "$calendarEvent.entity.ScheduledStart",
      "end": "$calendarEvent.entity.ScheduledEnd",
      "title": "$calendarEvent.entity.LookupCode",
      "draggable": "true",
      "eventContentType": "card",
      "eventContentConfig": {
        "configParameters": [
          { "parameter": { "id": "<card_inparam>", "required": true, "type": "number", "isCollection": false, "isSecured": false }, "value": "$calendarEvent.entity.Id" }
        ],
        "configId": "<event>_card",
        "moduleId": "<CardPackage>"
      }
    },
    "hasUnscheduledEvents": false,
    "unscheduledEventsConfig": null,
    "viewDate": "$calendar.filters.view_date.control.value",
    "matchEventToColumn": "$column.Id === $calendarEvent.entity?.LocationId",
    "dayStartHour": "6",
    "dayStartMinute": "0",
    "dayEndHour": "20",
    "dayEndMinute": "0",
    "hourSegments": "2",
    "hourSegmentHeight": "60",
    "hasHourSegmentClickedFlow": false,
    "hourSegmentClickedFlow": null,
    "hasHourSegmentEventDroppedFlow": false,
    "hourSegmentEventDroppedFlow": null
  },
  "topToolbar": [],
  "fullTextSearch": false,
  "excelImport": false,
  "excelExport": false,
  "filters": [
    {
      "id": "view_date", "label": "Date", "required": false, "widthType": "standard",
      "controlConfig": { "type": "dateBox", "dateBoxConfig": {
        "includeTime": false, "readOnly": false, "disabled": false,
        "value": "$utils.date.now()", "tooltip": "''",
        "uiValueChangeFlowConfig": { "flowId": "on_date_change" } } }
    }
  ],
  "flows": [
    {
      "enableProgressAndCancelation": false, "configurationTypeId": 9, "start": "step1",
      "nodes": [ { "id": "step1", "type": "step", "stepConfig": { "type": "ExecuteCodeActivity", "executeCodeConfig": {
        "code": "const d = $calendar.filters.view_date.control.value;\n$calendar.vars.start_date = $utils.date.startOf('day', d);\n$calendar.vars.end_date = $utils.date.endOf('day', d);\n$calendar.refresh();\n" } } } ],
      "referenceName": "on_date_change", "title": "on_date_change", "accessModifier": "public"
    }
  ],
  "onInitFlowConfig": { "flowId": "on_date_change" },
  "configurationTypeId": 12,
  "id": 0,
  "referenceName": "custom_example_calendar",
  "title": "Example schedule",
  "description": "Day view of scheduled records per resource column.",
  "inParams": [],
  "vars": [
    { "id": "start_date", "type": "date", "isCollection": false, "isSecured": false },
    { "id": "end_date", "type": "date", "isCollection": false, "isSecured": false }
  ],
  "accessModifier": "public"
}
```

Validate also accepts the body with the grid-family keys (`topToolbar`, `fullTextSearch`, `excelImport`, `excelExport`, `filters`, `flows`) and the optional `dayViewConfig` pairs omitted entirely — but production bodies always carry them; keep them explicit.

Verified live: `dayViewConfig` keys sent as explicit `null` (`hourSegmentClickedFlow`, `hourSegmentEventDroppedFlow`, `unscheduledEventsConfig`) are dropped by the server on `get` after `upsert` — the same null-stripping behavior as every other component type.

## Required Top-Level Fields

| Key | Required | Notes |
|---|---|---|
| `type` | yes | `ECalendarDesignerType`. **Always `"day"`.** The enum also accepts `"week"` and `"month"` (they deserialize), but codegen emits no calendar interfaces for them — validate fails with `Cannot find name 'ICalendarEvent'. Cannot find name 'IColumnData'. …` even with a populated `dayViewConfig`. Non-members fail with `Error converting value "<x>" to type '…ECalendarDesignerType'`. Members: `day`, `week`, `month` (captured from the Studio designer (option lists), dxs 0.5.8) — validate accepts the full enum, but the designer exposes only "Day view": its week and month panes are unbuilt placeholders and it builds a `dayViewConfig` only, so no week or month config block exists to author. **Do not author `week` or `month`.** |
| `dayViewConfig` | yes | The whole calendar surface — see [`dayViewConfig`](#dayviewconfig). A `null` value fails validate with a server `NullReferenceException`. |
| `topToolbar` | usual | Grid toolbar item shape (button / separator, `buttonConfig.clickFlowConfig.flowId` → a `flows[]` entry). Handles at `$calendar.topToolbar.<id>` (`.control.disabled`, `.hidden`). The day-navigation buttons (Previous / Today / Next) live here. `ICalendar.toolbar` also exists but no body carries a `toolbar` key. |
| `fullTextSearch` | usual | `true` adds a search box and exposes `$calendar.fullTextSearch` (string); bind it into the events datasource. The unscheduled list has its own `$calendar.unscheduledCalendarEventsFullTextSearch`. |
| `excelImport`, `excelExport` | usual | `false` on every observed calendar. Behaviour when `true`: `_TODO_ (runtime unverified)`. |
| `filters` | usual | Same field shape as grid/hub filters. Read via `$calendar.filters.<id>.control.value`; `uiValueChangeFlowConfig.flowId` reacts to changes. A `view_date` dateBox driving `viewDate` is the universal pattern. |
| `flows` | usual | Embedded `configurationTypeId: 9` flows. **Each is callable as a method** — `$calendar.<referenceName>()` (typed `(event?: any) => Promise<any>`). Toolbar/filter handlers and lifecycle hooks live here; the hour-segment and drop handlers do **not** (they are inlined, see below). |
| `onInitFlowConfig` | usual | `{ "flowId": "<flows[] referenceName>" }` — a **reference**, not an inline flow. |
| `onDataLoadedFlowConfig` | optional | `{ "flowId": … }` reference; runs after data loads. `$calendar.dayStartHour` etc. are writable here. |
| `inParams` | usual | What the host passes (hub filter values, ids). Typed into `$calendar.inParams`. |
| `outParams` | optional | Declaring any adds `$calendar.outParams` **and** `$calendar.events.outParamsChange.emit()`. Without outParams, `ICalendar.events` is empty. |
| `vars` | usual | Every `$calendar.vars.<id>` read or written must be declared — with no `vars[]` entries, `ICalendar` has no `vars` property at all (`Property 'vars' does not exist on type 'ICalendar'`). |
| `configurationTypeId` | yes | `12`. |
| `id`, `referenceName`, `title`, `description`, `accessModifier` | yes | Standard identity; `id: 0` for new. |

### `dayViewConfig`

| Key | Shape / encoding | Notes |
|---|---|---|
| `columnsConfig.pageSize` | number | Columns per page; paging via `$calendar.columnsPageSize` / `columnsPageSkip`. |
| `columnsConfig.datasourceConfig` | standalone datasource reference `{datasourceKeyDef, configParameters, configOutParameters, configId, moduleId}` | Rows become `$column` / `$calendar.columns` (typed `IColumnData` from `configOutParameters`). |
| `columnsConfig.text` | TS expression over `$column` | Column header, e.g. `` "`${$column.Name}`" ``. Compiled — a bad reference fails validate. |
| `columnsConfig.nextPageText` / `previousPageText` / `currentPageInfoText` | TS string literal | `"'Next doors'"`. **Validate does not compile these** (bare words and bad references both pass) — TS-quote them anyway; the observed convention is quoted literals. |
| `eventsConfig.datasourceConfig` | standalone datasource reference (+ optional `hasTop`, `hasSkip`) | Rows become `$calendarEvent.entity` (typed `IEntityData` from `configOutParameters`). |
| `eventsConfig.start` / `end` | TS expression over `$calendarEvent` | Date of the event; `??` fallbacks between actual/estimated fields are common. |
| `eventsConfig.title` | TS expression over `$calendarEvent` | `"$calendarEvent.entity.LookupCode"`. |
| `eventsConfig.draggable` | TS expression (string) | `"true"` on every observed calendar; a per-event expression (`"$calendarEvent.entity.StatusId === 1"`) validates. |
| `eventsConfig.eventContentType` | `"card"` | **The only allowed value.** `form`/`grid`/`editor`/`widget`/`list` fail with `Event content type <X> is not allowed`; unknown strings with `Event content type  is not allowed`. |
| `eventsConfig.eventContentConfig` | `{configParameters, configEvents?, configId, moduleId}` | The card reference. Missing entirely → server `NullReferenceException`. See [Events render through a card](#events-render-through-a-card). |
| `hasUnscheduledEvents` | boolean | Gates `unscheduledEventsConfig`. |
| `unscheduledEventsConfig` | `{pageSize, datasourceConfig, title, hasUnscheduledEventDroppedFlow, unscheduledEventDroppedFlow}` | Side list of events with no column. `title` is a TS string literal (`"'Unassigned'"`), not compiled by validate. `true` + `null` config → `NullReferenceException`. |
| `viewDate` | TS expression over `$calendar` | The displayed day — normally the `view_date` filter. |
| `matchEventToColumn` | TS boolean expression over `$column` + `$calendarEvent` | Places each event in a column: `"$column.Id === $calendarEvent.entity?.LocationId"`. |
| `dayStartHour`, `dayStartMinute`, `dayEndHour`, `dayEndMinute` | **string** integers | `"0"`, `"23"`, `"59"`. Validate does not type-check them; numbers also validate, but every production body uses strings. Runtime values are numbers (`$calendar.dayStartHour = 0`). |
| `hourSegments`, `hourSegmentHeight` | **string** integers | Segments per hour (`"1"`, `"2"`) and pixel height per segment (`"60"`–`"250"`). |
| `hasHourSegmentClickedFlow` + `hourSegmentClickedFlow` | boolean + **inline cti-9 flow object** | Click on an empty slot. |
| `hasHourSegmentEventDroppedFlow` + `hourSegmentEventDroppedFlow` | boolean + **inline cti-9 flow object** | Drop an event onto a slot. |
| `selection` | boolean, optional | `false` on the one calendar that carries it. Behaviour: `_TODO_ (runtime unverified)`. |

### The `has<X>Flow` + inline-flow pairing

Three optional handlers — `hourSegmentClickedFlow`, `hourSegmentEventDroppedFlow`, and `unscheduledEventsConfig.unscheduledEventDroppedFlow` — are **inline flow bodies**, each gated by a sibling boolean (`hasHourSegmentClickedFlow`, `hasHourSegmentEventDroppedFlow`, `hasUnscheduledEventDroppedFlow`). The same holds one level up for `hasUnscheduledEvents` + `unscheduledEventsConfig`. Validate's behaviour makes every mismatch quiet or cryptic:

| Body state | Validate result | Effect |
|---|---|---|
| `has…: true` + full inline flow | valid; flow code is type-checked | Handler runs. |
| `has…: true` + `null` | server **`NullReferenceException`** (500, no field named) | Push blocked, cause hidden. |
| `has…: true` + `{ "flowId": "x" }` | **valid** | Deserializes as a flow with no nodes — the handler does nothing (`_TODO_ (runtime unverified)` that it is a silent no-op). |
| `has…: false` + full inline flow | **valid; the flow code is not even compiled** | Dead handler — errors inside it are never reported. |

Inline flow object shape (identical to a `flows[]` entry, minus the need for `title`):

```json
{
  "enableProgressAndCancelation": false,
  "configurationTypeId": 9,
  "start": "step1",
  "nodes": [ { "id": "step1", "type": "step", "stepConfig": { "type": "ExecuteCodeActivity", "executeCodeConfig": { "code": "<ts>" } } } ],
  "referenceName": "hourSegmentClicked",
  "inParams": null,
  "accessModifier": "public"
}
```

Observed `referenceName`s: `hourSegmentClicked`, `hourSegmentEventDropped`, `unscheduledEventDropped`. Some production bodies declare `inParams` on these flows with `$`-prefixed ids (`$date`, `$column`, `$event`); others leave `inParams: null`. Both validate — the code never reads those inParams; it reads `$event` (next section). Leave `inParams: null` on new work.

By contrast `onInitFlowConfig`, `onDataLoadedFlowConfig`, toolbar `clickFlowConfig`, and filter `uiValueChangeFlowConfig` are **`{flowId}` references** into `flows[]`. Mixing the two conventions is the headline calendar mistake.

## Runtime Globals

Each expression slot and flow compiles in its own designer context (from `dxs configuration contexts calendar`); using a global outside its context fails validate with `Cannot find name '<global>'`.

| Where | Globals in scope |
|---|---|
| Declarative slots on `$calendar` (`viewDate`, datasource `configParameters`, filter values) | `$calendar` (+ `$utils`) |
| `columnsConfig.text` | `$calendar`, `$column` |
| `eventsConfig.start` / `end` / `title` / `draggable`, `eventContentConfig.configParameters` | `$calendar`, `$calendarEvent` |
| `matchEventToColumn` | `$calendar`, `$column`, `$calendarEvent` |
| `flows[]` (toolbar, filters, lifecycle) | `$calendar`, `$event: any`, plus `$shell`, `$settings`, `$operations`, `$frontendFlows`, `$flows`, `$datasources`, `$reports`, `$types`, `$context`, `$userSettings`, `$utils` |
| `hourSegmentClickedFlow` | same app globals; `$event: IHourSegmentClickedFlowEvent` |
| `hourSegmentEventDroppedFlow` | same; `$event: IHourSegmentEventDroppedFlowEvent` |
| `unscheduledEventDroppedFlow` | same; `$event: IUnscheduledEventDroppedFlowEvent` |

Generated surface (verbatim member list from a regenerated context; `IEntityData` / `IColumnData` are built from the events/columns `configOutParameters`):

```ts
interface ICalendarEvent { startDate: string; endDate?: string; title: string; draggable?: boolean; entity: IEntityData; }
interface IHourSegmentClickedFlowEvent { date: string; column: IColumnData; }
interface IHourSegmentEventDroppedFlowEvent { date: string; column: IColumnData; calendarEvent: ICalendarEvent; }
interface IUnscheduledEventDroppedFlowEvent { calendarEvent: ICalendarEvent; }

interface ICalendar {
  columnsPageSize: number; columnsPageSkip: number; title: string;
  columns: IColumnData[]; calendarEvents: ICalendarEvent[];
  dayStartHour: number; dayStartMinute: number; dayEndHour: number; dayEndMinute: number;
  hourSegments: number; hourSegmentHeight: number;
  unscheduledCalendarEventsPageSize: number; unscheduledCalendarEventsPageSkip: number;
  unscheduledCalendarEvents: ICalendarEvent[]; unscheduledCalendarEventsFullTextSearch: string;
  fullTextSearch: string;                       // only when fullTextSearch: true
  inParams: { … }; outParams: { … };            // outParams only when declared
  vars: { … };                                  // only when vars[] is non-empty
  events: { outParamsChange: { emit: () => void } };   // empty object without outParams
  toolbar: { }; topToolbar: { <id>: IToolModel<IButtonModel>, … };
  filters: { <id>: IFieldModel<IDateBoxModel | ISelectBoxModel | …>, … };
  <flowReferenceName>(event?: any): Promise<any>;      // one per flows[] entry
  refresh(); close();
}
```

Key reads in handler code: `$event.date` (slot start), `$event.column.Id` (target column), `$event.calendarEvent.entity` (dragged record). `$event.column` does not exist on the unscheduled-drop event; `$event.calendarEvent` does not exist on the click event — validate catches both.

UI-tier calling rules apply ([../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md)): persist through `$flows.<Pkg>.<function>` (the observed handlers call the generic `crud_update_flow` and then `$calendar.refresh()`), never an action.

## Events render through a card

`eventContentType: "card"` is mandatory; the card (cti 11) is authored with [../../card-creator/SKILL.md](../../card-creator/SKILL.md) **before** the calendar references it.

- `eventContentConfig.configId` = card `referenceName`; `moduleId` = the **card's** package (a wrong package fails with `Invalid contract. Referenced configuration <card> does not exist or has been renamed`).
- `configParameters` mirror the card's `inParams` one-for-one, bound per event with `$calendarEvent.entity.<field>` (or `$calendar.vars/inParams`). Missing entries fail with `Outdated contract. Missing input parameter <id>` / `Missing binding for required input parameter <id>`. Values are TS expressions — object literals and `.map(...)` projections are fine.
- `configEvents` is the card → calendar callback channel: one entry per event the card declares in its `events[]`, `{ "eventConfig": { "id": "<card_event>", "dataType": { "type": "number" } } }`. The list host adds `"flowConfig": { "flowId": "<flow>" }` to route the event to a handler flow; the one production calendar that declares `configEvents` carries no `flowConfig` (the event is declared but unhandled). Calendar-side handler routing via `flowConfig`: `_TODO_ (runtime unverified)`.

## Invocation Contract

**Hub tab (the observed host).** A hub mounts a calendar as a tab with `contentType: "calendar"`:

```json
{ "id": "calendar", "title": "Calendar", "contentType": "calendar",
  "contentConfig": {
    "configParameters": [ { "parameter": { "id": "warehouse_ids", "required": false, "type": "number", "isCollection": true }, "value": "$hub.filters.warehouses.control.value" } ],
    "configOutParameters": null, "configEvents": null, "outParamsChangeFlowConfig": null,
    "configId": "<calendar_referenceName>", "moduleId": "<CalendarPackage>" } }
```

`configParameters` mirror the calendar's `inParams` one-for-one; `moduleId` is the calendar's package ([../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md)). A calendar with `outParams` is mirrored by the tab's `configOutParameters`; the hub reacts through `outParamsChangeFlowConfig` after the calendar calls `$calendar.events.outParamsChange.emit()`. One production hub declares the out-params and a handler flow but leaves `outParamsChangeFlowConfig: null` — a dead handler. Hub-side wiring: [../../hub-creator/references/hubs.md](../../hub-creator/references/hubs.md).

**Shell openers (generated).** Like other page components, a calendar gets `$shell.<Package>.open<referenceName>(inParams, replaceCurrentView?)` and `$shell.<Package>.open<referenceName>Dialog(inParams, mode?, size?) => Promise<outParams>` (snake_case preserved). Dialog-hosted calendars: `_TODO_ (runtime unverified)` — no production caller observed.

## Common Patterns

### Date window — Idiom A: vars set by a date-change flow

`on_date_change` (also the `onInitFlowConfig` target) derives `start_date`/`end_date` vars from the `view_date` filter; the events (and unscheduled) datasources bind those vars. Toolbar buttons move the date and re-run it as a method:

```ts
// on_next   (on_previous: -1; on_today: assign $utils.date.now())
$calendar.filters.view_date.control.value = $utils.date.add(1, 'day', $calendar.filters.view_date.control.value);
await $calendar.on_date_change();   // re-derives start_date/end_date, then $calendar.refresh()
```

A programmatic assignment to the filter value is not assumed to fire `uiValueChangeFlowConfig` (the name says UI change) — call the flow explicitly, as the production calendars do.

The `view_date` filter's `uiValueChangeFlowConfig` points at `on_date_change` too, so typed dates and button clicks share one path. Decide UTC vs warehouse-local bounds explicitly — one production calendar uses `setUTCHours(0,0,0,0)` / `(23,59,59,999)`.

### Date window — Idiom B: per-time-zone array passed to the datasource

When columns span warehouses in different time zones, a filter-change flow computes an array (`[{timeZoneId, viewDate}]`) into an object-collection var, and the events datasource param binds it with an inline cast in the value string:

```json
{ "parameter": { "id": "time_zone_dates", "type": "object", "isCollection": true,
    "objectTypeDef": [ { "id": "time_zone_id", "type": "string" }, { "id": "view_date", "type": "date" } ] },
  "value": "$calendar.vars.time_zone_dates as {time_zone_id: string, view_date: string}[]" }
```

The cast reconciles the var's optional-member typing with the parameter type. The datasource does the per-zone day math.

### Click an empty slot → create

```ts
// hourSegmentClickedFlow (hasHourSegmentClickedFlow: true)
const result = await $shell.<Package>.open<create_form>Dialog(
  { location_id: $event.column.Id, start: $event.date, end: $utils.date.add(1, 'hour', $event.date) },
  'flyout', EModalSize.Large);
if (result?.confirm) { $calendar.refresh(); }
```

### Drag to reschedule (keep duration, move column)

```ts
// hourSegmentEventDroppedFlow (hasHourSegmentEventDroppedFlow: true)
const entity = $event.calendarEvent.entity;
const hours = (new Date(entity.ScheduledEnd).getTime() - new Date(entity.ScheduledStart).getTime()) / 3600000;
const newStart = $event.date;
const newEnd = $utils.date.add(hours, 'hour', newStart);
await $flows.Utilities.crud_update_flow({ entitySet: '<EntitySet>', id: entity.Id,
  entity: { ScheduledStart: newStart, ScheduledEnd: newEnd, LocationId: $event.column.Id } });
$calendar.refresh();
```

Validate business rules (same warehouse as the target column, status allows moving) before writing, and refresh after. The unscheduled-drop handler is the inverse: clear the column on the record (`$event.calendarEvent.entity` — there is no `$event.column`) and refresh. Whether the view reverts a drop that the handler rejects (throws) or never persists: `_TODO_ (runtime unverified)` — always `refresh()` so the grid reflects stored state.

### Filters and toolbar, as on grids

`filters[]` and `topToolbar[]` reuse the grid shapes ([../../grid-creator/references/grids.md → Toolbar Items](../../grid-creator/references/grids.md#toolbar-items)). Role-gate a button in a flow called from `on_init`: `if (await $operations.<Pkg>.<Disable_Op>.isAssignedToAll()) { $calendar.topToolbar.<id>.control.disabled = true; }`.

## Pre-Flight Checklist

1. **File basics** — `configurationTypeId: 12`, `referenceName` ends `_calendar` and matches the stem, `title` sentence case and ≠ `referenceName`, `description` non-empty ≤100 chars; universal checks ([../../datex-studio-conventions/universal-checklist.md](../../datex-studio-conventions/universal-checklist.md)).
2. **`type: "day"`** — never `week`/`month` (deserialize, then fail codegen).
3. **Every `has<X>Flow: true` sits next to a full inline cti-9 flow object** — not `null`, not `{flowId}`; every `has<X>Flow: false` sits next to `null`. Same for `hasUnscheduledEvents` / `unscheduledEventsConfig`.
4. **Lifecycle/toolbar/filter hooks are `{flowId}` references** that resolve to a `flows[]` `referenceName`.
5. **Three datasource references** (columns, events, unscheduled) each carry `datasourceKeyDef` (omitting it → `Type mismatch for key definitions`), a `configParameters` entry for **every** datasource inParam, and `configOutParameters` copied in full (they generate `IColumnData`/`IEntityData`).
6. **`eventContentType: "card"`** with `eventContentConfig` mirroring the card's `inParams`; `moduleId` = card's package; `configEvents` mirror the card's `events[]`.
7. **Expression slots in the right context** — `$column` only in `text`/`matchEventToColumn`; `$calendarEvent` only in event slots; handler code reads `$event.<member>` of its own event type.
8. **Text slots TS-quoted** (`"'Next doors'"`, `"'Unassigned'"`) — validate will not catch bare words here ([../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions)).
9. **Hour fields are integer strings** (`"0"`, `"23"`, `"2"`, `"60"`).
10. **Every `$calendar.vars.<id>` declared**; every `$calendar.<flow>()` call names a `flows[]` entry.
11. **Host contract** — the hub tab's `configParameters` mirror the calendar's `inParams`; out-params wired through `outParamsChangeFlowConfig` if the calendar emits.
12. **Validate clean** — `dxs configuration validate calendar -b <branchId> -D body.json`.

## Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| Validate returns server 500 `Object reference not set to an instance of an object.` | A `has<X>Flow: true` (or `hasUnscheduledEvents: true`) next to `null`; or `eventContentConfig` / `dayViewConfig` missing | Supply the inline flow / config block, or set the flag `false`. |
| Click or drop does nothing; validate was clean | `has<X>Flow: true` with a `{flowId}` reference instead of an inline flow, or `has<X>Flow: false` with a populated flow | Inline the full flow body and set the flag `true`. |
| `Cannot find name 'ICalendarEvent'. Cannot find name 'IColumnData'. …` | `type` is `week` or `month` | Use `"day"`. |
| `Event content type <X> is not allowed` | `eventContentType` other than `card` | Render events through a card. |
| `Property '<f>' does not exist on type 'IEntityData'` | Field missing from the events `configOutParameters` (trimmed or omitted copy) | Copy the datasource's out-params in full. |
| `Outdated contract. Type mismatch for key definitions` | `datasourceKeyDef` omitted | Restore `[ { "id": "Id", "type": "number" } ]` (the datasource's key). |
| `Outdated contract. Missing input parameter <id>` | A datasource or card inParam with no `configParameters` entry | Add every inParam (unused ones `"value": "null"`). |
| `Cannot find name '$column'` / `'$calendarEvent'` | Expression used outside its designer context | Move it to the slot whose context exports that global. |
| `Property 'vars' does not exist on type 'ICalendar'` | `vars[]` empty while code reads `$calendar.vars` | Declare the var. |
| Paging labels show code text or break Preview | Bare words in `nextPageText`/`previousPageText`/`currentPageInfoText`/unscheduled `title` | TS-quote them. |
| Hub handler never fires on calendar filter change | Tab `outParamsChangeFlowConfig: null`, or calendar never calls `$calendar.events.outParamsChange.emit()` | Wire both ends. |
| Push wiped content | Upserted the `get` envelope | `jq .json envelope.json > body.json` first ([../../datex-studio-shared/configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md)). |

## Cross-References

- [../../card-creator/references/cards.md](../../card-creator/references/cards.md) — the event card: `inParams` bound from `$calendarEvent.entity`, declared `events[]` mirrored by `configEvents`.
- [../../grid-creator/references/grids.md](../../grid-creator/references/grids.md) — shared top level: filters, toolbar items, embedded flows, `configParameters` contract rules.
- [../../datasource-creator/references/datasources.md](../../datasource-creator/references/datasources.md) — the columns / events / unscheduled datasources (standalone references, key definitions, out-param shape).
- [../../hub-creator/references/hubs.md](../../hub-creator/references/hubs.md) — mounting the calendar as a `contentType: "calendar"` tab and wiring out-params.
- [../../component-wiring-check/references/component-wiring.md](../../component-wiring-check/references/component-wiring.md) — target-module, full-contract, and declared-vars rules for the card, datasource, and hub edges.
- [../../datex-studio-conventions/file-format.md](../../datex-studio-conventions/file-format.md) — `configurationTypeId` table and the TS-expression encoding rule.
- [../../datex-studio-conventions/naming-conventions.md](../../datex-studio-conventions/naming-conventions.md) — `_calendar` indicator and the user-facing `title` rule.
- [../../datex-studio-runtime/runtime-globals.md](../../datex-studio-runtime/runtime-globals.md) and [../../datex-studio-runtime/calling-conventions.md](../../datex-studio-runtime/calling-conventions.md) — UI-tier globals and calling rules.
- [../../datex-studio-shared/configuration-roundtrip.md](../../datex-studio-shared/configuration-roundtrip.md) — the get → extract → edit → validate → upsert loop.
