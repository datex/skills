---
name: calendar-creator
description: |
  Use when authoring or modifying a Datex Studio calendar (configurationTypeId=12,
  *-calendar.json suffix, CLI type `calendar`) on a branch — a resource-scheduling
  day view: datasource-driven columns (doors, lines, locations) crossed with an hour
  grid, events placed by matchEventToColumn and rendered through a referenced card,
  an optional unscheduled side list, and click / drag-drop handlers. Owns the
  has<X>Flow + INLINE-flow pairing (the headline trap: null → server
  NullReferenceException, a {flowId} reference or a false flag → validates clean and
  does nothing), the events-are-cards rule, the two date-window idioms, and the
  per-slot designer contexts ($calendar / $column / $calendarEvent / $event).
  Triggers: "create a calendar", "dock door schedule", "drag to reschedule",
  "unscheduled events list", "$calendar", "$calendarEvent", "Object reference not set to an instance of an object on calendar
  validate", "Cannot find name 'ICalendarEvent'", "Event content type is not allowed".
depends:
  - datex-studio-shared
  - datex-studio-conventions
  - datex-studio-runtime
  - card-creator
  - datasource-creator
  - grid-creator
  - hub-creator
  - component-wiring-check
  - requirements-gathering
  - post-edit-verification
  - component-validator
---
# Calendar Creator

Author or modify a Datex Studio calendar (configurationTypeId=12) on a branch — a **day view** whose columns come from one datasource (doors, production lines, locations), whose events come from another and are placed into a column by a `matchEventToColumn` expression, and whose event tiles are rendered by a referenced **card**. An optional unscheduled side list holds events with no column; clicking an empty slot and dragging an event are handled by **inline** flows. Calendars share the grid family's top level (filters, top toolbar, embedded flows, lifecycle hooks) and are mounted as hub tabs.

## References

- [../datex-studio-shared/branch-setup.md](../datex-studio-shared/branch-setup.md) — Branch/connection selection (shared across skills)
- [references/calendars.md](references/calendars.md) — Authoritative calendar reference: validated skeleton, every `dayViewConfig` key and its encoding, the `has<X>Flow` truth table, designer contexts and the generated `ICalendar` surface, card/hub contracts, date-window and drag/drop patterns, pre-flight checklist, failure modes
- [../card-creator/references/cards.md](../card-creator/references/cards.md) — the event card (author it first)
- [../grid-creator/references/grids.md](../grid-creator/references/grids.md) — filters, toolbar items, embedded flows, `configParameters` contract (shared top level)
- [../datasource-creator/references/datasources.md](../datasource-creator/references/datasources.md) — the columns / events / unscheduled datasources
- [../hub-creator/references/hubs.md](../hub-creator/references/hubs.md) — the `contentType: "calendar"` hub tab
- [../datex-studio-conventions/file-format.md](../datex-studio-conventions/file-format.md) — `configurationTypeId` table and the TypeScript-expression encoding rule
- [../datex-studio-conventions/naming-conventions.md](../datex-studio-conventions/naming-conventions.md) — `_calendar` indicator, user-facing `title` rule
- [../datex-studio-runtime/runtime-globals.md](../datex-studio-runtime/runtime-globals.md) — UI-tier globals available in calendar flows
- [../component-wiring-check/references/component-wiring.md](../component-wiring-check/references/component-wiring.md) — target-module, full-contract, declared-vars rules

## Dependencies

- **`requirements-gathering`** skill — invoked to produce a requirements brief if one doesn't already exist in the conversation context
- **`card-creator`** skill — invoked to author (or extend) the event card **before** the calendar references it
- **`datasource-creator`** skill — invoked for the columns, events, and unscheduled datasources when they don't exist yet
- **`grid-creator`** skill — consulted for the shared filter / toolbar / flow shapes
- **`hub-creator`** skill — invoked to mount the calendar as a hub tab
- **`component-wiring-check`** skill — invoked to audit the card, datasource, and hub-tab contracts before push

## CLI Lifecycle

Calendar authoring goes through `dxs configuration` — there is no `dxs calendar` subcommand and no field-level patching. The CLI type is **`calendar`** (lowercase), mapping to `configurationTypeId: 12`.

**Create a new calendar:**

```bash
# 1. Build body.json from references/calendars.md → Minimal Valid Skeleton
# 2. Validate — gates the push; exit 1 = errors found, not a broken CLI
dxs configuration validate calendar -b <branchId> -D body.json
# 3. Create (upsert creates or updates by referenceName)
dxs configuration upsert calendar -b <branchId> -D body.json
```

**Edit an existing calendar:**

```bash
# 1. Fetch — note the envelope wrapper
dxs configuration get calendar <configId> -b <branchId> -O envelope.json
# 2. EXTRACT THE INNER BODY (round-trip footgun guard)
jq .json envelope.json > body.json
# 3. Edit body.json
# 4. Validate — gates the push. Exit 1 = errors found (read validation_errors, fix, re-run), not a broken CLI.
#    A server 500 "Object reference not set to an instance of an object." is a body defect too (see Phase 4)
dxs configuration validate calendar -b <branchId> -D body.json
# 5. Push
dxs configuration upsert calendar -b <branchId> -D body.json
```

To see exactly what each expression slot can reference, generate the designer contexts read-only: `dxs -O json configuration contexts calendar -b <branchId> -D body.json`, projecting `.configuration_contexts.designerContexts[] | select(.id!="appContext")` (the `appContext` entry is many MB — never dump it).

### Round-trip rule (critical)

When editing an existing config, **never pipe the envelope.json directly into `dxs configuration upsert`** — it silently destroys configuration content. Always `jq .json envelope.json > body.json` before editing. See [../datex-studio-shared/configuration-roundtrip.md](../datex-studio-shared/configuration-roundtrip.md).

## Workflow

```
[Phase 1: Setup + Requirements]
Follow branch-setup.md for branch/connection selection
        |
[requirements brief in context?]  ── NO ─> invoke `requirements-gathering`
        |
[Phase 2: Calendar vs grid/list decision]
  time-boxed records per resource, one day at a time  -> calendar
  no time span or no resource axis                    -> grid / list (stop here)
        |
[Phase 3: Prerequisites on the branch]
  columns datasource  (one row per column)            -> datasource-creator
  events datasource   (date-window params)            -> datasource-creator
  unscheduled datasource (optional)                   -> datasource-creator
  event card (inParams bound per event)               -> card-creator
        |
[Phase 4: Author the calendar body]
  type "day"; dayViewConfig; filters/topToolbar/flows (grid shapes)
  pick a date-window idiom; inline every enabled handler
        |
[Phase 5: Validate + push]
dxs configuration validate calendar -b <branchId> -D body.json
dxs configuration upsert  calendar -b <branchId> -D body.json
        |
[Phase 6: Mount + verify]
hub tab contentType "calendar" (hub-creator); audit with component-wiring-check
Verify in Preview: columns page, events land in the right column, click/drag work
        |
[invoke `post-edit-verification`; then `component-validator`]
```

## Phase Details

### Phase 2: Calendar vs grid/list decision

A calendar only has a **day** view today: `type` must be `"day"`. The server enum also accepts `week` and `month`, but codegen emits no calendar interfaces for them and validate fails with `Cannot find name 'ICalendarEvent'…` — so a week/month requirement is not authorable as a calendar (`ECalendarDesignerType` has three members — `day`, `week`, `month` — but the designer's Type dropdown offers only "Day view", its week and month panes are unbuilt stubs, and there is no `weekViewConfig` / `monthViewConfig` block to author; captured from the Studio designer (option lists), dxs 0.5.8). If the records lack a resource axis, a grid or a list of cards is the better fit.

### Phase 3: Prerequisites on the branch

The calendar references three datasources and one card by `configId` + `moduleId`; all must exist on the branch first, or validate fails with `Invalid contract. Referenced configuration … does not exist`. **Events render only through a card** (`eventContentType: "card"` is the sole allowed value) — invoke `card-creator` for it, designing the card's `inParams` around what you can bind from `$calendarEvent.entity`. The events datasource takes the day window as inParams (dates, or a per-time-zone array — Phase 4).

### Phase 4: Author the calendar body

Build `body.json` from [references/calendars.md → Minimal Valid Skeleton](references/calendars.md#minimal-valid-skeleton). Key points:

1. **File basics.** `configurationTypeId: 12`, suffix `-calendar.json`, `referenceName` ends `_calendar` and matches the filename stem, `title` a distinct sentence-case display name. Plus the universal checks ([../datex-studio-conventions/universal-checklist.md](../datex-studio-conventions/universal-checklist.md)) — `description` non-null and ≤100 chars (validate does not enforce it).
2. **The `has<X>Flow` + inline-flow pairing (headline trap).** `hourSegmentClickedFlow`, `hourSegmentEventDroppedFlow`, and `unscheduledEventsConfig.unscheduledEventDroppedFlow` are **full inline cti-9 flow objects**, each gated by a sibling `has<X>Flow` boolean (`hasUnscheduledEvents` gates `unscheduledEventsConfig` the same way). Flag `true` + `null` → server `NullReferenceException`; flag `true` + `{flowId}` → validates clean and does nothing; flag `false` + flow → validates clean, flow never compiled. Only `onInitFlowConfig`, `onDataLoadedFlowConfig`, toolbar clicks, and filter changes use `{flowId}` references into `flows[]`. See [the truth table](references/calendars.md#the-hasxflow--inline-flow-pairing).
3. **Handler code reads `$event`.** Click: `$event.date`, `$event.column`. Drop on slot: `$event.date`, `$event.column`, `$event.calendarEvent.entity`. Unscheduled drop: `$event.calendarEvent` only. Leave the inline flow's `inParams: null` (some production flows declare `$date`/`$column`/`$event` inParams; the code never reads them).
4. **Each expression slot has its own context.** `$column` only in `columnsConfig.text` and `matchEventToColumn`; `$calendarEvent` only in `start`/`end`/`title`/`draggable`/card bindings and `matchEventToColumn`; everything else sees `$calendar`. Wrong context → `Cannot find name '$column'`.
5. **Datasource references copy the contract in full.** Each of the three `datasourceConfig`s carries `datasourceKeyDef`, a `configParameters` entry for every datasource inParam, and the full `configOutParameters` — `IColumnData`/`IEntityData` are generated from them, so a trimmed copy breaks every `$calendarEvent.entity.<field>` binding.
6. **Text slots are TS string literals.** `nextPageText`/`previousPageText`/`currentPageInfoText` and the unscheduled `title` (`"'Next doors'"`, `"'Unassigned'"`) — validate does **not** compile these, so bare words slip through. Hour fields (`dayStartHour`… `hourSegmentHeight`) are integer **strings**. See [../datex-studio-conventions/file-format.md → Declarative String Values Are TypeScript Expressions](../datex-studio-conventions/file-format.md#declarative-string-values-are-typescript-expressions).
7. **Pick a date-window idiom.** (A) an `on_date_change` flow (also the `onInitFlowConfig` target and the `view_date` filter's change flow) derives `start_date`/`end_date` vars that the events datasource binds; Previous/Today/Next toolbar flows move the filter with `$utils.date.add(±1, 'day', …)` and call `await $calendar.on_date_change()` — flows are callable as methods. (B) a filter-change flow computes a per-time-zone array var that the events datasource binds with an inline cast in the value string (`"$calendar.vars.time_zone_dates as {time_zone_id: string, view_date: string}[]"`). See [references/calendars.md → Common Patterns](references/calendars.md#common-patterns).
8. **Filters and `topToolbar` are the grid shapes**, read via `$calendar.filters.<id>.control.value` and `$calendar.topToolbar.<id>.control.*`. Declare every `$calendar.vars.<id>`.
9. **Persist from handlers through functions**, then `$calendar.refresh()`. Drag/drop persistence and revert-on-error behaviour are `_TODO_ (runtime unverified)` — always refresh so the view reflects stored state.

### Phase 6: Mount + verify

The observed host is a hub tab: `{ "contentType": "calendar", "contentConfig": { "configId": "<calendar>", "moduleId": "<calendar package>", "configParameters": [ …one per calendar inParam… ] } }`. If the calendar declares `outParams`, mirror them in the tab's `configOutParameters`, call `$calendar.events.outParamsChange.emit()` in the calendar, and bind the hub's handler through `outParamsChangeFlowConfig` (a `null` there leaves the hub handler dead). Generated shell openers also exist (`$shell.<Package>.open<referenceName>` / `open<referenceName>Dialog`); dialog hosting is `_TODO_ (runtime unverified)`. Audit every edge with `component-wiring-check`, then verify in Preview.

## Pre-Flight Checklist

Walk the full checklist in [references/calendars.md → Pre-Flight Checklist](references/calendars.md#pre-flight-checklist). The fast version:

1. **File basics** — `configurationTypeId: 12`, `_calendar` / `-calendar.json`, `title` ≠ `referenceName`, `description` ≤100 chars, universal checks.
2. **`type: "day"`** — never `week`/`month`.
3. **Every `has<X>Flow: true` has a full inline flow; every `false` has `null`** (and `hasUnscheduledEvents` ↔ `unscheduledEventsConfig`).
4. **Lifecycle / toolbar / filter hooks are `{flowId}` references** resolving into `flows[]`.
5. **Three datasource references** with `datasourceKeyDef`, every inParam bound, full `configOutParameters`.
6. **`eventContentType: "card"`**; `eventContentConfig` mirrors the card's `inParams`, `moduleId` = card package, `configEvents` mirror the card's `events[]`.
7. **Slot contexts respected**; handler code reads its own `$event` members.
8. **Text slots TS-quoted; hour fields integer strings.**
9. **Vars declared; `$calendar.<flow>()` calls resolve.**
10. **Host tab contract** mirrors the calendar's `inParams` (and `outParams`).

## Common Mistakes

The authoritative symptom → cause → fix table is in [references/calendars.md → Common Failure Modes](references/calendars.md#common-failure-modes). The gotchas that bite most often:

- **Wiring a click/drop handler as `{ "flowId": "…" }` like `onInitFlowConfig`** — validates clean, does nothing. Inline the flow and set `has<X>Flow: true`.
- **`has<X>Flow: true` with the flow left `null`** — validate returns a bare server `NullReferenceException` that names no field.
- **Rendering events with anything but a card** — `Event content type <X> is not allowed`; author the card with `card-creator`.
- **Trimming `configOutParameters` to the fields you bind** — the generated entity type loses the rest; copy it in full.
- **`$column` in an event slot or `$calendarEvent` in `viewDate`** — wrong designer context.
- **Bare-word paging labels** — validate doesn't compile them; TS-quote.
- **Upserting the envelope instead of the inner `.json`** — silently destroys config content.

**After your edit, invoke `post-edit-verification` to surface description/JSON/schema violations. For a final review, invoke `component-validator`.**
